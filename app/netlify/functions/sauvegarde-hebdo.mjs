// SAUVEGARDE AUTOMATIQUE CHAQUE SEMAINE (18 nov. 2026, suggestion validée) - Rebecca Services
// Le dimanche vers 21h (heure d'Israel), le robot copie toutes les donnees importantes du site dans la collection
// « sauvegardes » (8 dernieres semaines gardees), puis previent Rebecca par notification et par e-mail.
// Rebecca la telecharge en un geste : Finances → Bilan → « Sauvegardes automatiques ».
// Regles Firebase v26 (le robot lit tout et ecrit seulement dans « sauvegardes »).
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { maintenantIsrael } from "../../src/pricing/planningNotif.js";
import { envoyerNotification } from "../outils/webPush.mjs";

export const config = { schedule: "0 18,19 * * 0" }; // 21h en Israel, l'hiver (19h UTC) comme l'ete (18h UTC)

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg";
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const COLLECTIONS = ["demandes", "mouvements", "depenses", "autresRevenus", "clients", "clientsAdmin", "suivi", "commandes", "paiementsDeclares", "projetsDigital", "projetsDigitalPrive", "trajetsPartages", "recharges", "creditMouvements", "avis", "promos", "codesClient", "catalogue", "reglages", "fermetures", "equipe", "vehicules", "reversements", "coursiers", "missionsCoursiers", "reglementsCoursiers", "candidaturesPartenaires", "missionsEquipe", "cartesCadeaux", "admin", "agendaJours", "creneauxOccupes", "disposEquipe", "autorisations", "activites"];
const DOCS_ADMIN = ["admin/tournee", "admin/tourneeJours", "admin/objectifs"];
const MORCEAU = 900000; // un document Firestore = 1 Mo au plus
const GARDER = 8;
const env = (k) => process.env[k] || (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || "";

async function connecter() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env("ROBOT_EMAIL"), password: env("ROBOT_MDP"), returnSecureToken: true }),
  });
  if (!r.ok) return null;
  return { Authorization: `Bearer ${(await r.json()).idToken}`, "Content-Type": "application/json" };
}
async function toute(entetes, nom) {
  const liste = [];
  let jeton = "";
  for (let page = 0; page < 30; page++) {
    const r = await fetch(`${BASE}/${nom}?pageSize=300${jeton ? `&pageToken=${encodeURIComponent(jeton)}` : ""}`, { headers: entetes });
    if (!r.ok) return { liste, erreur: r.status };
    const j = await r.json();
    for (const d of j.documents || []) liste.push(documentRest(d));
    if (!j.nextPageToken) break;
    jeton = j.nextPageToken;
  }
  return { liste };
}
const chaine = (v) => ({ stringValue: String(v) });

export default async function sauvegardeHebdo() {
  const { date, min } = maintenantIsrael();
  if (Math.floor(min / 60) !== 21) return new Response("pas l'heure");
  if (!env("ROBOT_EMAIL") || !env("ROBOT_MDP")) return new Response("non configuré");
  const entetes = await connecter();
  if (!entetes) return new Response("connexion du robot refusée");

  const donnees = {};
  const compte = {};
  const erreurs = [];
  for (const nom of COLLECTIONS) {
    const { liste, erreur } = await toute(entetes, nom);
    donnees[nom] = liste;
    compte[nom] = liste.length;
    if (erreur) erreurs.push(`${nom} (${erreur})`);
  }
  for (const chemin of DOCS_ADMIN) {
    const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
    donnees[chemin] = r.ok ? documentRest(await r.json()) : null;
  }
  const json = JSON.stringify({ type: "sauvegarde-complete-rebecca-services", date, creeLe: new Date().toISOString(), compte, donnees });
  const morceaux = Math.max(1, Math.ceil(json.length / MORCEAU));
  for (let i = 0; i < morceaux; i++) {
    await fetch(`${BASE}/sauvegardes?documentId=${date}_${i}`, {
      method: "POST", headers: entetes,
      body: JSON.stringify({ fields: { date: chaine(date), partie: { integerValue: String(i) }, parties: { integerValue: String(morceaux) }, taille: { integerValue: String(json.length) }, json: chaine(json.slice(i * MORCEAU, (i + 1) * MORCEAU)) } }),
    });
  }
  // On garde les 8 dernieres semaines
  const anciennes = (await toute(entetes, "sauvegardes")).liste.filter((s) => s && s.date && s.date < new Date(Date.parse(`${date}T12:00:00Z`) - GARDER * 7 * 86400000).toISOString().slice(0, 10));
  for (const s of anciennes) await fetch(`${BASE}/sauvegardes/${s.id}`, { method: "DELETE", headers: entetes });

  const total = Object.values(compte).reduce((a, b) => a + b, 0);
  const resume = `💾 Sauvegarde du ${date.split("-").reverse().join("/")} faite : ${total} fiches (${compte.demandes} demandes, ${compte.mouvements} paiements, ${compte.clients} clientes)${erreurs.length ? ` · non copié : ${erreurs.join(", ")}` : ""}. À télécharger dans Finances → Bilan → Sauvegardes automatiques.`;

  // Notification sur le telephone
  if (env("VAPID_PRIVEE")) {
    const r = await fetch(`${BASE}/notificationsPush?pageSize=20`, { headers: entetes });
    const abonnes = r.ok ? ((await r.json()).documents || []).map(documentRest) : [];
    for (const a of abonnes) {
      try { await envoyerNotification(a, { titre: "💾 Sauvegarde de la semaine", corps: resume, tag: `sauvegarde-${date}`, lien: "/admin#/admin" }, env("VAPID_PRIVEE")); } catch {}
    }
  }
  // E-mail (adresse de l'alerte « nouvelle demande »)
  const reglage = await fetch(`${BASE}/reglages/alerteDemandes`, { headers: entetes });
  const email = reglage.ok ? String((documentRest(await reglage.json()) || {}).email || "") : "";
  const modeles = await fetch(`${BASE}/reglages/emails`, { headers: entetes });
  const modele = modeles.ok ? String((documentRest(await modeles.json()) || {}).modeleClient || "") : "";
  if (email && modele && env("EMAILJS_PRIVEE")) {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS.service, template_id: modele, user_id: EMAILJS.cle, accessToken: env("EMAILJS_PRIVEE"),
        template_params: { to_email: email, to_name: "Rebecca", sujet: "💾 Sauvegarde de la semaine - Rebecca Services", message: resume, message_html: resume } }),
    });
  }
  return new Response(resume);
}
