// Texte de depart de la page « Confidentialite et conditions » - Rebecca Services (Lot B, seance B5)
// Rebecca modifie ce texte dans l'espace prive (onglet Reglages) : il est alors lu dans la base (reglages/legal).
// Ce texte de depart ne sert que tant que rien n'a ete enregistre. Texte PROVISOIRE, a faire valider (comptable, juriste).
// Une section = { titre, texte } ; dans le texte, une ligne vide separe deux paragraphes.

import { INSTAGRAM, NOM, WHATSAPP } from "./contact.js";

export const SECTIONS_DEPART = [
  {
    titre: "Qui vous répond",
    texte: `${NOM}, basée à Netanya, intervient dans toute Israël selon les demandes et les disponibilités. Contact : WhatsApp ${WHATSAPP} · Instagram @${INSTAGRAM}.`,
  },
  {
    titre: "Ce que j'enregistre",
    texte:
      "Sans compte : les informations de votre demande (adresses, date, heure, nom, téléphone, moyen de paiement prévu). Avec un compte : votre nom, prénom, date de naissance, téléphone, e-mail, adresse, vos moyens de paiement préférés, vos adresses enregistrées, vos trajets favoris, l'historique de vos demandes, votre crédit et vos recharges. Si vous ajoutez des enfants pour le ramassage scolaire : leur prénom, âge, classe, école, adresse du domicile, horaires, un téléphone d'urgence et, si vous le souhaitez, les personnes autorisées à récupérer l'enfant. En ajoutant un enfant, vous confirmez être son parent ou son représentant légal.\n\nAucun numéro de carte bancaire n'est jamais enregistré : le paiement se fait directement avec Rebecca.",
  },
  {
    titre: "Pourquoi",
    texte: "Traiter vos demandes, organiser les trajets, suivre les paiements et le crédit, vous répondre. Vos informations ne sont ni vendues ni utilisées pour de la publicité.",
  },
  {
    titre: "Qui y a accès",
    texte:
      "Rebecca seule. Pour fonctionner, le site utilise des services techniques : Google Firebase (comptes et base de données), Netlify (hébergement), EmailJS (e-mail de notification à Rebecca) et un service de recherche d'adresses et d'itinéraires. Ces services ne reçoivent que ce qui est nécessaire à leur rôle.",
  },
  {
    titre: "Vos droits",
    texte:
      "Vous pouvez modifier votre téléphone, votre adresse et vos préférences depuis « Mon compte ». Pour modifier votre nom, prénom ou date de naissance, contactez Rebecca. Vous pouvez supprimer votre compte à tout moment depuis « Mon compte » ; vous pouvez aussi demander à Rebecca une copie ou la suppression de vos informations. Les demandes déjà envoyées peuvent être conservées pour la gestion de l'activité et les obligations comptables.",
  },
  {
    titre: "Conditions de réservation",
    texte:
      "Le prix affiché est une estimation : une demande n'est pas une réservation. Rebecca confirme le prix définitif et la disponibilité ; rien n'est réservé tant qu'elle n'a pas confirmé. Aucun service n'est assuré pendant Chabbat et les fêtes juives. Les conditions d'acompte et d'annulation vous sont communiquées lors de la confirmation. Péages et stationnement sont annoncés avant validation.",
  },
  {
    titre: "Crédit prépayé",
    texte:
      "Vous déclarez une recharge dans « Mon crédit » ; elle est ajoutée à votre compte quand Rebecca confirme avoir reçu le paiement. Le crédit s'utilise sur vos prochaines courses. Un bonus peut être offert selon le montant de la recharge.",
  },
  {
    titre: "Codes promo",
    texte: "Un code s'utilise avec un compte dont l'e-mail est vérifié, dans la limite d'utilisations de chaque code. La réduction s'applique sur le tarif de base du trajet ou du service, jamais sur les suppléments.",
  },
  {
    titre: "Pourboire",
    texte: "Le pourboire est facultatif, laissé à votre choix, et revient entièrement à Rebecca.",
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
