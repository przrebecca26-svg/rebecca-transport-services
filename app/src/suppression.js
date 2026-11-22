import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase.js";

// SUPPRIMER PARTOUT (19 nov. 2026, demande de Rebecca) - Rebecca seule (regles v28).
// « Quand je sais que c'est un test ou que je ne le garde pas, je veux le supprimer vite, sans laisser de trace. »
// Une course supprimee part avec ses paiements, ses paiements annonces et son suivi client :
// elle disparait de Finances, du Bilan, des Statistiques, du Calendrier et de la fiche cliente.
export async function supprimerCourseComplete(id) {
  if (!id) return;
  // 22 nov. 2026 : livraison d'un restaurant -> sa commande part aussi (plus de commande « en cours » orpheline)
  try {
    const d = await getDoc(doc(db, "demandes", id));
    const c = d.exists() && d.data().details && d.data().details.commandeResto;
    if (c && c.cle && c.id) await deleteDoc(doc(db, "restos", c.cle, "commandesResto", c.id));
  } catch {
    /* commande deja supprimee : on continue */
  }
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

// 22 nov. 2026 (Rebecca : « les tests d'avant, je peux pas les supprimer ») : une commande de restaurant
// part avec sa livraison du Calendrier (et ses paiements) si elle en a une.
export async function supprimerCommandeResto(c) {
  if (!c || !c.cle || !c.id) return;
  // 22 nov. 2026, 11h42 (Rebecca : « quand j'appuie sur supprimer ça supprime pas ») : la commande part EN PREMIER
  // (elle disparaît tout de suite de la liste), puis sa livraison du Calendrier et ses paiements.
  try {
    await deleteDoc(doc(db, "restos", c.cle, "commandesResto", c.id));
  } catch (e) {
    if (!(e && e.code === "not-found")) throw e;
  }
  if (c.demandeId) {
    try {
      await supprimerCourseComplete(c.demandeId);
    } catch {
      /* livraison deja supprimee */
    }
  }
}

// Une attente qui ne finit jamais devient une erreur claire (réseau coupé, appli restée ouverte trop longtemps)
export function avecDelai(promesse, ms = 20000) {
  let t;
  return Promise.race([promesse, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error("delai"), { code: "delai" })), ms); })]).finally(() => clearTimeout(t));
}

export function messageErreurSuppression(e) {
  const code = (e && e.code) || "";
  if (code === "permission-denied") return "Firebase refuse la suppression : les règles publiées ne sont pas les bonnes. Publie la v36 (je te redonne le bloc), puis réessaie.";
  if (code === "delai") return "Firebase ne répond pas : ferme complètement l'appli, rouvre-la, puis réessaie.";
  if (code === "unavailable") return "Pas de connexion pour l'instant : réessaie dans un moment.";
  return "Suppression impossible" + (code ? ` (${code})` : "") + " : envoie-moi une capture de ce message.";
}
