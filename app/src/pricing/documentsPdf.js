// REÇU ET CARTE CADEAU EN VRAI PDF (19 nov. 2026) - règles pures, aux couleurs de Rebecca Services
// (noir, rose poudré, or rose, blanc cassé). Utilisé par les boutons « Partager le PDF ».
import { A4, couper, fabriquerPdf } from "./pdfSimple.js";

const NOIR = "#141214";
const ROSE = "#e7a9b4";
const OR = "#c9967a";
const CREME = "#faf6f2";
const GRIS = "#6b5d60";
const shek = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;

// r : { nom, sousTitre, numero, edite, client, lignes: [{ libelle, montant, gras }], merci }
export function recuPdf(r) {
  const L = A4.largeur;
  const m = 50;
  const el = [];
  el.push({ t: "rect", x: 0, y: 0, w: L, h: 110, fond: NOIR });
  el.push({ t: "texte", x: m, y: 52, texte: r.nom || "Rebecca Services", taille: 24, gras: true, couleur: CREME });
  el.push({ t: "texte", x: m, y: 78, texte: r.sousTitre || "", taille: 10, couleur: ROSE });
  el.push({ t: "trait", x1: 0, y1: 110, x2: L, y2: 110, couleur: OR, epaisseur: 3 });
  let y = 150;
  el.push({ t: "texte", x: m, y, texte: `Reçu n° ${r.numero || ""}`, taille: 16, gras: true, couleur: NOIR });
  y += 22;
  el.push({ t: "texte", x: m, y, texte: `Édité le ${r.edite || ""}`, taille: 10, couleur: GRIS });
  y += 26;
  for (const l of couper(`Client : ${r.client || ""}`, 11, L - 2 * m)) {
    el.push({ t: "texte", x: m, y, texte: l, taille: 11, couleur: NOIR });
    y += 16;
  }
  y += 14;
  for (const ligne of r.lignes || []) {
    const morceaux = couper(ligne.libelle, 11, L - 2 * m - 110, ligne.gras);
    morceaux.forEach((t, i) => {
      el.push({ t: "texte", x: m, y: y + i * 15, texte: t, taille: 11, gras: !!ligne.gras, couleur: NOIR });
    });
    if (ligne.montant != null) el.push({ t: "texte", x: L - m, y, texte: shek(ligne.montant), taille: 11, gras: !!ligne.gras, couleur: NOIR, align: "droite" });
    y += 15 * morceaux.length + 8;
    el.push({ t: "trait", x1: m, y1: y - 4, x2: L - m, y2: y - 4, couleur: "#e3d6d2" });
    y += 8;
  }
  y += 20;
  for (const l of couper(r.merci || "", 10, L - 2 * m)) {
    el.push({ t: "texte", x: m, y, texte: l, taille: 10, couleur: GRIS });
    y += 14;
  }
  el.push({ t: "texte", x: L / 2, y: A4.hauteur - 30, texte: "rebeccaservices.com", taille: 9, couleur: OR, align: "centre" });
  return fabriquerPdf({ fond: CREME, elements: el, titre: `Reçu ${r.numero || ""}` });
}

// c : { montant, idee, pourNom, acheteurNom, message, code, solde, valable, conditions, contact }
export function carteCadeauPdf(c) {
  const L = A4.largeur;
  const x = 60;
  const w = L - 2 * x;
  const el = [];
  const cadre = { t: "rect", x, y: 80, w, h: 420, fond: NOIR, bord: OR, epaisseur: 2 };
  el.push(cadre);
  let y = 140;
  const centre = (texte, taille, coul, gras = false, ecart = 10) => {
    for (const l of couper(texte, taille, w - 40, gras)) {
      el.push({ t: "texte", x: L / 2, y, texte: l, taille, gras, couleur: coul, align: "centre" });
      y += taille + ecart;
    }
  };
  centre("CARTE CADEAU", 12, ROSE, true, 14);
  centre("Rebecca Services", 26, CREME, true, 14);
  centre(`${c.montant} ₪`, 40, CREME, true, 16);
  if (c.idee && c.idee !== "Au choix") centre(c.idee, 13, ROSE);
  centre(`Pour ${c.pourNom || ""}, de la part de ${c.acheteurNom || ""}`, 13, CREME);
  if (c.message) centre(`« ${c.message} »`, 12, CREME);
  if (c.code) centre(c.code, 20, CREME, true, 12);
  if (c.solde != null) centre(`Solde : ${c.solde} ₪`, 12, ROSE);
  if (c.valable) centre(`Valable jusqu'au ${c.valable}`, 11, CREME);
  cadre.h = y - 80 + 30; // le cadre noir s'arrête juste sous le texte
  y += 70;
  for (const l of couper(c.conditions || "", 10, L - 2 * x)) {
    el.push({ t: "texte", x: L / 2, y, texte: l, taille: 10, couleur: GRIS, align: "centre" });
    y += 14;
  }
  el.push({ t: "texte", x: L / 2, y: y + 10, texte: c.contact || "rebeccaservices.com", taille: 10, couleur: OR, align: "centre" });
  return fabriquerPdf({ fond: CREME, elements: el, titre: "Carte cadeau Rebecca Services" });
}
