// NOTIFICATION IMMÉDIATE D'UNE COMMANDE RESTAURANT (V2, 19 nov. 2026) - Rebecca Services
// Le robot programmé passe toutes les 5 minutes : trop tard, puisqu'une commande sans réponse est refusée
// au bout de 5 minutes. La page du restaurant appelle donc cette fonction juste après l'envoi :
// la notification part tout de suite sur le téléphone de Rebecca (icône « Rebecca admin »).
// Sécurité : la fonction ne fait que prévenir Rebecca d'une commande qui existe vraiment, toute récente,
// encore en attente et jamais signalée (une seule notification par commande). Elle ne renvoie aucune donnée.
// Mêmes variables Netlify que le robot : ROBOT_EMAIL, ROBOT_MDP, VAPID_PRIVEE. Règles Firebase v29.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { messageNotifResto } from "../../src/pricing/restos.js";
import { envoyerNotification } from "../outils/webPush.mjs";

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const ID_OK = /^[A-Za-z0-9]{10,40}$/;
const CLE_OK = /^[A-Za-z0-9]{20,40}$/;
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

export default async function commandeResto(req) {
  if (req.method !== "POST") return reponse("POST seulement", 405);
  let corps = {};
  try {
    corps = await req.json();
  } catch {
    return reponse("demande illisible", 400);
  }
  const cle = String(corps.cle || "");
  const id = String(corps.id || "");
  if (!CLE_OK.test(cle) || !ID_OK.test(id)) return reponse("demande illisible", 400);
  const vapid = process.env.VAPID_PRIVEE || (globalThis.Netlify && Netlify.env && Netlify.env.get("VAPID_PRIVEE"));
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !vapid) return reponse("non configuré");
  const entetes = await connecterRobot();
  if (!entetes) return reponse("connexion du robot refusée");

  const c = await lire(entetes, `restos/${cle}/commandesResto/${id}`);
  const creeLe = c ? Date.parse(c.creeLe || "") : NaN;
  if (!c || c.statut !== "nouvelle" || c.notifieLe || !Number.isFinite(creeLe) || Date.now() - creeLe > 3 * 60000) return reponse("rien à signaler");
  const reglage = (await lire(entetes, "reglages/alerteDemandes")) || {};
  if (reglage.notifications !== true) return reponse("notifications désactivées");

  // On note d'abord : jamais deux notifications pour la même commande, même si la page rappelle la fonction
  const note = await fetch(`${BASE}/restos/${cle}/commandesResto/${id}?updateMask.fieldPaths=notifieLe&currentDocument.exists=true`, {
    method: "PATCH",
    headers: entetes,
    body: JSON.stringify({ fields: { notifieLe: { stringValue: new Date().toISOString() } } }),
  });
  if (!note.ok) return reponse(`note refusée (${note.status}) : règles v29 ?`);

  const resto = (await lire(entetes, `restos/${cle}`)) || {};
  const message = messageNotifResto(resto, { ...c, id });
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
