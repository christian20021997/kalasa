import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ymqtjzvfmmnnqsoycaoo.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_8w9FCaS_RpqM1WYNUimMSA_i8kVng8s';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Authentification ---------- */
export async function login(email, motDePasse) {
  const { error } = await sb.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
  location.href = 'index.html';
}

export async function logout() {
  await sb.auth.signOut();
  localStorage.removeItem('kalasa_ctx');
  location.href = 'login.html';
}

/* À appeler au début de chaque page protégée */
export async function exigerConnexion() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'login.html'; return null; }
  return session.user;
}

/* ---------- Contexte : établissement + année + rôle ---------- */
export async function chargerContexte() {
  const { data: acces, error } = await sb.from('acces')
    .select('role, etablissement_id, etablissements(nom)');
  if (error) throw error;
  if (!acces.length) throw new Error("Aucun accès configuré pour ce compte.");

  const { data: annees } = await sb.from('annees_scolaires')
    .select('*').order('libelle', { ascending: false });

  const saved = JSON.parse(localStorage.getItem('kalasa_ctx') || '{}');
  const etab = acces.find(a => a.etablissement_id === saved.etab) || acces[0];
  const deEtab = annees.filter(a => a.etablissement_id === etab.etablissement_id);
  const annee = deEtab.find(a => a.id === saved.annee)
             || deEtab.find(a => a.actif)
             || deEtab[0];

  const ctx = {
    etab: etab.etablissement_id,
    etabNom: etab.etablissements.nom,
    role: etab.role,
    annee: annee?.id,
    anneeLib: annee?.libelle,
    mesEtabs: acces,
    mesAnnees: annees
  };
  localStorage.setItem('kalasa_ctx', JSON.stringify({ etab: ctx.etab, annee: ctx.annee }));
  return ctx;
}

export function changerContexte(etab, annee) {
  localStorage.setItem('kalasa_ctx', JSON.stringify({ etab, annee }));
  location.reload();
}

/* ---------- CRUD générique (filtré par établissement + année) ---------- */
export async function lister(table, ctx, extra = q => q) {
  const { data, error } = await extra(
    sb.from(table).select('*')
      .eq('etablissement_id', ctx.etab)
      .eq('annee_id', ctx.annee)
  );
  if (error) throw error;
  return data;
}

export async function ajouter(table, ctx, valeurs) {
  const { data, error } = await sb.from(table)
    .insert({ ...valeurs, etablissement_id: ctx.etab, annee_id: ctx.annee })
    .select().single();
  if (error) throw error;
  return data;
}

export async function modifier(table, id, valeurs) {
  const { error } = await sb.from(table).update(valeurs).eq('id', id);
  if (error) throw error;
}

export async function supprimer(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
}

/* ---------- Photos ---------- */
export async function envoyerPhoto(ctx, fichier) {
  const chemin = `${ctx.etab}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('photos-eleves')
    .upload(chemin, fichier, { contentType: fichier.type });
  if (error) throw error;
  return chemin;
}

export async function urlPhoto(chemin) {
  const { data } = await sb.storage.from('photos-eleves').createSignedUrl(chemin, 3600);
  return data?.signedUrl;
}

/* ---------- Temps réel ---------- */
export function ecouter(table, ctx, rappel) {
  return sb.channel(`rt-${table}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `etablissement_id=eq.${ctx.etab}` },
        rappel)
    .subscribe();
}
