// DIGITAL & APPLICATIONS (17 nov. 2026) - Rebecca Services
// Tout ce qui se calcule sans Firebase : questionnaire de devis (3 ecrans), formule conseillee, devis,
// echeancier 40 / 30 / 30, garantie de 60 jours, maintenance, cahier des charges a cocher, dossier de lancement.
// Sources : questionnaire-devis-digital (5 nov.), digital-d3 (garantie, maintenance), digital-d4 (regle des devis),
// dossier Digital du 13 nov. Les prix viennent du catalogue (Reglages → Catalogue → Digital), jamais d'ici.

export const SITE = "https://rebecca-services-netanya.netlify.app";

/* ---------- Questionnaire 1 : demande de devis ---------- */

export const PAYS = [
  { v: "israel", l: "Israël" },
  { v: "france", l: "France" },
  { v: "autre", l: "Autre pays" },
];
export const AVERTISSEMENT_PAYS = "Service pas encore ouvert dans ce pays : votre demande sera étudiée.";

export const CONTACTS = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "appel", l: "Appel" },
  { v: "email", l: "E-mail" },
];

export const TYPES_PROJET = [
  "Site vitrine professionnel",
  "Site avec espace client",
  "Application web sur mesure",
  "Plateforme de réservation ou de gestion",
  "Boutique ou service avec paiement en ligne",
  "Amélioration d'un site existant",
  "Je ne sais pas encore, j'ai besoin de conseils",
];

export const DOMAINES = [
  "Beauté et bien-être",
  "Transport et livraison",
  "Commerce et boutique",
  "Services aux particuliers",
  "Services aux professionnels",
  "Association ou organisation",
  "Autre",
];

// Fonctions souhaitees. etude: true = « Fonction réalisée selon étude technique. »
export const FONCTIONS = [
  { id: "presentation", l: "Présentation de mon activité et de mes services" },
  { id: "contact", l: "Formulaire de contact ou de demande" },
  { id: "reservation", l: "Réservation et gestion des rendez-vous" },
  { id: "espaceClient", l: "Espace client personnel" },
  { id: "admin", l: "Espace d'administration" },
  { id: "commandes", l: "Gestion des commandes ou des demandes" },
  { id: "paiement", l: "Paiement en ligne", etude: true },
  { id: "emails", l: "Notifications par e-mail" },
  { id: "whatsapp", l: "Boutons et messages WhatsApp pré-remplis" },
  { id: "maps", l: "Carte et itinéraires Google Maps" },
  { id: "abonnements", l: "Gestion des abonnements", etude: true },
  { id: "promos", l: "Codes promotionnels et fidélité" },
  { id: "stats", l: "Statistiques et tableaux de bord" },
  { id: "langues", l: "Plusieurs langues" },
  { id: "autre", l: "Autre" },
];
export const MENTION_ETUDE = "Fonction réalisée selon étude technique.";

export const FORMULES = ["Essentielle", "Business", "Sur mesure"];
export const FORMULES_ENVISAGEES = [...FORMULES, "Je souhaite être conseillé(e)"];
export const MAINTENANCES = ["Sérénité", "Confort", "Premium"];
export const CHOIX_MAINTENANCE = ["Maintenance Sérénité", "Maintenance Confort", "Maintenance Premium", "Je souhaite en discuter", "Pas pour le moment"];
export const DEMARRAGES = ["Dès que possible", "Dans le mois", "Dans 2 à 3 mois", "Plus tard", "Je suis encore en réflexion"];
// Tranches a valider avec les prix definitifs (questionnaire du 5 nov.)
export const BUDGETS = ["Moins de 7 000 ₪", "7 000 à 15 000 ₪", "15 000 à 22 000 ₪", "Plus de 22 000 ₪", "Je ne sais pas encore"];

export const MAX = { nom: 100, entreprise: 120, email: 120, telephone: 30, description: 1500, precision: 200 };

// Regle validee le 5 nov. : Sur mesure si paiement, abonnements ou langues, ou 7 fonctions ou plus ;
// sinon Business si espace client, administration ou commandes ; sinon Essentielle.
export function formuleConseillee(fonctions = []) {
  const f = new Set((fonctions || []).filter((x) => FONCTIONS.some((y) => y.id === x)));
  if (!f.size) return "";
  if (f.has("paiement") || f.has("abonnements") || f.has("langues") || f.size >= 7) return "Sur mesure";
  if (f.has("espaceClient") || f.has("admin") || f.has("commandes")) return "Business";
  return "Essentielle";
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const chiffres = (t) => String(t || "").replace(/\D/g, "");
const propre = (t, n) => String(t || "").trim().slice(0, n);

// Erreurs d'un ecran du questionnaire (1, 2 ou 3) : { champ: message }
export function erreursEcran(ecran, f) {
  const e = {};
  if (ecran === 1) {
    if (propre(f.nom, MAX.nom).length < 2) e.nom = "Indiquez votre nom et prénom.";
    if (!EMAIL_OK.test(String(f.email || "").trim())) e.email = "Adresse e-mail invalide.";
    const n = chiffres(f.telephone).length;
    if (n < 9 || n > 15) e.telephone = "Numéro de téléphone invalide.";
    if (!CONTACTS.some((c) => c.v === f.contact)) e.contact = "Choisissez un moyen de contact.";
    if (!PAYS.some((p) => p.v === f.pays)) e.pays = "Choisissez un pays.";
  }
  if (ecran === 2) {
    if (!TYPES_PROJET.includes(f.typeProjet)) e.typeProjet = "Choisissez un type de projet.";
    if (!DOMAINES.includes(f.domaine)) e.domaine = "Choisissez un domaine.";
    if (f.domaine === "Autre" && propre(f.domaineAutre, MAX.precision).length < 2) e.domaineAutre = "Précisez votre domaine.";
    if (propre(f.description, MAX.description).length < 10) e.description = "Décrivez votre projet en quelques phrases.";
    if (!(f.fonctions || []).length) e.fonctions = "Cochez au moins une fonction.";
    if ((f.fonctions || []).includes("autre") && propre(f.fonctionAutre, MAX.precision).length < 2) e.fonctionAutre = "Précisez la fonction souhaitée.";
  }
  if (ecran === 3) {
    if (!DEMARRAGES.includes(f.demarrage)) e.demarrage = "Choisissez quand démarrer.";
    if (!BUDGETS.includes(f.budget)) e.budget = "Choisissez un budget.";
    if (f.consentement !== true) e.consentement = "Cette case est obligatoire.";
  }
  return e;
}

// Document projetsDigital cree par le questionnaire (sans creeLe, ajoute par Firebase)
export function construireDemandeDigital(f, uid = null) {
  const fonctions = (f.fonctions || []).filter((x) => FONCTIONS.some((y) => y.id === x)).slice(0, FONCTIONS.length);
  const d = {
    statut: "nouvelle",
    source: "site",
    nom: propre(f.nom, MAX.nom),
    entreprise: propre(f.entreprise, MAX.entreprise),
    email: propre(f.email, MAX.email),
    telephone: propre(f.telephone, MAX.telephone),
    contact: f.contact,
    pays: f.pays,
    typeProjet: f.typeProjet,
    domaine: f.domaine,
    domaineAutre: f.domaine === "Autre" ? propre(f.domaineAutre, MAX.precision) : "",
    description: propre(f.description, MAX.description),
    fonctions,
    fonctionAutre: fonctions.includes("autre") ? propre(f.fonctionAutre, MAX.precision) : "",
    formuleEnvisagee: FORMULES_ENVISAGEES.includes(f.formuleEnvisagee) ? f.formuleEnvisagee : "",
    formuleConseillee: formuleConseillee(fonctions),
    maintenanceSouhaitee: CHOIX_MAINTENANCE.includes(f.maintenance) ? f.maintenance : "",
    demarrage: f.demarrage,
    budget: f.budget,
    consentement: true,
  };
  if (uid) d.uid = uid;
  return d;
}

const libelleFonction = (id) => (FONCTIONS.find((x) => x.id === id) || {}).l || id;
const libellePays = (v) => (PAYS.find((x) => x.v === v) || {}).l || v;
const libelleContact = (v) => (CONTACTS.find((x) => x.v === v) || {}).l || v;

// Message WhatsApp pre-rempli envoye a Rebecca apres le questionnaire
export function messageDemandeDigital(d, id, site = SITE) {
  return [
    "Bonjour Rebecca, je viens d'envoyer une demande de devis Digital & Applications.",
    `Nom : ${d.nom}${d.entreprise ? ` (${d.entreprise})` : ""}`,
    `Projet : ${d.typeProjet} · ${d.domaine === "Autre" && d.domaineAutre ? d.domaineAutre : d.domaine}`,
    d.formuleConseillee ? `Formule conseillée par le site : ${d.formuleConseillee}` : "",
    `Démarrage : ${d.demarrage} · Budget : ${d.budget}`,
    id ? `Suivi : ${lienProjet(id, site)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Resume complet (e-mail de notification a Rebecca, fiche admin)
export function resumeDemandeDigital(d) {
  return [
    `Contact préféré : ${libelleContact(d.contact)} · Pays : ${libellePays(d.pays)}`,
    `E-mail : ${d.email}`,
    `Type : ${d.typeProjet}`,
    `Domaine : ${d.domaine === "Autre" && d.domaineAutre ? `Autre (${d.domaineAutre})` : d.domaine}`,
    `Fonctions : ${(d.fonctions || []).map((x) => (x === "autre" && d.fonctionAutre ? `Autre (${d.fonctionAutre})` : libelleFonction(x))).join(", ")}`,
    d.formuleEnvisagee ? `Formule envisagée : ${d.formuleEnvisagee}` : "",
    d.formuleConseillee ? `Formule conseillée : ${d.formuleConseillee}` : "",
    d.maintenanceSouhaitee ? `Maintenance : ${d.maintenanceSouhaitee}` : "",
    `Démarrage : ${d.demarrage} · Budget : ${d.budget}`,
    `Projet : ${d.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---------- Lien de suivi du client : #/projet/ID ---------- */

export const lienProjet = (id, site = SITE) => `${site}/#/projet/${encodeURIComponent(id)}`;
export function lireLienProjet(hash) {
  const m = /^#\/projet\/([A-Za-z0-9_-]{10,100})\/?$/.exec(String(hash || ""));
  return m ? m[1] : null;
}

/* ---------- Statuts du projet (feuille de route Digital, section 4) ---------- */

export const STATUTS = [
  { id: "nouvelle", l: "Demande reçue", client: "Demande reçue : je l'étudie et je vous recontacte." },
  { id: "consultation", l: "Consultation fixée", client: "Consultation gratuite fixée." },
  { id: "etude", l: "Étude en cours", client: "J'étudie votre projet." },
  { id: "devis_envoye", l: "Devis envoyé", client: "Votre devis est prêt : vous pouvez le lire et l'accepter ci-dessous." },
  { id: "devis_accepte", l: "Devis accepté", client: "Devis accepté : merci ! Le projet démarre après l'acompte de 40 %." },
  { id: "en_cours", l: "En cours de réalisation", client: "Votre projet est en cours de réalisation." },
  { id: "a_valider", l: "Version à valider", client: "Une version est prête : elle attend votre validation." },
  { id: "livre", l: "Livré", client: "Votre projet est livré." },
  { id: "garantie", l: "En garantie", client: "Votre projet est livré et sous garantie." },
  { id: "maintenance", l: "En maintenance", client: "Votre projet est suivi en maintenance." },
  { id: "refuse", l: "Refusé", client: "Ce projet n'a pas été retenu." },
  { id: "abandonne", l: "Abandonné", client: "Ce projet est arrêté." },
];
export const STATUTS_ACTIFS = STATUTS.filter((s) => !["refuse", "abandonne"].includes(s.id)).map((s) => s.id);
export const libelleStatut = (id) => (STATUTS.find((s) => s.id === id) || { l: id }).l;
export const texteStatutClient = (id) => (STATUTS.find((s) => s.id === id) || { client: "" }).client;
// Etapes affichees au client (frise)
export const ETAPES_CLIENT = ["nouvelle", "devis_envoye", "devis_accepte", "en_cours", "a_valider", "livre"];
export function etapeAtteinte(statut, etape) {
  const ordre = STATUTS.map((s) => s.id);
  const i = ordre.indexOf(statut === "consultation" || statut === "etude" ? "nouvelle" : statut === "garantie" || statut === "maintenance" ? "livre" : statut);
  return i >= 0 && ordre.indexOf(etape) <= i;
}

/* ---------- Devis ---------- */

const cents = (x) => Math.round(x * 100) / 100;
const nombre = (x) => {
  if (typeof x === "number") return Number.isFinite(x) ? x : NaN;
  const t = String(x ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// Regle D4 (repere interne, jamais montre au client) : heures x taux (200 a 250 ₪) + 20 % de marge, arrondi a 50 ₪
export const REGLE_D4 = { tauxMin: 200, tauxMax: 250, taux: 240, marge: 20 };
export function prixConseille(heures, taux = REGLE_D4.taux, margePourcent = REGLE_D4.marge) {
  const h = nombre(heures);
  const t = nombre(taux);
  if (!(h > 0) || !(t > 0)) return 0;
  return Math.ceil((h * t * (1 + (nombre(margePourcent) || 0) / 100)) / 50) * 50;
}

// Lignes du devis : [{ libelle, montant }] ; montant negatif = deduction (etude deduite...)
export function lignesPropres(lignes = []) {
  return (lignes || [])
    .map((l) => ({ libelle: propre(l && l.libelle, 120), montant: cents(nombre(l && l.montant)) }))
    .filter((l) => l.libelle && Number.isFinite(l.montant) && l.montant !== 0)
    .slice(0, 30);
}
export const totalDevis = (lignes = []) => cents(lignesPropres(lignes).reduce((s, l) => s + l.montant, 0));

// Echeancier 40 / 30 / 30 (dossier Digital) : 40 % a la commande, 30 % a la validation de la version fonctionnelle,
// 30 % avant la livraison definitive. Le dernier montant absorbe les arrondis.
export const ECHEANCES = [
  { pourcent: 40, libelle: "Acompte à la commande" },
  { pourcent: 30, libelle: "Validation de la version fonctionnelle" },
  { pourcent: 30, libelle: "Avant la livraison définitive" },
];
export function echeancier(total) {
  const t = cents(nombre(total));
  if (!(t > 0)) return [];
  const premiers = ECHEANCES.slice(0, -1).map((e) => ({ ...e, montant: Math.round((t * e.pourcent) / 100) }));
  const dernier = cents(t - premiers.reduce((s, e) => s + e.montant, 0));
  return [...premiers, { ...ECHEANCES[ECHEANCES.length - 1], montant: dernier }];
}

// Etat d'une echeance d'apres les paiements notes sur sa demande (mouvements de la collection « mouvements »)
export function etatEcheance(e, mouvements = []) {
  if (!e || !e.demandeId) return { etat: "a_demander", recu: 0, reste: cents(nombre(e && e.montant) || 0) };
  const recu = cents(
    mouvements
      .filter((m) => m.resId === e.demandeId)
      .reduce((s, m) => s + (m.kind === "paiement" || m.kind === "correction" ? nombre(m.montant) || 0 : m.kind === "remboursement_effectue" ? -(nombre(m.montant) || 0) : 0), 0)
  );
  const reste = cents(Math.max(0, (nombre(e.montant) || 0) - recu));
  return { etat: reste <= 0 ? "paye" : "demande", recu, reste };
}
export function bilanEcheances(echeances = [], mouvements = []) {
  const etats = (echeances || []).map((e) => etatEcheance(e, mouvements));
  return {
    total: cents((echeances || []).reduce((s, e) => s + (nombre(e.montant) || 0), 0)),
    recu: cents(etats.reduce((s, x) => s + x.recu, 0)),
    reste: cents(etats.reduce((s, x) => s + x.reste, 0)),
    etats,
  };
}

/* ---------- Garantie et maintenance ---------- */

export const JOURS_GARANTIE = 60;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export function ajouterJours(date, jours) {
  if (!DATE_OK.test(date || "")) return "";
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + jours, 12));
  return d.toISOString().slice(0, 10);
}
export const finGarantie = (dateLivraison) => ajouterJours(dateLivraison, JOURS_GARANTIE);
export function enGarantie(dateLivraison, aujourdhui) {
  const fin = finGarantie(dateLivraison);
  return !!fin && DATE_OK.test(aujourdhui || "") && aujourdhui >= dateLivraison && aujourdhui <= fin;
}

// Temps inclus par mois (dossier Digital, 5 nov.)
export const MINUTES_MAINTENANCE = { "Sérénité": 30, Confort: 90, Premium: 180 };
// Interventions du mois [{ date, minutes, texte }] -> temps utilise, restant et depassement (a facturer apres accord)
export function maintenanceDuMois(maintenance, mois) {
  const m = maintenance || {};
  const inclus = MINUTES_MAINTENANCE[m.niveau] || 0;
  const du = (m.interventions || []).filter((x) => String(x.date || "").slice(0, 7) === mois);
  const utilise = du.reduce((s, x) => s + Math.max(0, Math.round(nombre(x.minutes) || 0)), 0);
  return { inclus, utilise, restant: Math.max(0, inclus - utilise), depassement: Math.max(0, utilise - inclus), interventions: du };
}
export function enHeures(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/* ---------- Cahier des charges a cocher (visible par le client) ---------- */

export function cahierPropre(liste = []) {
  return (liste || [])
    .map((x) => ({ texte: propre(x && x.texte, 200), fait: !!(x && x.fait) }))
    .filter((x) => x.texte)
    .slice(0, 80);
}
export function avancement(liste = []) {
  const c = cahierPropre(liste);
  const faits = c.filter((x) => x.fait).length;
  return { faits, total: c.length, pourcent: c.length ? Math.round((faits / c.length) * 100) : 0 };
}
// Une ligne par point, depuis un texte colle (une ligne = une tache, « x » ou « ✓ » en tete = deja faite)
export function cahierDepuisTexte(texte) {
  return cahierPropre(
    String(texte || "")
      .split("\n")
      .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean)
      .map((l) => {
        const fait = /^(\[x\]|x\s|✓|✅)/i.test(l);
        return { texte: l.replace(/^(\[x\]|\[ \]|x\s|✓|✅)\s*/i, ""), fait };
      })
  );
}

/* ---------- Questionnaire 2 : dossier de lancement (rempli par le client sur son lien) ---------- */

export const DOSSIER = [
  {
    id: "entreprise",
    titre: "A. L'entreprise",
    questions: [
      { id: "nomCommercial", l: "Nom commercial, nom légal, numéro d'osek ou de société" },
      { id: "adresse", l: "Adresse, zone d'intervention, horaires d'ouverture, jours de fermeture" },
      { id: "validateur", l: "Personne qui valide le projet : nom, téléphone, e-mail, disponibilités" },
      { id: "activite", l: "Votre activité en quelques phrases, vos clients, ce qui vous distingue" },
    ],
  },
  {
    id: "identite",
    titre: "B. L'identité visuelle",
    questions: [
      { id: "logo", l: "Logo en bonne qualité (envoyé par WhatsApp ou e-mail) ou besoin d'un logo" },
      { id: "couleurs", l: "Couleurs, polices, style souhaité (élégant, simple, coloré…)" },
      { id: "references", l: "Deux ou trois sites qui vous plaisent, et ce qui vous plaît dedans" },
      { id: "aEviter", l: "Ce qu'il ne faut surtout pas faire" },
    ],
  },
  {
    id: "contenus",
    titre: "C. Les contenus",
    questions: [
      { id: "textes", l: "Textes de chaque page, ou besoin d'aide pour la rédaction" },
      { id: "services", l: "Liste des services ou produits, avec prix, durées et descriptions" },
      { id: "photos", l: "Photos (activité, réalisations, équipe) et accord des personnes photographiées" },
      { id: "langues", l: "Langues du site : français, hébreu, anglais, autre" },
      { id: "faq", l: "Questions fréquentes de vos clients et réponses" },
      { id: "reseaux", l: "Liens des réseaux sociaux et du WhatsApp" },
    ],
  },
  {
    id: "parcours",
    titre: "D. Les pages et le parcours des clients",
    questions: [
      { id: "pages", l: "Pages souhaitées (accueil, services, réalisations, contact, à propos…)" },
      { id: "etapes", l: "Ce qu'un client doit pouvoir faire, étape par étape (devis, réservation, commande, paiement, suivi)" },
      { id: "formulaires", l: "Informations à demander dans chaque formulaire" },
      { id: "messages", l: "Messages de confirmation, e-mails et messages WhatsApp à envoyer" },
    ],
  },
  {
    id: "gestion",
    titre: "E. La gestion (formules Business et Sur mesure)",
    questions: [
      { id: "utilisateurs", l: "Qui utilise l'espace administrateur, et avec quels droits" },
      { id: "aGerer", l: "Ce qu'il faut gérer : clients, réservations, commandes, tarifs, paiements, dépenses, statistiques" },
      { id: "regles", l: "Règles de votre métier : horaires, durées, délais, acompte, annulation, jours fermés" },
      { id: "reprise", l: "Données existantes à reprendre (liste de clients, catalogue, fichier Excel)" },
    ],
  },
  {
    id: "technique",
    titre: "F. Les comptes techniques (à votre nom)",
    questions: [
      { id: "domaine", l: "Nom de domaine : déjà acheté ou à acheter, et où" },
      { id: "hebergement", l: "Compte d'hébergement et de base de données à votre nom (j'y suis invitée comme administratrice)" },
      { id: "emailPro", l: "Adresse e-mail professionnelle pour les notifications" },
      { id: "externes", l: "Services externes prévus (paiement, Google Maps…) et qui en paie l'abonnement" },
    ],
  },
  {
    id: "juridique",
    titre: "G. Le juridique",
    questions: [
      { id: "conditions", l: "Vos conditions de vente et d'annulation" },
      { id: "confidentialite", l: "Politique de confidentialité : qui la rédige" },
      { id: "mentions", l: "Mentions spécifiques à votre métier (santé, transport, alcool…)" },
    ],
  },
  {
    id: "planning",
    titre: "H. Le planning",
    questions: [
      { id: "miseEnLigne", l: "Date souhaitée de mise en ligne et raison (ouverture, saison, événement)" },
      { id: "indispo", l: "Périodes où vous n'êtes pas disponible pour valider" },
      { id: "maintenanceChoisie", l: "Maintenance choisie après la garantie de 60 jours" },
    ],
  },
];
export const QUESTIONS_DOSSIER = DOSSIER.flatMap((s) => s.questions.map((q) => ({ ...q, section: s.id })));
export const MAX_REPONSE = 1000;

// Reponses propres (seulement les questions connues, 1000 caracteres chacune)
export function dossierPropre(reponses = {}) {
  const r = {};
  for (const q of QUESTIONS_DOSSIER) {
    const v = propre(reponses && reponses[q.id], MAX_REPONSE);
    if (v) r[q.id] = v;
  }
  return r;
}
// Ce qui manque encore (« à fournir »). Section E seulement pour Business et Sur mesure.
export function aFournir(reponses = {}, formule = "") {
  const r = dossierPropre(reponses);
  return QUESTIONS_DOSSIER.filter((q) => !(q.section === "gestion" && formule === "Essentielle")).filter((q) => !r[q.id]);
}

/* ---------- Paiement d'une echeance : une « demande » Digital terminee (compte dans Finances) ---------- */

export const PRIX_MAX_DEMANDE = 20000; // limite des regles Firebase pour une course ajoutee a la main
export function demandeEcheance(projet, echeance, index, date) {
  const titre = `Digital – ${projet.entreprise || projet.nom} – ${echeance.libelle} (${echeance.pourcent} %)`.slice(0, 160);
  return {
    service: "digital",
    serviceTitre: titre,
    date,
    heure: "09:00",
    nom: propre(projet.nom, 100) || "Client Digital",
    telephone: propre(projet.telephone, 30) || "000",
    moyenPaiement: "Virement",
    prixEstime: null,
    prixFinal: cents(echeance.montant),
    surDevis: false,
    details: { projetDigital: projet.id, echeance: index },
    message: `${titre}\nProjet suivi dans « Projets Digital ».`,
    statut: "terminee",
    source: "manuel",
    origine: "site",
  };
}

/* ---------- Messages au client ---------- */

const prenomDe = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const shekels = (x) => `${String(cents(x)).replace(".", ",")} ₪`;

export function messageLienSuivi(p, site = SITE) {
  return [
    `Bonjour ${prenomDe(p.nom)},`.replace(" ,", ","),
    "Voici le lien de suivi de votre projet Digital & Applications : statut, devis, paiements et cahier des charges.",
    lienProjet(p.id, site),
    "Gardez-le précieusement : il vous est personnel.",
    "À très bientôt, Rebecca",
  ].join("\n");
}

export function messageDevis(p, site = SITE) {
  const lignes = lignesPropres(p.lignesDevis);
  return [
    `Bonjour ${prenomDe(p.nom)},`.replace(" ,", ","),
    `Votre devis${p.formule ? ` (formule ${p.formule})` : ""} est prêt : ${shekels(totalDevis(lignes))}.`,
    ...lignes.map((l) => `• ${l.libelle} : ${shekels(l.montant)}`),
    "Paiement en trois fois : 40 % à la commande, 30 % à la validation de la version fonctionnelle, 30 % avant la livraison définitive.",
    `Vous pouvez le lire et l'accepter ici : ${lienProjet(p.id, site)}`,
    "Je reste disponible pour en parler. Rebecca",
  ].join("\n");
}

export function messagePaiementEcheance(p, e, lienPaiement) {
  return [
    `Bonjour ${prenomDe(p.nom)},`.replace(" ,", ","),
    `Voici le paiement « ${e.libelle} » (${e.pourcent} %) de votre projet : ${shekels(e.montant)}.`,
    lienPaiement ? `Pour payer et me prévenir : ${lienPaiement}` : "",
    `Suivi du projet : ${lienProjet(p.id)}`,
    "Merci ! Rebecca",
  ]
    .filter(Boolean)
    .join("\n");
}

export function messageConsultation(nom = "") {
  return `Bonjour Rebecca, je souhaite réserver ma consultation gratuite de 30 minutes (Digital & Applications)${nom ? `. Je suis ${nom}` : ""}. Voici mes disponibilités : `;
}

/* ---------- Fiches des formules (page client) ----------
   Contenu valide le 5 nov. (textes D1, garantie et maintenance D3). Les prix ne sont pas ici : ils viennent du catalogue. */
export const FICHES_FORMULES = {
  "Formule Essentielle": {
    delai: "Environ 6 semaines",
    pourQui: "Indépendants et petites entreprises qui veulent une présence professionnelle et recevoir des demandes.",
    inclus: [
      "Interface personnalisée aux couleurs de l'activité",
      "Présentation de l'activité et des services",
      "Formulaire de contact ou de demande",
      "Espace client simple, selon les besoins",
      "Base de données adaptée au projet",
      "Notifications simples par e-mail",
      "Mise en ligne et tests de fonctionnement",
    ],
  },
  "Formule Business": {
    delai: "6 à 10 semaines",
    pourQui: "Entreprises qui veulent gérer leur activité au quotidien dans une application.",
    inclus: [
      "Tout le contenu de la formule Essentielle",
      "Espace client avec connexion sécurisée",
      "Espace administrateur privé",
      "Gestion des clients",
      "Gestion des réservations ou des commandes",
      "Tableau de bord de gestion",
      "Gestion des tarifs et des prestations sans toucher au code",
      "Historique des opérations",
      "Notifications par e-mail et messages WhatsApp pré-remplis ; automatisations selon étude du projet",
      "Mise en ligne et tests",
    ],
  },
  "Formule Sur mesure": {
    delai: "2 à 3 mois ou plus selon la complexité",
    pourQui: "Projets avec des besoins spécifiques, plusieurs utilisateurs ou des connexions à d'autres services.",
    inclus: [
      "Architecture adaptée au fonctionnement de l'entreprise",
      "Plusieurs espaces utilisateurs, gestion avancée des accès",
      "Réservations complexes (équipe, tournées, créneaux verrouillés)",
      "Paiement en ligne, abonnements, connexion à des services et API externes, selon étude technique",
      "Automatisations avancées, statistiques et rapports personnalisés",
      "Fonctions métier spécifiques, tests approfondis et mise en ligne",
    ],
    inclusTitre: "Ce qui peut être inclus, selon l'étude",
  },
};
export const FICHES_MAINTENANCE = {
  "Sérénité": { pourQui: "Site stable qui change peu.", delai: "Réponse sous 3 jours ouvrés", temps: "30 minutes par mois", interventions: "Petites corrections" },
  Confort: { pourQui: "Activité qui met à jour son site régulièrement.", delai: "Réponse sous 48 heures ouvrées", temps: "1 h 30 par mois", interventions: "Corrections et petites modifications" },
  Premium: { pourQui: "Activité qui fait évoluer son outil chaque mois.", delai: "Réponse sous 24 heures ouvrées", temps: "3 heures par mois", interventions: "Corrections, modifications et évolutions mineures" },
};
export const CONDITIONS_COMMUNES = [
  "Application web responsive (ordinateur, tablette, iPhone), ajoutable à l'écran d'accueil du téléphone ; pas d'application à télécharger sur l'App Store.",
  "Première consultation gratuite de 30 minutes, puis devis personnalisé. Le prix affiché est un prix de départ.",
  "Paiement en trois fois : 40 % à la commande, 30 % à la validation de la version fonctionnelle, 30 % avant la livraison définitive.",
  "Garantie corrective gratuite de 60 jours après la livraison définitive.",
  "Hébergement, nom de domaine et services externes : comptes ouverts à votre nom, frais à votre charge.",
  "Maintenance facultative, distincte de la garantie ; délais hors Chabbat et fêtes, pas d'assistance 24 h/24, heures non reportées d'un mois sur l'autre.",
];

/* ---------- Devis automatique (17 nov. 2026, demande de Rebecca) ----------
   « Je ne sais pas tous les détails : ça doit se faire tout seul selon ce que le client a choisi. »
   A partir des reponses du questionnaire : la formule (conseillee, sinon envisagee), son prix de depart (catalogue),
   puis une option du catalogue pour chaque fonction demandee qui n'est PAS comprise dans la formule.
   Les heures sont deduites du total (regle D4 a l'envers : total / (taux x 1,20)). Rebecca garde la main : tout se modifie. */
export const COMPRIS = {
  Essentielle: ["presentation", "contact", "espaceClient", "emails"],
  Business: ["presentation", "contact", "espaceClient", "emails", "admin", "commandes", "reservation", "whatsapp", "stats"],
  "Sur mesure": ["presentation", "contact", "espaceClient", "emails", "admin", "commandes", "reservation", "whatsapp", "stats", "paiement", "abonnements", "maps", "promos"],
};
// Fonction demandee -> option du catalogue (nom exact dans Reglages → Catalogue → Digital → Options)
export const OPTION_DE = {
  paiement: "Paiement en ligne",
  whatsapp: "WhatsApp",
  maps: "Google Maps",
  promos: "Fidélité et codes promo",
  abonnements: "Abonnements",
  stats: "Statistiques avancées",
  langues: "Langue supplémentaire",
  admin: "Espace administrateur supplémentaire",
  commandes: "Espace administrateur supplémentaire",
  reservation: "Espace administrateur supplémentaire",
};
export const PRIX_DEPART_SUR_MESURE = 22000; // page Digital : « dès 22 000 ₪ » (catalogue : sur devis)
const BUDGET_MAX = { "Moins de 7 000 ₪": 7000, "7 000 à 15 000 ₪": 15000, "15 000 à 22 000 ₪": 22000 };

export function devisAutomatique(p = {}, catalogue = [], taux = REGLE_D4.taux) {
  const formule = formuleConseillee(p.fonctions) || (FORMULES.includes(p.formuleEnvisagee) ? p.formuleEnvisagee : "") || "Essentielle";
  const trouver = (nom) => catalogue.find((c) => c && c.activite === "digital" && c.nom === nom);
  const prixDe = (c) => (c && typeof c.prix === "number" && c.prix > 0 ? c.prix : null);
  const lignes = [];
  const notes = [];
  const base = trouver(`Formule ${formule}`);
  let prixBase = prixDe(base);
  if (prixBase === null && formule === "Sur mesure") {
    prixBase = PRIX_DEPART_SUR_MESURE;
    notes.push("Formule Sur mesure : prix de départ 22 000 ₪, à ajuster après l'étude.");
  }
  lignes.push({ libelle: `Formule ${formule}`, montant: prixBase || 0 });
  const vus = new Set();
  for (const f of p.fonctions || []) {
    if ((COMPRIS[formule] || []).includes(f)) continue;
    const nom = OPTION_DE[f];
    if (!nom || vus.has(nom)) continue;
    vus.add(nom);
    const o = trouver(nom);
    if (o && prixDe(o) !== null) lignes.push({ libelle: nom, montant: prixDe(o) });
  }
  if (p.typeProjet === "Amélioration d'un site existant") {
    const o = trouver("Refonte graphique");
    if (o && prixDe(o) !== null) lignes.push({ libelle: "Refonte graphique", montant: prixDe(o) });
  }
  if ((p.fonctions || []).includes("autre") && p.fonctionAutre) notes.push(`Fonction « ${p.fonctionAutre} » : à chiffrer toi-même (ligne libre).`);
  if (formule === "Sur mesure") notes.push("Projet Sur mesure : propose d'abord l'étude approfondie (dès 450 ₪), déduite si le client commande sous 30 jours.");
  const total = totalDevis(lignes);
  const heures = total > 0 ? Math.round(total / (taux * (1 + REGLE_D4.marge / 100))) : 0;
  const max = BUDGET_MAX[p.budget];
  if (max && total > max) notes.push(`Attention : le budget du client (${p.budget}) est en dessous de ce devis (${String(total).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₪). À en parler à la consultation.`);
  if (p.formuleEnvisagee && FORMULES.includes(p.formuleEnvisagee) && p.formuleEnvisagee !== formule) notes.push(`Le client pensait à la formule ${p.formuleEnvisagee} ; ses fonctions demandent la formule ${formule}.`);
  return { formule, lignes: lignesPropres(lignes), total, heures, notes };
}
