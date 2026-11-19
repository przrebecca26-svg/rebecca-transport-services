// ÉCRITURE RAPIDE (19 nov. 2026, 14h25) - Rebecca, en voiture avec peu de réseau : « Encaissé » restait bloqué sur
// « Enregistrement… » et la caisse restait ouverte, alors que le paiement était bien noté.
// Firestore enregistre tout de suite dans le téléphone puis envoie au serveur dès que le réseau revient ; mais la
// promesse n'est tenue qu'à la réponse du serveur. On n'attend donc pas plus de 2,5 secondes : passé ce délai,
// l'écran continue (la donnée part toute seule plus tard). Une vraie erreur rapide (droits) reste signalée.
export const sansAttendre = (promesse, ms = 2500) => Promise.race([promesse, new Promise((ok) => setTimeout(ok, ms))]);
