/* KALASA — contexte partagé : établissement + année scolaire.
   Une seule sélection, mémorisée, appliquée à TOUTES les pages (listes, formulaires, rapports).
   API :  KCTX.get() → {etab, annee, multi}   |  KCTX.set({etab, annee, multi})   |  KCTX.refresh()  */
(() => {
  'use strict';
  const KEY = 'kalasa_ctx';
  const lire = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const etabsOK = () => window.KAUTH ? KAUTH.filtrerEtabs(lire('kalasa_etablissements')) : [];   // sans auth.js : rien n'est montré
  const ctxBrut = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Contexte toujours valide : si l'établissement/année mémorisé a disparu, on retombe sur un choix existant */
  function get() {
    const c = ctxBrut(), E = etabsOK(), A = lire('kalasa_annees');
    const etab = E.some(x => x.id === c.etab) ? c.etab : (E[0] || {}).id || 0;
    const annee = A.some(x => x.id === c.annee) ? c.annee : (A.find(x => x.active) || A[0] || {}).id || 0;
    const multi = Array.isArray(c.multi) ? c.multi.filter(id => E.some(x => x.id === id)) : null; // null = tous
    return { etab, annee, multi };
  }
  function set(p) {
    const avant = JSON.stringify(get());
    localStorage.setItem(KEY, JSON.stringify({ ...ctxBrut(), ...get(), ...p }));
    if (JSON.stringify(get()) !== avant) { appliquer(true); dispatchEvent(new CustomEvent('kalasa:ctx', { detail: get() })); }
  }

  /* Aligne les listes déroulantes de la page (#etab, #annee, #filtre = filtre par année) sur le contexte */
  function choisir(id, v) {
    const s = document.getElementById(id);
    if (!s || !v || s.value === String(v) || ![...s.options].some(o => o.value == v)) return;
    s.value = v; s.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function appliquer(relancer) {
    const c = get();
    choisir('etab', c.etab); choisir('annee', c.annee); choisir('filtre', c.annee);
    remplirBarre();
    if (relancer) {                       // pages dont les listes ne dépendent pas d'un <select> : on les redessine
      if (typeof rendu === 'function') rendu();
      if (typeof majEleves === 'function') majEleves();
    }
  }

  /* Barre fixe sous le menu */
  function creerBarre() {
    if (window.KCTX_NOBAR || document.getElementById('kbar')) return;
    const st = document.createElement('style');
    st.textContent = `#kbar{position:sticky;top:0;z-index:30;display:flex;gap:8px;align-items:center;padding:8px 12px;
      background:var(--c,#fff);border-bottom:1px solid #8883;box-shadow:0 1px 3px #0001}
      #kbar label{flex:1;display:flex;gap:6px;align-items:center;margin:0;font-size:1rem;opacity:1;min-width:0}
      #kbar select{padding:8px;font-size:.9rem;min-width:0}#kbar a{font-size:.85rem;color:var(--m,#2563eb)}`;
    document.head.appendChild(st);
    const b = document.createElement('div'); b.id = 'kbar';
    b.innerHTML = '<label title="Établissement">🏫<select id="kb-e"></select></label><label title="Année scolaire">📅<select id="kb-a"></select></label>';
    const nav = document.getElementById('nav') || document.querySelector('header');
    if (nav) nav.after(b); else document.body.prepend(b);
    b.querySelector('#kb-e').onchange = e => set({ etab: +e.target.value });
    b.querySelector('#kb-a').onchange = e => set({ annee: +e.target.value });
  }
  function remplirBarre() {
    const e = document.getElementById('kb-e'), a = document.getElementById('kb-a'); if (!e) return;
    const c = get(), E = etabsOK(), A = lire('kalasa_annees').sort((x, y) => (y.debut || '').localeCompare(x.debut || ''));
    e.innerHTML = E.length ? E.map(x => `<option value="${x.id}">${esc(x.nom)}</option>`).join('') : '<option value="">Aucun établissement</option>';
    a.innerHTML = A.length ? A.map(x => `<option value="${x.id}">${esc(x.lib)}</option>`).join('') : '<option value="">Aucune année</option>';
    e.value = c.etab || ''; a.value = c.annee || '';
  }

  window.KCTX = { get, set, refresh: () => { remplirBarre(); appliquer(true); } };
  document.addEventListener('DOMContentLoaded', () => { creerBarre(); remplirBarre(); });
  addEventListener('load', () => appliquer(false));          // après l'initialisation propre à chaque page
  addEventListener('storage', e => { if (e.key === KEY || (e.key || '').startsWith('kalasa_')) appliquer(true); });
  addEventListener('pageshow', e => { if (e.persisted) appliquer(true); });

  /* Si l'utilisateur change l'établissement/l'année dans la page elle-même, on mémorise pour les autres pages */
  document.addEventListener('change', e => {
    const t = e.target, v = +t.value;
    if (!v) return;
    if (t.id === 'etab') set({ etab: v });
    else if (t.id === 'annee' || t.id === 'filtre' && t.closest && !t.closest('#kbar') && lire('kalasa_annees').some(a => a.id === v)) set({ annee: v });
  });
})();
