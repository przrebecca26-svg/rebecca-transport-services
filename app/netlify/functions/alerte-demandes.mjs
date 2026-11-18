// TACHE PROGRAMMEE NETLIFY : ALERTE « NOUVELLE DEMANDE » (18 nov. 2026, suggestion validée) - Rebecca Services
// Toutes les 5 minutes : s'il y a de nouvelles demandes sur le site, UN e-mail part vers l'adresse de Rebecca
// (Réglages → Général → « Me prévenir à chaque nouvelle demande »). Son iPhone sonne avec Mail ou Gmail.
// Même compte robot et mêmes variables Netlify que les rappels du soir (ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE).
// 18 nov. 2026 (soir) : + NOTIFICATION sur l'iPhone (icone « Rebecca admin »), toutes les 2 minutes.
//   Les deux sont independantes : e-mail seul, notification seule, ou les deux (Réglages → Général).
//   Variable Netlify en plus pour la notification : VAPID_PRIVEE (cle secrete, deja posee par Claude).
import { SUJET_ALERTE, demandesASignaler, documentRest, texteAlerte } from "../../src/pricing/rappelsAuto.js";
import { messageNotification, messageTest } from "../../src/pricing/notifications.js";
import { envoyerNotification } from "../outils/webPush.mjs";

export const config = { schedule: "*/2 * * * *" };

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const SITE = "https://rebeccaservices.com"; // 18 nov. 2026 : nom de domaine
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enHtml = (t) => echapper(String(t || "").slice(0, 3000)).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

async function connecterRobot() {
  const connexion = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_MDP, returnSecureToken: true }),
  });
  if (!connexion.ok) return null;
  return { Authorization: `Bearer ${(await connexion.json()).idToken}`, "Content-Type": "application/json" };
}

async function envoyerEmail(liste, email) {
  const emails = await fetch(`${BASE}/reglages/emails?key=${CLE_API}`);
  const modele = emails.ok ? String((documentRest(await emails.json()) || {}).modeleClient || "").trim() : "";
  if (!modele || !process.env.EMAILJS_PRIVEE) return false;
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
  return envoi.ok;
}

// Envoie chaque message a chaque telephone abonne ; un telephone desabonne est efface. Renvoie le nombre envoye.
async function notifier(entetes, messages) {
  const r = await fetch(`${BASE}/notificationsPush?pageSize=20`, { headers: entetes });
  if (!r.ok) return 0;
  const abonnes = ((await r.json()).documents || []).map(documentRest).filter((a) => a && a.endpoint && a.p256dh && a.auth);
  let envoyes = 0;
  for (const a of abonnes) {
    for (const m of messages) {
      try {
        const res = await envoyerNotification(a, m, process.env.VAPID_PRIVEE);
        if (res.ok) envoyes++;
        if (res.expire) { await fetch(`${BASE}/notificationsPush/${a.id}`, { method: "DELETE", headers: entetes }); break; }
        if (!res.ok) console.log(`Notification refusée (${res.statut}) pour ${a.id}`);
      } catch (e) {
        console.log(`Notification impossible pour ${a.id} : ${e.message}`);
      }
    }
  }
  return envoyes;
}

export default async function alerteDemandes() {
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP) return new Response("non configuré");
  // Réglage public : lu avant de connecter le robot (rien à faire si l'alerte et les notifications sont coupées)
  const brut = await fetch(`${BASE}/reglages/alerteDemandes?key=${CLE_API}`);
  const reglage = (brut.ok ? documentRest(await brut.json()) : null) || {};
  const email = String(reglage.email || "").trim();
  const parEmail = reglage.actif === true && EMAIL_OK.test(email);
  const parNotif = reglage.notifications === true && !!process.env.VAPID_PRIVEE;
  const test = parNotif && typeof reglage.testDemande === "string" && reglage.testDemande !== reglage.testFait;
  if (!parEmail && !parNotif) return new Response("désactivé");

  const entetes = await connecterRobot();
  if (!entetes) return new Response("connexion du robot refusée");

  // Bouton « Envoyer une notification de test » (Réglages) : envoyée une seule fois
  if (test) {
    await notifier(entetes, [messageTest()]);
    await fetch(`${BASE}/reglages/alerteDemandes?updateMask.fieldPaths=testFait`, {
      method: "PATCH", headers: entetes, body: JSON.stringify({ fields: { testFait: { stringValue: reglage.testDemande } } }),
    });
  }

  // Seulement les demandes des dernières 24 h (lecture légère toutes les 2 minutes)
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const structuredQuery = { from: [{ collectionId: "demandes" }], where: { fieldFilter: { field: { fieldPath: "creeLe" }, op: "GREATER_THAN", value: { timestampValue: depuis } } } };
  const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: entetes, body: JSON.stringify({ structuredQuery }) });
  if (!r.ok) return new Response(`lecture refusée (${r.status})`);
  const demandes = (await r.json()).map((x) => documentRest(x.document)).filter(Boolean);
  const liste = demandesASignaler(demandes);
  if (!liste.length) return new Response(test ? "test envoyé" : "rien de nouveau");

  const notifs = parNotif ? await notifier(entetes, liste.map(messageNotification)) : 0;
  const mail = parEmail ? await envoyerEmail(liste, email) : false;
  if (!mail && !notifs) return new Response("aucun envoi réussi");
  const quand = new Date().toISOString();
  for (const d of liste) {
    await fetch(`${BASE}/demandes/${d.id}?updateMask.fieldPaths=alerteRebeccaLe`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ fields: { alerteRebeccaLe: { stringValue: quand } } }),
    });
  }
  return new Response(`${liste.length} demande(s) signalée(s) (e-mail : ${mail ? "oui" : "non"}, notifications : ${notifs})`);
}
