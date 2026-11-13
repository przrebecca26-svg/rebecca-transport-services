// MON ESSENCE (13 nov. 2026, 08h53) - regles pures (aucun acces internet ni base de donnees)
// Rebecca : « je mets souvent de l'essence : Wolt, ramassage scolaire, mes courses, et aussi mon perso (mariage,
// bar mitsva). Je rentre toutes les factures et je veux voir : tant d'essence dans le mois, tant pour travailler
// (Rebecca Services + Wolt), tant pour mon perso. » + « Wolt : j'ai le nombre de livraisons, les km, ce que j'ai gagne. »
// - Les pleins sont gardes dans le document PRIVE admin/essence, PAS dans les depenses : ils ne faussent pas le benefice.
// - Travail Rebecca Services = km des courses terminees (aller + retour) + km de la tournee scolaire par jour d'ecole.
// - Travail Wolt = km notes avec chaque ligne Wolt.
// - Si le compteur est note aux pleins : km reellement roules -> la part de chacun suit les km. Sinon : km x consommation.

import { TARIFS, carburantParKm } from "./config.js";
import { vacancesDuJour } from "./calendrier.js";
import { cleLieu, kmDuJour } from "./tournee.js";
import { extremites } from "./enchainement.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const pos = (x, max = 1e7) => {
  const n = Number(String(x == null ? "" : x).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= max ? n : 0;
};
let compteur = 0;
export const nouvelIdPlein = () => `e${Date.now().toString(36)}${(compteur++).toString(36)}`;

export function lireEssence(json) {
  let o;
  try {
    o = typeof json === "string" ? JSON.parse(json || "{}") : json;
  } catch {
    o = {};
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
  const pleins = (Array.isArray(o.pleins) ? o.pleins : [])
    .filter((p) => p && DATE_OK.test(p.date || "") && pos(p.montant, 5000))
    .slice(0, 1000)
    .map((p) => ({ id: String(p.id || nouvelIdPlein()).slice(0, 40), date: p.date, montant: cents(pos(p.montant, 5000)), litres: cents(pos(p.litres, 500)), compteur: Math.round(pos(p.compteur, 2000000)) }));
  const woltKm = {};
  for (const [id, km] of Object.entries(o.woltKm && typeof o.woltKm === "object" ? o.woltKm : {}).slice(0, 2000)) if (pos(km, 20000)) woltKm[String(id).slice(0, 60)] = cents(pos(km, 20000));
  return { pleins, woltKm, tourneeKmJour: cents(pos(o.tourneeKmJour, 500)) };
}

const moisDe = (d) => String(d || "").slice(0, 7);
const joursDuMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${mois}-${String(i + 1).padStart(2, "0")}`);
};
// Jours d'ecole du mois (dimanche a jeudi, hors vacances scolaires et fetes)
export const joursEcole = (mois, t = TARIFS) => joursDuMois(mois).filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() <= 4 && !vacancesDuJour(d, t)).length;

// Km roules dans le mois d'apres le compteur : du dernier releve avant le mois (ou premier du mois) au dernier du mois
export function kmCompteur(pleins, mois) {
  const r = pleins.filter((p) => p.compteur > 0).sort((a, b) => a.date.localeCompare(b.date) || a.compteur - b.compteur);
  const avant = r.filter((p) => p.date < `${mois}-01`);
  const dans = r.filter((p) => moisDe(p.date) === mois);
  if (!dans.length) return 0;
  const depart = avant.length ? avant[avant.length - 1].compteur : dans[0].compteur;
  return Math.max(0, dans[dans.length - 1].compteur - depart);
}

// demandes : courses terminees de Rebecca ; wolt : lignes Wolt de Rebecca { id, debut, livraisons, revenu }
// reel (13 nov. 2026, 09h36) : km calcules sur les vraies adresses { kmTournee, kmCourses } (voir kmDuMoisReel) ;
// absent = estimation (km des courses x 2 et km de tournee par jour notes par Rebecca)
export function essenceDuMois(mois, essence, demandes = [], wolt = [], t = TARIFS, reel = null) {
  const pleins = essence.pleins.filter((p) => moisDe(p.date) === mois);
  const total = cents(pleins.reduce((s, p) => s + p.montant, 0));
  const litres = cents(pleins.reduce((s, p) => s + (p.litres || 0), 0));
  const courses = demandes.filter((d) => d.statut === "terminee" && moisDe(d.date) === mois && (!d.realisePar || d.realisePar === "rebecca"));
  const kmCourses = reel ? cents(reel.kmCourses) : cents(courses.reduce((s, d) => s + 2 * (Number(d.kmEstime) || 0), 0)); // aller + retour
  const jours = joursEcole(mois, t);
  const kmTournee = reel ? cents(reel.kmTournee) : cents(essence.tourneeKmJour * jours);
  const lignesWolt = wolt.filter((l) => moisDe(l.debut) === mois);
  const kmWolt = cents(lignesWolt.reduce((s, l) => s + (essence.woltKm[l.id] || 0), 0));
  const livraisonsWolt = lignesWolt.reduce((s, l) => s + (Number(l.livraisons) || 0), 0);
  const gainsWolt = cents(lignesWolt.reduce((s, l) => s + (Number(l.revenu) || 0), 0));
  const kmRS = cents(kmCourses + kmTournee);
  const kmTotal = kmCompteur(essence.pleins, mois);
  const parKm = carburantParKm(t);
  let rs, w;
  if (kmTotal > 0 && total > 0) {
    // compteur connu : chacun sa part des km (jamais plus que le total)
    const travail = Math.min(kmTotal, kmRS + kmWolt);
    const k = travail > 0 ? travail / (kmRS + kmWolt || 1) : 0;
    rs = (total * kmRS * k) / kmTotal;
    w = (total * kmWolt * k) / kmTotal;
  } else {
    rs = kmRS * parKm;
    w = kmWolt * parKm;
    if (total > 0 && rs + w > total) {
      const k = total / (rs + w);
      rs *= k;
      w *= k;
    }
  }
  rs = cents(rs);
  w = cents(w);
  return {
    mois,
    total,
    litres,
    nbPleins: pleins.length,
    kmTotal,
    kmCourses,
    kmTournee,
    joursEcole: jours,
    kmRS,
    kmWolt,
    livraisonsWolt,
    gainsWolt,
    essenceRS: rs,
    essenceWolt: w,
    essencePerso: total > 0 ? cents(Math.max(0, total - rs - w)) : 0,
    kmPerso: kmTotal > 0 ? cents(Math.max(0, kmTotal - kmRS - kmWolt)) : null,
    gainWoltNet: cents(gainsWolt - w),
    kmCalcules: !!reel,
  };
}

export const ajouterPlein = (e, p) => ({ ...e, pleins: [...e.pleins, { id: nouvelIdPlein(), date: p.date, montant: cents(pos(p.montant, 5000)), litres: cents(pos(p.litres, 500)), compteur: Math.round(pos(p.compteur, 2000000)) }] });
export const retirerPlein = (e, id) => ({ ...e, pleins: e.pleins.filter((p) => p.id !== id) });
export const kmWolt = (e, id, km) => {
  const woltKm = { ...e.woltKm };
  if (pos(km, 20000)) woltKm[id] = cents(pos(km, 20000));
  else delete woltKm[id];
  return { ...e, woltKm };
};

/* ---------- Km reels du mois (13 nov. 2026, 09h36) ----------
   Tournee : chaque jour passe du mois, les vrais arrets de la journee (depart et retour a la maison compris).
   Courses : maison -> recuperation -> livraison -> maison, pour chaque course terminee de Rebecca.
   km(cleA, cleB) = distance routiere ; journee(date) = journee calculee de la tournee (ou null). */
export function kmDuMoisReel({ mois, jusqua, journee, domicile, courses = [], km }) {
  let kmTournee = 0;
  for (let j = 1; j <= 31; j++) {
    const date = `${mois}-${String(j).padStart(2, "0")}`;
    if (date > jusqua || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime()) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 7) !== mois) continue;
    kmTournee += kmDuJour(journee(date), domicile, km);
  }
  const d0 = cleLieu(domicile);
  let kmCourses = 0;
  for (const d of courses) {
    if (d.statut !== "terminee" || String(d.date).slice(0, 7) !== mois || (d.realisePar && d.realisePar !== "rebecca")) continue;
    if (d.service === "ramassage" && d.details && d.details.forfait) continue; // deja dans la tournee
    const e = extremites(d);
    const a = cleLieu(e.debut);
    const b = cleLieu(e.fin);
    const trajet = Number(d.kmEstime) || (a && b ? km(a, b) || 0 : 0);
    kmCourses += trajet + (d0 && a ? km(d0, a) || 0 : 0) + (d0 && b ? km(b, d0) || 0 : 0);
  }
  return { kmTournee: cents(kmTournee), kmCourses: cents(kmCourses) };
}
