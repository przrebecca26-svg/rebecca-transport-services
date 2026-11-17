// Texte de depart de la page « Confidentialite et conditions » - Rebecca Services (Lot B, seance B5)
// Rebecca modifie ce texte dans l'espace prive (onglet Reglages) : il est alors lu dans la base (reglages/legal).
// Ce texte de depart ne sert que tant que rien n'a ete enregistre. Texte PROVISOIRE, a faire valider (comptable, juriste).
// Une section = { titre, texte } ; dans le texte, une ligne vide separe deux paragraphes.

import { INSTAGRAM, NOM, WHATSAPP } from "./contact.js";

// 17 nov. 2026 : texte de depart refait pour TOUTES les activites (coursier, transport, ramassage scolaire, beaute,
// Boutique Epoxy, Digital), les acomptes, les moyens de paiement, les e-mails automatiques, l'equipe (Jeremy) et
// les services techniques reellement utilises. Toujours PROVISOIRE tant que le juriste et le comptable n'ont pas relu.
export const VERSION_TEXTE = "2026-11-17";

export const SECTIONS_DEPART = [
  {
    titre: "Qui vous répond",
    texte: `${NOM} est l'activité de Rebecca Perez, travailleuse indépendante en Israël, basée à Netanya. J'interviens dans toute Israël selon les demandes et mes disponibilités, jamais pendant Chabbat ni les fêtes juives.\n\nContact : WhatsApp ${WHATSAPP} · Instagram @${INSTAGRAM}.`,
  },
  {
    titre: "Ce que propose le site",
    texte: "Services coursier (livraisons, courses et achats, petits déménagements), transport privé et transferts aéroport, ramassage scolaire, rendez-vous beauté (Nails Prestige, Prestige Hair, Prestige Slim & Lift, RegenX), Boutique Epoxy (créations en résine) et Digital & Applications (création de sites et d'applications).\n\nLes prix affichés sont des estimations ou des prix « à partir de ». Un formulaire envoyé est une demande, pas une réservation : rien n'est réservé tant que je n'ai pas confirmé le prix et la disponibilité.",
  },
  {
    titre: "Ce que j'enregistre",
    texte: "Pour toute demande : votre nom, votre téléphone, votre e-mail si vous le donnez, les adresses, la date, l'heure, les détails utiles (passagers, bagages, numéro de vol, articles, prestation choisie) et le moyen de paiement prévu.\n\nAvec un compte : vos nom, prénom, date de naissance, téléphone, e-mail, adresse, adresses et trajets favoris, l'historique de vos demandes, votre crédit, vos codes promo et vos avis.\n\nRamassage scolaire : le prénom, l'âge ou la classe, l'école, les horaires de l'enfant, un téléphone d'urgence et les personnes autorisées à le récupérer. En ajoutant un enfant, vous confirmez être son parent ou son représentant légal. Si vous partagez un trajet avec d'autres familles, vous indiquez leur nom et leur téléphone : chaque famille reçoit son propre lien pour compléter ses informations.\n\nDigital & Applications : les informations de votre projet et votre dossier de lancement. Devenir partenaire : les informations de votre candidature.\n\nRendez-vous beauté et RegenX : les questions de santé et le consentement sont remplis sur papier lors du rendez-vous ou du diagnostic, ils ne sont pas enregistrés sur le site.\n\nAucun numéro de carte bancaire n'est jamais enregistré sur le site.",
  },
  {
    titre: "Pourquoi",
    texte: "Traiter vos demandes, organiser les trajets et les rendez-vous, vous envoyer les confirmations, rappels et messages de suivi, suivre les paiements, les acomptes et le crédit, tenir ma comptabilité. Vos informations ne sont ni vendues ni utilisées pour de la publicité.",
  },
  {
    titre: "Qui y a accès",
    texte: "Moi seule, et pour les services coursier et transport, mon coéquipier (Jérémy), qui voit uniquement ces demandes et les coordonnées (nom, téléphone, adresses) des clientes de ces services. Il ne voit jamais les rendez-vous beauté, les commandes Epoxy, les projets Digital ni mes finances.\n\nPour fonctionner, le site utilise des services techniques : Google Firebase (comptes et base de données), Netlify (hébergement et envoi des rappels programmés), EmailJS (e-mails de confirmation et de rappel), Google Maps Platform et OpenStreetMap (recherche d'adresses, itinéraires et trafic), WhatsApp (messages que j'envoie moi-même). Pour payer, vous utilisez directement PayPal, Bit ou Revolut : ces services appliquent leurs propres conditions. Chacun ne reçoit que ce qui est nécessaire à son rôle.",
  },
  {
    titre: "Messages et e-mails",
    texte: "Je vous écris sur WhatsApp et, si vous m'avez donné votre e-mail, par e-mail : confirmation, demande d'acompte, lien de paiement, rappel la veille d'un rendez-vous ou d'un retour, « je suis en route », remerciement, demande d'avis, suivi d'une commande ou d'un projet. Certains rappels par e-mail partent automatiquement la veille au soir. Pour ne plus les recevoir, dites-le-moi simplement.",
  },
  {
    titre: "Photos",
    texte: "Je ne publie jamais la photo d'une personne sans son accord écrit. Pour RegenX, l'accord (ou le refus) d'utiliser les photos avant / après est signé lors du diagnostic. Les photos des créations Epoxy montrent les objets, jamais les clientes.",
  },
  {
    titre: "Combien de temps",
    texte: "Les demandes et les paiements sont gardés le temps nécessaire à la gestion de l'activité et aux obligations comptables. Une demande de ramassage partagée sans réponse est annulée au bout de 2 semaines. Vous pouvez demander la suppression de vos informations à tout moment, sauf celles que la loi m'oblige à garder.",
  },
  {
    titre: "Vos droits",
    texte: "Vous pouvez modifier votre téléphone, votre adresse et vos préférences depuis « Mon compte ». Pour modifier votre nom, prénom ou date de naissance, contactez-moi. Vous pouvez supprimer votre compte à tout moment depuis « Mon compte » et me demander une copie ou la suppression de vos informations. Le compte est réservé aux adultes (18 ans et plus) ; un enfant s'ajoute dans le compte de son parent.",
  },
  {
    titre: "Conditions de réservation",
    texte: "Le prix affiché est une estimation. Je confirme le prix définitif et la disponibilité ; une réservation n'existe qu'après ma confirmation. Aucun service n'est assuré pendant Chabbat et les fêtes juives : ces périodes sont bloquées automatiquement.\n\nPéages et stationnement sont annoncés avant validation. Un arrêt supplémentaire, un changement de trajet ou d'horaire est réajusté après votre accord. Attente : 10 minutes de tolérance, puis facturation selon le tarif convenu. Aucun supplément surprise.\n\nTrajet partagé (ramassage, transport, aéroport) : chaque famille paie sa part selon le calcul indiqué dans le devis. Ramassage scolaire : la première demande garde le créneau une semaine ; sans réponse, la demande est annulée au bout de 2 semaines.",
  },
  {
    titre: "Acompte et paiement",
    texte: "Pour bloquer un rendez-vous ou un service, je demande un acompte de 20 % (10 ₪ minimum), à régler dans les 48 heures (plus court si le rendez-vous est proche ; le délai s'arrête pendant Chabbat et les fêtes). Sans acompte dans ce délai, le créneau peut être libéré. Cas particuliers : 40 % pour l'essai et le jour J d'une mariée (Prestige Hair), 30 ₪ pour le diagnostic RegenX, 40 % à la commande pour un projet Digital.\n\nUn créneau de rendez-vous est bloqué dès votre demande et se libère si je la refuse. Paiement en espèces, Bit, Revolut, PayPal, virement ou carte selon le cas. Un lien de paiement vous permet de me prévenir que vous avez payé ; je confirme dès réception.\n\nCure Slim & Lift : paiement possible en 4 fois maximum. Projet Digital : 40 % à la commande, 30 % à la validation de la version fonctionnelle, 30 % avant la livraison définitive.",
  },
  {
    titre: "Annulation",
    texte: "Si vous annulez, l'acompte est conservé. Si j'annule, je vous rembourse entièrement. RegenX : exception en cas de maladie ou d'imprévu grave. Un retard important peut entraîner l'annulation du rendez-vous, l'acompte restant acquis. Les conditions précises vous sont rappelées à la confirmation.",
  },
  {
    titre: "Boutique Epoxy",
    texte: "Chaque création est faite à la main : les couleurs et les motifs peuvent varier légèrement d'une pièce à l'autre. Le délai de fabrication est indiqué sur chaque article ; une création sur devis démarre après votre accord sur le prix. Je vous préviens quand la commande est prête, en livraison puis livrée.",
  },
  {
    titre: "Digital & Applications",
    texte: "Première consultation gratuite de 30 minutes. Les prix affichés sont indicatifs ; le devis personnalisé fait foi. L'étude et le cahier des charges payants sont déduits du développement si vous commandez dans les 30 jours. Garantie corrective gratuite de 60 jours après la livraison ; la maintenance est facultative. Hébergement, nom de domaine et services externes sont ouverts à votre nom et à votre charge. Le suivi de votre projet se fait sur votre lien personnel, que vous ne devez pas partager.",
  },
  {
    titre: "Crédit prépayé, codes promo, parrainage et pourboire",
    texte: "Une recharge de crédit est ajoutée à votre compte quand je confirme avoir reçu le paiement ; le crédit s'utilise sur vos prochaines courses. Un code promo s'utilise avec un compte vérifié, dans la limite prévue pour chaque code ; la réduction s'applique au tarif de base, jamais aux suppléments. Parrainage : 10 ₪ de crédit offerts à la marraine. Le pourboire est facultatif.",
  },
];

export const MAX_SECTIONS = 20;
export const MAX_TITRE = 80;
export const MAX_TEXTE = 5000;

// Sections valides lues dans la base (sinon null : on garde le texte de depart)
export function sectionsValides(liste) {
  if (!Array.isArray(liste) || liste.length === 0) return null;
  const propres = liste
    .filter((s) => s && typeof s.titre === "string" && typeof s.texte === "string" && (s.titre.trim() || s.texte.trim()))
    .slice(0, MAX_SECTIONS)
    .map((s) => ({ titre: s.titre.slice(0, MAX_TITRE), texte: s.texte.slice(0, MAX_TEXTE) }));
  return propres.length ? propres : null;
}
