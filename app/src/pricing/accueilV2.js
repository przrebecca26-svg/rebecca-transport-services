// NOUVEL ACCUEIL « DEUX UNIVERS » (lot P1, 27 nov. 2026, validé par Rebecca à 14h51) - logique pure, testée dans
// tests/accueilV2.test.mjs. Construit CACHÉ (#/nouvel-accueil) : l'accueil actuel reste tel quel jusqu'à l'accord de Rebecca.
//
// Deux univers bien séparés :
//  - Rebecca Services : prestations réalisées par Rebecca et son équipe (Transport & Livraison, Beauté & Bien-être,
//    Boutique & Créations, Digital & Applications) ;
//  - Partenaires : professionnels, restaurants et boutiques INDÉPENDANTS (13 catégories et leurs spécialités).
//
// Données (aucune nouvelle règle : reglages/ est lisible par tous et modifiable par Rebecca seule, règles actuelles) :
//  - reglages/accueilV2 : { json } = catégories, spécialités, classement des partenaires, mis en avant, nouveaux,
//    bannières, annonces et offres, textes des univers. Photos : pagesPhotos (règles v42), une photo par document.
// Les fiches des pros viennent de l'annuaire public (reglages/prosAnnuaire), les restaurants de reglages/vitrineRestos.

const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
const idOk = (x) => typeof x === "string" && /^[a-z0-9_-]{2,40}$/.test(x);
const photoOk = (x) => (typeof x === "string" && /^[A-Za-z0-9]{12,40}$/.test(x) ? x : "");
const lienOk = (x) => {
  const l = txt(x, 300);
  return /^(https:\/\/|#\/|\/)/.test(l) ? l : "";
};
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[''`’\-&/,.()]/g, " ").replace(/\s+/g, " ").trim();
export const idDepuisNom = (nom) => sansAccents(nom).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "categorie";

/* ---------- Icônes (dessins fins rose poudré, choisies dans l'admin) ---------- */
export const ICONES = ["couverts", "chariot", "cle", "ciseaux", "sac", "maison", "bebe", "coeur", "mallette", "fete", "voiture", "chapeau", "grille", "etoile", "fleur", "appareil", "cadeau", "livre", "telephone", "colis", "bijou", "pinceau"];

/* ---------- Univers Rebecca Services ---------- */
// pages = identifiants de Réglages → Pages du site (ouverte / bientôt / cachée), comme l'accueil actuel
export const UNIVERS_REBECCA = [
  { id: "transport", titre: "Transport & Livraison", texte: "Trajets, aéroport, livraisons, courses et petits déménagements", image: "/icon-512.png", pages: ["coursier", "transport"] },
  { id: "beaute", titre: "Beauté & Bien-être", texte: "Ongles, coiffure, reconstruction du cheveu, minceur", image: "/brand/logo-prestige-beautys.png", pages: ["nails", "hair", "regenx", "slim"] },
  { id: "boutique", titre: "Boutique & Créations", texte: "Créations personnalisées en résine", image: "/brand/logo-epoxy.png", pages: ["epoxy"] },
  { id: "digital", titre: "Digital & Applications", texte: "Sites web et applications professionnelles", image: "/brand/logo-digital-applications.png", pages: ["digital"] },
];
// Illustrations par défaut des univers (photos déjà sur le site)
export const ILLUSTRATIONS = { transport: "/accueil/transport.jpg", beaute: "/accueil/beaute.jpg", boutique: "/accueil/boutique.jpg", digital: "/accueil/digital.jpg" };

// Prestations de Rebecca pour la recherche : mots que les clientes tapent (« coiffeuse » trouve Prestige Hair)
export const PRESTATIONS_REBECCA = [
  { id: "nails", univers: "beaute", page: "nails", nom: "Nails Prestige", texte: "Onglerie : semi-permanent, extensions, nail art", mots: "ongles onglerie manucure pedicure vernis semi permanent gel acrylique nail art beaute des mains extensions prothesiste ongulaire" },
  { id: "hair", univers: "beaute", page: "hair", nom: "Prestige Hair", texte: "Coupe, couleur, brushing, coiffure de soirée et de mariée", mots: "coiffure coiffeuse coiffeur cheveux coupe couleur brushing meches chignon mariee balayage salon" },
  { id: "regenx", univers: "beaute", page: "regenx", nom: "RegenX", texte: "Reconstruction du cheveu et du poil", mots: "cheveux poils sourcils barbe reconstruction calvitie perte de cheveux densite" },
  { id: "slim", univers: "beaute", page: "slim", nom: "Prestige Slim & Lift", texte: "Soins minceur et raffermissement", mots: "minceur amincissement silhouette raffermissement soins du corps cellulite esthetique bien etre" },
  { id: "epoxy", univers: "boutique", page: "epoxy", nom: "Boutique Epoxy", texte: "Créations personnalisées en résine", mots: "resine epoxy cadeau decoration bijoux plateau chabbat lampe boite creations personnalisees boutique" },
  { id: "digital", univers: "digital", page: "digital", nom: "Digital & Applications", texte: "Création de sites web et d'applications", mots: "site web site internet application appli creation informatique digital page professionnelle" },
];
// Mots en plus pour les services de transport et coursier (en plus de leur titre et de leur texte)
export const MOTS_SERVICES = {
  transport: "taxi chauffeur trajet voiture transport prive conduite",
  aeroport: "aeroport ben gourion vol avion transfert navette taxi chauffeur",
  livraison: "livraison livreur coursier colis cles documents enveloppe",
  courses: "courses achats supermarche epicerie commissions",
  hatan_kala: "mariage maries hatan kala voiture de mariage decoration",
  demenagement: "demenagement cartons valises transport d objets",
  ramassage: "ramassage scolaire ecole enfants gan trajet scolaire",
  attente: "mise a disposition attente accompagnement evenement chauffeur",
};

/* ---------- Les 13 catégories validées (27 nov., 14h46) ---------- */
// anciens = métiers de l'annuaire actuel (reglages/prosCategories) rangés automatiquement dans cette catégorie
// 27 nov. 2026, 15h21 (Rebecca) : ses propres prestations ne sont JAMAIS dans une catégorie partenaire ; elles restent
// dans son univers et n'apparaissent dans la recherche que dans le groupe « Rebecca Services ».
export const CATEGORIES_V2_DEFAUT = [
  { id: "restaurants", nom: "Restaurants & Traiteurs", icone: "couverts", anciens: ["traiteur"], restos: true, specialites: ["Restaurants", "Traiteurs", "Pâtisseries", "Boulangeries", "Cafés", "Sushis", "Restauration rapide"] },
  { id: "epicerie", nom: "Épicerie & Supermarché", icone: "chariot", anciens: [], specialites: ["Épiceries", "Supermarchés", "Primeurs", "Boucheries", "Produits du monde", "Boissons"] },
  { id: "travaux", nom: "Travaux & Dépannage", icone: "cle", anciens: ["travaux"], specialites: ["Plomberie", "Électricité", "Serrurerie", "Peinture", "Climatisation", "Petits travaux", "Rénovation"] },
  { id: "beaute", nom: "Beauté & Esthétique", icone: "ciseaux", anciens: ["beaute"], specialites: ["Coiffure", "Onglerie", "Esthétique", "Maquillage", "Épilation", "Cils et sourcils", "Massage"] },
  { id: "mode", nom: "Mode & Boutiques", icone: "sac", anciens: [], specialites: ["Prêt-à-porter", "Accessoires", "Bijoux", "Perruques", "Chaussures", "Créateurs"] },
  { id: "maison", nom: "Maison & Entretien", icone: "maison", anciens: ["menage"], specialites: ["Ménage", "Repassage", "Nettoyage", "Jardinage", "Décoration"] },
  { id: "famille", nom: "Famille & Enfants", icone: "bebe", anciens: ["garde"], specialites: ["Garde d'enfants", "Activités enfants", "Anniversaires", "Puériculture"] },
  { id: "sante", nom: "Santé & Bien-être", icone: "coeur", anciens: ["sante"], specialites: ["Bien-être", "Sport et coaching", "Diététique", "Paramédical", "Accompagnement"] },
  { id: "services-pro", nom: "Services professionnels", icone: "mallette", anciens: [], specialites: ["Comptabilité", "Administratif", "Traduction", "Informatique", "Photographie", "Impression", "Marketing"] },
  { id: "evenementiel", nom: "Événementiel", icone: "fete", anciens: ["evenements"], specialites: ["Décoration d'événements", "Animation", "DJ et musique", "Photographe", "Location de matériel"] },
  { id: "automobile", nom: "Automobile", icone: "voiture", anciens: [], specialites: ["Garage", "Lavage auto", "Pneus", "Location", "Auto-école"] },
  { id: "formation", nom: "Formation & Éducation", icone: "chapeau", anciens: ["cours"], specialites: ["Soutien scolaire", "Langues", "Musique", "Cours particuliers", "Formations professionnelles"] },
  { id: "autres", nom: "Autres services", icone: "grille", anciens: ["autres"], specialites: [] },
];

const specialitesDepuis = (l) => {
  const vus = new Set();
  return (Array.isArray(l) ? l : [])
    .map((s) => (typeof s === "string" ? { nom: s } : s || {}))
    .map((s) => ({ id: idOk(s.id) ? s.id : idDepuisNom(s.nom), nom: txt(s.nom, 50), visible: s.visible !== false }))
    .filter((s) => s.nom && !vus.has(s.id) && vus.add(s.id))
    .slice(0, 40);
};
export function normaliserCategorie(c = {}) {
  return {
    id: idOk(c.id) ? c.id : idDepuisNom(c.nom),
    nom: txt(c.nom, 50) || "Catégorie",
    icone: ICONES.includes(c.icone) ? c.icone : "grille",
    photo: photoOk(c.photo),
    texte: txt(c.texte, 160),
    visible: c.visible !== false,
    masquerSiVide: c.masquerSiVide !== false,
    restos: c.restos === true,
    anciens: Array.isArray(c.anciens) ? c.anciens.filter(idOk).slice(0, 20) : [],
    specialites: specialitesDepuis(c.specialites),
  };
}
export const categoriesParDefaut = () => CATEGORIES_V2_DEFAUT.map(normaliserCategorie);

const normaliserBanniere = (b = {}) => ({
  id: idOk(b.id) ? b.id : "b" + Math.random().toString(36).slice(2, 10),
  titre: txt(b.titre, 80), texte: txt(b.texte, 200), bouton: txt(b.bouton, 30), lien: lienOk(b.lien), photo: photoOk(b.photo),
  actif: b.actif !== false, du: DATE_OK.test(b.du || "") ? b.du : "", au: DATE_OK.test(b.au || "") ? b.au : "",
});
const normaliserAnnonce = (a = {}) => ({
  id: idOk(a.id) ? a.id : "a" + Math.random().toString(36).slice(2, 10),
  type: a.type === "offre" ? "offre" : "annonce", texte: txt(a.texte, 200), lien: lienOk(a.lien),
  actif: a.actif !== false, du: DATE_OK.test(a.du || "") ? a.du : "", au: DATE_OK.test(a.au || "") ? a.au : "",
});
// clé d'un partenaire : « p:ID » pour un pro de l'annuaire, « r:ID » pour un restaurant
const cleOk = (k) => typeof k === "string" && /^[pr]:[A-Za-z0-9_-]{1,40}$/.test(k);

export const accueilVide = () => ({ categories: categoriesParDefaut(), classement: {}, misEnAvant: [], nouveaux: [], bannieres: [], annonces: [], univers: {}, publie: false });
export function lireAccueil(json) {
  let v = null;
  try {
    v = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    v = null;
  }
  if (!v || typeof v !== "object") return accueilVide();
  const vus = new Set();
  const categories = Array.isArray(v.categories) && v.categories.length ? v.categories.map(normaliserCategorie).filter((c) => !vus.has(c.id) && vus.add(c.id)).slice(0, 30) : categoriesParDefaut();
  const ids = new Set(categories.map((c) => c.id));
  const classement = {};
  for (const [k, x] of Object.entries(v.classement && typeof v.classement === "object" ? v.classement : {})) {
    if (!cleOk(k) || !x) continue;
    classement[k] = { cats: (Array.isArray(x.cats) ? x.cats : []).filter((c) => ids.has(c)).slice(0, 5), specs: (Array.isArray(x.specs) ? x.specs : []).filter(idOk).slice(0, 12) };
  }
  const univers = {};
  for (const u of UNIVERS_REBECCA) {
    const x = (v.univers || {})[u.id] || {};
    univers[u.id] = { titre: txt(x.titre, 50), texte: txt(x.texte, 160), photo: photoOk(x.photo) };
  }
  return {
    categories,
    classement,
    misEnAvant: [...new Set((Array.isArray(v.misEnAvant) ? v.misEnAvant : []).filter(cleOk))].slice(0, 12),
    nouveaux: [...new Set((Array.isArray(v.nouveaux) ? v.nouveaux : []).filter(cleOk))].slice(0, 12),
    bannieres: (Array.isArray(v.bannieres) ? v.bannieres : []).map(normaliserBanniere).slice(0, 8),
    annonces: (Array.isArray(v.annonces) ? v.annonces : []).map(normaliserAnnonce).slice(0, 10),
    univers,
    publie: v.publie === true,
  };
}
export const texteUnivers = (config, id) => {
  const u = UNIVERS_REBECCA.find((x) => x.id === id) || UNIVERS_REBECCA[0];
  const p = (config && config.univers && config.univers[id]) || {};
  return { ...u, titre: p.titre || u.titre, texte: p.texte || u.texte, photo: p.photo || "", illustration: ILLUSTRATIONS[id] };
};

/* ---------- Dates : bannières et annonces programmées ---------- */
export const enCours = (x, jour) => x.actif && (!x.du || x.du <= jour) && (!x.au || x.au >= jour);
export const bannieresActives = (config, jour) => (config.bannieres || []).filter((b) => enCours(b, jour) && (b.titre || b.photo));
export const annoncesActives = (config, jour) => (config.annonces || []).filter((a) => enCours(a, jour) && a.texte);

/* ---------- Partenaires : pros (annuaire public) + restaurants (vitrine) ---------- */
// racine d'un mot : « coiffeuse », « coiffure » et « coiffeur » se retrouvent ; « plombier » trouve « plomberie »
const racine = (m) => (m.length >= 6 ? m.slice(0, 5) : m.length >= 4 ? m.slice(0, 4) : m);
const mots = (s) => sansAccents(s).split(" ").filter((m) => m.length >= 2 && !["de", "des", "du", "la", "le", "les", "et", "en", "un", "une", "au", "aux", "pour", "a", "d", "l"].includes(m));
export const correspond = (texte, cible) => {
  const r = mots(cible).map(racine);
  const t = mots(texte);
  return t.length > 0 && t.every((m) => r.some((x) => x.startsWith(racine(m)) || racine(m).startsWith(x)));
};

export function partenairesDepuis(fiches = [], restos = []) {
  const pros = (fiches || [])
    .filter((f) => f && f.id && f.nomCommercial && f.activiteRS !== true) // les activités de Rebecca restent dans son univers
    .map((f) => ({
      cle: "p:" + f.id, type: "pro", id: f.id, nom: f.nomCommercial, metier: f.metier || "", texte: f.description || "",
      recherche: `${f.nomCommercial} ${f.metier} ${f.prestations} ${f.description}`, villes: `${f.villes || ""} ${f.zone || ""}`,
      ancienne: f.categorie || "", verifie: f.verifie === true, lien: f.siteDigital && /^https?:|^\/p\//.test(f.siteDigital) ? f.siteDigital : `#/pros/${f.id}`, boutique: false,
    }));
  const r = (restos || [])
    .filter((x) => x && x.id && x.nom && x.visible !== false)
    .map((x) => ({
      cle: "r:" + x.id, type: "resto", id: x.id, nom: x.nom, metier: x.cuisine || "Restaurant", texte: x.description || "",
      recherche: `${x.nom} ${x.cuisine || ""} ${x.cacherout || ""} ${x.description || ""} restaurant`, villes: `${x.adresse || ""} ${x.zone || ""}`,
      ancienne: "", verifie: false, lien: x.page || "#/restaurants", icone: x.icone || "🍽️",
    }));
  return [...pros, ...r];
}

// Catégories d'un partenaire : choix de Rebecca (classement) sinon rangement automatique (ancien métier, restaurant)
export function categoriesDuPartenaire(config, p) {
  const choix = config.classement[p.cle];
  if (choix && choix.cats.length) return choix.cats;
  return config.categories.filter((c) => (p.type === "resto" ? c.restos : c.anciens.includes(p.ancienne))).map((c) => c.id).slice(0, 1);
}
// Spécialités : choix de Rebecca, sinon celles qui apparaissent dans son métier ou ses prestations
export function specialitesDuPartenaire(config, p, categorie) {
  const choix = config.classement[p.cle];
  const specs = categorie ? categorie.specialites : config.categories.flatMap((c) => c.specialites);
  if (choix && choix.specs.length) return specs.filter((s) => choix.specs.includes(s.id)).map((s) => s.id);
  return specs.filter((s) => correspond(s.nom, `${p.metier} ${p.recherche}`)).map((s) => s.id);
}
export function partenairesDeCategorie(config, partenaires, categorieId, { specialite = "", ville = "" } = {}) {
  const c = config.categories.find((x) => x.id === categorieId);
  if (!c) return [];
  const l = partenaires.filter((p) => categoriesDuPartenaire(config, p).includes(categorieId)).filter((p) => !specialite || specialitesDuPartenaire(config, p, c).includes(specialite)).filter((p) => villeOk(p, ville));
  return trier(config, l);
}
const villeOk = (p, ville) => !ville || sansAccents(p.villes).includes(sansAccents(ville)) || /toute?s? (israel|le pays)/.test(sansAccents(p.villes));
const trier = (config, l) => [...l].sort((a, b) => (config.misEnAvant.includes(b.cle) - config.misEnAvant.includes(a.cle)) || (b.verifie - a.verifie) || a.nom.localeCompare(b.nom, "fr"));

export const nombreParCategorie = (config, partenaires) => Object.fromEntries(config.categories.map((c) => [c.id, partenaires.filter((p) => categoriesDuPartenaire(config, p).includes(c.id)).length]));
// Catégories montrées aux clientes : visibles, et non vides (sauf si Rebecca a décoché « masquer si vide »).
// Seuls les PARTENAIRES comptent : les prestations de Rebecca ne remplissent jamais une catégorie partenaire.
export function categoriesAffichees(config, partenaires) {
  const n = nombreParCategorie(config, partenaires);
  return config.categories.filter((c) => c.visible && (n[c.id] > 0 || !c.masquerSiVide));
}
export const specialitesAffichees = (config, partenaires, categorie) => categorie.specialites.filter((s) => s.visible && (partenaires.some((p) => categoriesDuPartenaire(config, p).includes(categorie.id) && specialitesDuPartenaire(config, p, categorie).includes(s.id)) || !categorie.masquerSiVide));
export const misEnAvantListe = (config, partenaires) => config.misEnAvant.map((k) => partenaires.find((p) => p.cle === k)).filter(Boolean);
export const nouveauxListe = (config, partenaires) => config.nouveaux.map((k) => partenaires.find((p) => p.cle === k)).filter(Boolean);
export const villesDesPartenaires = (partenaires) => {
  const m = new Map();
  for (const p of partenaires) for (const v of String(p.villes).split(/[,;/]/)) {
    const n = v.trim();
    if (n && n.length < 30 && !/\d/.test(n) && !m.has(sansAccents(n))) m.set(sansAccents(n), n);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, "fr"));
};

/* ---------- Recherche générale ---------- */
// services = SERVICES (transport et coursier) ; visible(page) dit si l'activité est ouverte pour ce visiteur
export function rechercher(texte, { config, partenaires = [], services = [], visible = () => true, ville = "" } = {}) {
  const t = txt(texte, 80);
  const vide = { rebecca: [], partenaires: [], categories: [], specialites: [] };
  if (sansAccents(t).length < 2 && !ville) return vide;
  const rebecca = [
    ...services.filter((s) => visible(s.activite)).filter((s) => correspond(t, `${s.titre} ${s.texte} ${MOTS_SERVICES[s.id] || ""}`)).map((s) => ({ type: "service", id: s.id, nom: s.titre, texte: s.texte, univers: "transport" })),
    ...PRESTATIONS_REBECCA.filter((p) => visible(p.page)).filter((p) => correspond(t, `${p.nom} ${p.texte} ${p.mots}`)).map((p) => ({ type: "prestation", id: p.id, nom: p.nom, texte: p.texte, univers: p.univers })),
  ];
  const cats = config.categories.filter((c) => c.visible);
  const categories = t ? cats.filter((c) => correspond(t, c.nom) || c.specialites.some((s) => s.visible && correspond(t, s.nom))) : [];
  const specialites = t ? cats.flatMap((c) => c.specialites.filter((s) => s.visible && correspond(t, s.nom)).map((s) => ({ ...s, categorie: c.id, nomCategorie: c.nom }))) : [];
  const visibles = new Set(cats.map((c) => c.id));
  const parts = partenaires
    .filter((p) => categoriesDuPartenaire(config, p).some((c) => visibles.has(c)))
    .filter((p) => villeOk(p, ville))
    .filter((p) => {
      if (!t) return true;
      const nomsCats = categoriesDuPartenaire(config, p).map((id) => (config.categories.find((c) => c.id === id) || {}).nom || "").join(" ");
      const specs = specialitesDuPartenaire(config, p).map((id) => (config.categories.flatMap((c) => c.specialites).find((s) => s.id === id) || {}).nom || "").join(" ");
      return correspond(t, `${p.recherche} ${p.villes} ${nomsCats} ${specs}`);
    });
  return { rebecca: ville && !t ? [] : rebecca, partenaires: trier(config, parts), categories, specialites };
}
