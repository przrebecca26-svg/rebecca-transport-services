// Mise a jour du suivi visible par le client (suivi/{id}) depuis l'espace prive - Rebecca Services
// Appele apres chaque changement de statut ou de prix d'une demande avec compte (Lot B, seance B3).
// Les regles Firestore v7 autorisent deja Rebecca a modifier suivi/{id}.

import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { miseAJourSuivi } from "./pricing/suivi.js";

// Une demande. d : la demande APRES la modification. Renvoie true si tout va bien (ou rien a faire).
// mouvements : ceux de la course s'ils sont deja connus ; sinon ils sont lus (pour savoir si l'acompte est recu).
export async function synchroniserSuivi(d, mouvements = null) {
  if (!d || !d.uid) return true;
  try {
    if (mouvements === null && d.statut === "acceptee") {
      const m = await getDocs(query(collection(db, "mouvements"), where("resId", "==", d.id)));
      mouvements = m.docs.map((x) => ({ id: x.id, ...x.data() }));
    }
    const ref = doc(db, "suivi", d.id);
    const s = await getDoc(ref);
    if (!s.exists()) return true; // ancienne demande sans suivi
    const champs = miseAJourSuivi(d, s.data(), mouvements || []);
    if (champs) await updateDoc(ref, { ...champs, majLe: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}

// Rattrapage : met a jour d'un coup le suivi de toutes les demandes avec compte. Renvoie le nombre corrige.
export async function rattraperTousLesSuivis(demandes) {
  const [suivis, mvts] = await Promise.all([getDocs(collection(db, "suivi")), getDocs(collection(db, "mouvements"))]);
  const parId = new Map(suivis.docs.map((x) => [x.id, x.data()]));
  const mouvements = mvts.docs.map((x) => ({ id: x.id, ...x.data() }));
  const aEcrire = [];
  for (const d of demandes) {
    const champs = miseAJourSuivi(d, parId.get(d.id), mouvements);
    if (champs) aEcrire.push([d.id, champs]);
  }
  for (let i = 0; i < aEcrire.length; i += 400) {
    const lot = writeBatch(db);
    for (const [id, champs] of aEcrire.slice(i, i + 400)) lot.update(doc(db, "suivi", id), { ...champs, majLe: serverTimestamp() });
    await lot.commit();
  }
  return aEcrire.length;
}
