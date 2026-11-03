// LES 7 SERVICES - Rebecca Transport & Services
// Chaque service a SON formulaire : les champs ci-dessous sont propres a chaque prestation.
// Les prix ne sont jamais ecrits ici : tout vient de pricing/config.js (base tarifaire unique).

import { TARIFS } from "./pricing/config.js";
import { detecterZone } from "./pricing/engine.js";
import { localVersUtc } from "./pricing/calendrier.js";

export const AEROPORT = { label: "Aéroport Ben Gourion (TLV)", lat: 32.0055, lon: 34.8854 };
export const DEPART_ACTIVITE = { label: "Netanya", lat: 32.3215, lon: 34.8532 };

const ouiNon = [
  { v: "non", l: "Non" },
  { v: "oui", l: "Oui" },
];

/* ---------- Description des services (page d'accueil) ---------- */

export const SERVICES = [
  { id: "transport", titre: "Transport privé", icone: "🚗", texte: "Un trajet d'une adresse à une autre, aller simple ou aller-retour.", prix: "dès 50 ₪" },
  { id: "aeroport", titre: "Aéroport Ben Gourion", icone: "✈️", texte: "Départ vers l'aéroport ou arrivée et transfert à votre adresse.", prix: "dès 250 ₪" },
  { id: "livraison", titre: "Livraison", icone: "📦", texte: "Colis, clés, documents, achats, petits objets.", prix: "dès 60 ₪" },
  { id: "courses", titre: "Courses et achats", icone: "🛍️", texte: "Je récupère vos achats ou je fais les courses pour vous.", prix: "dès 60 ₪" },
  { id: "hatan_kala", titre: "Hatan & Kala", icone: "💍", texte: "Transport des mariés, décoration du véhicule possible.", prix: "dès 220 ₪" },
  { id: "demenagement", titre: "Petit déménagement", icone: "📚", texte: "Valises, cartons, petits objets.", prix: "dès 130 ₪" },
  { id: "attente", titre: "Mise à disposition", icone: "⏱️", texte: "Attente, accompagnement, événements : à l'heure.", prix: "100 ₪ / heure" },
];

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
    { name: "infos", label: "Informations complémentaires", type: "texte-long" },
  ],

  livraison: [
    { name: "recuperation", label: "Adresse de récupération", type: "adresse", required: true },
    { name: "livraison", label: "Adresse de livraison", type: "adresse", required: true },
    { name: "destinataire", label: "Nom du destinataire", type: "text", required: true },
    { name: "telDestinataire", label: "Téléphone du destinataire", type: "tel", required: true },
    { name: "typeColis", label: "Que livrer ?", type: "select", required: true, defaut: "Colis", options: ["Colis", "Clés", "Documents", "Achats", "Petit objet"].map((x) => ({ v: x, l: x })) },
    ...quand(),
    { name: "nbLivraisons", label: "Nombre de livraisons", type: "select", defaut: "1", options: [1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: String(n) })), indice: `${TARIFS.arretsSupplementaires.netanya} ₪ par livraison supplémentaire dans Netanya ; ailleurs, le trajet est ajouté au devis.` },
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
    { name: "nbArrets", label: "Arrêts supplémentaires", type: "select", defaut: "0", options: [0, 1, 2, 3].map((n) => ({ v: String(n), l: n === 0 ? "Aucun" : String(n) })), indice: `${TARIFS.arretsSupplementaires.netanya} ₪ par arrêt dans Netanya ; ailleurs, le trajet est ajouté au devis.` },
    ...[1, 2, 3].map((n) => ({ name: "arretH" + n, label: `Adresse de l'arrêt ${n}`, type: "adresse", required: true, si: (v) => Number(v.nbArrets) >= n })),
    { name: "vehiculeReserve", label: "Mise à disposition du véhicule sur la durée", type: "case", indice: "Devis personnalisé." },
    { name: "decoration", label: "Décoration du véhicule (+150 ₪)", type: "case" },
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

  attente: [
    ...quand(" de début"),
    { name: "dureeHeures", label: "Durée", type: "select", required: true, defaut: "1", options: [1, 2, 3, 4, 5, 6, 7, 8].map((h) => ({ v: String(h), l: h === 1 ? "1 heure (minimum)" : `${h} heures` })) },
    { name: "dureeSupp", label: "Minutes en plus", type: "select", defaut: "0", options: [{ v: "0", l: "Aucune" }, { v: "15", l: "15 min" }, { v: "30", l: "30 min" }, { v: "45", l: "45 min" }] },
    { name: "depart", label: "Adresse de prise en charge", type: "adresse", required: true },
    { name: "arrivee", label: "Lieu principal", type: "adresse", required: true, indice: "Hors de Netanya, le trajet aller-retour est ajouté au devis." },
    { name: "lieux", label: "Autres lieux (facultatif)", type: "texte-long", placeholder: "Autres adresses concernées" },
    { name: "arrets", label: "Nombre d'arrêts", type: "nombre", min: 0, max: 10, defaut: "0" },
    { name: "programme", label: "Programme", type: "texte-long", required: true },
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
  if (v.telephone && String(v.telephone).replace(/\D/g, "").length < 9) erreurs.telephone = "Numéro de téléphone trop court.";
  if (v.telDestinataire && String(v.telDestinataire).replace(/\D/g, "").length < 9) erreurs.telDestinataire = "Numéro de téléphone trop court.";
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

  if (service === "attente") {
    d.dureeMinutes = nb(v.dureeHeures) * 60 + nb(v.dureeSupp);
    d.zoneDepart = detecterZone(v.depart && v.depart.label);
    d.zoneArrivee = detecterZone(v.arrivee && v.arrivee.label);
    d.arrets = nb(v.arrets);
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
  if (["transport", "aeroport", "livraison"].includes(service)) return true;
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
  const lignes = [`Bonjour Rebecca, nouvelle demande : ${s.titre}`, ""];
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
