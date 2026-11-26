import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { reduirePhoto } from "../photoReduite.js";
import { erreursPanier, lireCarte, messagePanier, totalPanier } from "../pricing/carteResto.js";

// RESTAURANTS SUR LE SITE (25 nov. 2026) - #/restaurants
// Fiche complète (décision de Rebecca) : logo, photos, présentation, spécialités, cacherout, horaires, menu (lien PDF
// ou photos), téléphone, WhatsApp, zone de livraison. Le client commande AU RESTAURANT (WhatsApp ou téléphone) et paie
// son repas au restaurant ; c'est Rebecca Services qui livre. Jamais d'argent des repas chez Rebecca.
// Documents publics (règles v36 déjà en place : reglages lisibles par tous, écrits par Rebecca seule) :
//  - reglages/vitrineRestos : la liste (textes) ; - reglages/vitrineImg_ID : logo, photos et photos du menu.
const nettoie = (t) => String(t || "").replace(/\D/g, "").replace(/^0/, "972");
export { useVitrineRestos } from "../vitrineRestosBase.js";
import { useVitrineRestos } from "../vitrineRestosBase.js";
function useImages(id) {
  const [img, setImg] = useState({});
  const [menu, setMenu] = useState([]);
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "vitrineImg_" + id), (s) => setImg(s.exists() ? s.data() : {}), () => setImg({})) : undefined), [id]);
  // le menu a son propre document (taille maximale d'un document Firebase : 1 Mo)
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "vitrineMenu_" + id), (s) => setMenu(s.exists() ? s.data().pages || [] : []), () => setMenu([])) : undefined), [id]);
  // 26 nov. 2026 : la carte en ligne (texte, une ligne par plat) a aussi son document
  const [carte, setCarte] = useState("");
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "vitrineCarte_" + id), (s) => setCarte(s.exists() ? String(s.data().texte || "") : ""), () => setCarte("")) : undefined), [id]);
  return { ...img, menu, carteTexte: carte };
}

// 26 nov. 2026 : menu et panier en ligne. La commande part au restaurant par WhatsApp ; le client paie son repas
// au restaurant et Rebecca Services livre. Rien n'est enregistré en base (règles Firebase inchangées).
function Panier({ r, carte, onFermer }) {
  const [panier, setPanier] = useState({});
  const [client, setClient] = useState({ nom: "", telephone: "", adresse: "", note: "" });
  const [erreurs, setErreurs] = useState({});
  const t = totalPanier(carte, panier);
  const plus = (id, n) => setPanier((x) => ({ ...x, [id]: Math.max(0, Math.min(20, (x[id] || 0) + n)) }));
  const envoyer = () => {
    const e = erreursPanier(t, client);
    setErreurs(e);
    if (Object.keys(e).length) return;
    window.open(`https://wa.me/${nettoie(r.whatsapp)}?text=${encodeURIComponent(messagePanier(r, t, client))}`, "_blank", "noopener");
  };
  const champ = (k, label, type = "text") => (
    <label className="champ">{label}
      <input type={type} value={client[k]} onChange={(e) => setClient({ ...client, [k]: e.target.value })} />
      {erreurs[k] && <span className="erreur">{erreurs[k]}</span>}
    </label>
  );
  return (
    <div style={{ marginTop: 10 }}>
      {carte.map((c) => (
        <div key={c.nom} style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "8px 0 4px" }}>{c.nom}</h4>
          {c.plats.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", opacity: p.epuise ? 0.5 : 1 }}>
              <span style={{ flex: 1 }}><b>{p.nom}</b>{p.description ? <><br /><small>{p.description}</small></> : null}</span>
              <span style={{ whiteSpace: "nowrap" }}>{String(p.prix).replace(".", ",")} ₪</span>
              {!p.epuise && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button type="button" className="bouton-secondaire" aria-label={`Retirer ${p.nom}`} onClick={() => plus(p.id, -1)} style={{ minWidth: 34 }}>−</button>
                  <span style={{ minWidth: 18, textAlign: "center" }}>{panier[p.id] || 0}</span>
                  <button type="button" className="bouton-secondaire" aria-label={`Ajouter ${p.nom}`} onClick={() => plus(p.id, 1)} style={{ minWidth: 34 }}>+</button>
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      <p><b>🛒 {t.articles} article{t.articles > 1 ? "s" : ""} · {String(t.total).replace(".", ",")} ₪</b> <small>(payé au restaurant ; frais de livraison indiqués par le restaurant)</small></p>
      {erreurs.panier && <p className="erreur">{erreurs.panier}</p>}
      {champ("nom", "Votre nom")}{champ("telephone", "Votre téléphone", "tel")}{champ("adresse", "Adresse de livraison")}{champ("note", "Note (facultatif)")}
      <div className="tb-actions">
        <button type="button" className="pp-bouton" onClick={envoyer}>💬 Envoyer ma commande au restaurant</button>
        <button type="button" className="bouton-secondaire" onClick={onFermer}>Fermer</button>
      </div>
    </div>
  );
}

function FicheResto({ r }) {
  const img = useImages(r.id);
  const [ouvert, setOuvert] = useState(false);
  const [commande, setCommande] = useState(false);
  const carte = lireCarte(img.carteTexte);
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
        {r.whatsapp && carte.length > 0 && <button type="button" className="pp-bouton" onClick={() => setCommande(!commande)}>🛒 {commande ? "Fermer la commande" : "Commander en ligne"}</button>}
        {r.whatsapp && <a className={carte.length ? "bouton-secondaire" : "pp-bouton"} href={`https://wa.me/${nettoie(r.whatsapp)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">💬 {carte.length ? "WhatsApp" : "Commander"}</a>}
        {r.telephone && <a className="bouton-secondaire" href={`tel:${r.telephone}`}>📞 Appeler</a>}
        {r.menu && <a className="bouton-secondaire" href={r.menu} target="_blank" rel="noopener noreferrer">📋 Menu (PDF)</a>}
        {(img.menu || []).length > 0 && <button type="button" className="bouton-secondaire" onClick={() => setOuvert(!ouvert)}>📋 {ouvert ? "Fermer le menu" : "Voir le menu"}</button>}
      </div>
      {commande && <Panier r={r} carte={carte} onFermer={() => setCommande(false)} />}
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
  const [carteTexte, setCarteTexte] = useState(null);
  useEffect(() => setCarteTexte(null), [f && f.id]);
  const texteCarte = carteTexte != null ? carteTexte : img.carteTexte || "";
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
    if (carteTexte != null) {
      try { await setDoc(doc(db, "reglages", "vitrineCarte_" + f.id), { texte: carteTexte.slice(0, 20000), majLe: serverTimestamp() }); }
      catch { setInfo("Textes enregistrés, mais la carte n'a pas pu l'être : réessaie."); return; }
    }
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
          <label className="champ">🛒 Carte en ligne (panier) : une ligne par plat « Nom ; prix ; description », une catégorie avec « # »
            <textarea rows={8} value={texteCarte} placeholder={"# Sushis\nCalifornia saumon ; 42 ; 8 pièces\nPoké thon ; 58\n# Boissons\nCoca ; 10"} onChange={(e) => setCarteTexte(e.target.value)} />
          </label>
          {texteCarte.trim() && <p className="tb-note">Aperçu : {lireCarte(texteCarte).map((c) => `${c.nom} (${c.plats.length})`).join(" · ") || "aucune ligne lisible (vérifie « Nom ; prix »)"}. Mets « épuisé » dans la description pour bloquer un plat.</p>}
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
