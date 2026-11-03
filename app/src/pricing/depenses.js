// DEPENSES : categories, controle de saisie et resume mensuel - Rebecca Transport & Services
// Logique pure (aucun acces internet ni base de donnees) : elle se teste seule.
//
// PRINCIPE : une depense enregistree n'est JAMAIS modifiee ni supprimee.
// Une erreur se corrige par une ligne NEGATIVE avec un motif (ex. -20, "saisi en double").

export const CATEGORIES = ["Carburant", "Péages", "Stationnement", "Entretien du véhicule", "Autres frais"];

const cents = (x) => Math.round(x * 100) / 100;
const nombre = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

// Verifie une depense avant enregistrement (meme esprit que les regles Firebase).
// d : { date:"AAAA-MM-JJ", categorie, montant (+ pour une depense, - pour une correction), motif? }
export function validerDepense(d) {
  if (!d || typeof d !== "object") return "Dépense invalide.";
  if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "Date invalide.";
  if (!CATEGORIES.includes(d.categorie)) return "Catégorie inconnue.";
  const m = Number(d.montant);
  if (!Number.isFinite(m) || m === 0 || Math.abs(m) > 100000) return "Montant invalide.";
  const motif = typeof d.motif === "string" ? d.motif.trim() : "";
  if (motif.length > 200) return "Le motif est trop long.";
  if (m < 0 && motif.length < 3) return "Un motif est obligatoire pour une correction.";
  return null;
}

// "2026-11-15" -> "2026-11"
export const moisDe = (date) => String(date || "").slice(0, 7);

// "2026-11", +1 -> "2026-12" ; "2026-01", -1 -> "2025-12"
export function moisDecale(mois, delta) {
  const [a, m] = mois.split("-").map(Number);
  const t = a * 12 + (m - 1) + delta;
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
}

// Resume d'un mois : total, total par categorie (du plus grand au plus petit), lignes (la plus recente d'abord)
export function resumeMois(depenses, mois) {
  const lignes = depenses.filter((d) => moisDe(d.date) === mois).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const parCat = {};
  for (const d of lignes) parCat[d.categorie] = cents((parCat[d.categorie] || 0) + nombre(Number(d.montant)));
  const parCategorie = Object.entries(parCat)
    .map(([categorie, montant]) => ({ categorie, montant }))
    .filter((x) => x.montant !== 0)
    .sort((a, b) => b.montant - a.montant);
  const total = cents(lignes.reduce((s, d) => s + nombre(Number(d.montant)), 0));
  return { total, parCategorie, lignes };
}

// Total d'une categorie sur toute la periode (pour empecher une correction qui rendrait le total negatif)
export function totalCategorie(depenses, categorie) {
  return cents(depenses.filter((d) => d.categorie === categorie).reduce((s, d) => s + nombre(Number(d.montant)), 0));
}
