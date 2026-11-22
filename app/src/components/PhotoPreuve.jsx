import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { reduirePhoto } from "../photoReduite.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { numeroLivraison } from "../pricing/restos.js";

// 📷 PHOTO DE PREUVE (22 nov. 2026, Rebecca) : à la livraison d'une commande de restaurant, une photo (porte, sac
// remis) gardée dans la livraison et envoyée au restaurant (partage du téléphone : WhatsApp, avec la photo).
const versFichier = async (dataUrl, nom) => {
  const r = await fetch(dataUrl);
  const b = await r.blob();
  return new File([b], nom, { type: b.type || "image/jpeg" });
};
export default function PhotoPreuve({ d, telResto = "" }) {
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const photo = d.photoPreuve || "";
  const texte = `Bonjour ${d.nom || ""}, c'est Rebecca Services 🛵 Commande ${numeroLivraison(d)}${d.details && d.details.destinataire ? " de " + d.details.destinataire : ""} livrée ✓. Voici la photo de la livraison.`;
  const prendre = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setEnCours(true);
    setInfo("");
    try {
      const data = await reduirePhoto(f, { cote: 1000, qualite: 0.7, maxOctets: 300000 });
      await updateDoc(doc(db, "demandes", d.id), { photoPreuve: data, majLe: serverTimestamp() });
      setInfo("✓ Photo gardée avec la livraison.");
    } catch (x) {
      setInfo((x && x.message) || "Photo impossible.");
    }
    setEnCours(false);
  };
  const partager = async () => {
    try {
      const fichier = await versFichier(photo, `livraison-${numeroLivraison(d).replace(/[^A-Za-z0-9]/g, "")}.jpg`);
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], text: texte });
        return;
      }
    } catch (x) {
      if (x && x.name === "AbortError") return;
    }
    // Pas de partage de photo possible ici : on ouvre WhatsApp avec le texte (la photo s'ajoute à la main)
    if (telResto) window.open(lienWhatsApp(telResto, texte), "_blank");
    else setInfo("Partage de photo impossible sur ce navigateur.");
  };
  return (
    <div className="tb-actions" style={{ alignItems: "center" }}>
      <label className="tb-bouton tb-clair" style={{ cursor: "pointer" }}>
        📷 {photo ? "Refaire la photo" : "Photo de preuve"}
        <input type="file" accept="image/*" capture="environment" onChange={prendre} disabled={enCours} style={{ display: "none" }} />
      </label>
      {photo && <img src={photo} alt="Photo de la livraison" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />}
      {photo && <button type="button" className="tb-bouton tb-clair" onClick={partager}>📤 Envoyer la photo au restaurant</button>}
      {enCours && <small className="tb-note">Photo…</small>}
      {info && <small className="tb-note">{info}</small>}
    </div>
  );
}
