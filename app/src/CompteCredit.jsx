import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { bonusRecharge, creditObtenu, ETATS_RECHARGE, validerRecharge } from "./pricing/credit.js";
import { aujourdhui } from "./profil.js";
import { dateFr } from "./CompteChamps.jsx";

// "Mon crédit" : solde, carnet, recharge. Le client DECLARE sa recharge (montant, moyen, date) ;
// le credit n'est ajoute que lorsque Rebecca confirme avoir recu le paiement.

const millis = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
const MONTANTS = [50, 100, 200, 300, 500];
const LIBELLES = { recharge: "Recharge", bonus: "Bonus offert", utilisation: "Course payée avec le crédit", correction: "Correction", cadeau: "Cadeau reçu" };

export default function CompteCredit({ client, solde, onSolde }) {
  const { user } = client;
  const [mouvements, setMouvements] = useState(null);
  const [recharges, setRecharges] = useState([]);
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState(TARIFS.moyensPaiement[0]);
  const [date, setDate] = useState(aujourdhui());
  const [cadeau, setCadeau] = useState(false);
  const [dest, setDest] = useState({ nom: "", email: "", message: "" });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);

  const charger = async () => {
    try {
      const [m, r] = await Promise.all([
        getDocs(query(collection(db, "creditMouvements"), where("uid", "==", user.uid))),
        getDocs(query(collection(db, "recharges"), where("uid", "==", user.uid))),
      ]);
      const lignes = m.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => millis(b.creeLe) - millis(a.creeLe));
      setMouvements(lignes);
      onSolde(lignes);
      setRecharges(r.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => millis(b.creeLe) - millis(a.creeLe)));
    } catch {
      setMouvements([]);
      setErreur("Lecture de votre crédit impossible. Vérifiez la connexion puis réessayez.");
    }
  };
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setErreurs({});
    setErreur("");
  }, [montant, moyen, date, cadeau, dest]);

  const n = Number(String(montant).replace(",", "."));
  const enAttente = recharges.filter((r) => r.statut === "en attente").length;

  const envoyer = async (ev) => {
    ev.preventDefault();
    const e = validerRecharge({ montant, moyen, date, cadeau, cadeauInfos: dest }, aujourdhui());
    if (enAttente >= TARIFS.clients.rechargesEnAttenteMax) {
      setErreur("Vous avez déjà " + TARIFS.clients.rechargesEnAttenteMax + " recharges en attente. Attendez la confirmation de Rebecca avant d'en déclarer une autre.");
      return;
    }
    if (Object.keys(e).length) {
      setErreurs(e);
      return;
    }
    setEnCours(true);
    try {
      const donnees = { uid: user.uid, montant: n, moyen, date, statut: "en attente", creeLe: serverTimestamp() };
      if (cadeau) donnees.cadeau = { nom: dest.nom.trim().slice(0, 60), email: dest.email.trim().slice(0, 120), message: dest.message.trim().slice(0, 300) };
      await setDoc(doc(collection(db, "recharges")), donnees);
      setInfo("Recharge déclarée : " + n + " ₪ par " + moyen + ". Elle sera ajoutée à votre crédit quand Rebecca aura confirmé la réception du paiement.");
      setMontant("");
      setCadeau(false);
      setDest({ nom: "", email: "", message: "" });
      await charger();
    } catch {
      setErreur("Envoi impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  if (mouvements === null) return <p className="consigne">Chargement…</p>;
  return (
    <div className="credit">
      <div className="bloc credit-solde">
        <p className="credit-etiquette">Mon crédit</p>
        <p className="credit-montant">{solde} ₪</p>
        <p className="aide">Le crédit se déduit automatiquement de vos prochaines courses. Le reste éventuel se règle avec votre moyen de paiement.</p>
      </div>

      <form className="bloc compte-form" onSubmit={envoyer} noValidate>
        <h3>Recharger mon crédit</h3>
        <p className="aide">
          Minimum {TARIFS.credit.rechargeMin} ₪. Bonus de {Math.round(TARIFS.credit.bonusPourcentage * 100)} % dès {TARIFS.credit.bonusSeuil} ₪ rechargés. Vous payez directement Rebecca ; indiquez ici ce que vous avez payé ou allez payer.
        </p>
        <fieldset className="champ">
          <legend>Montant *</legend>
          <div className="pourboire-boutons">
            {MONTANTS.map((m) => (
              <button key={m} type="button" className={String(montant) === String(m) ? "actif" : ""} aria-pressed={String(montant) === String(m)} onClick={() => setMontant(String(m))}>
                {m} ₪
              </button>
            ))}
          </div>
          <input type="text" inputMode="numeric" aria-label="Autre montant en shekels" placeholder="Autre montant en ₪" value={montant} onChange={(e) => setMontant(e.target.value)} aria-invalid={!!erreurs.montant} />
          {erreurs.montant && <span className="erreur">{erreurs.montant}</span>}
          {Number.isInteger(n) && n >= TARIFS.credit.rechargeMin && n <= TARIFS.credit.rechargeMax && (
            <span className="ok-adresse">
              {bonusRecharge(n) > 0 ? `Vous recevrez ${creditObtenu(n)} ₪ de crédit (dont ${bonusRecharge(n)} ₪ offerts).` : `Vous recevrez ${n} ₪ de crédit.`}
            </span>
          )}
        </fieldset>
        <div className="champ">
          <label htmlFor="r-moyen">Comment payez-vous ? *</label>
          <select id="r-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
            {TARIFS.moyensPaiement.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {erreurs.moyen && <span className="erreur">{erreurs.moyen}</span>}
        </div>
        <div className="champ">
          <label htmlFor="r-date">Date du paiement *</label>
          <input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!erreurs.date} />
          {erreurs.date && <span className="erreur">{erreurs.date}</span>}
        </div>
        <label className="case">
          <input type="checkbox" checked={cadeau} onChange={(e) => setCadeau(e.target.checked)} />
          <span>C'est un cadeau pour quelqu'un d'autre</span>
        </label>
        {cadeau && (
          <>
            <div className="champ">
              <label htmlFor="r-dnom">Prénom de la personne *</label>
              <input id="r-dnom" type="text" maxLength={60} value={dest.nom} onChange={(e) => setDest({ ...dest, nom: e.target.value })} aria-invalid={!!erreurs.cadeauNom} />
              {erreurs.cadeauNom && <span className="erreur">{erreurs.cadeauNom}</span>}
            </div>
            <div className="champ">
              <label htmlFor="r-demail">E-mail de son compte *</label>
              <input id="r-demail" type="email" inputMode="email" autoCapitalize="none" maxLength={120} value={dest.email} onChange={(e) => setDest({ ...dest, email: e.target.value })} aria-invalid={!!erreurs.cadeauEmail} />
              {erreurs.cadeauEmail && <span className="erreur">{erreurs.cadeauEmail}</span>}
              <span className="aide">Le crédit sera ajouté à son compte (la personne doit avoir un compte avec cet e-mail).</span>
            </div>
            <div className="champ">
              <label htmlFor="r-dmsg">Petit mot (facultatif)</label>
              <textarea id="r-dmsg" rows={2} maxLength={300} value={dest.message} onChange={(e) => setDest({ ...dest, message: e.target.value })} />
            </div>
          </>
        )}
        {info && <p className="compte-info" role="status">{info}</p>}
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="submit" className="bouton" disabled={enCours}>
          Déclarer ma recharge
        </button>
      </form>

      {recharges.length > 0 && (
        <div className="bloc">
          <h3>Mes recharges</h3>
          <ul className="credit-liste">
            {recharges.map((r) => (
              <li key={r.id}>
                <span>
                  {r.montant} ₪ · {r.moyen} · {dateFr(r.date)}
                  {r.cadeau ? " · cadeau pour " + r.cadeau.nom : ""}
                </span>
                <span className={"hist-statut " + (r.statut === "confirmée" ? "ok" : r.statut === "refusée" ? "non" : "attente")}>{ETATS_RECHARGE[r.statut] || r.statut}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mouvements.length > 0 && (
        <div className="bloc">
          <h3>Mon carnet de crédit</h3>
          <ul className="credit-liste">
            {mouvements.map((m) => (
              <li key={m.id}>
                <span>{LIBELLES[m.kind] || "Mouvement"}{m.date ? " · " + dateFr(m.date) : ""}</span>
                <strong className={m.montant < 0 ? "neg" : "pos"}>{m.montant > 0 ? "+" : ""}{m.montant} ₪</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
