// DISPONIBILITE DE REBECCA POUR UN DEVIS DE RAMASSAGE FAIT SUR LE SITE - regles pures (15 nov. 2026)
// Demande de Rebecca : si elle est deja prise a une heure (sa tournee habituelle), une maman ne peut pas demander
// ce trajet sur le site ; elle peut garder ce qui est libre (ex. seulement la sortie de l'apres-midi).
// - les moments pris viennent du Calendrier public (creneaux fixes de la tournee : jours et heures, sans nom) ;
// - exception : une SORTIE dans la meme ecole, a quelques minutes d'un ramassage deja prevu, avec assez de places
//   dans la voiture = Rebecca prend l'enfant au passage (arrets publics : lieu de l'ecole, heure, places, sans nom).

import { TARIFS } from "./config.js";
import { JOURS, heureDuJour, ecoleDe, cleEcole, nomEnfant } from "./ramassagePlanning.js";
import { trajetActif, heureTrajet } from "./tournee.js";

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (h) => (HEURE.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : null);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const coord = (a) => !!a && typeof a.lat === "number" && typeof a.lon === "number";
const arrondi = (x) => Math.round(x * 1000) / 1000; // ~100 m : l'ecole, jamais une adresse precise
// Distance approximative en metres (petites distances)
const distance = (a, b) => {
  const dy = (a.lat - b.lat) * 111000;
  const dx = (a.lon - b.lon) * 111000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
};

/* ---------- Cote Rebecca : arrets ou un enfant peut etre pris au passage (document public) ---------- */

// trajets = la tournee (sorties d'ecole). Renvoie [{ jours: [w], heure, lieu: { lat, lon }, places }]
export function arretsGroupables(trajets, aujourdhui = "") {
  const parCle = new Map();
  for (const r of trajets || []) {
    if (!r || r.type !== "sortie" || !coord(r.de)) continue;
    const lieu = { lat: arrondi(r.de.lat), lon: arrondi(r.de.lon) };
    for (let w = 0; w < JOURS.length; w++) {
      if (!trajetActif(r, w, aujourdhui, aujourdhui)) continue;
      const heure = heureTrajet(r, w);
      if (!HEURE.test(heure)) continue;
      const cle = `${lieu.lat},${lieu.lon}|${heure}|${w}`;
      const x = parCle.get(cle) || { w, heure, lieu, places: 0 };
      x.places += Math.max(1, Math.round(Number(r.places)) || 1);
      parCle.set(cle, x);
    }
  }
  // memes lieu, heure et places : un seul arret pour plusieurs jours
  const fusion = new Map();
  for (const x of parCle.values()) {
    const cle = `${x.lieu.lat},${x.lieu.lon}|${x.heure}|${x.places}`;
    const y = fusion.get(cle) || { jours: [], heure: x.heure, lieu: x.lieu, places: x.places };
    y.jours.push(x.w);
    fusion.set(cle, y);
  }
  return [...fusion.values()].map((y) => ({ ...y, jours: y.jours.sort() })).sort((a, b) => (a.heure < b.heure ? -1 : 1)).slice(0, 60);
}

export function lireArrets(json) {
  try {
    const l = JSON.parse(json || "[]");
    return (Array.isArray(l) ? l : [])
      .filter((a) => a && HEURE.test(a.heure || "") && coord(a.lieu) && Array.isArray(a.jours))
      .slice(0, 60)
      .map((a) => ({ jours: a.jours.filter((w) => Number.isInteger(w) && w >= 0 && w < 6), heure: a.heure, lieu: { lat: a.lieu.lat, lon: a.lieu.lon }, places: Math.max(1, Math.round(Number(a.places)) || 1) }));
  } catch {
    return [];
  }
}

/* ---------- Cote site : les trajets demandes qui tombent sur un moment ou Rebecca est deja prise ---------- */

// creneaux = TARIFS.calendrier.creneauxPersonnels ([{ jours, debut, fin }]) ; arrets = lireArrets(...)
// routes = distances domicile <-> chaque ecole. Renvoie [{ i, nom, w, jour, sens, heure }] (trajets impossibles).
export function trajetsIndisponibles(plan, routes, creneaux = TARIFS.calendrier.creneauxPersonnels, arrets = [], t = TARIFS, options = {}) {
  const enfants = options.indices ? options.indices : plan.enfants.map((_, i) => i);
  const marge = ((t.tournee && t.tournee.margeRouteMinutes) ?? 0) + ((t.tournee && t.tournee.arretMinutes) || 5);
  const retard = (t.tournee && t.tournee.retardMaxMinutes) || 10;
  const places = (t.tournee && t.tournee.places) || 4;
  const routeDe = (ecole) => (routes && typeof routes.km === "number" ? routes : routes && routes[cleEcole(ecole)]) || null;
  const pris = (w, debut, fin) => (creneaux || []).some((c) => c && c.actif !== false && Array.isArray(c.jours) && c.jours.includes(w) && minutes(c.debut) < fin && minutes(c.fin) > debut);
  const jourUnique = plan.periode === "jour" && /^\d{4}-\d{2}-\d{2}$/.test(plan.date || "") ? new Date(`${plan.date}T12:00:00Z`).getUTCDay() : null;
  // Combien d'enfants de cette demande sortent ensemble (meme ecole, meme heure, meme jour)
  const ecartGroupe = (t.ramassage && typeof t.ramassage.regroupementMinutes === "number" ? t.ramassage.regroupementMinutes : 10);
  const ensemble = (w, heure, ecole) => plan.enfants.filter((e, k) => e.sens !== "matin" && (jourUnique !== null ? w === jourUnique : e.jours[w] && e.jours[w].actif) && minutes(heureDuJour(e, w)) != null && Math.abs(minutes(heureDuJour(e, w)) - minutes(heure)) <= ecartGroupe && cleEcole(ecoleDe(plan, k)) === cleEcole(ecole)).length;
  const auPassage = (w, heure, ecole, n) =>
    coord(ecole) &&
    (arrets || []).some((a) => a.jours.includes(w) && Math.abs(minutes(a.heure) - minutes(heure)) <= retard && distance(a.lieu, ecole) <= 250 && a.places + n <= places);
  // Trajets deja a cette famille (demande acceptee) : jamais bloquee par ses propres horaires (a 15 min pres)
  const propres = options.propres || [];
  const aElle = (w, sens, heure) => propres.some((p) => p.w === w && p.sens === sens && Math.abs(minutes(p.heure) - minutes(heure)) <= 15);
  const sortie = [];
  for (const i of enfants) {
    const e = plan.enfants[i];
    if (!e) continue;
    const ecole = ecoleDe(plan, i);
    const route = routeDe(ecole);
    const duree = route && route.minutes > 0 ? Math.ceil(route.minutes) : 15;
    for (let w = 0; w < JOURS.length; w++) {
      const actif = jourUnique !== null ? w === jourUnique : !!(e.jours[w] && e.jours[w].actif);
      if (!actif) continue;
      if (e.sens !== "sortie" && minutes(e.heureMatin) != null) {
        const m = minutes(e.heureMatin);
        if (pris(w, m - marge, m + duree + marge) && !aElle(w, "matin", e.heureMatin)) sortie.push({ i, nom: nomEnfant(e, i), w, jour: JOURS[w], sens: "matin", heure: e.heureMatin });
      }
      const h = heureDuJour(e, w);
      if (e.sens !== "matin" && minutes(h) != null) {
        const m = minutes(h);
        if (pris(w, m - marge, m + duree + marge) && !aElle(w, "sortie", h) && !auPassage(w, h, ecole, ensemble(w, h, ecole))) sortie.push({ i, nom: nomEnfant(e, i), w, jour: JOURS[w], sens: "sortie", heure: h });
      }
    }
  }
  return sortie;
}

// Texte court : « Lucas : lundi et mardi matin (07h45) ; mercredi sortie (13h30) »
export function texteIndisponibles(liste) {
  const groupes = new Map();
  for (const x of liste) {
    const cle = `${x.nom}|${x.sens}|${x.heure}`;
    if (!groupes.has(cle)) groupes.set(cle, { ...x, jours: [] });
    groupes.get(cle).jours.push(x.jour.toLowerCase());
  }
  return [...groupes.values()].map((g) => `${g.nom} : ${g.jours.join(", ")} ${g.sens === "matin" ? "matin" : "sortie"} (${g.heure.replace(":", "h")})`);
}

export { hhmm };
