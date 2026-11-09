// AGENDA COMMUN ET CRENEAUX DE RENDEZ-VOUS (Lot C, seance C3, 9 nov. 2026) - regles pures - Rebecca Services
// Regles validees (4 nov.) : beaute dimanche-jeudi 9 h-18 h (modifiable par activite), un rendez-vous peut finir
// apres l'heure de fermeture, temps entre deux clientes (20 min par defaut, modifiable), Chabbat, fetes,
// fermetures et creneaux personnels (ecole) bloquent tout. Une case grise ne dit jamais pourquoi.
// Blocage global : ce qui occupe Rebecca (course, rendez-vous, commande a livrer) grise toutes ses activites.
// Liste publique : creneauxOccupes/{id} = { debut, fin, personne } (heures locales Israel), sans nom ni activite.

import { TARIFS } from "./config.js";
import { localVersUtc, verifierDisponibilite } from "./calendrier.js";
import { blocsPourDate, datesDe } from "./enchainement.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MIN = 60000;

const enMinutes = (h) => (HEURE_OK.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
const enHeure = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

// Un bloc occupe public valide ?
export const blocValide = (b) => !!b && typeof b.debut === "string" && typeof b.fin === "string" && FORMAT.test(b.debut) && FORMAT.test(b.fin) && b.fin > b.debut;

// Bloc en millisecondes UTC
const versUtc = (b) => {
  const [d1, h1] = b.debut.split("T");
  const [d2, h2] = b.fin.split("T");
  return { debutUtc: localVersUtc(d1, h1), finUtc: localVersUtc(d2, h2) };
};

/**
 * Creneaux proposes a une cliente pour une prestation un jour donne.
 * activite : fiche effective (jours, debut, fin, margeMinutes) ; dureeMinutes : duree de la prestation ;
 * occupes : blocs publics { debut, fin } ; pas : intervalle entre deux heures proposees (minutes).
 * service : identifiant de l'activite pour le calendrier d'equipe (beaute = planning de Rebecca seule).
 * Renvoie [{ heure, libre }] ; jour ferme = liste vide.
 */
export function creneauxDuJour({ activite, dureeMinutes, date, occupes = [], pas = 15, maintenantMs = null, t = TARIFS, service = null }) {
  if (!activite || !DATE_OK.test(date || "") || !(dureeMinutes > 0)) return [];
  if (!(activite.jours || []).includes(jourSemaine(date))) return [];
  const ouverture = enMinutes(activite.debut);
  const fermeture = enMinutes(activite.fin);
  if (ouverture == null || fermeture == null || fermeture <= ouverture) return [];
  const marge = Math.max(0, Number(activite.margeMinutes) || 0);
  const blocs = occupes.filter(blocValide).map(versUtc);
  const res = [];
  for (let m = ouverture; m < fermeture; m += pas) {
    const heure = enHeure(m);
    const debut = localVersUtc(date, heure);
    const fin = debut + dureeMinutes * MIN;
    let libre = maintenantMs == null || debut > maintenantMs;
    // Chabbat, fetes, fermetures, creneaux personnels (la beaute suit le planning de Rebecca)
    if (libre && verifierDisponibilite(date, heure, dureeMinutes, t, service || activite.id || "beaute")) libre = false;
    // Autres occupations de Rebecca + temps entre deux clientes (avant et apres)
    if (libre && blocs.some((b) => debut < b.finUtc + marge * MIN && fin + marge * MIN > b.debutUtc)) libre = false;
    res.push({ heure, libre });
  }
  return res;
}

// Premiers creneaux libres sur plusieurs jours (pour « prochaine disponibilite »)
export function prochainsCreneaux({ jours = [], nombre = 3, ...reste }) {
  const r = [];
  for (const date of jours) {
    for (const c of creneauxDuJour({ ...reste, date })) {
      if (c.libre) r.push({ date, heure: c.heure });
      if (r.length >= nombre) return r;
    }
  }
  return r;
}

/* ---------- Ce qui occupe Rebecca (pour la liste publique) ---------- */

const ACTIVES = ["acceptee", "confirmee", "acceptée", "confirmée"];

// Blocs publics a partir des courses de Rebecca acceptees (Jeremy ne bloque pas les rendez-vous de Rebecca).
// Sans nom, sans service, sans adresse. Seulement a partir d'aujourd'hui.
export function blocsDesCourses(demandes = [], { personne = "rebecca", depuis = "0000-00-00" } = {}) {
  const res = [];
  for (const d of demandes) {
    if (!ACTIVES.includes(d.statut)) continue;
    if ((d.attribueA || "rebecca") !== personne) continue;
    for (const date of datesDe(d)) {
      if (date < depuis) continue;
      for (const b of blocsPourDate(d, date)) {
        if (!(b.fin > b.debut)) continue;
        const fin = Math.min(b.fin, 24 * 60 - 1);
        res.push({ id: `${d.id}-${date}-${b.partie || "a"}`, debut: `${date}T${enHeure(b.debut)}`, fin: `${date}T${enHeure(fin)}`, personne });
      }
    }
  }
  return res;
}

// Difference entre ce qui doit etre publie et ce qui l'est : { aEcrire, aSupprimer }
export function synchroniser(voulus = [], existants = []) {
  const parId = new Map(existants.map((x) => [x.id, x]));
  const ids = new Set(voulus.map((x) => x.id));
  const aEcrire = voulus.filter((v) => {
    const e = parId.get(v.id);
    return !e || e.debut !== v.debut || e.fin !== v.fin || e.personne !== v.personne;
  });
  const aSupprimer = existants.filter((e) => !ids.has(e.id) && e.source !== "rendezvous").map((e) => e.id);
  return { aEcrire, aSupprimer };
}
