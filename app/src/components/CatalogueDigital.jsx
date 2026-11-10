import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function CatalogueDigital({ onRetour }) {
  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-digital-applications.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Digital & Applications</h2>
      </div>
      <p>Création de sites web et d'applications professionnelles, sur devis.</p>
      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Site vitrine</strong>
          <small>Présentation de votre activité, contact, galerie.</small>
        </span>
        <span className="prix">Sur devis</span>
      </div>
      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Site avec réservation</strong>
          <small>Catalogue, prise de rendez-vous, gestion des demandes.</small>
        </span>
        <span className="prix">Sur devis</span>
      </div>
      <div className="carte-service" style={{ cursor: "default" }}>
        <span className="corps">
          <strong>Application web sur mesure</strong>
          <small>Outil adapté à votre activité.</small>
        </span>
        <span className="prix">Sur devis</span>
      </div>
      <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite discuter d'un projet Digital & Applications.")} target="_blank" rel="noopener noreferrer">
        Discuter du projet sur WhatsApp
      </a>
    </section>
  );
}
