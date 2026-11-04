import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase.js";
import { MOT_DE_PASSE_MIN, construireProfil, emailValide, erreurMotDePasse, formulaireInitial, validerProfil } from "./profil.js";
import { definirProfil, garderBrouillon, lireBrouillon, pendantCreation, rafraichir, useClient } from "./client.js";
import { ChampsProfil, messageErreur } from "./CompteChamps.jsx";

// Acces au compte : connexion, creation (Google OU e-mail + mot de passe), verification de l'e-mail, fin d'inscription.
// Le compte reste ferme tant que l'adresse e-mail n'est pas verifiee.

const CASE_ACCEPTE = "J'accepte que mes informations soient enregistrées pour gérer mon compte et mes réservations. Je peux les modifier ou supprimer mon compte à tout moment.";

function Accepte({ accepte, setAccepte, erreur, onLegal }) {
  return (
    <div className="champ">
      <label className="case">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        <span>{CASE_ACCEPTE}</span>
      </label>
      <button type="button" className="lien compte-lien-legal" onClick={onLegal}>
        Lire la confidentialité et les conditions
      </button>
      {erreur && <span className="erreur">{erreur}</span>}
    </div>
  );
}

/* ---------- Deconnecte : connexion, creation, mot de passe oublie ---------- */

export function Connexion({ vueInitiale, onLegal }) {
  const [vue, setVue] = useState(vueInitiale || "connexion"); // connexion | inscription | oubli
  const [f, setF] = useState(() => formulaireInitial(null, null));
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Les messages d'erreur disparaissent des qu'un champ est modifie
  useEffect(() => {
    setErreurs({});
    setErreur("");
  }, [f, email, mdp, mdp2, accepte, vue]);

  const alerte = erreur && (
    <p className="erreur" role="alert">
      {erreur}
    </p>
  );

  const google = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setErreur(messageErreur(e, "Connexion impossible. Réessayez."));
    }
    setEnCours(false);
  };

  const connexionEmail = async (ev) => {
    ev.preventDefault();
    if (!emailValide(email) || !mdp) {
      setErreur("Indiquez votre e-mail et votre mot de passe.");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), mdp);
      setMdp("");
    } catch (e) {
      setErreur(messageErreur(e, "Connexion impossible. Réessayez."));
    }
    setEnCours(false);
  };

  const oubli = async (ev) => {
    ev.preventDefault();
    if (!emailValide(email)) {
      setErreur("Indiquez l'adresse e-mail de votre compte.");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      if (e && (e.code === "auth/network-request-failed" || e.code === "auth/too-many-requests")) {
        setErreur(messageErreur(e, "Envoi impossible. Réessayez."));
        setEnCours(false);
        return;
      }
    }
    // Message identique que le compte existe ou non (on ne revele pas qui a un compte)
    setInfo("Si un compte existe avec cette adresse, un e-mail pour choisir un nouveau mot de passe vient d'être envoyé. Pensez à regarder vos courriers indésirables.");
    setEnCours(false);
  };

  const creer = async (ev) => {
    ev.preventDefault();
    const e = validerProfil(f);
    if (!emailValide(email)) e.email = "Indiquez une adresse e-mail valide.";
    const mp = erreurMotDePasse(mdp, mdp2);
    if (mp) e.mdp = mp;
    if (!accepte) e.accepte = "Cochez la case pour créer votre compte.";
    if (Object.keys(e).length) {
      setErreurs(e);
      return;
    }
    setEnCours(true);
    setErreur("");
    pendantCreation(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), mdp);
      setMdp("");
      setMdp2("");
      const donnees = construireProfil(f, cred.user.email);
      try {
        await setDoc(doc(db, "clients", cred.user.uid), { ...donnees, accepteLe: serverTimestamp(), creeLe: serverTimestamp(), majLe: serverTimestamp() });
        definirProfil(donnees, cred.user);
      } catch {
        garderBrouillon(f);
        definirProfil(null, cred.user);
        setErreur("Votre compte est créé, mais votre fiche n'a pas pu être enregistrée. Vérifiez la connexion puis appuyez sur « Enregistrer ».");
      }
      sendEmailVerification(cred.user).catch(() => {});
    } catch (er) {
      setErreur(messageErreur(er, "Création du compte impossible. Réessayez."));
    }
    pendantCreation(false);
    setEnCours(false);
  };

  return (
    <>
      <p className="consigne">
        Le compte est facultatif : vous pouvez toujours envoyer une demande sans compte. Il sert à utiliser vos codes promo, à retrouver vos demandes, votre crédit et vos informations. Un e-mail de confirmation vous sera envoyé : le compte s'ouvre une fois votre adresse vérifiée.
      </p>
      <div className="compte-onglets" role="tablist">
        <button type="button" role="tab" aria-selected={vue !== "inscription"} className={vue !== "inscription" ? "actif" : ""} onClick={() => setVue("connexion")}>
          Se connecter
        </button>
        <button type="button" role="tab" aria-selected={vue === "inscription"} className={vue === "inscription" ? "actif" : ""} onClick={() => setVue("inscription")}>
          Créer mon compte
        </button>
      </div>

      {vue !== "inscription" && (
        <div className="bloc">
          <button type="button" className="bouton compte-google" disabled={enCours} onClick={google}>
            Continuer avec Google
          </button>
          <p className="aide compte-ou">ou avec votre e-mail</p>
          <form className="compte-form" onSubmit={vue === "oubli" ? oubli : connexionEmail} noValidate>
            <div className="champ">
              <label htmlFor="c-email">E-mail</label>
              <input id="c-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {vue === "connexion" && (
              <div className="champ">
                <label htmlFor="c-mdp">Mot de passe</label>
                <input id="c-mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
              </div>
            )}
            {alerte}
            {info && <p className="compte-info" role="status">{info}</p>}
            <button type="submit" className="bouton" disabled={enCours}>
              {vue === "oubli" ? "Recevoir l'e-mail" : "Se connecter"}
            </button>
            {vue === "connexion" ? (
              <button type="button" className="lien" onClick={() => { setVue("oubli"); setInfo(""); }}>
                Mot de passe oublié ?
              </button>
            ) : (
              <button type="button" className="lien" onClick={() => { setVue("connexion"); setInfo(""); }}>
                ← Retour à la connexion
              </button>
            )}
          </form>
        </div>
      )}

      {vue === "inscription" && (
        <form className="compte-form" onSubmit={creer} noValidate>
          <div className="bloc">
            <button type="button" className="bouton compte-google" disabled={enCours} onClick={google}>
              Créer mon compte avec Google
            </button>
            <p className="aide">Avec Google, il vous restera seulement à compléter vos informations.</p>
          </div>
          <div className="bloc">
            <h3>Ou avec e-mail et mot de passe</h3>
            <div className="champ">
              <label htmlFor="c-email">E-mail *</label>
              <input id="c-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erreurs.email} />
              {erreurs.email && <span className="erreur">{erreurs.email}</span>}
            </div>
            <div className="champ">
              <label htmlFor="c-mdp">Mot de passe * ({MOT_DE_PASSE_MIN} caractères minimum)</label>
              <input id="c-mdp" type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} aria-invalid={!!erreurs.mdp} />
            </div>
            <div className="champ">
              <label htmlFor="c-mdp2">Confirmez le mot de passe *</label>
              <input id="c-mdp2" type="password" autoComplete="new-password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} aria-invalid={!!erreurs.mdp} />
              {erreurs.mdp && <span className="erreur">{erreurs.mdp}</span>}
            </div>
            <ChampsProfil f={f} setF={setF} erreurs={erreurs} />
            <Accepte accepte={accepte} setAccepte={setAccepte} erreur={erreurs.accepte} onLegal={onLegal} />
            {alerte}
            <button type="submit" className="bouton" disabled={enCours}>
              Créer mon compte
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/* ---------- Suppression du compte (ecran de verification et espace client) ---------- */

export function SuppressionCompte({ user, profil }) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await deleteDoc(doc(db, "clients", user.uid)); // la fiche d'abord : une fois deconnecte, on n'a plus le droit de l'effacer
    } catch {
      setErreur("Suppression impossible. Vérifiez la connexion puis réessayez.");
      setEnCours(false);
      return;
    }
    try {
      await deleteUser(user);
    } catch (e) {
      // Le compte existe encore (connexion trop ancienne...) : on remet la fiche pour ne rien perdre
      if (profil) {
        try {
          await setDoc(doc(db, "clients", user.uid), { ...profil, accepteLe: serverTimestamp(), creeLe: serverTimestamp(), majLe: serverTimestamp() });
        } catch {
          /* la fiche sera recreee a la prochaine connexion */
        }
      }
      setErreur(messageErreur(e, "Suppression impossible. Réessayez."));
      setEnCours(false);
      return;
    }
    setEnCours(false);
  };

  return (
    <div className="bloc">
      <h3>Supprimer mon compte</h3>
      {!confirmer ? (
        <button type="button" className="lien compte-danger" onClick={() => setConfirmer(true)}>
          Supprimer mon compte
        </button>
      ) : (
        <>
          <p className="aide">Votre compte et votre fiche seront supprimés définitivement. Les demandes déjà envoyées à Rebecca restent dans son carnet de courses. Le crédit non utilisé est perdu : contactez Rebecca avant si vous en avez.</p>
          <div className="compte-boutons">
            <button type="button" className="bouton compte-supprimer" disabled={enCours} onClick={supprimer}>
              Oui, supprimer
            </button>
            <button type="button" className="lien" disabled={enCours} onClick={() => setConfirmer(false)}>
              Non
            </button>
          </div>
        </>
      )}
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}

/* ---------- E-mail pas encore verifie : le compte reste ferme ---------- */

export function PorteVerification() {
  const c = useClient();
  const user = c.user;
  const [info, setInfo] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const verifie = async () => {
    setErreur("");
    setInfo("");
    setEnCours(true);
    await rafraichir();
    if (!user.emailVerified) setInfo("Pas encore vérifié. Ouvrez l'e-mail reçu, appuyez sur le lien, puis revenez ici. Regardez aussi vos courriers indésirables.");
    setEnCours(false);
  };
  const renvoyer = async () => {
    setErreur("");
    try {
      await sendEmailVerification(user);
      setInfo("E-mail de vérification renvoyé. Ouvrez-le, appuyez sur le lien, puis revenez ici.");
    } catch (e) {
      setErreur(messageErreur(e, "Envoi impossible. Réessayez dans quelques minutes."));
    }
  };

  return (
    <>
      <header className="titre-service">
        <span aria-hidden="true">✉️</span>
        <h2>Vérifiez votre e-mail</h2>
      </header>
      <div className="bloc">
        <p className="compte-texte">
          Un e-mail de confirmation a été envoyé à <strong>{user.email}</strong>. Ouvrez-le et appuyez sur le lien. Ensuite, revenez ici et appuyez sur « J'ai vérifié mon e-mail ».
        </p>
        <p className="aide">Votre compte reste fermé tant que l'adresse n'est pas vérifiée. Pensez à regarder vos courriers indésirables.</p>
        {info && <p className="compte-info" role="status">{info}</p>}
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="button" className="bouton" disabled={enCours} onClick={verifie}>
          J'ai vérifié mon e-mail
        </button>
        <button type="button" className="lien" disabled={enCours} onClick={renvoyer}>
          Renvoyer l'e-mail
        </button>
        <button type="button" className="lien" onClick={() => signOut(auth)}>
          Me déconnecter
        </button>
      </div>
      <SuppressionCompte user={user} profil={null} />
    </>
  );
}

/* ---------- Compte verifie mais sans fiche (premiere connexion Google, ou fiche non enregistree) ---------- */

export function CompleterFiche({ onLegal }) {
  const c = useClient();
  const user = c.user;
  const [f, setF] = useState(() => ({ ...formulaireInitial(null, user), ...(lireBrouillon() || {}) }));
  const [accepte, setAccepte] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(c.erreur || "");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    setErreurs({});
    setErreur("");
  }, [f, accepte]);

  const enregistrer = async (ev) => {
    ev.preventDefault();
    const e = validerProfil(f);
    if (!accepte) e.accepte = "Cochez la case pour continuer.";
    if (Object.keys(e).length) {
      setErreurs(e);
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      const donnees = construireProfil(f, user.email);
      await setDoc(doc(db, "clients", user.uid), { ...donnees, accepteLe: serverTimestamp(), creeLe: serverTimestamp(), majLe: serverTimestamp() });
      garderBrouillon(null);
      definirProfil(donnees, user);
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  return (
    <>
      <header className="titre-service">
        <span aria-hidden="true">👤</span>
        <h2>Terminez votre compte</h2>
      </header>
      <form className="compte-form" onSubmit={enregistrer} noValidate>
        <div className="bloc">
          <div className="champ">
            <label htmlFor="c-email-fixe">E-mail</label>
            <input id="c-email-fixe" type="email" value={user.email || ""} readOnly />
          </div>
          <ChampsProfil f={f} setF={setF} erreurs={erreurs} />
          <Accepte accepte={accepte} setAccepte={setAccepte} erreur={erreurs.accepte} onLegal={onLegal} />
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
          <button type="submit" className="bouton" disabled={enCours}>
            Enregistrer
          </button>
          <button type="button" className="lien" onClick={() => signOut(auth)}>
            Me déconnecter
          </button>
        </div>
      </form>
    </>
  );
}
