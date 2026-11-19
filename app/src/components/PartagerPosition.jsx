import { useEffect, useRef, useState } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { aEnvoyer, lienPosition, messagePosition, positionPropre } from "../pricing/positionDirect.js";
import { lienWhatsApp } from "../pricing/navigation.js";

// 📍 PARTAGER MA POSITION (19 nov. 2026, V2) - Rebecca, sur une course du Calendrier.
// Tant que l'écran de l'appli reste ouvert, la position est envoyée (toutes les 20 s ou tous les 30 m).
// Sur iPhone, une page web ne peut pas envoyer sa position écran éteint : garder l'appli ouverte (support voiture).
export default function PartagerPosition({ d }) {
  const [actif, setActif] = useState(false);
  const [info, setInfo] = useState("");
  const veille = useRef(null);
  const dernier = useRef({ p: null, t: 0 });
  const prenom = String(d.nom || "").split(" ")[0];
  const arreter = async () => {
    if (veille.current != null) navigator.geolocation.clearWatch(veille.current);
    veille.current = null;
    setActif(false);
    setInfo("Partage arrêté.");
    await deleteDoc(doc(db, "positions", d.id)).catch(() => {});
  };
  useEffect(() => () => { if (veille.current != null) navigator.geolocation.clearWatch(veille.current); }, []);
  const demarrer = () => {
    if (!navigator.geolocation) return setInfo("Ce téléphone ne donne pas sa position.");
    setInfo("Recherche de ta position…");
    veille.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = positionPropre({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        const maintenant = Date.now();
        if (!aEnvoyer(dernier.current.p, p, maintenant - dernier.current.t)) return;
        dernier.current = { p, t: maintenant };
        setDoc(doc(db, "positions", d.id), { ...p, prenom: "Rebecca", actif: true, majLe: serverTimestamp() })
          .then(() => { setActif(true); setInfo(`Position envoyée à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Garde l'appli ouverte.`); })
          .catch(() => setInfo("Envoi impossible (règles Firebase v28 collées ?)."));
      },
      () => setInfo("Position refusée : autorise la localisation pour l'appli dans Réglages de l'iPhone."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
  };
  const lien = lienPosition(d.id, window.location.origin);
  const wa = lienWhatsApp(d.telephone, messagePosition(prenom, lien));
  return (
    <div className="ag-etape-actions">
      {!actif ? (
        <button type="button" className="tb-bouton tb-clair" onClick={demarrer}>📍 Partager ma position avec {prenom || "la cliente"}</button>
      ) : (
        <>
          {wa && <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer">💬 Envoyer le lien de suivi</a>}
          <button type="button" className="tb-bouton tb-clair" onClick={arreter}>⏹ Arrêter le partage</button>
        </>
      )}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
