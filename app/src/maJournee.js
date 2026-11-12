import { useMemo } from "react";
import { TARIFS } from "./pricing/config.js";
import { vacancesDuJour } from "./pricing/calendrier.js";
import { ajouterTache, changerHeureCeJour, enMin, filTournee, journeeDeLaDate, journeeNormale, nomDuLieu, remettreCeJour, retirerCeJour, retirerTache, tachesDuJour, trajetsDuJourDate } from "./pricing/tournee.js";
import { lireChoix, trajetsDesChoix } from "./pricing/familles.js";
import { fusionnerLieux } from "./pricing/repertoire.js";
import { enregistrerJours, useDurees, useJoursTournee, useTournee } from "./tourneeBase.js";
import { useRepertoire } from "./repertoireBase.js";

// MA JOURNEE DANS MON CALENDRIER (12 nov. 2026) - espace de Rebecca seulement.
// Lit sa tournee privee (admin/tournee) et renvoie, pour chaque date, les vraies etapes de sa journee
// (partir de la maison, deposer, recuperer, temps libre...) a la place de « Creneau deja reserve ».
// 16h29 : elle modifie UNE journee directement dans le Calendrier (retirer un trajet, changer une heure, ajouter une
// tache qui bloque un creneau) sans toucher a sa tournee de toutes les semaines (document prive admin/tourneeJours).
// Tout se relie tout seul : SyncTournee recalcule les creneaux bloques de cette date sur le site.
// etat : "sans" (pas de tournee : on garde l'ancien affichage), "calcul" (temps de route en cours), "ok"
export function useMaJournee(actif) {
  const base = useTournee();
  const jours = useJoursTournee(actif);
  const repertoire = useRepertoire();
  const d = base.donnees;
  const tous = useMemo(() => (actif ? [...trajetsDesChoix(repertoire.familles, lireChoix(d.choix)), ...d.trajets] : []), [actif, repertoire.familles, d.choix, d.trajets]);
  const durees = useDurees(tous, d.domicile);
  const lieux = useMemo(() => fusionnerLieux(repertoire.lieux, d.lieux), [repertoire.lieux, d.lieux]);
  const utilisee = actif && base.pret && !base.refuse;
  const etat = !utilisee ? "sans" : tous.length === 0 || durees.statut === "ok" ? "ok" : durees.statut === "erreur" ? "sans" : "calcul";
  const nomLieu = (a) => nomDuLieu(a, d.domicile, lieux);

  // Etapes de la tournee + mes taches du jour, dans l'ordre des heures
  const fil = (date) => {
    if (etat !== "ok") return [];
    const taches = tachesDuJour(jours, date).map((x) => ({ min: enMin(x.debut), genre: "tache", heure: x.debut.replace(":", "h"), jusqua: x.fin.replace(":", "h"), texte: x.titre, tache: x, adresse: x.lieu, lieu: x.lieu ? nomLieu(x.lieu) || String(x.lieu.label).split(",")[0] : "" }));
    if (vacancesDuJour(date) || !tous.length) return taches;
    const j = journeeDeLaDate(tous, date, d.transferts, durees.duree, d.domicile, TARIFS, jours);
    if (!j || j.statut === "inconnu") return taches;
    const etapes = filTournee(j, nomLieu, d.domicile).map((e) => ({ ...e, alerte: e.genre === "arret" && e.coince ? j.probleme : "" }));
    return [...etapes, ...taches].sort((a, b) => a.min - b.min);
  };
  // Trajets retires ce jour-la (pour pouvoir les remettre)
  const retires = (date) => {
    const ids = ((jours[date] || {}).retires) || [];
    return trajetsDuJourDate(tous, date).filter((r) => ids.includes(r.id));
  };
  const heureChangee = (date, ids) => ids.some((id) => ((jours[date] || {}).heures || {})[id]);
  const sauver = (suite) => enregistrerJours(suite);
  return {
    etat,
    fil,
    retires,
    heureChangee,
    modifie: (date) => !!(jours[date] && ((jours[date].retires || []).length || Object.keys(jours[date].heures || {}).length)),
    retirer: (date, ids) => sauver(retirerCeJour(jours, date, ids)),
    remettre: (date, ids) => sauver(remettreCeJour(jours, date, ids)),
    changerHeure: (date, ids, heure) => sauver(changerHeureCeJour(jours, date, ids, heure)),
    normale: (date) => sauver(journeeNormale(jours, date)),
    ajouterTache: (date, tache) => sauver(ajouterTache(jours, date, tache)),
    retirerTache: (date, id) => sauver(retirerTache(jours, date, id)),
  };
}
