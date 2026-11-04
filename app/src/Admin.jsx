import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";
import { NOM } from "./contact.js";
import Demandes from "./Demandes.jsx";
import Agenda from "./Agenda.jsx";
import Depenses from "./Depenses.jsx";
import Bilan from "./Bilan.jsx";
import CodesPromo from "./CodesPromo.jsx";
import "./admin.css";

// Seul ce compte Google est l'administrateur.
// La vraie protection des donnees est dans les regles de securite Firestore.
export const ADMIN_EMAIL = "przrebecca26@gmail.com";

const MESSAGES = {
  "auth/popup-closed-by-user": "Connexion annulée.",
  "auth/cancelled-popup-request": "Connexion annulée.",
  "auth/popup-blocked": "Votre navigateur a bloqué la fenêtre Google. Autorisez-la puis réessayez.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase (domaines autorisés).",
  "auth/network-request-failed": "Pas de connexion internet. Réessayez.",
};

export default function Admin() {
  const [user, setUser] = useState(undefined); // undefined = chargement, null = deconnectee
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [onglet, setOnglet] = useState("demandes");

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  const connecter = async () => {
    setErreur("");
    setEnCours(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setErreur(MESSAGES[e.code] || "Connexion impossible. Réessayez.");
    }
    setEnCours(false);
  };

  const deconnecter = () => signOut(auth);

  const estAdmin = !!user && user.email === ADMIN_EMAIL && user.emailVerified;

  // Tableau de bord de Rebecca
  if (estAdmin) {
    return (
      <div className="admin admin-tableau">
        <header className="tb-entete">
          <div>
            <p className="admin-surtitre">{NOM}</p>
            <h1>Mon activité</h1>
          </div>
          <button className="tb-sortir" onClick={deconnecter}>Se déconnecter</button>
        </header>
        <nav className="tb-onglets" aria-label="Sections">
          <button className={"tb-onglet" + (onglet === "demandes" ? " actif" : "")} onClick={() => setOnglet("demandes")}>Demandes</button>
          <button className={"tb-onglet" + (onglet === "agenda" ? " actif" : "")} onClick={() => setOnglet("agenda")}>Agenda</button>
          <button className={"tb-onglet" + (onglet === "depenses" ? " actif" : "")} onClick={() => setOnglet("depenses")}>Dépenses</button>
          <button className={"tb-onglet" + (onglet === "bilan" ? " actif" : "")} onClick={() => setOnglet("bilan")}>Bilan</button>
          <button className={"tb-onglet" + (onglet === "promos" ? " actif" : "")} onClick={() => setOnglet("promos")}>Promos</button>
        </nav>
        {onglet === "demandes" ? <Demandes /> : onglet === "agenda" ? <Agenda /> : onglet === "depenses" ? <Depenses /> : onglet === "bilan" ? <Bilan /> : <CodesPromo />}
        <a className="admin-retour tb-pad" href="#/">← Retour au site</a>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin-carte">
        <p className="admin-surtitre">{NOM}</p>
        <h1>Espace privé</h1>

        {user === undefined && <p className="admin-texte">Chargement…</p>}

        {user === null && (
          <>
            <p className="admin-texte">Cet espace est réservé à Rebecca.</p>
            <button className="admin-bouton" onClick={connecter} disabled={enCours}>
              {enCours ? "Connexion…" : "Se connecter avec Google"}
            </button>
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && (
          <>
            <p className="admin-erreur" role="alert">Accès refusé : ce compte n'est pas autorisé.</p>
            <p className="admin-texte">{user.email}</p>
            <button className="admin-bouton" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        <a className="admin-retour" href="#/">← Retour au site</a>
      </div>
    </div>
  );
}
