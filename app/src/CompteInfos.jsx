import { useEffect, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { WHATSAPP } from "./contact.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { MOT_DE_PASSE_MIN, construireContact, emailValide, erreurMotDePasse, validerContact } from "./profil.js";
import { rafraichir } from "./client.js";
import { MoyensPaiement, dateFr, messageErreur } from "./CompteChamps.jsx";
import { SuppressionCompte } from "./CompteAcces.jsx";
import CompteCarnet from "./CompteCarnet.jsx";

// "Mes informations" : nom, prenom et date de naissance sont fixes ; telephone, adresse et moyens de paiement
// se modifient (valeurs valides obligatoires) ; l'e-mail change apres confirmation par un nouveau mail ; mot de passe.

export default function CompteInfos({ client, onLegal }) {
  const { user, profil } = client;
  const parMotDePasse = user.providerData.some((p) => p.providerId === "password");

  /* --- Telephone, adresse, paiement --- */
  const [f, setF] = useState({ telephone: profil.telephone || "", adresse: profil.adresse || "", moyensPreferes: profil.moyensPreferes || [] });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    setErreurs({});
    setErreur("");
  }, [f]);

  const enregistrer = async (ev) => {
    ev.preventDefault();
    const e = validerContact(f);
    if (Object.keys(e).length) return setErreurs(e);
    setEnCours(true);
    setInfo("");
    try {
      await updateDoc(doc(db, "clients", user.uid), { ...construireContact(f), majLe: serverTimestamp() });
      await rafraichir();
      setInfo("Vos informations sont enregistrées.");
    } catch (er) {
      setErreur(messageErreur(er, "Enregistrement impossible. Vérifiez la connexion puis réessayez."));
    }
    setEnCours(false);
  };

  /* --- E-mail --- */
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [mdpEmail, setMdpEmail] = useState("");
  const [besoinMdpEmail, setBesoinMdpEmail] = useState(false);
  const [erreurEmail, setErreurEmail] = useState("");
  const [infoEmail, setInfoEmail] = useState("");
  const [cours2, setCours2] = useState(false);
  useEffect(() => setErreurEmail(""), [nouvelEmail, mdpEmail]);

  const changerEmail = async (ev) => {
    ev.preventDefault();
    if (!emailValide(nouvelEmail)) return setErreurEmail("Indiquez une adresse e-mail valide.");
    if (nouvelEmail.trim().toLowerCase() === String(user.email).toLowerCase()) return setErreurEmail("C'est déjà votre adresse actuelle.");
    setCours2(true);
    setInfoEmail("");
    try {
      if (besoinMdpEmail) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, mdpEmail));
      await verifyBeforeUpdateEmail(user, nouvelEmail.trim());
      setInfoEmail("Un e-mail de confirmation a été envoyé à " + nouvelEmail.trim() + ". Appuyez sur le lien : votre adresse changera après cette confirmation. Jusque-là, vous gardez l'ancienne.");
      setNouvelEmail("");
      setMdpEmail("");
      setBesoinMdpEmail(false);
    } catch (er) {
      if (er && er.code === "auth/requires-recent-login") {
        setBesoinMdpEmail(true);
        setErreurEmail("Par sécurité, saisissez votre mot de passe actuel pour confirmer.");
      } else setErreurEmail(messageErreur(er, "Changement impossible. Réessayez."));
    }
    setCours2(false);
  };

  /* --- Mot de passe --- */
  const [mdpActuel, setMdpActuel] = useState("");
  const [mdp1, setMdp1] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [erreurMdp, setErreurMdp] = useState("");
  const [infoMdp, setInfoMdp] = useState("");
  const [cours3, setCours3] = useState(false);
  useEffect(() => setErreurMdp(""), [mdpActuel, mdp1, mdp2]);

  const changerMdp = async (ev) => {
    ev.preventDefault();
    if (!mdpActuel) return setErreurMdp("Indiquez votre mot de passe actuel.");
    const e = erreurMotDePasse(mdp1, mdp2);
    if (e) return setErreurMdp(e);
    setCours3(true);
    setInfoMdp("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, mdpActuel));
      await updatePassword(user, mdp1);
      setInfoMdp("Votre mot de passe est changé.");
      setMdpActuel("");
      setMdp1("");
      setMdp2("");
    } catch (er) {
      setErreurMdp(messageErreur(er, "Changement impossible. Réessayez."));
    }
    setCours3(false);
  };

  const demande = lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je voudrais corriger mon nom, prénom ou ma date de naissance sur mon compte.");

  return (
    <div className="infos">
      <div className="bloc">
        <h3>Mes informations</h3>
        <dl className="compte-fiche">
          <dt>Prénom et nom</dt>
          <dd>{profil.prenom} {profil.nom}</dd>
          <dt>Date de naissance</dt>
          <dd>{dateFr(profil.naissance)}</dd>
        </dl>
        <p className="aide">
          Nom, prénom et date de naissance ne se modifient pas ici.{" "}
          <a href={demande} target="_blank" rel="noopener noreferrer">Écrire à Rebecca pour une correction</a>
        </p>
        <form className="compte-form" onSubmit={enregistrer} noValidate>
          <div className="champ">
            <label htmlFor="i-tel">Téléphone *</label>
            <input id="i-tel" type="tel" inputMode="tel" autoComplete="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} aria-invalid={!!erreurs.telephone} />
            {erreurs.telephone && <span className="erreur">{erreurs.telephone}</span>}
          </div>
          <div className="champ">
            <label htmlFor="i-adresse">Adresse (rue, numéro, ville) *</label>
            <input id="i-adresse" type="text" autoComplete="street-address" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} aria-invalid={!!erreurs.adresse} />
            {erreurs.adresse && <span className="erreur">{erreurs.adresse}</span>}
          </div>
          <MoyensPaiement valeur={f.moyensPreferes} onChange={(v) => setF({ ...f, moyensPreferes: v })} erreur={erreurs.moyensPreferes} />
          {info && <p className="compte-info" role="status">{info}</p>}
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
          <button type="submit" className="bouton" disabled={enCours}>
            Enregistrer
          </button>
        </form>
      </div>

      <CompteCarnet client={client} />

      <div className="bloc">
        <h3>Mon e-mail</h3>
        <p className="compte-texte"><strong>{user.email}</strong> <span className="ok-adresse">✓ vérifié</span></p>
        {parMotDePasse ? (
          <form className="compte-form" onSubmit={changerEmail} noValidate>
            <div className="champ">
              <label htmlFor="i-nemail">Nouvelle adresse e-mail</label>
              <input id="i-nemail" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={nouvelEmail} onChange={(e) => setNouvelEmail(e.target.value)} />
              <span className="aide">Un e-mail de confirmation sera envoyé à la nouvelle adresse. Elle ne remplace l'ancienne qu'après confirmation.</span>
            </div>
            {besoinMdpEmail && (
              <div className="champ">
                <label htmlFor="i-mdpe">Mot de passe actuel</label>
                <input id="i-mdpe" type="password" autoComplete="current-password" value={mdpEmail} onChange={(e) => setMdpEmail(e.target.value)} />
              </div>
            )}
            {infoEmail && <p className="compte-info" role="status">{infoEmail}</p>}
            {erreurEmail && <p className="erreur" role="alert">{erreurEmail}</p>}
            <button type="submit" className="bouton" disabled={cours2}>
              Changer mon e-mail
            </button>
          </form>
        ) : (
          <p className="aide">Vous êtes connecté avec Google : votre e-mail est géré par votre compte Google.</p>
        )}
      </div>

      <div className="bloc">
        <h3>Mon mot de passe</h3>
        {parMotDePasse ? (
          <form className="compte-form" onSubmit={changerMdp} noValidate>
            <div className="champ">
              <label htmlFor="i-mdp0">Mot de passe actuel</label>
              <input id="i-mdp0" type="password" autoComplete="current-password" value={mdpActuel} onChange={(e) => setMdpActuel(e.target.value)} />
            </div>
            <div className="champ">
              <label htmlFor="i-mdp1">Nouveau mot de passe ({MOT_DE_PASSE_MIN} caractères minimum)</label>
              <input id="i-mdp1" type="password" autoComplete="new-password" value={mdp1} onChange={(e) => setMdp1(e.target.value)} />
            </div>
            <div className="champ">
              <label htmlFor="i-mdp2">Confirmez le nouveau mot de passe</label>
              <input id="i-mdp2" type="password" autoComplete="new-password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} />
            </div>
            {infoMdp && <p className="compte-info" role="status">{infoMdp}</p>}
            {erreurMdp && <p className="erreur" role="alert">{erreurMdp}</p>}
            <button type="submit" className="bouton" disabled={cours3}>
              Changer mon mot de passe
            </button>
          </form>
        ) : (
          <p className="aide">Vous êtes connecté avec Google : il n'y a pas de mot de passe à gérer ici.</p>
        )}
      </div>

      <div className="bloc">
        <button type="button" className="lien" onClick={onLegal}>
          Confidentialité et conditions
        </button>
      </div>
      <SuppressionCompte user={user} profil={profil} />
    </div>
  );
}
