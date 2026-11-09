import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";
import { NOM } from "./contact.js";
import TableauDeBord from "./TableauDeBord.jsx";
import Activites from "./Activites.jsx";
import SimulateurDevis from "./SimulateurDevis.jsx";
import Demandes from "./Demandes.jsx";
import Agenda from "./Agenda.jsx";
import Clients from "./Clients.jsx";
import Finances from "./Finances.jsx";
import CodesPromo from "./CodesPromo.jsx";
import Reglages from "./Reglages.jsx";
import "./admin.css";
import "./theme-admin.css";

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

// Menu lateral de l'espace prive (D2a, 9 nov. 2026 : 10 rubriques validees en G2 + « Devis rapide » demande par Rebecca)
const RUBRIQUES = [
  { id: "tableau", label: "Tableau de bord" },
  { id: "devis", label: "Devis rapide" },
  { id: "activites", label: "Activités" },
  { id: "demandes", label: "Demandes et missions" },
  { id: "agenda", label: "Calendrier" },
  { id: "equipe", label: "Équipe" },
  { id: "clients", label: "Clients et codes promo" },
  { id: "finances", label: "Finances" },
  { id: "statistiques", label: "Statistiques" },
  { id: "rapports", label: "Rapports et exports" },
  { id: "reglages", label: "Réglages" },
];
// Anciens noms d'onglets (liens internes et memoire de la session)
const ALIAS = { aujourdhui: "tableau", promos: "clients" };
const nomRubrique = (o) => ALIAS[o] || o;

const MEMO = "rs-admin-onglet";
const ongletDepart = () => {
  try {
    const o = nomRubrique(sessionStorage.getItem(MEMO));
    if (RUBRIQUES.some((x) => x.id === o)) return o;
  } catch {
    /* stockage indisponible : on part du tableau de bord */
  }
  return "tableau";
};

// Rubrique pas encore construite : message clair, jamais de faux chiffres
function Bientot({ titre, texte, bouton, aller }) {
  return (
    <div className="tdb">
      <div className="tdb-tete"><h1>{titre}</h1></div>
      <div className="tdb-bloc">
        <span className="tdb-badge bientot">Bientôt</span>
        <p className="tdb-texte">{texte}</p>
        {bouton && <button className="tdb-bouton" onClick={() => aller(bouton.vers)}>{bouton.label}</button>}
      </div>
    </div>
  );
}

// Clients et codes promo : deux onglets dans la meme rubrique
function ClientsEtPromos({ aller, cible, sousOnglet }) {
  const [vue, setVue] = useState(sousOnglet || "clients");
  return (
    <>
      <div className="tdb-sous-onglets">
        <button className={"tdb-pil" + (vue === "clients" ? " actif" : "")} onClick={() => setVue("clients")}>Clients</button>
        <button className={"tdb-pil" + (vue === "promos" ? " actif" : "")} onClick={() => setVue("promos")}>Codes promo</button>
      </div>
      {vue === "clients" ? <Clients key={"c" + (cible || "")} aller={aller} cible={cible} /> : <CodesPromo aller={aller} />}
    </>
  );
}

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
  const [menu, setMenu] = useState(false);
  const aller = (o, id = null) => {
    const r = nomRubrique(o);
    setCible({ onglet: r, id, sous: o === "promos" ? "promos" : null });
    setOnglet(r);
    setMenu(false);
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

  // Espace de Rebecca : menu lateral + rubrique choisie
  if (estAdmin) {
    const props = { aller };
    let contenu;
    if (onglet === "tableau") contenu = <TableauDeBord {...props} />;
    else if (onglet === "devis") contenu = <SimulateurDevis {...props} />;
    else if (onglet === "activites") contenu = <Activites key={"a" + (cibleDe("activites") || "")} {...props} cible={cibleDe("activites")} />;
    else if (onglet === "demandes") contenu = <Demandes key={"d" + (cibleDe("demandes") || "")} {...props} cible={cibleDe("demandes")} />;
    else if (onglet === "agenda") contenu = <Agenda {...props} />;
    else if (onglet === "equipe") contenu = <Bientot titre="Équipe" texte="La gestion de l'équipe (fiche de Jérémy, ses services, ses modes de transport, ses missions) arrive avec son espace personnel." aller={aller} />;
    else if (onglet === "clients") contenu = <ClientsEtPromos key={"cp" + (cible.sous || "") + (cibleDe("clients") || "")} {...props} cible={cibleDe("clients")} sousOnglet={cible.onglet === "clients" ? cible.sous : null} />;
    else if (onglet === "finances") contenu = <Finances {...props} />;
    else if (onglet === "statistiques") contenu = <Bientot titre="Statistiques" texte="Les statistiques comparées (deux périodes, toutes les activités) arrivent avec les fondations. En attendant, chaque activité active a son tableau de bord avec ses graphiques." bouton={{ label: "Ouvrir Mes activités", vers: "activites" }} aller={aller} />;
    else if (onglet === "rapports") contenu = <Bientot titre="Rapports et exports" texte="Les rapports PDF et Excel arrivent avec les fondations. En attendant, la sauvegarde complète et le journal CSV sont dans Finances." bouton={{ label: "Ouvrir Finances", vers: "finances" }} aller={aller} />;
    else contenu = <Reglages {...props} />;

    return (
      <div className="admin admin-tableau theme-sombre">
        <header className="ts-entete">
          <button className="ts-burger" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu}>
            <i /><i /><i />
          </button>
          <span className="ts-titre">{(RUBRIQUES.find((r) => r.id === onglet) || RUBRIQUES[0]).label}</span>
        </header>
        <div className={"ts-voile" + (menu ? " ouvert" : "")} onClick={() => setMenu(false)} aria-hidden="true" />
        <nav className={"ts-menu" + (menu ? " ouvert" : "")} aria-label="Rubriques">
          <div className="ts-marque">
            <img src="/brand/logo-medaillon%20.png" alt="" />
            <div><b>{NOM}</b><span>Administration</span></div>
          </div>
          {RUBRIQUES.map((r) => (
            <button key={r.id} className={"ts-lien" + (onglet === r.id ? " actif" : "")} aria-current={onglet === r.id ? "page" : undefined} onClick={() => aller(r.id)}>
              <span className="ts-point" />
              {r.label}
            </button>
          ))}
          <div className="ts-pied">
            <a className="ts-lien" href="#/">← Retour au site</a>
            <button className="ts-lien" onClick={deconnecter}>Se déconnecter</button>
          </div>
        </nav>
        <main className="ts-contenu">{contenu}</main>
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
