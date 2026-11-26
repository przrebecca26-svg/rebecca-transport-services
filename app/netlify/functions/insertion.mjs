// UNE NOUVELLE COURSE PEUT-ELLE S'INSERER DANS MA JOURNEE ? (26 nov. 2026, étape 2) - Rebecca Services
// Appelée par le formulaire du site quand l'heure demandée tombe dans un moment déjà pris par Rebecca (sa tournée,
// ses tâches, ses courses), et par l'espace privé (Demandes) pour le détail.
//  - Site (sans connexion) : le robot lit la journée ; la réponse ne contient QUE « possible » ou « pas possible »
//    (+ la prochaine heure faisable). Jamais une adresse, un nom ou une heure de rendez-vous de Rebecca.
//  - Espace privé (jeton de Rebecca) : la journée est lue avec SES droits (règles v36 inchangées) et la réponse donne
//    le détail : « s'insère après …, +X min de détour, +Y ₪, ordre conseillé ».
// Temps de route : service gratuit OSRM (un seul appel pour toute la journée), puis les heures de pointe des Réglages ;
// s'il ne répond pas : estimation (vol d'oiseau +30 %). Aucune IA, aucun service payant.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { TARIFS } from "../../src/pricing/config.js";
import { appliquerTarifs, lireTarifs } from "../../src/pricing/catalogue.js";
import { cleLieu } from "../../src/pricing/tournee.js";
import { blocsDuJour, fabriquerDuree, requeteDepuisDemande, requeteValide, resumeAdmin, verifierInsertion } from "../../src/pricing/insertion.js";

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const ID_OK = /^[A-Za-z0-9_-]{6,60}$/;
const env = (k) => process.env[k] || (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || "";
const json = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function connecterRobot() {
  if (!env("ROBOT_EMAIL") || !env("ROBOT_MDP")) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env("ROBOT_EMAIL"), password: env("ROBOT_MDP"), returnSecureToken: true }),
  });
  if (!r.ok) return null;
  return { Authorization: `Bearer ${(await r.json()).idToken}`, "Content-Type": "application/json" };
}
const lireDoc = async (entetes, chemin) => {
  const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
  return r.ok ? documentRest(await r.json()) : null;
};
const lireJson = async (entetes, chemin) => String(((await lireDoc(entetes, chemin)) || {}).json || "");
async function requete(entetes, champ, valeur) {
  const structuredQuery = { from: [{ collectionId: "demandes" }], where: { fieldFilter: { field: { fieldPath: champ }, op: "EQUAL", value: { stringValue: valeur } } } };
  const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: entetes, body: JSON.stringify({ structuredQuery }) });
  if (!r.ok) return [];
  return (await r.json()).map((x) => documentRest(x.document)).filter(Boolean);
}

// Temps de route entre tous les lieux de la journée, en un seul appel (4 s maximum)
async function tableOsrm(lieux) {
  const uniques = [...new Map(lieux.filter((a) => a && Number.isFinite(a.lat) && Number.isFinite(a.lon)).map((a) => [cleLieu(a), a])).values()].slice(0, 80);
  if (uniques.length < 2) return {};
  try {
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${uniques.map((p) => `${p.lon},${p.lat}`).join(";")}?annotations=duration`, { signal: ctrl.signal });
    clearTimeout(minuteur);
    if (!r.ok) return {};
    const d = await r.json();
    const table = {};
    (d.durations || []).forEach((ligne, i) => ligne.forEach((s, j) => {
      if (typeof s === "number" && i !== j) table[`${cleLieu(uniques[i])}>${cleLieu(uniques[j])}`] = Math.max(1, Math.round((s / 60) * 1.15));
    }));
    return table;
  } catch {
    return {};
  }
}

export default async function insertion(req) {
  if (req.method !== "POST") return json({ erreur: "POST seulement" }, 405);
  let corps = {};
  try {
    corps = await req.json();
  } catch {
    return json({ erreur: "demande illisible" }, 400);
  }

  // Rebecca (espace privé) : son jeton ouvre sa tournée privée ; sinon, le robot (réponse sans détail)
  const auth = String(req.headers.get("authorization") || "");
  let entetes = null;
  let admin = false;
  if (/^Bearer [A-Za-z0-9._-]{100,4000}$/.test(auth)) {
    const e = { Authorization: auth, "Content-Type": "application/json" };
    const r = await fetch(`${BASE}/admin/tournee`, { headers: e });
    if (r.ok || r.status === 404) {
      entetes = e;
      admin = true;
    }
  }
  if (!entetes) entetes = await connecterRobot();
  if (!entetes) return json({ possible: null, erreur: "non configuré" });

  // La demande à étudier
  let demande = null;
  let r = null;
  if (corps.demandeId) {
    if (!admin) return json({ erreur: "réservé à l'espace privé" }, 403);
    if (!ID_OK.test(String(corps.demandeId))) return json({ erreur: "demande illisible" }, 400);
    demande = await lireDoc(entetes, `demandes/${corps.demandeId}`);
    r = demande ? requeteDepuisDemande({ ...demande, id: corps.demandeId }) : null;
    // Étape 3 : « et si j'y vais à l'heure conseillée par le vol ? » (heure ou heure du retour remplacée)
    const H = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (r && H.test(String(corps.heure || ""))) r.heure = corps.heure;
    if (r && r.allerRetour && H.test(String(corps.heureRetour || ""))) r.heureRetour = corps.heureRetour;
  } else r = requeteValide(corps);
  if (!r) return json({ possible: null, erreur: "service ou adresses non pris en charge" });

  // Réglages publics (marge, heures de pointe) puis la journée (et celle du retour)
  const t = TARIFS;
  appliquerTarifs(lireTarifs(await lireJson(entetes, "reglages/tarifs")), t);
  const dates = [...new Set([r.date, r.allerRetour && r.heureRetour ? r.dateRetour || r.date : r.date])];
  const [tourneeJson, joursJson, repertoireJson, ...listes] = await Promise.all([
    lireJson(entetes, "admin/tournee"),
    lireJson(entetes, "admin/tourneeJours"),
    lireJson(entetes, "clientsAdmin/_repertoire"),
    ...dates.flatMap((d) => [requete(entetes, "date", d), requete(entetes, "details.dateRetour", d)]),
  ]);
  const demandes = [...new Map(listes.flat().map((d) => [d.id, d])).values()];
  const donnees = { demandes, tourneeJson, joursJson, repertoireJson };
  const sauf = corps.demandeId ? String(corps.demandeId) : "";

  // Une première passe (estimations) donne les lieux ; puis les vrais temps de route
  const brouillon = Object.fromEntries(dates.map((d) => [d, blocsDuJour(d, donnees, { t, sauf })]));
  const lieux = [r.depart, r.arrivee, ...Object.values(brouillon).flatMap((j) => [j.domicile, ...j.blocs.flatMap((b) => [b.de, b.a])])];
  const table = await tableOsrm(lieux);
  const journees = Object.keys(table).length ? Object.fromEntries(dates.map((d) => [d, blocsDuJour(d, donnees, { t, sauf, table })])) : brouillon;
  const resultat = verifierInsertion(r, journees, { t, duree: (date) => fabriquerDuree({ date, t, table }) });

  if (!admin) return json({ possible: resultat.possible, proposition: resultat.proposition || null });
  const prix = demande ? [demande.prixFinal, demande.prixEstime].find((x) => typeof x === "number") : null;
  return json({ ...resumeAdmin(resultat, journees, { prix, coutKm: (t.rentabilite && t.rentabilite.coutKmReel) || 1.2 }), routes: Object.keys(table).length ? "osrm" : "estimation", marge: resultat.marge });
}
