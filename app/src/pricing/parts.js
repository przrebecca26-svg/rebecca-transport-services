// PARTS FAITES D'UNE COURSE (17 nov. 2026, 14h24) - Rebecca Services
// Un aller-retour compte dans le chiffre d'affaires trajet par trajet :
//   l'aller (moitie du prix) le jour de l'aller des qu'il est fait (allerFaitA), le retour (l'autre moitie)
//   le jour du retour quand il est fait (demande « terminee »). Le paiement d'avance reste dans « Encaisse ».
// Autres courses : tout le prix, a la date de la course, quand elle est terminee.
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
export const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
const estAR = (d) => !!(d && d.details && d.details.typeTrajet === "ar");

// Part de l'aller dans le prix d'un aller-retour (17 nov. 2026, 14h27) : d'apres le detail du devis
// (« Trajet aller : 250 ₪ », « Bagages en soute au retour : 1 x 10 ₪ : 10 ₪ »...). Une ligne qui parle de l'aller
// va a l'aller, du retour au retour, les autres sont partagees en deux ; puis on ramene au prix final.
// Sans detail lisible : moitie-moitie.
export function partAller(d) {
  const prix = prixDe(d);
  const texte = String((d.details || {}).detailDevis || "");
  let aller = 0;
  let retour = 0;
  let commun = 0;
  const i = texte.indexOf("Détail du tarif");
  for (const ligne of (i >= 0 ? texte.slice(i) : "").split("\n")) {
    if (/hors prestation/i.test(ligne)) continue;
    const m = /:\s*(-?\d+(?:[.,]\d+)?)\s*₪\s*$/.exec(ligne);
    if (!m) continue;
    const montant = Number(m[1].replace(",", "."));
    if (/retour/i.test(ligne)) retour += montant;
    else if (/aller/i.test(ligne)) aller += montant;
    else commun += montant;
  }
  const total = aller + retour + commun;
  if (!(total > 0) || !(aller > 0) || !(retour > 0)) return cents(prix / 2);
  return cents((prix * (aller + commun / 2)) / total);
}

// [{ date, montant, trajet }] des trajets faits
export function partsFaites(d) {
  if (!d) return [];
  const prix = prixDe(d);
  if (!estAR(d)) return d.statut === "terminee" ? [{ date: d.date, montant: prix, trajet: "simple" }] : [];
  const moitie = partAller(d);
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
