import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase.js";
import { ecouterCatalogue, ecouterGalerieActivite, ecouterGalerieArticle, ecouterPrincipales } from "../catalogueClient.js";
import Galerie from "./Galerie.jsx";
import { CATALOGUE_DEPART, libellePrix } from "../pricing/catalogue.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// 12 nov. 2026 (20h26) : plus aucune image du site pour Epoxy. Chaque article a la photo principale choisie par
// Rebecca (Reglages > Catalogue) et sa galerie (jusqu'a 30 photos), chargee quand la cliente ouvre l'article.

export default function CatalogueEpoxy({ onRetour }) {
  const [articles, setArticles] = useState([]);
  const [selection, setSelection] = useState(null);
  const [variante, setVariante] = useState(null);
  const [client, setClient] = useState({ nom: "", telephone: "", quantite: 1, message: "" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });
  const [principales, setPrincipales] = useState({});
  const [galerie, setGalerie] = useState([]);
  const [galerieArticle, setGalerieArticle] = useState([]);
  useEffect(() => ecouterGalerieActivite("epoxy", setGalerie), []);
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // La base fait foi (articles publiés, prix modifiés dans l'admin) ; liste de départ tant que la base est vide.
  useEffect(() => ecouterCatalogue("epoxy", (liste) => setArticles(liste)), []);

  const categories = [...new Set(articles.map((p) => p.categorie))];
  const idsArticles = articles.map((p) => p.id).join("|");
  useEffect(() => ecouterPrincipales(idsArticles ? idsArticles.split("|") : [], setPrincipales), [idsArticles]);
  const idSelection = selection && selection.id;
  useEffect(() => {
    setGalerieArticle([]);
    return idSelection ? ecouterGalerieArticle(idSelection, setGalerieArticle) : undefined;
  }, [idSelection]);

  // Photo d'un article : sa photo principale (choisie par Rebecca), sinon aucune image
  const photoDe = (p) => (p && p.id && principales[p.id] ? principales[p.id].image : null);
  // Autres photos de l'article ouvert : anciennes photos rangees avec la principale, puis la galerie
  const autresPhotos = (p) => [...((p && principales[p.id] && principales[p.id].autres) || []), ...galerieArticle.map((x) => x.donnees)];

  const prixEffectif = () => {
    if (selection?.typePrix === "devis") return null;
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
      // 13 nov. 2026 : sans compte aussi (le compte verifie ajoute seulement le suivi dans « Mon espace »)
      ...(user && user.emailVerified ? { uid: user.uid } : {}),
      type: "commande",
      activite: "epoxy",
      service: "epoxy",
      serviceTitre: "Boutique Epoxy – " + (selection.nom || ""),
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      produitId: selection.id || "",
      produit: selection.nom || "",
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
      setEnvoi({ enCours: false, ok: false, erreur: e && e.code === "permission-denied" ? "Votre commande n'a pas pu être enregistrée. Contactez Rebecca sur WhatsApp." : "Enregistrement impossible pour le moment. Vérifiez la connexion puis réessayez." });
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
        {photoDe(selection) && <img src={photoDe(selection)} alt={selection.nom} style={{ width: "100%", maxWidth: 320, borderRadius: 12, marginBottom: 12 }} />}
        {autresPhotos(selection).length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {autresPhotos(selection).map((src, i) => <img key={i} src={src} alt="" loading="lazy" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, flex: "none" }} />)}
          </div>
        )}
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
        <label>Votre nom<br /><input type="text" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} required /></label>
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
      <Galerie photos={galerie} titre={"Galerie"} />
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {articles.filter((p) => p.categorie === cat).map((p) => (
            <div key={p.id} className="carte-service" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setSelection(p)} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
                {photoDe(p) && <img src={photoDe(p)} alt="" width={48} height={48} style={{ borderRadius: 8, objectFit: "cover" }} />}<span className="corps">
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
