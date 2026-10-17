<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KALASA - Connexion</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; background: linear-gradient(135deg, #0f766e, #1e3a8a);
    padding: 16px;
  }
  .carte {
    background: #fff; width: 100%; max-width: 380px; border-radius: 16px;
    padding: 28px 24px; box-shadow: 0 10px 30px rgba(0,0,0,.25);
  }
  h1 { margin: 0 0 4px; color: #0f766e; text-align: center; letter-spacing: 2px; }
  p.sous { margin: 0 0 20px; text-align: center; color: #64748b; font-size: 14px; }
  label { display: block; font-size: 13px; color: #334155; margin: 12px 0 4px; }
  input {
    width: 100%; padding: 12px; font-size: 16px; border: 1px solid #cbd5e1;
    border-radius: 10px; outline: none;
  }
  input:focus { border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15,118,110,.15); }
  button {
    width: 100%; margin-top: 20px; padding: 13px; font-size: 16px; font-weight: 600;
    color: #fff; background: #0f766e; border: 0; border-radius: 10px; cursor: pointer;
  }
  button:disabled { opacity: .6; cursor: wait; }
  #msg { margin-top: 14px; font-size: 14px; text-align: center; color: #b91c1c; min-height: 18px; }
</style>
</head>
<body>
  <div class="carte">
    <h1>KALASA</h1>
    <p class="sous">Gestion scolaire</p>

    <label for="email">Adresse e-mail</label>
    <input id="email" type="email" autocomplete="username" placeholder="exemple@gmail.com">

    <label for="mdp">Mot de passe</label>
    <input id="mdp" type="password" autocomplete="current-password" placeholder="••••••••">

    <button id="btn">Se connecter</button>
    <div id="msg"></div>
  </div>

<script type="module">
  import { sb, login } from './kalasa-db.js';

  // Déjà connecté ? on va directement à l'accueil
  const { data: { session } } = await sb.auth.getSession();
  if (session) location.href = 'index.html';

  const btn = document.getElementById('btn');
  const msg = document.getElementById('msg');

  async function connecter() {
    msg.textContent = '';
    const email = document.getElementById('email').value.trim();
    const mdp = document.getElementById('mdp').value;
    if (!email || !mdp) { msg.textContent = 'Remplis l\'e-mail et le mot de passe.'; return; }

    btn.disabled = true; btn.textContent = 'Connexion...';
    try {
      await login(email, mdp);
    } catch (e) {
      msg.textContent = e.message.includes('Invalid login')
        ? 'E-mail ou mot de passe incorrect.'
        : 'Erreur : ' + e.message;
      btn.disabled = false; btn.textContent = 'Se connecter';
    }
  }

  btn.addEventListener('click', connecter);
  document.getElementById('mdp').addEventListener('keydown', e => { if (e.key === 'Enter') connecter(); });
</script>
</body>
</html>
