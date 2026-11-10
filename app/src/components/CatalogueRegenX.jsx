import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, ACTIVITES_DEPART, libelleDuree } from "../pricing/catalogue.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function CatalogueRegenX({ onRetour }) {
  const [prestations, setPrestations] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "catalogue"), where("activite", "==", "regenx")),
      (s) => {
        const items = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.publiee);
        setPrestations(items.length ? items : CATALOGUE_DEPART.filter((p) => p.activite === "regenx"));
      },
      () => setPrestations(CATALOGUE_DEPART.filter((p) => p.activite === "regenx"))
    );
    return unsub;
  }, []);

  const categories = [...new Set(prestations.map((p) => p.categorie))];

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-regenx.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>RegenX</h2>
      </div>
      <p>Reconstruction du cheveu et du poil. Diagnostic obligatoire. Prix sur demande.</p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {prestations.filter((p) => p.categorie === cat).map((p) => (
            <div key={p.id} className="carte-service" style={{ cursor: "default" }}>
              <span className="corps">
                <strong>{p.nom}</strong>
                <small>{p.description || libelleDuree(p)}</small>
              </span>
              <span className="prix">Sur demande</span>
            </div>
          ))}
        </div>
      ))}
      <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite des informations sur RegenX.")} target="_blank" rel="noopener noreferrer">
        Contacter sur WhatsApp
      </a>
    </section>
  );
}
