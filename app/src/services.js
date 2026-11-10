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
  coursier: {
    id: "coursier",
    titre: "Services coursier",
    texte: "Livraison de colis, clés, documents et enveloppes, courses et achats, petits déménagements.",
    visibleParDefaut: true,
    ordre: 1,
  },
  nails: {
    id: "nails",
    titre: "Nails Prestige",
    texte: "Onglerie : semi-permanent, extensions, nail art et soins des mains.",
    visibleParDefaut: true,
    ordre: 2,
    logo: "/brand/logo-nails-prestige.png",
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

// ... (le reste du fichier original est conservé)
