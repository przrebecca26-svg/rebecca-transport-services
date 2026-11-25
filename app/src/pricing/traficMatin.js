// TRAFIC REEL CHAQUE MATIN (17 nov. 2026) - regles pures - Rebecca Services
// Waze ne laisse pas d'autres applications lire ses temps de trajet : on utilise le trafic reel de Google
// (Routes API, avec la cle Google deja enregistree par Rebecca). A la premiere ouverture de sa journee, chaque matin,
// chaque trajet de la journee est recalcule avec le trafic prevu a son heure de depart : duree reelle et heure
// de depart conseillee (avec 5 minutes de marge). Garde en memoire pour la journee ; bouton « Actualiser ».
import { trajetACalculer } from "../services.js";
import { kmEntre, MIN_PAR_KM } from "./coursesGroupees.js";

export const MARGE_MIN = 5;

const aPosition = (a) => !!a && Number.isFinite(a.lat) && Number.isFinite(a.lon);
const memeLieu = (a, b) => aPosition(a) && aPosition(b) && Math.abs(a.lat - b.lat) < 0.0008 && Math.abs(a.lon - b.lon) < 0.0008; // 20 nov. 2026 : ~80 m (n° 4 et n° 5 Amnon Lipkin = même arrêt)
export const enHeure = (min) => {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
};

// Trajets de la journee : de la maison (ou de l'etape precedente) jusqu'a chaque etape qui a une adresse.
// fil = etapes de « ma journee » (min = heure en minutes, adresse = { label, lat, lon }, lieu = nom).
const enMinutes = (h) => {
  const m = /^(\d{1,2})[h:](\d{2})$/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const apres = (p) => (p && p.finMin != null ? { apresMin: p.finMin, apresQuoi: p.finQuoi || "" } : {});
const cleDe = (e) => e.cle || `${e.genre}@${e.texte || ""}@${e.lieu || ""}`;
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
        // 25 nov. 2026 (Rebecca : vétérinaire 16h-17h30, « ça me dit que je vais être en retard ») : on rentre après
        // la FIN de la tâche (créneau réservé), pas après son début
        const base = precedent.finMin != null ? precedent.finMin : precedent.min;
        const arrivee = base != null ? Math.min(e.min, base + route) : e.min;
        // 19 nov. 2026, 14h33 : le retour est fait des que l'etape d'apres (ou la maison) est cochee
        sortie.push({ de: precedent.adresse, nomDe: precedent.nom, vers: domicile, nomVers: "Maison", arriveeMin: arrivee, quoi: "Retour à la maison", cle: "maison>" + (precedent.cle || ""), fait: !!e.fait, ...apres(precedent) });
      }
      // une tache a la maison juste avant garde sa fin (on ne repart pas avant d'avoir fini)
      precedent = { adresse: domicile, nom: "Maison", min: e.min, cle: "maison@" + e.min, ...(precedent && memeLieu(precedent.adresse, domicile) && precedent.finMin != null ? { finMin: precedent.finMin, finQuoi: precedent.finQuoi } : {}) };
      continue;
    }
    // 19 nov. 2026, 15h09 (Rebecca : « si j'ai rien mis, je suis à la maison ») : une tâche sans adresse = à la maison
    const a = aPosition(e.adresse) ? e.adresse : e.genre === "tache" && aPosition(domicile) ? domicile : null;
    if (!aPosition(a) || !["arret", "tache"].includes(e.genre)) continue;
    const nomIci = aPosition(domicile) && memeLieu(a, domicile) ? "Maison" : e.lieu || String(a.label || "").split(",")[0];
    if (precedent && !memeLieu(precedent.adresse, a)) {
      // 19 nov. 2026, 14h33 (Rebecca : « quand une course est validée, elle doit disparaître ») : trajet fait = etape cochee
      sortie.push({ de: precedent.adresse, nomDe: precedent.nom, vers: a, nomVers: nomIci, arriveeMin: e.min, quoi: e.texte || "", cle: cleDe(e), fait: !!e.fait, ...apres(precedent) });
    }
    // un retour a la maison deja passe se voit aussi a l'etape suivante cochee
    if (e.fait) for (const t of sortie) if (t.quoi === "Retour à la maison") t.fait = true;
    // 19 nov. 2026, 15h05 : une tache (« sortir le chien » a la maison) occupe le lieu jusqu'a sa fin
    // 25 nov. 2026 (Rebecca : « si je finis avant, je pars et ça doit recalculer ») : tâche cochée « Fait » = finie maintenant
    const finTache = e.genre === "tache" ? (e.fait ? Math.max(e.min, maintenantMin) : enMinutes(e.jusqua)) : null;
    precedent = { adresse: a, nom: nomIci, min: e.min, cle: cleDe(e), ...(finTache != null && finTache > e.min ? { finMin: finTache, finQuoi: e.texte || "" } : {}) };
    // tache a la maison : la maison reste le point de depart, la tache garde sa fin
    if (e.genre === "tache" && aPosition(domicile) && memeLieu(a, domicile)) precedent.nom = "Maison";
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
const estAR = (d) => ((d && d.details) || {}).typeTrajet === "ar";
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
    // 19 nov. 2026, 14h33 : « 📍 Récupérée » / « ✓ Déposée » cochés -> le trajet sort du trafic
    const c = ((d.chrono || {})[d.estRetour ? "retour" : estAR(d) ? "aller" : "simple"]) || {};
    const id = "c:" + d.id + (d.estRetour ? "-r" : "");
    // 19 nov. 2026, 15h42 : de quoi prévenir la cliente d'un retard et cocher « Tu es arrivée ? »
    const plus = { demandeId: d.id, tel: d.telephone || "", nom: d.nom || "", partie: !!(c.depart || c.arrivee || c.prise || c.depose) };
    sortie.push({ min: debut, genre: "arret", adresse: de, lieu: nomCourt(de), texte: `Récupérer${qui}`, cle: id + ":prise", fait: !!(c.prise || c.depose), sorte: "prise", ...plus });
    sortie.push({ min: debut + duree, genre: "arret", adresse: vers, lieu: nomCourt(vers), texte: `Déposer${qui}`, cle: id + ":depose", fait: !!c.depose, sorte: "depose", ...plus });
  }
  return sortie;
}

// Heure de depart conseillee : arrivee - duree avec le trafic - marge
export function departConseille(arriveeMin, secondesTrafic, marge = MARGE_MIN) {
  return arriveeMin - Math.ceil((secondesTrafic || 0) / 60) - marge;
}

// 22 nov. 2026, 13h24 (Rebecca, test depuis les courses) : chaque trajet était calculé à rebours depuis son heure
// d'arrivée, marge comprise, sans regarder le trajet d'avant. Résultat : « École → Alexia : partir 13h59 » alors
// qu'elle arrive à l'école à 14h00, et « Alexia → Maison : partir 14h08 » alors qu'elle arrive chez Alexia à 14h10.
// On ne peut pas partir d'un endroit avant d'y être arrivée : le départ devient au plus tôt l'arrivée précédente
// (la marge est simplement plus petite). Si même comme ça on arrive en retard, on le dit.
export function enchainerDeparts(lignes) {
  // 25 nov. 2026 : après une tâche qui a une fin (gare, vétérinaire), on part à sa fin, pas avant ; l'alerte
  // « Tu dois partir avant la fin » ne sort que si, même en partant à la fin, on arrive en retard.
  const l = [...(lignes || [])].map((x) => (x.apresMin != null && x.partir < x.apresMin ? { ...x, partir: x.apresMin, conflit: x.apresMin + (x.avec || 0) > x.arriveeMin } : x)).sort((a, b) => a.arriveeMin - b.arriveeMin);
  return l.map((x, i) => {
    const prec = l[i - 1];
    if (!prec || !(prec.arriveeMin > x.partir) || !(prec.arriveeMin < x.arriveeMin)) return x;
    const partir = prec.arriveeMin;
    const arriveeVers = partir + (x.avec || 0);
    return { ...x, partir, enchaine: true, arriveeVers, retardMin: Math.max(0, arriveeVers - x.arriveeMin) };
  });
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
