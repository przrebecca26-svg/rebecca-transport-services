// REGROUPER DEUX DEMANDES DE TRANSPORT (15 nov. 2026, regle de Rebecca « 10 min, meme pour l'aeroport ») - regles pures
// Deux clientes separees, le meme jour, a 10 minutes d'ecart au plus, avec des departs proches et des arrivees proches
// (ex. deux familles vers l'aeroport) : Rebecca peut en faire UN seul trajet partage.
// Prix conseille : le trajet le plus cher (sans ses passagers en plus) + 25 % par passager au-dela de 2
// + un arret si les deux departs ne sont pas au meme endroit ; chaque cliente paie au prorata de ses passagers.

import { TARIFS } from "./config.js";
import { facteurPersonnes } from "./partage.js";

export const AEROPORT_TLV = { label: "Aéroport Ben Gourion (TLV)", lat: 32.0055, lon: 34.8854 };
const SERVICES = ["transport", "aeroport"];
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (h) => (HEURE.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : null);
const coord = (a) => !!a && typeof a.lat === "number" && typeof a.lon === "number";
export const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

// Depart et arrivee d'une demande (transport ou aeroport)
export function extremites(d) {
  const det = (d && d.details) || {};
  if (d.service === "aeroport") return det.direction === "depuis" ? { de: AEROPORT_TLV, vers: det.adresse } : { de: det.adresse, vers: AEROPORT_TLV };
  return { de: det.depart, vers: det.arrivee };
}

// Nombre de passagers d'une demande (familles du trajet partage, ou ancien champ « passagers »)
export function passagersDe(d) {
  const det = (d && d.details) || {};
  const n = Math.max(1, Math.min(3, Number(det.nbFamilles) || 1));
  let total = 0;
  for (let k = 1; k <= n; k++) total += Math.max(1, Number(det["personnesF" + k]) || (k === 1 ? Number(det.passagers) || 1 : 1));
  return total;
}

const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);

// Demandes qu'on peut regrouper avec d : [{ d, ecart (min), departKm, arriveeKm }]
const chiffres = (t) => String(t || "").replace(/\D/g, "").replace(/^972/, "0");
export const memeCliente = (a, b) => (!!a.uid && a.uid === b.uid) || (chiffres(a.telephone).length >= 9 && chiffres(a.telephone) === chiffres(b.telephone));
export function regroupementsPossibles(d, toutes, t = TARIFS, options = {}) {
  if (!d || !SERVICES.includes(d.service)) return [];
  const ecartMax = (t.ramassage && typeof t.ramassage.regroupementMinutes === "number" ? t.ramassage.regroupementMinutes : 10);
  const kmMax = options.kmMax || 3;
  const a = extremites(d);
  const m = minutes(d.heure);
  if (!coord(a.de) || !coord(a.vers) || m == null || !d.date) return [];
  return (toutes || [])
    // 19 nov. 2026 (test C2) : jamais avec une autre demande de la MEME cliente (doublon, pas un trajet partage)
    .filter((x) => x && x.id !== d.id && !memeCliente(d, x) && SERVICES.includes(x.service) && ["en attente", "acceptee"].includes(x.statut) && x.date === d.date)
    .map((x) => {
      const b = extremites(x);
      const mx = minutes(x.heure);
      if (!coord(b.de) || !coord(b.vers) || mx == null) return null;
      return { d: x, ecart: Math.abs(mx - m), departKm: Math.round(km(a.de, b.de) * 10) / 10, arriveeKm: Math.round(km(a.vers, b.vers) * 10) / 10 };
    })
    .filter((x) => x && x.ecart <= ecartMax && x.departKm <= kmMax && x.arriveeKm <= kmMax)
    .sort((x, y) => x.ecart - y.ecart);
}

// Prix conseille du trajet commun et part de chacune (null si un prix manque)
export function prixRegroupe(a, b, t = TARIFS) {
  const pa = prixDe(a);
  const pb = prixDe(b);
  if (pa == null || pb == null) return null;
  const na = passagersDe(a);
  const nb = passagersDe(b);
  const [cher, nCher] = pa >= pb ? [pa, na] : [pb, nb];
  const base = cher / facteurPersonnes(nCher, "transport", t); // le trajet seul, sans ses passagers en plus
  const ea = extremites(a);
  const eb = extremites(b);
  const arret = coord(ea.de) && coord(eb.de) && km(ea.de, eb.de) > 0.3 ? (t.arretsSupplementaires && t.arretsSupplementaires.netanya) || 20 : 0;
  const total = Math.ceil(base * facteurPersonnes(na + nb, "transport", t) + arret);
  const partA = Math.round((total * na) / (na + nb));
  return { total, arret, passagers: na + nb, parts: [{ id: a.id, montant: partA, passagers: na }, { id: b.id, montant: total - partA, passagers: nb }], separes: pa + pb };
}
