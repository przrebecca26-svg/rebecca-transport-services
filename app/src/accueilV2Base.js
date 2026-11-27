import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { lireAccueil } from "./pricing/accueilV2.js";

// NOUVEL ACCUEIL (lot P1, 27 nov. 2026) - réglages de Rebecca dans reglages/accueilV2 (lecture publique, écriture
// Rebecca seule : règles actuelles, aucune nouvelle règle). Voir pricing/accueilV2.js.
export function useAccueilV2() {
  const [c, setC] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "accueilV2"), (s) => setC(lireAccueil(s.exists() ? s.data().json : null)), () => setC(lireAccueil(null))), []);
  return c;
}
export const enregistrerAccueilV2 = (config) => setDoc(doc(db, "reglages", "accueilV2"), { json: JSON.stringify(lireAccueil(config)), majLe: serverTimestamp() });
// Photos retirées de l'accueil (catégories, bannières, univers) : effacées après l'enregistrement
export const supprimerPhotosAccueil = (ids) => Promise.all((ids || []).map((id) => deleteDoc(doc(db, "pagesPhotos", id)).catch(() => {})));
