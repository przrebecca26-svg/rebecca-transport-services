import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, libellePrix } from "../pricing/catalogue.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function CatalogueEpoxy({ onRetour }) {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "catalogue"), where("activite", "==", "epoxy")),
      (s) => {
        const items = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.publiee);
        setArticles(items.length ? items : CATALOGUE_DEPART.filter((p) => p.activite === "epoxy"));
      },
      () => setArticles(CATALOGUE_DEPART.filter((p) => p.activite === "epoxy"))
    );
    return unsub;
  }, []);

  const categories = [...new Set(articles.map((p) => p.categorie))];

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-epoxy.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Boutique Epoxy</h2>
      </div>
      <p>Créations personnalisées en résine. Fabrication sous 2 à 5 jours.</p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {articles.filter((p) => p.categorie === cat).map((p) => (
            <div key={p.id} className="carte-service" style={{ cursor: "default" }}>
              <span className="corps">
                <strong>{p.nom}</strong>
                <small>{p.description || (p.delaiFabrication ? `Délai : ${p.delaiFabrication}` : "")}</small>
              </span>
              <span className="prix">{libellePrix(p) || "Sur demande"}</span>
            </div>
          ))}
        </div>
      ))}
      <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite commander un article Epoxy.")} target="_blank" rel="noopener noreferrer">
        Commander sur WhatsApp
      </a>
    </section>
  );
}
