import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { DOC_REPERTOIRE, abonnerRepertoire, definirRepertoire, lireCorrections, lireRepertoire, repertoireCourant, versionRepertoire } from "./pricing/repertoire.js";

// REPERTOIRE - lecture et enregistrement (12 nov. 2026). Espace prive seulement.
// Mes lieux : document clientsAdmin/_repertoire (prive : Rebecca et son equipe, jamais les clientes).
// Adresses des clientes : lues en direct dans leurs comptes (collection clients), jamais recopiees.

// A appeler UNE fois dans l'espace prive : charge le repertoire et le tient a jour pour tous les champs d'adresse.
export function useChargerRepertoire(actif) {
  useEffect(() => {
    if (!actif) return undefined;
    const a = onSnapshot(doc(db, "clientsAdmin", DOC_REPERTOIRE), (s) => definirRepertoire({ lieux: lireRepertoire(s.exists() ? s.data().json : ""), corrections: lireCorrections(s.exists() ? s.data().json : "") }), () => {});
    const b = onSnapshot(collection(db, "clients"), (s) => definirRepertoire({ bruts: s.docs.map((x) => ({ id: x.id, ...x.data() })) }), () => {});
    return () => {
      a();
      b();
    };
  }, [actif]);
}

// Dans un ecran : le repertoire courant, redessine quand il change
export function useRepertoire() {
  const [, setV] = useState(versionRepertoire());
  useEffect(() => abonnerRepertoire(setV), []);
  return repertoireCourant();
}

// corrections non fournies = on garde celles deja enregistrees
export const enregistrerRepertoire = (lieux, corrections = repertoireCourant().corrections) => setDoc(doc(db, "clientsAdmin", DOC_REPERTOIRE), { json: JSON.stringify({ lieux, corrections }), majLe: serverTimestamp() });

// Cle de la recherche d'adresses Google (Rebecca seule peut l'enregistrer ; vide = retour au service gratuit)
export const enregistrerCleGoogle = (cle) => setDoc(doc(db, "reglages", "google"), { cle: String(cle || "").trim(), majLe: serverTimestamp() });
