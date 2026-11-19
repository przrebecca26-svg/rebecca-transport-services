// NOTIFICATION IMMÉDIATE D'UN MESSAGE D'ASSISTANCE (19 nov. 2026) - Rebecca Services
// La page #/assistance appelle cette fonction juste après l'envoi d'un message du client : notification
// sur le téléphone de Rebecca (🔴 si urgent). Sécurité : seulement pour une conversation qui existe, dont le
// dernier message vient du client, il y a moins de 3 minutes, et pas encore signalé. Aucune donnée renvoyée.
// Pendant Chabbat et les fêtes : aucune notification (Rebecca voit la pastille à la réouverture). Règles v31.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { fermetureEnCours, messageNotifAssistance } from "../../src/pricing/assistance.js";
import { envoyerNotification } from "../outils/webPush.mjs";

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const ID_OK = /^[A-Za-z0-9]{15,40}$/;
const reponse = (texte, statut = 200) => new Response(texte, { status: statut, headers: { "Content-Type": "text/plain; charset=utf-8" } });

async function connecterRobot() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_MDP, returnSecureToken: true }),
  });
  if (!r.ok) return null;
  return { Authorization: `Bearer ${(await r.json()).idToken}`, "Content-Type": "application/json" };
}
const lire = async (entetes, chemin) => {
  const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
  return r.ok ? documentRest(await r.json()) : null;
};

export default async function assistance(req) {
  if (req.method !== "POST") return reponse("POST seulement", 405);
  let corps = {};
  try {
    corps = await req.json();
  } catch {
    return reponse("demande illisible", 400);
  }
  const id = String(corps.id || "");
  if (!ID_OK.test(id)) return reponse("demande illisible", 400);
  if (fermetureEnCours()) return reponse("fermé (Chabbat ou fête) : pas de notification");
  const vapid = process.env.VAPID_PRIVEE || (globalThis.Netlify && Netlify.env && Netlify.env.get("VAPID_PRIVEE"));
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !vapid) return reponse("non configuré");
  const entetes = await connecterRobot();
  if (!entetes) return reponse("connexion du robot refusée");

  const c = await lire(entetes, `assistance/${id}`);
  const majLe = c ? Date.parse(c.majLe || "") : NaN;
  if (!c || c.dernierDe !== "client" || c.statut === "resolue" || !Number.isFinite(majLe) || Date.now() - majLe > 3 * 60000) return reponse("rien à signaler");
  if (c.notifieLe && Date.parse(c.notifieLe) >= majLe) return reponse("déjà signalé");
  const reglage = (await lire(entetes, "reglages/alerteDemandes")) || {};
  if (reglage.notifications !== true) return reponse("notifications désactivées");

  const note = await fetch(`${BASE}/assistance/${id}?updateMask.fieldPaths=notifieLe&currentDocument.exists=true`, {
    method: "PATCH",
    headers: entetes,
    body: JSON.stringify({ fields: { notifieLe: { stringValue: new Date().toISOString() } } }),
  });
  if (!note.ok) return reponse(`note refusée (${note.status}) : règles v31 ?`);

  const message = messageNotifAssistance({ ...c, id });
  const r = await fetch(`${BASE}/notificationsPush?pageSize=20`, { headers: entetes });
  const abonnes = r.ok ? ((await r.json()).documents || []).map(documentRest).filter((a) => a && a.endpoint && a.p256dh && a.auth) : [];
  let envoyes = 0;
  for (const a of abonnes) {
    try {
      const res = await envoyerNotification(a, message, vapid);
      if (res.ok) envoyes++;
      if (res.expire) await fetch(`${BASE}/notificationsPush/${a.id}`, { method: "DELETE", headers: entetes });
    } catch {
      /* téléphone suivant */
    }
  }
  return reponse(`${envoyes} notification(s)`);
}
