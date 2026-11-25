import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

// Restaurants affichés sur #/restaurants (reglages/vitrineRestos, lecture publique) - 25 nov. 2026
export function useVitrineRestos() {
  const [liste, setListe] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "vitrineRestos"), (s) => { try { setListe(JSON.parse((s.exists() && s.data().json) || "[]")); } catch { setListe([]); } }, () => setListe([])), []);
  return liste;
}
