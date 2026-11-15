import { useEffect, useState } from "react";
import { lireArrets } from "./pricing/dispoRamassage.js";

// Arrets publics de la tournee (lieu de l'ecole, heure, places ; sans nom) : un enfant peut y etre pris au passage
export function useArretsPublics() {
  const [arrets, setArrets] = useState([]);
  useEffect(() => {
    let arret = () => {};
    let actif = true;
    Promise.all([import("./firebase.js"), import("firebase/firestore")]).then(([{ db }, { doc, onSnapshot }]) => {
      if (!actif) return;
      arret = onSnapshot(doc(db, "reglages", "ramassageArrets"), (s) => setArrets(lireArrets(s.exists() ? s.data().json : "[]")), () => setArrets([]));
    });
    return () => {
      actif = false;
      arret();
    };
  }, []);
  return arrets;
}
