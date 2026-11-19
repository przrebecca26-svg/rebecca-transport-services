import { useEffect, useState } from "react";

// ÉCRITURE RAPIDE (19 nov. 2026, 14h25) - Rebecca, en voiture avec peu de réseau : « Encaissé » restait bloqué sur
// « Enregistrement… » et la caisse restait ouverte, alors que le paiement était bien noté.
// Firestore enregistre tout de suite dans le téléphone puis envoie au serveur dès que le réseau revient ; mais la
// promesse n'est tenue qu'à la réponse du serveur. On n'attend donc pas plus de 2,5 secondes : passé ce délai,
// l'écran continue (la donnée part toute seule plus tard). Une vraie erreur rapide (droits) reste signalée.
// 15h42 : le paiement de 14h22 (sans réseau) n'est jamais arrivé (appli fermée avant le retour du réseau). Désormais :
// le téléphone garde les envois en attente même si l'appli est fermée (firebase.js), et un bandeau
// « ⏳ En attente de réseau » reste affiché tant qu'un envoi n'est pas confirmé par le serveur.
let enAttente = 0;
const abonnes = new Set();
const prevenir = () => abonnes.forEach((f) => f(enAttente));

export const sansAttendre = (promesse, ms = 2500) => {
  enAttente += 1;
  prevenir();
  const fin = () => { enAttente = Math.max(0, enAttente - 1); prevenir(); };
  promesse.then(fin, fin);
  return Promise.race([promesse, new Promise((ok) => setTimeout(ok, ms))]);
};

export function useEnAttente() {
  const [n, setN] = useState(enAttente);
  useEffect(() => {
    abonnes.add(setN);
    return () => abonnes.delete(setN);
  }, []);
  return n;
}

