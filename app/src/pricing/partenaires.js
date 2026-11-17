// DEVENIR PARTENAIRE DE REBECCA SERVICES (17 nov. 2026) - inscription des futurs coursiers
// La page #/partenaire existe, mais aucun lien ne la montre sur le site tant que Rebecca ne l'a pas ouverte
// (Admin → Partenaires → « Visible sur le site », document reglages/partenaires.ouvert).
// Une candidature acceptee devient un coequipier comme Jeremy (rubrique Equipe : acces, services, vehicules).

export const VEHICULES = [
  { v: "voiture", l: "Voiture" },
  { v: "scooter", l: "Scooter" },
  { v: "velo", l: "Vélo électrique" },
  { v: "pied", l: "À pied / transports" },
];
export const SERVICES_PARTENAIRE = [
  { v: "livraison", l: "Livraisons (colis, clés, documents)" },
  { v: "courses", l: "Courses et achats" },
  { v: "transport", l: "Transport de personnes" },
  { v: "aeroport", l: "Transferts aéroport" },
  { v: "demenagement", l: "Petits déménagements" },
];
export const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
export const STATUTS_FISCAUX = ["Osek patur", "Osek murshe", "Société", "Pas encore", "Je ne sais pas"];
export const STATUTS_CANDIDATURE = [
  { id: "nouvelle", l: "Nouvelle" },
  { id: "rencontre", l: "Rendez-vous à fixer" },
  { id: "acceptee", l: "Acceptée" },
  { id: "refusee", l: "Refusée" },
];
export const libelleCandidature = (id) => (STATUTS_CANDIDATURE.find((s) => s.id === id) || { l: id }).l;
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

export function messageAcceptation(c, site = "https://rebecca-services-netanya.netlify.app") {
  return [
    `Bonjour ${c.prenom},`,
    "Bienvenue chez Rebecca Services ! 🎉",
    `Pour créer ton accès coursier : ouvre ${site}/#/admin, connecte-toi avec ton compte Google ou ton e-mail, puis préviens-moi : j'active ton espace.`,
    "À très vite, Rebecca",
  ].join("\n");
}
