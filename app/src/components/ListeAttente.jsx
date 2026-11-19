import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { PLAGES, validerAttente } from "../pricing/listeAttente.js";

// LISTE D'ATTENTE (19 nov. 2026, V2) : sous les créneaux d'une activité beauté.
// La cliente laisse son prénom et son numéro ; Rebecca la prévient si une place se libère.
export default function ListeAttente({ service, date, prestation = "" }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ prenom: "", telephone: "", plage: "journee", note: "" });
  const [etat, setEtat] = useState("");
  const [erreur, setErreur] = useState("");
  if (!date) return null;
  if (etat === "ok") return <p className="tb-note">✓ Vous êtes sur la liste d'attente du {date.split("-").reverse().join("/")}. Rebecca vous écrit sur WhatsApp si une place se libère.</p>;
  if (!ouvert) {
    return (
      <p>
        <button type="button" className="bouton-secondaire" onClick={() => setOuvert(true)}>📋 Le moment voulu est pris ? Liste d'attente</button>
      </p>
    );
  }
  const envoyer = async () => {
    const v = validerAttente({ ...f, service, date, prestation });
    if (v.erreur) return setErreur(v.erreur);
    setErreur("");
    setEtat("envoi");
    try {
      await addDoc(collection(db, "listeAttente"), { ...v.fiche, creeLe: serverTimestamp() });
      setEtat("ok");
    } catch {
      setEtat("");
      setErreur("Envoi impossible. Vérifiez la connexion ou écrivez à Rebecca sur WhatsApp.");
    }
  };
  return (
    <div className="carte-service" style={{ marginTop: 10 }}>
      <strong>Liste d'attente · {date.split("-").reverse().join("/")}</strong>
      <label>Prénom<br /><input value={f.prenom} maxLength={60} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></label>
      <label>Téléphone (WhatsApp)<br /><input inputMode="tel" value={f.telephone} maxLength={20} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></label>
      <label>Moment qui vous arrange<br />
        <select value={f.plage} onChange={(e) => setF({ ...f, plage: e.target.value })}>
          {PLAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label>Précision (facultatif)<br /><input value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex. : après 16h" /></label>
      {erreur && <p className="erreur">{erreur}</p>}
      <p>
        <button type="button" disabled={etat === "envoi"} onClick={envoyer}>{etat === "envoi" ? "Envoi…" : "M'inscrire"}</button>{" "}
        <button type="button" className="bouton-secondaire" onClick={() => setOuvert(false)}>Annuler</button>
      </p>
      <p className="tb-note">Votre prénom et votre numéro servent seulement à vous prévenir. Rebecca les efface quand la date est passée.</p>
    </div>
  );
}
