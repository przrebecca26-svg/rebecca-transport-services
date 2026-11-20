// ASSISTANCE CLIENTS - étape 1, sans IA (19 nov. 2026, textes validés avec ChatGPT) - règles pures
// Le client choisit un sujet, voit une réponse automatique avec SES vraies informations (jamais inventées),
// puis peut « Parler directement à Rebecca » : une conversation arrive dans l'onglet Assistance de l'admin.
// L'assistance parle au nom de Rebecca Services, jamais au nom de la personne qui fait la prestation.
import { TARIFS } from "./config.js";
import { periodesFermees, utcVersLocal, localVersUtc } from "./calendrier.js";

export const NON_DISPO = "Information non disponible pour le moment";
export const URGENCES_VITALES = "En cas d'accident, de danger immédiat ou d'enfant introuvable, appelez tout de suite les secours : police 100, Magen David Adom 101, pompiers 102. Cette messagerie n'est pas un service d'urgence.";

export const CATEGORIES = [
  { id: "trajets", titre: "Mes trajets et livraisons", icone: "🚗" },
  { id: "reservations", titre: "Réservations et tarifs", icone: "📅" },
  { id: "specialises", titre: "Services spécialisés", icone: "✨" },
  { id: "compte", titre: "Mon compte et assistance", icone: "👤" },
];

// donnees : quelles informations du client afficher (reservation = choisir une de ses demandes)
// toujours : la demande part toujours chez Rebecca (le formulaire s'ouvre tout de suite)
// vitale : afficher la consigne des secours
export const SUJETS = [
  { id: "suivi", cat: "trajets", question: "Où en est mon chauffeur ou ma livraison ?", reponse: "Voici les dernières informations concernant votre prestation. Vous pouvez consulter le suivi de votre trajet lorsqu'il est disponible.", donnees: "suivi", vitale: true },
  { id: "livraison", cat: "trajets", question: "Où est ma commande ? Je ne l'ai pas reçue.", reponse: "Vérifions ensemble votre livraison. Si la commande est indiquée comme livrée mais que vous ne l'avez pas reçue, vous pouvez signaler le problème directement à Rebecca. Pour une commande de restaurant : le restaurant s'occupe de la préparation, Rebecca Services du transport ; nous vous aidons dans les deux cas.", donnees: "suivi" },
  { id: "modifier", cat: "trajets", question: "Je souhaite modifier ou annuler ma réservation.", reponse: "Toute demande de modification ou d'annulation est vérifiée selon les conditions applicables. Votre réservation reste inchangée tant qu'une confirmation ne vous a pas été envoyée.", donnees: "reservation" },
  { id: "objet", cat: "trajets", question: "J'ai oublié un objet dans un véhicule.", reponse: "Nous allons vous aider à retrouver votre objet. Indiquez l'objet concerné, la date de votre trajet et, si possible, l'endroit où il aurait été oublié. Votre signalement sera transmis pour vérification : nous ne pouvons pas confirmer sa présence avant le contrôle du véhicule.", donnees: "reservation", toujours: true },
  { id: "prix", cat: "reservations", question: "Je souhaite comprendre un prix ou un devis.", reponse: "Le prix affiché lors de la demande est une estimation ; le prix est confirmé par Rebecca Services. Selon le trajet, des suppléments peuvent s'appliquer (nuit, urgence, attente au-delà de 10 minutes, arrêts supplémentaires, péages, stationnement) : ils vous sont toujours annoncés avant. Aucun supplément surprise.", donnees: "prix" },
  { id: "paiement", cat: "reservations", question: "Je souhaite vérifier mon paiement ou le montant restant.", reponse: "Moyens de paiement acceptés : espèces, carte bancaire, Revolut, Bit, PayPal et carte cadeau. Un paiement est pris en compte une fois vérifié par Rebecca Services. Pour un double paiement, une erreur ou un remboursement, écrivez directement à Rebecca.", donnees: "prix" },
  { id: "reserver", cat: "reservations", question: "Comment réserver une prestation ?", reponse: "Choisissez le service souhaité pour accéder au formulaire de réservation. Les disponibilités et les conditions vous sont présentées avant la validation. Une demande envoyée n'est pas encore une réservation confirmée : Rebecca Services vous répond.", liens: true },
  { id: "zones", cat: "reservations", question: "Dans quelles villes intervenez-vous ?", reponse: "Rebecca Services est basé à Netanya et propose des prestations dans tout Israël, selon le service demandé et les disponibilités. Indiquez votre lieu de départ et votre destination dans le formulaire pour obtenir une estimation." },
  { id: "horaires", cat: "reservations", question: "Quels sont vos horaires et jours de disponibilité ?", reponse: "Les disponibilités varient selon les prestations et le planning. Rebecca Services ne propose aucune prestation pendant Chabbat et les fêtes juives. Les créneaux possibles s'affichent dans le calendrier de chaque formulaire.", donnees: "fermetures" },
  { id: "ramassage", cat: "specialises", question: "Je souhaite signaler une absence ou modifier un ramassage.", reponse: "Indiquez votre demande (absence, changement d'horaire ou de lieu, personne qui récupère l'enfant). Elle devra être confirmée avant toute modification du planning. Une absence signalée n'annule pas votre abonnement.", toujours: true, vitale: true },
  { id: "restaurant", cat: "specialises", question: "J'ai une question sur mes livraisons ou mon compte restaurant.", reponse: "Bienvenue dans l'assistance partenaires. Dans votre espace restaurant, vous voyez vos demandes de livraison, leur statut et votre relevé de la semaine. Une demande n'est confirmée qu'une fois acceptée ; sans réponse en 5 minutes, elle est refusée automatiquement : vous pouvez la renvoyer ou organiser une autre solution. Prix : ceux de votre contrat (« 💰 Mes tarifs » dans votre espace : jusqu'à 3 km, 3 à 6, 6 à 9 et 9 à 12 km ; au-delà de 12 km sur devis) ; sacs ordinaires gratuits, +5 ₪ par article très lourd, jamais de pourcentage sur vos commandes. Formule B : les livraisons du créneau comptent dans le minimum, seule la différence est facturée, jamais les deux. Relevé arrêté le samedi soir, payé le dimanche (Bit, Revolut, espèces ou virement) ; une ligne qui vous semble fausse : écrivez à Rebecca avant de payer.", partenaire: true },
  { id: "beaute", cat: "specialises", question: "J'ai une question sur mon rendez-vous beauté.", reponse: "Retrouvez les informations de votre rendez-vous ci-dessous. Pour un changement, une question particulière ou une réaction inhabituelle après un soin, écrivez directement à Rebecca. Aucun diagnostic médical ni garantie de résultat ne peut être donné par message.", donnees: "reservation" },
  { id: "epoxy", cat: "specialises", question: "Où en est ma commande Epoxy ?", reponse: "Les délais indiqués correspondent aux informations actuellement confirmées. Pour une personnalisation, une modification, un produit abîmé ou une commande non reçue, écrivez directement à Rebecca." },
  { id: "digital", cat: "specialises", question: "Je souhaite suivre mon projet ou mon devis Digital.", reponse: "Votre projet Digital a son propre lien de suivi (envoyé avec votre devis) : étapes, devis et paiements. Pour un nouveau besoin, un changement ou un incident technique, écrivez directement à Rebecca." },
  { id: "compte", cat: "compte", question: "J'ai un problème avec mon compte ou mes notifications.", reponse: "Vérifiez d'abord votre connexion (onglet « Mon compte ») et que votre adresse e-mail est confirmée. Si le problème continue, décrivez-le à Rebecca. Ne communiquez jamais votre mot de passe ni un code de connexion par message." },
  { id: "reclamation", cat: "compte", question: "Je souhaite signaler un problème ou faire une réclamation.", reponse: "Nous sommes désolés que votre expérience n'ait pas répondu à vos attentes. Décrivez le problème rencontré et la prestation concernée : votre demande est transmise directement à Rebecca pour examen.", donnees: "reservation", toujours: true, vitale: true },
  { id: "autre", cat: "compte", question: "J'ai une autre question.", reponse: "Expliquez votre demande en quelques mots : elle est transmise directement à Rebecca.", toujours: true },
];
export const sujetDe = (id) => SUJETS.find((s) => s.id === id) || null;
export const sujetsDe = (cat, partenaire = false) => SUJETS.filter((s) => s.cat === cat && (!s.partenaire || partenaire));

// Mots qui rendent un objet oublié urgent
const OBJET_URGENT = /cl[ée]s?|clef|passeport|papiers?|document|t[ée]l[ée]phone|portable|m[ée]dicament|portefeuille|carte/i;

// Urgence d'une conversation : « haute » ou « normale » (jamais haute pendant une fermeture)
export function urgenceDe(sujet, { message = "", demande = null, urgentCoche = false, maintenantMs = Date.now(), ferme = false } = {}) {
  if (ferme) return "normale";
  if (urgentCoche) return "haute";
  const dansHeure = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande.date || "") && /^\d{2}:\d{2}$/.test(demande.heure || "")
    ? Math.abs(localVersUtc(demande.date, demande.heure) - maintenantMs) <= 60 * 60000
    : false;
  const aujourdhui = utcVersLocal(maintenantMs).date;
  switch (sujet) {
    case "suivi":
    case "livraison":
    case "modifier":
      return dansHeure ? "haute" : "normale";
    case "objet":
      return OBJET_URGENT.test(message) ? "haute" : "normale";
    case "ramassage":
      return /aujourd.?hui|ce matin|ce soir|maintenant/i.test(message) || (demande && demande.date === aujourdhui) ? "haute" : "normale";
    case "reclamation":
      return /accident|danger|s[ée]curit[ée]|enfant|bless/i.test(message) ? "haute" : "normale";
    default:
      return "normale";
  }
}

/* ---------- Fermetures (Chabbat, fêtes, fermetures exceptionnelles) : le même calendrier que les réservations ---------- */
export function fermetureEnCours(maintenantMs = Date.now(), t = TARIFS) {
  const jour = utcVersLocal(maintenantMs).date;
  const p = periodesFermees(jour, 2, t).find((x) => (x.type === "chabbat_fete" || (x.type === "exceptionnelle" && !x.seulementRebecca)) && x.debutUtc <= maintenantMs && x.finUtc > maintenantMs);
  return p ? { label: p.label, finUtc: p.finUtc, reprise: utcVersLocal(p.finUtc) } : null;
}
export const MESSAGES_FERMETURE = {
  general: "Rebecca Services est actuellement fermé pour Chabbat ou une fête juive. Votre message a bien été enregistré. Il sera examiné après la réouverture du service. Merci de votre compréhension.",
  transmis: "Votre demande a bien été transmise à Rebecca. Notre service est actuellement fermé : Rebecca pourra prendre connaissance de votre message après la réouverture. Aucune réponse immédiate ne peut être garantie.",
  reouverture: "Notre service est de nouveau ouvert. Votre demande est toujours enregistrée et en attente de traitement. Merci de votre patience.",
};

/* ---------- Conversation ---------- */
export const STATUTS_ASSISTANCE = [
  { v: "nouvelle", l: "Nouvelle" },
  { v: "en_cours", l: "En cours" },
  { v: "attente", l: "En attente du client" },
  { v: "resolue", l: "Résolue" },
];
export const libelleStatut = (v) => (STATUTS_ASSISTANCE.find((x) => x.v === v) || { l: v }).l;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);

export const formulaireAssistance = (profil) => ({
  nom: profil ? txt(`${profil.prenom || ""} ${profil.nom || ""}`, 80) : "",
  telephone: profil ? txt(profil.telephone, 20) : "",
  email: profil ? txt(profil.email, 120) : "",
  message: "",
  demandeId: "",
  urgent: false,
});
export function erreursAssistance(f) {
  const e = [];
  if (txt(f.nom, 80).length < 2) e.push("Indiquez votre nom.");
  if (String(f.telephone || "").replace(/\D/g, "").length < 9) e.push("Indiquez un numéro de téléphone valide.");
  if (f.email && !EMAIL_OK.test(String(f.email).trim())) e.push("L'adresse e-mail n'est pas valide (ou laissez-la vide).");
  if (txt(f.message, 2000).length < 3) e.push("Écrivez votre message.");
  return e;
}
// Document assistance/{id} (règles v31) : uniquement ces champs
export function conversationPropre(sujet, f, { uid = "", source = "site", urgence = "normale", ferme = false, resume = "" } = {}) {
  const s = sujetDe(sujet);
  const c = {
    sujet: s ? s.id : "autre",
    titre: s ? s.question : "Autre question",
    urgence: urgence === "haute" ? "haute" : "normale",
    nom: txt(f.nom, 80),
    telephone: txt(f.telephone, 20),
    email: txt(f.email, 120).toLowerCase(),
    resume: txt(resume, 600),
    demandeId: /^[A-Za-z0-9]{6,40}$/.test(f.demandeId || "") ? f.demandeId : "",
    source: ["site", "resto", "suivi"].includes(source) ? source : "site",
    statut: "nouvelle",
    ferme: !!ferme,
    dernierDe: "client",
    aLire: true,
  };
  if (uid) c.uid = uid;
  return c;
}
export const messagePropre = (de, texte) => ({ de: de === "rebecca" ? "rebecca" : "client", texte: txt(texte, 2000) });

// Message à afficher au client selon la fermeture (à la création ou maintenant)
export function bandeauFermeture(conv, messages, ferme) {
  if (!conv) return "";
  const rebeccaARepondu = (messages || []).some((m) => m.de === "rebecca");
  if (ferme) return MESSAGES_FERMETURE.general;
  if (conv.ferme && !rebeccaARepondu && conv.statut === "nouvelle") return MESSAGES_FERMETURE.reouverture;
  return "";
}

// Lien : #/assistance, #/assistance/resto/CLE (espace restaurant), #/assistance/ID (une conversation)
export function lireLienAssistance(hash) {
  const h = String(hash || "");
  if (h === "#/assistance") return { vue: "accueil" };
  let m = /^#\/assistance\/resto\/([A-Za-z0-9]{20,40})$/.exec(h);
  if (m) return { vue: "accueil", resto: m[1] };
  m = /^#\/assistance\/([A-Za-z0-9]{15,40})$/.exec(h);
  if (m) return { vue: "conversation", id: m[1] };
  return null;
}
export const lienConversation = (id, site = "https://rebeccaservices.com") => `${site}/#/assistance/${id}`;

// Les conversations de ce téléphone (gardées en local, pour les retrouver)
export const CLE_LOCALE = "rs-assistance";
export function ajouterConversationLocale(liste, id, titre) {
  const l = Array.isArray(liste) ? liste.filter((x) => x && x.id !== id) : [];
  return [{ id, titre: txt(titre, 80), le: new Date().toISOString().slice(0, 10) }, ...l].slice(0, 20);
}

// Notification pour Rebecca (fonction Netlify assistance)
export function messageNotifAssistance(c) {
  const urgent = c.urgence === "haute";
  return {
    titre: `${urgent ? "🔴 URGENT · " : "💬 "}Assistance : ${txt(c.nom, 40)}`,
    corps: txt(`${c.titre || ""}${c.resume ? " · " + c.resume : ""}`, 180),
    tag: `assistance-${c.id || ""}`,
    lien: "/admin#/admin?onglet=assistance",
  };
}

// E-mail envoyé au client quand Rebecca répond
export const emailReponse = (c, texte, lien) => [
  `Bonjour ${c.nom},`,
  "",
  "Vous avez une réponse de Rebecca Services à votre demande d'assistance :",
  `« ${c.titre} »`,
  "",
  texte,
  "",
  `Pour lire la conversation et répondre : ${lien}`,
  "",
  "Rebecca Services · rebeccaservices.com",
].join("\n");

// Pastille du menu de Rebecca : conversations avec un nouveau message du client
export const aTraiterAssistance = (c) => !!c && c.statut !== "resolue" && c.aLire === true;
