import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import SignatureDoigt from "./SignatureDoigt.jsx";
import ChoixJoursHeures from "./ChoixJoursHeures.jsx";
import { EMAIL_REBECCA, FORMULES_RESTO, libelleFormuleResto, tarifsStandard } from "../pricing/contratResto.js";
import { avecCreneaux } from "../pricing/commercants.js";
import { MIN_HEURES } from "../pricing/creneauxResto.js";
import { avenantPropre, erreursAvenant, texteDemandeAvenant } from "../pricing/avenantResto.js";
import { envoyerEmailA } from "../mailClient.js";

// MA FORMULE (espace du restaurant, 20 nov. 2026, Rebecca) : le restaurant peut passer de A à A + B, ajouter
// ou changer ses créneaux B, ou revenir en A. Il signe au doigt ; Rebecca reçoit une notification et un e-mail,
// accepte ou refuse dans Partenaires ; à l'acceptation, l'avenant part par e-mail aux deux (règles v32).
const ETATS = { demandee: "⏳ En attente de la réponse de Rebecca", acceptee: "✓ Acceptée", refusee: "✗ Refusée" };
const jourFr = (t) => (t && t.toDate ? t.toDate().toLocaleDateString("fr-FR", { timeZone: "Asia/Jerusalem" }) : "");

export default function FormuleResto({ cle, resto }) {
  const actuel = { formule: resto.formule || "A", creneaux: resto.creneaux || "" };
  const [demande, setDemande] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ formule: actuel.formule === "A" ? "AB" : actuel.formule, creneaux: actuel.creneaux, signataire: "" });
  const [signature, setSignature] = useState("");
  const [tarifs, setTarifs] = useState(tarifsStandard(null));
  const [erreurs, setErreurs] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => onSnapshot(doc(db, "avenantsResto", cle), (s) => setDemande(s.exists() ? s.data() : null), () => setDemande(null)), [cle]);
  useEffect(() => {
    getDoc(doc(db, "reglages", "restos")).then((s) => s.exists() && setTarifs(tarifsStandard(s.data()))).catch(() => {});
  }, []);
  const maj = (k, v) => setF({ ...f, [k]: v });

  const envoyer = async () => {
    const e = erreursAvenant(f, signature, actuel);
    setErreurs(e);
    if (e.length) return;
    setEnvoi(true);
    const av = avenantPropre(f, signature, actuel, resto.nom);
    try {
      await setDoc(doc(db, "avenantsResto", cle), { ...av, creeLe: serverTimestamp() });
      fetch("/.netlify/functions/contrat-resto", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avenant: cle }) }).catch(() => {});
      envoyerEmailA(EMAIL_REBECCA, "Rebecca", `Changement de formule demandé - ${av.nom}`, texteDemandeAvenant(av)).catch(() => {});
      setOuvert(false);
      setSignature("");
      setInfo("✓ Demande envoyée. Rebecca vous répond vite ; l'avenant à votre contrat vous sera envoyé par e-mail.");
    } catch {
      setInfo("Envoi impossible : vérifiez la connexion, ou écrivez à Rebecca sur WhatsApp.");
    }
    setEnvoi(false);
  };

  return (
    <details style={{ marginTop: 6 }}>
      <summary className="tb-note">📄 Ma formule : {libelleFormuleResto(actuel.formule)}{demande && demande.statut === "demandee" ? " · changement en attente" : ""}</summary>
      {avecCreneaux(actuel.formule) && <p className="tb-note">Vos créneaux réservés : <strong>{actuel.creneaux}</strong></p>}
      {demande && (
        <p className="tb-note">
          Dernière demande : formule {libelleFormuleResto(demande.formule)}{demande.creneaux ? ` (${demande.creneaux})` : ""} · <strong>{ETATS[demande.statut] || demande.statut}</strong>
          {demande.reponduLe ? ` le ${jourFr(demande.reponduLe)}` : ""}{demande.motif ? ` · ${demande.motif}` : ""}
        </p>
      )}
      {info && <p className="tb-note" role="status">{info}</p>}
      {!ouvert ? (
        <button type="button" className="bouton-secondaire" disabled={!!demande && demande.statut === "demandee"} onClick={() => { setOuvert(true); setInfo(""); }}>
          {demande && demande.statut === "demandee" ? "Demande en attente" : "Changer de formule ou de créneaux"}
        </button>
      ) : (
        <div className="carte-service" style={{ marginTop: 8 }}>
          <strong>Nouvelle formule</strong>
          {FORMULES_RESTO.map((x) => (
            <label key={x.v} style={{ display: "block", marginTop: 6 }}>
              <input type="radio" name="formule-resto" checked={f.formule === x.v} onChange={() => maj("formule", x.v)} /> <b>{x.titre}</b>
              <br /><small>{x.v === "A" ? `${tarifs.A.jusqua3} ₪ jusqu'à 3 km · ${tarifs.A.de3a6} ₪ de 3 à 6 km · sans minimum` : x.v === "B" ? `Pendant vos créneaux : ${tarifs.B.jusqua3} ₪ jusqu'à 3 km · minimum ${tarifs.B.parHeure} ₪ par heure (${MIN_HEURES} h au moins) · hors créneaux : prix A` : `Vos créneaux au prix B (${tarifs.B.jusqua3} ₪ jusqu'à 3 km) · le reste au prix A (${tarifs.A.jusqua3} ₪ jusqu'à 3 km)`}</small>
            </label>
          ))}
          {avecCreneaux(f.formule) && (
            <div style={{ marginTop: 8 }}>Vos créneaux réservés (2 h au moins)
              <ChoixJoursHeures valeur={f.creneaux} onChange={(v) => maj("creneaux", v)} minHeures={2} classe="" />
            </div>
          )}
          <p className="tb-note">Vos prix actuels restent ceux de votre contrat ; les nouveaux prix s'appliquent dès que Rebecca accepte. Un créneau réservé annulé moins de 24 h avant reste dû au minimum.</p>
          <label style={{ display: "block" }}>Nom de la personne qui signe<br /><input value={f.signataire} maxLength={60} onChange={(e) => maj("signataire", e.target.value)} /></label>
          <p className="tb-note">Signez avec le doigt :</p>
          <SignatureDoigt valeur={signature} onChange={setSignature} />
          {erreurs.length > 0 && <ul className="erreur" role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>}
          <p>
            <button type="button" disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Envoyer ma demande signée"}</button>{" "}
            <button type="button" className="bouton-secondaire" onClick={() => setOuvert(false)}>Annuler</button>
          </p>
        </div>
      )}
    </details>
  );
}
