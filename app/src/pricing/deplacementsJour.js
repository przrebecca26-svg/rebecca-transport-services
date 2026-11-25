// DEPLACEMENTS DE MA JOURNEE : PRO ET PERSO (25 nov. 2026, 22h30) - regles pures, testees dans tests/deplacementsJour.test.mjs
// Rebecca : « calculer les trajets dans l'ordre, le pro passe avant le privé, distinguer les déplacements personnels
// des professionnels sans compter deux fois les kilomètres communs ».
//  - Les étapes de la journée (courses, tournée, tâches, trajets personnels) sont reliées dans l'ordre des heures.
//  - Chaque trajet est compté UNE seule fois : il est « pro » s'il mène à une étape de cliente (récupérer, déposer,
//    tournée scolaire) ou s'il ramène à la maison juste après une cliente ; sinon il est « perso ».
//  - Quand une personne est avec moi pendant une course, ces km restent pro (ils auraient été faits de toute façon).
//  - Distances : kmEntre (vol d'oiseau déjà multiplié par le facteur route des courses groupées) ; temps : 2 min/km en ville jusqu'à 5 km, puis 1 min/km (route).
// Ce sont des estimations ; le trafic réel de Google reste dans « Trafic » (vue Jour, aujourd'hui).
import { kmEntre } from "./coursesGroupees.js";
import { dureeSelonHeure } from "./circulation.js";
import { TARIFS } from "./config.js";

const ok = (a) => !!a && Number.isFinite(a.lat) && Number.isFinite(a.lon);
const memeLieu = (a, b) => ok(a) && ok(b) && Math.abs(a.lat - b.lat) < 0.0008 && Math.abs(a.lon - b.lon) < 0.0008;
const cents = (x) => Math.round(x * 100) / 100;
export const kmRoute = (a, b) => (ok(a) && ok(b) ? cents(kmEntre(a, b)) : 0);
export function minutesSansTrafic(km) {
  const k = Number(km) || 0;
  if (k <= 0) return 0;
  return Math.max(3, Math.round(k <= 5 ? k * 2 : 10 + (k - 5)));
}
// Temps de route estimé à une heure donnée (heures de pointe : Réglages → Circulation)
export function minutesRoute(a, b, date = "", minute = null, t = TARIFS) {
  const base = minutesSansTrafic(kmRoute(a, b));
  if (!base || !date || minute == null) return base;
  const h = `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const r = dureeSelonHeure(base, date, h, t);
  return r ? r.minutes : base;
}

// Une étape est-elle professionnelle ? (course d'une cliente ou tournée scolaire)
export const etapePro = (e) => !!e && !e.perso && (e.genre === "arret" || !!e.demandeId);

// etapes = fil de la journée (min, adresse, genre, perso, demandeId, texte) ; domicile = la maison
export function trajetsProPerso(etapes = [], domicile = null) {
  const l = [...etapes].filter((e) => e && Number.isFinite(e.min)).sort((a, b) => a.min - b.min);
  const sortie = [];
  let prec = ok(domicile) ? { adresse: domicile, pro: false, nom: "Maison" } : null;
  for (const e of l) {
    const a = ok(e.adresse) ? e.adresse : e.genre === "maison" && ok(domicile) ? domicile : null;
    if (!a) continue;
    const versMaison = e.genre === "maison" || (ok(domicile) && memeLieu(a, domicile));
    // retour à la maison juste après une cliente = pro (retour à vide) ; sinon selon l'étape d'arrivée
    const pro = versMaison ? !!(prec && prec.pro) : etapePro(e);
    if (prec && !memeLieu(prec.adresse, a)) {
      const km = kmRoute(prec.adresse, a);
      sortie.push({ de: prec.nom, vers: e.lieu || String(a.label || "").split(",")[0], km, minutes: minutesSansTrafic(km), pro, arriveeMin: e.min, texte: e.texte || "" });
    }
    prec = { adresse: a, pro: versMaison ? false : etapePro(e), nom: versMaison ? "Maison" : e.lieu || String(a.label || "").split(",")[0] };
  }
  return sortie;
}

// Bilan estimé de la journée : km pro / perso, coût (essence + usure), chiffre d'affaires pro, gain par heure.
// ca = chiffre d'affaires des courses du jour (chaque trajet d'un aller-retour à son prix, le jour où il est fait)
export function bilanJournee(etapes = [], domicile = null, { ca = 0, t = TARIFS } = {}) {
  const trajets = trajetsProPerso(etapes, domicile);
  const coutKm = (t.rentabilite && t.rentabilite.coutKmReel) || 1.2;
  const conso = t.carburant ? (t.carburant.consommationLitres100km / 100) * t.carburant.prixLitre : 0;
  const somme = (pro, k) => cents(trajets.filter((x) => x.pro === pro).reduce((s, x) => s + x[k], 0));
  const kmPro = somme(true, "km");
  const kmPerso = somme(false, "km");
  const minPro = somme(true, "minutes") + 10 * etapes.filter((e) => etapePro(e)).length; // + 10 min sur place par arrêt
  const coutPro = Math.round(kmPro * coutKm);
  const gain = Math.round((Number(ca) || 0) - coutPro);
  return {
    trajets,
    kmPro: Math.round(kmPro),
    kmPerso: Math.round(kmPerso),
    kmTotal: Math.round(kmPro + kmPerso),
    essencePro: Math.round(kmPro * conso),
    essencePerso: Math.round(kmPerso * conso),
    coutPro,
    coutPerso: Math.round(kmPerso * coutKm),
    usurePro: Math.max(0, coutPro - Math.round(kmPro * conso)),
    ca: Math.round(Number(ca) || 0),
    gain,
    minutesPro: Math.round(minPro),
    gainParHeure: minPro > 0 && ca > 0 ? Math.round((gain * 60) / minPro) : null,
  };
}

// Alertes « pro avant perso » : une étape perso qui empêche d'arriver à l'heure à l'étape pro suivante
export function alertesPerso(etapes = [], date = "", t = TARIFS) {
  const l = [...etapes].filter((e) => e && Number.isFinite(e.min) && ok(e.adresse)).sort((a, b) => a.min - b.min);
  const alertes = [];
  for (let i = 0; i < l.length - 1; i++) {
    const e = l[i];
    if (!e.perso) continue;
    const suivante = l.slice(i + 1).find((x) => etapePro(x));
    if (!suivante) continue;
    const fin = finEtape(e);
    const route = minutesRoute(e.adresse, suivante.adresse, date, fin, t);
    const marge = 10;
    const retard = fin + route + marge - suivante.min;
    if (retard > 0) alertes.push({ cle: e.cle || e.texte, texte: `⚠️ ${e.texte} : pars au plus tard à ${hm(suivante.min - route - marge)} pour « ${suivante.texte} » (${route} min de route + ${marge} min de marge).` });
  }
  return alertes;
}
const hm = (m) => `${String(Math.floor(Math.max(0, m) / 60) % 24).padStart(2, "0")}h${String(Math.max(0, m) % 60).padStart(2, "0")}`;
function finEtape(e) {
  const m = /^(\d{1,2})[h:](\d{2})$/.exec(String(e.jusqua || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : e.min;
}

// Heure de départ conseillée pour chaque étape (estimation, sans Google) : arrivée - route - marge,
// jamais avant la fin de l'étape précédente. Pour les notifications du robot.
export function departsEstimes(etapes = [], domicile = null, date = "", marge = 10, t = TARIFS) {
  const l = [...etapes].filter((e) => e && Number.isFinite(e.min)).sort((a, b) => a.min - b.min);
  let prec = ok(domicile) ? { adresse: domicile, fin: null } : null;
  const sortie = [];
  for (const e of l) {
    if (!ok(e.adresse)) continue;
    if (prec && !memeLieu(prec.adresse, e.adresse)) {
      const route = minutesRoute(prec.adresse, e.adresse, date, e.min - 30, t);
      let partir = e.min - route - marge;
      if (prec.fin != null && partir < prec.fin) partir = prec.fin;
      sortie.push({ id: e.id || e.cle || "", partir, arriveeMin: e.min, route, texte: e.texte || "" });
    }
    prec = { adresse: e.adresse, fin: finEtape(e) };
  }
  return sortie;
}
