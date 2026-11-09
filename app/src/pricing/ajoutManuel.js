// AJOUT MANUEL (espace prive) : regles pures, sans acces internet ni base de donnees - Rebecca Services
// Lot B, seance B7 : courses faites ou prevues en dehors du site (WhatsApp, pub Facebook, telephone...)
// et pre-fiches clients (clientsAdmin/{cle}, jamais visibles du client).
//
// Choix valides par Rebecca le 9 nov. 2026 :
//  - une course peut etre ajoutee apres coup (date passee) : elle compte a la date de la course ;
//  - argent recu > prix convenu : la difference est un pourboire (hors chiffre d'affaires) ;
//  - origine du client notee (WhatsApp, pub Facebook...) ;
//  - message de remerciement pret a envoyer (WhatsApp ou e-mail), c'est Rebecca qui appuie sur « Envoyer » ;
//  - fusion avec le compte cree plus tard : par le numero de telephone (pricing/clients.js).

import { SERVICES } from "../services.js";
import { TARIFS } from "./config.js";
import { telNormalise } from "./clients.js";

export const SITE = "https://rebecca-services-netanya.netlify.app";
export const CODE_BIENVENUE = "BIENVENUE10";

export const ORIGINES = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Pub Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "bouche", label: "Bouche-à-oreille" },
  { id: "fidele", label: "Cliente fidèle" },
  { id: "autre", label: "Autre" },
];
export const LIBELLE_ORIGINE = { site: "Site", ...Object.fromEntries(ORIGINES.map((o) => [o.id, o.label])) };

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cents = (x) => Math.round(x * 100) / 100;

// "65", "65,5", " 60 " -> nombre ; vide ou invalide -> null
export function lireMontant(s) {
  const t = String(s == null ? "" : s).trim().replace(",", ".");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? cents(n) : null;
}

// Adresses demandees selon le service : memes cles que les formulaires du site (agenda, enchainement, Waze)
export function champsAdresses(service) {
  switch (service) {
    case "livraison":
      return [{ cle: "recuperation", label: "Adresse de récupération" }, { cle: "livraison", label: "Adresse de livraison" }];
    case "courses":
      return [{ cle: "livraison", label: "Adresse de livraison" }];
    case "ramassage":
      return [{ cle: "domicile", label: "Domicile" }, { cle: "ecole", label: "École" }];
    case "aeroport":
      return [{ cle: "adresse", label: "Adresse (domicile, hôtel…)" }];
    case "attente":
      return [{ cle: "depart", label: "Lieu de rendez-vous" }];
    default:
      return [{ cle: "depart", label: "Départ" }, { cle: "arrivee", label: "Arrivée" }];
  }
}

// Argent recu : la part au-dela du prix convenu est un pourboire (si Rebecca le confirme)
export function repartirPaiement(prix, recu, avecPourboire = true) {
  const p = Number(prix) || 0;
  const r = Number(recu) || 0;
  if (r <= 0) return { paiement: 0, pourboire: 0 };
  if (avecPourboire && p > 0 && r > p) return { paiement: cents(p), pourboire: cents(r - p) };
  return { paiement: cents(r), pourboire: 0 };
}

// Etat propose selon la date : passee = deja faite, future = a faire (aujourd'hui : au choix)
export function etatPropose(date, aujourdhui, actuel) {
  if (!DATE_OK.test(date || "")) return actuel;
  if (date < aujourdhui) return "faite";
  if (date > aujourdhui) return "afaire";
  return actuel;
}

/* ---------- Client ---------- */

export const cleTel = (telephone) => {
  const t = telNormalise(telephone);
  return t ? "tel_" + t : "";
};

// c : { prenom, nom, telephone, email, adresse }
export function validerClient(c) {
  if (!String(c.prenom || "").trim()) return "Indique au moins le prénom.";
  if (!telNormalise(c.telephone)) return "Indique un numéro de téléphone valide.";
  const email = String(c.email || "").trim();
  if (email && !EMAIL_OK.test(email)) return "L'adresse e-mail n'est pas valide.";
  return "";
}

// Donnees de la pre-fiche (clientsAdmin/{cle}) ; seuls les champs remplis sont ecrits (rien n'est efface)
export function donneesPreFiche(c, origine) {
  const res = { preFiche: true };
  const champs = { prenom: 60, nom: 60, telephone: 20, email: 120, adresse: 300 };
  for (const [k, max] of Object.entries(champs)) {
    const v = String(c[k] || "").trim().slice(0, max);
    if (v) res[k] = k === "email" ? v.toLowerCase() : v;
  }
  if (origine && LIBELLE_ORIGINE[origine]) res.origine = origine;
  return res;
}

/* ---------- Course ---------- */

// f : { service, date, heure, prix, etat ("afaire"|"faite"), recu, moyen }
export function validerCourse(f, aujourdhui) {
  if (!SERVICES.some((s) => s.id === f.service)) return "Choisis le service.";
  if (!DATE_OK.test(f.date || "")) return "Indique la date de la course.";
  if (!HEURE_OK.test(f.heure || "")) return "Indique l'heure de la course.";
  const prix = lireMontant(f.prix);
  if (prix == null || prix <= 0 || prix > 20000) return "Indique le prix convenu, en shekels.";
  if (f.etat === "faite" && f.date > aujourdhui) return "Une course déjà faite ne peut pas être à une date future.";
  if (f.etat === "afaire" && f.date < aujourdhui) return "Cette date est passée : choisis « Déjà faite ».";
  const recu = lireMontant(f.recu);
  if (String(f.recu || "").trim() && (recu == null || recu < 0 || recu > 100000)) return "Le montant reçu n'est pas valide.";
  if (recu > 0 && !TARIFS.moyensPaiement.includes(f.moyen)) return "Choisis le moyen de paiement.";
  return "";
}

const titreDe = (service) => (SERVICES.find((s) => s.id === service) || {}).titre || service;

// Adresse saisie -> objet { label, lat?, lon? } propre (ou null)
const adresseNette = (a) => {
  if (!a || !String(a.label || "").trim()) return null;
  const r = { label: String(a.label).trim().slice(0, 300) };
  if (typeof a.lat === "number" && typeof a.lon === "number") {
    r.lat = a.lat;
    r.lon = a.lon;
  }
  return r;
};

// Details de la course (memes cles que le site)
export function detailsCourse(f) {
  const det = {};
  for (const { cle } of champsAdresses(f.service)) {
    const a = adresseNette(f.adresses && f.adresses[cle]);
    if (a) det[cle] = a;
  }
  if (f.service === "aeroport") det.direction = f.direction === "depuis" ? "depuis" : "vers";
  if (f.service === "courses" && String(f.magasin || "").trim()) det.magasin = String(f.magasin).trim().slice(0, 120);
  return det;
}

// Texte « Demande complete » affiche dans l'onglet Demandes
function texteCourse(c, f, det, origine) {
  const lignes = ["Course ajoutée à la main par Rebecca."];
  if (origine) lignes.push("Origine du client : " + (LIBELLE_ORIGINE[origine] || origine));
  if (f.service === "aeroport") lignes.push(det.direction === "depuis" ? "Depuis l'aéroport" : "Vers l'aéroport");
  for (const { cle, label } of champsAdresses(f.service)) if (det[cle]) lignes.push(`${label} : ${det[cle].label}`);
  if (det.magasin) lignes.push("Magasin : " + det.magasin);
  const notes = String(f.notes || "").trim();
  if (notes) lignes.push("", notes);
  return lignes.join("\n").slice(0, 5000);
}

// La demande a enregistrer (sans creeLe / majLe, ajoutes au moment de l'ecriture)
// trajet : { km, minutes } calcule si deux adresses ont une position, sinon null
export function construireDemande(c, f, origine, trajet = null) {
  const prix = lireMontant(f.prix);
  const recu = lireMontant(f.recu) || 0;
  const { pourboire } = f.etat === "faite" ? repartirPaiement(prix, recu, f.pourboireConfirme !== false) : { pourboire: 0 };
  const det = detailsCourse(f);
  const d = {
    service: f.service,
    serviceTitre: titreDe(f.service),
    date: f.date,
    heure: f.heure,
    nom: `${String(c.prenom || "").trim()} ${String(c.nom || "").trim()}`.trim().slice(0, 100),
    telephone: String(c.telephone || "").trim().slice(0, 30),
    moyenPaiement: TARIFS.moyensPaiement.includes(f.moyen) ? f.moyen : TARIFS.moyensPaiement[0],
    prixEstime: null,
    prixFinal: prix,
    surDevis: false,
    kmEstime: trajet && typeof trajet.km === "number" ? trajet.km : null,
    minutesEstimees: trajet && typeof trajet.minutes === "number" ? trajet.minutes : null,
    details: det,
    message: texteCourse(c, f, det, origine),
    statut: f.etat === "faite" ? "terminee" : "acceptee",
    source: "manuel",
  };
  if (origine && LIBELLE_ORIGINE[origine]) d.origine = origine;
  if (pourboire > 0) d.pourboire = pourboire;
  return d;
}

// Paiement a enregistrer avec la course (ou null). Course faite : date de la course ; a faire : aujourd'hui.
export function paiementCourse(f, resId, aujourdhui) {
  const prix = lireMontant(f.prix);
  const recu = lireMontant(f.recu) || 0;
  const { paiement } = f.etat === "faite" ? repartirPaiement(prix, recu, f.pourboireConfirme !== false) : repartirPaiement(prix, recu, false);
  if (paiement <= 0) return null;
  return { kind: "paiement", resId, date: f.etat === "faite" ? f.date : aujourdhui, montant: paiement, moyen: f.moyen };
}

/* ---------- Message de remerciement ---------- */

export const prenomDe = (nomComplet) => String(nomComplet || "").trim().split(/\s+/)[0] || "";

export function messageRemerciement(prenom, site = SITE) {
  const bonjour = prenom ? `Bonjour ${prenom}, merci pour votre confiance 🙏` : "Bonjour, merci pour votre confiance 🙏";
  return [
    bonjour,
    `Retrouvez toutes mes activités sur mon site : ${site}`,
    "et sur Instagram @rebecca_services.",
    `Créez votre compte avec ce numéro de téléphone et profitez du code ${CODE_BIENVENUE} (-10 ₪ sur votre prochaine réservation).`,
    "À bientôt, Rebecca",
  ].join("\n");
}

export function lienEmail(email, prenom, site = SITE) {
  const e = String(email || "").trim();
  if (!EMAIL_OK.test(e)) return null;
  const enc = encodeURIComponent;
  return `mailto:${e}?subject=${enc("Merci pour votre confiance - Rebecca Services")}&body=${enc(messageRemerciement(prenom, site))}`;
}
