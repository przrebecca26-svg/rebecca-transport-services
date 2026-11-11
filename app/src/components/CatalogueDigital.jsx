import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// Lien WhatsApp propre a chaque formule ou forfait : le message dit lequel interesse le client
const demander = (quoi) => lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je souhaite des informations sur : ${quoi} (Digital & Applications).`);

function Demander({ quoi }) {
  return (
    <a className="lien" href={demander(quoi)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
      Demander sur WhatsApp
    </a>
  );
}

export default function CatalogueDigital({ onRetour }) {
  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-digital-applications.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Digital & Applications</h2>
      <img src="/digital/hero.jpg" alt="Digital & Applications" style={{ width: "100%", maxWidth: 480, borderRadius: 12, margin: "12px 0" }} />
      </div>
      <p>Création de sites web et d'applications professionnelles.</p>

      <h3>Formules</h3>

      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Formule Essentielle</strong>
          <small>dès 6 900 ₪ — Environ 6 semaines</small>
          <small>Site web responsive, présentation des services, espace client, demandes et réservations, base de données, notifications.</small>
          <Demander quoi="Formule Essentielle" />
        </span>
        <span className="prix">dès 6 900 ₪</span>
      </div>

      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Formule Business</strong>
          <small>dès 14 900 ₪ — Environ 6 à 10 semaines</small>
          <small>Espace client et administration, gestion des clients, commandes et réservations, tableau de bord, gestion des tarifs, historique, automatisations et tests.</small>
          <Demander quoi="Formule Business" />
        </span>
        <span className="prix">dès 14 900 ₪</span>
      </div>

      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Formule Sur mesure</strong>
          <small>dès 22 000 à 35 000 ₪ et plus — Environ 2 à 3 mois ou davantage</small>
          <small>Architecture personnalisée, gestion avancée des droits, réservations complexes, paiements et API, automatisations, statistiques et fonctionnalités spécifiques.</small>
          <Demander quoi="Formule Sur mesure" />
        </span>
        <span className="prix">Sur devis</span>
      </div>

      <h3>Forfaits de maintenance</h3>
      <p style={{ fontSize: 14, color: "var(--gris)" }}>Facultatifs et distincts de la garantie corrective.</p>

      <div className="carte-service" style={{ cursor: "default" }}>
        <img src="/digital/maintenance-serenite.svg" alt="Sérénité" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, marginRight: 8 }} />
        <span className="corps">
          <strong>Sérénité</strong>
          <small>250 ₪/mois — 30 minutes incluses, réponse sous 3 jours ouvrés.</small>
          <Demander quoi="Forfait de maintenance Sérénité" />
        </span>
        <span className="prix">250 ₪/mois</span>
      </div>

      <div className="carte-service" style={{ cursor: "default" }}>
        <img src="/digital/maintenance-confort.svg" alt="Confort" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, marginRight: 8 }} />
        <span className="corps">
          <strong>Confort</strong>
          <small>450 ₪/mois — 1 h 30 incluse, réponse sous 48 heures ouvrées.</small>
          <Demander quoi="Forfait de maintenance Confort" />
        </span>
        <span className="prix">450 ₪/mois</span>
      </div>

      <div className="carte-service" style={{ cursor: "default" }}>
        <img src="/digital/maintenance-premium.svg" alt="Premium" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, marginRight: 8 }} />
        <span className="corps">
          <strong>Premium</strong>
          <small>750 ₪/mois — 3 heures incluses, réponse sous 24 heures ouvrées.</small>
          <Demander quoi="Forfait de maintenance Premium" />
        </span>
        <span className="prix">750 ₪/mois</span>
      </div>

      <h3>Conditions</h3>
      <ul style={{ fontSize: 14, lineHeight: 1.5 }}>
        <li>Première consultation gratuite de 30 minutes.</li>
        <li>Interventions supplémentaires : 200 à 350 ₪/heure.</li>
        <li>Paiement : 40 % / 30 % / 30 %.</li>
        <li>Options : administration, espace client, paiement, WhatsApp, Maps, fidélité, abonnements, statistiques, langues et refonte.</li>
      </ul>

      <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite discuter d'un projet Digital & Applications.")} target="_blank" rel="noopener noreferrer">
        Discuter du projet sur WhatsApp
      </a>
    </section>
  );
}
