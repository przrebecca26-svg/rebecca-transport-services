// TRAJET PARTAGE - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// 15 nov. 2026, regle de Rebecca :
// - jusqu'a 2 personnes (TARIFS.partage.inclus) sur un meme trajet = le prix normal du trajet ;
// - chaque personne en plus = un supplement en pourcentage du trajet (ramassage 50 % : chaque enfant paie sa place ;
//   transport et aeroport 25 %), modifiable dans Reglages -> Tarifs ;
// - 1, 2 ou 3 familles peuvent partager le trajet : chaque famille indique ses enfants (ou ses passagers) ;
// - la note se partage « par enfant » (chaque famille paie pour ses enfants) ou « en parts egales » entre les familles.
//   Pour Rebecca, le total ne change pas.

import { TARIFS } from "./config.js";

export const MODES_PARTAGE = [
  { v: "enfant", l: "Par enfant (chaque famille paie pour ses enfants)" },
  { v: "egal", l: "Parts égales entre les familles" },
];
export const MODES_PARTAGE_PASSAGERS = [
  { v: "enfant", l: "Par personne (chaque famille paie pour ses passagers)" },
  { v: "egal", l: "Parts égales entre les familles" },
];

const reglage = (t) => ({ inclus: 2, ramassage: 0.5, transport: 0.25, maxFamilles: 3, ...((t && t.partage) || {}) });
export const maxFamilles = (t = TARIFS) => Math.max(1, Math.min(3, Math.round(reglage(t).maxFamilles) || 3));
export const personnesIncluses = (t = TARIFS) => Math.max(1, Math.round(reglage(t).inclus) || 2);
// Pourcentage par personne en plus : « ramassage » ou « transport » (aeroport compris)
export const supplementParPersonne = (genre, t = TARIFS) => {
  const p = Number(reglage(t)[genre === "ramassage" ? "ramassage" : "transport"]);
  return Number.isFinite(p) && p >= 0 ? p : 0;
};
// Combien de « trajets » vaut un trajet avec n personnes : 1 jusqu'a 2 personnes, puis + le supplement par personne
export const facteurPersonnes = (n, genre, t = TARIFS) => 1 + supplementParPersonne(genre, t) * Math.max(0, (Math.round(n) || 1) - personnesIncluses(t));
export const personnesEnPlus = (n, t = TARIFS) => Math.max(0, (Math.round(n) || 1) - personnesIncluses(t));

export const centimes = (x) => Math.round(x * 100) / 100;
// 1487.5 -> « 1 487,50 » ; 1190 -> « 1 190 »
export function prixFr(n) {
  const v = centimes(Number(n) || 0);
  const [e, d] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + e.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (d === "00" ? "" : "," + d);
}

// Parts de chaque famille.
// familles = [{ nom, personnes, montant? }] ; montant = ce que la famille paie « par enfant » (s'il est deja calcule,
// avec sa propre reduction) ; sinon le total est reparti au prorata des personnes.
// Renvoie { mode, libelle, parts: [{ nom, personnes, montant }] } ; la somme des parts = le total.
export function partagerNote(total, familles, mode = "enfant") {
  const liste = (familles || []).filter((f) => f && f.personnes > 0);
  if (!(total > 0) || liste.length < 2) return null;
  let parts;
  if (mode === "egal") {
    const part = Math.floor((total / liste.length) * 100) / 100;
    parts = liste.map((f, i) => ({ nom: f.nom, personnes: f.personnes, montant: i === 0 ? centimes(total - part * (liste.length - 1)) : part }));
  } else {
    const avecMontant = liste.every((f) => typeof f.montant === "number");
    const nb = liste.reduce((s, f) => s + f.personnes, 0);
    parts = liste.map((f) => ({ nom: f.nom, personnes: f.personnes, montant: centimes(avecMontant ? f.montant : (total * f.personnes) / nb) }));
    const ecart = centimes(total - parts.reduce((s, p) => s + p.montant, 0));
    if (ecart) parts[0].montant = centimes(parts[0].montant + ecart);
  }
  return { mode: mode === "egal" ? "egal" : "enfant", libelle: mode === "egal" ? "Parts égales entre les familles" : "Chaque famille paie pour ses enfants", parts };
}

// Lignes de texte du partage (devis du site, message WhatsApp, devis rapide)
export function lignesPartage(partage, mot = "enfant") {
  if (!partage || !partage.parts || partage.parts.length < 2) return [];
  const titre = partage.mode === "egal" ? `Partage de la note en parts égales (${partage.parts.length} familles) :` : `Partage de la note (chaque famille paie pour ses ${mot}s) :`;
  return [titre, ...partage.parts.map((p) => `• ${p.nom} (${p.personnes} ${mot}${p.personnes > 1 ? "s" : ""}) : ${prixFr(p.montant)} ₪`)];
}

// Nom affiche d'une famille : « Famille 2 » si rien n'est saisi
export const nomFamille = (nom, i) => String(nom || "").trim() || (i === 0 ? "Votre famille" : `Famille ${i + 1}`);
