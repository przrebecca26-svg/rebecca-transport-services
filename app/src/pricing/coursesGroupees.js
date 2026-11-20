// COURSES GROUPEES V1 (19 nov. 2026, « mode Wolt ») - regles pures (aucun acces internet ni base de donnees)
// Rebecca : « j'ai une course, je récupère (McDo à Ir Yamin) ; si quelqu'un veut que je récupère à côté (Pizza
// Centrale, Piano), je peux prendre plusieurs petites courses si elles sont sur mon trajet ; l'appli me dit qui livrer
// en premier, le premier sur la route, et le dernier le plus loin. »
// V1 sans nouvelle regle Firebase, calcul dans le telephone (distances a vol d'oiseau x 1,3, aucun cout Google) :
//   - Prochains arrets : les courses en cours aujourd'hui (Partie ou Recuperee, pas encore Deposee) dans le meilleur
//     ordre (on recupere toujours avant de deposer, le moins de km possible) ;
//   - Sur ta route : les demandes EN ATTENTE du jour dont la recuperation est proche et qui rallongent peu la tournee.
// Rien n'est accepte tout seul : Rebecca ouvre la demande et l'accepte comme d'habitude.
import { trajetACalculer } from "../services.js";
import { chronoDe } from "./finCourse.js";

export const SERVICES_GROUPABLES = ["livraison", "courses", "transport", "aeroport", "demenagement"];
export const RAYON_PRISE_KM = 2; // recuperation a moins de 2 km de moi ou d'un arret de ma tournee
export const DETOUR_MAX_KM = 4; // la nouvelle course ne rallonge pas la tournee de plus de 4 km (environ 8 min)
export const FACTEUR_ROUTE = 1.3; // vol d'oiseau -> route
export const MIN_PAR_KM = 2; // en ville, environ 30 km/h
const MAX_ARRETS_EXACT = 8;

const ok = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
export function kmEntre(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371 * FACTEUR_ROUTE;
}
const rond = (x) => Math.round(x * 10) / 10;

// Les deux arrets d'une demande (prendre, deposer) ; null si les adresses n'ont pas de position
export function arretsDe(d) {
  const t = trajetACalculer(d.service, d.details || {});
  if (!t || !ok(t.depart) || !ok(t.arrivee)) return null;
  return [
    { id: d.id + ":prendre", demande: d.id, sorte: "prendre", lieu: t.depart, nom: d.nom || "" },
    { id: d.id + ":deposer", demande: d.id, sorte: "deposer", lieu: t.arrivee, nom: d.nom || "" },
  ];
}

// Courses en cours aujourd'hui : acceptees, du jour, Partie ou Recuperee, pas encore Deposee
export function coursesEnCours(demandes = [], jour = "") {
  return demandes.filter((d) => {
    if (d.statut !== "acceptee" || d.date !== jour || !SERVICES_GROUPABLES.includes(d.service)) return false;
    const c = chronoDe(d);
    return (c.depart || c.arrivee || c.prise) && !c.depose;
  });
}
// Arrets restant a faire : si deja recuperee, seulement deposer
export function arretsRestants(courses = []) {
  const res = [];
  for (const d of courses) {
    const a = arretsDe(d);
    if (!a) continue;
    if (!chronoDe(d).prise) res.push(a[0]);
    res.push(a[1]);
  }
  return res;
}

// Meilleur ordre : toujours « prendre » avant « deposer » de la meme course ; depart = ma position (ou le 1er arret)
export function meilleurOrdre(arrets = [], depart = null) {
  if (arrets.length <= 1) return { ordre: [...arrets], km: arrets.length && ok(depart) ? rond(kmEntre(depart, arrets[0].lieu)) : 0 };
  const prises = new Set(arrets.filter((a) => a.sorte === "prendre").map((a) => a.demande));
  const longueur = (liste) => {
    let km = 0;
    let p = ok(depart) ? depart : null;
    for (const a of liste) {
      if (p) km += kmEntre(p, a.lieu);
      p = a.lieu;
    }
    return km;
  };
  if (arrets.length > MAX_ARRETS_EXACT) {
    // Beaucoup d'arrets : le plus proche possible a chaque fois
    const reste = [...arrets];
    const ordre = [];
    const pris = new Set();
    let p = ok(depart) ? depart : reste[0].lieu;
    while (reste.length) {
      const possibles = reste.filter((a) => a.sorte === "prendre" || !prises.has(a.demande) || pris.has(a.demande));
      possibles.sort((x, y) => kmEntre(p, x.lieu) - kmEntre(p, y.lieu));
      const a = possibles[0];
      ordre.push(a);
      if (a.sorte === "prendre") pris.add(a.demande);
      p = a.lieu;
      reste.splice(reste.indexOf(a), 1);
    }
    return { ordre, km: rond(longueur(ordre)) };
  }
  let meilleur = null;
  let best = Infinity;
  const essayer = (faits, reste, pris, km, p) => {
    if (km >= best) return;
    if (!reste.length) {
      best = km;
      meilleur = faits;
      return;
    }
    for (const a of reste) {
      if (a.sorte === "deposer" && prises.has(a.demande) && !pris.has(a.demande)) continue;
      const ajout = p ? kmEntre(p, a.lieu) : 0;
      const p2 = new Set(pris);
      if (a.sorte === "prendre") p2.add(a.demande);
      essayer([...faits, a], reste.filter((x) => x !== a), p2, km + ajout, a.lieu);
    }
  };
  essayer([], arrets, new Set(), 0, ok(depart) ? depart : null);
  return { ordre: meilleur || [...arrets], km: rond(best === Infinity ? 0 : best) };
}

// Demandes en attente du jour qui « rentrent » dans ma tournee : { demande, detourKm, detourMin, prix, ordre }
export function surMaRoute(demandes = [], enCours = [], jour = "", position = null, options = {}) {
  const rayon = options.rayonKm || RAYON_PRISE_KM;
  const detourMax = options.detourMaxKm || DETOUR_MAX_KM;
  const actuels = arretsRestants(enCours);
  if (!actuels.length && !ok(position)) return [];
  const base = meilleurOrdre(actuels, position);
  const reperes = [...(ok(position) ? [position] : []), ...actuels.map((a) => a.lieu)];
  const res = [];
  for (const d of demandes) {
    if (d.statut !== "en attente" || d.date !== jour || !["livraison", "courses"].includes(d.service)) continue;
    const a = arretsDe(d);
    if (!a) continue;
    const proche = reperes.some((r) => kmEntre(r, a[0].lieu) <= rayon);
    if (!proche) continue;
    const avec = meilleurOrdre([...actuels, ...a], position);
    const detour = rond(avec.km - base.km);
    if (detour > detourMax) continue;
    res.push({ demande: d, detourKm: Math.max(0, detour), detourMin: Math.max(0, Math.round(detour * MIN_PAR_KM)), prix: typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null, ordre: avec.ordre });
  }
  return res.sort((x, y) => x.detourKm - y.detourKm);
}
