// TACHE PROGRAMMEE NETLIFY : RELEVE DU DIMANCHE AUX RESTAURANTS (22 nov. 2026) - Rebecca Services
// Chaque dimanche matin (9h en Israel l'hiver, 10h l'ete) : le releve de la semaine finie part par e-mail a chaque
// restaurant actif qui a une adresse e-mail dans sa fiche (Repertoire), avec chaque numero de commande.
// Memes reglages que les rappels automatiques : ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE + modele EmailJS (Reglages).
// Le robot ne fait que LIRE (restaurants, commandes, Repertoire) : aucune nouvelle regle Firebase.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { messageReleveResto, releveResto, semaineFinie } from "../../src/pricing/restos.js";
import { famillesBrutes } from "../../src/pricing/repertoire.js";
import { lireFamilles } from "../../src/pricing/familles.js";

export const config = { schedule: "0 7 * * 0" }; // dimanche 7h UTC

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

export default async function releveRestos() {
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !process.env.EMAILJS_PRIVEE) return new Response("non configuré");
  const jeton = await connexion();
  const entetes = { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };
  const lire = async (chemin) => {
    const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
    return r.ok ? documentRest(await r.json()) : null;
  };
  const liste = async (chemin) => {
    const r = await fetch(`${BASE}/${chemin}?pageSize=300`, { headers: entetes });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.documents || []).map(documentRest).filter(Boolean);
  };
  const emails = await lire("reglages/emails");
  const modele = emails && String(emails.modeleClient || "").trim();
  if (!modele) return new Response("modèle EmailJS manquant");
  const rep = await lire("clientsAdmin/_repertoire");
  let familles = [];
  try {
    familles = lireFamilles(famillesBrutes((rep && rep.json) || "{}"));
  } catch {
    familles = [];
  }
  const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const semaine = semaineFinie(jour);
  const restos = (await liste("restos")).filter((r) => r.actif === true);
  let envoyes = 0;
  for (const r of restos) {
    const f = familles.find((x) => x.id === r.ficheId);
    const email = f && f.resto && EMAIL_OK.test(String(f.resto.email || "").trim()) ? String(f.resto.email).trim() : "";
    if (!email) continue;
    const commandes = (await liste(`restos/${r.id}/commandesResto`)).map((c) => ({ ...c, cle: r.id }));
    const rel = releveResto(commandes, semaine);
    if (!rel || rel.nb === 0) continue;
    const texte = messageReleveResto(r.nom, rel, r.moyen);
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: modele,
        user_id: EMAILJS.cle,
        accessToken: process.env.EMAILJS_PRIVEE,
        template_params: { to_email: email, to_name: String(r.nom || "").slice(0, 100), sujet: `Relevé Rebecca Services du ${semaine.debut.split("-").reverse().join("/")} au ${semaine.fin.split("-").reverse().join("/")}`, message: texte.slice(0, 3000), message_html: enHtml(texte) },
      }),
    });
    if (res.ok) envoyes++;
  }
  console.log(`Relevés restaurants : ${envoyes} e-mail(s) envoyé(s)`);
  return new Response(`${envoyes} relevé(s) envoyé(s)`);
}
