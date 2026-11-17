// PARTS FAITES D'UNE COURSE (17 nov. 2026, 14h24) - Rebecca Services
// Un aller-retour compte dans le chiffre d'affaires trajet par trajet :
//   l'aller (moitie du prix) le jour de l'aller des qu'il est fait (allerFaitA), le retour (l'autre moitie)
//   le jour du retour quand il est fait (demande « terminee »). Le paiement d'avance reste dans « Encaisse ».
// Autres courses : tout le prix, a la date de la course, quand elle est terminee.
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
export const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
const estAR = (d) => !!(d && d.details && d.details.typeTrajet === "ar");

// [{ date, montant, trajet }] des trajets faits
export function partsFaites(d) {
  if (!d) return [];
  const prix = prixDe(d);
  if (!estAR(d)) return d.statut === "terminee" ? [{ date: d.date, montant: prix, trajet: "simple" }] : [];
  const moitie = cents(prix / 2);
  const res = [];
  if (d.statut === "terminee" || (d.statut === "acceptee" && d.allerFaitA)) res.push({ date: d.date, montant: moitie, trajet: "aller" });
  if (d.statut === "terminee") {
    const v = d.details || {};
    res.push({ date: DATE_OK.test(v.dateRetour || "") ? v.dateRetour : d.date, montant: cents(prix - moitie), trajet: "retour" });
  }
  return res;
}
// Parts faites dans une periode { debut, fin } (inclus) ; sans periode : toutes
export const partsDans = (d, periode) => partsFaites(d).filter((p) => !periode || (p.date >= periode.debut && p.date <= periode.fin));
export const faitDansPeriode = (d, periode) => partsDans(d, periode).length > 0;
export const montantFait = (d, periode = null) => cents(partsDans(d, periode).reduce((s, p) => s + p.montant, 0));
