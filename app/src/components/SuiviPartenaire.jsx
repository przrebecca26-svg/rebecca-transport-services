import { useEffect, useState } from "react";
import { idDocument, libelleCandidature } from "../pricing/partenaires.js";
import { PhotoDocument } from "./DevenirPartenaire.jsx";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// SUIVI D'UNE CANDIDATURE DE COURSIER (18 nov. 2026) - lien #/partenaire/ID envoyé au coursier.
// Il voit où en est sa candidature ; si Rebecca demande un complément, il renvoie les photos demandées ici.
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

const TEXTES = {
  soumis: "Votre candidature est bien arrivée. Rebecca la vérifie.",
  en_verification: "Rebecca vérifie votre candidature et vos documents.",
  complement_demande: "Rebecca a besoin d'un complément :",
  approuve: "Votre candidature est approuvée ! Rebecca vous envoie l'accès à votre espace coursier.",
  refuse: "Votre candidature n'a pas été retenue pour l'instant.",
  suspendu: "Votre compte de coursier est suspendu. Contactez Rebecca.",
};

export default function SuiviPartenaire({ id, onAccueil }) {
  const [s, setS] = useState(undefined);
  const [photos, setPhotos] = useState({});
  const [etat, setEtat] = useState({ enCours: false, erreur: "", ok: false });
  useEffect(() => {
    let arret = () => {};
    charger()
      .then(([{ db }, { doc, onSnapshot }]) => {
        arret = onSnapshot(doc(db, "suiviPartenaires", id), (x) => setS(x.exists() ? x.data() : null), () => setS(null));
      })
      .catch(() => setS(null));
    return () => arret();
  }, [id]);

  if (s === undefined) return <p className="aide" style={{ padding: 20 }}>Chargement…</p>;
  if (s === null)
    return (
      <div className="bloc" style={{ maxWidth: 560, margin: "24px auto", padding: 20 }}>
        <p>Ce lien ne correspond à aucune candidature.</p>
        <button type="button" className="lien" onClick={onAccueil}>Voir le site</button>
      </div>
    );

  const demandes = s.statut === "complement_demande" ? s.documentsDemandes || [] : [];
  const manque = demandes.filter((d) => !photos[d.id]);
  const renvoyer = async () => {
    if (manque.length || etat.enCours) return;
    setEtat({ enCours: true, erreur: "", ok: false });
    try {
      const [{ db }, { doc, serverTimestamp, setDoc, updateDoc }] = await charger();
      for (const d of demandes) {
        await setDoc(doc(db, "documentsPartenaires", idDocument(id, d.id)), { candidature: id, type: d.id, image: photos[d.id], creeLe: serverTimestamp() });
      }
      await updateDoc(doc(db, "suiviPartenaires", id), { statut: "soumis", renvoyeLe: serverTimestamp() });
      setPhotos({});
      setEtat({ enCours: false, erreur: "", ok: true });
    } catch {
      setEtat({ enCours: false, erreur: "L'envoi n'a pas marché. Vérifiez la connexion puis réessayez.", ok: false });
    }
  };

  return (
    <div className="bloc" style={{ maxWidth: 560, margin: "24px auto", padding: 20 }}>
      <h2>Bonjour {s.prenom} 😊</h2>
      <p><strong>Votre candidature : {libelleCandidature(s.statut)}</strong></p>
      <p>{TEXTES[s.statut] || ""}</p>
      {s.motif && s.statut !== "soumis" && <p className="aide" style={{ whiteSpace: "pre-line" }}>{s.motif}</p>}
      {etat.ok && <p>Merci, c'est envoyé ✅ Rebecca vérifie vos nouveaux documents.</p>}
      {demandes.length > 0 && (
        <>
          <h3>Documents à envoyer</h3>
          {demandes.map((d) => <PhotoDocument key={d.id} label={d.label} valeur={photos[d.id]} onChange={(img) => setPhotos((p) => ({ ...p, [d.id]: img }))} />)}
          {etat.erreur && <p className="erreur" role="alert">{etat.erreur}</p>}
          <button type="button" className="bouton" disabled={etat.enCours || manque.length > 0} onClick={renvoyer}>{etat.enCours ? "Envoi…" : "Envoyer à Rebecca"}</button>
        </>
      )}
      <a className="bouton" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${s.prenom} (candidature coursier).`)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 12 }}>Écrire à Rebecca sur WhatsApp</a>
      <button type="button" className="lien" onClick={onAccueil} style={{ marginTop: 10 }}>Voir le site</button>
    </div>
  );
}
