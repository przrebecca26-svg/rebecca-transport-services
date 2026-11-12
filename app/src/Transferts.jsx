import { useEffect, useState } from "react";
import { arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes } from "./accesDemandes.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { accepterProposition, annulerProposition, effacerRefus, nombreATraiter, nomDe, refuserProposition, transfertsPour } from "./pricing/quiFait.js";
import { useEquipeContexte } from "./equipeContexte.jsx";

// RUBRIQUE « A ACCEPTER » (12 nov. 2026, 18h40, demande de Rebecca)
// Une course proposee par l'autre attend ici : Accepter (elle passe chez moi) ou Refuser (elle reste chez lui).
// Tant qu'elle n'est pas acceptee, elle reste chez celui qui l'a proposee.

// Nombre de choses a traiter (courses proposees + refus a voir) : compteur du menu et bandeau
export function useTransfertsATraiter(actif, moi) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!actif) return undefined;
    return onSnapshot(refDemandes(), (s) => setN(nombreATraiter(s.docs.map((x) => ({ id: x.id, ...x.data() })), moi)), () => setN(0));
  }, [actif, moi]);
  return actif ? n : 0;
}

const jour = (d) => String(d.date || "").split("-").reverse().join("/");
const depart = (d) => {
  const a = [d.details && d.details.depart, d.details && d.details.recuperation, d.details && d.details.adresse].find((x) => x && x.label);
  return a ? a.label : "";
};
const prix = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);

function Carte({ d, children }) {
  return (
    <div className="tb-bloc tr-carte">
      <p className="tr-titre"><strong>{d.serviceTitre || d.service}</strong> · {jour(d)} à {d.heure || "?"}</p>
      <p className="tb-note">
        {d.nom || "Client"}{depart(d) ? ` · Départ : ${depart(d)}` : ""}{prix(d) != null ? ` · ${prix(d)} ₪` : ""}
      </p>
      {children}
    </div>
  );
}

export default function Transferts({ aller }) {
  const { membres, moi } = useEquipeContexte();
  const [demandes, setDemandes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState("");
  useEffect(() => onSnapshot(refDemandes(), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setDemandes([])), []);

  const ecrire = async (d, champs) => {
    setErreur("");
    setEnCours(d.id);
    try {
      await updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() });
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours("");
  };
  const accepter = (d) => {
    const r = accepterProposition(d, moi, Date.now());
    if (r.erreur && !r.maj) return setErreur(r.erreur);
    return ecrire(d, r.trace ? { ...r.maj, historiqueAttribution: arrayUnion(r.trace) } : r.maj);
  };
  const refuser = (d) => {
    const r = refuserProposition(d, moi, Date.now());
    if (r.erreur) return setErreur(r.erreur);
    return ecrire(d, r.maj);
  };

  if (!demandes) return <p className="tb-note">Chargement…</p>;
  const t = transfertsPour(demandes, moi);
  const nom = (id) => nomDe(membres, id || ADMIN_ID);
  const rien = !t.aAccepter.length && !t.refus.length && !t.enAttente.length;

  return (
    <div className="tr-page">
      <p className="tb-note">Une course proposée reste chez la personne qui la propose tant qu'elle n'est pas acceptée.</p>
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
      {rien && <p className="ag-libre">Rien à accepter pour le moment.</p>}

      {t.aAccepter.length > 0 && <h3>On te propose ({t.aAccepter.length})</h3>}
      {t.aAccepter.map((d) => (
        <Carte key={d.id} d={d}>
          <p className="tb-note">Proposée par {nom(d.proposePar)}.</p>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours === d.id} onClick={() => accepter(d)}>Accepter</button>
            <button type="button" className="tb-bouton ag-danger" disabled={enCours === d.id} onClick={() => refuser(d)}>Refuser</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => aller("demandes", d.id)}>Voir la course</button>
          </div>
        </Carte>
      ))}

      {t.refus.length > 0 && <h3>Réponses</h3>}
      {t.refus.map((d) => (
        <Carte key={d.id} d={d}>
          <p className="dm-verif">❌ {nom(d.dernierRefus.par)} a refusé : la course reste chez toi.</p>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours === d.id} onClick={() => ecrire(d, effacerRefus())}>OK, vu</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => aller("demandes", d.id)}>Voir la course</button>
          </div>
        </Carte>
      ))}

      {t.enAttente.length > 0 && <h3>En attente de réponse</h3>}
      {t.enAttente.map((d) => (
        <Carte key={d.id} d={d}>
          <p className="tb-note">Proposée à {nom(d.proposeA)} : elle reste chez toi tant qu'il n'a pas accepté.</p>
          <div className="tb-actions">
            <button type="button" className="tb-bouton tb-clair" disabled={enCours === d.id} onClick={() => ecrire(d, annulerProposition())}>Annuler la proposition</button>
          </div>
        </Carte>
      ))}
    </div>
  );
}
