import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { lireComptes, planAllocation } from "./pricing/comptesEntreNous.js";

// COMPTES ENTRE NOUS - lecture, enregistrement et placement automatique (13 nov. 2026)
// Document PRIVE admin/comptes (Rebecca seule). Ses courses et paiements restent dans demandes / mouvements :
// Finances les voit comme toutes les autres courses.
const REF = () => doc(db, "admin", "comptes");

export function useComptes() {
  const [etat, setEtat] = useState({ pret: false, comptes: [] });
  useEffect(() => onSnapshot(REF(), (s) => setEtat({ pret: true, comptes: lireComptes(s.exists() ? s.data().json : "[]") }), () => setEtat({ pret: true, comptes: [] })), []);
  return etat;
}
export const enregistrerComptes = (comptes) => setDoc(REF(), { json: JSON.stringify(comptes), majLe: serverTimestamp() });

// Courses terminees et mouvements (pour les soldes)
export function useCoursesEtMouvements(actif = true) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  useEffect(() => {
    if (!actif) return undefined;
    const a = onSnapshot(query(collection(db, "demandes"), where("statut", "==", "terminee")), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setDemandes([]));
    const b = onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setMouvements([]));
    return () => {
      a();
      b();
    };
  }, [actif]);
  return { demandes, mouvements };
}

// Monte dans l'espace de Rebecca, n'affiche rien : ce qu'une personne m'a paye (ou ce que je lui dois en troc) se
// place tout seul sur ses courses encore dues -> paiement (ou deduction) dans Finances.
export default function SyncComptes() {
  const { pret, comptes } = useComptes();
  const { demandes, mouvements } = useCoursesEtMouvements(true);
  const enCours = useRef(false);
  const plan = pret && demandes && mouvements && comptes.length ? planAllocation(comptes, demandes, mouvements, TARIFS.moyensPaiement) : null;
  const cle = plan && plan.mouvements.length ? JSON.stringify(plan.mouvements) : "";
  useEffect(() => {
    if (!cle) return undefined;
    const minuteur = setTimeout(async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const lot = writeBatch(db);
        for (const m of plan.mouvements) lot.set(doc(collection(db, "mouvements")), { ...m, creeLe: serverTimestamp() });
        lot.set(REF(), { json: JSON.stringify(plan.comptes), majLe: serverTimestamp() });
        await lot.commit();
      } catch {
        /* on reessaiera au prochain changement */
      }
      enCours.current = false;
    }, 2500);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return null;
}
