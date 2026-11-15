import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";

// TRAJET PARTAGE (espace de Rebecca, 15 nov. 2026) : changer son statut change aussi la demande du site qui lui est liee
// (la meme demande dans « Demandes » et dans l'historique de la cliente).
const STATUT_DEMANDE = { acceptee: "acceptee", refusee: "refusee", annulee: "annulee" };
const STATUT_SUIVI = { acceptee: "acceptée", refusee: "refusée", annulee: "annulée" };

export async function changerStatutPartage(id, statut, plus = {}) {
  await updateDoc(doc(db, "trajetsPartages", id), { statut, majLe: serverTimestamp(), ...plus });
  const s = await getDocs(query(collection(db, "demandes"), where("details.partageId", "==", id))).catch(() => null);
  if (!s || !STATUT_DEMANDE[statut]) return;
  for (const d of s.docs) {
    if (d.data().statut !== "en attente") continue;
    await updateDoc(d.ref, { statut: STATUT_DEMANDE[statut], majLe: serverTimestamp() }).catch(() => {});
    if (d.data().uid) await updateDoc(doc(db, "suivi", d.id), { statut: STATUT_SUIVI[statut], majLe: serverTimestamp() }).catch(() => {});
  }
}

// Telephone pour reconnaitre deux demandes de la meme famille (doublon)
export const telSimple = (t) => String(t || "").replace(/\D/g, "").replace(/^972/, "0");
