// INSERER UNE NOUVELLE COURSE DANS MA JOURNEE (26 nov. 2026, étape 2 du plan « insertion des courses »)
// Rebecca : « vu qu'on a descendu tous les prix, mon but c'est de cumuler le maximum de courses, trajets, transferts et
// livraisons : ça m'évite des allers-retours à vide et de perdre des clientes ».
// Règles pures (testées dans tests/insertion.test.mjs), utilisées par la fonction Netlify « insertion » :
//  1. Ma journée = des « blocs » fixes, dans l'ordre des heures : courses acceptées (de la prise en charge à la dépose),
//     tournée scolaire (chaque moment, de la maison au retour), tâches du Calendrier, étapes de mes trajets personnels,
//     rendez-vous beauté (à la maison). On ne coupe jamais un bloc en deux (une passagère reste seule dans la voiture).
//  2. La nouvelle demande est essayée dans chaque trou entre deux blocs, avec les temps de route selon l'heure.
//     Une livraison peut être récupérée dans un trou et livrée dans un trou suivant (le colis reste dans le coffre),
//     au plus tard 3 h après.
//  3. Acceptée si chaque rendez-vous déjà prévu reste tenu avec la marge (10 min par défaut, avant ET après) ;
//     un trou déjà serré avant ne doit pas devenir plus serré. Sinon : la prochaine heure faisable (par 5 min).
//  4. L'heure demandée = l'heure où Rebecca doit être là (prendre la personne, récupérer le colis) : jamais en retard.
//  Aucune IA : un calcul programmé, instantané et gratuit.
import { TARIFS } from "./config.js";
import { dureeSelonHeure } from "./circulation.js";
import { kmRoute, minutesSansTrafic } from "./deplacementsJour.js";
import { dureeCourse, extremites } from "./enchainement.js";
import { estAllerRetour } from "./finCourse.js";
import { attribueA, ADMIN_ID } from "./equipe.js";
import { lireFamilles, lireChoix, trajetsDesChoix } from "./familles.js";
import { famillesBrutes } from "./repertoire.js";
import { vacancesDuJour } from "./calendrier.js";
import { cleLieu, etapesPerso, journeeDeLaDate, lieuxDesTrajets, lireJours, lireTournee, tachesDuJour } from "./tournee.js";

export const MARGE_DEFAUT = 10; // minutes, avant ET après chaque rendez-vous (Rebecca : « 10 à 15 minutes »)
export const SUR_PLACE_NOUVEAU = 5; // prendre la personne / le colis, déposer
export const COLIS_MAX_MINUTES = 180; // un colis récupéré est livré au plus tard 3 h après
export const ROUTE_INCONNUE = 15; // minutes comptées quand une adresse de ma journée n'est pas connue
export const SERVICES_INSERABLES = ["transport", "aeroport", "livraison"];
const BEAUTE = ["nails", "hair", "slim", "regenx"];
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

export const enMin = (h) => (HEURE_OK.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
export const enHeure = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;
export const hFr = (m) => enHeure(m).replace(":", "h");
const ok = (a) => !!a && Number.isFinite(a.lat) && Number.isFinite(a.lon);
const nomCourt = (a) => (a && a.label ? String(a.label).split(",")[0].trim().slice(0, 40) : "");

// Marge réglable (Réglages → tarifs.insertion.marge), entre 5 et 30 min
export function margeDe(t = TARIFS) {
  const m = Number(t && t.insertion && t.insertion.marge);
  return Number.isFinite(m) && m >= 5 && m <= 30 ? Math.round(m) : MARGE_DEFAUT;
}

// Temps de route a -> b en partant à la minute « minute » : estimation (ou matrice OSRM si fournie), puis heures de pointe
export function fabriquerDuree({ date = "", t = TARIFS, table = null } = {}) {
  return (a, b, minute) => {
    if (!ok(a) && !ok(b)) return 0;
    if (!ok(a) || !ok(b)) return ROUTE_INCONNUE; // une adresse manque : on compte large
    const cle = `${cleLieu(a)}>${cleLieu(b)}`;
    const base = table && typeof table[cle] === "number" ? table[cle] : minutesSansTrafic(kmRoute(a, b));
    if (!base || !date || minute == null) return base;
    const r = dureeSelonHeure(base, date, enHeure(Math.max(0, Math.min(1439, minute))), t);
    return r ? r.minutes : base;
  };
}

/* ---------- 1. Les blocs de ma journée ---------- */

// Tournée scolaire : chaque « moment » (de la maison au retour) devient un bloc, avec le lieu du début et de la fin
export function blocsTournee(jour, domicile = null) {
  const blocs = [];
  let b = null;
  const fermer = () => {
    if (b && b.fin > b.debut) blocs.push(b);
    b = null;
  };
  for (const x of (jour && jour.arrets) || []) {
    if (x.pause) {
      if (x.bloque) continue;
      fermer();
      continue;
    }
    if (x.maison === "depart") {
      fermer();
      b = { debut: x.heure, fin: x.heure, de: domicile, a: domicile, texte: "🎒 Tournée scolaire", genre: "tournee" };
      continue;
    }
    if (x.maison === "retour") {
      if (b) {
        b.fin = Math.max(b.fin, x.heure);
        b.a = domicile;
      }
      fermer();
      continue;
    }
    if (!x.trajet) continue;
    const debut = x.partir != null ? x.partir : Math.min(x.arrivee, x.debut);
    const fin = Math.max(x.depart != null ? x.depart : x.debut, x.debut);
    if (!b) b = { debut, fin, de: x.lieu || null, a: x.lieu || null, texte: "🎒 Tournée scolaire", genre: "tournee" };
    else {
      b.fin = Math.max(b.fin, fin);
      b.a = x.lieu || b.a;
    }
  }
  fermer();
  return blocs;
}

// Toutes les étapes fixes de la journée de Rebecca. donnees = { demandes, tourneeJson, joursJson, repertoireJson }
// sauf = identifiant de la demande étudiée (elle ne se bloque pas elle-même)
export function blocsDuJour(date, { demandes = [], tourneeJson = "", joursJson = "", repertoireJson = "" } = {}, { t = TARIFS, table = null, sauf = "" } = {}) {
  if (!DATE_OK.test(date || "")) return { blocs: [], domicile: null };
  const route = fabriquerDuree({ date, t, table }); // avec les heures de pointe
  const base = fabriquerDuree({ t, table }); // temps normal (la tournée ajoute elle-même les heures de pointe)
  let tournee = { trajets: [], choix: [], transferts: [], domicile: null };
  try { tournee = lireTournee(tourneeJson || ""); } catch { /* tournée illisible : on continue sans */ }
  const domicile = ok(tournee.domicile) ? tournee.domicile : null;
  const blocs = [];

  // a. Courses et rendez-vous acceptés, faits par Rebecca (pas ceux de Jérémy)
  for (const d of demandes) {
    if (!d || d.statut !== "acceptee" || d.id === sauf || d.service === "ramassage" || attribueA(d) !== ADMIN_ID) continue;
    if (["epoxy", "digital"].includes(d.service)) continue;
    const v = d.details || {};
    let x = {};
    try { x = extremites(d) || {}; } catch { x = {}; }
    const beaute = BEAUTE.includes(d.service);
    const de = beaute ? domicile : x.debut || x.fin || null;
    const a = beaute ? domicile : x.fin || x.debut || null;
    let longueur = 45;
    try { longueur = dureeCourse(d).minutes; } catch { longueur = 45; }
    const titre = String(d.serviceTitre || d.service || "Course").slice(0, 30);
    const qui = String(d.nom || "").trim().split(" ")[0].slice(0, 20);
    if (d.date === date && enMin(d.heure) != null) {
      blocs.push({ debut: enMin(d.heure), fin: enMin(d.heure) + Math.max(10, longueur), de, a, texte: `${titre}${qui ? " · " + qui : ""}`, genre: "course", id: d.id });
    }
    if (estAllerRetour(d) && (v.dateRetour || d.date) === date && enMin(v.heureRetour) != null) {
      blocs.push({ debut: enMin(v.heureRetour), fin: enMin(v.heureRetour) + Math.max(10, longueur), de: a, a: de, texte: `Retour ${titre}${qui ? " · " + qui : ""}`, genre: "course", id: `${d.id}-retour` });
    }
  }

  // b. Tournée scolaire du jour (sauf vacances) et mes tâches du Calendrier
  const jours = lireJours(joursJson || "{}");
  if (!vacancesDuJour(date, t)) {
    let familles = [];
    try { familles = lireFamilles(famillesBrutes(repertoireJson || "") || []); } catch { familles = []; }
    const tous = [...trajetsDesChoix(familles, lireChoix(tournee.choix)), ...(tournee.trajets || [])];
    const ajouts = (jours[date] || {}).ajouts || [];
    const lieux = new Map(lieuxDesTrajets([...tous, ...ajouts], domicile).map((l) => [cleLieu(l), l]));
    const dureeCle = (ca, cb) => (ca === cb ? 0 : base(lieux.get(ca), lieux.get(cb)));
    try {
      const j = journeeDeLaDate(tous, date, tournee.transferts || [], dureeCle, domicile, t, jours);
      if (j && j.statut !== "inconnu") blocs.push(...blocsTournee(j, domicile));
    } catch { /* tournée incomplète : ses créneaux publics bloquent déjà le site */ }
  }
  for (const x of tachesDuJour(jours, date)) {
    const debut = enMin(x.debut);
    const fin = enMin(x.fin);
    if (debut == null || fin == null) continue;
    const titre = `📝 ${String(x.titre || "Tâche").slice(0, 40)}`;
    if (x.type === "perso") {
      // Trajet personnel : chaque étape est un petit bloc, un pro peut se glisser entre deux
      for (const e of etapesPerso(x)) {
        const jusqua = enMin(String(e.jusqua || "").replace("h", ":"));
        blocs.push({ debut: e.min, fin: Math.max(e.min + 5, jusqua || 0), de: e.adresse || null, a: e.adresse || null, texte: `🚗 ${e.texte}`, genre: "perso" });
      }
      continue;
    }
    const lieu = ok(x.lieu) ? x.lieu : null;
    if (x.type === "transport") {
      blocs.push({ debut, fin, de: ok(x.prise) ? x.prise : lieu, a: lieu, texte: titre, genre: "tache" });
      continue;
    }
    if (ok(x.prise)) {
      const r = Math.max(5, route(x.prise, lieu, debut));
      blocs.push({ debut: debut - r - 5, fin: debut, de: x.prise, a: lieu || x.prise, texte: `${titre} (passer prendre)`, genre: "tache" });
    }
    // Trajet d'un enfant vers une activité : seuls la dépose et le retour bloquent (Rebecca, 12 nov. : « pour le basket,
    // seuls les trajets sont bloqués, je peux prendre une petite course aux alentours »)
    if (x.type === "ramassage" && lieu && fin - debut >= 30) {
      blocs.push({ debut, fin: debut + 5, de: lieu, a: lieu, texte: `${titre} (déposer)`, genre: "tache" });
      blocs.push({ debut: fin, fin: fin + 5, de: lieu, a: lieu, texte: `${titre} (récupérer)`, genre: "tache" });
      continue;
    }
    blocs.push({ debut, fin, de: lieu, a: lieu, texte: titre, genre: "tache" });
  }

  // c. Dans l'ordre ; deux blocs qui se chevauchent n'en font qu'un
  const tries = blocs.filter((b) => Number.isFinite(b.debut) && Number.isFinite(b.fin) && b.fin >= b.debut).sort((p, q) => p.debut - q.debut || p.fin - q.fin);
  const fusion = [];
  for (const b of tries) {
    const p = fusion[fusion.length - 1];
    if (p && b.debut < p.fin) {
      if (b.fin > p.fin) {
        p.fin = b.fin;
        p.a = b.a || p.a;
      }
      p.texte = p.texte.includes(b.texte) ? p.texte : `${p.texte} + ${b.texte}`.slice(0, 120);
      continue;
    }
    fusion.push({ ...b });
  }
  return { blocs: fusion, domicile };
}

/* ---------- 2. La nouvelle demande, en points à visiter ---------- */

// req = { service, date, heure, depart, arrivee, allerRetour, heureRetour, dateRetour, attenteMinutes }
// Renvoie la liste des « legs » à insérer (un aller-retour avec heure de retour = deux legs)
export function legsDeLaDemande(req) {
  if (!req || !SERVICES_INSERABLES.includes(req.service) || !ok(req.depart) || !ok(req.arrivee) || enMin(req.heure) == null) return [];
  const h = enMin(req.heure);
  const P = req.depart;
  const D = req.arrivee;
  if (req.service === "livraison") return [{ date: req.date, h, points: [{ lieu: P, auPlusTot: h, texte: "📦 Récupérer le colis" }, { lieu: D, texte: "🏁 Livrer le colis" }], separable: true }];
  const legs = [];
  if (req.allerRetour && enMin(req.heureRetour) != null) {
    legs.push({ date: req.date, h, points: [{ lieu: P, auPlusTot: h, texte: "🚗 Prendre la cliente" }, { lieu: D, texte: "🏁 Déposer la cliente" }] });
    legs.push({ date: req.dateRetour || req.date, h: enMin(req.heureRetour), points: [{ lieu: D, auPlusTot: enMin(req.heureRetour), texte: "🚗 Reprendre la cliente (retour)" }, { lieu: P, texte: "🏁 La ramener" }] });
  } else if (req.allerRetour) {
    const attente = Math.max(0, Math.min(600, Number(req.attenteMinutes) || 0));
    legs.push({ date: req.date, h, points: [{ lieu: P, auPlusTot: h, texte: "🚗 Prendre la cliente" }, { lieu: D, texte: "🏁 Déposer la cliente", surPlace: SUR_PLACE_NOUVEAU + attente }, { lieu: P, texte: "🏁 La ramener" }] });
  } else {
    legs.push({ date: req.date, h, points: [{ lieu: P, auPlusTot: h, texte: "🚗 Prendre la cliente" }, { lieu: D, texte: "🏁 Déposer la cliente" }] });
  }
  return legs;
}

/* ---------- 3. Essayer chaque trou de la journée ---------- */

// Parcourt des points à partir de (lieu, minute) ; minute null = je pars de la maison quand il faut.
// Renvoie { fin, lieu, etapes, routeMin, km } ou null si un point « auPlusTot » est raté (j'arriverais en retard).
function parcourir(points, lieu, minute, duree) {
  let cur = minute;
  let ici = lieu;
  const etapes = [];
  let routeMin = 0;
  let km = 0;
  for (const p of points) {
    let arrivee;
    if (cur == null) {
      arrivee = p.auPlusTot != null ? p.auPlusTot : 0; // départ de la maison à temps (route comptée à part)
    } else {
      const r = duree(ici, p.lieu, cur);
      routeMin += r;
      km += kmRoute(ici, p.lieu);
      arrivee = cur + r;
      if (p.auPlusTot != null && arrivee > p.auPlusTot) return null; // en retard pour la cliente
    }
    if (p.auPlusTot != null) arrivee = Math.max(arrivee, p.auPlusTot); // j'attends sur place si j'arrive en avance
    etapes.push({ min: arrivee, texte: p.texte, lieu: p.lieu });
    cur = arrivee + (p.surPlace != null ? p.surPlace : SUR_PLACE_NOUVEAU);
    ici = p.lieu;
  }
  return { fin: cur, lieu: ici, etapes, routeMin, km };
}

// Les points passent-ils dans le trou g (entre le bloc g-1 et le bloc g) ? Renvoie l'option ou null.
function essayerTrou(blocs, g, points, { domicile, duree, marge }) {
  const avant = g > 0 ? blocs[g - 1] : null;
  const apres = g < blocs.length ? blocs[g] : null;
  const depuisLieu = avant ? avant.a || avant.de : domicile;
  const depuisMin = avant ? avant.fin + marge : null;
  const p = parcourir(points, depuisLieu, depuisMin, duree);
  if (!p) return null;
  // Sans bloc avant, la journée commence chez moi : je pars à temps (temps de route compté pour le détour)
  const routeDebut = !avant && domicile && points.length ? duree(domicile, points[0].lieu, points[0].auPlusTot) : 0;
  let routeFin = 0;
  let kmFin = 0;
  let direct = 0;
  let kmDirect = 0;
  const vers = apres ? apres.de || apres.a : domicile;
  if (apres || vers) {
    routeFin = duree(p.lieu, vers, p.fin);
    kmFin = kmRoute(p.lieu, vers);
  }
  if (apres) {
    const arrivee = p.fin + routeFin;
    const baseline = avant ? avant.fin + duree(depuisLieu, vers, avant.fin) : -Infinity;
    if (arrivee > Math.max(apres.debut - marge, baseline)) return null; // le rendez-vous suivant ne serait plus tenu
  }
  if ((avant || depuisLieu) && (apres || vers)) {
    direct = duree(depuisLieu, vers, avant ? avant.fin : null);
    kmDirect = kmRoute(depuisLieu, vers);
  }
  return {
    trou: g,
    etapes: p.etapes,
    fin: p.fin,
    detourMin: Math.max(0, Math.round(p.routeMin + routeDebut + routeFin - direct)),
    detourKm: Math.max(0, Math.round((p.km + (!avant && domicile && points.length ? kmRoute(domicile, points[0].lieu) : 0) + kmFin - kmDirect) * 10) / 10),
  };
}

// Un leg dans la journée : la meilleure option (le moins de détour), ou null
export function insererLeg(blocs, leg, { domicile = null, duree, marge = MARGE_DEFAUT } = {}) {
  const opts = { domicile, duree, marge };
  let meilleure = null;
  const garder = (o) => {
    if (o && (!meilleure || o.detourMin < meilleure.detourMin)) meilleure = o;
  };
  for (let g = 0; g <= blocs.length; g++) garder(essayerTrou(blocs, g, leg.points, opts));
  // Livraison : récupérer dans un trou, livrer dans un trou suivant (le colis attend dans le coffre)
  if (leg.separable && leg.points.length >= 2) {
    const [prise, ...reste] = leg.points;
    for (let g1 = 0; g1 < blocs.length; g1++) {
      const a = essayerTrou(blocs, g1, [prise], opts);
      if (!a) continue;
      for (let g2 = g1 + 1; g2 <= blocs.length; g2++) {
        if (blocs[g2 - 1].fin - a.fin > COLIS_MAX_MINUTES) break;
        const b = essayerTrou(blocs, g2, reste, opts);
        if (b && b.etapes[b.etapes.length - 1].min - prise.auPlusTot <= COLIS_MAX_MINUTES) {
          garder({ trou: g1, trouLivraison: g2, nPrise: a.etapes.length, etapes: [...a.etapes, ...b.etapes], fin: b.fin, detourMin: a.detourMin + b.detourMin, detourKm: Math.round((a.detourKm + b.detourKm) * 10) / 10 });
        }
      }
    }
  }
  return meilleure;
}

// Décalage d'un leg à une autre heure (les écarts entre ses points restent les mêmes)
const aLHeure = (leg, h) => ({ ...leg, h, points: leg.points.map((p) => (p.auPlusTot != null ? { ...p, auPlusTot: p.auPlusTot - leg.h + h } : p)) });

// Point d'entrée : la demande s'insère-t-elle ? journees = { "AAAA-MM-JJ": { blocs, domicile } } ; duree(date) -> fonction
// Renvoie { possible, legs: [option], proposition: "HH:MM" | null }
export function verifierInsertion(req, journees, { duree = null, t = TARIFS, finJournee = 23 * 60 } = {}) {
  const legs = legsDeLaDemande(req);
  if (!legs.length) return { possible: false, raison: "illisible", legs: [], proposition: null };
  const marge = margeDe(t);
  const essai = (decalage) => {
    const options = [];
    for (const leg of legs) {
      const j = journees[leg.date] || { blocs: [], domicile: null };
      const l = decalage ? aLHeure(leg, leg.h + decalage) : leg;
      const o = insererLeg(j.blocs, l, { domicile: j.domicile, duree: duree ? duree(leg.date) : fabriquerDuree({ date: leg.date, t }), marge });
      if (!o) return null;
      options.push({ ...o, date: leg.date });
    }
    return options;
  };
  const tout = essai(0);
  if (tout) return { possible: true, legs: tout, proposition: null, marge };
  // Prochaine heure faisable (même jour, par 5 minutes, jusqu'à 23h ; l'aller garde son écart avec le retour)
  for (let dec = 5; legs[0].h + dec <= finJournee && dec <= 12 * 60; dec += 5) {
    const o = essai(dec);
    if (o) return { possible: false, legs: o, proposition: enHeure(legs[0].h + dec), marge };
  }
  return { possible: false, legs: [], proposition: null, marge };
}

/* ---------- 4. Ce que voit Rebecca (admin) ---------- */

// « ✅ s'insère après …, +X min de détour, +Y ₪, ordre conseillé »
export function resumeAdmin(resultat, journees, { prix = null, coutKm = (TARIFS.rentabilite && TARIFS.rentabilite.coutKmReel) || 1.2 } = {}) {
  const lignes = [];
  const options = resultat.legs || [];
  options.forEach((o) => {
    const j = journees[o.date] || { blocs: [] };
    const avant = o.trou > 0 ? j.blocs[o.trou - 1] : null;
    const apres = j.blocs[o.trouLivraison != null ? o.trouLivraison : o.trou] || null;
    lignes.push({
      apres: avant ? `${hFr(avant.debut)} ${avant.texte}` : "le départ de la maison",
      avant: apres ? `${hFr(apres.debut)} ${apres.texte}` : "",
      detourMin: o.detourMin,
      detourKm: o.detourKm,
      coutDetour: Math.round(o.detourKm * coutKm),
      ordre: [
        ...(avant ? [{ heure: hFr(avant.debut), texte: avant.texte, fixe: true }] : []),
        ...o.etapes.flatMap((e, k) => [
          // Livraison séparée : mes rendez-vous entre la récupération et la livraison (le colis attend dans le coffre)
          ...(o.trouLivraison != null && k === o.nPrise ? j.blocs.slice(o.trou, o.trouLivraison).map((b) => ({ heure: hFr(b.debut), texte: `${b.texte} (colis dans le coffre)`, fixe: true })) : []),
          { heure: hFr(e.min), texte: `${e.texte}${nomCourt(e.lieu) ? " · " + nomCourt(e.lieu) : ""}`, nouveau: true },
        ]),
        ...(apres ? [{ heure: hFr(apres.debut), texte: apres.texte, fixe: true }] : []),
      ],
    });
  });
  const detour = lignes.reduce((s, l) => s + l.detourMin, 0);
  const cout = lignes.reduce((s, l) => s + l.coutDetour, 0);
  return { possible: !!resultat.possible, proposition: resultat.proposition || null, lignes, detourMin: detour, coutDetour: cout, gain: typeof prix === "number" ? Math.round(prix - cout) : null, prix: typeof prix === "number" ? prix : null };
}

// Demande enregistrée (admin) -> requête d'insertion
export function requeteDepuisDemande(d) {
  if (!d || !SERVICES_INSERABLES.includes(d.service)) return null;
  const v = d.details || {};
  let x = {};
  try { x = extremites(d) || {}; } catch { x = {}; }
  if (!ok(x.debut) || !ok(x.fin)) return null;
  const ar = estAllerRetour(d) || v.allerRetour === true;
  return { service: d.service, date: d.date, heure: d.heure, depart: x.debut, arrivee: x.fin, allerRetour: ar, heureRetour: ar ? v.heureRetour || "" : "", dateRetour: ar ? v.dateRetour || d.date : "", attenteMinutes: Number(v.attenteMinutes || v.attente) || 0 };
}

// Contrôle d'une requête venue du site (public) : coordonnées en Israël, date et heure valides
export function requeteValide(r) {
  if (!r || typeof r !== "object" || !SERVICES_INSERABLES.includes(r.service)) return null;
  const point = (a) => (a && Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon)) && Number(a.lat) > 29 && Number(a.lat) < 33.5 && Number(a.lon) > 34 && Number(a.lon) < 36 ? { lat: Number(a.lat), lon: Number(a.lon) } : null);
  const depart = point(r.depart);
  const arrivee = point(r.arrivee);
  if (!depart || !arrivee || !DATE_OK.test(r.date || "") || !HEURE_OK.test(r.heure || "")) return null;
  const ar = r.allerRetour === true;
  return {
    service: r.service,
    date: r.date,
    heure: r.heure,
    depart,
    arrivee,
    allerRetour: ar,
    heureRetour: ar && HEURE_OK.test(r.heureRetour || "") ? r.heureRetour : "",
    dateRetour: ar && DATE_OK.test(r.dateRetour || "") ? r.dateRetour : ar ? r.date : "",
    attenteMinutes: Math.max(0, Math.min(600, Math.round(Number(r.attenteMinutes) || 0))),
  };
}
