/* KALASA — synchronisation localStorage <-> Supabase (table "donnees").
   À charger dans le <head> de chaque page, juste après auth.js : <script src="sync.js"></script> */
(() => {
  'use strict';
  const LOCAL = ['kalasa_users', 'kalasa_ctx', 'kalasa_derniere_sauvegarde'];
  const sync = k => typeof k === 'string' && k.startsWith('kalasa_') && !LOCAL.includes(k);
  const setRaw = Storage.prototype.setItem, rmRaw = Storage.prototype.removeItem;
  const get = k => localStorage.getItem(k);
  const put = (k, v) => setRaw.call(localStorage, k, v);
  const del = k => rmRaw.call(localStorage, k);
  const lire = (k, d) => { try { const v = JSON.parse(get(k)); return v ?? d; } catch { return d; } };
  const canon = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map(c => [c, x[c]])) : x);
  const aSession = () => Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k));
  const clesLocales = () => Object.keys(localStorage).filter(sync);
  const sales = () => lire('ksync_sales', []);
  const ajouterSale = k => { const l = sales(); if (!l.includes(k)) { l.push(k); put('ksync_sales', JSON.stringify(l)); } };
  const retirerSale = k => put('ksync_sales', JSON.stringify(sales().filter(x => x !== k)));
  const client = async () => (await import('./kalasa-db.js')).sb;

  /* Toute écriture dans une clé kalasa_ est repérée puis envoyée à Supabase */
  let timer = null;
  const planifier = k => { ajouterSale(k); clearTimeout(timer); timer = setTimeout(pousserSales, 1500); };
  Storage.prototype.setItem = function (k, v) { setRaw.call(this, k, v); if (this === localStorage && sync(k)) planifier(k); };
  Storage.prototype.removeItem = function (k) { rmRaw.call(this, k); if (this === localStorage && sync(k)) planifier(k); };

  /* Une clé locale -> des enregistrements (un par élément) */
  function decomposer(k) {
    const v = lire(k, null), recs = {};
    if (v === null) return { genre: 'liste', recs };
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        const obj = x && typeof x === 'object';
        const rid = String(obj && x.id != null ? x.id : 'i' + i);
        let etab = obj && x.etab != null && Number.isFinite(+x.etab) ? +x.etab : null;
        if (k === 'kalasa_etablissements' && obj && x.id != null) etab = +x.id;
        recs[rid] = { pos: i, etab, contenu: x };
      });
      return { genre: 'liste', recs };
    }
    if (typeof v === 'object') {
      Object.keys(v).forEach((c, i) => { recs[c] = { pos: i, etab: null, contenu: v[c] }; });
      return { genre: 'objet', recs };
    }
    recs._ = { pos: 0, etab: null, contenu: { v } };
    return { genre: 'valeur', recs };
  }
  const empreintes = recs => Object.fromEntries(Object.entries(recs).map(([r, x]) => [r, canon(x)]));
  const noterEtat = k => put('ksnap_' + k, JSON.stringify({ h: empreintes(decomposer(k).recs) }));
  function modifieLocalement(k) {
    const anc = lire('ksnap_' + k, { h: {} }).h, nou = empreintes(decomposer(k).recs);
    const a = Object.keys(anc), n = Object.keys(nou);
    return a.length !== n.length || n.some(r => anc[r] !== nou[r]);
  }

  /* Envoi */
  async function pousser(sb, k) {
    const { genre, recs } = decomposer(k);
    const anc = lire('ksnap_' + k, { h: {} }).h, nou = empreintes(recs), envoi = [];
    Object.entries(recs).forEach(([rid, r]) => {
      if (anc[rid] !== nou[rid]) envoi.push({ cle: k, rid, genre, etab: r.etab, pos: r.pos, contenu: r.contenu, maj: new Date().toISOString() });
    });
    const sup = Object.keys(anc).filter(r => !(r in nou));
    for (let i = 0; i < envoi.length; i += 500) {
      const { error } = await sb.from('donnees').upsert(envoi.slice(i, i + 500), { onConflict: 'cle,rid' });
      if (error) throw error;
    }
    for (let i = 0; i < sup.length; i += 100) {
      const { error } = await sb.from('donnees').delete().eq('cle', k).in('rid', sup.slice(i, i + 100));
      if (error) throw error;
    }
    put('ksnap_' + k, JSON.stringify({ h: nou }));
  }
  let enCours = false;
  async function pousserSales() {
    if (enCours || !sales().length || !aSession()) return;
    enCours = true;
    try {
      const sb = await client();
      for (const k of [...sales()]) {
        retirerSale(k);
        try { await pousser(sb, k); } catch (e) { ajouterSale(k); console.error('KALASA sync', k, e); }
      }
    } catch (e) { console.error('KALASA sync', e); }
    enCours = false;
  }

  /* Réception */
  async function tirer(sb, role) {
    let tout = [], de = 0;
    for (;;) {
      const { data, error } = await sb.from('donnees').select('cle,rid,genre,pos,contenu')
        .order('cle').order('rid').range(de, de + 999);
      if (error) throw error;
      tout = tout.concat(data);
      if (data.length < 1000) break;
      de += 1000;
    }
    const parCle = {};
    tout.forEach(r => { (parCle[r.cle] ||= { genre: r.genre, rows: [] }).rows.push(r); });
    const enAttente = sales(), migrer = [], aEnvoyer = [];
    let change = false;
    for (const k of new Set([...Object.keys(parCle), ...clesLocales()])) {
      if (!sync(k) || enAttente.includes(k)) continue;
      const dist = parCle[k], jamais = !get('ksnap_' + k);
      if (!jamais && modifieLocalement(k)) { aEnvoyer.push(k); continue; }      // modification locale non envoyée : elle gagne
      if (!dist) {
        if (jamais && role === 'admin') migrer.push(k);                           // première fois : on envoie les données locales
        else if (jamais) put('ksnap_' + k, '{"h":{}}');
        else if (tout.length > 0) { del(k); del('ksnap_' + k); change = true; }   // supprimé à distance
        continue;
      }
      const rows = dist.rows.slice().sort((a, b) => a.pos - b.pos);
      let val;
      if (dist.genre === 'liste') val = rows.map(r => r.contenu);
      else if (dist.genre === 'objet') { val = {}; rows.forEach(r => { val[r.rid] = r.contenu; }); }
      else val = rows[0].contenu.v;
      const loc = get(k);
      let pareil = false;
      try { pareil = loc !== null && canon(JSON.parse(loc)) === canon(val); } catch {}
      if (!pareil) {
        if (jamais && loc) put('kbackup_' + k, loc);
        put(k, JSON.stringify(val));
        change = true;
      }
      noterEtat(k);
    }
    for (const k of [...migrer, ...aEnvoyer]) {
      if (Object.keys(decomposer(k).recs).length || get('ksnap_' + k)) await pousser(sb, k);
      else put('ksnap_' + k, '{"h":{}}');
    }
    return change;
  }

  const page = () => ((location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '') || 'index').toLowerCase();
  const moi = () => { const s = lire('ksess', null); return s ? lire('kalasa_users', []).find(u => u.id === s.uid) || null : null; };

  async function demarrer() {
    if (['login', 'demarrage', 'activation', 'verifier'].includes(page())) return;
    if (!aSession()) { if (get('ksess')) { del('ksess'); location.replace('login.html'); } return; }
    try {
      const sb = await client();
      await pousserSales();
      const u = moi();
      const change = await tirer(sb, u && u.role);
      const dernier = +sessionStorage.getItem('ksync_reload') || 0;
      if (change && Date.now() - dernier > 10000) { sessionStorage.setItem('ksync_reload', Date.now()); location.reload(); }
    } catch (e) { console.error('KALASA sync', e); }
  }

  function vider() {
    clesLocales().forEach(del);
    Object.keys(localStorage).filter(k => k.startsWith('ksnap_') || k.startsWith('kbackup_')).forEach(del);
    del('ksync_sales'); del('kalasa_ctx');
  }
  async function deconnexion() {
    try { await pousserSales(); } catch {}
    const reste = sales().length;
    try { await (await client()).auth.signOut(); } catch {}
    del('ksess');
    if (!reste) vider();
    location.replace('login.html');
  }
  async function tout_(role) {
    const sb = await client();
    await tirer(sb, role);
    await pousserSales();
  }

  addEventListener('online', pousserSales);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pousserSales(); });
  window.KSYNC = { tout: tout_, vider, deconnexion, pousserSales };
  demarrer();
})();
