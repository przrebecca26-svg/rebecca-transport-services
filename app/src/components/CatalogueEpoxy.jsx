import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase.js";
import { ecouterCatalogue } from "../catalogueClient.js";
import { CATALOGUE_DEPART, libellePrix } from "../pricing/catalogue.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// Visuels d'illustration (retries le 11 nov. 2026 : chaque image a ete controlee une par une).
// Un article sans visuel fiable n'a PAS d'image ici. Les vraies photos ajoutees par Rebecca dans
// Reglages > Catalogue > Modifier passent toujours avant ces visuels.
const E = (n) => "/epoxy/" + n + ".jpg";
const PHOTOS = {
  "Cendrier": E("01_Cendrier_Petit"),
  "Support de téléphone": E("04_Support_Telephone"),
  "Carrousel": E("21_Boucles_Oreilles"),
  "Vase petit": E("32_Plateau_Chabbat_Avec_Poignee"),
  "Miroir coquillages": E("31_Plateau_Chabbat_Sans_Poignee"),
  "Vase sac": E("43_Lampe_Logo_Grande"),
  "Petite boîte à bijoux": E("05_Petite_Boite_Bijoux"),
  "Boîte de rangement": E("08_Boite_Rangement_Petite"),
  "Grande boîte rectangulaire": E("11_Boite_Rangement_Rectangulaire"),
  "Boîte de rangement à maquillage": E("12_Verre_Pinceaux"),
  "Bol de rangement": E("28_Miroir_Coquillages"),
  "Porte-savon": E("06_Porte_Savon"),
  "Bouteille distributeur à savon": E("07_Distributeur_Savon"),
  "Plateau": E("14_Plateau_Petit"),
  "Porte-cuillère": E("30_Table_Rectangulaire"),
  "Bracelet": E("17_Bracelet"),
  "Collier": E("18_Collier"),
  "Porte-clés": E("19_Porte_Cles"),
  "Bague": E("20_Bague"),
  "Table ronde": E("34_Verre_Kidouch"),
  "Table rectangle": E("35_Saliere"),
  "Plateau de Chabbat sans poignée": E("27_Vase_Petit"),
  "Plateau de Chabbat avec poignée": E("24_Bol_Rangement"),
  "Plateau de Chabbat grand rond": E("25_Plateau_Tortue"),
  "Hanoukia": E("36_Kit_Havdala"),
  "Lampe": E("37_Keli"),
  "Lampe sac": E("39_Hanouka_Petit"),
  "Bougie parfumée dans sa boîte Epoxy": E("48_Bougie_Logo_Grande"),
};
// Visuel propre a une variante (le nom de la variante doit etre exactement celui du catalogue)
const VARIANT_PHOTOS = {
  "Cendrier": { "Petit": E("01_Cendrier_Petit"), "Moyen": E("02_Cendrier_Moyen"), "Grand": E("03_Cendrier_Grand") },
  "Boîte de rangement": { "Petite": E("09_Boite_Rangement_Moyenne"), "Moyenne": E("08_Boite_Rangement_Petite"), "Grande": E("10_Boite_Rangement_Grande") },
  "Plateau": { "Petit": E("14_Plateau_Petit"), "Grand": E("13_Boite_Rangement_Maquillage"), "Grand rond": E("15_Plateau_Grand") },
};

export default function CatalogueEpoxy({ onRetour }) {
  const [articles, setArticles] = useState([]);
  const [selection, setSelection] = useState(null);
  const [variante, setVariante] = useState(null);
  const [client, setClient] = useState({ nom: "", telephone: "", quantite: 1, message: "" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });
  const [photos, setPhotos] = useState({});
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "photosCatalogue"), (s) => {
      const map = {};
      s.docs.forEach((d) => {
        const data = d.data();
        if (data.prestationId && data.donnees) {
          if (!map[data.prestationId]) map[data.prestationId] = [];
          map[data.prestationId].push(data.donnees);
        }
      });
      setPhotos(map);
    }, () => {});
    return unsub;
  }, []);
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // La base fait foi (articles publiés, prix modifiés dans l'admin) ; liste de départ tant que la base est vide.
  useEffect(() => ecouterCatalogue("epoxy", (liste) => setArticles(liste)), []);

  const categories = [...new Set(articles.map((p) => p.categorie))];

  // Photo d'un article : la vraie photo de l'admin d'abord, puis le visuel de la variante, puis le visuel de l'article
  const photoDe = (p, v) => {
    if (!p) return null;
    if (p.id && photos[p.id] && photos[p.id][0]) return photos[p.id][0];
    if (v && VARIANT_PHOTOS[p.nom] && VARIANT_PHOTOS[p.nom][v.nom]) return VARIANT_PHOTOS[p.nom][v.nom];
    return PHOTOS[p.nom] || null;
  };

  const prixEffectif = () => {
    if (selection?.typePrix === "devis") return null;
    if (variante && typeof variante.prix === "number") return variante.prix;
    if (typeof selection?.prix === "number" && selection.prix >= 0) return selection.prix;
    return null;
  };

  const surDevis = () => prixEffectif() === null;

  const envoyer = async () => {
    if (!user || !user.emailVerified) {
      setEnvoi({ enCours: false, ok: false, erreur: "Connecte-toi avec un compte vérifié pour commander." });
      return;
    }
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
      uid: user.uid,
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
        {photoDe(selection, variante) && <img src={photoDe(selection, variante)} alt={selection.nom} style={{ width: "100%", maxWidth: 320, borderRadius: 12, marginBottom: 12 }} />}
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
