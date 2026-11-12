// DEVIS RAMASSAGE SCOLAIRE A PLUSIEURS ENFANTS - regles pures (aucun acces internet ni base de donnees)
// 12 nov. 2026, demande de Rebecca : une cliente a deux enfants dans la meme ecole, qui ne sortent pas a la meme
// heure (donc deux trajets), avec des horaires differents selon les jours, et veut un prix AU MOIS.
// - 1, 2 ou 3 enfants ; pour chaque enfant : les jours et l'heure exacte de chaque jour ;
// - periode : un seul jour, une semaine ou un mois ;
// - un trajet = un passage de Rebecca : deux enfants a la meme heure le meme jour = UN seul trajet ;
// - prix d'un trajet : exactement celui du site (prixTrajetRamassage) ;
// - chaque enfant peut avoir une autre ecole (meme domicile) : son trajet a alors son propre prix ;
// - reduction proposee : un jour = prix normal ; semaine = paliers du site (3 jours, 5 jours) ; mois = « reductionMois » ;
//   plusieurs enfants en forfait = « reductionPlusieursEnfants » (Reglages -> Tarifs) ; Rebecca peut taper un autre
//   pourcentage dans le devis ;
// - Chabbat, fetes et jours sans ecole indiques par Rebecca ne sont pas comptes ;
// - semaine ou mois SANS date (la cliente veut juste un prix) : semaine complete, ou mois le plus long
//   (31 jours, sans fete ni vacances) = le prix MAXIMUM d'un mois ;
// - forfait accepte : chaque mois, le prix reel du mois (fetes et vacances retirees) a cote du prix du mois complet.

import { TARIFS } from "./config.js";
import { arrondiSup, analyserRentabilite, detecterZone, prixTrajetRamassage } from "./engine.js";
import { ajouterJours, nomsJourSacre, verifierDisponibilite } from "./calendrier.js";

export const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
export const PERIODES = [
  { v: "jour", l: "Un seul jour" },
  { v: "semaine", l: "Une semaine" },
  { v: "mois", l: "Un mois" },
];
export const SENS = [
  { v: "sortie", l: "Sortie : école → domicile" },
  { v: "matin", l: "Matin : domicile → école" },
  { v: "deux", l: "Les deux" },
];
export const MAX_ENFANTS = 3;

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};
const h = (heure) => heure.replace(":", "h");
const dateFr = (date, options = { weekday: "long", day: "numeric", month: "long" }) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" });
};
const nombreFr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ---------- Valeurs de depart ---------- */

export const enfantVide = () => ({
  prenom: "",
  sens: "sortie",
  heureMatin: "",
  heureSortie: "", // heure habituelle : sert pour chaque jour qui n'a pas son heure a lui
  jours: JOURS.map(() => ({ actif: true, heure: "" })),
  autreEcole: false, // true = cet enfant n'est pas dans l'ecole indiquee en haut
  ecole: null,
});

export const planVide = () => ({ domicile: null, ecole: null, periode: "semaine", date: "", sansEcoleDu: "", sansEcoleAu: "", reduction: "", enfants: [enfantVide()] });

// Change le nombre d'enfants sans perdre ce qui est deja saisi
export function reglerNombreEnfants(enfants, n) {
  const nb = Math.min(MAX_ENFANTS, Math.max(1, Number(n) || 1));
  const liste = enfants.slice(0, nb);
  while (liste.length < nb) liste.push(enfantVide());
  return liste;
}

export const nomEnfant = (e, i) => String((e && e.prenom) || "").trim() || `Enfant ${i + 1}`;
// Ecole d'un enfant : la sienne s'il en a une autre, sinon celle du haut du devis
export const ecoleDe = (plan, i) => (plan.enfants[i] && plan.enfants[i].autreEcole ? plan.enfants[i].ecole : plan.ecole);
export const cleEcole = (a) => (a && typeof a.lat === "number" && typeof a.lon === "number" ? `${a.lat},${a.lon}` : "");
// Ecoles differentes du devis (pour calculer une distance par ecole)
export function ecolesDuPlan(plan) {
  const vues = new Map();
  plan.enfants.forEach((_, i) => {
    const e = ecoleDe(plan, i);
    if (cleEcole(e) && !vues.has(cleEcole(e))) vues.set(cleEcole(e), e);
  });
  return [...vues.values()];
}

// Reduction saisie par Rebecca dans le devis : "" = reduction proposee ; sinon un pourcentage de 0 a 100
export function reductionSaisie(plan) {
  const txt = String(plan.reduction == null ? "" : plan.reduction).trim().replace(",", ".");
  if (txt === "") return null;
  const n = Number(txt);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : null;
}

// Reduction proposee selon la periode, le nombre de jours et le nombre d'enfants
export function reductionProposee(plan, jours, t = TARIFS) {
  if (plan.periode === "jour") return 0;
  const palier = [...t.ramassage.reductions].sort((a, b) => b.minJours - a.minJours).find((r) => jours >= r.minJours);
  const base = plan.periode === "mois" ? t.ramassage.reductionMois || 0 : palier ? palier.pourcentage : 0;
  const forfait = plan.periode === "mois" || !!palier;
  return forfait && plan.enfants.length > 1 ? Math.max(base, t.ramassage.reductionPlusieursEnfants || 0) : base;
}

export const heureDuJour = (e, w) => (e.jours[w] && e.jours[w].heure) || e.heureSortie || "";

/* ---------- Dates de la periode ---------- */

// Dernier jour d'un mois de forfait : la veille du meme jour, le mois suivant (15 nov. -> 14 dec.)
export function finDuMois(date) {
  const [a, m, j] = date.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m + 1, 0)).getUTCDate(); // dernier jour du mois suivant
  const fin = new Date(Date.UTC(a, m, Math.min(j, dernier)));
  const p = (x) => String(x).padStart(2, "0");
  return ajouterJours(`${fin.getUTCFullYear()}-${p(fin.getUTCMonth() + 1)}-${p(fin.getUTCDate())}`, -1);
}

export function datesPeriode(plan) {
  if (!DATE_OK.test(plan.date || "")) return [];
  if (plan.periode === "jour") return [plan.date];
  const fin = plan.periode === "mois" ? finDuMois(plan.date) : ajouterJours(plan.date, 6);
  const dates = [];
  for (let d = plan.date; d <= fin; d = ajouterJours(d, 1)) dates.push(d);
  return dates;
}

/* ---------- Ce qui manque pour calculer ---------- */

const adresseSaisie = (a) => !!(a && typeof a === "object" && String(a.label || "").trim());

export function manquePlan(plan) {
  if (!adresseSaisie(plan.domicile)) return "Indique l'adresse du domicile pour voir le prix.";
  for (let i = 0; i < plan.enfants.length; i++) {
    if (!adresseSaisie(ecoleDe(plan, i))) return plan.enfants[i].autreEcole ? `${nomEnfant(plan.enfants[i], i)} : indique l'adresse de son école.` : "Indique l'adresse de l'école pour voir le prix.";
  }
  if (plan.periode === "jour" && !DATE_OK.test(plan.date || "")) return "Choisis la date pour voir le prix.";
  if (plan.periode === "jour" && jourSemaine(plan.date) === 6) return "Ce jour est un samedi : choisis un autre jour.";
  const jourUnique = plan.periode === "jour" ? jourSemaine(plan.date) : null;
  for (let i = 0; i < plan.enfants.length; i++) {
    const e = plan.enfants[i];
    const actifs = e.jours.map((j, w) => ({ ...j, w })).filter((j) => (jourUnique === null ? j.actif : j.w === jourUnique));
    if (actifs.length === 0) return `${nomEnfant(e, i)} : coche au moins un jour.`;
    if (e.sens !== "sortie" && !HEURE_OK.test(e.heureMatin || "")) return `${nomEnfant(e, i)} : indique l'heure du matin.`;
    if (e.sens !== "matin") {
      const sans = actifs.find((j) => !HEURE_OK.test(heureDuJour(e, j.w)));
      if (sans) return `${nomEnfant(e, i)} : indique l'heure de sortie du ${JOURS[sans.w].toLowerCase()}.`;
    }
  }
  return "";
}

/* ---------- Les trajets ---------- */

// Trajets d'un enfant un jour de semaine donne (sans tenir compte des dates)
function prevusDuJour(plan, w, jourUnique) {
  const prevus = [];
  plan.enfants.forEach((e, i) => {
    if (!jourUnique && !e.jours[w].actif) return;
    const ecole = cleEcole(ecoleDe(plan, i)) || String((ecoleDe(plan, i) || {}).label || "");
    if (e.sens !== "sortie" && HEURE_OK.test(e.heureMatin || "")) prevus.push({ sens: "matin", heure: e.heureMatin, ecole, i });
    if (e.sens !== "matin" && HEURE_OK.test(heureDuJour(e, w))) prevus.push({ sens: "sortie", heure: heureDuJour(e, w), ecole, i });
  });
  return prevus;
}
const nbTrajetsDuJour = (plan, w) => new Set(prevusDuJour(plan, w, false).map((p) => `${p.sens}|${p.heure}|${p.ecole}`)).size;

// Jours a compter : { cle, w, date } (date = null pour un devis sans date).
// options.du / options.au : periode imposee (un mois du calendrier pour un forfait accepte).
export function joursDuPlan(plan, options = {}) {
  const reels = (du, au) => {
    const liste = [];
    for (let d = du; d <= au; d = ajouterJours(d, 1)) if (jourSemaine(d) !== 6) liste.push({ cle: d, w: jourSemaine(d), date: d });
    return liste;
  };
  if (DATE_OK.test(options.du || "") && DATE_OK.test(options.au || "")) return reels(options.du, options.au);
  if (DATE_OK.test(plan.date || "")) {
    const dates = datesPeriode(plan);
    return reels(dates[0], dates[dates.length - 1]);
  }
  if (plan.periode === "jour") return [];
  const semaines = plan.periode === "mois" ? 4 : 1;
  const liste = [];
  for (let k = 0; k < semaines; k++) for (let w = 0; w < 6; w++) liste.push({ cle: `type-${k}-${w}`, w, date: null });
  if (plan.periode === "mois") {
    // Mois de 31 jours = 4 semaines + 3 jours qui se suivent : on prend les 3 jours les plus charges (prix maximum)
    let debut = 0;
    let max = -1;
    for (let d = 0; d < 7; d++) {
      const n = [d, (d + 1) % 7, (d + 2) % 7].reduce((x, w) => x + (w === 6 ? 0 : nbTrajetsDuJour(plan, w)), 0);
      if (n > max) [max, debut] = [n, d];
    }
    for (const w of [debut, (debut + 1) % 7, (debut + 2) % 7]) if (w !== 6) liste.push({ cle: `type-4-${w}`, w, date: null });
  }
  return liste;
}

const dansUnePlage = (date, plages) => plages.some((v) => DATE_OK.test(v.du || "") && date >= v.du && date <= (DATE_OK.test(v.au || "") ? v.au : v.du));

// Tous les trajets de la periode. Un trajet = { date, w, sens: "matin" | "sortie", heure, ecole, enfants: [index] }.
// Deux enfants de la meme ecole au meme moment = un seul trajet. Chabbat, fetes et jours sans ecole : non comptes.
// options.vacances : [{ du, au }] (vacances scolaires notees par Rebecca), en plus de celles du devis.
export function trajetsPlan(plan, t = TARIFS, options = {}) {
  const trajets = new Map();
  const retires = []; // { date, motif }
  const jourUnique = plan.periode === "jour" && !options.du;
  const plages = [{ du: plan.sansEcoleDu, au: plan.sansEcoleAu }, ...(options.vacances || [])];
  for (const jour of joursDuPlan(plan, options)) {
    const prevus = prevusDuJour(plan, jour.w, jourUnique);
    if (prevus.length === 0) continue;
    if (jour.date) {
      const sacre = nomsJourSacre(jour.date, t);
      if (sacre.length || dansUnePlage(jour.date, plages)) {
        retires.push({ date: jour.date, motif: sacre.length ? sacre.join(", ") : "Pas d'école" });
        continue;
      }
    }
    for (const p of prevus) {
      const cle = `${jour.cle}|${p.sens}|${p.heure}|${p.ecole}`;
      if (!trajets.has(cle)) trajets.set(cle, { date: jour.cle, w: jour.w, reel: !!jour.date, sens: p.sens, heure: p.heure, ecole: p.ecole, enfants: [] });
      trajets.get(cle).enfants.push(p.i);
    }
  }
  const liste = [...trajets.values()].sort((a, b) => (a.date + a.heure < b.date + b.heure ? -1 : 1));
  return { trajets: liste, retires };
}

/* ---------- Le prix ---------- */

// routes = distance domicile <-> ecole (meme calcul que le site) : soit { km, minutes } (une seule ecole),
// soit une table { [cleEcole]: { km, minutes } } quand les enfants ont des ecoles differentes.
export function calculerPlan(plan, routes, t = TARIFS, options = {}) {
  const manque = manquePlan(plan);
  if (manque) return { ok: false, erreur: manque };
  const routeDe = (ecole) => (routes && typeof routes.km === "number" ? routes : routes && routes[ecole]) || null;
  const { trajets, retires } = trajetsPlan(plan, t, options);
  const sansDate = trajets.length > 0 && !trajets[0].reel;
  if (trajets.length === 0) return { ok: false, erreur: "Aucun jour d'école dans cette période (Chabbat, fête ou jours sans école)." };

  // Prix d'un trajet pour chaque ecole (exactement la regle du site)
  const prixEcole = new Map();
  let horsAxe = false;
  for (let i = 0; i < plan.enfants.length; i++) {
    const adresse = ecoleDe(plan, i);
    const cle = cleEcole(adresse) || String(adresse.label || "");
    if (prixEcole.has(cle)) continue;
    const route = routeDe(cle);
    if (!route || !(route.km > 0) || !(route.minutes > 0)) return { ok: false, erreur: "Distance du trajet manquante." };
    const d = { service: "ramassage", zoneDepart: detecterZone(plan.domicile.label, t), zoneArrivee: detecterZone(adresse.label, t), aller: { km: route.km, minutes: route.minutes } };
    const p = prixTrajetRamassage(d, t);
    horsAxe = horsAxe || p.horsAxe;
    prixEcole.set(cle, { parTrajet: p.parTrajet, route });
  }

  const jours = new Set(trajets.map((x) => x.date)).size;
  const brut = trajets.reduce((n, x) => n + prixEcole.get(x.ecole).parTrajet, 0);
  const proposee = reductionProposee(plan, jours, t);
  const saisie = reductionSaisie(plan);
  const pourcentage = saisie === null ? proposee : saisie;
  const total = pourcentage > 0 ? arrondiSup(brut * (1 - pourcentage), t.arrondi) : brut;
  const nomPeriode = plan.periode === "mois" ? "Forfait mois" : plan.periode === "semaine" ? "Forfait semaine" : "Ramassage";
  // Une ligne par prix de trajet (une seule si tous les enfants sont dans la meme ecole)
  const parPrix = new Map();
  for (const x of trajets) parPrix.set(prixEcole.get(x.ecole).parTrajet, (parPrix.get(prixEcole.get(x.ecole).parTrajet) || 0) + 1);
  const groupes = [...parPrix.entries()].map(([prix, nombre]) => ({ prix, nombre }));
  const lignes = groupes.map((g) => ({ libelle: `${nomPeriode} : ${g.nombre} trajet${g.nombre > 1 ? "s" : ""} x ${g.prix} ₪`, montant: g.nombre * g.prix, base: true }));
  const pct = Math.round(pourcentage * 1000) / 10;
  if (total < brut) lignes.push({ libelle: `Réduction ${plan.periode === "jour" ? "" : "forfait "}${String(pct).replace(".", ",")} %`, montant: total - brut, base: true });

  const aConfirmer = [];
  if (horsAxe) aConfirmer.push("Trajet hors axe Netanya : prix à confirmer par Rebecca.");
  if (sansDate && plan.periode === "mois") aConfirmer.push("Prix d'un mois complet (le plus long, sans fête ni vacances).");
  else if (plan.periode !== "jour" && !sansDate) aConfirmer.push("Chabbat, fêtes et jours sans école ne sont pas comptés.");

  // Pour Rebecca seulement : ses propres creneaux deja pris (ecole de sa fille, fermetures...)
  const conflits = [];
  const vus = new Set();
  for (const x of trajets) {
    if (!x.reel) continue;
    const p = verifierDisponibilite(x.date, x.heure, prixEcole.get(x.ecole).route.minutes * 2, t, "ramassage");
    const cle = `${jourSemaine(x.date)}|${x.heure}|${p ? p.label : ""}`;
    if (p && !vus.has(cle)) {
      vus.add(cle);
      conflits.push(`${JOURS[jourSemaine(x.date)]} à ${h(x.heure)} : ${p.label}`);
    }
  }

  const parEnfant = plan.enfants.map((e, i) => trajets.filter((x) => x.enfants.includes(i)).length);
  const parTrajetNet = Math.round((total / trajets.length) * 100) / 100;
  // Rentabilite sur l'ensemble des trajets (chaque trajet a son retour a vide), ramenee a un trajet
  const cumul = trajets.reduce((c, x) => ({ km: c.km + prixEcole.get(x.ecole).route.km, minutes: c.minutes + prixEcole.get(x.ecole).route.minutes }), { km: 0, minutes: 0 });
  const renta = analyserRentabilite({ aller: cumul, allerRetour: false }, total, t);
  return {
    ok: true,
    total,
    lignes,
    aConfirmer,
    separe: [],
    details: {
      parTrajet: groupes[0].prix,
      groupes,
      parTrajetNet,
      nbTrajets: trajets.length,
      jours,
      sansDate,
      brut,
      reduction: total < brut ? pct : 0,
      reductionProposee: Math.round(proposee * 1000) / 10,
      economie: brut - total,
      parEnfant,
      retires,
      conflits,
      debut: trajets[0].date,
      fin: trajets[trajets.length - 1].date,
      rentabilite: { ...renta, gainNetParTrajet: Math.round(renta.gainNet / trajets.length) },
    },
  };
}

/* ---------- Textes ---------- */

// Horaires d'un enfant, jours regroupes par heure : « dimanche, mardi à 12h00 ; lundi à 11h00 »
export function horairesEnfant(plan, i) {
  const e = plan.enfants[i];
  const jourUnique = plan.periode === "jour" && DATE_OK.test(plan.date || "") ? jourSemaine(plan.date) : null;
  const actifs = JOURS.map((_, w) => w).filter((w) => (jourUnique === null ? e.jours[w].actif : w === jourUnique));
  const morceaux = [];
  if (e.sens !== "sortie" && e.heureMatin) morceaux.push(`matin à ${h(e.heureMatin)}`);
  if (e.sens !== "matin") {
    const groupes = new Map();
    for (const w of actifs) {
      const heure = heureDuJour(e, w);
      if (!heure) continue;
      if (!groupes.has(heure)) groupes.set(heure, []);
      groupes.get(heure).push(JOURS[w].toLowerCase());
    }
    const sortie = [...groupes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([heure, js]) => `${js.join(", ")} à ${h(heure)}`);
    if (sortie.length) morceaux.push(`sortie ${sortie.join(" ; ")}`);
  }
  if (e.sens === "matin") morceaux.push(actifs.map((w) => JOURS[w].toLowerCase()).join(", "));
  return morceaux.join(" · ");
}

export function libellePeriode(plan, resultat) {
  if (plan.periode === "jour") return `le ${dateFr(plan.date)}`;
  if (!DATE_OK.test(plan.date || "")) {
    const n = resultat && resultat.ok ? resultat.details.jours : 0;
    return plan.periode === "mois" ? `pour un mois complet${n ? ` (jusqu'à ${n} jours d'école)` : ""}` : `pour une semaine complète${n ? ` (${n} jour${n > 1 ? "s" : ""} d'école)` : ""}`;
  }
  const fin = plan.periode === "mois" ? finDuMois(plan.date) : ajouterJours(plan.date, 6);
  const court = { day: "numeric", month: "long" };
  return `du ${dateFr(plan.date, court)} au ${dateFr(fin, court)}${resultat && resultat.ok ? ` (${resultat.details.jours} jour${resultat.details.jours > 1 ? "s" : ""} d'école)` : ""}`;
}

// Message pret a envoyer a la cliente. Jamais les alertes internes (rentabilite, agenda de Rebecca).
export function messagePlan(plan, resultat) {
  const n = plan.enfants.length;
  const qui = n === 1 ? (plan.enfants[0].prenom.trim() ? `de ${plan.enfants[0].prenom.trim()}` : "de votre enfant") : `de vos ${n} enfants`;
  const lignes = ["Bonjour 😊", ""];
  if (!resultat || !resultat.ok) {
    lignes.push(`Pour le ramassage scolaire ${qui}, je vous prépare un devis personnalisé.`);
  } else {
    const x = resultat.details;
    lignes.push(`Voici mon devis pour le ramassage scolaire ${qui}, ${libellePeriode(plan, resultat)} :`, "");
    const plusieursEcoles = ecolesDuPlan(plan).length > 1;
    plan.enfants.forEach((e, i) => lignes.push(`• ${nomEnfant(e, i)}${plusieursEcoles ? ` (${String(ecoleDe(plan, i).label).split(",")[0]})` : ""} : ${horairesEnfant(plan, i)}`));
    lignes.push("");
    for (const g of x.groupes) lignes.push(`${g.nombre} trajet${g.nombre > 1 ? "s" : ""} x ${g.prix} ₪ = ${nombreFr(g.nombre * g.prix)} ₪`);
    if (x.reduction) lignes.push(`Réduction ${plan.periode === "jour" ? "" : "forfait "}${String(x.reduction).replace(".", ",")} % : -${nombreFr(x.economie)} ₪`);
    lignes.push(`Total : ${nombreFr(resultat.total)} ₪${x.reduction ? ` (soit ${String(x.parTrajetNet).replace(".", ",")} ₪ par trajet)` : ""}`);
    if (plan.periode !== "jour" && !x.sansDate) lignes.push("", "Chabbat, fêtes et jours sans école ne sont pas comptés.");
  }
  lignes.push("", "Pouvez-vous me confirmer les adresses exactes et les horaires ?", "", "Rebecca Services", "Votre temps est précieux, je vous aide à en profiter. 🌸");
  return lignes.join("\n");
}

// Pre-remplissage de « + Ajouter une course » : le forfait entier, au premier jour
export function planVersAjoutManuel(plan, resultat) {
  const adresses = {};
  if (plan.domicile && plan.domicile.label) adresses.domicile = plan.domicile;
  if (plan.ecole && plan.ecole.label) adresses.ecole = plan.ecole;
  const premier = resultat && resultat.ok ? trajetsPlanPremier(plan) : null;
  return {
    service: "ramassage",
    date: premier ? premier.date : plan.date || "",
    heure: premier ? premier.heure : "",
    adresses,
    direction: "vers",
    magasin: "",
    prix: resultat && resultat.ok ? String(resultat.total) : "",
  };
}
const trajetsPlanPremier = (plan) => trajetsPlan(plan).trajets.find((x) => x.reel) || null;

/* ---------- Forfait au mois accepte : prix du mois complet et prix reel de chaque mois ---------- */

// forfait = { plan, routes } enregistres a l'acceptation. Prix du mois complet (le maximum) :
export const prixMoisComplet = (forfait, t = TARIFS) => calculerPlan({ ...forfait.plan, periode: "mois", date: "", sansEcoleDu: "", sansEcoleAu: "" }, forfait.routes, t);

// Prix reel d'un mois du calendrier (mois = 1 a 12) : Chabbat, fetes et vacances scolaires retires
export function prixMoisReel(forfait, annee, mois, vacances = [], t = TARIFS) {
  const p = (x) => String(x).padStart(2, "0");
  const du = `${annee}-${p(mois)}-01`;
  const au = `${annee}-${p(mois)}-${p(new Date(Date.UTC(annee, mois, 0)).getUTCDate())}`;
  return calculerPlan({ ...forfait.plan, periode: "mois", date: du, sansEcoleDu: "", sansEcoleAu: "" }, forfait.routes, t, { du, au, vacances });
}

// Ce que Rebecca doit savoir pour un mois : prix complet, prix reel, jours retires
export function bilanMois(forfait, annee, mois, vacances = [], t = TARIFS) {
  const complet = prixMoisComplet(forfait, t);
  const reel = prixMoisReel(forfait, annee, mois, vacances, t);
  if (!complet.ok) return null;
  return {
    complet: complet.total,
    reel: reel.ok ? reel.total : 0,
    jours: reel.ok ? reel.details.jours : 0,
    retires: reel.ok ? reel.details.retires : [],
    difference: complet.total - (reel.ok ? reel.total : 0),
  };
}
