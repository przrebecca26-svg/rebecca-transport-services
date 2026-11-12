import { useEffect, useRef } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { agendaVoulu, blocsDesCourses, ecartsAgenda, synchroniser } from "./pricing/rendezvous.js";

// AGENDA COMMUN (Lot C, C3) : tient a jour la liste PUBLIQUE des moments ou Rebecca est occupee
// (creneauxOccupes : debut, fin, personne ; jamais de nom, d'adresse ni d'activite).
// Les futures pages de rendez-vous (Nails, Hair...) griseront ces moments. Rien ne s'affiche ici.
// Avant les regles v10, l'ecriture est refusee : rien ne se passe, l'application continue normalement.
// 11 nov. 2026 : tient aussi a jour l'agenda des rendez-vous (agendaJours). Un creneau est verrouille par la cliente
// des sa demande ; ici, on LIBERE ce qui ne correspond plus a une demande active (refus, annulation, annulation par
// la cliente) et on remet ce qui manquerait. On attend quelques secondes avant d'agir, pour ne jamais effacer une
// reservation qui vient d'arriver et dont la demande n'est pas encore chargee.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function SyncCreneaux() {
  const demandes = useRef(null);
  const existants = useRef(null);
  const enCours = useRef(false);
  const agenda = useRef(null);
  const suivis = useRef(null);
  const minuteur = useRef(null);

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
    const accorderAgenda = async () => {
      if (!demandes.current || !agenda.current || !suivis.current) return;
      const jour = aujourdhui();
      const voulu = agendaVoulu(demandes.current, { depuis: jour, suivis: suivis.current });
      const existants = agenda.current.filter((x) => x.id.startsWith("rebecca__") && x.id.slice(9) >= jour);
      const ecarts = ecartsAgenda(voulu, existants).slice(0, 300);
      if (!ecarts.length) return;
      try {
        const lot = writeBatch(db);
        for (const e of ecarts) {
          const ref = doc(db, "agendaJours", e.id);
          if (e.cellules.length) lot.set(ref, { cells: Object.fromEntries(e.cellules.map((c) => [c, true])), majLe: serverTimestamp() });
          else lot.delete(ref);
        }
        await lot.commit();
      } catch {
        /* regles v13 pas encore publiees : sans consequence */
      }
    };
    const planifierAgenda = () => {
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(accorderAgenda, 6000);
    };
    const a = onSnapshot(refDemandes(), (s) => {
      demandes.current = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      lancer();
      planifierAgenda();
    }, () => {});
    const c = onSnapshot(collection(db, "agendaJours"), (s) => {
      agenda.current = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      planifierAgenda();
    }, () => {});
    const e = onSnapshot(collection(db, "suivi"), (s) => {
      suivis.current = Object.fromEntries(s.docs.map((x) => [x.id, x.data().statut]));
      planifierAgenda();
    }, () => {});
    const b = onSnapshot(collection(db, "creneauxOccupes"), (s) => {
      existants.current = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      lancer();
    }, () => {});
    return () => {
      a();
      b();
      c();
      e();
      clearTimeout(minuteur.current);
    };
  }, []);
  return null;
}
