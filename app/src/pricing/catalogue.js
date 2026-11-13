// FONDATIONS (Lot C, seances C1 et C2, 9 nov. 2026) - regles pures - Rebecca Services
// Decision de Rebecca (21h14) : les prix et durees deja valides ensemble sont les valeurs de depart ;
// TOUT reste modifiable dans l'admin (Reglages) : prix, durees, temps entre clientes, horaires,
// ajout d'une prestation beaute ou d'un article Epoxy (nom, descriptif, prix, variantes).
// Source des valeurs de depart : document projet « catalogues-valides-4-nov » (fait foi).
// RegenX : prix JAMAIS ecrits ici (depot public) : Rebecca les saisit dans l'admin, ils restent prives.

import { TARIFS } from "./config.js";

/* ---------- C1 : activites ---------- */

export const TYPES_ACTIVITE = [
  { id: "course", label: "Courses (coursier, transport)" },
  { id: "rendezvous", label: "Rendez-vous" },
  { id: "commande", label: "Commandes (boutique)" },
  { id: "projet", label: "Projets sur devis" },
];

export const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const BEAUTE = { jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00", margeMinutes: 20, acomptePourcent: 20, acompteMin: 10, delaiAcompteHeures: 48, ajustementPourcent: 0 };

// Valeurs de depart (validees le 4 nov.) ; la fiche en base (activites/{id}) les remplace champ par champ
export const ACTIVITES_DEPART = [
  { id: "coursier", nom: "Services coursier", type: "course", couleur: "#B97870", acces: "public", jours: [0, 1, 2, 3, 4, 5], debut: "07:00", fin: "22:00", margeMinutes: 30, acomptePourcent: 20, acompteMin: 10, delaiAcompteHeures: 48 },
  { id: "transport", nom: "Transport privé", type: "course", couleur: "#8C6A9E", acces: "autorisation", jours: [0, 1, 2, 3, 4, 5], debut: "05:00", fin: "23:59", margeMinutes: 30, acomptePourcent: 20, acompteMin: 10, delaiAcompteHeures: 48 },
  { id: "nails", nom: "Nails Prestige", type: "rendezvous", couleur: "#F1AEB7", acces: "public", ...BEAUTE },
  { id: "hair", nom: "Prestige Hair", type: "rendezvous", couleur: "#D9A27E", acces: "public", ...BEAUTE },
  { id: "slim", nom: "Prestige Slim & Lift", type: "rendezvous", couleur: "#9FB8A8", acces: "public", ...BEAUTE },
  // RegenX (decision du 11 nov.) : diagnostic ouvert a tous ; les seances (prix prives) ne sont jamais publiees.
  { id: "regenx", nom: "RegenX", type: "rendezvous", couleur: "#7E9CC0", acces: "public", ...BEAUTE },
  { id: "epoxy", nom: "Boutique Epoxy", type: "commande", couleur: "#C9A86A", acces: "public", jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00", margeMinutes: 0, acomptePourcent: 20, acompteMin: 10, delaiAcompteHeures: 48, fabricationJours: "2 à 5", ajustementPourcent: 0 },
  { id: "digital", nom: "Digital & Applications", type: "projet", couleur: "#B9AEB0", acces: "public", jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00", margeMinutes: 0, acomptePourcent: 40, acompteMin: 0, delaiAcompteHeures: 48 },
];

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const nombre = (x) => {
  const t = String(x == null ? "" : x).trim().replace(",", ".").replace(/\s/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// Fiche effective : valeurs de depart + ce qui est enregistre en base
export function activitesEffectives(enBase = []) {
  const parId = new Map(enBase.map((a) => [a.id, a]));
  return ACTIVITES_DEPART.map((d) => {
    const b = parId.get(d.id) || {};
    const r = { ...d };
    for (const k of Object.keys(d)) if (b[k] !== undefined && b[k] !== null) r[k] = b[k];
    if (b.public === true) r.acces = "public"; // ancien interrupteur v7
    return r;
  });
}

// Verifie une fiche activite modifiee dans l'admin (textes du formulaire)
export function validerActivite(f) {
  const nom = String(f.nom || "").trim();
  if (nom.length < 2 || nom.length > 60) return { erreur: "Nom de 2 à 60 caractères." };
  const jours = [...new Set((f.jours || []).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))].sort();
  if (!jours.length) return { erreur: "Coche au moins un jour." };
  if (!HEURE.test(f.debut || "") || !HEURE.test(f.fin || "") || f.fin <= f.debut) return { erreur: "Vérifie les horaires (la fin après le début)." };
  const marge = nombre(f.margeMinutes);
  const pc = nombre(f.acomptePourcent);
  const min = nombre(f.acompteMin);
  const delai = nombre(f.delaiAcompteHeures);
  if (!Number.isInteger(marge) || marge < 0 || marge > 240) return { erreur: "Temps entre deux clientes : 0 à 240 minutes." };
  if (!(pc >= 0 && pc <= 100)) return { erreur: "Acompte : 0 à 100 %." };
  if (!(min >= 0 && min <= 10000)) return { erreur: "Acompte minimum invalide." };
  if (!Number.isInteger(delai) || delai < 1 || delai > 720) return { erreur: "Délai pour payer l'acompte : 1 à 720 heures." };
  if (!["public", "autorisation"].includes(f.acces)) return { erreur: "Choisis l'accès." };
  const ajust = nombre(f.ajustementPourcent);
  if (ajust !== null && !(ajust >= -90 && ajust <= 100)) return { erreur: "Ajustement des prix : de -90 % à +100 %." };
  return { erreur: "", fiche: { nom, jours, debut: f.debut, fin: f.fin, margeMinutes: marge, acomptePourcent: pc, acompteMin: min, delaiAcompteHeures: delai, acces: f.acces, public: f.acces === "public", ajustementPourcent: ajust || 0 } };
}

/* ---------- C2 : catalogue (beaute, Epoxy) ---------- */

export const TYPES_PRIX = [
  { id: "fixe", label: "Prix fixe" },
  { id: "apartir", label: "À partir de" },
  { id: "parongle", label: "Par ongle (option)" },
  { id: "devis", label: "Sur devis" },
  { id: "prive", label: "Prix privé (jamais affiché)" },
];

// p(activite, categorie, nom, prix, dureeMinutes, extra)
let ordre = 0;
const p = (activite, categorie, nom, prix, duree, extra = {}) => ({
  id: `${activite}-${String(++ordre).padStart(3, "0")}`,
  activite,
  categorie,
  nom,
  description: "",
  typePrix: "fixe",
  prix,
  prixMax: null,
  dureeMinutes: duree,
  option: false,
  variantes: [],
  // Publie par defaut (decision du 10 nov.) ; un prix prive (seances RegenX) n'est JAMAIS publie.
  publiee: extra.typePrix !== "prive",
  ordre,
  ...extra,
});

// Valeurs de depart (catalogues valides le 4 nov.). publiee: false tant que l'activite n'est pas ouverte.
export const CATALOGUE_DEPART = [
  // Nails Prestige (prix de lancement)
  p("nails", "Mains", "Semi-permanent (VSP)", 100, 90),
  p("nails", "Mains", "Beauté des mains", 100, 60),
  p("nails", "Gel", "Extensions gel + VSP", 220, 180),
  p("nails", "Gel", "Remplissage gel", 140, 120),
  p("nails", "Acrylique", "Pose acrylique + VSP", 250, 180),
  p("nails", "Acrylique", "Remplissage acrylique", 160, 120),
  p("nails", "Gel", "Flash Gel-X", 200, 180),
  p("nails", "Gel", "Gel de construction", 420, 180),
  p("nails", "Gel", "Remplissage gel de construction", 220, 120),
  p("nails", "Mains", "Mivne anatomie (gainage)", 160, 120),
  p("nails", "Mains", "Renforcement", 160, 120),
  p("nails", "Déposes", "Dépose Gel-X / gel", 60, 40, { description: "Offerte si la pose a été réalisée par Rebecca." }),
  p("nails", "Déposes", "Dépose acrylique / gel de construction", 80, 40, { description: "Offerte si la pose a été réalisée par Rebecca." }),
  p("nails", "Options", "Nail art (par ongle)", 20, 15, { typePrix: "parongle", prixMax: 120, option: true }),
  p("nails", "Options", "Réparation ou rajout (par ongle)", 20, 45, { typePrix: "parongle", option: true }),
  p("nails", "Enfants", "Semi-permanent enfant (12 ans minimum)", 60, 60),
  // Prestige Hair
  p("hair", "Brushing", "Brushing cheveux courts", 100, 45),
  p("hair", "Brushing", "Brushing cheveux mi-longs", 120, 60),
  p("hair", "Brushing", "Brushing cheveux longs", 140, 90),
  p("hair", "Coupe", "Coupe enfant (-12 ans)", 60, 30),
  p("hair", "Coupe", "Coupe homme", 90, 45),
  p("hair", "Coupe", "Shampoing + coupe + brushing", 180, 105),
  p("hair", "Coupe", "Coupe cheveux longs + shampoing + brushing", 250, 120),
  p("hair", "Couleur", "Couleur racines + shampoing + brushing", 250, 120),
  p("hair", "Couleur", "Couleur tête entière + shampoing + brushing", 350, 150),
  p("hair", "Couleur", "Patine / gloss + shampoing + brushing", 220, 90),
  p("hair", "Couleur", "Mèches papier aluminium", 550, 240),
  p("hair", "Soirée", "Coiffure soirée", 450, 60),
  p("hair", "Soirée", "Chignon soirée élaboré", 550, 90),
  p("hair", "Mariée", "Coiffure mariée, jour J", 1200, 150, { acomptePourcent: 40 }),
  p("hair", "Mariée", "Essai coiffure mariée (facultatif)", 500, 60, { acomptePourcent: 40 }), // 13 nov. 2026 : 40 % comme le jour J
  // Prestige Slim & Lift (aucun code promo sur une cure ; cures payables en 4 fois maximum)
  p("slim", "Bilan", "Bilan personnalisé (facultatif)", 150, 60),
  p("slim", "Radiofréquence", "Radiofréquence visage ou cou", 250, 45),
  p("slim", "Radiofréquence", "Radiofréquence corps (1 zone)", 300, 60),
  p("slim", "Cavitation", "Cavitation ultrasonique (1 zone)", 300, 60),
  p("slim", "Cavitation", "Cavitation + radiofréquence (1 zone)", 450, 90),
  p("slim", "Forfaits", "Forfait radiofréquence ventre & taille", 450, 90),
  p("slim", "Forfaits", "Forfait radiofréquence fesses & cuisses", 450, 90),
  p("slim", "Anti-cellulite", "Anti-cellulite cuisses & fesses, séance unique", 450, 90),
  p("slim", "Anti-cellulite", "Anti-cellulite, cure 8 séances", 2700, 90, { seances: 8, sansPromo: true, versementsMax: 4 }),
  p("slim", "Anti-cellulite", "Anti-cellulite, cure 10 séances", 3000, 90, { seances: 10, sansPromo: true, versementsMax: 4 }),
  // RegenX : durees seulement ; prix prives saisis par Rebecca
  p("regenx", "Diagnostic", "Diagnostic (obligatoire)", 150, 60, { acompteFixe: 30 }),
  p("regenx", "Sourcils", "Sourcils", null, 45, { typePrix: "prive" }),
  p("regenx", "Barbe", "Barbe, 1 zone", null, 60, { typePrix: "prive" }),
  p("regenx", "Barbe", "Barbe, plusieurs zones", null, 120, { typePrix: "prive" }),
  p("regenx", "Barbe", "Barbe entière", null, 120, { typePrix: "prive" }),
  p("regenx", "Cheveux", "Cheveux, 1 zone", null, 60, { typePrix: "prive" }),
  p("regenx", "Cheveux", "Cheveux, plusieurs zones", null, 120, { typePrix: "prive" }),
  p("regenx", "Cheveux", "Cheveux, tête entière", null, 120, { typePrix: "prive" }), // 2 h (decision du 11 nov.) ; Rebecca ajuste par client apres le diagnostic
  // Boutique Epoxy (liste de Rebecca, 9 nov. 2026, 21h24). Variantes a deux prix : Rebecca les renomme dans l'admin.
  ...EPOXY_DEPART(),
  // Digital & Applications
  p("digital", "Formules", "Formule Essentielle", 6900, null, { description: "Site web responsive, présentation des services, espace client, demandes et réservations, base de données, notifications.", publiee: true }),
  p("digital", "Formules", "Formule Business", 14900, null, { description: "Espace client et administration, gestion des clients, commandes et réservations, tableau de bord, gestion des tarifs, historique, automatisations et tests.", publiee: true }),
  p("digital", "Formules", "Formule Sur mesure", null, null, { typePrix: "devis", description: "Architecture personnalisée, gestion avancée des droits, réservations complexes, paiements et API, automatisations, statistiques et fonctionnalités spécifiques.", publiee: true }),
  // Forfaits de maintenance valides le 5 nov. (document projet digital-d3-garantie-etudes-maintenance), prix par mois
  p("digital", "Maintenance", "Sérénité", 250, null, { description: "Par mois. 30 minutes incluses, réponse sous 3 jours ouvrés. Petites corrections." }),
  p("digital", "Maintenance", "Confort", 450, null, { description: "Par mois. 1 h 30 incluse, réponse sous 48 heures ouvrées. Corrections et petites modifications." }),
  p("digital", "Maintenance", "Premium", 750, null, { description: "Par mois. 3 heures incluses, réponse sous 24 heures ouvrées. Corrections, modifications et évolutions mineures." }),
];

function EPOXY_DEPART() {
  // Logos ou formes de marques : caches jusqu'a l'avis d'un juriste (decision du 4 nov.)
  const MARQUE = "Modèle à logo ou forme de marque : à garder non publié jusqu'à l'avis d'un juriste.";
  const e = (categorie, nom, prix, extra = {}) => p("epoxy", categorie, nom, prix, null, { delaiFabrication: "2 à 5 jours", ...extra });
  const v = (...paires) => ({ prix: null, variantes: paires.map(([nom, prix]) => ({ nom, prix })) });
  return [
    e("Décoration", "Cendrier", null, v(["Petit", 65], ["Moyen", 125], ["Grand", 195])),
    e("Décoration", "Support de téléphone", 65),
    e("Décoration", "Carrousel", null, v(["Avec lumière", 150], ["Sans lumière", 125])),
    e("Décoration", "Vase petit", 125),
    e("Décoration", "Miroir coquillages", 45),
    e("Décoration", "Vase sac", 550, { description: MARQUE }),
    e("Rangement", "Petite boîte à bijoux", 55),
    e("Rangement", "Boîte de rangement", null, v(["Petite", 75], ["Moyenne", 95], ["Grande", 120])),
    e("Rangement", "Grande boîte rectangulaire", 195),
    e("Rangement", "Verre à pinceaux", 120),
    e("Rangement", "Boîte de rangement à maquillage", 155),
    e("Rangement", "Bol de rangement", 125),
    e("Salle de bain", "Porte-savon", 85),
    e("Salle de bain", "Bouteille distributeur à savon", 125),
    e("Plateaux", "Plateau", null, v(["Petit", 185], ["Grand", 195], ["Grand rond", 450])),
    e("Plateaux", "Plateau tortue", 185),
    e("Cuisine et table", "Porte-cuillère", 125),
    e("Bijoux et accessoires", "Bracelet", 45),
    e("Bijoux et accessoires", "Collier", 45),
    e("Bijoux et accessoires", "Porte-clés", 60),
    e("Bijoux et accessoires", "Bague", 35),
    e("Bijoux et accessoires", "Boucles d'oreilles", 55),
    e("Mobilier", "Table ronde", 2000, { delaiFabrication: "sur commande" }),
    e("Mobilier", "Table rectangle", 3500, { delaiFabrication: "sur commande" }),
    e("Chabbat et fêtes", "Plateau de Chabbat sans poignée", 200),
    e("Chabbat et fêtes", "Plateau de Chabbat avec poignée", 250),
    e("Chabbat et fêtes", "Plateau de Chabbat grand rond", 450),
    e("Chabbat et fêtes", "Verre de Kiddouch", 250),
    e("Chabbat et fêtes", "Salière", 150),
    e("Chabbat et fêtes", "Kit Havdala (2 boîtes, 1 bougie et clous de girofle)", 100),
    e("Chabbat et fêtes", "Keli (Netilat Yadayim)", 200),
    e("Chabbat et fêtes", "Porte-serviettes (lot de 6)", 150),
    e("Chabbat et fêtes", "Hanoukia", null, v(["Variante 1", 450], ["Variante 2", 550])),
    e("Lampes", "Lampe", 450),
    e("Lampes", "Lampe logo", null, { ...v(["Petit", 450], ["Grand", 550]), description: MARQUE }),
    e("Lampes", "Lampe sac", null, { ...v(["Petit", 450], ["Grand", 550]), description: MARQUE }),
    e("Bougies", "Bougie logo", null, { ...v(["Petit", 350], ["Grand", 450]), description: MARQUE }),
    e("Bougies", "Bougie sac", null, { ...v(["Petit", 350], ["Grand", 450]), description: MARQUE }),
    e("Bougies", "Bougie bouteille de champagne", 350),
    e("Bougies", "Bougie carrousel", 150),
    e("Bougies", "Bougie tortue", 75),
    e("Bougies", "Bougie parfumée dans sa boîte Epoxy", 250),
    e("Créations souvenir", "Création personnalisée", null, { typePrix: "devis", description: "Sur demande" }),
    e("Collection Haesh Sheli", "Article Haesh Sheli", null, { typePrix: "devis", description: "Sur demande" }),
  ];
}

export const ACTIVITES_CATALOGUE = ["nails", "hair", "slim", "regenx", "epoxy", "digital"];

// Categories proposees pour la boutique Epoxy (releve Instagram) ; Rebecca ajoute ses articles
export const CATEGORIES_EPOXY = ["Décoration", "Rangement", "Salle de bain", "Plateaux", "Cuisine et table", "Bijoux et accessoires", "Mobilier", "Chabbat et fêtes", "Lampes", "Bougies", "Créations souvenir", "Collection Haesh Sheli"];

/* ---------- Photos d'un article ou d'une prestation (Rebecca, 21h26) ----------
 Firebase Storage demande le plan payant : les photos sont reduites dans le navigateur (1000 px, JPEG)
 et rangees chacune dans un document « photosCatalogue » (gratuit, limite 1 Mo par document). */
export const PHOTO = { cote: 1000, qualite: 0.72, maxOctets: 700000, maxParArticle: 12, maxGalerie: 30, maxGalerieArticle: 30, legendeMax: 200 };
// 12 nov. 2026 : chaque article a UNE photo principale (photosCatalogue, prestationId = id de l'article) et une
// galerie (prestationId = id de l'article + GALERIE_ARTICLE), chargee seulement quand la cliente ouvre l'article.
export const GALERIE_ARTICLE = "~galerie";
export function validerPhoto({ donnees, legende = "" } = {}) {
  if (typeof donnees !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(donnees)) return { erreur: "Photo illisible." };
  if (donnees.length > PHOTO.maxOctets) return { erreur: "Photo trop lourde même après réduction : essaie une autre photo." };
  const l = String(legende || "").trim();
  if (l.length > PHOTO.legendeMax) return { erreur: "Description trop longue (200 caractères maximum)." };
  return { erreur: "", photo: { donnees, legende: l } };
}

// Verifie une prestation ou un article avant enregistrement (textes du formulaire)
export function validerPrestation(f) {
  const nom = String(f.nom || "").trim();
  const categorie = String(f.categorie || "").trim();
  const description = String(f.description || "").trim();
  if (!ACTIVITES_CATALOGUE.includes(f.activite)) return { erreur: "Activité inconnue." };
  if (nom.length < 2 || nom.length > 100) return { erreur: "Nom de 2 à 100 caractères." };
  if (!categorie || categorie.length > 60) return { erreur: "Indique la catégorie." };
  if (description.length > 1000) return { erreur: "Descriptif trop long (1000 caractères maximum)." };
  if (!TYPES_PRIX.some((t) => t.id === f.typePrix)) return { erreur: "Choisis le type de prix." };
  const prix = nombre(f.prix);
  const prixMax = nombre(f.prixMax);
  const duree = nombre(f.dureeMinutes);
  const aVariantes = (f.variantes || []).some((v) => String(v.nom || "").trim() || String(v.prix ?? "").trim());
  const sansPrix = f.typePrix === "devis" || f.typePrix === "prive" || aVariantes;
  if (!sansPrix && !(prix >= 0 && prix <= 100000)) return { erreur: "Indique le prix (en ₪), ou des variantes avec leur prix." };
  if (sansPrix && prix !== null && !(prix >= 0 && prix <= 100000)) return { erreur: "Prix invalide." };
  if (prixMax !== null && !(prixMax >= (prix || 0) && prixMax <= 100000)) return { erreur: "Prix maximum invalide." };
  const commande = f.activite === "epoxy";
  if (!commande && !(Number.isInteger(duree) && duree >= 5 && duree <= 600)) return { erreur: "Durée en minutes (5 à 600)." };
  const variantes = (f.variantes || [])
    .map((v) => ({ nom: String(v.nom || "").trim(), prix: nombre(v.prix) }))
    .filter((v) => v.nom || v.prix !== null);
  if (variantes.some((v) => !v.nom || v.nom.length > 40 || v.prix === null || !(v.prix >= 0 && v.prix <= 100000))) return { erreur: "Chaque variante : un nom et un prix." };
  if (variantes.length > 6) return { erreur: "6 variantes maximum." };
  const delai = commande ? String(f.delaiFabrication || "").trim().slice(0, 40) : "";
  const r = {
    activite: f.activite,
    categorie,
    nom,
    description,
    typePrix: f.typePrix,
    prix: prix === null ? null : prix,
    prixMax: prixMax === null ? null : prixMax,
    dureeMinutes: commande ? null : duree,
    option: f.option === true,
    variantes,
    publiee: f.publiee === true && f.typePrix !== "prive", // un prix prive n'est jamais publie (regles v12)
    ordre: Number.isFinite(Number(f.ordre)) ? Number(f.ordre) : 999,
  };
  if (commande) r.delaiFabrication = delai;
  return { erreur: "", prestation: r };
}

/* ---------- Ajustement de tous les prix d'une activite (Rebecca, 9 nov. 2026, 21h21) ----------
 Ex. -10 % sur tous les prix Nails : les prix de base restent enregistres tels quels ;
 le prix affiche = prix de base x (1 + ajustement), arrondi aux 5 ₪ les plus proches. 0 = retour aux prix de base.
 Les prix prives (RegenX) et « sur devis » ne sont jamais ajustes. */
export function prixAjuste(prix, ajustementPourcent = 0) {
  if (prix == null || !Number.isFinite(Number(prix))) return prix;
  const a = Number(ajustementPourcent) || 0;
  if (!a) return Number(prix);
  return Math.max(0, Math.round((Number(prix) * (1 + a / 100)) / 5) * 5);
}

// Prestation telle qu'affichee, avec l'ajustement de son activite
export function avecAjustement(x, ajustementPourcent = 0) {
  if (!x || !ajustementPourcent || x.typePrix === "prive" || x.typePrix === "devis") return x;
  return {
    ...x,
    prix: prixAjuste(x.prix, ajustementPourcent),
    prixMax: x.prixMax == null ? null : prixAjuste(x.prixMax, ajustementPourcent),
    variantes: (x.variantes || []).map((v) => ({ ...v, prix: prixAjuste(v.prix, ajustementPourcent) })),
  };
}

// Affichage d'un prix pour l'admin et le site
export function libellePrix(x, devise = "₪") {
  if (!x) return "";
  if (x.typePrix === "devis") return "Sur devis";
  if (x.typePrix === "prive") return x.prix != null ? `${x.prix} ${devise} (privé)` : "Prix privé à saisir";
  if (x.variantes && x.variantes.length) return x.variantes.map((v) => `${v.nom} ${v.prix} ${devise}`).join(" · ");
  const base = x.prix == null ? "?" : `${x.prix}${x.prixMax ? " à " + x.prixMax : ""} ${devise}`;
  if (x.typePrix === "apartir") return "À partir de " + base;
  if (x.typePrix === "parongle") return base + " par ongle";
  return base;
}

// Accepte une duree en minutes OU une prestation entiere (on lit alors sa duree)
export function libelleDuree(x) {
  const min = x && typeof x === "object" ? x.dureeMinutes : x;
  if (!Number.isFinite(min) || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : `${m} min`;
}

// Ce qu'un client peut voir d'une prestation : jamais un prix prive
export function vuePublique(x) {
  if (!x || x.publiee !== true) return null;
  const v = { ...x };
  if (v.typePrix === "prive") v.prix = null;
  return v;
}

/* ---------- C2 : tarifs Transport et coursier modifiables (reglages/tarifs) ---------- */
// Chaque champ = un chemin dans TARIFS. Valeur de depart = celle du code (prix en ligne, inchanges).

const z = (id, nom) => [
  { chemin: `zones.${id}.grilleB.simple`, label: `${nom} : aller simple`, unite: "₪", groupe: "Grille des destinations" },
  { chemin: `zones.${id}.grilleB.parTrajetAR`, label: `${nom} : par trajet en aller-retour`, unite: "₪", groupe: "Grille des destinations" },
  { chemin: `zones.${id}.minimum`, label: `${nom} : minimum`, unite: "₪", groupe: "Grille des destinations" },
];

export const TARIFS_EDITABLES = [
  ...z("netanya", "Netanya et alentours"),
  ...z("hadera", "Hadera"),
  ...z("herzliya_raanana", "Herzliya / Ra'anana"),
  ...z("tel_aviv", "Tel-Aviv"),
  ...z("ben_gurion", "Aéroport Ben Gourion"),
  ...z("haifa", "Haïfa"),
  ...z("jerusalem", "Jérusalem"),
  { chemin: "netanyaPlafond.prix", label: "Plafond d'une course dans Netanya", unite: "₪", groupe: "Grille des destinations" },
  { chemin: "urgence.standard", label: "Urgence", unite: "₪", groupe: "Suppléments" },
  { chemin: "urgence.immediate", label: "Urgence dans l'heure", unite: "₪", groupe: "Suppléments" },
  { chemin: "nuit.0.pourcentage", label: "Nuit 22 h - minuit", unite: "%", pourcent: true, groupe: "Suppléments" },
  { chemin: "nuit.1.pourcentage", label: "Nuit minuit - 6 h", unite: "%", pourcent: true, groupe: "Suppléments" },
  { chemin: "bagages.supplementParSoute", label: "Par grande valise en soute", unite: "₪", groupe: "Suppléments" },
  { chemin: "arretsSupplementaires.netanya", label: "Arrêt supplémentaire dans Netanya", unite: "₪", groupe: "Suppléments" },
  { chemin: "arretsSupplementaires.surLaRoute", label: "Arrêt supplémentaire sur la route", unite: "₪", groupe: "Suppléments" },
  { chemin: "attente.tarifHeure", label: "Attente et mise à disposition, par heure", unite: "₪", groupe: "Attente" },
  { chemin: "attente.toleranceMinutes", label: "Tolérance d'attente", unite: "min", groupe: "Attente" },
  { chemin: "livraison.minimum", label: "Livraison : minimum", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "livraison.plafondAvantDevis", label: "Livraison : au-delà, sur devis", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "livraison.urgence", label: "Livraison urgente", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "courses.achatsDejaPayes.0.prix", label: "Achats déjà payés, jusqu'à 5 articles", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "courses.achatsDejaPayes.1.prix", label: "Achats déjà payés, jusqu'à 10 articles", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "courses.courseFaiteParRebecca.0.prix", label: "Je fais les courses, jusqu'à 5 articles", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "courses.courseFaiteParRebecca.1.prix", label: "Je fais les courses, jusqu'à 10 articles", unite: "₪", groupe: "Livraison et courses" },
  { chemin: "courses.fraisAvanceAchats", label: "Frais si j'avance l'argent des achats", unite: "%", pourcent: true, groupe: "Livraison et courses" },
  { chemin: "hatanKala.base", label: "Hatan & Kala : transport simple", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "hatanKala.decoration", label: "Hatan & Kala : décoration du véhicule", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "hatanKala.prestationHorsNetanya", label: "Hatan & Kala : prestation hors Netanya", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "demenagement.valises", label: "Déménagement : valises ou petits objets", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "demenagement.cartons", label: "Déménagement : plusieurs cartons", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "demenagement.parEtageSansAscenseur", label: "Déménagement : par étage sans ascenseur", unite: "₪", groupe: "Hatan & Kala et déménagement" },
  { chemin: "ramassage.reductions.0.pourcentage", label: "Ramassage : réduction 5 jours ou plus", unite: "%", pourcent: true, groupe: "Ramassage scolaire" },
  { chemin: "ramassage.reductions.1.pourcentage", label: "Ramassage : réduction 3 jours ou plus", unite: "%", pourcent: true, groupe: "Ramassage scolaire" },
  { chemin: "ramassage.reductionMois", label: "Ramassage : réduction forfait au mois", unite: "%", pourcent: true, groupe: "Ramassage scolaire" },
  { chemin: "ramassage.reductionPlusieursEnfants", label: "Ramassage : réduction plusieurs enfants (forfait)", unite: "%", pourcent: true, groupe: "Ramassage scolaire" },
  { chemin: "tournee.margeRouteMinutes", label: "Tournée : marge de route à chaque déplacement", unite: "min", groupe: "Ramassage scolaire" },
  { chemin: "tournee.arretMinutes", label: "Tournée : temps d'arrêt (monter ou descendre)", unite: "min", groupe: "Ramassage scolaire" },
  { chemin: "tournee.retardMaxMinutes", label: "Tournée : retard maximum à une sortie d'école", unite: "min", groupe: "Ramassage scolaire" },
  { chemin: "tournee.places", label: "Tournée : places pour les enfants dans la voiture", unite: "", groupe: "Ramassage scolaire" },
  { chemin: "tournee.retourMaisonMinutes", label: "Tournée : je rentre à la maison s'il reste au moins", unite: "min", groupe: "Ramassage scolaire" },
  { chemin: "carburant.prixLitre", label: "Prix du litre d'essence", unite: "₪", decimales: true, groupe: "Calcul du prix" },
  { chemin: "tempsParHeure", label: "Valeur de mon heure de travail", unite: "₪", groupe: "Calcul du prix" },
];

const lireChemin = (o, chemin) => chemin.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function ecrireChemin(o, chemin, v) {
  const k = chemin.split(".");
  let x = o;
  for (let i = 0; i < k.length - 1; i++) {
    if (x[k[i]] == null) return false;
    x = x[k[i]];
  }
  if (typeof x[k[k.length - 1]] !== "number") return false;
  x[k[k.length - 1]] = v;
  return true;
}

// Valeurs de depart (copiees une seule fois, avant toute modification venue de la base)
export const TARIFS_DEPART = Object.fromEntries(TARIFS_EDITABLES.map((c) => [c.chemin, lireChemin(TARIFS, c.chemin)]));

export const valeurTarif = (chemin, t = TARIFS) => lireChemin(t, chemin);

// Applique les valeurs enregistrees (reglages/tarifs) sur la base tarifaire. Chemin inconnu ou valeur invalide = ignore.
// valeurs absentes = retour aux valeurs de depart.
export function appliquerTarifs(valeurs = {}, t = TARIFS) {
  let n = 0;
  for (const c of TARIFS_EDITABLES) {
    const v = Object.prototype.hasOwnProperty.call(valeurs, c.chemin) ? Number(valeurs[c.chemin]) : TARIFS_DEPART[c.chemin];
    const ok = Number.isFinite(v) && v >= 0 && v <= (c.pourcent ? 1 : 100000);
    if (ok && ecrireChemin(t, c.chemin, v)) n++;
  }
  return n;
}

// Verifie le formulaire de l'admin. saisie : { chemin: "texte" } ; les pourcentages sont saisis en % (15 = 0,15).
// Renvoie seulement les valeurs differentes du depart (le document reste petit).
export function validerTarifs(saisie = {}) {
  const valeurs = {};
  for (const c of TARIFS_EDITABLES) {
    if (!(c.chemin in saisie)) continue;
    const n = nombre(saisie[c.chemin]);
    if (n === null || Number.isNaN(n) || n < 0 || (c.pourcent ? n > 100 : n > 100000)) return { erreur: `Vérifie : ${c.label}.` };
    const v = c.pourcent ? Math.round(n * 100) / 10000 : Math.round(n * 100) / 100;
    if (v !== TARIFS_DEPART[c.chemin]) valeurs[c.chemin] = v;
  }
  return { erreur: "", valeurs };
}

// Lecture du document reglages/tarifs (champ json)
export function lireTarifs(json) {
  try {
    const o = JSON.parse(json || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
