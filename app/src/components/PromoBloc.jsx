import { useEffect, useState } from "react";
import { compteOuvert, useClient } from "../client.js";
import { TARIFS } from "../pricing/config.js";
import { etatCode, libelleRemise, normaliserCode, utilisationPossible } from "../pricing/promos.js";
import "../client-commun.css";

// BLOC CODE PROMO du formulaire (juste avant le prix).
// Les codes sont reserves aux clients avec un compte verifie (regles Firebase v6.1).
// Les codes du client (bienvenue + codes offerts par Rebecca) s'affichent en boutons "Utiliser ce code".
// Un code tape a la main (recu d'un ami, vu sur une pub) est verifie dans la base AVANT d'etre applique.
// onChange(code, promo) : code "" et promo null = aucun code. Le formulaire passe promo au moteur de prix (t.codesPromo).
// La limite est controlee une 2e fois par la base au moment de l'envoi (impossible de tricher).

const CODE_OK = /^[A-Z0-9_-]{3,20}$/;

const chargerFirebase = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

// Lit un code et le compteur d'utilisation de ce compte. Renvoie { promo } ou { erreur }.
async function verifierCode(code, uid) {
  const [{ db }, { doc, getDoc }] = await chargerFirebase();
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

// Codes encore utilisables par ce compte : code de bienvenue + codes offerts par Rebecca (collection codesClient)
async function mesCodes(uid) {
  const [{ db }, { collection, getDocs, query, where }] = await chargerFirebase();
  const liste = [TARIFS.clients.codeBienvenue];
  try {
    const offerts = await getDocs(query(collection(db, "codesClient"), where("uid", "==", uid)));
    for (const o of offerts.docs) {
      const c = normaliserCode(o.data().code);
      if (CODE_OK.test(c) && !liste.includes(c)) liste.push(c);
    }
  } catch {
    /* pas de code offert lisible : on garde le code de bienvenue */
  }
  const lus = await Promise.all(liste.map((c) => verifierCode(c, uid).catch(() => ({ erreur: "?" }))));
  return lus.filter((r) => r.promo).map((r) => r.promo);
}

export default function PromoBloc({ code, promo, onChange, onCompte }) {
  const client = useClient();
  const ouvert = compteOuvert(client);
  const uid = client.user && client.user.uid;
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [disponibles, setDisponibles] = useState([]);

  useEffect(() => {
    if (!ouvert) return;
    let actif = true;
    mesCodes(uid)
      .then((l) => actif && setDisponibles(l))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [ouvert, uid]);

  // Visiteur sans compte (ou e-mail pas encore verifie) : invitation a creer un compte
  if (!ouvert) {
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

  const appliquer = async (texte) => {
    const c = normaliserCode(texte);
    if (!CODE_OK.test(c)) return setErreur("Entrez un code de 3 à 20 caractères (lettres et chiffres).");
    setEnCours(true);
    setErreur("");
    try {
      const r = await verifierCode(c, uid);
      if (r.erreur) setErreur(r.erreur);
      else onChange(c, r.promo);
    } catch {
      setErreur("Vérification impossible pour le moment. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  return (
    <div className="promo-bloc">
      {disponibles.length > 0 && (
        <div className="promo-invite">
          <p>
            <strong>Vos codes disponibles</strong>
          </p>
          {disponibles.map((p) => (
            <button key={p.code} type="button" className="bouton" disabled={enCours} onClick={() => appliquer(p.code)}>
              Utiliser {p.code} ({libelleRemise(p)})
            </button>
          ))}
        </div>
      )}
      <label htmlFor="f-codePromo">{disponibles.length > 0 ? "Ou tapez un autre code" : "Code promo (facultatif)"}</label>
      <div className="promo-ligne">
        <input
          id="f-codePromo"
          type="text"
          value={saisie}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Ex : AMI10"
          onChange={(e) => {
            setSaisie(e.target.value);
            setErreur("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              appliquer(saisie);
            }
          }}
        />
        <button type="button" className="bouton" disabled={enCours || !saisie.trim()} onClick={() => appliquer(saisie)}>
          {enCours ? "…" : "Appliquer"}
        </button>
      </div>
      <span className="aide">Un code reçu d'un ami ou vu sur une publicité se tape ici.</span>
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </div>
  );
}
