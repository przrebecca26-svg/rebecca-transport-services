import { useState } from "react";
import { compteOuvert, useClient } from "../client.js";
import { TARIFS } from "../pricing/config.js";
import { etatCode, libelleRemise, normaliserCode, utilisationPossible } from "../pricing/promos.js";
import "../client-commun.css";

// BLOC CODE PROMO du formulaire (juste avant le prix).
// Les codes sont reserves aux clients avec un compte verifie (regles Firebase v6.1).
// Le code est verifie dans la base AVANT d'etre applique : existe, actif, pas expire, limite par compte non atteinte.
// onChange(code, promo) : code "" et promo null = aucun code. Le formulaire passe promo au moteur de prix (t.codesPromo).
// La limite est controlee une 2e fois par la base au moment de l'envoi (impossible de tricher).

const CODE_OK = /^[A-Z0-9_-]{3,20}$/;

async function verifierCode(code, uid) {
  const [{ db }, { doc, getDoc }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
  const [p, u] = await Promise.all([getDoc(doc(db, "promos", code)), getDoc(doc(db, "utilisationsPromo", code + "__" + uid))]);
  if (!p.exists()) return { erreur: "Code « " + code + " » inconnu. Vérifiez l'orthographe." };
  const promo = { ...p.data(), code };
  const etat = etatCode(promo);
  if (etat === "expire") return { erreur: "Ce code a expiré." };
  if (etat !== "actif") return { erreur: "Ce code n'est pas valable en ce moment." };
  const deja = u.exists() ? Number(u.data().nombre) || 0 : 0;
  if (!utilisationPossible(promo, deja)) return { erreur: "Vous avez déjà utilisé ce code le nombre de fois autorisé." };
  return { promo: { code, type: promo.type, valeur: promo.valeur, actif: promo.actif, utilisationsParCompte: promo.utilisationsParCompte ?? null, finLe: promo.finLe ?? null } };
}

export default function PromoBloc({ code, promo, onChange, onCompte }) {
  const client = useClient();
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Visiteur sans compte (ou e-mail pas encore verifie) : invitation a creer un compte
  if (!compteOuvert(client)) {
    return (
      <div className="promo-invite">
        <p>
          <strong>Vous avez un code promo ?</strong> Les codes sont réservés aux clients avec un compte.
        </p>
        <p>Créez votre compte : le code {TARIFS.clients.codeBienvenue} vous est offert pour votre première demande.</p>
        {onCompte && (
          <button type="button" className="lien" onClick={onCompte}>
            Créer mon compte ou me connecter
          </button>
        )}
      </div>
    );
  }

  // Code deja applique
  if (code && promo) {
    return (
      <div className="promo-bloc">
        <p className="promo-ok" role="status">
          ✓ Code {code} appliqué ({libelleRemise(promo)} sur le tarif de base)
        </p>
        <button
          type="button"
          className="lien"
          onClick={() => {
            onChange("", null);
            setSaisie("");
            setErreur("");
          }}
        >
          Retirer le code
        </button>
      </div>
    );
  }

  const appliquer = async () => {
    const c = normaliserCode(saisie);
    if (!CODE_OK.test(c)) return setErreur("Entrez un code de 3 à 20 caractères (lettres et chiffres).");
    setEnCours(true);
    setErreur("");
    try {
      const r = await verifierCode(c, client.user.uid);
      if (r.erreur) setErreur(r.erreur);
      else onChange(c, r.promo);
    } catch {
      setErreur("Vérification impossible pour le moment. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  return (
    <div className="promo-bloc">
      <label htmlFor="f-codePromo">Code promo (facultatif)</label>
      <div className="promo-ligne">
        <input
          id="f-codePromo"
          type="text"
          value={saisie}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Ex : BIENVENUE10"
          onChange={(e) => {
            setSaisie(e.target.value);
            setErreur("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              appliquer();
            }
          }}
        />
        <button type="button" className="bouton" disabled={enCours || !saisie.trim()} onClick={appliquer}>
          {enCours ? "…" : "Appliquer"}
        </button>
      </div>
      <span className="aide">Vos codes disponibles sont dans « Mon compte », onglet Codes promo.</span>
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </div>
  );
}
