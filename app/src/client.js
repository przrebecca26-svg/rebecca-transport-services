import { useSyncExternalStore } from "react";

// ETAT DU CLIENT CONNECTE - partage par tout le site (formulaires, accueil, espace "Mon compte").
// Firebase est charge a la demande : un visiteur qui n'a jamais ouvert de compte ne telecharge rien de plus.
//   phase : "inconnu" (pas encore regarde) | "chargement" | "anonyme" | "connecte"
//   "connecte" + user.emailVerified + profil = compte complet et ouvert.

const INDICE = "rts_client"; // memorise qu'un compte a deja ete utilise sur cet appareil
const lireIndice = () => {
  try {
    return window.localStorage.getItem(INDICE) === "1";
  } catch {
    return false;
  }
};
const ecrireIndice = (oui) => {
  try {
    if (oui) window.localStorage.setItem(INDICE, "1");
    else window.localStorage.removeItem(INDICE);
  } catch {
    /* navigation privee : sans importance */
  }
};

let etat = { phase: "inconnu", user: null, profil: null, erreur: "" };
const abonnes = new Set();
const maj = (p) => {
  etat = { ...etat, ...p };
  abonnes.forEach((f) => f());
};

export const lireEtat = () => etat;
export const compteOuvert = (e = etat) => e.phase === "connecte" && !!e.user && e.user.emailVerified === true && !!e.profil;

let demarre = false;
let creation = false; // vrai pendant la creation d'un compte : creerCompte gere alors la fiche lui-meme
export const pendantCreation = (oui) => {
  creation = oui;
};
// Ce que la personne a saisi a l'inscription quand sa fiche n'a pas pu etre enregistree (reprise a l'ecran "Terminez votre compte")
let brouillon = null;
export const garderBrouillon = (f) => {
  brouillon = f;
};
export const lireBrouillon = () => brouillon;
export const definirProfil = (profil, user) => maj({ profil, user: user || etat.user, phase: "connecte", erreur: "" });

// Charge la fiche d'un compte dont l'e-mail est verifie (sinon l'acces reste ferme : les regles Firebase le refusent aussi)
async function chargerFiche(u, encore = () => true) {
  const [{ reload }, { doc, getDoc, serverTimestamp, updateDoc }, { db }] = await Promise.all([import("firebase/auth"), import("firebase/firestore"), import("./firebase.js")]);
  if (!u.emailVerified) {
    try {
      await reload(u); // le client vient peut-etre de cliquer sur le lien de verification
      if (u.emailVerified) await u.getIdToken(true); // nouveau jeton : il porte maintenant "e-mail verifie"
    } catch {
      /* hors connexion : on reste sur l'ecran de verification */
    }
  }
  if (!encore()) return;
  if (!u.emailVerified) {
    maj({ user: u, profil: null, phase: "connecte", erreur: "" });
    return;
  }
  try {
    const s = await getDoc(doc(db, "clients", u.uid));
    if (!encore()) return;
    let p = s.exists() ? s.data() : null;
    // E-mail change (nouveau mail confirme) : la fiche suit le compte
    if (p && u.email && p.email !== u.email) {
      try {
        await updateDoc(doc(db, "clients", u.uid), { email: u.email, majLe: serverTimestamp() });
        p = { ...p, email: u.email };
      } catch {
        /* sera retente a la prochaine ouverture */
      }
    }
    maj({ user: u, profil: p, phase: "connecte", erreur: "" });
  } catch {
    if (encore()) maj({ user: u, profil: null, phase: "connecte", erreur: "Lecture de votre fiche impossible. Vérifiez la connexion puis réessayez." });
  }
}

// Demarre le suivi de la connexion. Sans "force", un visiteur sans compte connu sur cet appareil n'est pas suivi (rien a charger).
export function demarrer(force = false) {
  if (demarre) return;
  if (!force && !lireIndice()) {
    if (etat.phase === "inconnu") maj({ phase: "anonyme" });
    return;
  }
  demarre = true;
  maj({ phase: "chargement" });
  Promise.all([import("firebase/auth"), import("./firebase.js")])
    .then(([{ onAuthStateChanged }, { auth }]) => {
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          ecrireIndice(false);
          maj({ phase: "anonyme", user: null, profil: null, erreur: "" });
          return;
        }
        ecrireIndice(true);
        if (creation) {
          maj({ user: u, phase: "connecte" });
          return;
        }
        maj({ user: u, profil: null, phase: "chargement" });
        await chargerFiche(u);
      });
    })
    .catch(() => {
      demarre = false;
      maj({ phase: "anonyme", erreur: "" });
    });
}

// Relit la fiche du compte actuel (apres une modification, ou apres la verification de l'e-mail)
export async function rafraichir() {
  if (etat.user) await chargerFiche(etat.user);
}

const abonner = (f) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};
export const useClient = () => useSyncExternalStore(abonner, lireEtat, lireEtat);
