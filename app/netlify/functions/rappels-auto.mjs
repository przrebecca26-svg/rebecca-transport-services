// TACHE PROGRAMMEE NETLIFY : RAPPELS PAR E-MAIL ENVOYES TOUT SEULS (17 nov. 2026) - Rebecca Services
// Tous les soirs vers 19h (heure d'Israel) : retours d'aller-retour et rendez-vous beaute de demain.
// Reglage a faire une fois (Reglages → « Rappels envoyés tout seuls » dans l'espace prive) :
//   Netlify → Project configuration → Environment variables : ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE
//   (cle privee EmailJS : Account → API keys, et cocher « Allow EmailJS API for non-browser applications »).
// Aucun secret n'est ecrit dans le code. Le compte robot ne peut que lire les demandes et noter « e-mail parti ».
import { cleClient } from "../../src/pricing/clients.js";
import { documentRest, rappelsDuSoir } from "../../src/pricing/rappelsAuto.js";

export const config = { schedule: "0 17 * * *" }; // 17h UTC = 19h l'hiver en Israel (20h l'ete)

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enHtml = (t) => echapper(String(t || "").slice(0, 3000)).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

async function connexion() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_MDP, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error("connexion du robot refusée");
  return (await r.json()).idToken;
}

export default async function rappelsAuto() {
  const journal = { envoyes: 0, sansEmail: 0, erreurs: 0 };
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !process.env.EMAILJS_PRIVEE) {
    console.log("Rappels automatiques : variables Netlify manquantes (ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE).");
    return new Response("non configuré");
  }
  const jeton = await connexion();
  const entetes = { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };
  const lire = async (chemin) => {
    const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
    return r.ok ? documentRest(await r.json()) : null;
  };
  const requete = async (collection, filtre) => {
    const structuredQuery = { from: [{ collectionId: collection }], ...(filtre ? { where: filtre } : {}) };
    const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: entetes, body: JSON.stringify({ structuredQuery }) });
    if (!r.ok) throw new Error(`lecture ${collection} refusée (${r.status})`);
    return (await r.json()).map((x) => documentRest(x.document)).filter(Boolean);
  };

  const reglage = await lire("reglages/rappelsAuto");
  if (!reglage || reglage.actif !== true) return new Response("désactivé");
  const emails = await lire("reglages/emails");
  const modele = emails && String(emails.modeleClient || "").trim();
  if (!modele) return new Response("modèle EmailJS manquant");

  const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const demandes = await requete("demandes", { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "acceptee" } } });
  const mouvements = await requete("mouvements");
  const aEnvoyer = rappelsDuSoir(demandes, mouvements, jour);

  for (const { demande: d, sujet, texte } of aEnvoyer) {
    let email = EMAIL_OK.test(String(d.email || "").trim()) ? String(d.email).trim() : "";
    if (!email && d.uid) {
      const c = await lire(`clients/${d.uid}`);
      if (c && EMAIL_OK.test(String(c.email || "").trim())) email = String(c.email).trim();
    }
    if (!email) {
      const cle = cleClient(d);
      const f = cle ? await lire(`clientsAdmin/${cle}`) : null;
      if (f && EMAIL_OK.test(String(f.email || "").trim())) email = String(f.email).trim();
    }
    if (!email) {
      journal.sansEmail++;
      continue;
    }
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: modele,
        user_id: EMAILJS.cle,
        accessToken: process.env.EMAILJS_PRIVEE,
        template_params: { to_email: email, to_name: String(d.nom || "").slice(0, 100), sujet, message: texte.slice(0, 3000), message_html: enHtml(texte) },
      }),
    });
    if (!r.ok) {
      journal.erreurs++;
      continue;
    }
    journal.envoyes++;
    await fetch(`${BASE}/demandes/${d.id}?updateMask.fieldPaths=rappelMailAutoLe`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ fields: { rappelMailAutoLe: { stringValue: jour } } }),
    });
  }

  const detail = `${journal.envoyes} e-mail(s) envoyé(s), ${journal.sansEmail} sans adresse, ${journal.erreurs} erreur(s)`;
  await fetch(`${BASE}/reglages/rappelsAuto?updateMask.fieldPaths=dernierPassage&updateMask.fieldPaths=detail`, {
    method: "PATCH",
    headers: entetes,
    body: JSON.stringify({ fields: { dernierPassage: { stringValue: new Date().toISOString() }, detail: { stringValue: detail } } }),
  });
  console.log("Rappels automatiques :", detail);
  return new Response(detail);
}
