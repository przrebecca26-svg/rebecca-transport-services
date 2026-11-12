import { useEffect, useMemo, useRef } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { lireCreneaux, lireVacancesAjoutees, appliquerVacancesAjoutees, lireCreneauxDates, appliquerCreneauxDates } from "./fermetures.js";
import { TARIFS } from "./pricing/config.js";
import { creneauxDeLaTournee, creneauxAEnregistrer, memesCreneaux, creneauxParDate } from "./pricing/tournee.js";
import { lireChoix, trajetsDesChoix } from "./pricing/familles.js";
import { useTournee, useDurees } from "./tourneeBase.js";
import { useRepertoire } from "./repertoireBase.js";

// MA TOURNEE -> MON CALENDRIER, AUTOMATIQUEMENT (12 nov. 2026, 15h28). Monte dans l'espace de Rebecca, n'affiche rien.
// Des que la tournee change (trajet ajoute, heure changee, fiche d'un enfant modifiee), les creneaux fixes du
// Calendrier (document public reglages/creneaux : jours et heures seulement) sont recalcules et enregistres.
// On attend quelques secondes de calme avant d'ecrire, et rien n'est ecrit tant qu'un temps de route manque.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function SyncTournee() {
  const base = useTournee();
  const repertoire = useRepertoire();
  const actuels = useRef(null);
  const vacancesPubliques = useRef(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "vacances"), (x) => {
    const l = lireVacancesAjoutees(x.exists() ? x.data().json : "[]");
    vacancesPubliques.current = l;
    appliquerVacancesAjoutees(l);
  }, () => {}), []);
  // Jours sans ecole ajoutes dans la tournee -> calendrier public (dates et nom seulement)
  const vacancesVoulues = base.pret && !base.refuse ? lireVacancesAjoutees(JSON.stringify((base.donnees.vacances || []).map((v) => ({ debut: v.du, fin: v.au, motif: v.nom })))) : null;
  const cleVac = vacancesVoulues ? JSON.stringify(vacancesVoulues) : "";
  useEffect(() => {
    if (!vacancesVoulues) return undefined;
    const minuteur = setTimeout(async () => {
      if (!vacancesPubliques.current || JSON.stringify(vacancesPubliques.current) === cleVac) return;
      try {
        await setDoc(doc(db, "reglages", "vacances"), { json: cleVac, majLe: serverTimestamp() });
      } catch {
        /* reessaye au prochain changement */
      }
    }, 4000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleVac]);
  useEffect(() => onSnapshot(doc(db, "reglages", "creneaux"), (x) => { actuels.current = (x.exists() && lireCreneaux(x.data().json)) || []; }, () => {}), []);

  const tous = useMemo(() => [...trajetsDesChoix(repertoire.familles, lireChoix(base.donnees.choix)), ...base.donnees.trajets], [repertoire.familles, base.donnees.choix, base.donnees.trajets]);
  const durees = useDurees(tous, base.donnees.domicile);
  // Tant que la tournee n'a jamais ete utilisee, on ne touche pas aux creneaux fixes d'avant
  const utilisee = base.pret && !base.refuse && (base.donnees.existe || tous.length > 0);
  const voulus = utilisee && (durees.statut === "ok" || tous.length === 0) ? creneauxDeLaTournee(tous, durees.duree, base.donnees.domicile, TARIFS, aujourdhui()) : null;
  const cle = voulus ? JSON.stringify(voulus) : "";

  useEffect(() => {
    if (!voulus) return undefined;
    const minuteur = setTimeout(async () => {
      if (!actuels.current || memesCreneaux(voulus, actuels.current.filter((c) => c.actif !== false))) return;
      try {
        await setDoc(doc(db, "reglages", "creneaux"), { json: JSON.stringify(creneauxAEnregistrer(voulus)), majLe: serverTimestamp(), source: "tournee" });
      } catch {
        /* pas grave : on reessaiera au prochain changement */
      }
    }, 4000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  // Trajets confies a Jeremy certaines dates : ces jours-la, mes creneaux bloques sont recalcules
  const datesPubliques = useRef(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "creneauxDates"), (x) => {
    const o = lireCreneauxDates(x.exists() ? x.data().json : "{}");
    datesPubliques.current = o;
    appliquerCreneauxDates(o);
  }, () => {}), []);
  const parDate = utilisee && (durees.statut === "ok" || tous.length === 0) ? creneauxParDate(tous, base.donnees.transferts || [], durees.duree, base.donnees.domicile, TARIFS, aujourdhui()) : null;
  const cleDates = parDate ? JSON.stringify(parDate) : "";
  useEffect(() => {
    if (!parDate) return undefined;
    const minuteur = setTimeout(async () => {
      const actuel = datesPubliques.current && JSON.stringify(Object.fromEntries(Object.entries(datesPubliques.current).filter(([d]) => d >= aujourdhui()).map(([d, l]) => [d, l.map((c) => ({ debut: c.debut, fin: c.fin }))])));
      if (!datesPubliques.current || actuel === cleDates) return;
      try {
        await setDoc(doc(db, "reglages", "creneauxDates"), { json: cleDates, majLe: serverTimestamp() });
      } catch {
        /* reessaye au prochain changement */
      }
    }, 4000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleDates]);

  return null;
}
