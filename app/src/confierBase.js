import { arrayRemove, arrayUnion, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { appliquerJour, confierTacheCeJour, messageMission, missionDeLaTache, missionDuTransfert, nouvelId, reprendreTacheCeJour, trajetsDuJourDate } from "./pricing/tournee.js";
import { enregistrerJours, enregistrerTournee } from "./tourneeBase.js";

// CONFIER DES TRAJETS A UN COEQUIPIER POUR UNE DATE — partage entre « Ramassage scolaire » (ConfierTrajets) et
// le Calendrier (25 nov. 2026, Rebecca : « je serai à Tel Aviv, c'est Jérémy qui récupère Shyrel, je n'ai pas la
// possibilité de l'enlever de mon agenda pour la mettre sur Jérémy »).
// Les trajets deviennent une mission dans le planning du coequipier (missionsEquipe), bloquent ses horaires sur le site
// (disposEquipe) et sortent de la journee de Rebecca (transferts de admin/tournee). Ce jour seulement.
// jours = modifications du jour (heure changee, trajet ajoute ce jour) : la mission les reprend.

export async function confierAuCoequipier({ donnees, tous, ids, date, duree, nomLieu, membre, jours = {} }) {
  if (!ids || !ids.length || !membre) return { texte: "Choisis au moins un trajet." };
  const m = missionDuTransfert(tous, ids, date, duree, TARIFS, nomLieu, jours);
  if (!m) return { texte: "Temps de route pas encore calculés : réessaie dans un instant." };
  const transferts = donnees.transferts || [];
  const duJour = appliquerJour(trajetsDuJourDate(tous, date), date, jours);
  const noms = duJour.filter((r) => ids.includes(r.id)).map((r) => r.nom || "trajet");
  const id = nouvelId();
  await setDoc(doc(db, "missionsEquipe", id), { membre: membre.id, nomMembre: membre.nom || "", date, debut: m.debut, fin: m.fin, etapes: m.etapes, creeLe: serverTimestamp() });
  await setDoc(doc(db, "disposEquipe", membre.id), { indispos: arrayUnion({ debut: `${date}T${m.debut}`, fin: `${date}T${m.fin}` }), majLe: serverTimestamp() }, { merge: true });
  await enregistrerTournee({ ...donnees, transferts: [...transferts, { id, date, trajets: ids, membre: membre.id, nomMembre: membre.nom || "", debut: m.debut, fin: m.fin, noms }] });
  return {
    texte: `C'est confié à ${membre.nom || "ton coéquipier"} : c'est dans son planning et ton Calendrier se libère ce jour-là.${m.statut === "impossible" ? ` Attention : ${m.probleme}` : ""}`,
    lien: membre.telephone ? lienWhatsApp(membre.telephone, messageMission(m, membre.nom)) : "",
  };
}

// « Je le reprends » : la mission disparait de son planning et les trajets reviennent dans ma journee
export async function reprendreDuCoequipier({ donnees, transfert }) {
  const x = transfert;
  await deleteDoc(doc(db, "missionsEquipe", x.id));
  if (x.debut && x.fin) await setDoc(doc(db, "disposEquipe", x.membre), { indispos: arrayRemove({ debut: `${x.date}T${x.debut}`, fin: `${x.date}T${x.fin}` }), majLe: serverTimestamp() }, { merge: true });
  await enregistrerTournee({ ...donnees, transferts: (donnees.transferts || []).filter((y) => y.id !== x.id) });
}

// 25 nov. 2026 : n'importe quelle tache de ma journee (course, livraison, rendez-vous, autre) confiee pour ce jour.
// Pas d'acceptation : elle est tout de suite dans son planning et sort du mien ; WhatsApp pour le prevenir.
export async function confierTache({ jours, date, tache, membre, nomLieu }) {
  const m = missionDeLaTache(tache, nomLieu);
  if (!m || !membre) return { texte: "Cette tâche n'a pas d'heure de début et de fin." };
  const id = nouvelId();
  await setDoc(doc(db, "missionsEquipe", id), { membre: membre.id, nomMembre: membre.nom || "", date, debut: m.debut, fin: m.fin, etapes: m.etapes, creeLe: serverTimestamp() });
  await setDoc(doc(db, "disposEquipe", membre.id), { indispos: arrayUnion({ debut: `${date}T${m.debut}`, fin: `${date}T${m.fin}` }), majLe: serverTimestamp() }, { merge: true });
  await enregistrerJours(confierTacheCeJour(jours, date, tache.id, { mission: id, membre: membre.id, nom: membre.nom || "" }));
  return { texte: `Confié à ${membre.nom || "ton coéquipier"}.`, lien: membre.telephone ? lienWhatsApp(membre.telephone, messageMission({ ...m, date }, membre.nom)) : "" };
}
export async function reprendreTache({ jours, date, tache, mission, membre }) {
  await deleteDoc(doc(db, "missionsEquipe", mission));
  await setDoc(doc(db, "disposEquipe", membre), { indispos: arrayRemove({ debut: `${date}T${tache.debut}`, fin: `${date}T${tache.fin}` }), majLe: serverTimestamp() }, { merge: true });
  await enregistrerJours(reprendreTacheCeJour(jours, date, tache.id));
}
