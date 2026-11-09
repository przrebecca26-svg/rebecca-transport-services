// SUIVI CLIENT - regles pures - Rebecca Services
// Le client voit ses demandes dans « Historique » grace au document suivi/{id} (cree avec la demande).
// Quand Rebecca change le statut ou le prix d'une demande, le suivi doit suivre (Lot B, seance B3).

import { etatReservation } from "./comptes.js";

// Statut admin (demandes) -> statut affiche au client (suivi), voir STATUTS_SUIVI dans profil.js
export const STATUT_SUIVI = {
  "en attente": "en attente",
  acceptee: "acceptée",
  refusee: "refusée",
  terminee: "terminée",
  annulee: "annulée",
};

const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);

// Statut que le client devrait voir : « confirmée » quand l'acompte d'une course acceptee est recu
export function statutSuiviAttendu(d, mouvements = []) {
  if (d.statut === "acceptee") {
    const etat = etatReservation({ id: d.id, date: d.date, prixConvenu: prixDe(d), statut: d.statut }, mouvements);
    return etat === "confirmee" ? "confirmée" : "acceptée";
  }
  return STATUT_SUIVI[d.statut] || null;
}

// Champs a ecrire dans suivi/{id} (sans majLe), ou null si rien a changer
export function miseAJourSuivi(d, suivi, mouvements = []) {
  if (!d || !d.uid || !suivi) return null;
  if (suivi.statut === "annulée par le client" || suivi.statut === "remplacée") return null; // choix du client : on ne touche pas
  const champs = {};
  const statut = statutSuiviAttendu(d, mouvements);
  if (statut && suivi.statut !== statut) champs.statut = statut;
  if (typeof d.prixFinal === "number" && suivi.prixFinal !== d.prixFinal) champs.prixFinal = d.prixFinal;
  return Object.keys(champs).length ? champs : null;
}
