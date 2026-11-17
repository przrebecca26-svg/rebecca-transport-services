import { useEffect, useState } from "react";
import { MOYENS_DECLARES, lignesPaiement, normaliserRevolut } from "../pricing/suiteClient.js";

// PAGE « PAYER ET ME PREVENIR » (17 nov. 2026, 16h31) - lien #/paye/ID/MONTANT/SORTE/PRENOM envoye par Rebecca.
// La cliente voit le montant, les moyens de paiement (PayPal, Bit, Revolut) et touche « J'ai payé par … ».
// Une declaration part chez Rebecca (paiementsDeclares) : elle confirme d'un appui dans son espace.
// Firebase n'est charge qu'ici.
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

export default function PagePaiement({ lien, onAccueil }) {
  const [liens, setLiens] = useState(null);
  const [envoye, setEnvoye] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    charger()
      .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "paiement")))
      .then((x) => setLiens(x.exists() ? x.data() : {}))
      .catch(() => setLiens({}));
  }, []);

  const declarer = async (moyen) => {
    setErreur("");
    setEnCours(true);
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }] = await charger();
      await addDoc(collection(db, "paiementsDeclares"), {
        resId: lien.resId,
        montant: lien.montant,
        moyen,
        sorte: lien.sorte,
        prenom: lien.prenom || "",
        statut: "a confirmer",
        creeLe: serverTimestamp(),
      });
      setEnvoye(moyen);
    } catch {
      setErreur("L'envoi n'a pas marché. Vérifiez la connexion puis réessayez, ou répondez simplement à Rebecca sur WhatsApp.");
    }
    setEnCours(false);
  };

  const l = liens || {};
  const bit = String(l.bit || "").trim();
  const revolut = normaliserRevolut(l.revolut);
  const paypal = /^https:\/\//.test(l.paypal || "") ? l.paypal.trim() : "";
  const montant = String(lien.montant).replace(".", ",");
  const quoi = lien.sorte === "acompte" ? "l'acompte" : "votre course";

  return (
    <div className="bloc" style={{ maxWidth: 520, margin: "24px auto", padding: 20 }}>
      <h2>{lien.prenom ? `Bonjour ${lien.prenom} 😊` : "Bonjour 😊"}</h2>
      {envoye ? (
        <>
          <p>Merci ! Rebecca est prévenue de votre paiement par {envoye} ({montant} ₪). Elle le confirme dès réception ✅</p>
          <button type="button" className="bouton" onClick={onAccueil}>Voir le site</button>
        </>
      ) : (
        <>
          <p>Montant à régler pour {quoi} : <strong>{montant} ₪</strong></p>
          <p className="aide">1. Payez avec le moyen de votre choix. 2. Touchez « J'ai payé » juste en dessous pour prévenir Rebecca.</p>
          {liens === null && <p className="aide">Chargement…</p>}
          {liens !== null && !lignesPaiement(l, lien.montant).length && <p className="aide">Rebecca vous indiquera le moyen de paiement (espèces, virement…).</p>}
          <div className="pourboire-boutons" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            {paypal && (
              <a className="actif" href={paypal} target="_blank" rel="noopener noreferrer">
                Payer par PayPal (carte bancaire acceptée)
              </a>
            )}
            {revolut && (
              <a className="actif" href={revolut} target="_blank" rel="noopener noreferrer">
                Payer par Revolut
              </a>
            )}
            {bit && <p className="aide">Bit : envoyez {montant} ₪ au <strong dir="ltr">{bit}</strong></p>}
          </div>
          <h3 style={{ marginTop: 20 }}>Vous avez payé ?</h3>
          <div className="pourboire-boutons" style={{ flexWrap: "wrap" }}>
            {MOYENS_DECLARES.filter((m) => (m === "PayPal" ? paypal : m === "Revolut" ? revolut : m === "Bit" ? bit : true)).map((m) => (
              <button key={m} type="button" disabled={enCours} onClick={() => declarer(m)}>
                J'ai payé par {m}
              </button>
            ))}
          </div>
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
        </>
      )}
    </div>
  );
}
