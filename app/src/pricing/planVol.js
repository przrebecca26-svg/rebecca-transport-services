// PLAN D'UNE COURSE AÉROPORT (26 nov. 2026, 9h53, Rebecca : « je mets l'heure où je la récupère, et ça calcule à quelle
// heure elle arrive là-bas, avec combien d'avance sur son vol, et l'heure de mon retour pour les filles »)
import { TARIFS } from "./config.js";
import { dureeSelonHeure } from "./circulation.js";
import { numerosPossibles, lireNumeroVol } from "./vols.js";

const enMin = (h) => {
  const m = /^(\d{2}):(\d{2})$/.exec(h || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const enHeure = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};
export const dureeFr = (min) => {
  const m = Math.abs(Math.round(min));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? " " + String(m % 60).padStart(2, "0") : ""}`;
};
export const reglagesVol = (t = TARIFS) => ({
  avance: (t.planVol && t.planVol.avanceConseillee) || 180,
  apres: (t.planVol && t.planVol.apresAtterrissage) || 30,
});

// v = valeurs du formulaire aéroport ; minutesTrajet = trajet normal (sans bouchons) adresse <-> aéroport
// -> null si l'heure de prise, l'heure du vol ou la durée manquent
export function planVol(v, minutesTrajet, t = TARIFS) {
  const prise = enMin(v && v.heure);
  const vol = enMin(v && v.heureVol);
  if (prise == null || vol == null || !(Number(minutesTrajet) > 0)) return null;
  const { avance, apres } = reglagesVol(t);
  const aller = dureeSelonHeure(minutesTrajet, v.date, v.heure, t);
  const arrivee = prise + aller.minutes;
  const retour = dureeSelonHeure(minutesTrajet, v.date, enHeure(arrivee), t);
  const fin = arrivee + retour.minutes;
  if (v.direction === "depuis") {
    // Je la récupère à l'aéroport : écart avec l'atterrissage, puis dépose
    let ecart = prise - vol;
    if (ecart < -720) ecart += 1440;
    const alerte = ecart < 0 ? "avant" : ecart < apres ? "court" : "";
    return {
      sens: "depuis", ecart, depose: enHeure(arrivee), fin: enHeure(arrivee), dureeAller: aller.minutes,
      alerte, conseil: enHeure(vol + apres),
      texte: `🛬 Atterrissage ${v.heureVol.replace(":", "h")} · tu es là ${ecart >= 0 ? `${dureeFr(ecart)} après` : `${dureeFr(ecart)} AVANT`} l'atterrissage (conseillé : ${apres} min après, pour les bagages).`,
    };
  }
  let avanceMin = vol - arrivee;
  if (avanceMin < -720) avanceMin += 1440;
  const alerte = avanceMin < 0 ? "rate" : avanceMin < avance ? "court" : "";
  return {
    sens: "vers", arrivee: enHeure(arrivee), avance: avanceMin, fin: enHeure(fin), dureeAller: aller.minutes, dureeRetour: retour.minutes,
    alerte, conseil: enHeure(vol - avance - aller.minutes),
    texte: `🛫 Arrivée à l'aéroport vers ${enHeure(arrivee).replace(":", "h")} · ${avanceMin >= 0 ? `${dureeFr(avanceMin)} avant le vol` : `${dureeFr(avanceMin)} APRÈS le vol`} (conseillé : ${dureeFr(avance)}).`,
  };
}

// Tableau de l'aéroport : le vol de ce numéro, ce jour-là, dans ce sens -> { heure, terminal, ville } ou null
export function volDuJour(lignes, texteNumero, date, direction) {
  const n = lireNumeroVol(texteNumero);
  if (!n || !Array.isArray(lignes) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const lettre = direction === "depuis" ? "A" : "D";
  const nums = numerosPossibles(n.numero);
  const l = lignes.find((x) => x && String(x.CHAORD || "").toUpperCase() === lettre && nums.includes(String(x.CHFLTN || "").trim())
    && (!n.compagnie || String(x.CHOPER || "").toUpperCase().replace(/0/g, "O") === n.compagnie.replace(/0/g, "O"))
    && String(x.CHSTOL || "").slice(0, 10) === date);
  if (!l) return null;
  const h = /[T ](\d{2}):(\d{2})/.exec(String(l.CHSTOL));
  return h ? { heure: `${h[1]}:${h[2]}`, terminal: String(l.CHTERM ?? "").trim(), ville: String(l.CHLOC1T || l.CHLOC1D || "").trim() } : null;
}

// TÂCHE « TRANSPORT / AÉROPORT » DU CALENDRIER (26 nov. 2026, 18h27, Rebecca) : je ne marque pas de créneau,
// je donne le vol et l'heure où je la prends ; le site calcule l'heure de départ de la maison, l'arrivée et le retour.
// v = { sens: "vers" | "depuis", date, heure (vers : je la prends chez elle ; depuis : je la récupère à l'aéroport), heureVol }
// d = temps de route normaux en minutes : maisonAdresse (maison -> chez elle), adresseAeroport (chez elle <-> aéroport),
//     maisonAeroport (maison <-> aéroport). Les heures de pointe sont ajoutées selon l'heure.
// -> { partir, prise, depose, retour, avance, ecart, alerte, conseil } (heures « HH:MM ») ou null
export function planTacheVol(v, d, t = TARIFS) {
  const h = enMin(v && v.heure);
  if (h == null || !d) return null;
  const route = (min, heure) => {
    const n = Number(min);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n === 0) return 0;
    const r = dureeSelonHeure(n, v.date, heure, t);
    return r ? r.minutes : null;
  };
  const { avance, apres } = reglagesVol(t);
  const vol = enMin(v.heureVol);
  if (v.sens === "vers") {
    const versElle = route(d.maisonAdresse, v.heure);
    const versAero = route(d.adresseAeroport, v.heure);
    if (versElle == null || versAero == null) return null;
    const depose = h + versAero;
    const retourAero = route(d.maisonAeroport, enHeure(depose));
    if (retourAero == null) return null;
    let avanceMin = vol == null ? null : vol - depose;
    if (avanceMin != null && avanceMin < -720) avanceMin += 1440;
    return {
      sens: "vers", partir: enHeure(h - versElle), prise: enHeure(h), depose: enHeure(depose), retour: enHeure(depose + retourAero),
      avance: avanceMin, alerte: avanceMin == null ? "" : avanceMin < 0 ? "rate" : avanceMin < avance ? "court" : "",
      conseil: vol == null ? "" : enHeure(vol - avance - versAero),
    };
  }
  const versAero = route(d.maisonAeroport, v.heure);
  const versElle = route(d.adresseAeroport, v.heure);
  if (versAero == null || versElle == null) return null;
  const depose = h + 15 + versElle; // 15 min pour la retrouver et charger les bagages
  const retour = route(d.maisonAdresse, enHeure(depose));
  if (retour == null) return null;
  let ecart = vol == null ? null : h - vol;
  if (ecart != null && ecart < -720) ecart += 1440;
  return {
    sens: "depuis", partir: enHeure(h - versAero), prise: enHeure(h), depose: enHeure(depose), retour: enHeure(depose + retour),
    ecart, alerte: ecart == null ? "" : ecart < 0 ? "avant" : ecart < apres ? "court" : "",
    conseil: vol == null ? "" : enHeure(vol + apres),
  };
}
