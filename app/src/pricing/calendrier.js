// CALENDRIER JUIF ET FERMETURES - Rebecca Transport & Services
// Blocage automatique : Chabbat, fetes (Yom Tov) et fermetures exceptionnelles.
// - Dates hebraiques : calendrier hebreu integre aux navigateurs/Node (Intl), fuseau Asia/Jerusalem.
// - Horaires : coucher du soleil calcule pour Netanya (precision d'environ 1 a 2 minutes),
//   avec une marge de securite avant l'entree et apres la sortie.
// IMPORTANT : ce sont des horaires calcules, pas une autorite rabbinique. Rebecca peut toujours
// ajouter une fermeture exceptionnelle dans l'espace admin.

import { TARIFS } from "./config.js";

const FUSEAU = "Asia/Jerusalem";

const formatLocal = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSEAU,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const formatHebreu = new Intl.DateTimeFormat("en-u-ca-hebrew-nu-latn", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* ---------- Heures locales Israel <-> instants UTC ---------- */

function partiesLocales(utcMs) {
  const p = {};
  for (const x of formatLocal.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return p;
}

function decalageMs(utcMs) {
  const p = partiesLocales(utcMs);
  const localCommeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return localCommeUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-11-06" + "14:30" (heure d'Israel) -> instant UTC en millisecondes
export function localVersUtc(date, heure) {
  const [a, mo, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const suppose = Date.UTC(a, mo - 1, j, h, mi);
  let utc = suppose - decalageMs(suppose);
  const decalage2 = decalageMs(utc);
  utc = suppose - decalage2;
  return utc;
}

export function utcVersLocal(utcMs) {
  const p = partiesLocales(utcMs);
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

export function ajouterJours(date, n) {
  const [a, mo, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j + n));
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/* ---------- Coucher du soleil (equation du lever/coucher) ---------- */

const rad = (x) => (x * Math.PI) / 180;
const deg = (x) => (x * 180) / Math.PI;

export function coucherSoleilUtc(date, t = TARIFS) {
  const { latitude, longitude } = t.calendrier;
  const [a, mo, j] = date.split("-").map(Number);
  const jourJulienMidi = Date.UTC(a, mo - 1, j, 12) / 86400000 + 2440587.5;
  const n = Math.round(jourJulienMidi - 2451545.0);
  const jEtoile = n + 0.0008 - longitude / 360; // longitude est (est = positif)
  const M = (357.5291 + 0.98560028 * jEtoile) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jMeridien = 2451545.0 + jEtoile + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda));
  const sinDelta = Math.sin(rad(lambda)) * Math.sin(rad(23.4397));
  const cosDelta = Math.cos(Math.asin(sinDelta));
  const cosOmega = (Math.sin(rad(-0.833)) - Math.sin(rad(latitude)) * sinDelta) / (Math.cos(rad(latitude)) * cosDelta);
  const omega = deg(Math.acos(cosOmega));
  const jCoucher = jMeridien + omega / 360;
  return Math.round((jCoucher - 2440587.5) * 86400000);
}

/* ---------- Jours sacres : Chabbat et fetes ---------- */

const dateHebreuCache = new Map();
export function dateHebraique(date) {
  if (dateHebreuCache.has(date)) return dateHebreuCache.get(date);
  const [a, mo, j] = date.split("-").map(Number);
  const p = {};
  for (const x of formatHebreu.formatToParts(new Date(Date.UTC(a, mo - 1, j, 12)))) p[x.type] = x.value;
  const r = { jour: Number(p.day), mois: p.month, annee: Number(p.year) };
  dateHebreuCache.set(date, r);
  return r;
}

// Fetes d'Israel (un seul jour de fete, sauf Roch Hachana) - nom en francais
function nomFete({ jour, mois }, t) {
  if (mois === "Tishri") {
    if (jour === 1 || jour === 2) return "Roch Hachana";
    if (jour === 10) return "Yom Kippour";
    if (jour === 15) return "Souccot";
    if (jour === 22) return "Shemini Atzeret / Sim'hat Torah";
    if (t.calendrier.holHamoed.bloquer && jour >= 16 && jour <= 21) return "Hol Hamoed Souccot";
  }
  if (mois === "Nisan") {
    if (jour === 15) return "Pessah (1er jour)";
    if (jour === 21) return "Pessah (dernier jour)";
    if (t.calendrier.holHamoed.bloquer && jour >= 16 && jour <= 20) return "Hol Hamoed Pessah";
  }
  if (mois === "Sivan" && jour === 6) return "Chavouot";
  return null;
}

export function nomsJourSacre(date, t = TARIFS) {
  const [a, mo, j] = date.split("-").map(Number);
  const noms = [];
  if (new Date(Date.UTC(a, mo - 1, j)).getUTCDay() === 6) noms.push("Chabbat");
  const fete = nomFete(dateHebraique(date), t);
  if (fete) noms.push(fete);
  return noms;
}

/* ---------- Periodes de fermeture ---------- */

function periode(debutUtc, finUtc, label, type) {
  return {
    debutUtc,
    finUtc,
    debut: utcVersLocal(debutUtc),
    fin: utcVersLocal(finUtc),
    label,
    type, // "chabbat_fete", "exceptionnelle" ou "personnel"
  };
}

// Toutes les periodes de fermeture qui touchent [depuis ; depuis + nbJours]
export function periodesFermees(depuis, nbJours = 14, t = TARIFS) {
  const cal = t.calendrier;
  const resultat = [];
  const debutScan = -5;
  const finScan = nbJours + 5;
  let i = debutScan;
  while (i <= finScan) {
    const jour = ajouterJours(depuis, i);
    const noms = nomsJourSacre(jour, t);
    if (noms.length === 0) {
      i++;
      continue;
    }
    // Serie de jours sacres consecutifs (ex : fete + Chabbat)
    let dernier = jour;
    const tousNoms = [...noms];
    let k = i + 1;
    for (;;) {
      const suivant = ajouterJours(depuis, k);
      const n2 = nomsJourSacre(suivant, t);
      if (n2.length === 0) break;
      dernier = suivant;
      for (const x of n2) if (!tousNoms.includes(x)) tousNoms.push(x);
      k++;
    }
    const veille = ajouterJours(jour, -1);
    const debutUtc = coucherSoleilUtc(veille, t) - (cal.allumageMinutesAvantCoucher + cal.margeAvantMinutes) * 60000;
    const finUtc = coucherSoleilUtc(dernier, t) + (cal.havdalaMinutesApresCoucher + cal.margeApresMinutes) * 60000;
    resultat.push(periode(debutUtc, finUtc, tousNoms.join(" + "), "chabbat_fete"));
    i = k;
  }
  for (const f of cal.fermeturesExceptionnelles) {
    const [d1, h1] = f.debut.split("T");
    const [d2, h2] = f.fin.split("T");
    const p = { ...periode(localVersUtc(d1, h1), localVersUtc(d2, h2), f.motif || "Fermeture exceptionnelle", "exceptionnelle") };
    if (f.portee === "moi") p.seulementRebecca = true; // J4b : « seulement moi » (le reste de l'equipe reste reservable)
    resultat.push(p);
  }
  // Creneaux personnels recurrents (chaque semaine), leves les jours libres et pendant les vacances scolaires
  for (let i = -1; i <= nbJours + 1; i++) {
    const jour = ajouterJours(depuis, i);
    const [a, m, j] = jour.split("-").map(Number);
    const jourSemaine = new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
    const enVacances = (cal.vacancesScolaires || []).some((v) => v.actif !== false && jour >= v.debut && jour <= v.fin);
    if (!(cal.joursLibres || []).includes(jour) && !enVacances) {
      for (const c of cal.creneauxPersonnels || []) {
        if (!c.jours.includes(jourSemaine)) continue;
        resultat.push(periode(localVersUtc(jour, c.debut), localVersUtc(jour, c.fin), c.motif || "Créneau déjà réservé", "personnel"));
      }
    }
    for (const c of cal.creneauxPonctuels || []) {
      if (c.date !== jour) continue;
      resultat.push(periode(localVersUtc(jour, c.debut), localVersUtc(jour, c.fin), c.motif || "Créneau déjà réservé", "personnel"));
    }
  }
  return resultat.sort((a, b) => a.debutUtc - b.debutUtc);
}

/* ---------- « Si l'un de nous est libre » (Lot J, J4b, 9 nov. 2026) ----------
 t.calendrier.equipe : les AUTRES membres actifs (Rebecca exceptee), lus en public sans motif :
   [{ id, services: [...], indispos: [{ debut: "AAAA-MM-JJTHH:MM", fin }] }]
 Liste vide (ou absente) = Rebecca seule : tout se passe exactement comme avant.
 Chabbat, fetes et fermetures « toute l'equipe » : fermes pour tous.
 Creneaux fixes de Rebecca (ecole...) et fermetures « seulement moi » : ne bloquent que Rebecca.
 Ramassage scolaire (Rebecca, 9 nov. 2026, 20h45) : comme les autres services ; il va sur le planning du membre
 si Rebecca le lui a coche dans sa fiche. Liste gardee vide pour un futur service reserve a Rebecca. */
export const SERVICES_REBECCA_SEULE = [];

const bloqueRebeccaSeule = (p) => p.type === "personnel" || p.seulementRebecca === true;

// Un autre membre peut-il faire ce service sur [debut ; fin] ? (service absent = n'importe lequel de ses services)
export function autreMembreLibre(service, debut, fin, t = TARIFS) {
  if (service && SERVICES_REBECCA_SEULE.includes(service)) return false;
  return (t.calendrier.equipe || []).some((m) => {
    const services = Array.isArray(m.services) ? m.services : [];
    if (service ? !services.includes(service) : services.filter((x) => !SERVICES_REBECCA_SEULE.includes(x)).length === 0) return false;
    return !(m.indispos || []).some((b) => {
      if (typeof b.debut !== "string" || typeof b.fin !== "string") return false;
      const [d1, h1] = b.debut.split("T");
      const [d2, h2] = b.fin.split("T");
      return localVersUtc(d1, h1) < fin && localVersUtc(d2, h2) > debut;
    });
  });
}

// Renvoie la periode de fermeture qui chevauche [date heure ; + dureeMinutes], sinon null.
// service (facultatif) : avec une equipe, un moment ou seule Rebecca est prise reste ouvert si un autre membre est libre.
export function verifierDisponibilite(date, heure, dureeMinutes = 0, t = TARIFS, service = null) {
  const debut = localVersUtc(date, heure);
  const fin = Math.max(debut + dureeMinutes * 60000, debut + 1);
  const touchees = periodesFermees(date, 1, t).filter((p) => p.debutUtc < fin && p.finUtc > debut);
  const pourTous = touchees.find((p) => !bloqueRebeccaSeule(p));
  if (pourTous) return pourTous;
  if (touchees.length === 0) return null;
  return autreMembreLibre(service, debut, fin, t) ? null : touchees[0];
}

// "Prochaines periodes d'indisponibilite" a afficher au client et a Rebecca
export function prochainesFermetures(depuis, nombre = 5, t = TARIFS) {
  const maintenant = localVersUtc(depuis, "00:00");
  const trouvees = [];
  for (let decalage = 0; decalage < 400 && trouvees.length < nombre; decalage += 30) {
    for (const p of periodesFermees(ajouterJours(depuis, decalage), 30, t)) {
      if (p.type === "personnel") continue; // les creneaux personnels ne s'affichent pas dans les annonces
      if (p.seulementRebecca && (t.calendrier.equipe || []).length) continue; // J4b : le reste de l'equipe travaille
      if (p.finUtc > maintenant && !trouvees.some((x) => x.debutUtc === p.debutUtc)) trouvees.push(p);
    }
  }
  return trouvees.sort((a, b) => a.debutUtc - b.debutUtc).slice(0, nombre);
}

// Jours de Hol Hamoed (Souccot et Pessah) a decider par Rebecca : ouverts par defaut,
// signales dans l'admin pour qu'elle les ferme ou non (un jour de Chabbat est deja ferme).
export function joursADecider(depuis, nbJours = 60, t = TARIFS) {
  if (!t.calendrier.holHamoed.decisionParJour) return [];
  const jours = [];
  for (let i = 0; i <= nbJours; i++) {
    const date = ajouterJours(depuis, i);
    const h = dateHebraique(date);
    const souccot = h.mois === "Tishri" && h.jour >= 16 && h.jour <= 21;
    const pessah = h.mois === "Nisan" && h.jour >= 16 && h.jour <= 20;
    if (!souccot && !pessah) continue;
    if (nomsJourSacre(date, t).includes("Chabbat")) continue;
    jours.push({ date, nom: souccot ? "Hol Hamoed Souccot" : "Hol Hamoed Pessah" });
  }
  return jours;
}
