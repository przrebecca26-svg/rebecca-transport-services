// RESEAU DE PROFESSIONNELS PARTENAIRES (lance par Rebecca le 25 nov. 2026, 19h38)
// Logique pure (sans Firebase), testee dans tests/pros.test.mjs.
// Principe (Rebecca) : les pros sont des INDEPENDANTS qui font leur metier eux-memes. Rebecca leur offre une place sur
// son site (Referencement gratuit) et leur vend une formule Digital (Vitrine, Business, Pack Pro). Rebecca Services
// n'encaisse jamais l'argent de leurs prestations et n'en porte pas la responsabilite (« Prestataire independant »).
// Construit CACHE du public jusqu'a l'accord final de Rebecca (Reglages -> Pages du site -> « Professionnels »).
//
// Donnees (sans nouvelle regle Firebase, decision de Rebecca : « sans modifier encore les regles ») :
//  - admin/prosDossiers   : dossiers PRIVES (osek, telephone prive, statut, formule, justificatifs, journal) - Rebecca seule
//  - admin/prosDoc_<id>   : photos des justificatifs d'un pro - Rebecca seule
//  - reglages/prosCategories : metiers (publics)
//  - reglages/prosAnnuaire   : SEULEMENT les fiches acceptees et actives, champs publics uniquement
//  - reglages/prosImg_<id>   : logo et photos publiques d'une fiche
// Plus tard, avec les regles v37 : inscription en ligne (prosCandidatures), demandes et statistiques.

export const FORMULES_PRO = [
  { v: "referencement", l: "Référencement", detail: "Fiche standard dans l'annuaire (gratuit au lancement)" },
  { v: "vitrine", l: "Vitrine", detail: "Page professionnelle personnalisée : présentation, prestations, tarifs, coordonnées, WhatsApp" },
  { v: "business", l: "Business", detail: "Page professionnelle + espace administrateur + modules selon les besoins" },
  { v: "packpro", l: "Pack Pro", detail: "Agenda, fichier clients, rappels, statistiques" },
];
export const libelleFormule = (v) => (FORMULES_PRO.find((f) => f.v === v) || FORMULES_PRO[0]).l;
// Formules qui donnent une page personnalisee (lien vers leur page Digital)
export const formuleAvecPage = (v) => ["vitrine", "business", "packpro"].includes(v);
// Formules qui peuvent avoir un agenda en ligne (Business avec module agenda, Pack Pro) - etape C3
export const formuleAvecAgenda = (formule, modules = []) => formule === "packpro" || (formule === "business" && (modules || []).includes("agenda"));

// Metiers de depart (modifiables dans l'admin). Garde d'enfants : cachee jusqu'a l'avis du juriste (decision 3).
export const CATEGORIES_DEFAUT = [
  { id: "beaute", nom: "Beauté et bien-être", icone: "💅", visible: true },
  { id: "menage", nom: "Ménage et entretien", icone: "🧽", visible: true },
  { id: "travaux", nom: "Travaux et dépannage", icone: "🛠️", visible: true },
  { id: "traiteur", nom: "Traiteurs et pâtisserie", icone: "🍰", visible: true },
  { id: "evenements", nom: "Événements et animation", icone: "🎉", visible: true },
  { id: "cours", nom: "Cours et soutien scolaire", icone: "📚", visible: true },
  { id: "sante", nom: "Santé et accompagnement", icone: "🩺", visible: true },
  { id: "garde", nom: "Garde d'enfants", icone: "🧸", visible: false, sensible: true },
  { id: "autres", nom: "Autres métiers", icone: "✨", visible: true },
];

const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
const idOk = (x) => typeof x === "string" && /^[a-z0-9_-]{2,40}$/.test(x);
// Code d'invitation de l'espace pro (lien #/admin?pro=CODE) : impossible a deviner
export function nouveauCodeInvitation() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const t = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(t);
  return [...t].map((x) => c[x % c.length]).join("");
}
export const nouvelIdPro = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 24);

export function lireCategories(json) {
  let l = null;
  try {
    l = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    l = null;
  }
  if (!Array.isArray(l) || !l.length) return CATEGORIES_DEFAUT.map((c) => ({ ...c }));
  const vus = new Set();
  return l
    .filter((c) => c && idOk(c.id) && !vus.has(c.id) && vus.add(c.id))
    .slice(0, 40)
    .map((c) => ({ id: c.id, nom: txt(c.nom, 60) || c.id, icone: txt(c.icone, 4) || "✨", visible: c.visible !== false, sensible: c.sensible === true }));
}
export const categoriesVisibles = (cats) => (cats || []).filter((c) => c.visible);
export const nomCategorie = (cats, id) => ((cats || []).find((c) => c.id === id) || { nom: "Autres métiers" }).nom;

/* ---------- Statuts du dossier ---------- */
export const STATUTS_PRO = [
  { v: "brouillon", l: "Brouillon" },
  { v: "soumis", l: "Soumis" },
  { v: "en_examen", l: "En examen" },
  { v: "accepte", l: "Accepté" },
  { v: "refuse", l: "Refusé" },
  { v: "suspendu", l: "Suspendu" },
];
export const libelleStatutPro = (v) => (STATUTS_PRO.find((s) => s.v === v) || { l: v }).l;
const TRANSITIONS = {
  brouillon: ["soumis", "en_examen", "refuse"],
  soumis: ["en_examen", "accepte", "refuse"],
  en_examen: ["accepte", "refuse", "soumis"],
  accepte: ["suspendu"],
  suspendu: ["accepte", "refuse"],
  refuse: ["en_examen"],
};
export const statutsPossibles = (statut) => TRANSITIONS[statut] || [];

// Changer le statut : jamais de saut interdit ; un refus ou une suspension demandent un motif ; trace dans le journal
export function changerStatut(dossier, nouveau, motif = "", quandMs = Date.now()) {
  if (!dossier) return { erreur: "Dossier introuvable." };
  if (!statutsPossibles(dossier.statut).includes(nouveau)) return { erreur: `Impossible de passer de « ${libelleStatutPro(dossier.statut)} » à « ${libelleStatutPro(nouveau)} ».` };
  const m = txt(motif, 300);
  if ((nouveau === "refuse" || nouveau === "suspendu") && !m) return { erreur: "Écris le motif (il reste dans le journal)." };
  const suite = { ...dossier, statut: nouveau, majLeMs: quandMs };
  // Une suspension ou un refus retire la fiche de l'annuaire ; le badge tombe aussi en cas de refus
  if (nouveau === "suspendu" || nouveau === "refuse") suite.actif = false;
  if (nouveau === "accepte") suite.actif = true;
  if (nouveau === "refuse") suite.badge = false;
  return { erreur: "", dossier: ajouterJournal(suite, `Statut : ${libelleStatutPro(nouveau)}${m ? ` — ${m}` : ""}`, quandMs) };
}
export function ajouterJournal(dossier, texte, quandMs = Date.now()) {
  const j = Array.isArray(dossier.journal) ? dossier.journal : [];
  return { ...dossier, journal: [{ leMs: quandMs, texte: txt(texte, 300) }, ...j].slice(0, 60) };
}

/* ---------- Justificatifs et badge « Partenaire verifie » ---------- */
export const TYPES_JUSTIF = [
  { v: "identite", l: "Pièce d'identité", toujours: true },
  { v: "osek", l: "Numéro d'osek (immatriculation)", toujours: true },
  { v: "assurance", l: "Assurance professionnelle", toujours: true },
  { v: "qualification", l: "Diplôme ou qualification", toujours: false },
  { v: "references", l: "Références vérifiables", toujours: false },
  { v: "autre", l: "Autre document", toujours: false },
];
export const libelleJustif = (v) => (TYPES_JUSTIF.find((t) => t.v === v) || { l: v }).l;
// Pieces demandees pour un metier (decision 3) : identite, osek, assurance ; + references pour un metier sensible
export function justificatifsDemandes(categorie, qualificationNecessaire = false) {
  const l = TYPES_JUSTIF.filter((t) => t.toujours).map((t) => t.v);
  if (qualificationNecessaire) l.push("qualification");
  if (categorie && categorie.sensible) l.push("references");
  return l;
}
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const ajouterJoursIso = (iso, n) => {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};
// Etat d'une piece : manquante, a controler, valide, bientot expiree (30 jours), expiree
export function etatJustif(j, aujourdhui) {
  if (!j || !j.recu) return "manquant";
  if (!j.controle) return "a_controler";
  if (j.expire && DATE_OK.test(j.expire)) {
    if (j.expire < aujourdhui) return "expire";
    if (j.expire <= ajouterJoursIso(aujourdhui, 30)) return "bientot";
  }
  return "valide";
}
export const LIBELLES_ETAT_JUSTIF = { manquant: "Manquant", a_controler: "À contrôler", valide: "Valide", bientot: "Expire bientôt", expire: "Expiré" };
// Ce qui manque pour donner (ou garder) le badge
export function manquePourBadge(dossier, categories, aujourdhui) {
  const cat = (categories || []).find((c) => c.id === dossier.categorie);
  const demandes = justificatifsDemandes(cat, dossier.qualificationNecessaire === true);
  const pieces = dossier.justificatifs || {};
  return demandes.filter((v) => !["valide", "bientot"].includes(etatJustif(pieces[v], aujourdhui))).map(libelleJustif);
}
// Le badge s'affiche seulement s'il a ete donne a la main ET que toutes les pieces demandees sont encore valides
export const badgeActif = (dossier, categories, aujourdhui) => dossier.badge === true && dossier.statut === "accepte" && manquePourBadge(dossier, categories, aujourdhui).length === 0;
// Alertes pour Rebecca : pieces expirees ou qui expirent dans 30 jours, chez les pros acceptes
export function alertesJustificatifs(dossiers, aujourdhui) {
  const sortie = [];
  for (const d of dossiers || []) {
    if (d.statut !== "accepte") continue;
    for (const [v, j] of Object.entries(d.justificatifs || {})) {
      const e = etatJustif(j, aujourdhui);
      if (e === "expire" || e === "bientot") sortie.push({ id: d.id, nom: d.nomCommercial, piece: libelleJustif(v), etat: e, expire: j.expire });
    }
  }
  return sortie.sort((a, b) => String(a.expire).localeCompare(String(b.expire)));
}

/* ---------- Dossier (prive) ---------- */
export const LANGUES = ["Français", "Hébreu", "Anglais", "Russe", "Espagnol", "Arabe", "Amharique"];
export const dossierVide = () => ({
  id: "", statut: "brouillon", actif: false, badge: false, formule: "referencement", modules: [],
  nomCommercial: "", prenom: "", nom: "", categorie: "", metier: "", description: "", prestations: "", tarifs: "",
  villes: "", zone: "", langues: ["Français"], horaires: "", telephone: "", whatsapp: "", whatsappPublic: true,
  email: "", osek: "", siteDigital: "", qualificationNecessaire: false, notePrivee: "", justificatifs: {}, journal: [],
  creeLeMs: 0, majLeMs: 0, source: "admin",
  projetDigital: "", abonnement: { mensuel: 0, debut: "", paiements: [], actif: false }, compteEmail: "", codeInvitation: "",
});
export function normaliserDossier(d) {
  const v = { ...dossierVide(), ...(d || {}) };
  const justificatifs = {};
  for (const t of TYPES_JUSTIF) {
    const j = (v.justificatifs || {})[t.v];
    if (j && typeof j === "object") justificatifs[t.v] = { recu: j.recu === true, controle: j.controle === true, expire: DATE_OK.test(j.expire || "") ? j.expire : "", note: txt(j.note, 120), photo: j.photo === true };
  }
  return {
    id: txt(v.id, 30),
    statut: STATUTS_PRO.some((s) => s.v === v.statut) ? v.statut : "brouillon",
    actif: v.actif === true,
    badge: v.badge === true,
    formule: FORMULES_PRO.some((f) => f.v === v.formule) ? v.formule : "referencement",
    modules: Array.isArray(v.modules) ? v.modules.filter((m) => typeof m === "string").slice(0, 10) : [],
    nomCommercial: txt(v.nomCommercial, 80),
    prenom: txt(v.prenom, 40),
    nom: txt(v.nom, 40),
    categorie: txt(v.categorie, 40),
    metier: txt(v.metier, 80),
    description: txt(v.description, 1200),
    prestations: txt(v.prestations, 1200),
    tarifs: txt(v.tarifs, 600),
    villes: txt(v.villes, 200),
    zone: txt(v.zone, 200),
    langues: Array.isArray(v.langues) ? v.langues.filter((l) => LANGUES.includes(l)).slice(0, 7) : [],
    horaires: txt(v.horaires, 300),
    telephone: txt(v.telephone, 20),
    whatsapp: txt(v.whatsapp, 20),
    whatsappPublic: v.whatsappPublic !== false,
    email: txt(v.email, 100),
    osek: txt(v.osek, 20),
    siteDigital: /^https:\/\/[^\s]{4,200}$/.test(String(v.siteDigital || "").trim()) ? String(v.siteDigital).trim() : "",
    qualificationNecessaire: v.qualificationNecessaire === true,
    notePrivee: txt(v.notePrivee, 1000),
    justificatifs,
    journal: Array.isArray(v.journal) ? v.journal.filter((x) => x && typeof x.texte === "string").slice(0, 60) : [],
    creeLeMs: Number(v.creeLeMs) || 0,
    majLeMs: Number(v.majLeMs) || 0,
    source: v.source === "inscription" ? "inscription" : "admin",
    projetDigital: txt(v.projetDigital, 40),
    abonnement: lireAbonnement(v.abonnement),
    compteEmail: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v.compteEmail || "").trim()) ? String(v.compteEmail).trim().toLowerCase() : "",
    codeInvitation: /^[A-Za-z0-9]{12,40}$/.test(String(v.codeInvitation || "")) ? v.codeInvitation : "",
  };
}

/* ---------- Abonnement mensuel (Vitrine, Business, Pack Pro) ----------
   Le montant est celui du devis accepte dans Projets Digital (grille validee) : Rebecca le recopie, aucun tarif n'est
   fixe ici. Les paiements de l'abonnement sont notes a part : jamais melanges avec les livraisons. */
export function lireAbonnement(a) {
  const v = a && typeof a === "object" ? a : {};
  return {
    mensuel: Math.max(0, Math.min(100000, Math.round((Number(v.mensuel) || 0) * 100) / 100)),
    debut: DATE_OK.test(v.debut || "") ? v.debut : "",
    actif: v.actif === true,
    paiements: (Array.isArray(v.paiements) ? v.paiements : [])
      .filter((p) => p && DATE_OK.test(p.date || "") && Number(p.montant) > 0)
      .slice(0, 120)
      .map((p) => ({ date: p.date, montant: Math.round(Number(p.montant) * 100) / 100, moyen: txt(p.moyen, 30), mois: /^\d{4}-\d{2}$/.test(p.mois || "") ? p.mois : p.date.slice(0, 7) })),
  };
}
const moisEntre = (debut, fin) => (Number(fin.slice(0, 4)) - Number(debut.slice(0, 4))) * 12 + Number(fin.slice(5, 7)) - Number(debut.slice(5, 7));
const moisPlus = (mois, n) => {
  const d = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
// Etat de l'abonnement a une date : mois dus (le mois de debut compte), payes, en retard, prochaine echeance
export function etatAbonnement(a, aujourdhui) {
  const ab = lireAbonnement(a);
  if (!ab.actif || !ab.debut || !(ab.mensuel > 0)) return { actif: false, dus: 0, payes: 0, retard: 0, encaisse: ab.paiements.reduce((s, p) => s + p.montant, 0), prochaine: "" };
  const dus = aujourdhui < ab.debut ? 0 : moisEntre(ab.debut.slice(0, 7), aujourdhui.slice(0, 7)) + 1;
  const encaisse = Math.round(ab.paiements.reduce((s, p) => s + p.montant, 0) * 100) / 100;
  const payes = Math.floor((encaisse + 0.001) / ab.mensuel);
  const jour = ab.debut.slice(8, 10);
  const prochaineMois = moisPlus(ab.debut.slice(0, 7), payes);
  return { actif: true, dus, payes, retard: Math.max(0, dus - payes), encaisse, prochaine: `${prochaineMois}-${jour > "28" ? "28" : jour}` };
}

/* ---------- « Deux en un » : livraisons de Rebecca Services pour un pro ----------
   Ce sont des demandes normales (grille de prix validee), rattachees au pro par Rebecca (champ proPartenaire) :
   leur argent est compte a part de l'abonnement Digital. */
export function livraisonsDuPro(demandes, proId) {
  return (demandes || []).filter((d) => d.proPartenaire === proId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
export function encaisseDe(resId, mouvements) {
  return Math.round((mouvements || []).filter((m) => m.resId === resId).reduce((s, m) => s + (m.kind === "paiement" || m.kind === "correction" ? Number(m.montant) || 0 : m.kind === "remboursement_effectue" ? -(Number(m.montant) || 0) : 0), 0) * 100) / 100;
}

/* ---------- Tableau de bord du reseau (Rebecca) ---------- */
// projets = projetsDigital [{ id, echeances }] ; recuProjet(id) = montant encaisse sur ce projet
export function tableauReseau({ dossiers = [], categories = [], demandes = [], mouvements = [], recuProjet = () => 0, stats = {}, aujourdhui, du = "", au = "9999-12-31" }) {
  const n = (s) => dossiers.filter((d) => d.statut === s).length;
  const dansPeriode = (date) => date >= du && date <= au;
  const formules = Object.fromEntries(FORMULES_PRO.map((f) => [f.v, dossiers.filter((d) => d.statut === "accepte" && d.formule === f.v).length]));
  const lignes = dossiers.map((d) => {
    const ab = etatAbonnement(d.abonnement, aujourdhui);
    const abPeriode = lireAbonnement(d.abonnement).paiements.filter((p) => dansPeriode(p.date)).reduce((s, p) => s + p.montant, 0);
    const livs = livraisonsDuPro(demandes, d.id).filter((x) => dansPeriode(x.date || ""));
    const livEncaisse = livs.reduce((s, x) => s + encaisseDe(x.id, mouvements), 0);
    const digital = d.projetDigital ? recuProjet(d.projetDigital) : 0;
    const st = stats[d.id] || {};
    return { id: d.id, nom: d.nomCommercial, statut: d.statut, formule: d.formule, abonnement: ab, abonnementPeriode: Math.round(abPeriode * 100) / 100, livraisons: livs.length, livraisonsEncaisse: Math.round(livEncaisse * 100) / 100, digital, visites: Number(st.visites) || 0, clics: Number(st.whatsapp) || 0, total: Math.round((abPeriode + livEncaisse + digital) * 100) / 100 };
  });
  const somme = (k) => Math.round(lignes.reduce((s, l) => s + (Number(l[k]) || 0), 0) * 100) / 100;
  return {
    actifs: dossiers.filter((d) => d.statut === "accepte" && d.actif).length,
    suspendus: n("suspendu"),
    enAttente: n("soumis") + n("en_examen") + n("brouillon"),
    refuses: n("refuse"),
    formules,
    abonnementsActifs: lignes.filter((l) => l.abonnement.actif).length,
    abonnementsEnRetard: lignes.filter((l) => l.abonnement.retard > 0).map((l) => ({ id: l.id, nom: l.nom, retard: l.abonnement.retard })),
    aRenouveler: alertesJustificatifs(dossiers, aujourdhui),
    revenusDigital: somme("digital"),
    revenusAbonnements: somme("abonnementPeriode"),
    revenusLivraisons: somme("livraisonsEncaisse"),
    total: somme("total"),
    lignes: lignes.sort((a, b) => b.total - a.total),
    categoriesCachees: categories.filter((c) => !c.visible).map((c) => c.nom),
  };
}
const telOk = (t) => String(t || "").replace(/\D/g, "").length >= 9;
export function erreursDossier(d) {
  const e = {};
  if (!d.nomCommercial) e.nomCommercial = "Nom commercial obligatoire.";
  if (!d.categorie) e.categorie = "Choisis le métier.";
  if (!d.villes) e.villes = "Au moins une ville.";
  if (!telOk(d.whatsapp) && !telOk(d.telephone)) e.whatsapp = "Un numéro de téléphone ou WhatsApp.";
  if (d.osek && !/^\d{6,10}$/.test(d.osek.replace(/\D/g, ""))) e.osek = "Numéro d'osek : 6 à 10 chiffres.";
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = "Adresse e-mail incorrecte.";
  return e;
}
export function lireDossiers(json) {
  let l = [];
  try {
    l = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    l = [];
  }
  return (Array.isArray(l) ? l : []).map(normaliserDossier).filter((d) => d.id).slice(0, 400);
}

/* ---------- Fiche publique : SEULEMENT les acceptes et actifs, SEULEMENT les champs publics ---------- */
export function fichePublique(dossier, categories, aujourdhui) {
  const d = normaliserDossier(dossier);
  const cat = (categories || []).find((c) => c.id === d.categorie);
  if (d.statut !== "accepte" || !d.actif || !cat || !cat.visible) return null;
  return {
    id: d.id,
    nomCommercial: d.nomCommercial,
    categorie: d.categorie,
    metier: d.metier,
    description: d.description,
    prestations: d.prestations,
    tarifs: d.tarifs || "Sur devis",
    villes: d.villes,
    zone: d.zone,
    langues: d.langues,
    horaires: d.horaires,
    whatsapp: d.whatsappPublic ? d.whatsapp || d.telephone : "",
    telephone: d.whatsappPublic ? d.telephone : "",
    formule: d.formule,
    siteDigital: formuleAvecPage(d.formule) ? d.siteDigital : "",
    verifie: badgeActif(d, categories, aujourdhui),
  };
}
export const annuairePublic = (dossiers, categories, aujourdhui) => (dossiers || []).map((d) => fichePublique(d, categories, aujourdhui)).filter(Boolean);
export function lireAnnuaire(json) {
  let l = [];
  try {
    l = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    l = [];
  }
  return Array.isArray(l) ? l.filter((f) => f && typeof f.id === "string" && f.nomCommercial).slice(0, 400) : [];
}

/* ---------- Recherche ---------- */
export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[''`-]/g, " ").replace(/\s+/g, " ").trim();
export function rechercherPros(fiches, { categorie = "", ville = "", texte = "" } = {}) {
  const v = sansAccents(ville);
  const t = sansAccents(texte);
  const liste = (fiches || []).filter((f) => {
    if (categorie && f.categorie !== categorie) return false;
    if (v && !sansAccents(`${f.villes} ${f.zone}`).includes(v) && !/toute?s? (israel|le pays)/.test(sansAccents(f.zone))) return false;
    if (t && !sansAccents(`${f.nomCommercial} ${f.metier} ${f.description} ${f.prestations}`).includes(t)) return false;
    return true;
  });
  // Les pros verifies d'abord, puis par nom
  return liste.sort((a, b) => (b.verifie === true) - (a.verifie === true) || a.nomCommercial.localeCompare(b.nomCommercial, "fr"));
}
// Villes proposees dans la recherche (celles des fiches publiees)
export function villesDesFiches(fiches) {
  const s = new Map();
  for (const f of fiches || []) for (const v of String(f.villes || "").split(/[,;/]/)) {
    const n = v.trim();
    if (n && !s.has(sansAccents(n))) s.set(sansAccents(n), n);
  }
  return [...s.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/* ---------- Contact (WhatsApp) ----------
   25 nov. 2026, 20h23 (Rebecca) : Chabbat et fetes ne bloquent que Rebecca Services ; un pro independant fait comme il
   veut. lienContactPro garde le parametre « fermeture » pour un pro qui choisirait de fermer (non utilise par defaut). */
const versInternational = (t) => String(t || "").replace(/\D/g, "").replace(/^0/, "972");
export function messageContactPro(fiche, { rdv = false } = {}) {
  return `Bonjour ${fiche.nomCommercial}, je vous contacte depuis l'annuaire Rebecca Services.${rdv ? "\nJe souhaite prendre rendez-vous pour : " : "\nMa demande : "}`;
}
export function lienContactPro(fiche, fermeture = null, options = {}) {
  if (fermeture) return { lien: "", message: `Les demandes ne sont pas envoyées pendant ${fermeture.label || "Chabbat et les fêtes"}. Revenez après la réouverture${fermeture.reprise ? ` (${fermeture.reprise.date} à ${fermeture.reprise.heure})` : ""}.` };
  const n = versInternational(fiche.whatsapp || fiche.telephone);
  if (n.length < 11) return { lien: "", message: "Ce professionnel n'a pas laissé de numéro public." };
  return { lien: `https://wa.me/${n}?text=${encodeURIComponent(messageContactPro(fiche, options))}`, message: "" };
}

/* ---------- Inscription par le pro lui-meme ---------- */
export const inscriptionVide = () => ({
  nomCommercial: "", prenom: "", nom: "", categorie: "", metier: "", description: "", prestations: "", tarifs: "",
  villes: "", zone: "", langues: ["Français"], horaires: "", telephone: "", whatsapp: "", whatsappPublic: true, email: "",
  osek: "", formule: "referencement", conditions: false, independant: false,
});
export function erreursInscription(f) {
  const e = erreursDossier(normaliserDossier(f));
  if (!f.prenom || !f.nom) e.prenom = "Prénom et nom obligatoires.";
  if (!f.description || String(f.description).trim().length < 20) e.description = "Présentez votre activité (20 caractères minimum).";
  if (!/^\d{6,10}$/.test(String(f.osek || "").replace(/\D/g, ""))) e.osek = "Numéro d'osek obligatoire (6 à 10 chiffres).";
  if (!f.independant) e.independant = "Cochez cette case pour continuer.";
  if (!f.conditions) e.conditions = "Acceptez les conditions pour continuer.";
  return e;
}
// La candidature devient un dossier « soumis » (jamais publie sans la decision de Rebecca)
export function candidatureVersDossier(f, quandMs = Date.now()) {
  const d = normaliserDossier({ ...f, id: nouvelIdPro(), statut: "soumis", actif: false, badge: false, source: "inscription", creeLeMs: quandMs, majLeMs: quandMs });
  return ajouterJournal(d, "Inscription reçue depuis le site", quandMs);
}
// Tant que les regles v37 ne sont pas publiees : le dossier part a Rebecca par WhatsApp (rien n'est perdu)
export function messageInscriptionWhatsApp(f, categories) {
  const lignes = [
    "Bonjour Rebecca, je souhaite rejoindre l'annuaire des professionnels partenaires.",
    "",
    `Nom commercial : ${f.nomCommercial}`,
    `Nom : ${f.prenom} ${f.nom}`,
    `Métier : ${nomCategorie(categories, f.categorie)}${f.metier ? " — " + f.metier : ""}`,
    `Villes : ${f.villes}${f.zone ? " · zone : " + f.zone : ""}`,
    `Langues : ${(f.langues || []).join(", ")}`,
    `Osek : ${f.osek}`,
    `Téléphone : ${f.telephone || "-"} · WhatsApp : ${f.whatsapp || "-"}${f.email ? " · " + f.email : ""}`,
    `Formule souhaitée : ${libelleFormule(f.formule)}`,
    "",
    `Présentation : ${f.description}`,
    f.prestations ? `Prestations : ${f.prestations}` : "",
    f.tarifs ? `Tarifs : ${f.tarifs}` : "",
    f.horaires ? `Horaires : ${f.horaires}` : "",
    "",
    "Je suis un professionnel indépendant et j'accepte les conditions de l'annuaire.",
    "Je vous envoie mes justificatifs (identité, osek, assurance) en photo ici.",
  ];
  return lignes.filter((l, i, t) => l !== "" || t[i - 1] !== "").join("\n");
}

export const CONDITIONS_ANNUAIRE = [
  "Je suis un professionnel indépendant : je réalise moi-même mes prestations, sous ma seule responsabilité.",
  "Rebecca Services publie ma fiche dans son annuaire ; elle ne réalise pas mes prestations et n'encaisse pas leur prix.",
  "Ma fiche n'est publiée qu'après validation par Rebecca Services, qui peut la modifier, la suspendre ou la retirer.",
  "Les informations et justificatifs que je fournis sont exacts ; je préviens si un document expire ou change.",
  "Le label « Partenaire vérifié » signifie que des documents ont été contrôlés : ce n'est pas une garantie de résultat.",
  "Aucune demande n'est transmise pendant Chabbat et les fêtes juives.",
  "Le Référencement est gratuit au lancement. Les formules Vitrine, Business et Pack Pro sont payantes, sur devis.",
];

// Une inscription recue en ligne n'est JAMAIS publiee telle quelle : nouvel identifiant, statut « soumis »,
// hors annuaire, sans badge ni justificatif coche (on ne fait pas confiance a ce qui vient du site)
export function importerCandidature(d, quandMs = Date.now()) {
  const x = normaliserDossier(d);
  return ajouterJournal({ ...x, id: nouvelIdPro(), statut: "soumis", actif: false, badge: false, justificatifs: {}, journal: [], notePrivee: "", source: "inscription", creeLeMs: x.creeLeMs || quandMs, majLeMs: quandMs }, "Inscription reçue depuis le site", quandMs);
}

// Lien de l'espace pro (#/admin?pro=CODE) et lecture du code dans l'adresse
export const lienEspacePro = (code, origine = "https://rebeccaservices.com") => `${origine}/#/admin?pro=${code}`;
export function lireAccesPro(hash) {
  const m = /[?&]pro=([A-Za-z0-9]{12,40})/.exec(hash || "");
  return m ? m[1] : "";
}
export function messageInvitationPro(d, lien) {
  return [
    `Bonjour ${d.prenom || d.nomCommercial}, c'est Rebecca de Rebecca Services.`,
    "Voici le lien de votre espace professionnel (agenda, rendez-vous, demandes de vos clientes) :",
    lien,
    `Connectez-vous avec l'adresse ${d.compteEmail} (Google ou e-mail et mot de passe), puis touchez « Lier mon espace pro ».`,
    "Astuce : sur iPhone, Partager → « Sur l'écran d'accueil » pour l'avoir comme une application.",
  ].join("\n");
}
