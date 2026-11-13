import { useEffect, useMemo, useState } from "react";
import { TARIFS } from "./pricing/config.js";
import { vacancesDuJour } from "./pricing/calendrier.js";
import { ajoutsDesJours, cleLieu, journeeDeLaDate, lieuxDesTrajets } from "./pricing/tournee.js";
import { lireChoix, trajetsDesChoix } from "./pricing/familles.js";
import { extremites } from "./pricing/enchainement.js";
import { kmDuMoisReel } from "./pricing/essence.js";
import { calculerKm } from "./routing.js";
import { useDurees, useJoursTournee, useTournee } from "./tourneeBase.js";
import { useRepertoire } from "./repertoireBase.js";

// KM REELS DU MOIS (13 nov. 2026, 09h36) : tournee scolaire jour par jour + courses (maison -> recuperation ->
// livraison -> maison), calcules sur les vraies adresses. Un seul appel au calcul d'itineraire pour tout le mois.
// Renvoie { kmTournee, kmCourses } ou null tant que le calcul n'est pas fini.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export function useKmReel(mois, demandes = []) {
  const base = useTournee();
  const jours = useJoursTournee(true);
  const rep = useRepertoire();
  const d = base.donnees;
  const base0 = useMemo(() => [...trajetsDesChoix(rep.familles, lireChoix(d.choix)), ...d.trajets], [rep.familles, d.choix, d.trajets]);
  const tous = useMemo(() => [...base0, ...ajoutsDesJours(jours)], [base0, jours]); // pour les adresses seulement
  const durees = useDurees(tous, d.domicile);
  const courses = useMemo(() => (demandes || []).filter((x) => x.statut === "terminee" && String(x.date).slice(0, 7) === mois), [demandes, mois]);
  const points = useMemo(() => {
    const vus = new Map();
    for (const a of lieuxDesTrajets(tous, d.domicile)) vus.set(cleLieu(a), a);
    for (const c of courses) {
      const e = extremites(c);
      for (const a of [e.debut, e.fin]) if (cleLieu(a) && !vus.has(cleLieu(a))) vus.set(cleLieu(a), a);
    }
    return [...vus.values()].slice(0, 90);
  }, [tous, courses, d.domicile]);
  const cle = points.map(cleLieu).join("|");
  const [table, setTable] = useState({ cle: "", km: {} });
  useEffect(() => {
    if (points.length < 2) {
      setTable({ cle, km: {} });
      return undefined;
    }
    const ctrl = new AbortController();
    calculerKm(points, ctrl.signal)
      .then((m) => {
        const km = {};
        points.forEach((a, i) => points.forEach((b, j) => {
          if (i !== j && m[i] && typeof m[i][j] === "number") km[`${cleLieu(a)}>${cleLieu(b)}`] = m[i][j];
        }));
        setTable({ cle, km });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  if (!base.pret || table.cle !== cle || (tous.length && durees.statut !== "ok")) return null;
  const km = (a, b) => (a === b ? 0 : table.km[`${a}>${b}`] ?? null);
  const journee = (date) => {
    if (vacancesDuJour(date)) return null;
    const j = journeeDeLaDate(base0, date, d.transferts, durees.duree, d.domicile, TARIFS, jours);
    return j && j.statut !== "inconnu" ? j : null;
  };
  const fin = aujourdhui();
  return kmDuMoisReel({ mois, jusqua: fin, journee, domicile: d.domicile, courses, km });
}
