import { useState } from "react";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function CatalogueTransport({ onRetour, autorise }) {
  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <h2>Transport privé</h2>
      {!autorise && (
        <p className="tb-note">Service disponible sur demande. Contactez-moi sur WhatsApp.</p>
      )}
      {autorise ? (
        <p>Tarifs et réservation disponibles pour les clients autorisés.</p>
      ) : (
        <button className="bouton" onClick={() => window.open(lienWhatsApp(WHATSAPP, "Bonjour, je souhaite un transport privé."), "_blank")}>
          Contacter sur WhatsApp
        </button>
      )}
    </section>
  );
}
