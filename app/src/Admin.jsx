import CentreNotifs from "./components/CentreNotifs.jsx";
import PrendreRdv from "./PrendreRdv.jsx";
import { SyncAgendaIphone } from "./components/AgendaIphone.jsx";
import { useEffect, useRef, useState } from "react";
import { createUserWithEmailAndPassword, getRedirectResult, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase.js";
import { definirEquipier } from "./accesDemandes.js";
import { NOM } from "./contact.js";
import TableauDeBord from "./TableauDeBord.jsx";
import Activites from "./Activites.jsx";
import SimulateurDevis from "./SimulateurDevis.jsx";
import RamassageScolaire from "./RamassageScolaire.jsx";
import Repertoire from "./Repertoire.jsx";
import { useChargerRepertoire } from "./repertoireBase.js";
import { useImportContratsRestos } from "./contratsRestosBase.js";
import Demandes from "./Demandes.jsx";
import Transferts, { useTransfertsATraiter } from "./Transferts.jsx";
import CommandesEpoxy from "./components/CommandesEpoxy.jsx";
import ProjetsDigital from "./ProjetsDigital.jsx";
import Partenaires from "./Partenaires.jsx";
import ProsAdmin from "./ProsAdmin.jsx";
import PagesProAdmin from "./PagesProAdmin.jsx"; // 27 nov. 2026 : generateur de pages professionnelles (lot 1)
import EspacePro from "./EspacePro.jsx";
import { lierComptePro, useComptePro } from "./prosBase.js";
import { lireAccesPro } from "./pricing/pros.js";
import EspaceCoursier from "./EspaceCoursier.jsx";
import { lireAccesCoursier } from "./pricing/coursiers.js";
import { definirLienAvisGoogle } from "./pricing/finCourse.js";
import Agenda from "./Agenda.jsx";
import Clients from "./Clients.jsx";
import Finances from "./Finances.jsx";
import ReglagesFondations from "./ReglagesFondations.jsx";
import SyncCreneaux from "./SyncCreneaux.jsx";
import SyncTournee from "./SyncTournee.jsx";
import { useCompteurs } from "./compteursBase.js";
import { deplacerDans, ordonner, parSections } from "./pricing/menuOrdre.js";
import CommandesResto, { useCompteurCommandesResto } from "./CommandesResto.jsx"; // 19 nov. 2026
import AssistanceAdmin from "./AssistanceAdmin.jsx"; // 19 nov. 2026 : assistance clients
import SyncComptes from "./comptesBase.js";
import ComptesEntreNous from "./ComptesEntreNous.jsx";
import Statistiques, { Rapports } from "./Statistiques.jsx";
import CartesCadeauxAdmin from "./components/CartesCadeauxAdmin.jsx";
import CodesPromo from "./CodesPromo.jsx";
import Reglages from "./Reglages.jsx";
import EquipeAdmin, { MesModes, MesReglages, MesVehicules } from "./EquipeAdmin.jsx";
import { EquipeContexte, useEquipeDonnees } from "./equipeContexte.jsx";
import { ADMIN_ID } from "./pricing/equipe.js";
import { demandeAcces, roleDe, rubriquesPour } from "./pricing/espaceEquipe.js";
import BandeauEnAttente from "./components/BandeauEnAttente.jsx";
import CommandesRestoAdmin from "./components/CommandesRestoAdmin.jsx"; // 19 nov. 2026 (V2) : bouton En ligne + restaurants
import { jouerSon, useStylesNotif } from "./sons.js";
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
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "E-mail ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet e-mail : touche « Créer mon compte ».",
  "auth/email-already-in-use": "Ce compte existe déjà : touche « Me connecter ».",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/too-many-requests": "Trop d'essais. Patiente quelques minutes.",
};

// 12 nov. 2026 : Jeremy n'arrivait pas a se connecter avec le lien envoye par WhatsApp. Les navigateurs integres
// (WhatsApp, Instagram, Facebook) bloquent la connexion Google. On le detecte pour le dire, et on propose aussi
// la connexion par e-mail et mot de passe (meme compte que sur le site).
const navigateurIntegre = () => typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//i.test(navigator.userAgent || "");

function ConnexionEmail({ setErreur }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState("");
  const agir = async (action) => {
    setErreur("");
    setInfo("");
    if (!email.trim()) return setErreur("Indique ton adresse e-mail.");
    setEnCours(true);
    try {
      if (action === "oubli") {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo("E-mail envoyé : clique sur le lien reçu pour choisir un nouveau mot de passe.");
      } else if (action === "creer") {
        const r = await createUserWithEmailAndPassword(auth, email.trim(), mdp);
        await sendEmailVerification(r.user);
        setInfo("Compte créé. Ouvre l'e-mail reçu et clique sur le lien de vérification, puis reviens ici.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), mdp);
      }
    } catch (e) {
      setErreur(MESSAGES[e.code] || "Connexion impossible. Réessaie.");
    }
    setEnCours(false);
    return undefined;
  };
  return (
    <form className="admin-email" onSubmit={(e) => { e.preventDefault(); agir("connexion"); }}>
      <label className="admin-texte" htmlFor="ad-email">Ou avec ton e-mail et un mot de passe</label>
      <input id="ad-email" type="email" autoComplete="email" inputMode="email" placeholder="ton.adresse@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" autoComplete="current-password" placeholder="Mot de passe (6 caractères minimum)" value={mdp} onChange={(e) => setMdp(e.target.value)} />
      <button className="admin-bouton" type="submit" disabled={enCours}>Me connecter</button>
      <button className="admin-bouton admin-secondaire" type="button" disabled={enCours} onClick={() => agir("creer")}>Créer mon compte</button>
      <button className="admin-lien" type="button" disabled={enCours} onClick={() => agir("oubli")}>Mot de passe oublié</button>
      {info && <p className="admin-texte" role="status">{info}</p>}
    </form>
  );
}

// Menu lateral de l'espace prive (D2a, 9 nov. 2026 : 10 rubriques validees en G2 + « Devis rapide » demande par Rebecca)
// 22 nov. 2026 : rangees par sections pour que ce soit clair (Rebecca Services d'un cote, les restaurants de l'autre)
const SECTIONS = [
  { id: "jour", label: "Ma journée" },
  { id: "rs", label: "Rebecca Services" },
  { id: "restos", label: "Restaurants partenaires" },
  { id: "pros", label: "Professionnels partenaires" },
  { id: "boutique", label: "Boutique et Digital" },
  { id: "carnet", label: "Carnet" },
  { id: "argent", label: "Chiffres et argent" },
  { id: "reglages", label: "Réglages" },
];
const RUBRIQUES = [
  { id: "agenda", label: "Calendrier", section: "jour" },
  { id: "tableau", label: "Tableau de bord", section: "jour" },
  { id: "rdv", label: "Prendre un rendez-vous", adminOnly: true, section: "jour" }, // 25 nov. 2026 : RDV beauté pris par Rebecca
  { id: "demandes", label: "Demandes et missions", section: "rs" },
  { id: "transferts", label: "Courses à accepter (équipe)", section: "rs" }, // 12 nov. 2026 : courses proposees entre Rebecca et Jeremy
  { id: "devis", label: "Devis rapide", section: "rs" },
  { id: "ramassage", label: "Ramassage scolaire", adminOnly: true, section: "rs" }, // 12 nov. 2026 : devis (rapides et du site) et tournee, a part
  { id: "assistance", label: "Assistance clients", adminOnly: true, section: "rs" }, // 19 nov. 2026 : messages des clients (bouton « 💬 Assistance »)
  { id: "clients", label: "Clients et codes promo", section: "rs" },
  { id: "commandes-resto", label: "Commandes restaurants", adminOnly: true, section: "restos" }, // 19 nov. 2026 : toutes les commandes des restaurants partenaires
  { id: "partenaires", label: "Partenaires (restos, coursiers)", adminOnly: true, section: "restos" },
  { id: "pages-restos", label: "Pages des restaurants", adminOnly: true, section: "restos" }, // 27 nov. 2026 : lot R1 // 17 nov. 2026 : inscriptions des futurs coursiers
  { id: "pros", label: "Annuaire des professionnels", adminOnly: true, section: "pros" }, // 25 nov. 2026 : réseau de professionnels partenaires
  { id: "pages-pros", label: "Pages des pros (Digital)", adminOnly: true, section: "pros" }, // 27 nov. 2026 : generateur de pages (lot 1)
  { id: "commandes-epoxy", label: "Commandes Epoxy", adminOnly: true, section: "boutique" },
  { id: "projets-digital", label: "Projets Digital", adminOnly: true, section: "boutique" }, // 17 nov. 2026 : devis, paiements 40/30/30, cahier des charges
  { id: "repertoire", label: "Répertoire", section: "carnet" }, // 12 nov. 2026 : mes lieux et les adresses des clientes (Rebecca et son equipe)
  { id: "comptes", label: "Comptes entre nous", adminOnly: true, section: "carnet" }, // 13 nov. 2026 : Alexia, gg... soldes dans les deux sens
  { id: "activites", label: "Activités", section: "argent" },
  { id: "finances", label: "Finances", section: "argent" },
  { id: "mesfinances", label: "Mes finances", section: "argent" }, // seulement pour un coequipier (J2) : jamais les finances de Rebecca
  { id: "statistiques", label: "Statistiques", section: "argent" },
  { id: "rapports", label: "Rapports et exports", section: "argent" },
  { id: "equipe", label: "Équipe", section: "reglages" },
  { id: "reglages", label: "Réglages", section: "reglages" },
];
// Anciens noms d'onglets (liens internes et memoire de la session)
const ALIAS = { aujourdhui: "tableau", promos: "clients" };
const nomRubrique = (o) => ALIAS[o] || o;

const MEMO = "rs-admin-onglet";
const ongletDepart = () => {
  // 19 nov. 2026, 15h42 : notification « 📍 Localise-toi » -> Calendrier (la position se prend toute seule)
  if (/[?&]localiser=1/.test(window.location.hash)) return "agenda";
  // 19 nov. 2026 : une notification peut ouvrir directement une rubrique (« ?onglet=commandes-resto »)
  const demande = (window.location.hash.match(/[?&]onglet=([a-z-]+)/) || [])[1];
  if (demande && RUBRIQUES.some((x) => x.id === demande)) return demande;
  try {
    const o = nomRubrique(sessionStorage.getItem(MEMO));
    if (RUBRIQUES.some((x) => x.id === o)) return o;
  } catch {
    /* stockage indisponible : on part du tableau de bord */
  }
  return "tableau";
};

// Coequipier (Lot J, J2) : sa fiche equipe/{uid} et sa demande d'acces demandesEquipe/{uid}.
// A la premiere connexion, la demande d'acces est creee ; Rebecca l'active dans la rubrique Equipe.
function useEquipe(user, estAdmin) {
  const [etat, setEtat] = useState({ pret: false, fiche: null, demande: null, erreur: false });
  const uid = user && !estAdmin ? user.uid : null;
  useEffect(() => {
    if (!uid) {
      setEtat({ pret: !!user, fiche: null, demande: null, erreur: false });
      return undefined;
    }
    let fiche, demande;
    const maj = () => fiche !== undefined && demande !== undefined && setEtat({ pret: true, fiche, demande, erreur: false });
    const echec = () => setEtat({ pret: true, fiche: null, demande: null, erreur: true });
    const a = onSnapshot(doc(db, "equipe", uid), (s) => { fiche = s.exists() ? { id: uid, ...s.data() } : null; maj(); }, echec);
    const b = onSnapshot(doc(db, "demandesEquipe", uid), (s) => {
      demande = s.exists() ? s.data() : null;
      maj();
    }, echec);
    return () => { a(); b(); };
  }, [uid]);
  return etat;
}

// 18 nov. 2026 : coursier partenaire (fiche coursiers/{uid}). Jamais membre de l'equipe : il n'a que son espace.
function useCoursier(user, estAdmin) {
  const [fiche, setFiche] = useState(undefined);
  const uid = user && !estAdmin && user.emailVerified ? user.uid : null;
  useEffect(() => {
    if (!uid) {
      setFiche(null);
      return undefined;
    }
    return onSnapshot(doc(db, "coursiers", uid), (s) => setFiche(s.exists() ? s.data() : null), () => setFiche(null));
  }, [uid]);
  return fiche;
}
const MEMO_COURSIER = "rs-acces-coursier";
// 25 nov. 2026 : lien d'invitation d'un professionnel partenaire (#/admin?pro=CODE), garde le temps de se connecter
const MEMO_PRO = "rs-acces-pro";
function accesPro() {
  const c = lireAccesPro(window.location.hash);
  try {
    if (c) sessionStorage.setItem(MEMO_PRO, c);
    return c || sessionStorage.getItem(MEMO_PRO) || "";
  } catch {
    return c;
  }
}
function accesCoursier() {
  const id = lireAccesCoursier(window.location.hash);
  try {
    if (id) sessionStorage.setItem(MEMO_COURSIER, id);
    return id || sessionStorage.getItem(MEMO_COURSIER) || "";
  } catch {
    return id;
  }
}

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
        <button className={"tdb-pil" + (vue === "cadeaux" ? " actif" : "")} onClick={() => setVue("cadeaux")}>🎁 Cartes cadeaux</button>
      </div>
      {vue === "clients" ? <Clients key={"c" + (cible || "")} aller={aller} cible={cible} /> : vue === "cadeaux" ? <CartesCadeauxAdmin /> : <CodesPromo aller={aller} />}
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
  // 18 nov. 2026 : lien « avis Google » ajouté aux messages de remerciement
  useEffect(() => onSnapshot(doc(db, "reglages", "paiement"), (s) => definirLienAvisGoogle(s.exists() ? s.data().avisGoogle : ""), () => {}), []);
  // Retour d'une connexion Google par redirection (quand la fenetre Google est bloquee)
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setErreur(MESSAGES[e.code] || ""));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(MEMO, onglet);
    } catch {
      /* sans importance */
    }
  }, [onglet]);

  // Navigation entre onglets, avec ouverture directe d'un element si besoin
  const [menu, setMenu] = useState(false);
  // 19 nov. 2026 : ordre du menu choisi par Rebecca (gardé sur ce téléphone), et le mode « Ranger le menu »
  const [ordreMenu, setOrdreMenu] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("rs-menu-ordre") || "[]");
    } catch {
      return [];
    }
  });
  const [ranger, setRanger] = useState(false);
  const changerOrdre = (suite) => {
    setOrdreMenu(suite);
    try {
      localStorage.setItem("rs-menu-ordre", JSON.stringify(suite));
    } catch {
      /* stockage indisponible : l'ordre vaut pour cette fois */
    }
  };
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
      // Fenetre bloquee ou impossible ici : on passe par une redirection vers Google
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          /* message ci-dessous */
        }
      }
      setErreur(MESSAGES[e.code] || "Connexion impossible. Réessayez.");
    }
    setEnCours(false);
  };

  const deconnecter = () => signOut(auth);

  const estAdmin = !!user && user.email === ADMIN_EMAIL && user.emailVerified;
  const equipe = useEquipe(user, estAdmin);
  const coursier = useCoursier(user, estAdmin);
  const comptePro = useComptePro(user && !estAdmin && user.emailVerified ? user.uid : null);
  const lierPro = async () => {
    setErreur("");
    try {
      await lierComptePro(user, accesPro());
    } catch (e) {
      setErreur(e && e.message && !/permission/i.test(e.message) ? e.message : `Liaison impossible : connecte-toi avec l'adresse que tu as donnée à Rebecca (${user.email} n'est pas celle de l'invitation), ou demande-lui un nouveau lien.`);
    }
  };
  const lierCoursier = async () => {
    setErreur("");
    const candidature = accesCoursier();
    try {
      const suivi = await getDoc(doc(db, "suiviPartenaires", candidature));
      if (!suivi.exists() || suivi.data().statut !== "approuve") return setErreur("Ta candidature n'est pas encore approuvée. Vois avec Rebecca.");
      await setDoc(doc(db, "coursiers", user.uid), { candidature, prenom: suivi.data().prenom || "", email: user.email || "", statut: "a_activer", disponible: false, creeLe: serverTimestamp() });
    } catch {
      setErreur("Liaison impossible pour l'instant. Réessaie ou préviens Rebecca.");
    }
  };
  const donneesEquipe = useEquipeDonnees(); // J3 : equipe et vehicules (lecture refusee avant les regles v9 = Rebecca seule)
  const role = user ? roleDe({ estAdmin, fiche: equipe.fiche, demande: equipe.demande }) : "aucun";
  useChargerRepertoire(role === "admin" || role === "equipe"); // repertoire d'adresses : charge une fois pour tous les champs d'adresse
  useImportContratsRestos(role === "admin"); // 19 nov. 2026 : un restaurant qui signe arrive tout seul dans le Répertoire
  const permises = rubriquesPour(role); // null = toutes (Rebecca)
  const rubriques = parSections(ordonner(permises ? RUBRIQUES.filter((r) => permises.includes(r.id)) : RUBRIQUES.filter((r) => r.id !== "mesfinances"), ordreMenu), SECTIONS);
  if ((role === "admin" || role === "equipe") && rubriques.length && !rubriques.some((r) => r.id === onglet)) {
    setTimeout(() => setOnglet(rubriques[0].id), 0);
  }

  // Premiere connexion d'un coequipier : sa demande d'acces est creee (jamais de droits : Rebecca decide)
  const demander = async () => {
    try {
      await setDoc(doc(db, "demandesEquipe", user.uid), { ...demandeAcces(user), creeLe: serverTimestamp() });
    } catch {
      setErreur("Demande d'accès impossible pour l'instant. Réessaie plus tard ou préviens Rebecca.");
    }
  };

  // Espace de Rebecca (tout) ou d'un coequipier actif (ses activites, sans les finances de Rebecca)
  // v15 : un coequipier ne lit que les demandes du coursier et du transport (jamais la beaute)
  definirEquipier(role === "equipe");
  // 12 nov. 2026 : courses proposees a accepter (compteur du menu + bandeau en haut de chaque page)
  const moiId = role === "equipe" && equipe.fiche ? equipe.fiche.id : ADMIN_ID;
  const aTraiter = useTransfertsATraiter(role === "admin" || role === "equipe", moiId);
  // 15 nov. 2026 : nombre de choses a traiter a cote de chaque rubrique du menu
  const commandesResto = useCompteurCommandesResto(role === "admin");
  const compteurs = { ...useCompteurs(role), transferts: aTraiter, "commandes-resto": commandesResto };
  const totalATraiter = Object.values(compteurs).reduce((n, x) => n + (x || 0), 0);
  // 19 nov. 2026, 15h42 : appli ouverte -> 3 clochettes (au choix) quand une nouvelle chose à traiter arrive
  const stylesNotif = useStylesNotif(role === "admin");
  const avantTotal = useRef(null);
  useEffect(() => {
    if (avantTotal.current != null && totalATraiter > avantTotal.current) jouerSon(stylesNotif.nouvelle.son);
    avantTotal.current = totalATraiter;
  }, [totalATraiter]); // eslint-disable-line react-hooks/exhaustive-deps
  // 18 nov. 2026 : espace d'un coursier partenaire actif (rien d'autre)
  if (coursier && coursier.statut === "actif") return <EspaceCoursier uid={user.uid} fiche={coursier} deconnecter={deconnecter} />;
  // 25 nov. 2026 : espace d'un professionnel partenaire (son agenda, rien d'autre)
  if (comptePro && comptePro.statut === "actif") return <EspacePro compte={comptePro} deconnecter={deconnecter} />;

  if (role === "admin" || role === "equipe") {
    const membre = role === "equipe" ? equipe.fiche : null;
    const moi = membre ? membre.id : ADMIN_ID;
    const membres = donneesEquipe.membres.some((m) => m.id === moi) ? donneesEquipe.membres : [...donneesEquipe.membres, membre];
    const contexte = { membres, vehicules: donneesEquipe.vehicules, moi, membre };
    const moiFiche = membres.find((m) => m.id === moi) || {};
    const vehiculesBloc = <section className="tb-pad"><MesVehicules moi={moi} nomMoi={moiFiche.nom || "moi"} membres={membres} vehicules={donneesEquipe.vehicules} modes={moiFiche.modes} /></section>;
    const props = { aller };
    let contenu;
    if (onglet === "tableau") contenu = <TableauDeBord {...props} membre={membre} />;
    else if (onglet === "devis") contenu = <SimulateurDevis {...props} />;
    else if (onglet === "ramassage" && estAdmin) contenu = <RamassageScolaire {...props} />;
    else if (onglet === "rdv") contenu = <PrendreRdv />;
    else if (onglet === "repertoire") contenu = <Repertoire key={"r" + (cibleDe("repertoire") || "")} aller={aller} cible={cibleDe("repertoire")} />;
    else if (onglet === "activites") contenu = <Activites key={"a" + (cibleDe("activites") || "")} {...props} cible={cibleDe("activites")} membre={membre} />;
    else if (onglet === "commandes-resto" && estAdmin) contenu = <CommandesResto aller={aller} />;
    else if (onglet === "assistance" && estAdmin) contenu = <AssistanceAdmin />;
    else if (onglet === "commandes-epoxy" && estAdmin) contenu = <CommandesEpoxy onRetour={() => setOnglet("demandes")} />;
    else if (onglet === "projets-digital" && estAdmin) contenu = <ProjetsDigital />;
    else if (onglet === "partenaires" && estAdmin) contenu = <Partenaires aller={aller} />;
    else if (onglet === "pros" && estAdmin) contenu = <ProsAdmin />;
    else if (onglet === "pages-pros" && estAdmin) contenu = <PagesProAdmin />;
    else if (onglet === "pages-restos" && estAdmin) contenu = <PagesProAdmin key="restos" univers="restos" />;
    else if (onglet === "transferts") contenu = <Transferts {...props} />;
    else if (onglet === "demandes") contenu = <Demandes key={"d" + (cibleDe("demandes") || "")} {...props} cible={cibleDe("demandes")} membre={membre} />;
    else if (onglet === "agenda") contenu = <Agenda {...props} />;
    else if (onglet === "equipe") contenu = <EquipeAdmin />;
    else if (onglet === "mesfinances") contenu = <Finances {...props} membre={membre} />; // J4a : seulement les siennes
    else if (onglet === "clients") contenu = <ClientsEtPromos key={"cp" + (cible.sous || "") + (cibleDe("clients") || "")} {...props} cible={cibleDe("clients")} sousOnglet={cible.onglet === "clients" ? cible.sous : null} />;
    else if (onglet === "finances") contenu = <Finances {...props} />;
    else if (onglet === "comptes" && estAdmin) contenu = <ComptesEntreNous />;
    else if (onglet === "statistiques") contenu = <Statistiques membre={membre} />; // Lot C, C4
    else if (onglet === "rapports") contenu = <Rapports membre={membre} />; // Lot C, C5
    else if (membre) contenu = <><MesReglages key={membre.id} membre={membre} />{vehiculesBloc}</>;
    else contenu = <ReglagesFondations general={<><section className="tb-pad"><MesModes id="rebecca" /></section>{vehiculesBloc}<Reglages {...props} /></>} />; // Lot C : Tarifs, Catalogue, Activites

    return (
      <EquipeContexte.Provider value={contexte}>
      {role === "admin" && <SyncCreneaux />}
      {role === "admin" && <SyncTournee />}
      {role === "admin" && <SyncAgendaIphone />}
      {role === "admin" && <SyncComptes />}
      <div className="admin admin-tableau theme-sombre">
        <header className="ts-entete">
          <button className="ts-burger" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu}>
            <i /><i /><i />
            {totalATraiter > 0 && <span className="ts-pastille" aria-label={`${totalATraiter} à traiter`}>{totalATraiter > 99 ? "99+" : totalATraiter}</span>}
          </button>
          <span className="ts-titre" style={{ flex: 1 }}>{(rubriques.find((r) => r.id === onglet) || rubriques[0]).label}</span>
          {role === "admin" && <CentreNotifs aTraiter={rubriques.filter((r) => compteurs[r.id] > 0).map((r) => ({ id: r.id, label: r.label, n: compteurs[r.id] }))} onAller={aller} />}
        </header>
        <div className={"ts-voile" + (menu ? " ouvert" : "")} onClick={() => setMenu(false)} aria-hidden="true" />
        <nav className={"ts-menu" + (menu ? " ouvert" : "")} aria-label="Rubriques">
          <div className="ts-marque">
            <img src="/brand/logo-medaillon%20.png" alt="" />
            <div><b>{NOM}</b><span>{role === "admin" ? "Administration" : "Espace équipe · " + (equipe.fiche.nom || user.email)}</span></div>
          </div>
          {rubriques.map((r, i) => [
            r.section && (i === 0 || rubriques[i - 1].section !== r.section) && <p key={"s-" + r.section} className="ts-section">{(SECTIONS.find((x) => x.id === r.section) || {}).label}</p>,
            ranger ? (
              <div key={r.id} className="ts-lien" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{r.label}</span>
                <button type="button" className="rp-waze" aria-label={`Monter ${r.label}`} onClick={() => changerOrdre(deplacerDans(rubriques, r.id, -1))}>↑</button>
                <button type="button" className="rp-waze" aria-label={`Descendre ${r.label}`} onClick={() => changerOrdre(deplacerDans(rubriques, r.id, 1))}>↓</button>
              </div>
            ) : (
              <button key={r.id} className={"ts-lien" + (onglet === r.id ? " actif" : "")} aria-current={onglet === r.id ? "page" : undefined} onClick={() => aller(r.id)}>
                <span className="ts-point" />
                {r.label}
                {compteurs[r.id] > 0 && <span className="tr-compteur" aria-label={`${compteurs[r.id]} à traiter`}>{compteurs[r.id]}</span>}
              </button>
            ),
          ])}
          <div className="ts-pied">
            <button className="ts-lien" onClick={() => setRanger(!ranger)}>{ranger ? "✓ Terminer le rangement" : "✏️ Ranger le menu"}</button>
            {ranger && <button className="ts-lien" onClick={() => changerOrdre([])}>↺ Ordre d'origine</button>}
            <a className="ts-lien" href="#/">← Retour au site</a>
            <button className="ts-lien" onClick={deconnecter}>Se déconnecter</button>
          </div>
        </nav>
        <main className="ts-contenu">
          <BandeauEnAttente />
          {role === "admin" && <CommandesRestoAdmin aller={aller} barre={false} />}
          {aTraiter > 0 && onglet !== "transferts" && (
            <button type="button" className="tr-bandeau" onClick={() => aller("transferts")}>
              🔔 {aTraiter === 1 ? "1 course proposée dans l'équipe (à accepter) ou une réponse à voir" : `${aTraiter} courses proposées dans l'équipe ou réponses à voir`} · Voir
            </button>
          )}
          {contenu}
        </main>
      </div>
      </EquipeContexte.Provider>
    );
  }

  return (
    <div className="admin theme-sombre">
      <div className="admin-carte">
        <p className="admin-surtitre">{NOM}</p>
        <h1>Espace privé</h1>

        {user === undefined && <p className="admin-texte">Chargement…</p>}

        {user === null && (
          <>
            <p className="admin-texte">Cet espace est réservé à Rebecca et à son équipe.</p>
            {navigateurIntegre() && (
              <p className="admin-erreur" role="alert">Tu as ouvert ce lien dans WhatsApp (ou Instagram) : Google y bloque la connexion. Touche les trois points ⋯ ou l'icône de partage, puis « Ouvrir dans Safari » (ou Chrome), et reconnecte-toi là.</p>
            )}
            <button className="admin-bouton" onClick={connecter} disabled={enCours}>
              {enCours ? "Connexion…" : "Se connecter avec Google"}
            </button>
            <ConnexionEmail setErreur={setErreur} />
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && !user.emailVerified && (
          <>
            <p className="admin-texte"><strong>Vérifie ton adresse e-mail</strong> ({user.email}) : ouvre l'e-mail reçu et clique sur le lien, puis touche « C'est fait ».</p>
            <button className="admin-bouton" onClick={async () => { await user.reload(); window.location.reload(); }}>C'est fait</button>
            <button className="admin-bouton admin-secondaire" onClick={() => sendEmailVerification(user).then(() => setErreur("E-mail renvoyé.")).catch(() => setErreur("Envoi impossible, réessaie dans quelques minutes."))}>Renvoyer l'e-mail</button>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && user.emailVerified && !equipe.pret && <p className="admin-texte">Chargement…</p>}

        {user && !estAdmin && user.emailVerified && coursier && coursier.statut !== "actif" && (
          <>
            <p className="admin-texte"><strong>{coursier.statut === "suspendu" ? "Ton compte de coursier est suspendu." : "Compte coursier lié ✓"}</strong></p>
            <p className="admin-texte">{coursier.statut === "suspendu" ? "Vois avec Rebecca." : "Rebecca active ton espace : cette page s'ouvrira toute seule ensuite."}</p>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        {user && !estAdmin && user.emailVerified && comptePro && comptePro.statut !== "actif" && (
          <>
            <p className="admin-texte"><strong>Ton espace professionnel est suspendu.</strong></p>
            <p className="admin-texte">Vois avec Rebecca.</p>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        {user && !estAdmin && user.emailVerified && !comptePro && comptePro !== undefined && !coursier && role === "aucun" && accesPro() && (
          <>
            <p className="admin-texte">Tu es professionnel partenaire de Rebecca Services ? Lie ce compte ({user.email}) à ton espace pro.</p>
            <button className="admin-bouton" onClick={lierPro}>Lier mon espace pro</button>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && user.emailVerified && !coursier && coursier !== undefined && equipe.pret && role === "aucun" && accesCoursier() && !accesPro() && (
          <>
            <p className="admin-texte">Tu es coursier partenaire de Rebecca Services ? Lie ce compte ({user.email}) à ta candidature approuvée.</p>
            <button className="admin-bouton" onClick={lierCoursier}>Lier mon compte coursier</button>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && user.emailVerified && !coursier && coursier !== undefined && equipe.pret && role === "aucun" && !accesCoursier() && !accesPro() && !comptePro && (
          <>
            <p className="admin-texte">Ce compte ({user.email}) n'a pas encore accès à l'espace privé.</p>
            <p className="admin-texte">Tu fais partie de l'équipe ? Envoie une demande d'accès : Rebecca l'activera.</p>
            <button className="admin-bouton" onClick={demander}>Demander l'accès</button>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
          </>
        )}

        {user && !estAdmin && user.emailVerified && equipe.pret && role === "attente" && (
          <>
            <p className="admin-texte"><strong>Demande d'accès envoyée.</strong></p>
            <p className="admin-texte">Rebecca doit l'activer dans son espace (rubrique Équipe). Cette page s'ouvrira toute seule ensuite.</p>
            <p className="admin-texte">{user.email}</p>
            <button className="admin-bouton admin-secondaire" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        {user && !estAdmin && user.emailVerified && equipe.pret && role === "refuse" && (
          <>
            <p className="admin-erreur" role="alert">Ta demande d'accès n'a pas été acceptée. Vois avec Rebecca.</p>
            <button className="admin-bouton" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        {user && !estAdmin && user.emailVerified && equipe.pret && role === "desactive" && (
          <>
            <p className="admin-erreur" role="alert">Ton accès est désactivé. Vois avec Rebecca.</p>
            <button className="admin-bouton" onClick={deconnecter}>Se déconnecter</button>
          </>
        )}

        <a className="admin-retour" href="#/">← Retour au site</a>
      </div>
    </div>
  );
}
