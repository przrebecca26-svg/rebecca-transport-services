import { useMemo } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { courseForfait, famillesDeLEtape, familleEncoreFaite, idForfait, lireForfait, telephoneFamille } from "./pricing/forfaitJour.js";
import { TARIFS } from "./pricing/config.js";
import { vacancesDuJour } from "./pricing/calendrier.js";
import { ajouterTache, annulerEtape, changerHeureCeJour, cleEtape, faitA, validerEtape, enMin, filTournee, journeeDeLaDate, journeeNormale, modifierTache, nomDuLieu, remettreCeJour, retirerCeJour, retirerTache, tachesDuJour, trajetsDuJourDate } from "./pricing/tournee.js";
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

  // « ✓ Fait » (13 nov. 2026) : cocher une etape pour CE jour. Si la famille a un forfait a la journee (Alexia 70 ₪),
  // la journee part dans Finances une seule fois (course terminee, reste a encaisser tant qu'elle n'a pas paye).
  // Renvoie un petit message a afficher sous l'etape (ou "").
  const familleDe = (id) => repertoire.familles.find((f) => f.id === id) || null;
  const valider = async (date, e) => {
    const cle = cleEtape(e);
    if (!cle) return "";
    const heure = new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
    await sauver(validerEtape(jours, date, cle, heure));
    const notes = [];
    for (const id of famillesDeLEtape(e, tous)) {
      const f = familleDe(id);
      if (!f || !lireForfait(f.forfaitJour)) continue;
      if (telephoneFamille(f).length < 3) {
        notes.push(`Ajoute le téléphone de ${f.nom || "la famille"} dans sa fiche (Répertoire) pour que son forfait parte dans Finances.`);
        continue;
      }
      const ref = doc(db, "demandes", idForfait(id, date));
      if ((await getDoc(ref)).exists()) continue; // deja comptee aujourd'hui (un autre trajet coche)
      const premier = fil(date).find((x) => famillesDeLEtape(x, tous).includes(id));
      const course = courseForfait(f, date, premier && premier.heure ? premier.heure.replace("h", ":") : "");
      if (!course) continue;
      await setDoc(ref, { ...course, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      notes.push(`Journée de ${f.nom} comptée dans Finances : ${course.prixFinal} ₪ à encaisser.`);
    }
    return notes.join(" ");
  };
  const annuler = async (date, e) => {
    const cle = cleEtape(e);
    if (!cle) return "";
    const suite = annulerEtape(jours, date, cle);
    await sauver(suite);
    const faits = ((suite[date] || {}).faits) || {};
    const etapes = fil(date);
    const notes = [];
    for (const id of famillesDeLEtape(e, tous)) {
      if (familleEncoreFaite(id, etapes, faits, tous, cleEtape)) continue;
      const ref = doc(db, "demandes", idForfait(id, date));
      if (!(await getDoc(ref)).exists()) continue;
      const payes = await getDocs(query(collection(db, "mouvements"), where("resId", "==", ref.id)));
      if (!payes.empty) {
        notes.push("Un paiement est déjà enregistré pour cette journée : elle reste dans Finances.");
        continue;
      }
      await deleteDoc(ref);
      notes.push(`Journée de ${(familleDe(id) || {}).nom || "la famille"} retirée de Finances.`);
    }
    return notes.join(" ");
  };
  return {
    etat,
    fil,
    retires,
    heureChangee,
    faitA: (date, e) => faitA(jours, date, cleEtape(e)),
    valider,
    annuler,
    modifie: (date) => !!(jours[date] && ((jours[date].retires || []).length || Object.keys(jours[date].heures || {}).length)),
    retirer: (date, ids) => sauver(retirerCeJour(jours, date, ids)),
    remettre: (date, ids) => sauver(remettreCeJour(jours, date, ids)),
    changerHeure: (date, ids, heure) => sauver(changerHeureCeJour(jours, date, ids, heure)),
    normale: (date) => sauver(journeeNormale(jours, date)),
    ajouterTache: (date, tache) => sauver(ajouterTache(jours, date, tache)),
    retirerTache: (date, id) => sauver(retirerTache(jours, date, id)),
    modifierTache: (date, id, tache) => sauver(modifierTache(jours, date, id, tache)),
  };
}
