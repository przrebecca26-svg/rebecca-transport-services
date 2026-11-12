// MA TOURNEE SCOLAIRE - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// 12 nov. 2026, demande de Rebecca : noter ses trajets fixes d'ecole (sa fille, les enfants qu'elle emmene deja),
// et savoir, quand une cliente demande un devis, si les nouveaux trajets RENTRENT dans sa tournee.
// - un trajet fixe = prendre des enfants a un endroit et les deposer a un autre, certains jours, a une heure ;
//   « matin » : arriver a l'ecole au plus tard a une heure (et, si besoin, prendre les enfants a partir d'une heure) ;
//   « sortie » : recuperer les enfants a l'heure de sortie ;
// - l'appli cherche le meilleur ordre des arrets : plusieurs enfants peuvent etre dans la voiture en meme temps ;
// - temps comptes (Reglages -> Tarifs) : temps de route reel + marge de route a chaque deplacement + temps d'arret
//   pour faire monter ou descendre les enfants ; retard maximum accepte a une sortie d'ecole ; places dans la voiture ;
// - reponse par jour : possible, serre (un peu de retard a une sortie) ou impossible (avec l'arret qui coince).
// Rien n'est bloque : c'est Rebecca qui decide. Les noms et adresses des enfants ne sont JAMAIS ecrits dans le
// programme (le code est public) : ils sont enregistres dans la base privee de Rebecca (document admin/tournee).

import { TARIFS } from "./config.js";
import { ajouterJours } from "./calendrier.js";
import { JOURS, finDuMois, nomEnfant, ecoleDe, heureDuJour } from "./ramassagePlanning.js";

export { JOURS };
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const FENETRE_MATIN = 45; // matin sans heure de prise : on ne part pas plus de 45 min avant l'heure d'arrivee
const ECART_GROUPE = 60; // deux trajets a plus d'une heure d'ecart ne sont jamais faits ensemble
const MAX_ESSAIS = 300000;

export const enMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const enHeure = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
};
const adresseOk = (a) => !!(a && typeof a === "object" && String(a.label || "").trim() && typeof a.lat === "number" && typeof a.lon === "number");
export const cleLieu = (a) => (adresseOk(a) ? `${a.lat.toFixed(5)},${a.lon.toFixed(5)}` : "");
const lieuCourt = (a) => String((a && a.label) || "").split(",")[0];
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

/* ---------- Un trajet de la tournee ---------- */

let compteur = 0;
export const nouvelId = () => `t${Date.now().toString(36)}${(compteur++).toString(36)}`;

export const trajetVide = (plus = {}) => ({
  id: nouvelId(),
  nom: "",
  type: "sortie", // "matin" (deposer a l'ecole) ou "sortie" (recuperer)
  places: 1, // nombre d'enfants dans la voiture pour ce trajet
  de: null, // ou je prends les enfants
  a: null, // ou je les depose
  heure: "", // matin : arriver au plus tard ; sortie : heure de sortie
  heurePrise: "", // matin seulement : prendre les enfants a partir de (facultatif)
  peutAttendre: false, // sortie seulement : l'enfant m'attend sans limite (pas de retard maximum)
  jours: JOURS.map((_, w) => ({ actif: w < 5, heure: "" })), // dimanche a jeudi par defaut
  du: "", // facultatif : trajet valable seulement entre deux dates (forfait d'une cliente)
  au: "",
  client: false,
  ...plus,
});

// Tournee de depart de Rebecca (12 nov. 2026) : les heures qu'elle a donnees ; noms et adresses a completer par elle.
export const tourneeDepart = () => [
  trajetVide({ id: "depart1", nom: "Ma fille (matin)", type: "matin", places: 1, heure: "08:00" }),
  trajetVide({ id: "depart2", nom: "Les 2 filles de mon amie (matin)", type: "matin", places: 2, heurePrise: "08:15", heure: "08:30" }),
  trajetVide({ id: "depart3", nom: "Les 2 filles de mon amie (sortie du Gan)", type: "sortie", places: 2, heure: "14:00" }),
  trajetVide({ id: "depart4", nom: "Ma fille (elle m'attend chez mon amie)", type: "sortie", places: 1, heure: "13:45", peutAttendre: true }),
];

export const heureTrajet = (r, w) => (r.jours[w] && r.jours[w].heure) || r.heure || "";

// Ce qui manque a un trajet pour entrer dans les calculs ("" = complet)
export function manqueTrajet(r) {
  if (!adresseOk(r.de)) return "adresse de prise à choisir dans la liste";
  if (!adresseOk(r.a)) return "adresse de dépose à choisir dans la liste";
  if (!r.jours.some((j) => j.actif)) return "aucun jour coché";
  for (let w = 0; w < JOURS.length; w++) {
    if (!r.jours[w].actif) continue;
    const h = heureTrajet(r, w);
    if (r.type === "sortie" && !HEURE_OK.test(h)) return `heure de sortie du ${JOURS[w].toLowerCase()} manquante`;
    if (r.type === "matin" && !HEURE_OK.test(h) && !HEURE_OK.test(r.heurePrise || "")) return "heure du matin manquante";
  }
  return "";
}

// Nettoie ce qui vient de la base (document admin/tournee, champ json) :
// { trajets: [...], forfaits: [{ id, nom, plan, routes, creeLe }], vacances: [{ nom, du, au }] }
const heureOk = (x) => (HEURE_OK.test(x || "") ? x : "");
const dateOk = (x) => (DATE_OK.test(x || "") ? x : "");
const adresseLue = (x) => (x && typeof x === "object" && typeof x.label === "string" ? { label: x.label.slice(0, 200), ...(typeof x.lat === "number" && typeof x.lon === "number" ? { lat: x.lat, lon: x.lon } : {}) } : null);

export function lireTrajets(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((r) => r && typeof r === "object")
    .slice(0, 40)
    .map((r) => ({
      id: String(r.id || nouvelId()).slice(0, 40),
      nom: String(r.nom || "").slice(0, 60),
      type: r.type === "matin" ? "matin" : "sortie",
      places: Math.min(8, Math.max(1, Math.round(Number(r.places)) || 1)),
      de: adresseLue(r.de),
      a: adresseLue(r.a),
      heure: heureOk(r.heure),
      heurePrise: heureOk(r.heurePrise),
      peutAttendre: r.peutAttendre === true,
      jours: JOURS.map((_, w) => ({ actif: !!(r.jours && r.jours[w] && r.jours[w].actif), heure: heureOk(r.jours && r.jours[w] && r.jours[w].heure) })),
      du: dateOk(r.du),
      au: dateOk(r.au),
      client: r.client === true,
    }));
}

export function lireTournee(json) {
  let o;
  try {
    o = JSON.parse(json || "{}");
  } catch {
    o = {};
  }
  if (Array.isArray(o)) o = { trajets: o };
  if (!o || typeof o !== "object") o = {};
  const forfaits = (Array.isArray(o.forfaits) ? o.forfaits : [])
    .filter((f) => f && typeof f === "object" && f.plan && Array.isArray(f.plan.enfants) && f.routes && typeof f.routes === "object")
    .slice(0, 30)
    .map((f) => ({ id: String(f.id || nouvelId()).slice(0, 40), nom: String(f.nom || "").slice(0, 60), plan: f.plan, routes: f.routes, creeLe: dateOk(f.creeLe) }));
  const vacances = (Array.isArray(o.vacances) ? o.vacances : [])
    .filter((v) => v && dateOk(v.du))
    .slice(0, 40)
    .map((v) => ({ nom: String(v.nom || "").slice(0, 40), du: v.du, au: dateOk(v.au) && v.au >= v.du ? v.au : v.du }));
  return { trajets: lireTrajets(o.trajets), forfaits, vacances, existe: Array.isArray(o.trajets) };
}

// Le trajet compte-t-il ce jour de semaine, sur la periode [du ; au] regardee ? (dates vides = toujours)
export function trajetActif(r, w, du = "", au = "") {
  if (!r.jours[w] || !r.jours[w].actif) return false;
  if (r.au && du && r.au < du) return false;
  if (r.du && au && r.du > au) return false;
  return true;
}

/* ---------- Devis -> trajets (un par enfant et par sens) ---------- */

export function periodeDuPlan(plan) {
  if (!DATE_OK.test(plan.date || "")) return { du: "", au: "" };
  if (plan.periode === "jour") return { du: plan.date, au: plan.date };
  return { du: plan.date, au: plan.periode === "mois" ? finDuMois(plan.date) : ajouterJours(plan.date, 6) };
}

export function trajetsDuDevis(plan) {
  const { du, au } = periodeDuPlan(plan);
  const jourUnique = plan.periode === "jour" && du ? jourSemaine(du) : null;
  const liste = [];
  plan.enfants.forEach((e, i) => {
    const ecole = ecoleDe(plan, i);
    const jours = JOURS.map((_, w) => ({ actif: jourUnique === null ? !!e.jours[w].actif : w === jourUnique, heure: "" }));
    const nom = nomEnfant(e, i);
    if (e.sens !== "sortie") {
      liste.push(trajetVide({ id: `devis-m${i}`, nom: `${nom} (matin)`, type: "matin", de: plan.domicile, a: ecole, heure: "", heurePrise: e.heureMatin || "", jours, du, au, client: true }));
    }
    if (e.sens !== "matin") {
      liste.push(trajetVide({ id: `devis-s${i}`, nom: `${nom} (sortie)`, type: "sortie", de: ecole, a: plan.domicile, heure: e.heureSortie || "", jours: jours.map((j, w) => ({ ...j, heure: j.actif ? heureDuJour(e, w) : "" })), du, au, client: true }));
    }
  });
  return liste;
}

/* ---------- Les lieux et les temps de route ---------- */

// Lieux differents de tous les trajets complets (pour demander les temps de route en une seule fois)
export function lieuxDesTrajets(trajets) {
  const vus = new Map();
  for (const r of trajets) {
    if (manqueTrajet(r)) continue;
    for (const a of [r.de, r.a]) if (!vus.has(cleLieu(a))) vus.set(cleLieu(a), a);
  }
  return [...vus.values()];
}

// Table des durees { "cleA>cleB": minutes } a partir de la matrice renvoyee par le calcul d'itineraire
export function tableDurees(lieux, matrice) {
  const table = {};
  lieux.forEach((a, i) => lieux.forEach((b, j) => {
    if (i !== j && matrice && matrice[i] && typeof matrice[i][j] === "number") table[`${cleLieu(a)}>${cleLieu(b)}`] = matrice[i][j];
  }));
  return table;
}

/* ---------- Le calcul d'une journee ---------- */

// Arrets d'un trajet pour un jour de semaine : la prise puis la depose
function arretsDuTrajet(r, w) {
  const h = heureTrajet(r, w);
  if (r.type === "matin") {
    const limite = HEURE_OK.test(h) ? enMin(h) : null;
    const reelle = HEURE_OK.test(r.heurePrise || "");
    const tot = reelle ? enMin(r.heurePrise) : limite - FENETRE_MATIN;
    return [
      { trajet: r, sorte: "prise", lieu: r.de, tot, souple: !reelle, retardMax: Infinity, limite: null },
      { trajet: r, sorte: "depose", lieu: r.a, tot: null, retardMax: Infinity, limite },
    ];
  }
  return [
    { trajet: r, sorte: "prise", lieu: r.de, tot: enMin(h), souple: false, sortie: true, retardMax: r.peutAttendre ? Infinity : null, limite: null },
    { trajet: r, sorte: "depose", lieu: r.a, tot: null, retardMax: Infinity, limite: null },
  ];
}

// Deroule un ordre d'arrets et renvoie les heures, les retards et ce qui coince
function derouler(ordre, duree, regles, tots = null) {
  let t = 0;
  let violation = 0;
  let retard = 0;
  let conduite = 0;
  const lignes = [];
  let avant = null;
  let surPlace = 0; // heure d'arrivee a l'endroit ou je suis (plusieurs enfants au meme endroit = un seul arret)
  for (let k = 0; k < ordre.length; k++) {
    const s = ordre[k];
    const cle = cleLieu(s.lieu);
    const memeLieu = avant === cle;
    const route = k === 0 || memeLieu ? 0 : duree(avant, cle);
    if (route == null) return null;
    conduite += route;
    const arrivee = k === 0 ? (tots && tots.has(s) ? tots.get(s) : s.tot != null ? s.tot : 0) : memeLieu ? surPlace : t + route + regles.margeRouteMinutes;
    if (!memeLieu) surPlace = arrivee;
    const tot = tots && tots.has(s) ? tots.get(s) : s.tot;
    const debut = s.sorte === "prise" && tot != null ? Math.max(arrivee, tot) : arrivee;
    const ligne = { ...s, arrivee, debut, route, retard: 0, depassement: 0 };
    if (s.sorte === "prise" && s.sortie) {
      ligne.retard = Math.max(0, debut - s.tot);
      const max = s.retardMax === null ? regles.retardMaxMinutes : s.retardMax;
      ligne.depassement = Math.max(0, ligne.retard - max);
      if (max !== Infinity) retard += ligne.retard;
    }
    if (s.sorte === "depose" && s.limite != null) ligne.depassement = Math.max(0, arrivee - s.limite);
    violation += ligne.depassement;
    t = memeLieu ? Math.max(t, debut + regles.arretMinutes) : debut + regles.arretMinutes;
    ligne.depart = t;
    lignes.push(ligne);
    avant = cle;
  }
  return { lignes, violation, retard, conduite, fin: t };
}

// Le meilleur ordre : d'abord rien qui coince, puis le moins de retard, puis le moins de route, puis fini le plus tot
const note = (r) => [r.violation, r.retard, r.conduite, r.fin];
const meilleur = (a, b) => {
  if (!b) return true;
  const [x, y] = [note(a), note(b)];
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k];
  return false;
};

// Meilleur ordre des arrets d'un groupe de trajets (tous les ordres possibles, la prise toujours avant la depose,
// jamais plus d'enfants que de places)
function meilleurOrdre(trajets, w, duree, regles) {
  const paires = trajets.map((r) => arretsDuTrajet(r, w));
  let best = null;
  let essais = 0;
  const ordre = [];
  const etat = paires.map(() => 0); // 0 = pas pris, 1 = dans la voiture, 2 = depose
  const explorer = (charge) => {
    if (essais > MAX_ESSAIS) return;
    if (ordre.length === paires.length * 2) {
      essais++;
      const r = derouler(ordre, duree, regles);
      if (r && meilleur(r, best)) best = { ...r, ordre: [...ordre] };
      return;
    }
    if (best && ordre.length > 1) {
      const partiel = derouler(ordre, duree, regles);
      if (!partiel) return;
      if (partiel.violation > best.violation || (partiel.violation === best.violation && partiel.retard > best.retard)) return;
    }
    for (let i = 0; i < paires.length; i++) {
      if (etat[i] === 2) continue;
      const s = paires[i][etat[i]];
      const places = paires[i][0].trajet.places;
      if (etat[i] === 0 && charge + places > regles.places) continue;
      ordre.push(s);
      etat[i]++;
      explorer(etat[i] === 1 ? charge + places : charge - places);
      etat[i]--;
      ordre.pop();
    }
  };
  explorer(0);
  if (!best) return null;
  // Depart « au plus tard » pour les prises du matin sans heure : inutile de partir 45 minutes avant
  const tots = new Map();
  for (const s of [...best.ordre].reverse()) {
    if (s.sorte !== "prise" || !s.souple) continue;
    let bon = s.tot;
    for (let essai = s.tot + 1; essai <= s.tot + FENETRE_MATIN; essai++) {
      tots.set(s, essai);
      const r = derouler(best.ordre, duree, regles, tots);
      if (!r || r.violation > best.violation || r.retard > best.retard) break;
      bon = essai;
    }
    tots.set(s, bon);
  }
  const fin = derouler(best.ordre, duree, regles, tots);
  return fin ? { ...fin, complet: essais <= MAX_ESSAIS } : best;
}

// Une journee : trajets actifs ce jour de semaine, regroupes par moment (matin, midi, sortie...), ordre calcule.
// duree(cleA, cleB) = minutes de route, ou null si inconnue. Renvoie :
// { statut: "vide" | "possible" | "serre" | "impossible" | "inconnu", arrets: [...], probleme, retard, incomplets }
export function evaluerJour(trajets, w, duree, t = TARIFS, periode = {}) {
  const regles = t.tournee;
  const actifs = trajets.filter((r) => trajetActif(r, w, periode.du, periode.au));
  const incomplets = actifs.filter((r) => manqueTrajet(r));
  const bons = actifs.filter((r) => !manqueTrajet(r));
  if (bons.length === 0) return { statut: "vide", arrets: [], probleme: "", retard: 0, incomplets };
  const trop = bons.find((r) => r.places > regles.places);
  if (trop) return { statut: "impossible", arrets: [], probleme: `${trop.nom || "Un trajet"} : ${trop.places} enfants pour ${regles.places} places dans la voiture.`, retard: 0, incomplets };

  // Groupes : trajets proches dans le temps (heure de reference = prise, ou arrivee pour le matin)
  const ref = (r) => {
    const [prise, depose] = arretsDuTrajet(r, w);
    return depose.limite != null ? depose.limite : prise.tot;
  };
  const tries = [...bons].sort((a, b) => ref(a) - ref(b));
  const groupes = [];
  for (const r of tries) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && ref(r) - ref(dernier[dernier.length - 1]) <= ECART_GROUPE) dernier.push(r);
    else groupes.push([r]);
  }

  const arrets = [];
  let violation = 0;
  let retard = 0;
  for (const g of groupes) {
    const r = meilleurOrdre(g, w, duree, regles);
    if (!r) return { statut: "inconnu", arrets: [], probleme: "Temps de route pas encore calculés.", retard: 0, incomplets };
    if (arrets.length) arrets.push({ pause: true });
    arrets.push(...r.lignes);
    violation += r.violation;
    retard += r.retard;
  }
  // Deux groupes qui se suivent : a-t-on le temps d'aller de la fin du premier au debut du second ?
  const vrais = arrets.filter((x) => !x.pause);
  for (let k = 1; k < vrais.length; k++) {
    const a = vrais[k - 1];
    const b = vrais[k];
    if (arrets[arrets.indexOf(b) - 1] && arrets[arrets.indexOf(b) - 1].pause) {
      const route = cleLieu(a.lieu) === cleLieu(b.lieu) ? 0 : duree(cleLieu(a.lieu), cleLieu(b.lieu));
      if (route != null && a.depart + route + regles.margeRouteMinutes > b.debut) {
        const manque = Math.round(a.depart + route + regles.margeRouteMinutes - b.debut);
        b.depassement = Math.max(b.depassement, manque);
        violation += manque;
      }
    }
  }

  const pire = vrais.filter((x) => x.depassement > 0).sort((a, b) => b.depassement - a.depassement)[0];
  let probleme = "";
  if (pire) {
    const nom = pire.trajet.nom || "un trajet";
    probleme = pire.sorte === "depose"
      ? `${nom} : arrivée à ${enHeure(pire.arrivee)} à ${lieuCourt(pire.lieu)}, au lieu de ${enHeure(pire.limite)} au plus tard.`
      : pire.sortie && pire.retard > 0
        ? `${nom} : j'arrive à ${enHeure(pire.debut)} à ${lieuCourt(pire.lieu)}, ${Math.round(pire.retard)} min après la sortie (${regles.retardMaxMinutes} min au maximum).`
        : `${nom} : il manque ${Math.round(pire.depassement)} min pour arriver à ${lieuCourt(pire.lieu)} à ${enHeure(pire.debut)}.`;
  }
  return { statut: violation > 0 ? "impossible" : retard > 0 ? "serre" : "possible", arrets, probleme, retard: Math.round(retard), incomplets };
}

// Texte d'un arret pour l'affichage : « 14h00  Récupérer Noa (sortie) — Gan »
export function texteArret(x) {
  const nom = x.trajet.nom || "trajet";
  const retard = x.sorte === "prise" && x.sortie && x.retard > 0 ? ` (${Math.round(x.retard)} min après la sortie)` : "";
  return { heure: enHeure(x.sorte === "prise" ? x.debut : x.arrivee), texte: `${x.sorte === "prise" ? "Prendre" : "Déposer"} ${nom}`, lieu: lieuCourt(x.lieu), retard };
}

// Reponse pour un devis : chaque jour de semaine concerne, tournee fixe + trajets de la cliente
export function evaluerDevis(tournee, plan, duree, t = TARIFS) {
  const periode = periodeDuPlan(plan);
  const nouveaux = trajetsDuDevis(plan);
  const jours = [];
  for (let w = 0; w < JOURS.length; w++) {
    if (!nouveaux.some((r) => r.jours[w].actif)) continue;
    jours.push({ w, jour: JOURS[w], ...evaluerJour([...tournee, ...nouveaux], w, duree, t, periode) });
  }
  const ordre = ["impossible", "inconnu", "serre", "possible", "vide"];
  const statut = jours.length ? ordre.find((s) => jours.some((j) => j.statut === s)) : "vide";
  return { statut, jours, nouveaux };
}

// La cliente accepte : ses trajets s'ajoutent a la tournee (avec leurs dates), sans doublon si on clique deux fois.
// Forfait au mois : il est aussi garde (devis + distances) pour comparer chaque mois le prix reel au prix complet.
export function ajouterALaTournee(doc, plan, routes, nomCliente, aujourdhui = "") {
  const nom = String(nomCliente || "").trim().slice(0, 60);
  const nouveaux = trajetsDuDevis(plan).map((r) => ({ ...r, id: nouvelId(), nom: nom ? `${r.nom} - ${nom}` : r.nom }));
  const signature = (r) => [r.nom, r.type, cleLieu(r.de), cleLieu(r.a), r.du, r.au, r.jours.map((j, w) => (j.actif ? heureTrajet(r, w) || r.heurePrise : "-")).join("|")].join("#");
  const deja = new Set(doc.trajets.map(signature));
  const ajoutes = nouveaux.filter((r) => !deja.has(signature(r)));
  const forfaits = [...doc.forfaits];
  if (plan.periode === "mois" && ajoutes.length) forfaits.push({ id: nouvelId(), nom: nom || "Cliente", plan, routes, creeLe: aujourdhui });
  return { ...doc, trajets: [...doc.trajets, ...ajoutes], forfaits };
}
