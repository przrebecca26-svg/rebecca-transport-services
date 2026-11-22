// CONNEXION FIREBASE - Rebecca Transport & Services
// Ces identifiants ne sont PAS secrets (ils sont visibles dans tout site Firebase).
// La securite repose sur la connexion administrateur et les regles Firestore.

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg",
  authDomain: "rebecca-transport.firebaseapp.com",
  projectId: "rebecca-transport",
  storageBucket: "rebecca-transport.firebasestorage.app",
  messagingSenderId: "856152408861",
  appId: "1:856152408861:web:edac23bd3a69ff4d6a97f4",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// 19 nov. 2026, 15h42 : les enregistrements faits sans réseau sont gardés dans le téléphone (même si l'appli est
// fermée) et envoyés au retour du réseau. Sans cela, un paiement noté sans réseau pouvait se perdre.
let base;
try {
  // 22 nov. 2026, 12h31 (Rebecca : « ça reste bloqué sur chargement ») : avec le partage entre onglets, si l'appli est
  // aussi ouverte ailleurs (onglet Safari en veille, ancienne fenêtre), iOS endort cet onglet et TOUT reste bloqué en
  // attendant lui. Maintenant, la fenêtre ouverte en dernier prend la main ; les autres continuent sans mémoire hors ligne.
  base = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: true }) }) });
} catch {
  base = getFirestore(app);
}
export const db = base;
export const googleProvider = new GoogleAuthProvider();
