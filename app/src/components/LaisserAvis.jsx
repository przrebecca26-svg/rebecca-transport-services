import { TARIFS } from "../pricing/config.js";
import { WHATSAPP } from "../contact.js";

// 26 nov. 2026 (Rebecca) : lien d'avis direct rebeccaservices.com/#/avis (QR code dans la voiture, messages) :
// la cliente choisit où laisser son avis. Aucune donnée écrite ici : l'avis se laisse sur la fiche Référence Israël,
// sur Google si le lien est réglé, ou dans son espace (« Mon historique ») pour une course faite avec un compte.
export const LIEN_AVIS_REFERENCE = "https://www.referenceisrael.com/prestataire/rebecca-services?avis=1&utm_source=site&utm_medium=qr&utm_campaign=avis";

export default function LaisserAvis({ onAccueil, onCompte }) {
  const google = TARIFS.avisGoogleUrl;
  return (
    <section className="pp-bloc" style={{ textAlign: "center" }}>
      <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>
      <h2 style={{ marginTop: 10 }}>⭐ Votre avis compte</h2>
      <p>Merci de m'avoir fait confiance 🙏 Votre avis aide d'autres personnes à me trouver. 30 secondes suffisent.</p>
      <p><a className="pp-bouton" style={{ display: "inline-block", textDecoration: "none" }} href={LIEN_AVIS_REFERENCE} target="_blank" rel="noopener noreferrer">⭐ Laisser un avis sur ma fiche Référence Israël</a></p>
      {google && <p><a className="bouton-secondaire" href={google} target="_blank" rel="noopener noreferrer">⭐ Laisser un avis Google</a></p>}
      <p className="tb-note">Vous avez un compte sur le site ? Vous pouvez aussi noter votre course dans « Mon compte → Historique ».</p>
      <p><button type="button" className="bouton-secondaire" onClick={onCompte}>Mon compte</button></p>
      <p className="tb-note">Une remarque à me faire directement ? <a className="lien" href={`https://wa.me/972${WHATSAPP.slice(1)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
      <p style={{ fontStyle: "italic", color: "#d9a48f" }}>Rebecca Services · Votre temps est précieux, je vous aide à en profiter.</p>
    </section>
  );
}
