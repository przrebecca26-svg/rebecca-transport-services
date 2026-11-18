import { SITE } from "../site.js";
// DEVENIR PARTENAIRE DE REBECCA SERVICES (17 nov. 2026) - inscription des futurs coursiers
// La page #/partenaire existe, mais aucun lien ne la montre sur le site tant que Rebecca ne l'a pas ouverte
// (Admin → Partenaires → « Visible sur le site », document reglages/partenaires.ouvert).
// Une candidature acceptee devient un coequipier comme Jeremy (rubrique Equipe : acces, services, vehicules).

import { documentsRequis } from "./coursiers.js";

export const VEHICULES = [
  { v: "voiture", l: "Voiture" },
  { v: "scooter", l: "Scooter" },
  { v: "velo", l: "Vélo électrique" },
  { v: "pied", l: "À pied / transports" },
];
// 18 nov. 2026 (Rebecca) : les coursiers partenaires font SEULEMENT les livraisons et les courses.
export const SERVICES_PARTENAIRE = [
  { v: "livraison", l: "Livraisons (colis, clés, documents)" },
  { v: "courses", l: "Courses et achats" },
];
export const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
export const STATUTS_FISCAUX = ["Osek patur", "Osek murshe", "Société", "Pas encore", "Je ne sais pas"];
export const STATUTS_CANDIDATURE = [
  { id: "soumis", l: "Envoyée" },
  { id: "en_verification", l: "En vérification" },
  { id: "complement_demande", l: "Complément demandé" },
  { id: "approuve", l: "Approuvé" },
  { id: "refuse", l: "Refusé" },
  { id: "suspendu", l: "Suspendu" },
];
// Anciennes candidatures (17 nov.) : on lit leur statut avec les nouveaux noms
const ANCIENS = { nouvelle: "soumis", rencontre: "en_verification", acceptee: "approuve", refusee: "refuse" };
export const statutDe = (c) => ANCIENS[c && c.statut] || (c && c.statut) || "soumis";
export const libelleCandidature = (id) => (STATUTS_CANDIDATURE.find((s) => s.id === (ANCIENS[id] || id)) || { l: id }).l;
export const MAXP = { nom: 60, telephone: 30, email: 120, ville: 80, zones: 200, dispos: 300, experience: 600, message: 600 };

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const propre = (t, n) => String(t || "").trim().slice(0, n);
const dans = (liste, l) => (l || []).filter((x) => liste.some((y) => (y.v || y) === x));

export function erreursPartenaire(f) {
  const e = {};
  if (propre(f.prenom, MAXP.nom).length < 2) e.prenom = "Indiquez votre prénom.";
  if (propre(f.nom, MAXP.nom).length < 2) e.nom = "Indiquez votre nom.";
  const n = String(f.telephone || "").replace(/\D/g, "").length;
  if (n < 9 || n > 15) e.telephone = "Numéro de téléphone invalide.";
  if (!EMAIL_OK.test(String(f.email || "").trim())) e.email = "Adresse e-mail invalide.";
  if (propre(f.ville, MAXP.ville).length < 2) e.ville = "Indiquez votre ville.";
  if (!dans(VEHICULES, f.vehicules).length) e.vehicules = "Cochez au moins un moyen de déplacement.";
  if (!dans(SERVICES_PARTENAIRE, f.services).length) e.services = "Cochez au moins un service.";
  if (!dans(JOURS, f.jours).length) e.jours = "Cochez au moins un jour.";
  if (f.majeur !== true) e.majeur = "Il faut avoir 18 ans ou plus.";
  if (f.consentement !== true) e.consentement = "Cette case est obligatoire.";
  return e;
}

export function construireCandidature(f) {
  return {
    statut: "nouvelle",
    prenom: propre(f.prenom, MAXP.nom),
    nom: propre(f.nom, MAXP.nom),
    telephone: propre(f.telephone, MAXP.telephone),
    email: propre(f.email, MAXP.email),
    ville: propre(f.ville, MAXP.ville),
    zones: propre(f.zones, MAXP.zones),
    vehicules: dans(VEHICULES, f.vehicules),
    permis: f.permis === true,
    assurance: f.assurance === true,
    services: dans(SERVICES_PARTENAIRE, f.services),
    jours: dans(JOURS, f.jours),
    dispos: propre(f.dispos, MAXP.dispos),
    statutFiscal: STATUTS_FISCAUX.includes(f.statutFiscal) ? f.statutFiscal : "",
    experience: propre(f.experience, MAXP.experience),
    message: propre(f.message, MAXP.message),
    majeur: true,
    consentement: true,
  };
}

const lib = (liste, v) => (liste.find((x) => x.v === v) || { l: v }).l;
export function resumeCandidature(c) {
  return [
    `${c.prenom} ${c.nom} · ${c.ville}${c.zones ? ` (zones : ${c.zones})` : ""}`,
    `Déplacement : ${(c.vehicules || []).map((v) => lib(VEHICULES, v)).join(", ")}${c.permis ? " · permis" : ""}${c.assurance ? " · assuré" : ""}`,
    `Services : ${(c.services || []).map((v) => lib(SERVICES_PARTENAIRE, v)).join(", ")}`,
    `Jours : ${(c.jours || []).join(", ")}${c.dispos ? ` · ${c.dispos}` : ""}`,
    c.statutFiscal ? `Statut : ${c.statutFiscal}` : "",
    c.experience ? `Expérience : ${c.experience}` : "",
    c.message ? `Message : ${c.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function messageAcceptation(c, site = SITE) {
  return [
    `Bonjour ${c.prenom},`,
    "Bienvenue chez Rebecca Services ! 🎉",
    `Pour créer ton accès coursier : ouvre ${site}/#/admin, connecte-toi avec ton compte Google ou ton e-mail, puis préviens-moi : j'active ton espace.`,
    "À très vite, Rebecca",
  ].join("\n");
}

/* ---------- Inscription complète des coursiers (18 nov. 2026, étape 2, validée par Rebecca) ----------
   Un seul moyen de déplacement, l'osek, où lui verser l'argent, les documents (photos) selon le véhicule,
   le règlement accepté. Les documents sont rangés à part (documentsPartenaires), lisibles par Rebecca seule.
   Le coursier suit sa candidature avec son lien #/partenaire/ID (statut, motif, documents à refaire). */

export const VEHICULE_UNIQUE = [
  { v: "voiture", l: "Voiture" },
  { v: "scooter", l: "Scooter / moto" },
  { v: "velo", l: "Vélo électrique" },
  { v: "pied", l: "À pied / transports en commun" },
];
export const OSEK = [
  { v: "patour", l: "Osek patour" },
  { v: "mourche", l: "Osek mourché" },
];
export const MAXP2 = { paiement: 200 };
export const docsPour = (vehicule) => documentsRequis(vehicule);

export const REGLEMENT_COURSIERS = [
  "Je fais seulement des livraisons et des courses pour Rebecca Services (jamais de transport de personnes).",
  "Je suis travailleur indépendant (osek) : je déclare moi-même mes revenus.",
  "Commission de Rebecca Services : 15 % de chaque course (minimum 3 ₪), espèces comprises ; 8 % (minimum 2 ₪) pour un commerçant que j'ai apporté et que Rebecca a validé. Le taux est fixé au moment où j'accepte la course.",
  "Les pourboires sont à 100 % pour moi.",
  "Paiements par Bit, Revolut, PayPal ou carte : encaissés par Rebecca et reversés en fin de mois. Espèces : je les garde, leur commission est déduite de mon compte.",
  "En fin de mois, si les commissions dépassent ce que Rebecca a encaissé pour moi, je lui verse la différence. Au-delà de 150 ₪ dus, je ne reçois plus de nouvelles courses jusqu'au paiement.",
  "Pour terminer une course, je prends une photo de preuve de livraison.",
  "Je ne travaille jamais pendant Chabbat et les fêtes juives.",
  "Je respecte les clients, le code de la route et la confidentialité de ce que je transporte.",
  "Rebecca peut suspendre mon compte en cas de problème. Un litige se règle au cas par cas, jamais par une retenue automatique.",
];

export function erreursInscription(f) {
  const e = {};
  if (propre(f.prenom, MAXP.nom).length < 2) e.prenom = "Indiquez votre prénom.";
  if (propre(f.nom, MAXP.nom).length < 2) e.nom = "Indiquez votre nom.";
  const tel = String(f.telephone || "").replace(/\D/g, "");
  if (tel.length < 9 || tel.length > 15) e.telephone = "Numéro de téléphone invalide.";
  if (!EMAIL_OK.test(String(f.email || "").trim())) e.email = "Adresse e-mail invalide.";
  if (propre(f.ville, MAXP.ville).length < 2) e.ville = "Indiquez votre ville.";
  if (!VEHICULE_UNIQUE.some((v) => v.v === f.vehicule)) e.vehicule = "Choisissez votre moyen de déplacement.";
  if (!dans(SERVICES_PARTENAIRE, f.services).length) e.services = "Cochez au moins un service.";
  if (!dans(JOURS, f.jours).length) e.jours = "Cochez au moins un jour.";
  if (!OSEK.some((o) => o.v === f.osek)) e.osek = "Choisissez votre osek (obligatoire pour travailler avec moi).";
  if (propre(f.paiement, MAXP2.paiement).length < 4) e.paiement = "Indiquez où vous verser l'argent (Bit, PayBox ou compte bancaire).";
  if (f.vehicule) {
    const docs = f.documents || {};
    const manquants = docsPour(f.vehicule).filter((d) => !docs[d.id]);
    if (manquants.length) e.documents = "Il manque : " + manquants.map((d) => d.label).join(", ") + ".";
  }
  if (f.reglement !== true) e.reglement = "Lisez et acceptez le règlement des coursiers.";
  if (f.majeur !== true) e.majeur = "Il faut avoir 18 ans ou plus.";
  if (f.consentement !== true) e.consentement = "Cette case est obligatoire.";
  return e;
}

export function construireInscription(f) {
  return {
    statut: "soumis",
    version: 2,
    prenom: propre(f.prenom, MAXP.nom),
    nom: propre(f.nom, MAXP.nom),
    telephone: propre(f.telephone, MAXP.telephone),
    email: propre(f.email, MAXP.email),
    ville: propre(f.ville, MAXP.ville),
    zones: propre(f.zones, MAXP.zones),
    vehicules: [f.vehicule],
    services: dans(SERVICES_PARTENAIRE, f.services),
    jours: dans(JOURS, f.jours),
    dispos: propre(f.dispos, MAXP.dispos),
    osek: f.osek,
    paiement: propre(f.paiement, MAXP2.paiement),
    documentsEnvoyes: docsPour(f.vehicule).map((d) => d.id),
    experience: propre(f.experience, MAXP.experience),
    message: propre(f.message, MAXP.message),
    reglement: true,
    majeur: true,
    consentement: true,
  };
}

// Ce que le coursier voit avec son lien (aucune donnée personnelle en dehors du prénom)
export function suiviInitial(c) {
  return { statut: "soumis", prenom: c.prenom, motif: "", documentsDemandes: [] };
}

export const lienSuiviPartenaire = (id, site = SITE) => `${site}/#/partenaire/${id}`;
export function lireLienPartenaire(hash) {
  const m = /^#\/partenaire\/([A-Za-z0-9]{10,40})$/.exec(hash || "");
  return m ? m[1] : "";
}

export const idDocument = (candidature, type, n = Date.now()) => `${candidature}_${type}_${n}`;

export function messageDecision(c, statut, motif, site) {
  const lien = lienSuiviPartenaire(c.id, site);
  if (statut === "approuve") return `Bonjour ${c.prenom}, bonne nouvelle : ta candidature de coursier partenaire est approuvée ! 🎉\nOuvre ce lien dans Safari ou Chrome, connecte-toi (Google ou e-mail) et touche « Lier mon compte coursier » : ${(site || SITE)}/#/admin?coursier=${c.id}\nJ'active ton espace juste après. Rebecca`;
  if (statut === "complement_demande") return `Bonjour ${c.prenom}, il me manque quelque chose pour ta candidature : ${motif}\nTu peux tout envoyer ici : ${lien}\nMerci ! Rebecca`;
  if (statut === "refuse") return `Bonjour ${c.prenom}, merci pour ta candidature. Je ne peux pas la retenir pour l'instant : ${motif}\nRebecca`;
  if (statut === "suspendu") return `Bonjour ${c.prenom}, ton compte de coursier est suspendu : ${motif}\nAppelle-moi pour en parler. Rebecca`;
  return `Bonjour ${c.prenom}, ta candidature est en cours de vérification. Tu peux la suivre ici : ${lien}\nRebecca`;
}
