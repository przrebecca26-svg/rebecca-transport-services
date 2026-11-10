import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, libellePrix } from "../pricing/catalogue.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

const PHOTOS = {
  "Plateau": "/epoxy/plateau.jpg",
  "Plateau tortue": "/epoxy/plateau.jpg",
};

export default function CatalogueEpoxy({ onRetour }) {
  const [articles, setArticles] = useState([]);
  const [selection, setSelection] = useState(null);
  const [variante, setVariante] = useState(null);
  const [client, setClient] = useState({ nom: "", telephone: "", quantite: 1, message: "" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });

  useEffect(() => {
    // Source de vérité : CATALOGUE_DEPART (validé). Firestore peut surcharger.
    const depart = CATALOGUE_DEPART.filter((p) => p.activite === "epoxy").map((p) => ({ ...p, publiee: true }));
    const unsub = onSnapshot(
      query(collection(db, "catalogue"), where("activite", "==", "epoxy")),
      (s) => {
        const fromDb = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.publiee);
        // Fusion : les documents Firestore remplacent ceux du départ (même id)
        const map = new Map(depart.map((p) => [p.id, p]));
        fromDb.forEach((p) => map.set(p.id, p));
        setArticles([...map.values()]);
      },
      () => setArticles(depart)
    );
    return unsub;
  }, []);

  const categories = [...new Set(articles.map((p) => p.categorie))];

  const prixEffectif = () => {
    if (variante && typeof variante.prix === "number") return variante.prix;
    if (typeof selection?.prix === "number" && selection.prix >= 0) return selection.prix;
    return null;
  };

  const surDevis = () => prixEffectif() === null;

  const envoyer = async () => {
    if (!client.nom.trim() || !client.telephone.trim()) {
      setEnvoi({ enCours: false, ok: false, erreur: "Nom et téléphone obligatoires." });
      return;
    }
    const qte = Number(client.quantite);
    if (!Number.isInteger(qte) || qte < 1 || qte > 50) {
      setEnvoi({ enCours: false, ok: false, erreur: "Quantité invalide (1 à 50)." });
      return;
    }
    setEnvoi({ enCours: true, ok: false, erreur: "" });

    const prix = prixEffectif();
    const commande = {
      type: "commande",
      activite: "epoxy",
      service: "epoxy",
      serviceTitre: "Boutique Epoxy – " + (selection.nom || ""),
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      produitId: selection.id || "",
      produit: selection.nom || "",
      varianteId: variante ? (variante.nom || "") : "",
      varianteNom: variante ? (variante.nom || "") : "",
      quantite: qte,
      prixUnitaire: prix,
      surDevis: prix === null,
      messageClient: (client.message || "").slice(0, 1000),
      statut: "en attente",
      source: "site",
      creeLe: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "commandes"), commande);
      const msg = `Bonjour Rebecca,\n\nNouvelle commande Boutique Epoxy :\n- Article : ${selection.nom}${variante ? " (" + variante.nom + ")" : ""}\n- Quantité : ${qte}\n- Prix unitaire : ${prix !== null ? prix + " ₪" : "Sur demande"}\n\nNom : ${client.nom}\nTéléphone : ${client.telephone}\nMessage : ${client.message || "-"}\n\nMerci de confirmer disponibilité et délai.`;
      window.open(lienWhatsApp(WHATSAPP, msg), "_blank", "noopener");
      setEnvoi({ enCours: false, ok: true, erreur: "" });
    } catch (e) {
      setEnvoi({ enCours: false, ok: false, erreur: "Impossible d'enregistrer la commande. Contactez Rebecca sur WhatsApp." });
    }
  };

  if (envoi.ok) {
    return (
      <section className="catalogue-nails">
        <h2>Commande enregistrée</h2>
        <p>Votre commande pour <strong>{selection?.nom}</strong> a été enregistrée.</p>
        <p>WhatsApp s'est ouvert. Rebecca vous confirmera la disponibilité et le délai.</p>
        <button className="bouton" onClick={onRetour}>Retour à l'accueil</button>
      </section>
    );
  }

  if (selection) {
    const variantes = Array.isArray(selection.variantes) ? selection.variantes : [];
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => { setSelection(null); setVariante(null); }}>← Changer d'article</button>
        <h2>Commander : {selection.nom}</h2>
        <p>{libellePrix(selection) || "Prix sur demande"}</p>
        {variantes.length > 0 && (
          <label>
            Variante<br />
            <select value={variante?.nom || ""} onChange={(e) => {
              const v = variantes.find((x) => x.nom === e.target.value) || null;
              setVariante(v);
            }}>
              <option value="">— Choisir —</option>
              {variantes.map((v) => (
                <option key={v.nom} value={v.nom}>{v.nom} — {v.prix} ₪</option>
              ))}
            </select>
          </label>
        )}
        <label>Votre nom<br /><input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} required /></label>
        <label>Votre téléphone<br /><input type="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} required /></label>
        <label>Quantité<br /><input type="number" min="1" max="50" value={client.quantite} onChange={(e) => setClient({ ...client, quantite: e.target.value })} /></label>
        <label>Message (optionnel)<br /><textarea value={client.message} onChange={(e) => setClient({ ...client, message: e.target.value })} rows={3} /></label>
        {envoi.erreur && <p style={{ color: "#c00" }}>{envoi.erreur}</p>}
        <button className="bouton" onClick={envoyer} disabled={envoi.enCours || (variantes.length > 0 && !variante)}>
          {envoi.enCours ? "Envoi…" : "Envoyer la commande"}
        </button>
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
            <div key={p.id} className="carte-service" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setSelection(p)} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
                {/* photo */}{PHOTOS[p.nom] && <img src={PHOTOS[p.nom]} alt="" width={48} height={48} style={{ borderRadius: 8, objectFit: "cover" }} />}<span className="corps">
                  <strong>{p.nom}</strong>
                  <small>{p.description || (p.delaiFabrication ? `Délai : ${p.delaiFabrication}` : "")}</small>
                </span>
              </button>
              <span className="prix">{libellePrix(p) || "Sur demande"}</span>
              <a
                href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je souhaite des informations sur : ${p.nom} (${libellePrix(p) || "sur demande"})`)}
                target="_blank"
                rel="noopener noreferrer"
                className="lien"
                style={{ fontSize: 20 }}
                title="Partager sur WhatsApp"
              >
                💬
              </a>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
