import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase.js";

// SUPPRIMER PARTOUT (19 nov. 2026, demande de Rebecca) - Rebecca seule (regles v28).
// « Quand je sais que c'est un test ou que je ne le garde pas, je veux le supprimer vite, sans laisser de trace. »
// Une course supprimee part avec ses paiements, ses paiements annonces et son suivi client :
// elle disparait de Finances, du Bilan, des Statistiques, du Calendrier et de la fiche cliente.
export async function supprimerCourseComplete(id) {
  if (!id) return;
  for (const nom of ["mouvements", "paiementsDeclares"]) {
    try {
      const s = await getDocs(query(collection(db, nom), where("resId", "==", id)));
      for (const x of s.docs) await deleteDoc(x.ref);
    } catch {
      /* rien a supprimer ou regles pas encore collees : on continue */
    }
  }
  try {
    await deleteDoc(doc(db, "suivi", id));
  } catch {
    /* pas de suivi (course sans compte) */
  }
  await deleteDoc(doc(db, "demandes", id));
}

// Un paiement (ou une correction, un remboursement) note par erreur
export const supprimerMouvement = (id) => deleteDoc(doc(db, "mouvements", id));
