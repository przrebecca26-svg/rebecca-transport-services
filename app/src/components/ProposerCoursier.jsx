import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { estBloque, messageProposition, missionDepuisDemande, moyenMouvement, soldeCumule, MOYENS } from "../pricing/coursiers.js";
import { encaisseDe, duDe } from "../pricing/finCourse.js";
import { lienWhatsApp } from "../pricing/navigation.js";

// CONFIER UNE COURSE A UN COURSIER PARTENAIRE (18 nov. 2026, étape 3) - dans le détail d'une demande,
// seulement pour les livraisons et les courses, Rebecca seule. Le premier coursier qui accepte la prend.
// Course terminée (photo de preuve) -> « Clôturer » : la demande passe Terminée ; si le client a payé
// par Bit / Revolut / PayPal / carte, le paiement est noté chez Rebecca (elle le reversera au coursier) ;
// en espèces, le coursier a l'argent : rien à encaisser pour Rebecca.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const STATUT = { proposee: "Proposée", acceptee: "Acceptée", terminee: "Terminée", annulee: "Annulée" };

export default function ProposerCoursier({ d }) {
  const [coursiers, setCoursiers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [reglages, setReglages] = useState({});
  const [choix, setChoix] = useState([]);
  const [commercant, setCommercant] = useState(false);
  const [info, setInfo] = useState("");
  const [proposee, setProposee] = useState(null);
  const [photo, setPhoto] = useState(false);
  useEffect(() => {
    const a = onSnapshot(query(collection(db, "coursiers"), where("statut", "==", "actif")), (s) => setCoursiers(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
    const b = onSnapshot(collection(db, "missionsCoursiers"), (s) => setMissions(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
    const c = onSnapshot(collection(db, "reglementsCoursiers"), (s) => setReglements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
    const e = onSnapshot(doc(db, "reglages", "coursiers"), (s) => setReglages(s.exists() ? s.data() : {}), () => {});
    return () => { a(); b(); c(); e(); };
  }, []);
  const soldes = useMemo(() => Object.fromEntries(coursiers.map((k) => [k.id, soldeCumule(missions.filter((m) => m.coursier === k.id), reglements.filter((r) => r.coursier === k.id))])), [coursiers, missions, reglements]);
  const actuelle = missions.filter((m) => m.demande === d.id && m.statut !== "annulee").sort((a, b) => ((b.creeLe && b.creeLe.toMillis ? b.creeLe.toMillis() : 0) - (a.creeLe && a.creeLe.toMillis ? a.creeLe.toMillis() : 0)))[0];
  const nomDe = (id) => (coursiers.find((k) => k.id === id) || {}).prenom || "coursier";

  const proposer = async () => {
    setInfo("");
    const r = missionDepuisDemande(d, { coursiers: choix, reglages, commercantValide: commercant });
    if (r.erreur) return setInfo(r.erreur);
    try {
      const ref = await addDoc(collection(db, "missionsCoursiers"), { ...r.mission, creeLe: serverTimestamp() });
      setProposee({ id: ref.id, ...r.mission });
      setChoix([]);
    } catch {
      setInfo("Proposition impossible : vérifie la connexion et les règles Firebase v21.");
    }
  };
  const annuler = async (m) => {
    try {
      if (m.statut === "proposee") await deleteDoc(doc(db, "missionsCoursiers", m.id));
      else await updateDoc(doc(db, "missionsCoursiers", m.id), { statut: "annulee", majLe: serverTimestamp() });
    } catch {
      setInfo("Impossible pour l'instant.");
    }
  };
  const cloturer = async (m) => {
    try {
      const mvts = await new Promise((ok) => {
        const arret = onSnapshot(query(collection(db, "mouvements"), where("resId", "==", d.id)), (s) => { arret(); ok(s.docs.map((x) => x.data())); }, () => ok([]));
      });
      const reste = Math.max(0, duDe(d) - encaisseDe(mvts, d.id));
      const electronique = m.moyen && m.moyen !== "especes";
      if (electronique && reste > 0) {
        await addDoc(collection(db, "mouvements"), { kind: "paiement", resId: d.id, date: aujourdhui(), montant: Math.min(reste, m.prix), moyen: moyenMouvement(m.moyen), creeLe: serverTimestamp() });
      }
      await updateDoc(doc(db, "demandes", d.id), {
        statut: "terminee",
        coursierPartenaire: { uid: m.coursier, prenom: nomDe(m.coursier), mission: m.id, commission: m.commission ? m.commission.montant : 0 },
        payeAuCoursier: !electronique,
        majLe: serverTimestamp(),
      });
      setInfo(electronique ? "Course clôturée ✓ Paiement noté chez toi (tu le reverses au coursier en fin de mois)." : "Course clôturée ✓ Payée en espèces au coursier : sa commission est dans son compte.");
    } catch {
      setInfo("Clôture impossible pour l'instant.");
    }
  };

  if (!["livraison", "courses"].includes(d.service)) return null;
  return (
    <div className="tb-bloc">
      <h3>🛵 Coursier partenaire</h3>
      {actuelle ? (
        <>
          <p className="tb-note">
            {STATUT[actuelle.statut]}{actuelle.coursier ? ` par ${nomDe(actuelle.coursier)}` : ` à ${actuelle.proposeeA.map(nomDe).join(", ")}`} · commission {actuelle.commission && actuelle.commission.montant} ₪
            {actuelle.partieLe ? " · parti" : ""}{actuelle.recupereeLe ? " · récupéré" : ""}
          </p>
          {actuelle.statut === "terminee" && (
            <>
              <p className="tb-note">Payé par {(MOYENS.find((x) => x.id === actuelle.moyen) || { label: "?" }).label}{actuelle.pourboire ? ` · pourboire ${actuelle.pourboire} ₪ (pour le coursier)` : ""}</p>
              {actuelle.photoPreuve && (photo ? <img src={actuelle.photoPreuve} alt="Preuve de livraison" onClick={() => setPhoto(false)} style={{ width: "100%", borderRadius: 12 }} /> : <button className="tb-bouton tb-clair" onClick={() => setPhoto(true)}>📷 Voir la photo de preuve</button>)}
              {d.statut !== "terminee" && <button className="tb-bouton" onClick={() => cloturer(actuelle)}>✓ Clôturer la course</button>}
            </>
          )}
          {(actuelle.statut === "proposee" || actuelle.statut === "acceptee") && <button className="tb-bouton tb-clair" onClick={() => annuler(actuelle)}>{actuelle.statut === "proposee" ? "Retirer la proposition" : "Annuler pour ce coursier"}</button>}
        </>
      ) : coursiers.length === 0 ? (
        <p className="tb-note">Aucun coursier partenaire actif pour l'instant (rubrique Partenaires).</p>
      ) : (
        <>
          <p className="tb-note">Propose cette course : le premier qui accepte la prend.</p>
          {coursiers.map((k) => {
            const bloque = estBloque(soldes[k.id] || 0, reglages);
            return (
              <label key={k.id} className="rg-case">
                <input type="checkbox" disabled={bloque} checked={choix.includes(k.id)} onChange={() => setChoix((x) => (x.includes(k.id) ? x.filter((y) => y !== k.id) : [...x, k.id]))} />
                <span>{k.prenom} {k.disponible ? "🟢 disponible" : "⚪ indisponible"}{bloque ? ` · bloqué (doit ${Math.abs(soldes[k.id])} ₪)` : ""}</span>
              </label>
            );
          })}
          <label className="rg-case">
            <input type="checkbox" checked={commercant} onChange={(e) => setCommercant(e.target.checked)} />
            <span>Commerçant apporté par le coursier et validé (commission réduite)</span>
          </label>
          <button className="tb-bouton" disabled={!choix.length} onClick={proposer}>Proposer la course</button>
        </>
      )}
      {proposee && proposee.proposeeA.map((id) => {
        const k = coursiers.find((x) => x.id === id) || {};
        const lien = k.telephone ? lienWhatsApp(k.telephone, messageProposition(proposee, k.prenom)) : null;
        return lien ? <a key={id} className="tb-bouton tb-clair" href={lien} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6 }}>Prévenir {k.prenom} sur WhatsApp</a> : null;
      })}
      {info && <p className="tb-note" role="alert">{info}</p>}
    </div>
  );
}
