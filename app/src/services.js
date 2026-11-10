// LES 8 SERVICES - Rebecca Services
// Chaque service a SON formulaire : les champs ci-dessous sont propres a chaque prestation.
// Les prix ne sont jamais ecrits ici : tout vient de pricing/config.js (base tarifaire unique).
// Chaque service est rattache a un ESPACE (activite) pour l'affichage seulement.
// Le vrai controle d'acces (Transport prive ferme par defaut) sera fait par les regles Firebase v7.

import { TARIFS } from "./pricing/config.js";
import { validerPassager } from "./profil.js";
import { detecterZone } from "./pricing/engine.js";
import { localVersUtc } from "./pricing/calendrier.js";

export const AEROPORT = { label: "Aéroport Ben Gourion (TLV)", lat: 32.0055, lon: 34.8854 };
export const DEPART_ACTIVITE = { label: "Netanya", lat: 32.3215, lon: 34.8532 };

const ouiNon = [
  { v: "non", l: "Non" },
  { v: "oui", l: "Oui" },
];

/* ---------- Espaces (activites) qui ont des formulaires de service ---------- */
// Services beaute et Boutique Epoxy viendront avec leurs propres catalogues (lots suivants).
// visibleParDefaut : false = espace invisible pour tous, sauf les clients que Rebecca autorise un par un.

export const ACTIVITES = {
  slim: {
    id: "slim",
    titre: "Prestige Slim & Lift",
    texte: "Soins minceur et raffermissement : radiofréquence, cavitation, anti-cellulite.",
    visibleParDefaut: true,
    ordre: 6,
    logo: "/brand/logo-prestige-slim-lift.png",
  },
  epoxy: {
    id: "epoxy",
    titre: "Boutique Epoxy",
    texte: "Créations personnalisées en résine : décoration, rangement, Chabbat et fêtes, lampes, bougies…",
    visibleParDefaut: true,
    ordre: 5,
    logo: "/brand/logo-epoxy.png",
  },
  regenx: {
    id: "regenx",
    titre: "RegenX",
    texte: "Reconstruction du cheveu et du poil (sourcils, barbe, cheveux). Diagnostic obligatoire.",
    visibleParDefaut: true,
    ordre: 3,
    logo: "/brand/logo-regenx.png",
  },
  nails: {
    id: "nails",
    titre: "Nails Prestige",
    texte: "Onglerie : semi-permanent, extensions, nail art et soins des mains.",
    visibleParDefaut: true,
    ordre: 2,
    logo: "/brand/logo-nails-prestige.png",
  },
  coursier: {
    id: "coursier",
    titre: "Services coursier",
    texte: "Livraison de colis, clés, documents et enveloppes, courses et achats, petits déménagements.",
    visibleParDefaut: true,
    ordre: 1,
  },
  transport: {
    id: "transport",
    titre: "Transport privé",
    texte: "Trajets, aéroport, Hatan & Kala, ramassage scolaire et mise à disposition.",
    visibleParDefaut: false,
    ordre: 4,
  },
};

/* ---------- Description des services (page d'accueil) ---------- */

export const SERVICES = [
  { id: "transport", activite: "transport", titre: "Transport privé", icone: "🚗", texte: "Un trajet d'une adresse à une autre, aller simple ou aller-retour.", prix: "dès 50 ₪" },
  { id: "aeroport", activite: "transport", titre: "Aéroport Ben Gourion", icone: "✈️", texte: "Départ vers l'aéroport ou arrivée et transfert à votre adresse.", prix: "dès 250 ₪" },
  { id: "livraison", activite: "coursier", titre: "Livraison", icone: "📦", texte: "Colis, clés, documents, enveloppes, achats, petits objets.", prix: "dès 60 ₪" },
  { id: "courses", activite: "coursier", titre: "Courses et achats", icone: "🛍️", texte: "Je récupère vos achats ou je fais les courses pour vous.", prix: "dès 60 ₪" },
  { id: "hatan_kala", activite: "transport", titre: "Hatan & Kala", icone: "💍", texte: "Transport des mariés, décoration du véhicule possible.", prix: "dès 220 ₪" },
  { id: "demenagement", activite: "coursier", titre: "Petit déménagement", icone: "📚", texte: "Valises, cartons, petits objets.", prix: "dès 130 ₪" },
  { id: "ramassage", activite: "transport", titre: "Ramassage scolaire", icone: "🎒", texte: "Je vais chercher votre enfant à l'école ou je l'y emmène : trajet unique ou forfait à la semaine.", prix: "dès 55 ₪ / trajet" },
  { id: "attente", activite: "transport", titre: "Mise à disposition", icone: "⏱️", texte: "Attente, accompagnement, événements : à l'heure.", prix: "100 ₪ / heure" },
];

// Espace d'un service ("coursier" ou "transport")
export const activiteDe = (service) => {
  const s = SERVICES.find((x) => x.id === service);
  return s ? s.activite : null;
};

// Services d'un espace, dans l'ordre d'affichage
export const servicesDe = (activite) => SERVICES.filter((s) => s.activite === activite);

// Espaces a montrer a ce visiteur. acces = { transport: true } quand Rebecca a autorise ce client.
// (Affichage seulement : les regles Firebase v7 refuseront aussi une demande non autorisee.)
export function activitesVisibles(acces = {}) {
  return Object.values(ACTIVITES)
    .filter((a) => a.visibleParDefaut || acces[a.id] === true)
    .sort((a, b) => a.ordre - b.ordre);
}

// Les boutons "Choix rapide" (Dans 1 h, Ce soir, Demain) n'ont pas de sens pour le ramassage scolaire
export const horaireRapidePossible = (service) => service !== "ramassage";

/* ---------- Champs communs ---------- */

const quand = (suffixe = "") => [
  { name: "date", label: "Date" + suffixe, type: "date", required: true },
  { name: "heure", label: "Heure" + suffixe, type: "time", required: true },
];

const retour = [
  { name: "typeTrajet", label: "Type de trajet", type: "choix", required: true, options: [{ v: "simple", l: "Aller simple" }, { v: "ar", l: "Aller-retour" }], defaut: "simple" },
  { name: "dateRetour", label: "Date du retour", type: "date", required: true, si: (v) => v.typeTrajet === "ar" },
  { name: "heureRetour", label: "Heure du retour", type: "time", required: true, si: (v) => v.typeTrajet === "ar" },
  { name: "attenteMinutes", label: "Attente sur place pendant le trajet", type: "select", si: (v) => v.typeTrajet === "ar", defaut: "0", options: [{ v: "0", l: "Aucune" }, { v: "30", l: "30 minutes" }, { v: "60", l: "1 heure" }, { v: "90", l: "1 h 30" }, { v: "120", l: "2 heures" }], indice: "10 minutes offertes, puis 100 ₪ / heure." },
];

// Reserver pour quelqu'un d'autre (transport de personnes uniquement)
const passager = [
  { name: "pourAutrui", label: "Je réserve pour quelqu'un d'autre", type: "case" },
  { name: "passagerNom", label: "Nom du passager", type: "text", required: true, si: (v) => !!v.pourAutrui },
  { name: "passagerTel", label: "Téléphone du passager", type: "tel", required: true, si: (v) => !!v.pourAutrui, indice: "Ses coordonnées servent uniquement à organiser le trajet." },
];

const urgence = { name: "urgent", label: "C'est urgent", type: "case", indice: "Supplément de 30 à 50 ₪ selon le délai." };

export const CHAMPS_CLIENT = [
  { name: "nom", label: "Votre nom", type: "text", required: true, autocomplete: "name" },
  { name: "telephone", label: "Votre téléphone", type: "tel", required: true, autocomplete: "tel", indice: "Pour que Rebecca vous confirme la réservation." },
  { name: "moyenPaiement", label: "Moyen de paiement prévu", type: "select", required: true, options: TARIFS.moyensPaiement.map((m) => ({ v: m, l: m })), defaut: TARIFS.moyensPaiement[0], indice: "Le paiement se fait directement avec Rebecca." },
];

// Code promo : affiche juste avant le devis
export const PROMO_CHAMPS = [
  { name: "promoActif", label: "J'ai un code promo", type: "case" },
  { name: "codePromo", label: "Votre code promo", type: "text", placeholder: "Entrez votre code", si: (v) => !!v.promoActif },
];

/* ---------- Un formulaire par service ---------- */

export const FORMULAIRES = {
  transport: [
    { name: "depart", label: "Adresse de départ", type: "adresse", required: true },
    { name: "arrivee", label: "Adresse d'arrivée", type: "adresse", required: true },
    ...quand(),
    { name: "passagers", label: "Passagers", type: "nombre", min: 1, max: 6, defaut: "1", required: true },
    { name: "bagages", label: "Bagages en soute (grandes valises)", type: "nombre", min: 0, max: 10, defaut: "0", indice: `Petit sac et valise cabine : gratuits. ${TARIFS.bagages.supplementParSoute} ₪ par bagage en soute.` },
    ...retour,
    { name: "arrets", label: "Arrêts supplémentaires", type: "nombre", min: 0, max: 5, defaut: "0", indice: "Le tarif des arrêts vous est communiqué avant validation." },
    urgence,
    ...passager,
    { name: "infos", label: "Informations complémentaires", type: "texte-long" },
  ],

  aeroport: [
    { name: "direction", label: "Que souhaitez-vous ?", type: "choix", required: true, options: [{ v: "vers", l: "Aller à l'aéroport" }, { v: "depuis", l: "Arriver à l'aéroport" }], defaut: "vers" },
    { name: "adresse", label: (v) => (v.direction === "depuis" ? "Adresse de destination" : "Adresse de prise en charge"), type: "adresse", required: true },
    { name: "numeroVol", label: "Numéro de vol", type: "text", required: true, placeholder: "ex. LY001" },
    { name: "compagnie", label: "Compagnie aérienne", type: "text" },
    { name: "terminal", label: "Terminal", type: "select", defaut: "", options: [{ v: "", l: "Je ne sais pas" }, { v: "1", l: "Terminal 1" }, { v: "3", l: "Terminal 3" }] },
    { name: "heureVol", label: (v) => (v.direction === "depuis" ? "Heure d'atterrissage" : "Heure du vol"), type: "time", required: true },
    ...quand(" souhaitée"),
    { name: "passagers", label: "Passagers", type: "nombre", min: 1, max: 6, defaut: "1", required: true },
    { name: "valises", label: "Bagages en soute (grandes valises)", type: "nombre", min: 0, max: 10, defaut: "0", indice: `Petit sac et valise cabine : gratuits. ${TARIFS.bagages.supplementParSoute} ₪ par bagage en soute.` },
    ...retour,
    urgence,
    ...passager,
    { name: "infos", label: "Informations complémentaires", type: "texte-long" },
  ],

  livraison: [
    { name: "recuperation", label: "Adresse de récupération", type: "adresse", required: true },
    { name: "livraison", label: "Adresse de livraison", type: "adresse", required: true },
    { name: "destinataire", label: "Nom du destinataire", type: "text", required: true },
    { name: "telDestinataire", label: "Téléphone du destinataire", type: "tel", required: true },
    { name: "typeColis", label: "Que livrer ?", type: "select", required: true, defaut: "Colis", options: ["Colis", "Clés", "Documents", "Enveloppes", "Achats", "Petit objet"].map((x) => ({ v: x, l: x })) },
    { name: "nbColis", label: "Nombre de colis ou d'objets", type: "nombre", min: 1, max: 30, defaut: "1", indice: "Pour que Rebecca s'organise. Le prix dépend du nombre d'adresses, pas du nombre de colis." },
    ...quand(),
    { name: "nbLivraisons", label: "Nombre de livraisons", type: "select", defaut: "1", options: [1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: String(n) })), indice: `${TARIFS.arretsSupplementaires.netanya} ₪ par livraison supplémentaire dans Netanya ou sur la route ; plus loin, le trajet est ajouté au devis.` },
    ...[2, 3, 4, 5].map((n) => ({ name: "arretL" + n, label: `Adresse de la livraison ${n}`, type: "adresse", required: true, si: (v) => Number(v.nbLivraisons) >= n })),
    urgence,
    { name: "infos", label: "Instructions particulières", type: "texte-long" },
  ],

  courses: [
    { name: "typePrestation", label: "Que souhaitez-vous ?", type: "choix", required: true, defaut: "recuperer", options: [{ v: "recuperer", l: "Récupérer des achats déjà payés" }, { v: "courses", l: "Que je fasse vos courses" }] },
    { name: "articles", label: "Nombre d'articles", type: "nombre", min: 1, max: 100, required: true, defaut: "1", indice: "Au-delà de 10 articles : sur devis." },
    { name: "magasin", label: "Magasin", type: "text", required: true },
    { name: "liste", label: (v) => (v.typePrestation === "courses" ? "Liste des courses" : "Description des achats à récupérer"), type: "texte-long", required: true },
    { name: "avanceArgent", label: "Rebecca avance l'argent des achats", type: "case", si: (v) => v.typePrestation === "courses", indice: "10 % du ticket en frais de gestion. Les achats vous sont facturés à part." },
    { name: "montantTicket", label: "Montant estimé du ticket (₪)", type: "nombre", min: 0, max: 5000, si: (v) => v.typePrestation === "courses" && v.avanceArgent },
    { name: "paiementAchats", label: "Paiement des achats", type: "select", required: true, defaut: "Espèces", options: TARIFS.moyensPaiement.map((m) => ({ v: m, l: m })) },
    { name: "livraison", label: "Adresse de livraison", type: "adresse", required: true },
    ...quand(),
  ],

  hatan_kala: [
    { name: "depart", label: "Adresse de départ", type: "adresse", required: true },
    { name: "arrivee", label: "Adresse d'arrivée (lieu de l'événement)", type: "adresse", required: true },
    ...quand(),
    { name: "nbArrets", label: "Arrêts supplémentaires", type: "select", defaut: "0", options: [0, 1, 2, 3].map((n) => ({ v: String(n), l: n === 0 ? "Aucun" : String(n) })), indice: `${TARIFS.arretsSupplementaires.netanya} ₪ par arrêt dans Netanya ou sur la route ; plus loin, le trajet est ajouté au devis.` },
    ...[1, 2, 3].map((n) => ({ name: "arretH" + n, label: `Adresse de l'arrêt ${n}`, type: "adresse", required: true, si: (v) => Number(v.nbArrets) >= n })),
    { name: "vehiculeReserve", label: "Mise à disposition du véhicule sur la durée", type: "case", indice: "Devis personnalisé." },
    { name: "decoration", label: "Décoration du véhicule (+150 ₪)", type: "case" },
    ...passager,
    { name: "programme", label: "Programme et horaires", type: "texte-long", required: true, placeholder: "Adresses, horaires, déroulé de la journée…" },
  ],

  demenagement: [
    { name: "typeDemenagement", label: "Volume à déménager", type: "choix", required: true, defaut: "valises", options: [{ v: "valises", l: "Quelques valises ou petits objets" }, { v: "cartons", l: "Plusieurs cartons" }, { v: "important", l: "Volume important ou objets lourds" }] },
    { name: "depart", label: "Adresse de départ", type: "adresse", required: true },
    { name: "arrivee", label: "Adresse d'arrivée", type: "adresse", required: true },
    ...quand(),
    { name: "cartons", label: "Nombre de cartons", type: "nombre", min: 0, max: 200, defaut: "0", si: (v) => v.typeDemenagement !== "valises" },
    { name: "objets", label: "Type d'objets", type: "texte-long", required: true },
    { name: "etageDepart", label: "Étage au départ", type: "nombre", min: 0, max: 40, defaut: "0" },
    { name: "ascenseurDepart", label: "Ascenseur au départ", type: "select", defaut: "non", options: ouiNon },
    { name: "etageArrivee", label: "Étage à l'arrivée", type: "nombre", min: 0, max: 40, defaut: "0" },
    { name: "ascenseurArrivee", label: "Ascenseur à l'arrivée", type: "select", defaut: "non", options: ouiNon },
    { name: "manutention", label: "Besoin d'aide pour porter (manutention)", type: "case", indice: "Prix communiqué sur devis." },
    { name: "trajets", label: "Nombre de trajets prévus", type: "nombre", min: 1, max: 5, defaut: "1" },
  ],

  ramassage: [
    { name: "frequence", label: "Fréquence", type: "choix", required: true, defaut: "unique", options: [{ v: "unique", l: "Une seule fois" }, { v: "semaine", l: "Forfait à la semaine" }] },
    { name: "trajetsRamassage", label: "Quels trajets ?", type: "choix", required: true, defaut: "matin", options: [{ v: "matin", l: "Matin : domicile → école" }, { v: "apres", l: "Après-midi : école → domicile" }, { v: "deux", l: "Les deux" }] },
    { name: "enfant", label: "Prénom de l'enfant", type: "text", required: true, indice: "Avec un compte, choisissez votre enfant enregistré : ses informations se remplissent seules." },
    { name: "classe", label: "Classe", type: "text" },
    { name: "telUrgence", label: "Téléphone en cas d'urgence", type: "tel", required: true },
    { name: "personnesAutorisees", label: "Personnes autorisées à récupérer ou accueillir l'enfant", type: "texte-long", required: true, placeholder: "Nom, téléphone et lien avec l'enfant", indice: "Rebecca ne remet l'enfant qu'à ces personnes." },
    { name: "domicile", label: "Adresse du domicile", type: "adresse", required: true },
    { name: "ecole", label: "Adresse de l'école", type: "adresse", required: true },
    { name: "date", label: (v) => (v.frequence === "semaine" ? "Premier jour" : "Date"), type: "date", required: true },
    { name: "heure", label: (v) => (v.trajetsRamassage === "apres" ? "Heure de sortie de l'école" : "Heure de prise en charge au domicile"), type: "time", required: true },
    { name: "heure2", label: "Heure de sortie de l'école", type: "time", required: true, si: (v) => v.trajetsRamassage === "deux" },
    ...["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((j, i) => ({
      name: "jour" + i,
      label: j,
      type: "case",
      si: (v) => v.frequence === "semaine",
      ...(i === 0 ? { indice: "Cochez les jours souhaités. Dès 3 jours : -10 %, 5 jours : -15 %." } : {}),
    })),
    { name: "infos", label: "Informations utiles (code du portail, allergies à connaître…)", type: "texte-long" },
  ],

  attente: [
    ...quand(" de début"),
    { name: "dureeHeures", label: "Durée", type: "select", required: true, defaut: "1", options: [1, 2, 3, 4, 5, 6, 7, 8].map((h) => ({ v: String(h), l: h === 1 ? "1 heure (minimum)" : `${h} heures` })) },
    { name: "dureeSupp", label: "Minutes en plus", type: "select", defaut: "0", options: [{ v: "0", l: "Aucune" }, { v: "15", l: "15 min" }, { v: "30", l: "30 min" }, { v: "45", l: "45 min" }] },
    { name: "depart", label: "Adresse de prise en charge", type: "adresse", required: true },
    { name: "arrivee", label: "Lieu principal", type: "adresse", required: true, indice: "Hors de Netanya, le trajet aller-retour est ajouté au devis." },
    { name: "lieux", label: "Autres lieux (facultatif)", type: "texte-long", placeholder: "Autres adresses concernées" },
    { name: "nbArrets", label: "Arrêts supplémentaires", type: "select", defaut: "0", options: [0, 1, 2, 3].map((n) => ({ v: String(n), l: n === 0 ? "Aucun" : String(n) })), indice: `${TARIFS.arretsSupplementaires.netanya} ₪ par arrêt dans Netanya ou sur la route ; plus loin, le trajet est ajouté au devis.` },
    ...[1, 2, 3].map((n) => ({ name: "arretH" + n, label: `Adresse de l'arrêt ${n}`, type: "adresse", required: true, si: (v) => Number(v.nbArrets) >= n })),
    { name: "programme", label: "Programme", type: "texte-long", required: true },
    ...passager,
    { name: "infos", label: "Informations complémentaires", type: "texte-long" },
  ],
};

/* ---------- Valeurs par defaut ---------- */

export function valeursInitiales(service) {
  const v = {};
  for (const c of [...FORMULAIRES[service], ...CHAMPS_CLIENT, ...PROMO_CHAMPS]) {
    if (c.defaut !== undefined) v[c.name] = c.defaut;
    else if (c.type === "case") v[c.name] = false;
    else v[c.name] = "";
  }
  return v;
}

/* ---------- Pre-remplissage (compte client, enfant enregistre, "Refaire" / "Modifier") ---------- */

// Coordonnees du compte connecte -> champs "Votre nom", "Votre telephone", "Moyen de paiement"
export function valeursDepuisProfil(profil) {
  if (!profil) return {};
  const r = {};
  const nom = [profil.prenom, profil.nom].filter(Boolean).join(" ").trim();
  if (nom) r.nom = nom;
  if (profil.telephone) r.telephone = profil.telephone;
  const moyen = (profil.moyensPreferes || []).find((m) => TARIFS.moyensPaiement.includes(m));
  if (moyen) r.moyenPaiement = moyen;
  return r;
}

// Enfant enregistre dans "Mes informations" -> champs du ramassage scolaire (l'adresse de l'ecole reste a choisir)
export function remplirDepuisEnfant(enfant) {
  if (!enfant) return {};
  const r = {
    enfant: enfant.prenom || "",
    classe: enfant.classe || "",
    telUrgence: enfant.telephoneUrgence || "",
    personnesAutorisees: enfant.personnesAutorisees || "",
  };
  if (enfant.adresse) r.domicile = { label: enfant.adresse };
  return r;
}

// Une adresse enregistree n'a pas toujours ses coordonnees : sans elles, le client la choisit a nouveau
const adresseRelue = (a) => {
  if (!a || typeof a !== "object" || !a.label) return "";
  const r = { label: String(a.label) };
  if (typeof a.lat === "number" && typeof a.lon === "number") {
    r.lat = a.lat;
    r.lon = a.lon;
  }
  return r;
};

// Details d'une ancienne demande ou d'un favori -> valeurs du formulaire.
// garderDate = true pour "Modifier" (meme jour) ; false pour "Refaire ce trajet" (nouvelle date a choisir).
export function valeursDepuisDetails(service, details, garderDate = false) {
  const v = valeursInitiales(service);
  if (!FORMULAIRES[service] || !details) return v;
  const exclus = garderDate ? new Set(["promoActif", "codePromo"]) : new Set(["date", "heure", "dateRetour", "heureRetour", "urgent", "promoActif", "codePromo"]);
  for (const c of FORMULAIRES[service]) {
    if (exclus.has(c.name) || !(c.name in details)) continue;
    const val = details[c.name];
    if (c.type === "adresse") v[c.name] = adresseRelue(val);
    else if (c.type === "case") v[c.name] = val === true;
    else v[c.name] = val === null || val === undefined ? "" : String(val);
  }
  return v;
}

export const champsVisibles = (service, v) => FORMULAIRES[service].filter((c) => !c.si || c.si(v));
export const libelle = (c, v) => (typeof c.label === "function" ? c.label(v) : c.label);

/* ---------- Validation : uniquement ce qui est visible ET obligatoire ---------- */

export function valider(service, v) {
  const erreurs = {};
  for (const c of [...champsVisibles(service, v), ...CHAMPS_CLIENT]) {
    if (!c.required) continue;
    const val = v[c.name];
    if (c.type === "adresse") {
      if (!val || !String(val.label || "").trim()) erreurs[c.name] = "Merci d'indiquer l'adresse.";
    } else if (val === "" || val === undefined || val === null) {
      erreurs[c.name] = "Ce champ est obligatoire.";
    }
  }
  Object.assign(erreurs, validerPassager(v));
  if (service === "ramassage" && v.frequence === "semaine" && ![0, 1, 2, 3, 4, 5].some((i) => v["jour" + i])) erreurs.jour0 = "Choisissez au moins un jour.";
  if (v.telephone && String(v.telephone).replace(/\D/g, "").length < 9) erreurs.telephone = "Numéro de téléphone trop court.";
  if (v.telDestinataire && String(v.telDestinataire).replace(/\D/g, "").length < 9) erreurs.telDestinataire = "Numéro de téléphone trop court.";
  if (service === "ramassage" && v.telUrgence && String(v.telUrgence).replace(/\D/g, "").length < 9) erreurs.telUrgence = "Numéro de téléphone trop court.";
  return erreurs;
}

/* ---------- Quel trajet faut-il calculer (pour la distance) ---------- */

export function trajetACalculer(service, v) {
  let a = null;
  let b = null;
  if (service === "transport" || service === "hatan_kala" || service === "demenagement" || service === "attente") [a, b] = [v.depart, v.arrivee];
  if (service === "livraison") [a, b] = [v.recuperation, v.livraison];
  if (service === "aeroport") [a, b] = v.direction === "depuis" ? [AEROPORT, v.adresse] : [v.adresse, AEROPORT];
  if (service === "courses") [a, b] = [DEPART_ACTIVITE, v.livraison];
  if (service === "ramassage") [a, b] = [v.domicile, v.ecole];
  if (!a || !b) return null;
  if (typeof a.lat !== "number" || typeof b.lat !== "number") return null;
  return { depart: a, arrivee: b };
}

/* ---------- Formulaire -> demande pour le moteur de calcul ---------- */

const nb = (x) => Number(x) || 0;

// Zones (grille) des adresses d'arret : une entree par arret, null si la ville n'est pas dans la grille
const zonesArrets = (v, prefixe, nombre) =>
  Array.from({ length: Math.max(0, nombre || 0) }, (_, i) => detecterZone(v[prefixe + (prefixe === "arretL" ? i + 2 : i + 1)] && v[prefixe + (prefixe === "arretL" ? i + 2 : i + 1)].label));

export function versDemande(service, v, route, maintenantMs = Date.now()) {
  const d = { service, date: v.date, heure: v.heure };
  const trajet = trajetACalculer(service, v);
  if (route) d.aller = { km: route.km, minutes: route.minutes };

  if (service === "transport" || service === "aeroport") {
    const [dep, arr] = service === "aeroport"
      ? (v.direction === "depuis" ? [AEROPORT, v.adresse] : [v.adresse, AEROPORT])
      : [v.depart, v.arrivee];
    d.zoneDepart = detecterZone(dep && dep.label);
    d.zoneArrivee = detecterZone(arr && arr.label);
    d.allerRetour = v.typeTrajet === "ar";
    if (d.allerRetour) {
      d.dateRetour = v.dateRetour;
      d.heureRetour = v.heureRetour;
      d.attenteMinutes = nb(v.attenteMinutes);
    }
    d.arrets = nb(v.arrets);
    d.urgent = !!v.urgent;
    d.bagagesSoute = nb(service === "aeroport" ? v.valises : v.bagages);
  }

  if (service === "livraison") {
    d.zoneDepart = detecterZone(v.recuperation && v.recuperation.label);
    d.zoneArrivee = detecterZone(v.livraison && v.livraison.label);
    d.arretsZones = zonesArrets(v, "arretL", Number(v.nbLivraisons) - 1);
    d.urgent = !!v.urgent;
  }

  if (service === "courses") {
    d.articles = nb(v.articles);
    d.courseFaiteParRebecca = v.typePrestation === "courses";
    d.rebeccaAvanceArgent = d.courseFaiteParRebecca && !!v.avanceArgent;
    d.montantTicket = nb(v.montantTicket);
    d.zoneArrivee = detecterZone(v.livraison && v.livraison.label);
  }

  if (service === "hatan_kala") {
    d.zoneDepart = detecterZone(v.depart && v.depart.label);
    d.zoneArrivee = detecterZone(v.arrivee && v.arrivee.label);
    d.arretsZones = zonesArrets(v, "arretH", Number(v.nbArrets));
    d.vehiculeReserve = !!v.vehiculeReserve;
    d.decoration = !!v.decoration;
  }

  if (service === "demenagement") {
    d.categorie = v.typeDemenagement;
    d.zoneDepart = detecterZone(v.depart && v.depart.label);
    d.zoneArrivee = detecterZone(v.arrivee && v.arrivee.label);
    d.etageDepart = nb(v.etageDepart);
    d.ascenseurDepart = v.ascenseurDepart;
    d.etageArrivee = nb(v.etageArrivee);
    d.ascenseurArrivee = v.ascenseurArrivee;
    d.manutention = !!v.manutention;
    d.trajets = nb(v.trajets) || 1;
  }

  if (service === "ramassage") {
    d.zoneDepart = detecterZone(v.domicile && v.domicile.label);
    d.zoneArrivee = detecterZone(v.ecole && v.ecole.label);
    d.frequence = v.frequence;
    d.trajets = v.trajetsRamassage === "deux" ? 2 : 1;
    d.heure2 = v.heure2;
    d.joursSemaine = [0, 1, 2, 3, 4, 5].filter((i) => v["jour" + i]);
  }

  if (service === "attente") {
    d.dureeMinutes = nb(v.dureeHeures) * 60 + nb(v.dureeSupp);
    d.zoneDepart = detecterZone(v.depart && v.depart.label);
    d.zoneArrivee = detecterZone(v.arrivee && v.arrivee.label);
    d.arretsZones = zonesArrets(v, "arretH", Number(v.nbArrets));
  }

  if (v.urgent && v.date && v.heure) {
    d.minutesAvantDepart = Math.round((localVersUtc(v.date, v.heure) - maintenantMs) / 60000);
  }
  d.codePromo = v.promoActif ? String(v.codePromo || "").trim() : "";
  d._trajet = !!trajet;
  return d;
}

/* ---------- Le calcul a-t-il besoin de la distance ? ---------- */

export const besoinDistance = (service, v) => {
  if (["transport", "aeroport", "livraison", "ramassage"].includes(service)) return true;
  if (service === "hatan_kala") return true; // optionnel mais ameliore le prix
  if (service === "demenagement") return v.typeDemenagement !== "important";
  return false;
};

// Le client ne voit JAMAIS les alertes internes (rentabilite, gain) : seulement ce qui le concerne
export const aConfirmerClient = (devis) => ((devis && devis.aConfirmer) || []).filter((a) => !/^Rentabilité/.test(a));

/* ---------- Message WhatsApp (resume complet de la demande) ---------- */

function texteValeur(c, val) {
  if (c.type === "adresse") return val && val.label ? val.label : "";
  if (c.type === "case") return val ? "Oui" : "";
  if (c.type === "choix" || c.type === "select") {
    const o = (c.options || []).find((x) => x.v === val);
    return o ? o.l : String(val ?? "");
  }
  if (c.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(val || "")) {
    const [a, m, j] = val.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
  return val === undefined || val === null ? "" : String(val);
}

export function messageWhatsApp(service, v, devis) {
  const s = SERVICES.find((x) => x.id === service);
  const a = ACTIVITES[s.activite];
  const lignes = [`Bonjour Rebecca, nouvelle demande : ${s.titre}`, a ? `Espace : ${a.titre}` : "", ""].filter((l, i) => i !== 1 || l);
  for (const c of champsVisibles(service, v)) {
    const t = texteValeur(c, v[c.name]);
    if (t !== "" && t !== "0" && !(c.type === "texte-long" && !t.trim())) lignes.push(`${libelle(c, v)} : ${t}`);
  }
  lignes.push("", `Nom : ${v.nom}`, `Téléphone : ${v.telephone}`, `Paiement prévu : ${v.moyenPaiement}`);
  if (devis) {
    lignes.push("");
    if (devis.devis) lignes.push("Prix : sur devis");
    else if (devis.total != null) lignes.push(`Estimation : ${devis.total} ₪`);
    else lignes.push("Prix : à confirmer");
    const promo = devis.details && devis.details.promo;
    if (promo && promo.statut === "applique") lignes.push(`Code promo : ${promo.code} (-${promo.reduction} ₪)`);
    for (const a of aConfirmerClient(devis)) lignes.push(`• ${a}`);
  }
  lignes.push("", "Merci de me confirmer la disponibilité.");
  return lignes.join("\n");
}
