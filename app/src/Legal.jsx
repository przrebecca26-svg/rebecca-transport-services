import { NOM, WHATSAPP } from "./contact.js";

// CONFIDENTIALITE ET CONDITIONS - texte provisoire a faire valider par un comptable ou un juriste avant le lancement public.
// Mets PROVISOIRE a false (une seule ligne) quand le texte est valide : le bandeau disparait.
export const PROVISOIRE = true;

export default function Legal({ onRetour }) {
  return (
    <section className="compte legal">
      <button type="button" className="retour" onClick={onRetour}>
        ← Retour
      </button>
      <header className="titre-service">
        <span aria-hidden="true">📄</span>
        <h2>Confidentialité et conditions</h2>
      </header>
      {PROVISOIRE && <p className="compte-info">Version provisoire, en cours de validation.</p>}

      <div className="bloc">
        <h3>Qui vous répond</h3>
        <p>
          {NOM}, basée à Netanya, intervient dans toute Israël selon les demandes et les disponibilités. Contact : WhatsApp {WHATSAPP}.
        </p>

        <h3>Ce que nous enregistrons</h3>
        <p>
          Sans compte : les informations de votre demande (adresses, date, heure, nom, téléphone, moyen de paiement prévu). Avec un compte : votre nom, prénom, date de naissance, téléphone, e-mail, adresse, vos moyens de paiement préférés, vos adresses enregistrées, vos trajets favoris, l'historique de vos demandes, votre crédit et vos recharges. Si vous ajoutez des enfants pour le ramassage scolaire : leur prénom, âge, classe, école, adresse du domicile, horaires, un téléphone d'urgence et, si vous le souhaitez, les personnes autorisées à récupérer l'enfant. En ajoutant un enfant, vous confirmez être son parent ou son représentant légal.
        </p>
        <p>Aucun numéro de carte bancaire n'est jamais enregistré : le paiement se fait directement avec Rebecca.</p>

        <h3>Pourquoi</h3>
        <p>Traiter vos demandes, organiser les trajets, suivre les paiements et le crédit, vous répondre. Vos informations ne sont ni vendues ni utilisées pour de la publicité.</p>

        <h3>Qui y a accès</h3>
        <p>
          Rebecca seule. Pour fonctionner, le site utilise des services techniques : Google Firebase (comptes et base de données), Netlify (hébergement), EmailJS (e-mail de notification à Rebecca) et un service de recherche d'adresses et d'itinéraires. Ces services ne reçoivent que ce qui est nécessaire à leur rôle.
        </p>

        <h3>Vos droits</h3>
        <p>
          Vous pouvez modifier votre téléphone, votre adresse et vos préférences depuis « Mon compte ». Pour modifier votre nom, prénom ou date de naissance, contactez Rebecca. Vous pouvez supprimer votre compte à tout moment depuis « Mon compte » ; vous pouvez aussi demander à Rebecca une copie ou la suppression de vos informations. Les demandes déjà envoyées peuvent être conservées pour la gestion de l'activité et les obligations comptables.
        </p>

        <h3>Conditions de réservation</h3>
        <p>
          Le prix affiché est une estimation : une demande n'est pas une réservation. Rebecca confirme le prix définitif et la disponibilité ; rien n'est réservé tant qu'elle n'a pas confirmé. Aucun service n'est assuré pendant Chabbat et les fêtes juives. Les conditions d'acompte et d'annulation vous sont communiquées lors de la confirmation. Péages et stationnement sont annoncés avant validation.
        </p>

        <h3>Crédit prépayé</h3>
        <p>
          Vous déclarez une recharge dans « Mon crédit » ; elle est ajoutée à votre compte quand Rebecca confirme avoir reçu le paiement. Le crédit s'utilise sur vos prochaines courses. Un bonus peut être offert selon le montant de la recharge.
        </p>

        <h3>Codes promo</h3>
        <p>Un code s'utilise avec un compte dont l'e-mail est vérifié, dans la limite d'utilisations de chaque code. La réduction s'applique sur le tarif de base du trajet ou du service, jamais sur les suppléments.</p>

        <h3>Pourboire</h3>
        <p>Le pourboire est facultatif, laissé à votre choix, et revient entièrement à Rebecca.</p>
      </div>
    </section>
  );
}
