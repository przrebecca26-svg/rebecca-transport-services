import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { validerMouvement } from "./pricing/comptes.js";
import { champOperateur } from "./pricing/reverser.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import { synchroniserSuivi } from "./suiviClient.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours } from "./pricing/calendrier.js";
import {
  ETAPES_CHRONO, bilanTrajet, champsAnnulerEtape, champsEtape, chronoDe, encaisseDe, faitDe, messageMerci,
  messageRappelRetour, peutCocher, preparerEncaissement, prixDe, prochaineEtape, texteMinutes, trajetDe,
} from "./pricing/finCourse.js";

// Fin d'une course directement depuis l'agenda (17 nov. 2026) :
// 📍 Récupérée → ✓ Déposée (= course faite) → 🏠 Rentrée, chacun avec l'heure ;
// 💰 Encaissé : saisie du paiement et du pourboire ; puis le merci WhatsApp deja ecrit selon le cas ;
// rappel de la veille pour le retour d'un aller-retour ; temps passe et ₪ par heure (Rebecca seulement).

const heureIsrael = () => new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
const NOM_TRAJET = { aller: "Aller", retour: "Retour", simple: "" };

export default function FinCourseAgenda({ d, aujourdhui }) {
  const { moi } = useEquipeContexte();
  const [mouvements, setMouvements] = useState([]);
  const [caisse, setCaisse] = useState(null); // formulaire « Encaissé » : { recu, pourboire, moyen }
  const [merci, setMerci] = useState(false); // propose le message apres le paiement
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const visible = peutCocher(d, aujourdhui);

  useEffect(() => {
    if (!visible) return undefined;
    return onSnapshot(query(collection(db, "mouvements"), where("resId", "==", d.id)), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [d.id, visible]);

  const trajet = trajetDe(d);
  const v = d.details || {};
  const reste = Math.max(0, Math.round((prixDe(d) - encaisseDe(mouvements, d.id)) * 100) / 100);
  // Rappel de la veille : sur le retour d'un aller-retour, la veille ou le jour meme, tant qu'il n'est pas fait
  const rappel = trajet === "retour" && !faitDe(d) && (d.date === ajouterJours(aujourdhui, 1) || d.date === aujourdhui) ? lienWhatsApp(d.telephone, messageRappelRetour(d, reste)) : null;
  if (!visible) return rappel ? <div className="tb-actions"><a className="tb-bouton tb-clair" href={rappel} target="_blank" rel="noopener noreferrer">🔔 Rappel de la veille</a></div> : null;

  const c = chronoDe(d);
  const suivante = prochaineEtape(d);
  const fait = faitDe(d);
  const bilan = bilanTrajet(d);
  const lienMerci = lienWhatsApp(d.telephone, messageMerci(d, reste));

  const enregistrer = async (champs) => {
    if (!champs) return;
    setErreur("");
    setEnCours(true);
    try {
      await updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() });
      synchroniserSuivi({ ...d, ...champs });
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  const cocher = (etape) => enregistrer(champsEtape(d, etape, heureIsrael(), moi));
  const annuler = () => enregistrer(champsAnnulerEtape(d));

  const ouvrirCaisse = () => {
    setMerci(false);
    setErreur("");
    setCaisse(caisse ? null : { recu: reste > 0 ? String(reste) : "", pourboire: "", moyen: TARIFS.moyensPaiement[0] });
  };
  const encaisser = async () => {
    const r = preparerEncaissement(d, caisse, aujourdhui);
    if (r.erreur) return setErreur(r.erreur);
    const paiement = r.paiement ? { ...r.paiement, ...champOperateur(moi) } : null;
    const err = paiement ? validerMouvement(paiement) : "";
    if (err) return setErreur(err);
    setErreur("");
    setEnCours(true);
    try {
      if (paiement) await addDoc(collection(db, "mouvements"), { ...paiement, creeLe: serverTimestamp() });
      if (Object.keys(r.champs).length) await updateDoc(doc(db, "demandes", d.id), { ...r.champs, majLe: serverTimestamp() });
      if (paiement) synchroniserSuivi(d, [...mouvements, paiement]);
      setCaisse(null);
      setMerci(true);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  return (
    <div className="ag-fin">
      <div className="ag-fin-chrono">
        {NOM_TRAJET[trajet] && <small className="ag-fin-trajet">{NOM_TRAJET[trajet]}</small>}
        {ETAPES_CHRONO.map((e) => c[e.id] ? <span key={e.id} className="ag-fin-etape oui">{e.libelle} {c[e.id].replace(":", "h")}</span> : null)}
        {fait && !c.depose && <span className="ag-fin-etape oui">Faite{fait !== "oui" ? " " + fait.replace(":", "h") : ""}</span>}
      </div>
      <div className="tb-actions">
        {suivante && <button type="button" className="tb-bouton" disabled={enCours} onClick={() => cocher(suivante)}>{ETAPES_CHRONO.find((e) => e.id === suivante).bouton}</button>}
        {(c.prise || fait) && <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={ouvrirCaisse}>{caisse ? "Fermer" : reste > 0 ? `💰 Encaissé (reste ${reste} ₪)` : "💰 Encaissé ✓"}</button>}
        {(c.prise || fait) && <button type="button" className="ag-modifier" disabled={enCours} onClick={annuler}>Annuler la dernière étape</button>}
      </div>
      {trajet === "aller" && v.dateRetour && <p className="tb-note">Retour prévu le {v.dateRetour.split("-").reverse().join("/")}{v.heureRetour ? ` à ${v.heureRetour.replace(":", "h")}` : ""}.</p>}
      {caisse && (
        <div className="ag-etape-actions">
          <p className="tb-note">Prix {trajet === "simple" ? "de la course" : "de l'aller-retour"} : {prixDe(d)} ₪ · déjà encaissé : {encaisseDe(mouvements, d.id)} ₪ · reste : {reste} ₪</p>
          <label className="ag-champ">Reçu pour la course (₪)<input type="text" inputMode="decimal" value={caisse.recu} onChange={(x) => setCaisse({ ...caisse, recu: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="ag-champ">Pourboire (₪, à part)<input type="text" inputMode="decimal" value={caisse.pourboire} onChange={(x) => setCaisse({ ...caisse, pourboire: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="ag-champ">Moyen de paiement
            <select value={caisse.moyen} onChange={(x) => setCaisse({ ...caisse, moyen: x.target.value })}>
              {TARIFS.moyensPaiement.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours} onClick={encaisser}>{enCours ? "Enregistrement…" : "Valider le paiement"}</button>
          </div>
        </div>
      )}
      {(merci || (fait && reste === 0 && !caisse)) && lienMerci && (
        <div className="tb-actions">
          <a className="tb-bouton" href={lienMerci} target="_blank" rel="noopener noreferrer" onClick={() => setMerci(false)}>💬 Envoyer le merci (WhatsApp)</a>
        </div>
      )}
      {rappel && <div className="tb-actions"><a className="tb-bouton tb-clair" href={rappel} target="_blank" rel="noopener noreferrer">🔔 Rappel de la veille</a></div>}
      {moi === ADMIN_ID && bilan.total != null && (
        <p className="ag-fin-bilan">⏱ {bilan.course != null ? `Course ${texteMinutes(bilan.course)}` : ""}{bilan.retourMaison != null ? ` · retour maison ${texteMinutes(bilan.retourMaison)}` : ""} · total {texteMinutes(bilan.total)}{bilan.parHeure ? ` · ${bilan.prix} ₪ → ≈ ${bilan.parHeure} ₪/h` : ""}</p>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}
