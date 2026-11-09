import { useEffect, useRef } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { blocsDesCourses, synchroniser } from "./pricing/rendezvous.js";

// AGENDA COMMUN (Lot C, C3) : tient a jour la liste PUBLIQUE des moments ou Rebecca est occupee
// (creneauxOccupes : debut, fin, personne ; jamais de nom, d'adresse ni d'activite).
// Les futures pages de rendez-vous (Nails, Hair...) griseront ces moments. Rien ne s'affiche ici.
// Avant les regles v10, l'ecriture est refusee : rien ne se passe, l'application continue normalement.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function SyncCreneaux() {
  const demandes = useRef(null);
  const existants = useRef(null);
  const enCours = useRef(false);

  useEffect(() => {
    const lancer = async () => {
      if (enCours.current || !demandes.current || !existants.current) return;
      const voulus = blocsDesCourses(demandes.current, { depuis: aujourdhui() });
      const { aEcrire, aSupprimer } = synchroniser(voulus, existants.current.filter((x) => (x.fin || "") >= aujourdhui()));
      if (!aEcrire.length && !aSupprimer.length) return;
      enCours.current = true;
      try {
        const lot = writeBatch(db);
        for (const b of aEcrire.slice(0, 400)) lot.set(doc(db, "creneauxOccupes", b.id), { debut: b.debut, fin: b.fin, personne: b.personne, source: "course", majLe: serverTimestamp() });
        for (const id of aSupprimer.slice(0, 400 - Math.min(aEcrire.length, 400))) lot.delete(doc(db, "creneauxOccupes", id));
        await lot.commit();
      } catch {
        /* regles v10 pas encore publiees : sans consequence */
      }
      enCours.current = false;
    };
    const a = onSnapshot(collection(db, "demandes"), (s) => {
      demandes.current = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      lancer();
    }, () => {});
    const b = onSnapshot(collection(db, "creneauxOccupes"), (s) => {
      existants.current = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      lancer();
    }, () => {});
    return () => {
      a();
      b();
    };
  }, []);
  return null;
}
