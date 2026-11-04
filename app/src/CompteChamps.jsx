import { MOYENS_PREFERES, naissanceMax } from "./profil.js";

// Champs communs de la fiche client (creation du compte et fin d'inscription Google)
export function ChampsProfil({ f, setF, erreurs }) {
  const maj = (nom, valeur) => setF((x) => ({ ...x, [nom]: valeur }));
  return (
    <>
      <div className="champ">
        <label htmlFor="c-prenom">Prénom *</label>
        <input id="c-prenom" type="text" autoComplete="given-name" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} aria-invalid={!!erreurs.prenom} />
        {erreurs.prenom && <span className="erreur">{erreurs.prenom}</span>}
      </div>
      <div className="champ">
        <label htmlFor="c-nom">Nom *</label>
        <input id="c-nom" type="text" autoComplete="family-name" value={f.nom} onChange={(e) => maj("nom", e.target.value)} aria-invalid={!!erreurs.nom} />
        {erreurs.nom && <span className="erreur">{erreurs.nom}</span>}
      </div>
      <div className="champ">
        <label htmlFor="c-tel">Téléphone *</label>
        <input id="c-tel" type="tel" inputMode="tel" autoComplete="tel" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} aria-invalid={!!erreurs.telephone} />
        {erreurs.telephone && <span className="erreur">{erreurs.telephone}</span>}
      </div>
      <div className="champ">
        <label htmlFor="c-adresse">Adresse (rue, numéro, ville) *</label>
        <input id="c-adresse" type="text" autoComplete="street-address" value={f.adresse} onChange={(e) => maj("adresse", e.target.value)} aria-invalid={!!erreurs.adresse} />
        {erreurs.adresse && <span className="erreur">{erreurs.adresse}</span>}
      </div>
      <div className="champ">
        <label htmlFor="c-naissance">Date de naissance *</label>
        <input id="c-naissance" type="date" autoComplete="bday" min="1900-01-01" max={naissanceMax()} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} aria-invalid={!!erreurs.naissance} />
        <span className="aide">Réservé aux personnes majeures. Votre nom, prénom et date de naissance ne pourront plus être modifiés : vérifiez-les bien.</span>
        {erreurs.naissance && <span className="erreur">{erreurs.naissance}</span>}
      </div>
      <MoyensPaiement valeur={f.moyensPreferes} onChange={(v) => maj("moyensPreferes", v)} erreur={erreurs.moyensPreferes} />
    </>
  );
}

// Cases a cocher : moyens de paiement preferes
export function MoyensPaiement({ valeur, onChange, erreur }) {
  const basculer = (m) => onChange(valeur.includes(m) ? valeur.filter((y) => y !== m) : [...valeur, m]);
  return (
    <fieldset className="champ">
      <legend>Moyens de paiement préférés *</legend>
      {MOYENS_PREFERES.map((m) => (
        <label key={m} className="case">
          <input type="checkbox" checked={valeur.includes(m)} onChange={() => basculer(m)} />
          <span>{m}</span>
        </label>
      ))}
      <span className="aide">Simple préférence : le paiement se fait directement avec Rebecca. Aucun numéro de carte n'est enregistré.</span>
      {erreur && <span className="erreur">{erreur}</span>}
    </fieldset>
  );
}

// Messages d'erreur Firebase en francais
const MESSAGES = {
  "auth/popup-closed-by-user": "Connexion annulée.",
  "auth/cancelled-popup-request": "Connexion annulée.",
  "auth/popup-blocked": "Votre navigateur a bloqué la fenêtre Google. Autorisez-la puis réessayez.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase (domaines autorisés).",
  "auth/network-request-failed": "Pas de connexion internet. Réessayez.",
  "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail. Utilisez « Se connecter » (ou « Mot de passe oublié »).",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "Mot de passe actuel incorrect.",
  "auth/user-not-found": "E-mail ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/weak-password": "Mot de passe trop faible : choisissez-en un plus long.",
  "auth/too-many-requests": "Trop d'essais. Attendez quelques minutes puis réessayez.",
  "auth/requires-recent-login": "Pour des raisons de sécurité, déconnectez-vous, reconnectez-vous, puis recommencez tout de suite.",
  "permission-denied": "Action refusée. Si votre compte vient d'être créé, vérifiez d'abord votre e-mail.",
};
export const messageErreur = (e, defaut) => MESSAGES[e && e.code] || defaut;

export const dateFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");
