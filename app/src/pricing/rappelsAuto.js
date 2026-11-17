// RAPPELS ENVOYES TOUT SEULS (17 nov. 2026) - Rebecca Services
// Chaque soir (19h, heure d'Israel), une tache programmee de Netlify (netlify/functions/rappels-auto.mjs)
// envoie PAR E-MAIL, sans Rebecca : le rappel des retours d'aller-retour de demain et des rendez-vous beaute de demain.
// WhatsApp ne peut pas partir tout seul (il faudrait l'API WhatsApp Business, payante) : dans « Aujourd'hui »,
// Rebecca garde son bouton WhatsApp, et l'e-mail n'est pas renvoye une deuxieme fois.
// Pas de rappel pendant Chabbat et les fetes : demain ferme = rien a rappeler (aucune course ce jour-la).
import { messageRappelRetour, rappelsDemain, resteDe } from "./finCourse.js";
import { messageRappelRdv, rappelsRdvDemain } from "./suiteClient.js";

export const SUJET_RETOUR = "Petit rappel pour votre retour - Rebecca Services";
export const SUJET_RDV = "Rappel de votre rendez-vous - Rebecca Services";

// Liste des e-mails a envoyer ce soir : [{ demande, sujet, texte }], sans ceux deja partis tout seuls
export function rappelsDuSoir(demandes = [], mouvements = [], jour) {
  const pasEncore = (d) => !d.rappelMailAutoLe;
  return [
    ...rappelsDemain(demandes, jour).filter(pasEncore).map((d) => ({ demande: d, sujet: SUJET_RETOUR, texte: messageRappelRetour(d, resteDe(d, mouvements)) })),
    ...rappelsRdvDemain(demandes, jour).filter(pasEncore).map((d) => ({ demande: d, sujet: SUJET_RDV, texte: messageRappelRdv(d) })),
  ];
}

/* ---------- Lecture des documents Firestore recus par l'API REST ---------- */
export function valeur(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return champs((v.mapValue && v.mapValue.fields) || {});
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(valeur);
  return null;
}
export function champs(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, valeur(v)]));
}
export function documentRest(d) {
  if (!d || !d.name) return null;
  return { id: d.name.split("/").pop(), ...champs(d.fields || {}) };
}

// Mot de passe du compte « robot » cree par Rebecca dans Reglages (copie ensuite dans Netlify)
export function motDePasseRobot(alea = () => Math.random()) {
  const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let m = "";
  for (let i = 0; i < 24; i++) m += lettres[Math.floor(alea() * lettres.length)];
  return m;
}
