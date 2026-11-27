// RECHERCHE ET PRIORITÉ DES ACTIVITÉS REBECCA SERVICES (décision définitive de Rebecca, 27 nov. 2026, 15h30)
// Logique pure, partagée par l'annuaire (#/pros) et le nouvel accueil ; testée dans tests/recherche.test.mjs.
// - Une activité de Rebecca (fiche « activiteRS ») qui correspond à la recherche passe TOUJOURS avant les partenaires,
//   même mis en avant ou en formule payante, si elle couvre la ville demandée (sa ville / sa zone).
// - Entre plusieurs activités de Rebecca : l'ordre choisi par Rebecca dans l'admin (sinon l'ordre par défaut).
// - Recherche tolérante : accents, majuscules, synonymes, fautes courantes, villes écrites autrement (Natanya, Natania…).

export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[''`’\-&/,.()]/g, " ").replace(/\s+/g, " ").trim();
const VIDES = new Set(["de", "des", "du", "la", "le", "les", "et", "en", "un", "une", "au", "aux", "pour", "a", "d", "l", "sur", "dans", "chez", "avec", "je", "cherche", "recherche", "besoin", "pres", "vers", "ou"]);
export const mots = (s) => sansAccents(s).split(" ").filter((m) => m.length >= 2 && !VIDES.has(m));

/* ---------- Villes : écritures différentes de la même ville ---------- */
const VILLES = {
  netanya: ["netanya", "natanya", "natania", "netania", "netanyah", "nathanya", "netanja", "natanja", "נתניה"],
  "tel aviv": ["tel aviv", "telaviv", "tel aviv yafo", "tlv", "tel-aviv", "תל אביב"],
  jerusalem: ["jerusalem", "yerushalayim", "jerusalaim", "ירושלים"],
  haifa: ["haifa", "hayfa", "heifa", "חיפה"],
  herzliya: ["herzliya", "herzlia", "hertzliya", "hertzelia", "herzelia", "הרצליה"],
  raanana: ["raanana", "ra anana", "ranana", "רעננה"],
  hadera: ["hadera", "hadra", "חדרה"],
  "kfar yona": ["kfar yona", "kfar yonah", "kfar yonna", "כפר יונה"],
  "even yehuda": ["even yehuda", "even yehouda", "אבן יהודה"],
  "kadima tzoran": ["kadima", "tzoran", "kadima tzoran", "kadima zoran", "קדימה"],
  ashdod: ["ashdod", "אשדוד"],
  "petah tikva": ["petah tikva", "petah tikvah", "petach tikva", "פתח תקווה"],
  "rishon lezion": ["rishon", "rishon lezion", "rishon letzion", "ראשון לציון"],
  "ramat gan": ["ramat gan", "רמת גן"],
  "kfar saba": ["kfar saba", "kfar sava", "כפר סבא"],
  "beer sheva": ["beer sheva", "beersheva", "beer sheba", "באר שבע"],
  eilat: ["eilat", "eilath", "אילת"],
  "aeroport ben gourion": ["ben gourion", "ben gurion", "natbag", "נתבג"],
};
const ALIAS = Object.entries(VILLES).flatMap(([c, l]) => l.map((a) => [sansAccents(a), c])).sort((a, b) => b[0].length - a[0].length);
const proche = (a, b) => {
  // distance d'édition <= 1 (2 pour les mots longs) entre deux mots : « natnya », « netaniya »…
  if (Math.abs(a.length - b.length) > 2) return false;
  const max = Math.min(a.length, b.length) >= 7 ? 2 : 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= max;
};
// Nom de ville « officiel » d'un texte (ou le texte nettoyé si ce n'est pas une ville connue)
export function villeCanon(texte) {
  const t = sansAccents(texte);
  if (!t) return "";
  for (const [a, c] of ALIAS) if (t === a) return c;
  if (t.length >= 5) for (const [a, c] of ALIAS) if (!a.includes(" ") && proche(t, a)) return c;
  return t;
}
// La ville demandée est-elle couverte par ces villes / cette zone ? (« toute Israël » couvre tout)
export function villeCouverte(ville, villesEtZone) {
  const v = villeCanon(ville);
  if (!v) return true;
  const z = sansAccents(villesEtZone);
  if (/toute?s? (israel|le pays)|partout en israel|a distance/.test(z)) return true;
  const morceaux = String(villesEtZone || "").split(/[,;/–\-]| et | ou /).map((x) => x.replace(/\bsur rendez vous\b|\balentours?\b|\bet\b/gi, "").trim()).filter(Boolean);
  return morceaux.some((m) => villeCanon(m) === v) || z.split(" ").some((m) => m.length >= 4 && villeCanon(m) === v);
}
// Sépare la ville tapée dans la recherche (« ongles natania ») du reste (« ongles »)
export function separerVille(texte, villesConnues = []) {
  const m = sansAccents(texte).split(" ").filter(Boolean);
  const connues = new Set(villesConnues.map(villeCanon));
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= m.length; i++) {
      const bout = m.slice(i, i + n).join(" ");
      const c = villeCanon(bout);
      if (VILLES[c] || connues.has(c)) return { ville: c, reste: [...m.slice(0, i), ...m.slice(i + n)].join(" ") };
    }
  }
  return { ville: "", reste: m.join(" ") };
}

/* ---------- Mots : synonymes et fautes courantes ---------- */
// Chaque groupe = mots équivalents pour une cliente (on cherche l'un, on trouve les autres)
const SYNONYMES = [
  ["ongle", "ongles", "onglerie", "manucure", "manicure", "pedicure", "nail", "nails", "vernis", "semi permanent", "gel", "prothesiste"],
  ["coiffeuse", "coiffeur", "coiffure", "cheveux", "coupe", "brushing", "couleur", "meches", "salon", "hair"],
  ["capillaire", "cheveux", "poils", "barbe", "sourcils", "calvitie", "chute", "reconstruction"],
  ["radiofrequence", "cavitation", "drainage", "lymphatique", "minceur", "amincissement", "cellulite", "raffermissement", "silhouette"],
  ["transport", "taxi", "chauffeur", "trajet", "voiture", "navette", "vtc"],
  ["aeroport", "ben gourion", "ben gurion", "natbag", "vol", "avion", "transfert"],
  ["livraison", "livreur", "livrer", "coursier", "course", "colis", "cles", "documents"],
  ["courses", "achats", "supermarche", "epicerie", "commissions"],
  ["demenagement", "cartons", "demenager"],
  ["site", "site web", "site internet", "application", "appli", "applications", "vitrine", "digital", "informatique"],
  ["resine", "epoxy", "creations", "bijoux", "decoration", "cadeau"],
  ["plombier", "plomberie", "fuite", "debouchage"],
  ["electricien", "electricite"],
  ["menage", "nettoyage", "femme de menage", "entretien"],
  ["restaurant", "resto", "manger", "repas", "traiteur", "sushi", "sushis"],
  ["mariage", "maries", "hatan", "kala"],
];
const racine = (m) => (m.length >= 6 ? m.slice(0, 5) : m.length >= 4 ? m.slice(0, 4) : m);
const motCorrespond = (q, cible) => cible.some((c) => {
  const r = racine(c), rq = racine(q);
  return r.startsWith(rq) || (r.length >= 4 && rq.startsWith(r)) || (q.length >= 5 && c.length >= 4 && proche(q.slice(0, Math.max(5, Math.min(q.length, c.length))), c.slice(0, Math.max(5, Math.min(q.length, c.length)))));
});
const equivalents = (q) => {
  const l = [q];
  for (const g of SYNONYMES) if (g.some((s) => !s.includes(" ") && (s === q || (q.length >= 5 && proche(q, s)) || (q.length >= 4 && s.startsWith(q))))) l.push(...g.flatMap((s) => s.split(" ")));
  return [...new Set(l)];
};
// Tous les mots de la recherche se retrouvent dans le texte (avec synonymes et fautes courantes)
export function correspond(texte, cible) {
  const t = mots(texte);
  const c = mots(cible);
  return t.length > 0 && t.every((q) => equivalents(q).some((e) => motCorrespond(e, c)));
}
// Même chose sans synonymes : sert à classer d'abord ce qui correspond mot pour mot (« aéroport » → Aéroport)
export function correspondDirect(texte, cible) {
  const t = mots(texte);
  const c = mots(cible);
  return t.length > 0 && t.every((q) => motCorrespond(q, c));
}
// Mots que les clientes tapent pour chacune de mes activités (en plus du texte de sa fiche)
export const MOTS_RS = {
  nails: "ongles onglerie manucure pedicure vernis semi permanent gel acrylique nail art beaute des mains extensions prothesiste ongulaire",
  hair: "coiffure coiffeuse coiffeur cheveux coupe couleur brushing meches chignon mariee balayage salon",
  regenx: "soin capillaire cheveux poils sourcils barbe reconstruction calvitie chute de cheveux densite",
  slim: "minceur amincissement silhouette raffermissement radiofrequence cavitation drainage lymphatique cellulite soins du corps",
  epoxy: "resine epoxy cadeau decoration bijoux plateau chabbat lampe bougies boite creations personnalisees boutique",
  digital: "site web site internet application appli creation informatique digital page professionnelle vitrine",
};

/* ---------- Priorité des activités de Rebecca ---------- */
// Ordre par défaut ; Rebecca le change dans l'admin (Nouvel accueil → Mes activités). Une nouvelle activité arrive
// toute seule à la fin, sans toucher au code.
export const ORDRE_RS_DEFAUT = ["s:transport", "x:nails", "x:hair", "x:regenx", "x:slim", "x:epoxy", "x:digital"];
// Quelle prestation de Rebecca correspond à une fiche de l'annuaire (pour ouvrir directement ses prix et réservations)
export function prestationDeFiche(f) {
  const n = sansAccents(f && f.nomCommercial);
  return /nails/.test(n) ? "nails" : /hair/.test(n) ? "hair" : /regenx/.test(n) ? "regenx" : /slim/.test(n) ? "slim" : /epoxy/.test(n) ? "epoxy" : /digital/.test(n) ? "digital" : "";
}
// Rang d'une activité (plus petit = plus haut) : cles = « p:<id fiche> », « x:<prestation> » ou « s:transport »
export function rangRS(priorite, cle, prestation = "") {
  const l = Array.isArray(priorite) && priorite.length ? priorite : ORDRE_RS_DEFAUT;
  const i = l.indexOf(cle);
  if (i >= 0) return i;
  const j = prestation ? l.indexOf("x:" + prestation) : -1;
  if (j >= 0) return j;
  const k = prestation ? ORDRE_RS_DEFAUT.indexOf("x:" + prestation) : -1;
  return 100 + (k >= 0 ? k : 50);
}
// Tri commun : activités de Rebecca d'abord (dans son ordre), puis partenaires mis en avant, vérifiés, par nom
// direct(x) : la fiche contient les mots tapés eux-mêmes (pas seulement un synonyme) : « barbe » → RegenX avant Hair
export function trierAvecPriorite(liste, { priorite = [], estRS = (x) => x.activiteRS === true, cle = (x) => "p:" + x.id, prestation = (x) => prestationDeFiche(x), avant = () => false, verifie = (x) => x.verifie === true, nom = (x) => x.nomCommercial || x.nom || "", direct = () => true } = {}) {
  return [...(liste || [])].sort((a, b) => {
    const ra = estRS(a), rb = estRS(b);
    if (ra !== rb) return ra ? -1 : 1;
    if (ra && rb) return (direct(b) - direct(a)) || rangRS(priorite, cle(a), prestation(a)) - rangRS(priorite, cle(b), prestation(b)) || nom(a).localeCompare(nom(b), "fr");
    return (avant(b) - avant(a)) || (verifie(b) - verifie(a)) || nom(a).localeCompare(nom(b), "fr");
  });
}
