// TACHE PROGRAMMEE NETLIFY : ALERTE « NOUVELLE DEMANDE » (18 nov. 2026, suggestion validée) - Rebecca Services
// Toutes les 5 minutes : s'il y a de nouvelles demandes sur le site, UN e-mail part vers l'adresse de Rebecca
// (Réglages → Général → « Me prévenir à chaque nouvelle demande »). Son iPhone sonne avec Mail ou Gmail.
// Même compte robot et mêmes variables Netlify que les rappels du soir (ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE).
import { SUJET_ALERTE, demandesASignaler, documentRest, texteAlerte } from "../../src/pricing/rappelsAuto.js";

export const config = { schedule: "*/5 * * * *" };

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const SITE = "https://rebecca-services-netanya.netlify.app";
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enHtml = (t) => echapper(String(t || "").slice(0, 3000)).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

export default async function alerteDemandes() {
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !process.env.EMAILJS_PRIVEE) return new Response("non configuré");
  // Réglage public : lu avant de connecter le robot (rien à faire si l'alerte est coupée)
  const brut = await fetch(`${BASE}/reglages/alerteDemandes?key=${CLE_API}`);
  const reglage = brut.ok ? documentRest(await brut.json()) : null;
  const email = reglage && String(reglage.email || "").trim();
  if (!reglage || reglage.actif !== true || !EMAIL_OK.test(email || "")) return new Response("désactivé");

  const connexion = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_MDP, returnSecureToken: true }),
  });
  if (!connexion.ok) return new Response("connexion du robot refusée");
  const entetes = { Authorization: `Bearer ${(await connexion.json()).idToken}`, "Content-Type": "application/json" };
  const structuredQuery = { from: [{ collectionId: "demandes" }], where: { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "en attente" } } } };
  const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: entetes, body: JSON.stringify({ structuredQuery }) });
  if (!r.ok) return new Response(`lecture refusée (${r.status})`);
  const demandes = (await r.json()).map((x) => documentRest(x.document)).filter(Boolean);
  const liste = demandesASignaler(demandes);
  if (!liste.length) return new Response("rien de nouveau");

  const emails = await fetch(`${BASE}/reglages/emails?key=${CLE_API}`);
  const modele = emails.ok ? String((documentRest(await emails.json()) || {}).modeleClient || "").trim() : "";
  if (!modele) return new Response("modèle EmailJS manquant");
  const texte = texteAlerte(liste, SITE);
  const envoi = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS.service,
      template_id: modele,
      user_id: EMAILJS.cle,
      accessToken: process.env.EMAILJS_PRIVEE,
      template_params: { to_email: email, to_name: "Rebecca", sujet: SUJET_ALERTE(liste.length), message: texte, message_html: enHtml(texte) },
    }),
  });
  if (!envoi.ok) return new Response("e-mail refusé");
  const quand = new Date().toISOString();
  for (const d of liste) {
    await fetch(`${BASE}/demandes/${d.id}?updateMask.fieldPaths=alerteRebeccaLe`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ fields: { alerteRebeccaLe: { stringValue: quand } } }),
    });
  }
  return new Response(`${liste.length} demande(s) signalée(s)`);
}
