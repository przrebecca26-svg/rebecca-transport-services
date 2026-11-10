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

// ... reste du fichier inchangé (les fonctions et FORMULAIRES restent les mêmes)
