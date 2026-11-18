// COURSIERS PARTENAIRES - Rebecca Services (validé par Rebecca le 18 nov. 2026)
// Règles :
//  - un coursier partenaire ne fait QUE des livraisons et des courses (jamais transport de personnes,
//    jamais Beauté, Epoxy, Digital, ni les finances de Rebecca) ;
//  - commission 15 % (minimum 3 ₪) sur toutes ses courses, espèces comprises ;
//    8 % (minimum 2 ₪) quand c'est lui qui a apporté le commerçant et que Rebecca l'a validé ;
//  - la commission est FIGÉE au moment de l'attribution (jamais rétroactive) ;
//  - pourboires : 100 % pour le coursier ;
//  - paiements Revolut / Bit / PayPal / carte : encaissés par Rebecca, reversés en fin de mois ;
//  - espèces : gardées par le coursier, leur commission est déduite de son compte ;
//  - fin du mois : solde positif -> Rebecca reverse ; solde négatif -> le coursier paie Rebecca ;
//  - dette au-delà du plafond (150 ₪ par défaut) : plus de nouvelles courses ;
//  - photo de preuve de livraison obligatoire pour terminer une course ;
//  - aucune retenue automatique en cas de litige (Rebecca décide au cas par cas).

export const SERVICES_PARTENAIRE = ["livraison", "courses"];

export const COMMISSION_DEFAUT = {
  normale: { taux: 15, minimum: 3 },
  commercant: { taux: 8, minimum: 2 },
  plafondDette: 150,
};

export const MOYENS = [
  { id: "especes", label: "Espèces", parRebecca: false },
  { id: "bit", label: "Bit", parRebecca: true },
  { id: "revolut", label: "Revolut", parRebecca: true },
  { id: "paypal", label: "PayPal", parRebecca: true },
  { id: "carte", label: "Carte", parRebecca: true },
];
const MOYENS_OK = MOYENS.map((m) => m.id);
export const encaisseParRebecca = (moyen) => !!(MOYENS.find((m) => m.id === moyen) || {}).parRebecca;

const nombre = (v) => {
  if (v == null || String(v).trim() === "") return NaN;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
export const arrondi = (n) => Math.round(n * 100) / 100;

/* ---------- Réglages de commission (modifiables par Rebecca) ---------- */
export function reglagesCommission(r = {}) {
  const lire = (x, def, min, max) => {
    const n = nombre(x);
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  const d = COMMISSION_DEFAUT;
  return {
    normale: { taux: lire(r.normale && r.normale.taux, d.normale.taux, 0, 50), minimum: lire(r.normale && r.normale.minimum, d.normale.minimum, 0, 100) },
    commercant: { taux: lire(r.commercant && r.commercant.taux, d.commercant.taux, 0, 50), minimum: lire(r.commercant && r.commercant.minimum, d.commercant.minimum, 0, 100) },
    plafondDette: lire(r.plafondDette, d.plafondDette, 0, 5000),
  };
}

/* ---------- Commission d'une course ---------- */
// prix = prix de la course (hors pourboire, hors montant des achats remboursés)
export function commissionCourse(prix, { commercantValide = false, reglages } = {}) {
  const r = reglagesCommission(reglages);
  const regle = commercantValide ? r.commercant : r.normale;
  const p = nombre(prix);
  if (!Number.isFinite(p) || p <= 0) return { taux: regle.taux, minimum: regle.minimum, montant: 0, type: commercantValide ? "commercant" : "normale" };
  const montant = Math.min(p, Math.max(regle.minimum, arrondi((p * regle.taux) / 100)));
  return { taux: regle.taux, minimum: regle.minimum, montant: arrondi(montant), type: commercantValide ? "commercant" : "normale" };
}

// À enregistrer sur la mission au moment où le coursier l'accepte : elle ne bougera plus ensuite
export function figerCommission(mission = {}, reglages) {
  const c = commissionCourse(mission.prix, { commercantValide: !!mission.commercantValide, reglages });
  return { ...c, figeeLe: new Date().toISOString() };
}

/* ---------- Une course terminée vue par le compte coursier ---------- */
// course : { prix, pourboire, moyen, commission: {montant}, date: "AAAA-MM-JJ", statut }
export function ligneCourse(c = {}) {
  const prix = Math.max(0, nombre(c.prix) || 0);
  const pourboire = Math.max(0, nombre(c.pourboire) || 0);
  const commission = c.commission && Number.isFinite(nombre(c.commission.montant)) ? nombre(c.commission.montant) : commissionCourse(prix).montant;
  const parRebecca = encaisseParRebecca(c.moyen);
  return {
    prix,
    pourboire,
    commission: arrondi(commission),
    parRebecca,
    // ce que Rebecca doit au coursier pour cette course (avant commission)
    aReverser: parRebecca ? arrondi(prix + pourboire) : 0,
    // ce que le coursier a gardé en main
    gardeEnMain: parRebecca ? 0 : arrondi(prix + pourboire),
  };
}

const estTerminee = (c) => c && c.statut === "terminee";
const dansPeriode = (date, debut, fin) => typeof date === "string" && date.slice(0, 10) >= debut && date.slice(0, 10) <= fin;

/* ---------- Compte du coursier sur une période ---------- */
// reglements : versements déjà faits { date, sens: "vers_coursier" | "vers_rebecca", montant }
export function compteCoursier({ courses = [], reglements = [], debut, fin }) {
  const liste = courses.filter((c) => estTerminee(c) && dansPeriode(c.date, debut, fin)).map((c) => ({ id: c.id, date: c.date, moyen: c.moyen, ...ligneCourse(c) }));
  const somme = (k) => arrondi(liste.reduce((s, l) => s + l[k], 0));
  const regles = reglements.filter((r) => dansPeriode(r.date, debut, fin));
  const versesAuCoursier = arrondi(regles.filter((r) => r.sens === "vers_coursier").reduce((s, r) => s + (nombre(r.montant) || 0), 0));
  const payesParCoursier = arrondi(regles.filter((r) => r.sens === "vers_rebecca").reduce((s, r) => s + (nombre(r.montant) || 0), 0));
  const aReverser = somme("aReverser");
  const commissions = somme("commission");
  const solde = arrondi(aReverser - commissions - versesAuCoursier + payesParCoursier);
  return {
    nombre: liste.length,
    chiffre: somme("prix"),
    pourboires: somme("pourboire"),
    encaisseParRebecca: aReverser,
    gardeEnMain: somme("gardeEnMain"),
    commissions,
    versesAuCoursier,
    payesParCoursier,
    solde, // > 0 : Rebecca doit au coursier ; < 0 : le coursier doit à Rebecca
    gainNet: arrondi(somme("prix") + somme("pourboire") - commissions),
    lignes: liste,
  };
}

/* ---------- Périodes ---------- */
const jour = (d) => d.toISOString().slice(0, 10);
export function bornesMois(aaaaMm) {
  const [a, m] = aaaaMm.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m, 0));
  return { debut: `${aaaaMm}-01`, fin: jour(fin) };
}
// Semaine israélienne : du dimanche au samedi
export function bornesSemaine(dateIso) {
  const d = new Date(dateIso.slice(0, 10) + "T12:00:00Z");
  const debut = new Date(d);
  debut.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const fin = new Date(debut);
  fin.setUTCDate(debut.getUTCDate() + 6);
  return { debut: jour(debut), fin: jour(fin) };
}

/* ---------- Bilan de fin de mois et blocage ---------- */
// Le solde à prendre en compte est le solde cumulé (tout ce qui n'a pas encore été réglé)
export function bilanFinDeMois(compte) {
  const s = arrondi(compte.solde);
  if (s > 0) return { sens: "vers_coursier", montant: s, texte: `Rebecca te reverse ${s} ₪.` };
  if (s < 0) return { sens: "vers_rebecca", montant: -s, texte: `Tu dois ${-s} ₪ à Rebecca Services (commissions sur tes courses payées en espèces).` };
  return { sens: "aucun", montant: 0, texte: "Rien à régler ce mois-ci." };
}

export function estBloque(soldeCumule, reglages) {
  const r = reglagesCommission(reglages);
  return arrondi(soldeCumule) < -r.plafondDette;
}

export function messageReleve({ nom = "", periode = "", compte }) {
  const b = bilanFinDeMois(compte);
  return [
    `Bonjour ${nom}, voici ton relevé Rebecca Services ${periode} :`,
    `• Courses : ${compte.nombre} (${compte.chiffre} ₪)`,
    `• Pourboires : ${compte.pourboires} ₪ (100 % pour toi)`,
    `• Encaissé par Rebecca (Bit, Revolut, PayPal, carte) : ${compte.encaisseParRebecca} ₪`,
    `• Gardé en espèces : ${compte.gardeEnMain} ₪`,
    `• Commissions : ${compte.commissions} ₪`,
    b.texte,
    "Merci pour ton travail !",
  ].join("\n");
}

/* ---------- Candidature et validation ---------- */
export const VEHICULES = [
  { id: "voiture", label: "Voiture" },
  { id: "scooter", label: "Scooter / moto" },
  { id: "velo", label: "Vélo électrique" },
];

// Pas de top-case pour la voiture (cahier ChatGPT validé)
export function documentsRequis(vehicule) {
  const base = [
    { id: "identite", label: "Teoudat zehout (pièce d'identité)" },
    { id: "osek", label: "Attestation osek (patour ou mourché)" },
  ];
  if (vehicule === "voiture") return [...base, { id: "permis", label: "Permis de conduire" }, { id: "rishayon", label: "Carte grise (rishayon rekhev)" }, { id: "assurance", label: "Assurance du véhicule" }];
  if (vehicule === "scooter") return [...base, { id: "permis", label: "Permis moto / scooter" }, { id: "rishayon", label: "Carte grise (rishayon rekhev)" }, { id: "assurance", label: "Assurance du véhicule" }, { id: "topcase", label: "Photo du top-case" }];
  if (vehicule === "velo") return [...base, { id: "photoVelo", label: "Photo du vélo électrique" }];
  return base;
}

export const STATUTS_CANDIDATURE = {
  brouillon: { label: "Brouillon", suivants: ["soumis"] },
  soumis: { label: "Envoyée", suivants: ["en_verification", "refuse"] },
  en_verification: { label: "En vérification", suivants: ["complement_demande", "approuve", "refuse"] },
  complement_demande: { label: "Complément demandé", suivants: ["soumis", "refuse"] },
  approuve: { label: "Approuvé", suivants: ["suspendu"] },
  refuse: { label: "Refusé", suivants: [] },
  suspendu: { label: "Suspendu", suivants: ["approuve", "refuse"] },
};
export const peutPasser = (de, vers) => !!(STATUTS_CANDIDATURE[de] && STATUTS_CANDIDATURE[de].suivants.includes(vers));

// Décision datée de Rebecca, ajoutée à l'historique de la candidature
export function decision(candidature, vers, motif = "") {
  const de = candidature.statut || "brouillon";
  if (!peutPasser(de, vers)) return { erreur: `Impossible de passer de « ${(STATUTS_CANDIDATURE[de] || {}).label || de} » à « ${(STATUTS_CANDIDATURE[vers] || {}).label || vers} ».` };
  if ((vers === "complement_demande" || vers === "refuse" || vers === "suspendu") && String(motif).trim().length < 3) return { erreur: "Indique le motif (il sera visible par le coursier)." };
  const ligne = { de, vers, motif: String(motif).trim().slice(0, 300), le: new Date().toISOString() };
  return { erreur: "", statut: vers, historique: [...(candidature.historique || []), ligne] };
}

const TEL = /^0\d{8,9}$/;
export function erreursCandidature(c = {}) {
  const e = {};
  if (String(c.nom || "").trim().length < 2) e.nom = "Indique ton nom complet.";
  if (!TEL.test(String(c.telephone || "").replace(/[\s.-]/g, ""))) e.telephone = "Numéro israélien (ex. 054 123 4567).";
  if (!["patour", "mourche"].includes(c.osek)) e.osek = "Choisis ton type d'osek.";
  if (!VEHICULES.some((v) => v.id === c.vehicule)) e.vehicule = "Choisis ton véhicule.";
  if (!String(c.paiement || "").trim()) e.paiement = "Indique où te verser l'argent (Bit, PayBox ou compte bancaire).";
  const docs = c.documents || {};
  const manquants = documentsRequis(c.vehicule).filter((d) => !docs[d.id]);
  if (c.vehicule && manquants.length) e.documents = "Il manque : " + manquants.map((d) => d.label).join(", ") + ".";
  if (c.engagement !== true) e.engagement = "Tu dois accepter le règlement des coursiers.";
  return e;
}

/* ---------- Missions ---------- */
// Une mission n'est proposée qu'aux coursiers approuvés, non bloqués, et seulement pour livraison / courses
export function peutRecevoir({ fiche, mission, soldeCumule = 0, reglages }) {
  if (!fiche || fiche.statut !== "approuve") return { ok: false, raison: "Compte pas encore approuvé." };
  if (!SERVICES_PARTENAIRE.includes(mission && mission.service)) return { ok: false, raison: "Les coursiers partenaires font seulement les livraisons et les courses." };
  if (estBloque(soldeCumule, reglages)) return { ok: false, raison: "Règle d'abord ce que tu dois à Rebecca Services pour recevoir de nouvelles courses." };
  if (fiche.disponible !== true) return { ok: false, raison: "Tu es indisponible." };
  return { ok: true, raison: "" };
}

// Le premier qui accepte prend la course (vérifié dans une transaction Firestore)
export function accepter(mission, uid, reglages) {
  if (!mission || mission.statut !== "proposee") return { erreur: "Cette course a déjà été prise." };
  if (!(mission.proposeeA || []).includes(uid)) return { erreur: "Cette course ne t'a pas été proposée." };
  return { erreur: "", maj: { statut: "acceptee", coursier: uid, commission: figerCommission(mission, reglages), accepteeLe: new Date().toISOString() } };
}

// Photo de preuve obligatoire (image base64 < 750 Ko, faute de Firebase Storage)
export function terminer(mission, { photo, pourboire = 0, moyen } = {}) {
  if (!mission || mission.statut !== "acceptee") return { erreur: "Course non acceptée." };
  if (typeof photo !== "string" || !photo.startsWith("data:image/")) return { erreur: "Ajoute la photo de preuve de livraison." };
  if (photo.length > 750000) return { erreur: "Photo trop lourde, reprends-la." };
  if (!MOYENS_OK.includes(moyen)) return { erreur: "Indique comment le client a payé." };
  const p = nombre(pourboire);
  if (!Number.isFinite(p) || p < 0 || p > 1000) return { erreur: "Pourboire invalide." };
  return { erreur: "", maj: { statut: "terminee", photoPreuve: photo, pourboire: arrondi(p), moyen, termineeLe: new Date().toISOString() } };
}

/* ---------- Tableau de bord d'un coursier (18 nov. 2026, 12h27) ----------
   Le même tableau pour le coursier et pour Rebecca (qui clique sur un coursier) :
   chaque course avec son prix, son moyen de paiement, sa part et celle de Rebecca ;
   ce qu'il a déjà en main (espèces), ce que Rebecca a encaissé pour lui, ce qui reste à lui payer. */
export function tableauCoursier({ courses = [], reglements = [], debut, fin }) {
  const c = compteCoursier({ courses, reglements, debut, fin });
  const lignes = c.lignes
    .map((l) => ({
      ...l,
      total: arrondi(l.prix + l.pourboire),
      partCoursier: arrondi(l.prix + l.pourboire - l.commission),
      partRebecca: l.commission,
      argent: l.parRebecca ? "Encaissé par Rebecca" : "Gardé en espèces",
      moyenLabel: (MOYENS.find((m) => m.id === l.moyen) || { label: "Non précisé" }).label,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const parMoyen = MOYENS.map((m) => {
    const ls = lignes.filter((l) => l.moyen === m.id);
    return { id: m.id, label: m.label, nombre: ls.length, montant: arrondi(ls.reduce((s, l) => s + l.total, 0)) };
  }).filter((m) => m.nombre > 0);
  const totalBrut = arrondi(c.chiffre + c.pourboires);
  const pct = (x) => (totalBrut > 0 ? Math.round((x / totalBrut) * 1000) / 10 : 0);
  const partCoursier = arrondi(totalBrut - c.commissions);
  return {
    ...c,
    lignes,
    parMoyen,
    totalBrut,
    partCoursier,
    partRebecca: c.commissions,
    pctCoursier: pct(partCoursier),
    pctRebecca: pct(c.commissions),
    // reste à payer : > 0 Rebecca doit au coursier, < 0 le coursier doit à Rebecca
    resteAPayer: c.solde,
    bilan: bilanFinDeMois(c),
  };
}
