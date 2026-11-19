// TRAFIC REEL CHAQUE MATIN (17 nov. 2026) - regles pures - Rebecca Services
// Waze ne laisse pas d'autres applications lire ses temps de trajet : on utilise le trafic reel de Google
// (Routes API, avec la cle Google deja enregistree par Rebecca). A la premiere ouverture de sa journee, chaque matin,
// chaque trajet de la journee est recalcule avec le trafic prevu a son heure de depart : duree reelle et heure
// de depart conseillee (avec 5 minutes de marge). Garde en memoire pour la journee ; bouton « Actualiser ».
import { trajetACalculer } from "../services.js";
import { kmEntre, MIN_PAR_KM } from "./coursesGroupees.js";

export const MARGE_MIN = 5;

const aPosition = (a) => !!a && Number.isFinite(a.lat) && Number.isFinite(a.lon);
const memeLieu = (a, b) => aPosition(a) && aPosition(b) && Math.abs(a.lat - b.lat) < 0.0003 && Math.abs(a.lon - b.lon) < 0.0003;
export const enHeure = (min) => {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
};

// Trajets de la journee : de la maison (ou de l'etape precedente) jusqu'a chaque etape qui a une adresse.
// fil = etapes de « ma journee » (min = heure en minutes, adresse = { label, lat, lon }, lieu = nom).
export function trajetsDuJour(fil = [], domicile = null, maintenantMin = 0) {
  let precedent = aPosition(domicile) ? { adresse: domicile, nom: "Maison", min: null } : null;
  const sortie = [];
  for (const e of [...fil].sort((a, b) => a.min - b.min)) {
    if (e.genre === "maison" && aPosition(domicile)) {
      // 19 nov. 2026 : apres une course ou une tache, « Partir de la maison » suppose d'y etre rentree -> trajet de retour
      if (precedent && !memeLieu(precedent.adresse, domicile)) {
        // 19 nov. 2026 (Rebecca : « Herzl → Maison, arrivée 13h56, quel rapport ? ») : on rentre JUSTE APRES l'etape
        // precedente (et pas a l'heure ou on repart de la maison)
        const route = Math.max(5, Math.round(kmEntre(precedent.adresse, domicile) * MIN_PAR_KM));
        const arrivee = precedent.min != null ? Math.min(e.min, precedent.min + route) : e.min;
        sortie.push({ de: precedent.adresse, nomDe: precedent.nom, vers: domicile, nomVers: "Maison", arriveeMin: arrivee, quoi: "Retour à la maison" });
      }
      precedent = { adresse: domicile, nom: "Maison", min: e.min };
      continue;
    }
    const a = e.adresse;
    if (!aPosition(a) || !["arret", "tache"].includes(e.genre)) continue;
    if (precedent && !memeLieu(precedent.adresse, a)) {
      sortie.push({ de: precedent.adresse, nomDe: precedent.nom, vers: a, nomVers: e.lieu || String(a.label || "").split(",")[0], arriveeMin: e.min, quoi: e.texte || "" });
    }
    precedent = { adresse: a, nom: e.lieu || String(a.label || "").split(",")[0], min: e.min };
  }
  return sortie.filter((t) => t.arriveeMin >= maintenantMin);
}

// 19 nov. 2026 (Rebecca : « le trafic ne se met pas à jour avec les nouvelles courses ») : les courses acceptees
// du jour (site ou « + Ajouter une course ») entrent dans le trafic. Une course = 2 etapes : recuperation a son heure,
// depot a l'heure estimee (distance x 2 min/km, 5 min minimum). Course sans adresse precise : ignoree.
const enMin = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const nomCourt = (a) => String((a && a.label) || "").split(",")[0];
export function etapesCourses(courses = []) {
  const sortie = [];
  for (const d of courses) {
    // 19 nov. 2026 : une course deja terminee ne compte plus dans le trafic
    if (!d || d.statut === "en attente" || d.statut === "refusee" || d.statut === "annulee" || d.statut === "terminee") continue;
    if (d.service === "ramassage") continue; // deja dans la tournee
    const t = trajetACalculer(d.service, d.details || {});
    const debut = enMin(d.heure);
    if (!t || debut == null) continue;
    const [de, vers] = d.estRetour ? [t.arrivee, t.depart] : [t.depart, t.arrivee];
    if (!aPosition(de) || !aPosition(vers)) continue;
    const duree = Math.max(5, Math.round(kmEntre(de, vers) * MIN_PAR_KM));
    const qui = d.nom ? ` (${d.nom})` : "";
    sortie.push({ min: debut, genre: "arret", adresse: de, lieu: nomCourt(de), texte: `Récupérer${qui}` });
    sortie.push({ min: debut + duree, genre: "arret", adresse: vers, lieu: nomCourt(vers), texte: `Déposer${qui}` });
  }
  return sortie;
}

// Heure de depart conseillee : arrivee - duree avec le trafic - marge
export function departConseille(arriveeMin, secondesTrafic, marge = MARGE_MIN) {
  return arriveeMin - Math.ceil((secondesTrafic || 0) / 60) - marge;
}

// Date et heure (Israel) -> ISO pour Google, en tenant compte de l'heure d'ete
export function departIso(date, minute) {
  const [a, m, j] = date.split("-").map(Number);
  const approx = new Date(Date.UTC(a, m - 1, j, Math.floor(minute / 60), minute % 60));
  const israel = new Date(approx.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const utc = new Date(approx.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(approx.getTime() - (israel - utc)).toISOString();
}

// « 1234s » (reponse Google) -> secondes
export const secondes = (t) => {
  const n = parseFloat(String(t || "").replace("s", ""));
  return Number.isFinite(n) ? n : 0;
};
