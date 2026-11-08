import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";
import { NOM } from "./contact.js";
import Aujourdhui from "./Aujourdhui.jsx";
import Demandes from "./Demandes.jsx";
import Agenda from "./Agenda.jsx";
import Clients from "./Clients.jsx";
import Finances from "./Finances.jsx";
import CodesPromo from "./CodesPromo.jsx";
import Reglages from "./Reglages.jsx";
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

// Onglets de l'espace prive (Lot B), dans l'ordre d'affichage
const ONGLETS = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "demandes", label: "Demandes" },
  { id: "agenda", label: "Agenda" },
  { id: "clients", label: "Clients" },
  { id: "finances", label: "Finances" },
  { id: "promos", label: "Promos" },
  { id: "reglages", label: "Réglages" },
];

const MEMO = "rs-admin-onglet";
const ongletDepart = () => {
  try {
    const o = sessionStorage.getItem(MEMO);
    if (ONGLETS.some((x) => x.id === o)) return o;
  } catch {
    /* stockage indisponible : on part de « Aujourd'hui » */
  }
  return "aujourdhui";
};

export default function Admin() {
  const [user, setUser] = useState(undefined); // undefined = chargement, null = deconnectee
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [onglet, setOnglet] = useState(ongletDepart);
  // cible : element a ouvrir directement dans l'onglet choisi (une demande, une fiche client)
  const [cible, setCible] = useState({ onglet: null, id: null });

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(MEMO, onglet);
    } catch {
      /* sans importance */
    }
  }, [onglet]);

  // Navigation entre onglets, avec ouverture directe d'un element si besoin
  const aller = (o, id = null) => {
    setCible({ onglet: o, id });
    setOnglet(o);
    window.scrollTo(0, 0);
  };
  const cibleDe = (o) => (cible.onglet === o ? cible.id : null);

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
    const props = { aller };
    let contenu;
    if (onglet === "aujourdhui") contenu = <Aujourdhui {...props} />;
    else if (onglet === "demandes") contenu = <Demandes key={"d" + (cibleDe("demandes") || "")} {...props} cible={cibleDe("demandes")} />;
    else if (onglet === "agenda") contenu = <Agenda {...props} />;
    else if (onglet === "clients") contenu = <Clients key={"c" + (cibleDe("clients") || "")} {...props} cible={cibleDe("clients")} />;
    else if (onglet === "finances") contenu = <Finances {...props} />;
    else if (onglet === "promos") contenu = <CodesPromo {...props} />;
    else contenu = <Reglages {...props} />;

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
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={"tb-onglet" + (onglet === o.id ? " actif" : "")}
              aria-current={onglet === o.id ? "page" : undefined}
              onClick={() => aller(o.id)}
            >
              {o.label}
            </button>
          ))}
        </nav>
        {contenu}
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
