import { useMemo } from "react";
import { TARIFS } from "./pricing/config.js";
import { vacancesDuJour } from "./pricing/calendrier.js";
import { filTournee, journeeDeLaDate, nomDuLieu } from "./pricing/tournee.js";
import { lireChoix, trajetsDesChoix } from "./pricing/familles.js";
import { fusionnerLieux } from "./pricing/repertoire.js";
import { useTournee, useDurees } from "./tourneeBase.js";
import { useRepertoire } from "./repertoireBase.js";

// MA JOURNEE DANS MON CALENDRIER (12 nov. 2026, 16h07) - espace de Rebecca seulement.
// Lit sa tournee privee (admin/tournee) et renvoie, pour chaque date, les vraies etapes de sa journee
// (partir de la maison, deposer, recuperer, temps libre...) a la place de « Creneau deja reserve ».
// etat : "sans" (pas de tournee : on garde l'ancien affichage), "calcul" (temps de route en cours), "ok"
export function useMaJournee(actif) {
  const base = useTournee();
  const repertoire = useRepertoire();
  const d = base.donnees;
  const tous = useMemo(() => (actif ? [...trajetsDesChoix(repertoire.familles, lireChoix(d.choix)), ...d.trajets] : []), [actif, repertoire.familles, d.choix, d.trajets]);
  const durees = useDurees(tous, d.domicile);
  const lieux = useMemo(() => fusionnerLieux(repertoire.lieux, d.lieux), [repertoire.lieux, d.lieux]);
  const utilisee = actif && base.pret && !base.refuse && tous.length > 0;
  const etat = !utilisee ? "sans" : durees.statut === "ok" ? "ok" : durees.statut === "erreur" ? "sans" : "calcul";
  const nomLieu = (a) => nomDuLieu(a, d.domicile, lieux);
  const fil = (date) => {
    if (etat !== "ok" || vacancesDuJour(date)) return [];
    const j = journeeDeLaDate(tous, date, d.transferts, durees.duree, d.domicile, TARIFS);
    if (!j || j.statut === "inconnu") return [];
    return filTournee(j, nomLieu, d.domicile).map((e) => ({ ...e, alerte: e.genre === "arret" && e.coince ? j.probleme : "" }));
  };
  return { etat, fil };
}
