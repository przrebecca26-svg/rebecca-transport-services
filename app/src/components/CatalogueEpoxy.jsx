import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, libellePrix } from "../pricing/catalogue.js";
import { enregistrerDemande } from "../demandes.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function CatalogueEpoxy({ onRetour }) {
  const [articles, setArticles] = useState([]);
  const [selection, setSelection] = useState(null);
  const [client, setClient] = useState({ nom: "", telephone: "", quantite: 1, message: "" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });

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

  const envoyer = async () => {
    if (!client.nom.trim() || !client.telephone.trim()) {
      setEnvoi({ enCours: false, ok: false, erreur: "Nom et téléphone obligatoires." });
      return;
    }
    setEnvoi({ enCours: true, ok: false, erreur: "" });
    const message = `Bonjour Rebecca,\n\nNouvelle commande Boutique Epoxy :\n- Article : ${selection.nom}\n- Quantité : ${client.quantite}\n- Prix unitaire : ${libellePrix(selection) || "Sur demande"}\n\nNom : ${client.nom}\nTéléphone : ${client.telephone}\nMessage : ${client.message || "-"}\n\nMerci de me confirmer la disponibilité et le délai.`;
    const demande = {
      service: "epoxy",
      serviceTitre: "Boutique Epoxy – " + selection.nom,
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      prixEstime: selection.prix || null,
      surDevis: !selection.prix,
      details: { article: selection.nom, quantite: client.quantite, message: client.message },
      message,
      statut: "en attente",
      source: "site",
    };
    try {
      await enregistrerDemande(demande);
      const url = lienWhatsApp(WHATSAPP, message);
      window.open(url, "_blank", "noopener");
      setEnvoi({ enCours: false, ok: true, erreur: "" });
    } catch (e) {
      setEnvoi({ enCours: false, ok: false, erreur: "Impossible d'enregistrer. Contactez Rebecca sur WhatsApp." });
    }
  };

  if (envoi.ok) {
    return (
      <section className="catalogue-nails">
        <h2>Commande enregistrée</h2>
        <p>Votre demande pour <strong>{selection?.nom}</strong> a été enregistrée.</p>
        <p>WhatsApp s'est ouvert. Rebecca vous confirmera la disponibilité et le délai.</p>
        <button className="bouton" onClick={onRetour}>Retour à l'accueil</button>
      </section>
    );
  }

  if (selection) {
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setSelection(null)}>← Changer d'article</button>
        <h2>Commander : {selection.nom}</h2>
        <p>{libellePrix(selection) || "Prix sur demande"}</p>
        <label>Votre nom<br /><input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} required /></label>
        <label>Votre téléphone<br /><input type="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} required /></label>
        <label>Quantité<br /><input type="number" min="1" value={client.quantite} onChange={(e) => setClient({ ...client, quantite: Number(e.target.value) })} /></label>
        <label>Message (optionnel)<br /><textarea value={client.message} onChange={(e) => setClient({ ...client, message: e.target.value })} rows={3} /></label>
        {envoi.erreur && <p style={{ color: "#c00" }}>{envoi.erreur}</p>}
        <button className="bouton" onClick={envoyer} disabled={envoi.enCours}>{envoi.enCours ? "Envoi…" : "Envoyer la commande"}</button>
      </section>
    );
  }

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-epoxy.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Boutique Epoxy</h2>
      </div>
      <p>Créations personnalisées en résine. Choisissez un article pour commander.</p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {articles.filter((p) => p.categorie === cat).map((p) => (
            <button key={p.id} className="carte-service" onClick={() => setSelection(p)}>
              <span className="corps">
                <strong>{p.nom}</strong>
                <small>{p.description || (p.delaiFabrication ? `Délai : ${p.delaiFabrication}` : "")}</small>
              </span>
              <span className="prix">{libellePrix(p) || "Sur demande"}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
