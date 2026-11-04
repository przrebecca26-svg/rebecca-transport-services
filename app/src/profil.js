// PROFIL CLIENT : regles pures (aucun acces internet ni base de donnees) - Rebecca Transport & Services
// Un compte client = une fiche (nom, prenom, telephone, e-mail, adresse, date de naissance, moyens de paiement preferes).
// Aucun numero de carte bancaire n'est jamais enregistre : seulement une PREFERENCE de moyen de paiement.

import { TARIFS } from "./pricing/config.js";

export const MOYENS_PREFERES = TARIFS.moyensPaiement;
export const AGE_MINIMUM = 18;
export const MOT_DE_PASSE_MIN = 8;

// Date du jour en Israel, au format AAAA-MM-JJ
export const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function dateValide(s) {
  if (!DATE_OK.test(s)) return false;
  const [a, m, j] = s.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, 12));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

// Age en annees entieres a une date donnee
export function ageA(naissance, jour = aujourdhui()) {
  if (!dateValide(naissance) || !dateValide(jour)) return null;
  const [a, m, j] = naissance.split("-").map(Number);
  const [A, M, J] = jour.split("-").map(Number);
  return A - a - (M < m || (M === m && J < j) ? 1 : 0);
}

// Derniere date de naissance acceptee aujourd'hui (pour limiter le calendrier du telephone)
export function naissanceMax(jour = aujourdhui()) {
  const [A, M, J] = jour.split("-").map(Number);
  const jj = M === 2 && J === 29 ? 28 : J; // 29 fevrier : on prend le 28
  return String(A - AGE_MINIMUM).padStart(4, "0") + "-" + String(M).padStart(2, "0") + "-" + String(jj).padStart(2, "0");
}

// Ce que le client tape : espaces, points, tirets et parentheses enleves
export const normaliserTelephone = (s) => String(s == null ? "" : s).replace(/[\s.\-()]/g, "");

// Telephone israelien (05XXXXXXXX, 0X-XXXXXXX) ou international (+972..., +33...)
export const telephoneValide = (s) => /^(\+\d{8,15}|0\d{8,9})$/.test(normaliserTelephone(s));

export const emailValide = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());

export const nettoyer = (s, max) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, max);

// Erreurs du mot de passe (creation du compte)
export function erreurMotDePasse(mdp, confirmation) {
  if (String(mdp || "").length < MOT_DE_PASSE_MIN) return "Le mot de passe doit avoir au moins " + MOT_DE_PASSE_MIN + " caractères.";
  if (mdp !== confirmation) return "Les deux mots de passe ne sont pas identiques.";
  return "";
}

// Valide le formulaire du profil. Renvoie { champ: "message" } (objet vide = tout est correct).
export function validerProfil(f, jour = aujourdhui()) {
  const e = {};
  if (!nettoyer(f.prenom, 60)) e.prenom = "Indiquez votre prénom.";
  if (!nettoyer(f.nom, 60)) e.nom = "Indiquez votre nom.";
  if (!telephoneValide(f.telephone)) e.telephone = "Indiquez un numéro valide (ex : 054 738 0193 ou +33 6 12 34 56 78).";
  if (nettoyer(f.adresse, 300).length < 5) e.adresse = "Indiquez votre adresse (rue, numéro, ville).";
  if (!f.naissance) e.naissance = "Indiquez votre date de naissance.";
  else if (!dateValide(f.naissance) || f.naissance < "1900-01-01" || f.naissance > jour) e.naissance = "Date de naissance invalide.";
  else if (ageA(f.naissance, jour) < AGE_MINIMUM) e.naissance = "Le compte est réservé aux personnes majeures (" + AGE_MINIMUM + " ans ou plus).";
  const moyens = Array.isArray(f.moyensPreferes) ? f.moyensPreferes : [];
  if (moyens.length === 0) e.moyensPreferes = "Cochez au moins un moyen de paiement.";
  else if (moyens.some((m) => !MOYENS_PREFERES.includes(m))) e.moyensPreferes = "Moyen de paiement inconnu.";
  return e;
}

// Document a enregistrer dans Firestore (collection "clients", identifiant = uid du compte)
export function construireProfil(f, email) {
  return {
    prenom: nettoyer(f.prenom, 60),
    nom: nettoyer(f.nom, 60),
    telephone: normaliserTelephone(f.telephone).slice(0, 20),
    email: String(email || "").trim(),
    adresse: nettoyer(f.adresse, 300),
    naissance: f.naissance,
    moyensPreferes: MOYENS_PREFERES.filter((m) => (f.moyensPreferes || []).includes(m)), // ordre fixe, sans doublon
  };
}

// Formulaire de depart : vide, ou deduit du compte Google (prenom et nom), ou d'une fiche existante
export function formulaireInitial(profil, user) {
  if (profil) {
    return {
      prenom: profil.prenom || "",
      nom: profil.nom || "",
      telephone: profil.telephone || "",
      adresse: profil.adresse || "",
      naissance: profil.naissance || "",
      moyensPreferes: Array.isArray(profil.moyensPreferes) ? profil.moyensPreferes : [],
    };
  }
  const mots = String((user && user.displayName) || "").trim().split(/\s+/).filter(Boolean);
  return {
    prenom: mots[0] || "",
    nom: mots.slice(1).join(" "),
    telephone: "",
    adresse: "",
    naissance: "",
    moyensPreferes: [],
  };
}

/* ---------- Informations modifiables par le client (nom, prenom et date de naissance ne changent plus) ---------- */

// Telephone, adresse et moyens de paiement : doivent rester valides
export function validerContact(f) {
  const e = {};
  if (!telephoneValide(f.telephone)) e.telephone = "Indiquez un numéro valide (ex : 054 738 0193 ou +33 6 12 34 56 78).";
  if (nettoyer(f.adresse, 300).length < 5) e.adresse = "Indiquez votre adresse (rue, numéro, ville).";
  const moyens = Array.isArray(f.moyensPreferes) ? f.moyensPreferes : [];
  if (moyens.length === 0) e.moyensPreferes = "Cochez au moins un moyen de paiement.";
  else if (moyens.some((m) => !MOYENS_PREFERES.includes(m))) e.moyensPreferes = "Moyen de paiement inconnu.";
  return e;
}

export function construireContact(f) {
  return {
    telephone: normaliserTelephone(f.telephone).slice(0, 20),
    adresse: nettoyer(f.adresse, 300),
    moyensPreferes: MOYENS_PREFERES.filter((m) => (f.moyensPreferes || []).includes(m)),
  };
}

/* ---------- Adresses enregistrees (Maison, Travail, Chez maman...) ---------- */

export const NOMS_ADRESSES = ["Maison", "Travail"];

export function validerAdresseNommee(a) {
  const e = {};
  if (!nettoyer(a && a.nom, 30)) e.nom = "Donnez un nom à cette adresse (ex : Maison).";
  if (!a || nettoyer(a.label, 300).length < 5) e.label = "Indiquez l'adresse.";
  return e;
}

// Une adresse enregistree propre. lat/lon seulement si l'adresse a ete choisie dans les suggestions.
export function construireAdresseNommee(a) {
  const r = { nom: nettoyer(a.nom, 30), label: nettoyer(a.label, 300) };
  if (typeof a.lat === "number" && typeof a.lon === "number" && isFinite(a.lat) && isFinite(a.lon)) {
    r.lat = a.lat;
    r.lon = a.lon;
  }
  return r;
}

/* ---------- Enfants (ramassage scolaire) ---------- */

export function validerEnfant(en) {
  const e = {};
  if (!nettoyer(en.prenom, 40)) e.prenom = "Indiquez le prénom de l'enfant.";
  const age = Number(String(en.age == null ? "" : en.age).replace(",", "."));
  if (!Number.isInteger(age) || age < 1 || age > 25) e.age = "Indiquez l'âge (entre 1 et 25 ans).";
  if (!nettoyer(en.classe, 30)) e.classe = "Indiquez la classe.";
  if (nettoyer(en.adresse, 300).length < 5) e.adresse = "Indiquez l'adresse du domicile.";
  if (!telephoneValide(en.telephoneUrgence)) e.telephoneUrgence = "Indiquez un numéro valide pour les urgences.";
  return e;
}

export function construireEnfant(en) {
  return {
    prenom: nettoyer(en.prenom, 40),
    age: Number(String(en.age).replace(",", ".")),
    classe: nettoyer(en.classe, 30),
    ecole: nettoyer(en.ecole, 80),
    adresse: nettoyer(en.adresse, 300),
    telephoneUrgence: normaliserTelephone(en.telephoneUrgence).slice(0, 20),
    horaires: nettoyer(en.horaires, 120),
    personnesAutorisees: nettoyer(en.personnesAutorisees, 200), // qui peut récupérer l'enfant : nom, téléphone, lien
  };
}

/* ---------- Trajets favoris ---------- */

export const nomFavoriValide = (s) => nettoyer(s, 40).length >= 2;

// Valeurs d'un formulaire gardees pour "Refaire ce trajet" : adresses et choix, sans date ni heure ni code promo
const EXCLUS = new Set(["date", "heure", "dateRetour", "heureRetour", "codePromo", "promoActif", "urgent"]);
export function detailsRefaire(details) {
  const r = {};
  for (const [k, val] of Object.entries(details || {})) if (!EXCLUS.has(k)) r[k] = val;
  return r;
}

/* ---------- Pourboire ---------- */

// Montant du pourboire : "" ou 0 = aucun ; sinon entier de 1 a max
export function lirePourboire(s, max = 200) {
  const t = String(s == null ? "" : s).trim().replace(",", ".");
  if (t === "") return { montant: 0, erreur: "" };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) return { montant: 0, erreur: "Indiquez un montant en shekels entiers." };
  if (n > max) return { montant: 0, erreur: "Le pourboire est limité à " + max + " ₪." };
  return { montant: n, erreur: "" };
}

/* ---------- Passager different du client ---------- */

export function validerPassager(v) {
  const e = {};
  if (!v.pourAutrui) return e;
  if (!nettoyer(v.passagerNom, 80)) e.passagerNom = "Indiquez le nom du passager.";
  if (!telephoneValide(v.passagerTel)) e.passagerTel = "Indiquez un numéro valide pour le passager.";
  return e;
}

/* ---------- Statuts d'une demande (visibles par le client) ---------- */

export const STATUTS_SUIVI = {
  "en attente": { texte: "En attente de confirmation", classe: "attente" },
  "acceptée": { texte: "Acceptée : acompte à régler", classe: "ok" },
  "confirmée": { texte: "Confirmée", classe: "ok" },
  "refusée": { texte: "Refusée", classe: "non" },
  "terminée": { texte: "Terminée", classe: "fin" },
  "annulée": { texte: "Annulée", classe: "non" },
  "annulée par le client": { texte: "Annulée par vous", classe: "non" },
  "remplacée": { texte: "Remplacée par une nouvelle demande", classe: "fin" },
};
export const statutSuivi = (s) => STATUTS_SUIVI[s] || { texte: String(s || ""), classe: "attente" };
export const peutAnnuler = (s) => s === "en attente";
