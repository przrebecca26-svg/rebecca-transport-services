import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

// RESTAURANTS SUR LE SITE (25 nov. 2026, étape 1) - #/restaurants
// Les restaurants partenaires qui l'acceptent apparaissent sur rebeccaservices.com. Le client choisit, touche
// « Commander » : sa commande part au RESTAURANT par WhatsApp (il paie le restaurant, comme d'habitude), et la
// livraison est faite par Rebecca Services (le restaurant l'envoie depuis son espace). Jamais d'argent des repas chez Rebecca.
// Document public reglages/vitrineRestos (lecture pour tous, écriture Rebecca seule : règles déjà en place).
const nettoie = (t) => String(t || "").replace(/\D/g, "").replace(/^0/, "972");
export function useVitrineRestos() {
  const [liste, setListe] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "vitrineRestos"), (s) => { try { setListe(JSON.parse((s.exists() && s.data().json) || "[]")); } catch { setListe([]); } }, () => setListe([])), []);
  return liste;
}

export default function RestosVitrine({ onAccueil }) {
  const liste = useVitrineRestos();
  const visibles = (liste || []).filter((r) => r.visible !== false);
  return (
    <section className="pp-bloc">
      <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>
      <h2>🍽️ Nos restaurants partenaires</h2>
      <p>Commandez directement au restaurant : <b>c'est Rebecca Services qui vous livre</b>, avec soin, à Netanya et alentours.</p>
      {!liste && <p className="tb-note">Chargement…</p>}
      {liste && !visibles.length && <p className="tb-note">Bientôt ici : les restaurants partenaires.</p>}
      {visibles.map((r) => {
        const msg = `Bonjour ${r.nom}, je souhaite commander en livraison (via le site Rebecca Services). Mon adresse : `;
        return (
          <div key={r.id} className="pp-avantage" style={{ alignItems: "flex-start" }}>
            <span>{r.icone || "🍽️"}</span>
            <div style={{ flex: 1 }}>
              <b>{r.nom}</b>{r.cuisine && <small> · {r.cuisine}</small>}
              {r.description && <small style={{ display: "block" }}>{r.description}</small>}
              {r.horaires && <small style={{ display: "block" }}>🕒 {r.horaires}</small>}
              {r.adresse && <small style={{ display: "block" }}>📍 {r.adresse}</small>}
              <div className="tb-actions" style={{ marginTop: 6 }}>
                {r.whatsapp && <a className="pp-bouton" href={`https://wa.me/${nettoie(r.whatsapp)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">💬 Commander</a>}
                {r.telephone && <a className="bouton-secondaire" href={`tel:${r.telephone}`}>📞 Appeler</a>}
                {r.menu && <a className="bouton-secondaire" href={r.menu} target="_blank" rel="noopener noreferrer">📋 Menu</a>}
              </div>
            </div>
          </div>
        );
      })}
      <p className="tb-note">Vous payez votre repas au restaurant. Les frais de livraison sont indiqués par le restaurant.</p>
    </section>
  );
}

// Espace de Rebecca : qui apparaît sur le site
export function VitrineRestosAdmin() {
  const liste = useVitrineRestos();
  const [info, setInfo] = useState("");
  const [f, setF] = useState(null);
  if (!liste) return <p className="tb-note">Chargement…</p>;
  const sauver = async (l) => { try { await setDoc(doc(db, "reglages", "vitrineRestos"), { json: JSON.stringify(l.slice(0, 50)), majLe: serverTimestamp() }); setInfo("✓ Enregistré : visible sur rebeccaservices.com/#/restaurants"); } catch { setInfo("Enregistrement impossible."); } };
  const champ = (k, label, ph = "") => <label className="champ">{label}<input value={f[k] || ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <div className="tb-bloc">
      <h3>🍽️ Restaurants visibles sur le site</h3>
      <p className="tb-note">Page publique : rebeccaservices.com/#/restaurants. Le client commande au restaurant par WhatsApp ; tu livres. Mets seulement les restaurants qui ont dit oui.</p>
      {liste.map((r) => (
        <div key={r.id} className="tb-actions" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>{r.visible === false ? "⚪" : "🟢"} <b>{r.nom}</b></span>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setF(r)}>Modifier</button>
          <button type="button" className="tb-bouton tb-clair" onClick={() => sauver(liste.map((x) => (x.id === r.id ? { ...x, visible: x.visible === false } : x)))}>{r.visible === false ? "Afficher" : "Cacher"}</button>
          <button type="button" className="tb-bouton ag-danger" onClick={() => window.confirm(`Retirer ${r.nom} du site ?`) && sauver(liste.filter((x) => x.id !== r.id))}>🗑️</button>
        </div>
      ))}
      {!f && <button type="button" className="tb-bouton" onClick={() => setF({ id: "r" + Date.now().toString(36), visible: true })}>＋ Ajouter un restaurant</button>}
      {f && (
        <div>
          {champ("nom", "Nom")}{champ("cuisine", "Cuisine", "Sushi, pizza…")}{champ("description", "Présentation courte")}
          {champ("whatsapp", "WhatsApp du restaurant (commandes)", "05…")}{champ("telephone", "Téléphone")}{champ("adresse", "Adresse")}
          {champ("horaires", "Horaires", "Dim-jeu 11h-22h")}{champ("menu", "Lien du menu (facultatif)", "https://…")}{champ("icone", "Emoji", "🍣")}
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!String(f.nom || "").trim()} onClick={() => { const l = liste.some((x) => x.id === f.id) ? liste.map((x) => (x.id === f.id ? f : x)) : [...liste, f]; sauver(l); setF(null); }}>Enregistrer</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setF(null)}>Fermer</button>
          </div>
        </div>
      )}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
