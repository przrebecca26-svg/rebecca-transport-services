// CODES PROMO : regles pures (aucun acces internet ni base de donnees) - Rebecca Transport & Services
// Un code = une remise sur le TARIF DE BASE du trajet ou du service (jamais sur les supplements).
// Les codes sont enregistres dans Firestore (collection "promos", identifiant = le code en majuscules).

export const TYPES = ["pourcentage", "montant"];
export const POURCENT_MAX = 50; // garde-fou contre une faute de frappe (100 au lieu de 10)
export const MONTANT_MAX = 500;
export const UTILISATIONS_MAX = 1000;

// Les 3 codes de depart de Rebecca (modifiables ensuite dans son espace prive)
export const CODES_DE_DEPART = [
  { code: "BIENVENUE10", type: "montant", valeur: 10, actif: true, utilisationsParCompte: 1, finLe: null },
  { code: "AMI10", type: "pourcentage", valeur: 10, actif: true, utilisationsParCompte: null, finLe: null },
  { code: "FIDELE5", type: "pourcentage", valeur: 5, actif: true, utilisationsParCompte: 10, finLe: null },
];

// Date du jour en Israel, au format AAAA-MM-JJ
export const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

// Ce que le client tape : espaces enleves, majuscules
export const normaliserCode = (s) => String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase();

const CODE_OK = /^[A-Z0-9_-]{3,20}$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function dateValide(s) {
  if (!DATE_OK.test(s)) return false;
  const [a, m, j] = s.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, 12));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

// Renvoie un message d'erreur en francais, ou "" si le code est correct
export function validerPromo(p) {
  if (!p || typeof p !== "object") return "Code invalide.";
  if (!CODE_OK.test(String(p.code || ""))) return "Le code doit avoir 3 à 20 caractères : lettres sans accent, chiffres, tiret.";
  if (!TYPES.includes(p.type)) return "Choisis le type de remise.";
  if (!Number.isInteger(p.valeur) || p.valeur < 1) return "La remise doit être un nombre entier, au moins 1.";
  if (p.type === "pourcentage" && p.valeur > POURCENT_MAX) return "Une remise en pourcentage ne peut pas dépasser " + POURCENT_MAX + " %.";
  if (p.type === "montant" && p.valeur > MONTANT_MAX) return "Une remise en shekels ne peut pas dépasser " + MONTANT_MAX + " ₪.";
  if (typeof p.actif !== "boolean") return "État du code invalide.";
  if (p.utilisationsParCompte !== null && (!Number.isInteger(p.utilisationsParCompte) || p.utilisationsParCompte < 1 || p.utilisationsParCompte > UTILISATIONS_MAX)) {
    return "Le nombre d'utilisations par compte doit être un entier entre 1 et " + UTILISATIONS_MAX + ", ou vide pour aucune limite.";
  }
  if (p.finLe !== null && !dateValide(String(p.finLe))) return "Date de fin invalide.";
  return "";
}

export const libelleRemise = (p) => (p.type === "pourcentage" ? "-" + p.valeur + " %" : "-" + p.valeur + " ₪");

export const libelleLimite = (p) =>
  p.utilisationsParCompte == null ? "Sans limite" : p.utilisationsParCompte === 1 ? "1 fois par compte" : p.utilisationsParCompte + " fois par compte";

// "actif" | "inactif" | "expire" (le code reste valable jusqu'a la fin de sa date de fin, incluse)
export function etatCode(p, jour = aujourdhui()) {
  if (!p || p.actif !== true) return "inactif";
  if (p.finLe && String(jour) > String(p.finLe)) return "expire";
  return "actif";
}

// Un compte peut-il encore utiliser ce code ? dejaUtilise = nombre d'utilisations deja enregistrees pour ce compte
export const utilisationPossible = (p, dejaUtilise) => p.utilisationsParCompte == null || dejaUtilise < p.utilisationsParCompte;

// Reduction en shekels entiers, sur la part ELIGIBLE (tarif de base) uniquement.
// Le prix final est arrondi au shekel superieur : la reduction est donc arrondie a l'inferieur.
export function calculerRemise(eligible, p) {
  if (!(eligible > 0) || !p) return 0;
  const brut = p.type === "pourcentage" ? (eligible * p.valeur) / 100 : p.valeur;
  return Math.max(0, Math.min(Math.floor(brut + 1e-9), Math.floor(eligible + 1e-9)));
}
