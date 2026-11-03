// CONNEXION FIREBASE - Rebecca Transport & Services
// Ces identifiants ne sont PAS secrets (ils sont visibles dans tout site Firebase).
// La securite repose sur la connexion administrateur et les regles Firestore.

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
