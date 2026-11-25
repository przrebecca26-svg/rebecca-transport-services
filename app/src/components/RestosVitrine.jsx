import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { reduirePhoto } from "../photoReduite.js";

// RESTAURANTS SUR LE SITE (25 nov. 2026) - #/restaurants
// Fiche complète (décision de Rebecca) : logo, photos, présentation, spécialités, cacherout, horaires, menu (lien PDF
// ou photos), téléphone, WhatsApp, zone de livraison. Le client commande AU RESTAURANT (WhatsApp ou téléphone) et paie
// son repas au restaurant ; c'est Rebecca Services qui livre. Jamais d'argent des repas chez Rebecca.
// Documents publics (règles v36 déjà en place : reglages lisibles par tous, écrits par Rebecca seule) :
//  - reglages/vitrineRestos : la liste (textes) ; - reglages/vitrineImg_ID : logo, photos et photos du menu.
const nettoie = (t) => String(t || "").replace(/\D/g, "").replace(/^0/, "972");
export function useVitrineRestos() {
  const [liste, setListe] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "vitrineRestos"), (s) => { try { setListe(JSON.parse((s.exists() && s.data().json) || "[]")); } catch { setListe([]); } }, () => setListe([])), []);
  return liste;
}
function useImages(id) {
  const [img, setImg] = useState({});
  const [menu, setMenu] = useState([]);
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "vitrineImg_" + id), (s) => setImg(s.exists() ? s.data() : {}), () => setImg({})) : undefined), [id]);
  // le menu a son propre document (taille maximale d'un document Firebase : 1 Mo)
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "vitrineMenu_" + id), (s) => setMenu(s.exists() ? s.data().pages || [] : []), () => setMenu([])) : undefined), [id]);
  return { ...img, menu };
}

function FicheResto({ r }) {
  const img = useImages(r.id);
  const [ouvert, setOuvert] = useState(false);
  const msg = `Bonjour ${r.nom}, je souhaite commander en livraison (vu sur le site Rebecca Services).\nMa commande : \nMon adresse : `;
  return (
    <article className="pp-bloc" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {img.logo ? <img src={img.logo} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} /> : <span style={{ fontSize: 40 }}>{r.icone || "🍽️"}</span>}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{r.nom}</h3>
          <small>{[r.cuisine, r.cacherout].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
      {(img.photos || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0" }}>
          {img.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 120, borderRadius: 10 }} />)}
        </div>
      )}
      {r.description && <p>{r.description}</p>}
      {r.specialites && <p><b>Spécialités :</b> {r.specialites}</p>}
      {r.horaires && <p>🕒 {r.horaires}</p>}
      {r.zone && <p>🛵 Livraison : {r.zone}</p>}
      {r.adresse && <p>📍 {r.adresse}</p>}
      <div className="tb-actions">
        {r.whatsapp && <a className="pp-bouton" href={`https://wa.me/${nettoie(r.whatsapp)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">💬 Commander</a>}
        {r.telephone && <a className="bouton-secondaire" href={`tel:${r.telephone}`}>📞 Appeler</a>}
        {r.menu && <a className="bouton-secondaire" href={r.menu} target="_blank" rel="noopener noreferrer">📋 Menu (PDF)</a>}
        {(img.menu || []).length > 0 && <button type="button" className="bouton-secondaire" onClick={() => setOuvert(!ouvert)}>📋 {ouvert ? "Fermer le menu" : "Voir le menu"}</button>}
      </div>
      {ouvert && (img.menu || []).map((p, i) => <img key={i} src={p} alt={`Menu page ${i + 1}`} style={{ width: "100%", marginTop: 8, borderRadius: 8 }} />)}
    </article>
  );
}

export default function RestosVitrine({ onAccueil }) {
  const liste = useVitrineRestos();
  const visibles = (liste || []).filter((r) => r.visible !== false);
  return (
    <section>
      <div className="pp-bloc">
        <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>
        <h2>🍽️ Nos restaurants partenaires</h2>
        <p>Commandez directement au restaurant : <b>c'est Rebecca Services qui vous livre</b>, avec soin, à Netanya et alentours.</p>
        {!liste && <p className="tb-note">Chargement…</p>}
        {liste && !visibles.length && <p className="tb-note">Bientôt ici : les restaurants partenaires.</p>}
      </div>
      {visibles.map((r) => <FicheResto key={r.id} r={r} />)}
      <p className="tb-note" style={{ padding: "0 16px" }}>Vous payez votre repas au restaurant ; les frais de livraison sont indiqués par le restaurant.</p>
    </section>
  );
}

// Espace de Rebecca : qui apparaît sur le site, avec sa fiche complète
export function VitrineRestosAdmin() {
  const liste = useVitrineRestos();
  const [info, setInfo] = useState("");
  const [f, setF] = useState(null);
  const img = useImages(f && f.id);
  const [imgs, setImgs] = useState(null);
  useEffect(() => setImgs(null), [f && f.id]);
  const vues = imgs || { logo: img.logo || "", photos: img.photos || [], menu: img.menu || [] };
  if (!liste) return <p className="tb-note">Chargement…</p>;
  const sauver = async (l) => { try { await setDoc(doc(db, "reglages", "vitrineRestos"), { json: JSON.stringify(l.slice(0, 50)), majLe: serverTimestamp() }); setInfo("✓ Enregistré : visible sur rebeccaservices.com/#/restaurants"); } catch { setInfo("Enregistrement impossible."); } };
  const champ = (k, label, ph = "") => <label className="champ">{label}<input value={f[k] || ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  const ajouterPhoto = async (cle, fichiers, max) => {
    try {
      const nouv = [];
      for (const x of [...fichiers].slice(0, max)) nouv.push(await reduirePhoto(x, { cote: 1000, maxOctets: 180000 }));
      setImgs({ ...vues, [cle]: cle === "logo" ? nouv[0] : [...vues[cle], ...nouv].slice(0, max) });
    } catch (e) { setInfo(e.message || "Photo impossible."); }
  };
  const enregistrer = async () => {
    const l = liste.some((x) => x.id === f.id) ? liste.map((x) => (x.id === f.id ? f : x)) : [...liste, f];
    await sauver(l);
    if (imgs) {
      try {
        await setDoc(doc(db, "reglages", "vitrineImg_" + f.id), { logo: imgs.logo || "", photos: imgs.photos || [], majLe: serverTimestamp() });
        await setDoc(doc(db, "reglages", "vitrineMenu_" + f.id), { pages: imgs.menu || [], majLe: serverTimestamp() });
      }
      catch { setInfo("Textes enregistrés, mais les photos sont trop lourdes : enlève une photo et réessaie."); return; }
    }
    setF(null);
  };
  const vignettes = (cle) => (vues[cle] || []).map((p, i) => (
    <span key={i} style={{ position: "relative", display: "inline-block", marginRight: 6 }}>
      <img src={p} alt="" style={{ height: 60, borderRadius: 6 }} />
      <button type="button" aria-label="Retirer" onClick={() => setImgs({ ...vues, [cle]: vues[cle].filter((_, j) => j !== i) })} style={{ position: "absolute", top: -6, right: -6 }}>✕</button>
    </span>
  ));
  return (
    <div className="tb-bloc">
      <h3>🍽️ Restaurants visibles sur le site</h3>
      <p className="tb-note">Page publique : rebeccaservices.com/#/restaurants. Le client commande au restaurant ; tu livres. Mets seulement les restaurants qui ont dit oui.</p>
      {liste.map((r) => (
        <div key={r.id} className="tb-actions" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>{r.visible === false ? "⚪" : "🟢"} <b>{r.nom}</b></span>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setF(r)}>Modifier</button>
          <button type="button" className="tb-bouton tb-clair" onClick={() => sauver(liste.map((x) => (x.id === r.id ? { ...x, visible: x.visible === false } : x)))}>{r.visible === false ? "Afficher" : "Cacher"}</button>
          <button type="button" className="tb-bouton ag-danger" onClick={() => { if (!window.confirm(`Retirer ${r.nom} du site ?`)) return; sauver(liste.filter((x) => x.id !== r.id)); deleteDoc(doc(db, "reglages", "vitrineImg_" + r.id)).catch(() => {}); deleteDoc(doc(db, "reglages", "vitrineMenu_" + r.id)).catch(() => {}); }}>🗑️</button>
        </div>
      ))}
      {!f && <button type="button" className="tb-bouton" onClick={() => setF({ id: "r" + Date.now().toString(36), visible: true })}>＋ Ajouter un restaurant</button>}
      {f && (
        <div>
          {champ("nom", "Nom du restaurant")}
          <label className="champ">Logo <input type="file" accept="image/*" onChange={(e) => ajouterPhoto("logo", e.target.files, 1)} /></label>
          {vues.logo && <img src={vues.logo} alt="" style={{ height: 60, borderRadius: 8 }} />}
          <label className="champ">Photos (3 au plus) <input type="file" accept="image/*" multiple onChange={(e) => ajouterPhoto("photos", e.target.files, 3)} /></label>
          <div>{vignettes("photos")}</div>
          {champ("description", "Présentation")}{champ("specialites", "Spécialités", "Sushi, poké, plateaux…")}{champ("cuisine", "Type de cuisine", "Japonais")}
          {champ("cacherout", "Cacherout (si applicable)", "Cacher – Rabbanout Netanya")}{champ("horaires", "Horaires", "Dim-jeu 11h-22h, vendredi 11h-14h")}
          {champ("zone", "Zone de livraison", "Netanya et alentours")}{champ("menu", "Menu PDF (lien, facultatif)", "https://…")}
          <label className="champ">Ou photos du menu (4 pages au plus) <input type="file" accept="image/*" multiple onChange={(e) => ajouterPhoto("menu", e.target.files, 4)} /></label>
          <div>{vignettes("menu")}</div>
          {champ("telephone", "Téléphone")}{champ("whatsapp", "WhatsApp (commandes)", "05…")}{champ("adresse", "Adresse")}{champ("icone", "Emoji (si pas de logo)", "🍣")}
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!String(f.nom || "").trim()} onClick={enregistrer}>Enregistrer</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setF(null)}>Fermer</button>
          </div>
        </div>
      )}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
