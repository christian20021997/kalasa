/* KALASA — authentification locale (comptes, rôles, session, verrouillage).
   À charger dans le <head> de CHAQUE page : <script src="auth.js"></script>
   ⚠ Protection côté appareil : elle empêche l'accès ordinaire, pas une personne techniquement experte
   qui ouvre les outils du navigateur. Pour une vraie sécurité multi-appareils, il faudra un serveur. */
(() => {
  'use strict';
  const U = 'kalasa_users', S = 'ksess', L = 'ksec';
  const lire = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const ecrire = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const users = () => lire(U, []);
  const sauverUsers = l => ecrire(U, l);

  /* ---------- Rôles et pages autorisées ---------- */
  const ROLES = {
    admin: 'Administrateur',
    directeur: 'Directeur',
    secretaire: 'Secrétaire',
    enseignant: 'Enseignant',
    caissier: 'Caissier',
    comptable: 'Comptable',
    eleve: 'Élève'
  };

  /* Tous les modules existants (clé = nom du fichier sans .html) */
  const MODULES = ['index','demarrage','etablissement','annee','classe','eleve','parent','personnel',
    'presence','note','horaire','finance','message','secretariat','dashboard-general','utilisateurs',
    'droits','audit','espace-eleve'];

  /* Droits PAR DÉFAUT (utilisés si l'admin n'a rien personnalisé) */
  const DROITS_DEFAUT = {
    secretaire: ['index','demarrage','eleve','classe','parent','personnel','presence','horaire','message','secretariat'],
    enseignant: ['index','demarrage','presence','note','horaire'],
    caissier:   ['index','demarrage','finance','message'],
    comptable:  ['index','demarrage','finance','message','dashboard-general'],
    directeur:  ['index','demarrage','etablissement','annee','classe','eleve','parent','personnel',
                 'presence','note','horaire','finance','message','secretariat','dashboard-general','audit'],
    eleve:      ['espace-eleve']
  };

  /* Lecture de la matrice personnalisée (admin uniquement) */
  function droits() {
    const perso = lire('kalasa_droits', null);
    if (!perso || typeof perso !== 'object') return DROITS_DEFAUT;
    const out = {};
    Object.keys(ROLES).forEach(r => {
      if (r === 'admin') return;                       // l'admin a tout, non modifiable
      if (Array.isArray(perso[r])) out[r] = perso[r].filter(m => MODULES.includes(m));
      else out[r] = DROITS_DEFAUT[r] || [];
    });
    return out;
  }
  function sauverDroits(d) {
    if (d === null) localStorage.removeItem('kalasa_droits');
    else ecrire('kalasa_droits', d);
  }

  const ACCUEIL = {
    admin: 'index.html', directeur: 'index.html', secretaire: 'eleve.html',
    enseignant: 'presence.html', caissier: 'finance.html',
    comptable: 'finance.html', eleve: 'espace-eleve.html'
  };
  const accueilDe = r => { const a = ACCUEIL[r] || 'index.html'; return peut(a.replace('.html', ''), { role: r }) ? a : 'index.html'; };
  const nomPage = () => ((location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '') || 'index').toLowerCase();
  const peut = (p, u) => {
    if (!u) return false;
    if (u.role === 'admin') return true;
    if (u.role === 'eleve') return p === 'espace-eleve';
    if (p === 'espace-eleve') return false;
    if (p === 'index' || p === 'demarrage') return true;      // toujours accessibles au personnel
    const D = droits();
    return (D[u.role] || []).includes(p);
  };

  /* ---------- Mots de passe : PBKDF2-SHA256, sel aléatoire ---------- */
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  const deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function hacher(mdp, salt) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Ouvrez KALASA en https:// ou sur localhost pour activer la connexion sécurisée.');
    const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, cle, 256));
  }
  const egal = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
  const mdpErreur = m => (typeof m === 'string' && m.length >= 8) ? '' : 'Le mot de passe doit contenir au moins 8 caractères.';
  async function fixerMdp(u, mdp) { const s = crypto.getRandomValues(new Uint8Array(16)); u.salt = b64(s); u.hash = await hacher(mdp, s); return u; }

  /* ---------- Comptes ---------- */
  async function creer({ nom, login, role = 'enseignant', etabs = [], eleve = 0 }, mdp) {
    nom = String(nom || '').trim(); login = String(login || '').trim().toLowerCase();
    if (!nom) throw new Error('Le nom est obligatoire.');
    if (!/^[a-z0-9._-]{3,}$/.test(login)) throw new Error('Identifiant : 3 caractères minimum (lettres, chiffres, . _ -).');
    if (!ROLES[role]) throw new Error('Rôle inconnu.');
    const e = mdpErreur(mdp); if (e) throw new Error(e);
    const l = users(); if (l.some(x => x.login === login)) throw new Error('Cet identifiant existe déjà.');
    if (role === 'eleve' && !eleve) throw new Error('Choisissez l\'élève concerné.');
    etabs = [...new Set((etabs || []).map(Number).filter(Boolean))];
    if (role !== 'admin' && role !== 'eleve' && !etabs.length) throw new Error('Cochez au moins un établissement pour ce compte.');
    if (role === 'admin') etabs = [];                       // l'administrateur voit tout
    const u = await fixerMdp({ id: Date.now(), nom, login, role, etabs, eleve, actif: true }, mdp);
    l.push(u); sauverUsers(l); return u;
  }
  /* Établissements autorisés d'un compte existant (réservé à l'administrateur) */
  function modifierEtabs(id, etabs) {
    if (!cur || cur.role !== 'admin') throw new Error('Réservé à l\'administrateur.');
    const l = users(), u = l.find(x => x.id === id); if (!u) throw new Error('Compte introuvable.');
    etabs = [...new Set((etabs || []).map(Number).filter(Boolean))];
    if (u.role !== 'admin' && u.role !== 'eleve' && !etabs.length) throw new Error('Cochez au moins un établissement.');
    u.etabs = u.role === 'admin' ? [] : etabs; sauverUsers(l);
  }
  async function reinitialiser(id, mdp) {
    const e = mdpErreur(mdp); if (e) throw new Error(e);
    const l = users(), u = l.find(x => x.id === id); if (!u) throw new Error('Compte introuvable.');
    await fixerMdp(u, mdp); sauverUsers(l);
  }

  const sansEtab = u => !!u && u.role !== 'admin' && u.role !== 'eleve' && !(u.etabs && u.etabs.length);

  /* ---------- Connexion, verrouillage anti-devinette ---------- */
  const attente = () => Math.max(0, Math.ceil((lire(L, { jusqua: 0 }).jusqua - Date.now()) / 1000));
  function echec() {
    const s = lire(L, { n: 0, jusqua: 0 }); s.n++;
    if (s.n >= 5) s.jusqua = Date.now() + Math.min(900, 30 * 2 ** (s.n - 5)) * 1000;
    ecrire(L, s);
  }
  async function connexion(id, mdp, rester) {
    const w = attente(); if (w) return { ok: false, msg: `Trop d'essais. Réessayez dans ${w} s.` };
    const u = users().find(x => x.login === String(id).trim().toLowerCase());
    const h = await hacher(mdp, u ? deb64(u.salt) : crypto.getRandomValues(new Uint8Array(16)));
    if (!u || u.actif === false || !egal(h, u.hash)) { echec(); return { ok: false, msg: 'Identifiant ou mot de passe incorrect.' }; }
    ecrire(L, { n: 0, jusqua: 0 });
    if (sansEtab(u)) return { ok: false, msg: 'Aucun établissement ne vous est attribué. Demandez à l\'administrateur.' };
    const dur = (rester ? 30 * 24 : 12) * 3600e3;
    ecrire(S, { uid: u.id, dur, exp: Date.now() + dur });
    if (window.KAUDIT) KAUDIT.log('connexion.reussie', u.nom, { login: u.login, role: u.role });
    return { ok: true, user: u };
  }
  /* MODIFIÉ : la déconnexion passe par la synchronisation (envoi des données puis fermeture de la session Supabase) */
  function deconnexion() {
    localStorage.removeItem(S);
    if (window.KSYNC) KSYNC.deconnexion();
    else location.replace('login.html');
  }

  /* ---------- Session courante ---------- */
  let cur = null;
  (() => {
    const s = lire(S, null); if (!s || s.exp < Date.now()) return;
    const u = users().find(x => x.id === s.uid && x.actif !== false); if (!u) return;
    s.exp = Date.now() + s.dur; ecrire(S, s); cur = u;
  })();
  /* RÈGLE : seul l'administrateur voit tous les établissements. Les autres ne voient que ceux qui leur sont attribués (liste vide = aucun). */
  const filtrerEtabs = l => !cur ? [] : cur.role === 'admin' ? l : l.filter(e => (cur.etabs || []).includes(e.id));
  const etabAutorise = id => !!cur && (cur.role === 'admin' || (cur.etabs || []).includes(+id));

  /* ---------- Garde : redirige avant tout affichage ---------- */
  const page = nomPage();
  const LIBRES = ['login', 'demarrage', 'activation', 'verifier'];
  if (!LIBRES.includes(page)) {
    if (!cur) {
      document.documentElement.style.visibility = 'hidden';
      location.replace('login.html?retour=' + encodeURIComponent(page + '.html' + location.search));
    } else if (sansEtab(cur)) {
      document.documentElement.style.visibility = 'hidden';
      alert('Aucun établissement ne vous est attribué. Demandez à l\'administrateur.');
      localStorage.removeItem(S); location.replace('login.html');
    } else if (!peut(page, cur)) {
      document.documentElement.style.visibility = 'hidden';
      alert('Accès non autorisé pour votre rôle (' + ROLES[cur.role] + ').');
      location.replace(accueilDe(cur.role));
    }
  }

  /* ---------- Changement de mot de passe (fenêtre intégrée) ---------- */
  function changerMdp() {
    const d = document.createElement('dialog');
    d.style.cssText = 'border:0;border-radius:14px;padding:18px;width:min(92vw,340px);background:var(--c,#fff);color:var(--t,#1b2430)';
    d.innerHTML = `<form method="dialog"><h3 style="margin:0 0 8px">🔑 Changer mon mot de passe</h3>
      ${['Ancien mot de passe', 'Nouveau (8 caractères min.)', 'Confirmer le nouveau'].map((l, i) =>
        `<label style="display:block;font-size:.8rem;margin:10px 0 4px">${l}</label>
         <input type="password" id="kp${i}" autocomplete="${i ? 'new-password' : 'current-password'}" style="width:100%;padding:11px;border:1px solid #8885;border-radius:8px;font-size:1rem;background:transparent;color:inherit">`).join('')}
      <p id="kpe" style="color:#dc2626;font-size:.85rem;min-height:1.2em;margin:8px 0 0"></p>
      <div style="display:flex;gap:8px;margin-top:8px"><button type="button" id="kpo" style="flex:1;padding:11px;border:0;border-radius:8px;background:var(--m,#2563eb);color:#fff">Valider</button>
      <button value="x" style="flex:1;padding:11px;border:0;border-radius:8px;background:#8883;color:inherit">Annuler</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', () => d.remove());
    d.querySelector('#kpo').onclick = async () => {
      const [a, n, c] = [0, 1, 2].map(i => d.querySelector('#kp' + i).value), er = d.querySelector('#kpe');
      try {
        if (n !== c) throw new Error('La confirmation ne correspond pas.');
        if (!egal(await hacher(a, deb64(cur.salt)), cur.hash)) throw new Error('Ancien mot de passe incorrect.');
        await reinitialiser(cur.id, n); cur = users().find(x => x.id === cur.id); d.close();
        if (window.KAUDIT) KAUDIT.log('compte.motdepasse', cur.nom, {});
        alert('Mot de passe modifié.');
      } catch (e) { er.textContent = e.message; }
    };
  }

  /* ---------- Nom de l'utilisateur + déconnexion ---------- */
  function badge() {
    if (!cur || LIBRES.includes(page) || !document.body || document.getElementById('k-out')) return;
    const b = 'background:#fff3;color:#fff;border:0;border-radius:6px;padding:4px 8px;font-size:.9rem;cursor:pointer';
    const s = document.createElement('span');
    s.id = 'k-badge';
    s.innerHTML = `<span>👤 ${esc(cur.nom)}</span><button style="${b}" id="k-mdp" title="Changer mon mot de passe">🔑</button><button style="${b}" id="k-out" title="Se déconnecter">🚪</button>`;
    const h = document.querySelector('header');
    if (h) { s.style.cssText = 'float:right;margin-left:auto;display:inline-flex;gap:6px;align-items:center;font-size:.8rem;font-weight:400'; h.appendChild(s); }
    else { s.style.cssText = 'position:fixed;top:6px;right:6px;z-index:60;display:inline-flex;gap:6px;align-items:center;font-size:.8rem;color:#fff;background:#2563eb;padding:4px 10px;border-radius:99px'; document.body.appendChild(s); }
    s.querySelector('#k-mdp').onclick = changerMdp;
    s.querySelector('#k-out').onclick = deconnexion;
  }
  /* ---------- Liens ajoutés au menu ---------- */
  const LIENS = [['secretariat', '🗂 Secrétariat'], ['dashboard-general', '📊 Général'],
    ['utilisateurs', '🔐 Utilisateurs'], ['droits', '🔑 Droits'], ['audit', '📋 Audit']];
  function menu() {
    const nav = document.getElementById('nav');
    if (!cur || !nav || LIBRES.includes(page)) return;
    const modele = [...nav.querySelectorAll('a')].find(a => !(a.getAttribute('href') || '').includes(page));
    LIENS.forEach(([p, lib]) => {
      if (!peut(p, cur) || nav.querySelector('a[href="' + p + '.html"]')) return;
      const a = modele ? modele.cloneNode(false) : document.createElement('a');
      if (!modele) a.style.cssText = 'padding:12px 14px;white-space:nowrap;color:inherit;text-decoration:none;font-size:.85rem';
      a.href = p + '.html'; a.textContent = lib;
      if (p === page) a.style.cssText = 'color:var(--m,#2563eb);font-weight:600;border-bottom:3px solid var(--m,#2563eb)';
      nav.appendChild(a);
    });
  }
  const lancer = () => {
    try { badge(); } catch (e) { console.error('KALASA badge :', e); }
    try { menu(); } catch (e) { console.error('KALASA menu :', e); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
  addEventListener('load', () => { lancer(); setTimeout(lancer, 800); });

  window.KAUTH = { user: () => cur, ROLES, MODULES, droits, sauverDroits, peut: p => peut(p, cur),
    users, sauverUsers, creer, reinitialiser, modifierEtabs, etabAutorise, connexion, deconnexion,
    filtrerEtabs, attente, changerMdp, accueilDe, accueil: () => accueilDe(cur && cur.role) };
})();
