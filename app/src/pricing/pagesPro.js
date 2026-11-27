// GENERATEUR DE PAGES PROFESSIONNELLES - lot 1 (27 nov. 2026) - Rebecca Services
// Logique pure (sans Firebase), testee dans tests/pagesPro.test.mjs. Cahier des charges : section 9.
// Principe (Rebecca, 27 nov.) : elle cree elle-meme, depuis son iPhone, les pages de ses clients (Referencement,
// Vitrine, Business, Pack Pro) sans code, sans GitHub, sans Netlify. Une page = des DONNEES (contenu separe du style) ;
// un seul moteur d'affichage (components/PageProVue.jsx) dessine toutes les pages.
// La formule et les options viennent du DOSSIER du pro (pricing/pros.js) : jamais saisies deux fois.
// Les prix de depart viennent de la grille Digital (reglages/digitalPro) ; chaque client peut avoir son propre tarif,
// fige dans son historique (« contrats ») : un changement de la grille ne touche jamais un tarif deja accepte.
//
// Donnees (regles v42) :
//  - pagesProAdmin/{pageId}   : la page complete (brouillon, tarif, contrats, notes, poids des photos) - Rebecca seule
//  - pagesProVersions/{pageId}: les 5 dernieres versions publiees (TEXTE seulement : les photos sont referencees par
//                               leur numero, jamais recopiees) - Rebecca seule
//  - pagesPubliques/{adresse} : la version EN LIGNE (sans tarif ni notes) - lecture d'UNE page par son adresse
//  - pagesApercus/{jeton}     : apercu prive envoye au client (lien secret, jamais listable)
//  - pagesPhotos/{photoId}    : une photo par document, lisible seulement par son numero

const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
const COULEUR_OK = /^#[0-9a-fA-F]{6}$/;
const couleur = (c, defaut) => (COULEUR_OK.test(String(c || "")) ? String(c).toLowerCase() : defaut);
export const ID_PHOTO_OK = /^[A-Za-z0-9]{12,40}$/;
export const MAX_GALERIE = 20;
export const MAX_PRODUITS = 30;
export const MAX_VERSIONS = 5;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Polices (Google Fonts gratuites, chargees seulement sur la page du pro) ---------- */
export const POLICES = [
  { id: "playfair", nom: "Playfair Display", famille: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@500;700" },
  { id: "cormorant", nom: "Cormorant Garamond", famille: "'Cormorant Garamond', Georgia, serif", google: "Cormorant+Garamond:wght@500;700" },
  { id: "dmserif", nom: "DM Serif Display", famille: "'DM Serif Display', Georgia, serif", google: "DM+Serif+Display" },
  { id: "lora", nom: "Lora", famille: "'Lora', Georgia, serif", google: "Lora:wght@400;600" },
  { id: "greatvibes", nom: "Great Vibes (manuscrite)", famille: "'Great Vibes', cursive", google: "Great+Vibes" },
  { id: "montserrat", nom: "Montserrat", famille: "'Montserrat', Arial, sans-serif", google: "Montserrat:wght@400;600;700" },
  { id: "poppins", nom: "Poppins", famille: "'Poppins', Arial, sans-serif", google: "Poppins:wght@400;600;700" },
  { id: "manrope", nom: "Manrope", famille: "'Manrope', Arial, sans-serif", google: "Manrope:wght@400;600;800" },
  { id: "inter", nom: "Inter", famille: "'Inter', Arial, sans-serif", google: "Inter:wght@400;600" },
  { id: "josefin", nom: "Josefin Sans", famille: "'Josefin Sans', Arial, sans-serif", google: "Josefin+Sans:wght@400;600" },
  { id: "oswald", nom: "Oswald", famille: "'Oswald', Arial, sans-serif", google: "Oswald:wght@500;600" },
  { id: "heebo", nom: "Heebo (lisible en hébreu)", famille: "'Heebo', Arial, sans-serif", google: "Heebo:wght@400;600;700" },
];
export const police = (id) => POLICES.find((p) => p.id === id) || POLICES[8];
export const lienPolices = (ids) => `https://fonts.googleapis.com/css2?${[...new Set(ids)].map((id) => "family=" + police(id).google).join("&")}&display=swap`;

/* ---------- Dispositions (ce qui rend les modeles VRAIMENT differents, pas seulement leurs couleurs) ---------- */
export const DISPOSITIONS = {
  entete: [
    { v: "plein", l: "Grande photo pleine largeur, titre dessus" },
    { v: "partage", l: "Texte d'un côté, photo de l'autre" },
    { v: "centre", l: "Logo et titre centrés, photo en dessous" },
    { v: "bandeau", l: "Bandeau de couleur, photo en carte" },
    { v: "magazine", l: "Très grand titre façon magazine" },
  ],
  menu: [{ v: "ancres", l: "Menu des sections en haut" }, { v: "aucun", l: "Pas de menu" }],
  titres: [
    { v: "filet", l: "Titre avec un trait" },
    { v: "majuscules", l: "Majuscules espacées" },
    { v: "numeros", l: "Sections numérotées (01, 02…)" },
    { v: "souligne", l: "Titre souligné de couleur" },
  ],
  produits: [
    { v: "cartes", l: "Cartes avec photo (boutique)" },
    { v: "liste", l: "Liste simple" },
    { v: "menu", l: "Carte de restaurant (nom ····· prix)" },
    { v: "alterne", l: "Grandes photos en alternance" },
  ],
  galerie: [
    { v: "grille", l: "Grille régulière" },
    { v: "mosaique", l: "Mosaïque (grandes et petites)" },
    { v: "defilement", l: "Défilement horizontal" },
    { v: "polaroid", l: "Photos façon Polaroid" },
  ],
  largeur: [{ v: "etroite", l: "Étroite (élégante)" }, { v: "large", l: "Large" }],
  fond: [{ v: "uni", l: "Fond uni" }, { v: "alterne", l: "Sections en alternance" }, { v: "cartes", l: "Sections dans des cartes" }],
  boutons: [{ v: "arrondi", l: "Arrondis" }, { v: "carre", l: "Carrés" }, { v: "pilule", l: "Pilule" }, { v: "contour", l: "Contour seulement" }],
  flottant: [{ v: "oui", l: "Bouton WhatsApp toujours visible" }, { v: "non", l: "Non" }],
};
const CLES_DISPOSITION = Object.keys(DISPOSITIONS);
const dispositionOk = (cle, v) => DISPOSITIONS[cle].some((x) => x.v === v);

/* ---------- Les 8 modeles graphiques (originaux) ---------- */
export const MODELES = [
  { id: "luxe", nom: "Luxe et Prestige", pour: "Bijoux, beauté haut de gamme, mode de luxe",
    disposition: { entete: "plein", menu: "ancres", titres: "majuscules", produits: "alterne", galerie: "mosaique", largeur: "etroite", fond: "uni", boutons: "contour", flottant: "non" },
    couleurs: { fond: "#0e0c0d", surface: "#1a1617", texte: "#f5efe9", doux: "#b8aaa2", accent: "#c9a46a", accent2: "#3a3026" }, titre: "cormorant", texte: "montserrat" },
  { id: "naturelle", nom: "Élégance naturelle", pour: "Mode, décoration, bien-être",
    disposition: { entete: "partage", menu: "aucun", titres: "souligne", produits: "cartes", galerie: "polaroid", largeur: "etroite", fond: "alterne", boutons: "pilule", flottant: "non" },
    couleurs: { fond: "#f6f1ea", surface: "#fffdf9", texte: "#3b3229", doux: "#8a7d70", accent: "#8c6f56", accent2: "#e9dfd1" }, titre: "lora", texte: "inter" },
  { id: "business", nom: "Business moderne", pour: "Entreprises, consultants, indépendants",
    disposition: { entete: "partage", menu: "ancres", titres: "filet", produits: "liste", galerie: "grille", largeur: "large", fond: "cartes", boutons: "arrondi", flottant: "non" },
    couleurs: { fond: "#f4f7fb", surface: "#ffffff", texte: "#14213d", doux: "#5c6b80", accent: "#1f5fbf", accent2: "#dbe7f8" }, titre: "manrope", texte: "inter" },
  { id: "glamour", nom: "Glamour et Beauté", pour: "Coiffure, esthétique, onglerie, maquillage",
    disposition: { entete: "centre", menu: "aucun", titres: "majuscules", produits: "cartes", galerie: "mosaique", largeur: "etroite", fond: "alterne", boutons: "pilule", flottant: "oui" },
    couleurs: { fond: "#fff5f7", surface: "#ffffff", texte: "#4a2233", doux: "#a07084", accent: "#d6457a", accent2: "#fbe1ea" }, titre: "greatvibes", texte: "poppins" },
  { id: "boutique", nom: "Mode et Boutique", pour: "Vêtements, accessoires, perruques",
    disposition: { entete: "magazine", menu: "ancres", titres: "majuscules", produits: "cartes", galerie: "grille", largeur: "large", fond: "uni", boutons: "carre", flottant: "oui" },
    couleurs: { fond: "#faf8f6", surface: "#ffffff", texte: "#1b1b1b", doux: "#76706b", accent: "#1b1b1b", accent2: "#efe6dd" }, titre: "playfair", texte: "josefin" },
  { id: "restaurant", nom: "Restaurant et Gastronomie", pour: "Restaurants, traiteurs, pâtisseries",
    disposition: { entete: "plein", menu: "ancres", titres: "filet", produits: "menu", galerie: "defilement", largeur: "etroite", fond: "uni", boutons: "pilule", flottant: "oui" },
    couleurs: { fond: "#1c1410", surface: "#2a1f19", texte: "#f8efe4", doux: "#c4ad97", accent: "#e0832f", accent2: "#3d2b20" }, titre: "dmserif", texte: "lora" },
  { id: "artisanat", nom: "Artisanat et Services", pour: "Artisans, dépannage, services à domicile",
    disposition: { entete: "bandeau", menu: "aucun", titres: "numeros", produits: "liste", galerie: "grille", largeur: "large", fond: "cartes", boutons: "arrondi", flottant: "oui" },
    couleurs: { fond: "#f3f5f4", surface: "#ffffff", texte: "#1d2b26", doux: "#5f6f68", accent: "#2f7d5b", accent2: "#d5e9df" }, titre: "oswald", texte: "inter" },
  { id: "minimaliste", nom: "Minimaliste", pour: "Tous métiers, style épuré",
    disposition: { entete: "centre", menu: "aucun", titres: "filet", produits: "liste", galerie: "grille", largeur: "etroite", fond: "uni", boutons: "carre", flottant: "non" },
    couleurs: { fond: "#ffffff", surface: "#ffffff", texte: "#111111", doux: "#777777", accent: "#111111", accent2: "#f2f2f2" }, titre: "inter", texte: "inter" },
];
// Lot R1 (27 nov. 2026) : 7 modeles reserves aux pages des restaurants partenaires (Admin Restaurants)
export const MODELES_RESTOS = [
  { id: "r-sushi", nom: "Sushi et cuisine japonaise", pour: "Sushi, japonais, asiatique",
    disposition: { entete: "plein", menu: "ancres", titres: "majuscules", produits: "menu", galerie: "mosaique", largeur: "etroite", fond: "uni", boutons: "carre", flottant: "oui" },
    couleurs: { fond: "#0d0d0f", surface: "#17171b", texte: "#f4f1ea", doux: "#a9a39a", accent: "#d64545", accent2: "#2a2224" }, titre: "dmserif", texte: "inter" },
  { id: "r-rapide", nom: "Restauration rapide", pour: "Burgers, pizzas, snacks, shawarma",
    disposition: { entete: "bandeau", menu: "aucun", titres: "souligne", produits: "cartes", galerie: "defilement", largeur: "large", fond: "cartes", boutons: "pilule", flottant: "oui" },
    couleurs: { fond: "#fff8ec", surface: "#ffffff", texte: "#231a12", doux: "#7a6450", accent: "#e8551f", accent2: "#ffe2b8" }, titre: "oswald", texte: "poppins" },
  { id: "r-gastro", nom: "Restaurant gastronomique", pour: "Cuisine raffinée, chef, dîner",
    disposition: { entete: "centre", menu: "ancres", titres: "filet", produits: "menu", galerie: "polaroid", largeur: "etroite", fond: "uni", boutons: "contour", flottant: "non" },
    couleurs: { fond: "#f7f3ec", surface: "#fffdf8", texte: "#2b241d", doux: "#857867", accent: "#8a6a3b", accent2: "#ece2d0" }, titre: "cormorant", texte: "lora" },
  { id: "r-traiteur", nom: "Traiteur et événements", pour: "Traiteurs, buffets, plateaux",
    disposition: { entete: "partage", menu: "aucun", titres: "numeros", produits: "alterne", galerie: "grille", largeur: "large", fond: "alterne", boutons: "arrondi", flottant: "oui" },
    couleurs: { fond: "#f4f6f2", surface: "#ffffff", texte: "#1f2a1f", doux: "#5f6e5c", accent: "#3f7a4a", accent2: "#dfe9dc" }, titre: "playfair", texte: "inter" },
  { id: "r-boulangerie", nom: "Boulangerie", pour: "Pain, viennoiseries, sandwichs",
    disposition: { entete: "magazine", menu: "aucun", titres: "filet", produits: "liste", galerie: "grille", largeur: "etroite", fond: "uni", boutons: "arrondi", flottant: "oui" },
    couleurs: { fond: "#fbf4e8", surface: "#ffffff", texte: "#3a2a17", doux: "#8a7459", accent: "#b5701f", accent2: "#f2e2c4" }, titre: "lora", texte: "josefin" },
  { id: "r-patisserie", nom: "Pâtisserie", pour: "Gâteaux, desserts, commandes sur mesure",
    disposition: { entete: "centre", menu: "aucun", titres: "majuscules", produits: "cartes", galerie: "mosaique", largeur: "etroite", fond: "alterne", boutons: "pilule", flottant: "oui" },
    couleurs: { fond: "#fff6f8", surface: "#ffffff", texte: "#4a2a36", doux: "#9a7484", accent: "#c95f86", accent2: "#fde3ea" }, titre: "greatvibes", texte: "poppins" },
  { id: "r-cafe", nom: "Café et brunch", pour: "Cafés, brunchs, salons de thé",
    disposition: { entete: "partage", menu: "ancres", titres: "souligne", produits: "liste", galerie: "polaroid", largeur: "etroite", fond: "uni", boutons: "pilule", flottant: "non" },
    couleurs: { fond: "#f3ece4", surface: "#fffaf4", texte: "#3b2c22", doux: "#86705f", accent: "#6f4e37", accent2: "#e6d6c4" }, titre: "dmserif", texte: "manrope" },
];
export const modelesPour = (univers) => (univers === "restos" ? [...MODELES_RESTOS, MODELES[5]] : MODELES);
export const modele = (id) => MODELES.find((m) => m.id === id) || MODELES_RESTOS.find((m) => m.id === id) || MODELES[7];
export const LIBELLES_COULEURS = { fond: "Fond de la page", surface: "Fond des blocs", texte: "Texte", doux: "Texte secondaire", accent: "Couleur principale (boutons)", accent2: "Couleur d'accompagnement" };

/* ---------- Sections et forfaits ---------- */
export const SECTIONS = [
  { id: "presentation", nom: "Présentation" },
  { id: "commander", nom: "Commander" },
  { id: "menu", nom: "Notre menu" },
  { id: "galerie", nom: "Galerie photos" },
  { id: "produits", nom: "Produits et prestations" },
  { id: "tarifs", nom: "Tarifs" },
  { id: "reservation", nom: "Prendre rendez-vous" },
  { id: "horaires", nom: "Horaires" },
  { id: "zone", nom: "Adresse et zone d'intervention" },
  { id: "livraison", nom: "Livraison, retrait et délais" },
  { id: "infos", nom: "Informations complémentaires" },
  { id: "avis", nom: "Avis clients" },
  { id: "contact", nom: "Contact et réseaux" },
];
export const nomSection = (id) => (SECTIONS.find((s) => s.id === id) || { nom: id }).nom;
const SECTIONS_REFERENCEMENT = ["presentation", "horaires", "zone", "contact"];
const SECTIONS_VITRINE = ["presentation", "galerie", "produits", "tarifs", "horaires", "zone", "livraison", "infos", "avis", "contact"];
// Ce que la formule permet. Changer de formule ou d'option change cette liste ; les DONNEES restent dans la page.
const SECTIONS_RESTAURANT = ["presentation", "commander", "menu", "produits", "galerie", "horaires", "zone", "livraison", "infos", "avis", "contact"];
export function sectionsPermises(formule, modules = []) {
  if (formule === "restaurant") return [...SECTIONS_RESTAURANT];
  if (formule === "referencement") return [...SECTIONS_REFERENCEMENT];
  const l = [...SECTIONS_VITRINE];
  if (formule === "packpro" || (formule === "business" && (modules || []).includes("agenda"))) l.splice(4, 0, "reservation");
  return l;
}
export const photosPermises = (formule) => formule !== "referencement";
// Formule qui decide des sections : un restaurant a toujours ses sections de restaurant
export const formulePage = (page, dossier) => (page && page.type === "restaurant" ? "restaurant" : (dossier && dossier.formule) || "vitrine");
// Ordre choisi par Rebecca ; les sections non permises sont cachees (pas effacees : elles reviennent avec l'option)
export function sectionsDePage(sections, formule, modules) {
  const permises = sectionsPermises(formule, modules);
  const vus = new Set();
  const l = (Array.isArray(sections) ? sections : []).filter((s) => s && SECTIONS.some((x) => x.id === s.id) && !vus.has(s.id) && vus.add(s.id)).map((s) => ({ id: s.id, actif: s.actif !== false }));
  for (const id of SECTIONS.map((x) => x.id)) if (!vus.has(id)) l.push({ id, actif: true });
  return l.map((s) => ({ ...s, permise: permises.includes(s.id) }));
}
export const sectionsVisibles = (page, formule, modules) => sectionsDePage(page.sections, formule, modules).filter((s) => s.permise && s.actif).map((s) => s.id);

/* ---------- Adresse de la page (rebeccaservices.com/p/...) ---------- */
export const ADRESSE_OK = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const ADRESSES_RESERVEES = ["admin", "pros", "pro", "boutique", "boutiques", "rebecca", "rebecca-services", "apercu", "photo"];
export function adresseDepuisNom(nom) {
  const s = String(nom || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  return s.length >= 3 ? s : s ? `page-${s}` : "";
}
export function adresseUnique(voulue, prises = [], idPage = "") {
  const base0 = ADRESSE_OK.test(voulue || "") ? voulue : adresseDepuisNom(voulue) || "ma-page";
  const base = ADRESSES_RESERVEES.includes(base0) ? `${base0}-pro` : base0;
  const occupees = new Set((prises || []).filter((p) => p.id !== idPage).map((p) => p.adresse));
  if (!occupees.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    const a = `${base.slice(0, 36)}-${i}`;
    if (!occupees.has(a)) return a;
  }
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
}
export const lienPage = (site, adresse) => `${String(site || "https://rebeccaservices.com").replace(/\/$/, "")}/p/${adresse}`;
export const lienApercu = (site, jeton) => `${String(site || "https://rebeccaservices.com").replace(/\/$/, "")}/#/apercu/${jeton}`;

/* ---------- Statuts (section 9.3) ---------- */
export const STATUTS_PAGE = [
  { v: "attente_elements", l: "En attente des éléments du client" },
  { v: "en_creation", l: "En cours de création" },
  { v: "brouillon", l: "Brouillon" },
  { v: "attente_validation", l: "En attente de validation du client" },
  { v: "publiee", l: "Publiée" },
  { v: "suspendue", l: "Suspendue" },
  { v: "archivee", l: "Archivée" },
];
export const libelleStatutPage = (v) => (STATUTS_PAGE.find((s) => s.v === v) || { l: v }).l;
export const STATUTS_PREPARATION = ["attente_elements", "en_creation", "brouillon", "attente_validation"];
export const enLigne = (page) => page.statut === "publiee";
// Modifications preparees mais pas encore en ligne
export const modifsNonPubliees = (page) => enLigne(page) && Number(page.majLeMs) > Number(page.publieeLeMs) + 1000;

/* ---------- Tarif du client (section 9.0, point 5 et precisions du 27 nov. 14h11) ---------- */
const montant = (x) => Math.max(0, Math.min(1000000, Math.round((Number(x) || 0) * 100) / 100));
const montantOuVide = (x) => (x === "" || x === null || x === undefined || !Number.isFinite(Number(x)) ? null : montant(x));
// Prix de depart de la grille Digital pour la formule et les options cochees
export function prixDeDepart(grille, formule, modules = []) {
  const g = grille || {};
  const base = formule === "vitrine" ? g.vitrine : formule === "business" ? g.business : formule === "packpro" ? g.packPro : null;
  const mods = formule === "business" ? (g.modules || []).filter((m) => (modules || []).includes(m.id)) : [];
  return {
    creation: Number((base || {}).creation) || 0,
    mensuel: Number((base || {}).mois) || 0,
    options: mods.map((m) => ({ id: m.id, nom: m.nom, creation: Number(m.creation) || 0, mensuel: Number(m.mois) || 0 })),
  };
}
export const tarifVide = () => ({
  creation: null, mensuel: null, options: {}, remisePct: 0, remiseCreationShekels: 0, remiseMoisShekels: 0,
  creationOfferte: false, moisOfferts: 0, preferentiel: false, debutAbonnement: "", note: "",
});
export function normaliserTarif(t) {
  const v = { ...tarifVide(), ...(t && typeof t === "object" ? t : {}) };
  const options = {};
  for (const [id, o] of Object.entries(v.options || {})) {
    if (!/^[a-z0-9_-]{1,30}$/i.test(id) || !o || typeof o !== "object") continue;
    options[id] = { creation: montantOuVide(o.creation), mensuel: montantOuVide(o.mensuel), offerte: o.offerte === true };
  }
  return {
    creation: montantOuVide(v.creation),
    mensuel: montantOuVide(v.mensuel),
    options,
    remisePct: Math.max(0, Math.min(100, Number(v.remisePct) || 0)),
    remiseCreationShekels: montant(v.remiseCreationShekels),
    remiseMoisShekels: montant(v.remiseMoisShekels),
    creationOfferte: v.creationOfferte === true,
    moisOfferts: Math.max(0, Math.min(36, Math.round(Number(v.moisOfferts) || 0))),
    preferentiel: v.preferentiel === true,
    debutAbonnement: DATE_OK.test(v.debutAbonnement || "") ? v.debutAbonnement : "",
    note: txt(v.note, 300),
  };
}
const moisPlus = (iso, n) => {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return `${d.toISOString().slice(0, 7)}-${String(Math.min(j, dernier)).padStart(2, "0")}`;
};
// Calcul du tarif du client : grille (prix de depart) + ce que Rebecca a change pour lui
export function calculTarif(tarif, grille, formule, modules) {
  const t = normaliserTarif(tarif);
  const depart = prixDeDepart(grille, formule, modules);
  const lignes = [];
  const baseCreation = t.creation ?? depart.creation;
  const baseMensuel = t.mensuel ?? depart.mensuel;
  lignes.push({ nom: `Formule ${libelleFormuleCourt(formule)}`, creation: baseCreation, mensuel: baseMensuel, grilleCreation: depart.creation, grilleMensuel: depart.mensuel, offerte: false });
  for (const o of depart.options) {
    const p = t.options[o.id] || {};
    lignes.push({ id: o.id, nom: o.nom, creation: p.offerte ? 0 : p.creation ?? o.creation, mensuel: p.offerte ? 0 : p.mensuel ?? o.mensuel, grilleCreation: o.creation, grilleMensuel: o.mensuel, offerte: p.offerte === true });
  }
  const brutCreation = lignes.reduce((s, l) => s + l.creation, 0);
  const brutMensuel = lignes.reduce((s, l) => s + l.mensuel, 0);
  const r = 1 - t.remisePct / 100;
  const totalCreation = t.creationOfferte ? 0 : Math.max(0, Math.round(brutCreation * r - t.remiseCreationShekels));
  const totalMensuel = Math.max(0, Math.round(brutMensuel * r - t.remiseMoisShekels));
  const grilleCreation = depart.creation + depart.options.reduce((s, o) => s + o.creation, 0);
  const grilleMensuel = depart.mensuel + depart.options.reduce((s, o) => s + o.mensuel, 0);
  const premierMoisPaye = t.debutAbonnement ? moisPlus(t.debutAbonnement, t.moisOfferts) : "";
  return { lignes, brutCreation, brutMensuel, totalCreation, totalMensuel, grilleCreation, grilleMensuel, remiseCreation: grilleCreation - totalCreation, remiseMensuel: grilleMensuel - totalMensuel, moisOfferts: t.moisOfferts, debut: t.debutAbonnement, premierMoisPaye, preferentiel: t.preferentiel, creationOfferte: t.creationOfferte, note: t.note };
}
const libelleFormuleCourt = (f) => ({ referencement: "Référencement", vitrine: "Vitrine", business: "Business", packpro: "Pack Pro" })[f] || f;
// Tarif accepte par le client : fige dans l'historique (jamais recalcule si la grille change)
export function contratDepuisTarif(tarif, grille, formule, modules, quandMs = Date.now()) {
  const c = calculTarif(tarif, grille, formule, modules);
  return {
    leMs: quandMs, formule, modules: [...(modules || [])].slice(0, 12),
    lignes: c.lignes.map((l) => ({ nom: l.nom, creation: l.creation, mensuel: l.mensuel, offerte: l.offerte })),
    totalCreation: c.totalCreation, totalMensuel: c.totalMensuel, grilleCreation: c.grilleCreation, grilleMensuel: c.grilleMensuel,
    moisOfferts: c.moisOfferts, debut: c.debut, premierMoisPaye: c.premierMoisPaye, preferentiel: c.preferentiel, creationOfferte: c.creationOfferte, note: c.note,
    tarif: normaliserTarif(tarif),
  };
}
export const contratEnVigueur = (page) => (Array.isArray(page.contrats) && page.contrats.length ? page.contrats[0] : null);
// Abonnement du dossier pro (pricing/pros.js lireAbonnement) a partir du contrat : premier mois paye = debut + mois offerts
export function abonnementDepuisContrat(contrat, abonnementActuel = {}) {
  const a = abonnementActuel && typeof abonnementActuel === "object" ? abonnementActuel : {};
  return { ...a, mensuel: contrat.totalMensuel, debut: contrat.premierMoisPaye || contrat.debut || a.debut || "", actif: contrat.totalMensuel > 0 && !!(contrat.premierMoisPaye || contrat.debut), paiements: Array.isArray(a.paiements) ? a.paiements : [] };
}

/* ---------- Une page ---------- */
const nouvelId = () => `pg${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`.slice(0, 24);
export function pageVide(dossier = {}, modeleId = "minimaliste") {
  const m = modele(modeleId);
  return {
    id: nouvelId(), type: "pro", restoId: "", proId: dossier.id || "", statut: "en_creation", demo: false, adresse: adresseDepuisNom(dossier.nomCommercial),
    modele: m.id, couleurs: { ...m.couleurs }, policeTitre: m.titre, policeTexte: m.texte, disposition: { ...m.disposition },
    nom: txt(dossier.nomCommercial, 80), specialite: txt(dossier.metier, 80), accroche: "", presentation: txt(dossier.description, 2000),
    logo: "", couverture: "", galerie: [], produits: [], tarifsTexte: txt(dossier.tarifs, 1500), horaires: txt(dossier.horaires, 600),
    adressePostale: "", zone: txt([dossier.villes, dossier.zone].filter(Boolean).join(" — "), 300),
    telephone: txt(dossier.telephone, 20), whatsapp: txt(dossier.whatsapp || dossier.telephone, 20),
    messageWhatsApp: "", boutonWhatsApp: "Commander ou se renseigner sur WhatsApp",
    instagram: txt(dossier.instagram, 120), boutonInstagram: "Voir tout le catalogue sur Instagram", facebook: txt(dossier.facebook, 200), tiktok: "", siteWeb: txt(dossier.siteWeb, 200), autresLiens: [],
    livraison: "", infos: "", lienRdv: "", avis: [], sections: [],
    lienCommande: "", boutonCommande: "Consulter le menu et commander", menuPdf: "", cacherout: "", carteEnLigne: true,
    he: { actif: false },
    seo: { titre: "", description: "" },
    tarif: tarifVide(), contrats: [], photosInfo: {}, notePrivee: "",
    apercu: { jeton: "", expireLeMs: 0 },
    creeLeMs: Date.now(), majLeMs: Date.now(), publieeLeMs: 0, journal: [],
  };
}
const photoOk = (x) => (ID_PHOTO_OK.test(String(x || "")) ? String(x) : "");
const lien = (x) => {
  const v = String(x || "").trim();
  return /^https:\/\/[^\s]{4,300}$/.test(v) ? v : "";
};
export function normaliserPage(p) {
  const v = { ...pageVide({}), ...(p || {}) };
  const m = modele(v.modele);
  const disp = v.disposition && typeof v.disposition === "object" ? v.disposition : {};
  const photosInfo = {};
  for (const [id, o] of Object.entries(v.photosInfo || {})) if (photoOk(id)) photosInfo[id] = Math.max(0, Math.round(Number(o) || 0));
  return {
    id: txt(v.id, 30) || nouvelId(),
    type: v.type === "restaurant" ? "restaurant" : "pro",
    restoId: txt(v.restoId, 40),
    contratId: txt(v.contratId, 40),
    proId: txt(v.proId, 30),
    statut: STATUTS_PAGE.some((s) => s.v === v.statut) ? v.statut : "brouillon",
    demo: v.demo === true,
    adresse: ADRESSE_OK.test(v.adresse || "") ? v.adresse : adresseDepuisNom(v.nom) || "",
    modele: m.id,
    couleurs: Object.fromEntries(Object.entries(m.couleurs).map(([k, d]) => [k, couleur((v.couleurs || {})[k], d)])),
    policeTitre: POLICES.some((x) => x.id === v.policeTitre) ? v.policeTitre : m.titre,
    policeTexte: POLICES.some((x) => x.id === v.policeTexte) ? v.policeTexte : m.texte,
    disposition: Object.fromEntries(CLES_DISPOSITION.map((k) => [k, dispositionOk(k, disp[k]) ? disp[k] : m.disposition[k]])),
    nom: txt(v.nom, 80),
    specialite: txt(v.specialite, 80),
    accroche: txt(v.accroche, 160),
    presentation: txt(v.presentation, 2000),
    logo: photoOk(v.logo),
    couverture: photoOk(v.couverture),
    galerie: (Array.isArray(v.galerie) ? v.galerie : []).filter((g) => g && photoOk(g.photo)).slice(0, MAX_GALERIE).map((g) => ({ photo: g.photo, legende: txt(g.legende, 120) })),
    produits: (Array.isArray(v.produits) ? v.produits : []).filter((x) => x && (txt(x.nom, 80) || photoOk(x.photo))).slice(0, MAX_PRODUITS)
      .map((x) => ({ nom: txt(x.nom, 80), prix: txt(x.prix, 40), description: txt(x.description, 400), photo: photoOk(x.photo) })),
    tarifsTexte: txt(v.tarifsTexte, 1500),
    horaires: txt(v.horaires, 600),
    adressePostale: txt(v.adressePostale, 200),
    zone: txt(v.zone, 300),
    telephone: txt(v.telephone, 20),
    whatsapp: txt(v.whatsapp, 20),
    messageWhatsApp: txt(v.messageWhatsApp, 300),
    boutonWhatsApp: txt(v.boutonWhatsApp, 60) || "Me contacter sur WhatsApp",
    instagram: txt(v.instagram, 120),
    boutonInstagram: txt(v.boutonInstagram, 60) || "Voir mon Instagram",
    facebook: txt(v.facebook, 200),
    tiktok: txt(v.tiktok, 120),
    siteWeb: txt(v.siteWeb, 200),
    autresLiens: (Array.isArray(v.autresLiens) ? v.autresLiens : []).filter((x) => x && lien(x.url)).slice(0, 6).map((x) => ({ titre: txt(x.titre, 40) || "Lien", url: lien(x.url) })),
    livraison: txt(v.livraison, 1200),
    infos: txt(v.infos, 1500),
    lienRdv: lien(v.lienRdv),
    // Restaurants (lot R1) : A = lien vers son site de commande ; B = carte en ligne de Rebecca Services (fiche du
    // restaurant, panier envoye au restaurant) ; C = menu PDF et photos du menu (fiche du restaurant). Combinables.
    lienCommande: lien(v.lienCommande),
    boutonCommande: txt(v.boutonCommande, 60) || "Consulter le menu et commander",
    menuPdf: lien(v.menuPdf),
    cacherout: txt(v.cacherout, 120),
    carteEnLigne: v.carteEnLigne !== false,
    // Avis : seulement de VRAIS avis de clients du pro, recopies par Rebecca (jamais inventes)
    avis: (Array.isArray(v.avis) ? v.avis : []).filter((a) => a && txt(a.texte, 400)).slice(0, 12).map((a) => ({ nom: txt(a.nom, 40), texte: txt(a.texte, 400), note: Math.max(0, Math.min(5, Math.round(Number(a.note) || 0))) })),
    sections: (Array.isArray(v.sections) ? v.sections : []).filter((s) => s && SECTIONS.some((x) => x.id === s.id)).map((s) => ({ id: s.id, actif: s.actif !== false })),
    he: { actif: false, ...(v.he && typeof v.he === "object" ? v.he : {}) }, // lot 4 (hebreu)
    seo: { titre: txt((v.seo || {}).titre, 70), description: txt((v.seo || {}).description, 170) },
    tarif: normaliserTarif(v.tarif),
    contrats: (Array.isArray(v.contrats) ? v.contrats : []).filter((c) => c && Number(c.leMs) > 0).slice(0, 40),
    photosInfo,
    notePrivee: txt(v.notePrivee, 1000),
    apercu: { jeton: /^[A-Za-z0-9]{20,40}$/.test((v.apercu || {}).jeton || "") ? v.apercu.jeton : "", expireLeMs: Number((v.apercu || {}).expireLeMs) || 0 },
    creeLeMs: Number(v.creeLeMs) || 0,
    majLeMs: Number(v.majLeMs) || 0,
    publieeLeMs: Number(v.publieeLeMs) || 0,
    journal: (Array.isArray(v.journal) ? v.journal : []).filter((x) => x && typeof x.texte === "string").slice(0, 40),
  };
}
export function ajouterJournalPage(page, texte, quandMs = Date.now()) {
  return { ...page, journal: [{ leMs: quandMs, texte: txt(texte, 200) }, ...(page.journal || [])].slice(0, 40) };
}
// Changer de modele : seul le style change (couleurs, polices, disposition) ; textes et photos restent
export function changerModele(page, modeleId) {
  const m = modele(modeleId);
  return { ...page, modele: m.id, couleurs: { ...m.couleurs }, policeTitre: m.titre, policeTexte: m.texte, disposition: { ...m.disposition } };
}
// Dupliquer : meme style et memes textes ; nouvelle adresse, en creation, sans photos, sans tarif, sans historique
export function dupliquerPage(page, prises = []) {
  const id = nouvelId();
  const copie = {
    ...page, id, statut: "en_creation", nom: `${page.nom} (copie)`, logo: "", couverture: "", galerie: [], produits: (page.produits || []).map((p) => ({ ...p, photo: "" })),
    restoId: "", tarif: tarifVide(), contrats: [], photosInfo: {}, apercu: { jeton: "", expireLeMs: 0 }, publieeLeMs: 0, journal: [], creeLeMs: Date.now(), majLeMs: Date.now(),
  };
  copie.adresse = adresseUnique(adresseDepuisNom(copie.nom), prises, id);
  return copie;
}

/* ---------- Photos : references, poids, menage, capacite ---------- */
export function photosReferencees(page) {
  const s = new Set();
  if (!page) return s;
  if (photoOk(page.logo)) s.add(page.logo);
  if (photoOk(page.couverture)) s.add(page.couverture);
  for (const g of page.galerie || []) if (photoOk(g.photo)) s.add(g.photo);
  for (const p of page.produits || []) if (photoOk(p.photo)) s.add(p.photo);
  return s;
}
// Photos a effacer : celles de la page qui ne servent plus ni au brouillon, ni a la version en ligne, ni aux versions gardees
export function photosAEffacer(page, versions = [], publiee = null) {
  const gardees = photosReferencees(page);
  for (const v of versions || []) for (const id of photosReferencees(v.page)) gardees.add(id);
  for (const id of photosReferencees(publiee)) gardees.add(id);
  return Object.keys(page.photosInfo || {}).filter((id) => !gardees.has(id));
}
export const poidsPhotos = (page) => Object.values(page.photosInfo || {}).reduce((s, o) => s + o, 0);
export const nombrePhotos = (page) => Object.keys(page.photosInfo || {}).length;
// Espace gratuit Firebase : 1 Go pour TOUT le site. Budget reserve aux photos des pages (reglable), le reste pour le site.
export const ESPACE_GRATUIT_OCTETS = 1024 * 1024 * 1024;
export const BUDGET_PHOTOS_DEFAUT = 700 * 1024 * 1024;
export const SEUILS_ALERTE = [70, 85, 95];
export function compteurEspace(pages, budget = BUDGET_PHOTOS_DEFAUT) {
  const parPro = new Map();
  let total = 0;
  let photos = 0;
  for (const p of pages || []) {
    const o = poidsPhotos(p);
    const n = nombrePhotos(p);
    total += o;
    photos += n;
    const cle = p.proId || p.id;
    const x = parPro.get(cle) || { proId: p.proId, nom: p.nom, pages: 0, photos: 0, octets: 0 };
    parPro.set(cle, { ...x, pages: x.pages + 1, photos: x.photos + n, octets: x.octets + o });
  }
  const pourcent = budget > 0 ? Math.round((total / budget) * 1000) / 10 : 0;
  const alerte = [...SEUILS_ALERTE].reverse().find((s) => pourcent >= s) || 0;
  return { total, photos, budget, reste: Math.max(0, budget - total), pourcent, alerte, parPro: [...parPro.values()].sort((a, b) => b.octets - a.octets) };
}
export const enMo = (o) => `${(o / (1024 * 1024)).toFixed(o < 10 * 1024 * 1024 ? 1 : 0)} Mo`;

/* ---------- Versions (5 dernieres publiees, texte seulement) ---------- */
export function ajouterVersion(versions, page, quandMs = Date.now()) {
  const { tarif, contrats, notePrivee, journal, apercu, ...contenu } = page; // eslint-disable-line no-unused-vars
  return [{ leMs: quandMs, page: contenu }, ...(versions || [])].slice(0, MAX_VERSIONS);
}
// Restaurer une version dans le brouillon : on garde le tarif, l'historique, les notes et le poids des photos actuels
export function restaurerVersion(page, version) {
  return { ...page, ...version.page, id: page.id, proId: page.proId, statut: page.statut, tarif: page.tarif, contrats: page.contrats, notePrivee: page.notePrivee, journal: page.journal, apercu: page.apercu, photosInfo: page.photosInfo, publieeLeMs: page.publieeLeMs, majLeMs: Date.now() };
}
export function lireVersions(json) {
  try {
    const l = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(l) ? l.filter((v) => v && v.page && Number(v.leMs) > 0).slice(0, MAX_VERSIONS) : [];
  } catch {
    return [];
  }
}

/* ---------- Controles avant publication ---------- */
const chiffres = (t) => String(t || "").replace(/\D/g, "");
export function erreursPage(page, pages = [], dossier = null) {
  const e = {};
  if (!page.nom) e.nom = "Nom commercial obligatoire.";
  if (!ADRESSE_OK.test(page.adresse || "")) e.adresse = "Adresse de la page : 3 à 40 lettres minuscules, chiffres ou tirets.";
  else if (ADRESSES_RESERVEES.includes(page.adresse)) e.adresse = "Cette adresse est réservée au site.";
  else if ((pages || []).some((p) => p.id !== page.id && p.adresse === page.adresse)) e.adresse = "Cette adresse est déjà prise par une autre page.";
  const tel = chiffres(page.whatsapp || page.telephone).length;
  if (tel < 9 || tel > 15) e.whatsapp = "Un numéro de téléphone ou WhatsApp (9 chiffres ou plus).";
  if (!dossier) e.proId = "Ce professionnel n'existe plus dans l'annuaire.";
  else if (["refuse", "suspendu"].includes(dossier.statut)) e.proId = `Le dossier du pro est « ${dossier.statut === "refuse" ? "refusé" : "suspendu"} » dans l'annuaire.`;
  return e;
}

/* ---------- Ce qui sort en public (jamais le tarif, les contrats ni les notes) ---------- */
export function pagePublique(page, dossier) {
  const p = normaliserPage(page);
  const formule = formulePage(p, dossier);
  const modules = (dossier && dossier.modules) || [];
  const photos = photosPermises(formule);
  const { tarif, contrats, notePrivee, journal, apercu, photosInfo, creeLeMs, proId, demo, ...visible } = p; // eslint-disable-line no-unused-vars
  return {
    ...visible,
    logo: photos ? p.logo : "", couverture: photos ? p.couverture : "", galerie: photos ? p.galerie : [], produits: p.produits.map((x) => ({ ...x, photo: photos ? x.photo : "" })),
    statut: "publiee", sections: sectionsVisibles(p, formule, modules), seo: seoDePage(p), formule,
  };
}
export const pageHorsLigne = (page, statut) => ({ statut, nom: txt(page.nom, 80), adresse: page.adresse });
export function seoDePage(p) {
  const titre = p.seo.titre || [p.nom, p.specialite].filter(Boolean).join(" – ");
  const base = p.seo.description || p.accroche || p.presentation;
  const description = String(base || `${p.nom} sur Rebecca Services`).replace(/\s+/g, " ").trim();
  return { titre: titre.slice(0, 70), description: description.length > 160 ? description.slice(0, 157).replace(/\s+\S*$/, "") + "…" : description };
}
export function lirePagePublique(json) {
  try {
    const v = typeof json === "string" ? JSON.parse(json) : json;
    return v && typeof v === "object" && v.statut ? v : null;
  } catch {
    return null;
  }
}
// Premiere photo pour l'apercu WhatsApp / Facebook
export const photoPartage = (pub) => (pub && (pub.couverture || pub.logo || ((pub.galerie || [])[0] || {}).photo || ((pub.produits || []).find((x) => x.photo) || {}).photo)) || "";

/* ---------- Liens de contact ---------- */
export const versInternational = (t) => {
  const c = chiffres(t);
  return c.startsWith("972") ? c : c.replace(/^0/, "972");
};
export function lienWhatsAppPage(numero, message) {
  const n = versInternational(numero);
  if (n.length < 11) return "";
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
export const messageParDefaut = (nom) => `Bonjour ${nom || ""}, je vous contacte depuis votre page sur Rebecca Services.`.replace(" ,", ",");
export const messageProduit = (nomProduit) => `Bonjour, je suis intéressé(e) par : ${nomProduit}. Est-ce disponible ?`;
export function lienReseauPage(type, valeur) {
  const v = String(valeur || "").trim();
  if (!v) return "";
  if (/^https:\/\/[^\s]{4,200}$/.test(v)) return v;
  if (type === "site") return /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v.replace(/^https?:\/\//, "")) ? `https://${v.replace(/^https?:\/\//, "")}` : "";
  const compte = v.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?(instagram|facebook|tiktok)\.com\/@?/i, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._-]{2,60}$/.test(compte)) return "";
  if (type === "instagram") return `https://www.instagram.com/${compte}`;
  if (type === "facebook") return `https://www.facebook.com/${compte}`;
  if (type === "tiktok") return `https://www.tiktok.com/@${compte}`;
  return "";
}
export function jetonAleatoire(n = 24) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const t = new Uint8Array(n);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(t);
  return [...t].map((x) => c[x % c.length]).join("");
}

/* ---------- Restaurants (lot R1) : offre des 10 premiers restaurants qui SIGNENT leur contrat ---------- */
// contrats = contratsRestos signes ou valides [{ id, nom, signeLeMs }] ; le rang suit la date de signature
export function offreLancement(contrats, places = 10) {
  const l = [...(contrats || [])].filter((c) => c && Number(c.signeLeMs) > 0).sort((a, b) => a.signeLeMs - b.signeLeMs);
  const beneficiaires = l.slice(0, places).map((c, i) => ({ ...c, rang: i + 1 }));
  return { places, signes: l.length, restantes: Math.max(0, places - l.length), beneficiaires, estBeneficiaire: (id) => beneficiaires.some((b) => b.id === id) };
}
// Fiche du restaurant (reglages/vitrineRestos) -> page de depart, sans recopier les photos (elles restent dans la fiche)
export function pageDepuisFicheResto(fiche = {}, modeleId = "r-sushi") {
  const p = pageVide({ nomCommercial: fiche.nom, metier: fiche.cuisine, description: fiche.description, horaires: fiche.horaires, telephone: fiche.telephone, whatsapp: fiche.whatsapp }, modeleId);
  return {
    ...p, type: "restaurant", restoId: txt(fiche.id, 40), proId: "", cacherout: txt(fiche.cacherout, 120), menuPdf: lien(fiche.menu),
    adressePostale: txt(fiche.adresse, 200), zone: txt(fiche.zone, 300), tarifsTexte: "", boutonWhatsApp: "Commander sur WhatsApp",
    messageWhatsApp: `Bonjour ${fiche.nom || ""}, je souhaite commander (vu sur Rebecca Services).`,
  };
}
