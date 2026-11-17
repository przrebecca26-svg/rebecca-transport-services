// PARTS FAITES D'UNE COURSE (17 nov. 2026) - Rebecca Services
// 14h24 : un aller-retour compte trajet par trajet : l'aller le jour de l'aller des qu'il est fait (allerFaitA),
//         le retour le jour du retour quand il est fait (« terminee »). Le paiement d'avance reste dans l'argent recu.
// 14h27 : prix de l'aller et du retour d'apres le detail du devis (ex. 250 / 260 avec un bagage au retour).
// 14h29 : trois chiffres separes — courses (prix de base), supplements et ajouts / deductions, pourboires.
//   Supplements = lignes du devis : bagages, passagers / enfants en plus, etages sans ascenseur, nuit, urgence,
//   attente, peages, arrets... ; ajout / deduction = montant saisi par Rebecca a l'encaissement (d.ajustement, + ou -).
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const nb = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
export const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
const estAR = (d) => !!(d && d.details && d.details.typeTrajet === "ar");

export const EST_SUPPLEMENT = /(bagage|en plus|passager|étage|etage|ascenseur|nuit|urgence|attente|péage|peage|stationnement|supplément|supplement|arrêt|arret|déplacement|deplacement|option|monte-charge|démontage|demontage|emballage)/i;

// Lecture du detail du devis : montants par trajet (aller / retour / commun) et par genre (base / supplement)
export function lireDetail(d) {
  const texte = String(((d && d.details) || {}).detailDevis || "");
  const r = { aller: { base: 0, supp: 0 }, retour: { base: 0, supp: 0 }, commun: { base: 0, supp: 0 }, lu: false };
  const i = texte.indexOf("Détail du tarif");
  if (i < 0) return r;
  for (const ligne of texte.slice(i).split("\n")) {
    if (/hors prestation/i.test(ligne)) continue;
    const m = /:\s*(-?\d+(?:[.,]\d+)?)\s*₪\s*$/.exec(ligne);
    if (!m) continue;
    const montant = Number(m[1].replace(",", "."));
    const libelle = ligne.slice(0, m.index);
    const ou = /retour/i.test(libelle) && !/aller-retour/i.test(libelle) ? "retour" : /aller(?!-retour)/i.test(libelle) && !/aller simple/i.test(libelle) ? "aller" : "commun";
    const genre = EST_SUPPLEMENT.test(libelle) ? "supp" : "base";
    r[ou][genre] += montant;
    r.lu = true;
  }
  return r;
}
const somme = (x) => x.base + x.supp;

// Part de l'aller dans le prix d'un aller-retour (sans detail lisible : moitie-moitie)
export function partAller(d) {
  const prix = prixDe(d);
  const l = lireDetail(d);
  const aller = somme(l.aller);
  const retour = somme(l.retour);
  const total = aller + retour + somme(l.commun);
  if (!(total > 0) || !(aller > 0) || !(retour > 0)) return cents(prix / 2);
  return cents((prix * (aller + somme(l.commun) / 2)) / total);
}

// Supplements compris dans un montant de trajet (au prorata du detail, ramene au prix final)
function supplementDe(d, trajet, montant) {
  const l = lireDetail(d);
  const total = somme(l.aller) + somme(l.retour) + somme(l.commun);
  if (!(total > 0) || !(montant > 0)) return 0;
  const supp = trajet === "simple" ? l.aller.supp + l.retour.supp + l.commun.supp : l[trajet].supp + l.commun.supp / 2;
  const part = trajet === "simple" ? total : somme(l[trajet]) + somme(l.commun) / 2;
  if (!(part > 0)) return 0;
  return cents(Math.min(montant, Math.max(0, (montant * supp) / part)));
}

// [{ date, montant, base, supplement, trajet }] des trajets faits
export function partsFaites(d) {
  if (!d) return [];
  const prix = prixDe(d);
  const part = (date, montant, trajet) => {
    const supplement = supplementDe(d, trajet, montant);
    return { date, montant, base: cents(montant - supplement), supplement, trajet };
  };
  if (!estAR(d)) return d.statut === "terminee" ? [part(d.date, prix, "simple")] : [];
  const aller = partAller(d);
  const res = [];
  if (d.statut === "terminee" || (d.statut === "acceptee" && d.allerFaitA)) res.push(part(d.date, aller, "aller"));
  if (d.statut === "terminee") {
    const v = d.details || {};
    res.push(part(DATE_OK.test(v.dateRetour || "") ? v.dateRetour : d.date, cents(prix - aller), "retour"));
  }
  return res;
}
export const partsDans = (d, periode) => partsFaites(d).filter((p) => !periode || (p.date >= periode.debut && p.date <= periode.fin));
export const faitDansPeriode = (d, periode) => partsDans(d, periode).length > 0;

// Ajout / deduction et pourboire : comptes le jour du premier trajet fait (ou le jour de la saisie, s'il est connu)
const premierJour = (d) => {
  const p = partsFaites(d);
  return p.length ? p[0].date : "";
};
export const ajustementDe = (d) => cents(nb(d && d.ajustement));
const jourAjustement = (d) => (DATE_OK.test((d && d.ajustementLe) || "") ? d.ajustementLe : premierJour(d));
const dansP = (date, periode) => !!date && (!periode || (date >= periode.debut && date <= periode.fin));

// Total du par la cliente pour ce qui est fait = trajets faits + ajout / deduction (sans pourboire)
export const montantFait = (d, periode = null) =>
  cents(partsDans(d, periode).reduce((s, p) => s + p.montant, 0) + (faitDansPeriode(d, null) && dansP(jourAjustement(d), periode) ? ajustementDe(d) : 0));

// Les trois chiffres d'une liste de demandes sur une periode
export function chiffresSepares(demandes, periode) {
  let base = 0;
  let supplements = 0;
  let ajustements = 0;
  let pourboires = 0;
  let nbParts = 0;
  for (const d of demandes || []) {
    const parts = partsDans(d, periode);
    nbParts += parts.length;
    for (const p of parts) {
      base += p.base;
      supplements += p.supplement;
    }
    if (!faitDansPeriode(d, null)) continue;
    if (dansP(jourAjustement(d), periode)) ajustements += ajustementDe(d);
    if (dansP(premierJour(d), periode)) pourboires += nb(d.pourboire);
  }
  return { base: cents(base), supplements: cents(supplements), ajustements: cents(ajustements), pourboires: cents(pourboires), nbParts };
}
