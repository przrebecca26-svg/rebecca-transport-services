// NOTIFICATION IMMÉDIATE D'UN NOUVEAU RESTAURANT PARTENAIRE (19 nov. 2026) - Rebecca Services
// La page #/restaurant-partenaire appelle cette fonction juste après la signature : notification tout de suite
// sur le téléphone de Rebecca. Sécurité : seulement pour un contrat qui existe vraiment, signé il y a moins de
// 10 minutes et jamais signalé (une seule notification). Elle ne renvoie aucune donnée. Règles Firebase v30.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { envoyerNotification } from "../outils/webPush.mjs";

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const ID_OK = /^[A-Za-z0-9]{10,40}$/;
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

export default async function contratResto(req) {
  if (req.method !== "POST") return reponse("POST seulement", 405);
  let corps = {};
  try {
    corps = await req.json();
  } catch {
    return reponse("demande illisible", 400);
  }
  const id = String(corps.id || "");
  if (!ID_OK.test(id)) return reponse("demande illisible", 400);
  const vapid = process.env.VAPID_PRIVEE || (globalThis.Netlify && Netlify.env && Netlify.env.get("VAPID_PRIVEE"));
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP || !vapid) return reponse("non configuré");
  const entetes = await connecterRobot();
  if (!entetes) return reponse("connexion du robot refusée");

  const c = await lire(entetes, `contratsRestos/${id}`);
  const signeLe = c ? Date.parse(c.signeLe || "") : NaN;
  if (!c || c.statut !== "signe" || c.notifieLe || !Number.isFinite(signeLe) || Date.now() - signeLe > 10 * 60000) return reponse("rien à signaler");
  const reglage = (await lire(entetes, "reglages/alerteDemandes")) || {};
  if (reglage.notifications !== true) return reponse("notifications désactivées");

  const note = await fetch(`${BASE}/contratsRestos/${id}?updateMask.fieldPaths=notifieLe&currentDocument.exists=true`, {
    method: "PATCH",
    headers: entetes,
    body: JSON.stringify({ fields: { notifieLe: { stringValue: new Date().toISOString() } } }),
  });
  if (!note.ok) return reponse(`note refusée (${note.status}) : règles v30 ?`);

  const message = {
    titre: `🤝 Nouveau restaurant partenaire`,
    corps: `${String(c.nom || "Un restaurant").slice(0, 60)} a signé (formule ${c.formule === "B" ? "B" : "A"}). Il est dans ton Répertoire.`,
    tag: `contrat-${id}`,
    lien: "/admin#/admin?onglet=partenaires",
  };
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
