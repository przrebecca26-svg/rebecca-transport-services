import { useEffect, useState } from "react";
import { CONDITIONS_CADEAU, IDEES_CADEAU, MONTANTS_CADEAU, MOYENS_CADEAU, STATUTS_CADEAU, dateFrCadeau, finValidite, genererCode, messageOffrir, nouvelleCarte, statutAffiche, validerCarte } from "../pricing/cartesCadeaux.js";
import { lignesPaiement, normaliserRevolut } from "../pricing/suiteClient.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// CARTE CADEAU (18 nov. 2026) - page publique : offrir une carte (#/cadeau) ou voir sa carte (#/cadeau/ID).
// Firebase n'est charge qu'ici.
// 19 nov. 2026 : validite 1 an, non remboursable, toutes les activites ; carte imprimable / PDF a la charte.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

function Paiement({ carte, id, onAnnonce }) {
  const [liens, setLiens] = useState(null);
  const [envoye, setEnvoye] = useState(carte.statut === "paiement_annonce");
  useEffect(() => {
    charger().then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "paiement"))).then((x) => setLiens(x.exists() ? x.data() : {})).catch(() => setLiens({}));
  }, []);
  const annoncer = async (moyen) => {
    try {
      const [{ db }, { doc, updateDoc, serverTimestamp }] = await charger();
      await updateDoc(doc(db, "cartesCadeaux", id), { statut: "paiement_annonce", moyen, annonceLe: serverTimestamp() });
      setEnvoye(true);
      onAnnonce && onAnnonce();
      window.open(lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je viens de payer la carte cadeau de ${carte.montant} ₪ pour ${carte.pourNom} par ${moyen}. Code ${carte.code}. Merci ! ${carte.acheteurNom}`), "_blank", "noopener");
    } catch { /* deja annonce */ }
  };
  if (envoye) return <p className="aide">✅ Rebecca est prévenue. Dès qu'elle confirme le paiement, la carte devient active : vous pourrez l'envoyer à {carte.pourNom} depuis ce lien.</p>;
  const l = liens || {};
  const paypal = /^https:\/\//.test(l.paypal || "") ? `${l.paypal.trim().replace(/\/$/, "")}${/paypal\.me\//.test(l.paypal) ? `/${carte.montant}ILS` : ""}` : "";
  const revolut = normaliserRevolut(l.revolut);
  return (
    <>
      <p className="aide">1. Payez {carte.montant} ₪ avec le moyen de votre choix. 2. Touchez « J'ai payé » pour prévenir Rebecca.</p>
      {liens && !lignesPaiement(l, carte.montant).length && <p className="aide">Rebecca vous indiquera comment payer (espèces, virement…).</p>}
      <div className="pourboire-boutons" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        {paypal && <a className="actif" href={paypal} target="_blank" rel="noopener noreferrer">Payer par PayPal</a>}
        {revolut && <a className="actif" href={revolut} target="_blank" rel="noopener noreferrer">Payer par Revolut</a>}
        {String(l.bit || "").replace(/\D/g, "").length >= 9 && <p className="aide">Bit : envoyez {carte.montant} ₪ au <strong dir="ltr">{l.bit}</strong></p>}
      </div>
      <div className="pourboire-boutons" style={{ flexWrap: "wrap" }}>
        {MOYENS_CADEAU.map((m) => <button key={m} type="button" onClick={() => annoncer(m)}>J'ai payé par {m}</button>)}
      </div>
    </>
  );
}

export function VoirCarte({ id, onAccueil }) {
  const [carte, setCarte] = useState(undefined);
  const lire = () => charger().then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "cartesCadeaux", id))).then((x) => setCarte(x.exists() ? x.data() : null)).catch(() => setCarte(null));
  useEffect(() => { lire(); }, [id]);
  if (carte === undefined) return <p className="aide" style={{ padding: 24 }}>Chargement…</p>;
  if (!carte) return <div className="bloc" style={{ maxWidth: 520, margin: "24px auto", padding: 20 }}><h2>Carte introuvable</h2><button className="bouton" onClick={onAccueil}>Voir le site</button></div>;
  const active = carte.statut === "active" || carte.statut === "utilisee";
  const statut = statutAffiche(carte, aujourdhui());
  const fin = finValidite(carte);
  return (
    <div className="bloc" style={{ maxWidth: 520, margin: "24px auto", padding: 20 }}>
      <div className="carte-cadeau-impr" style={{ borderRadius: 18, padding: 22, background: "linear-gradient(135deg, #141214, #3a2a2e)", border: "1px solid #c9967a", textAlign: "center", marginBottom: 16 }}>
        <p style={{ letterSpacing: 3, color: "#e7a9b4", margin: 0 }}>CARTE CADEAU</p>
        <h2 style={{ margin: "8px 0", color: "#faf6f2" }}>Rebecca Services</h2>
        <p style={{ fontSize: 34, margin: "6px 0", color: "#faf6f2" }}><strong>{carte.montant} ₪</strong></p>
        {carte.idee && carte.idee !== "Au choix" && <p style={{ color: "#e7a9b4", margin: 0 }}>{carte.idee}</p>}
        <p style={{ color: "#faf6f2" }}>Pour {carte.pourNom}, de la part de {carte.acheteurNom}</p>
        {carte.message && <p style={{ fontStyle: "italic", color: "#faf6f2" }}>« {carte.message} »</p>}
        {active && <p style={{ fontSize: 20, letterSpacing: 2, color: "#faf6f2" }}><strong>{carte.code}</strong></p>}
        {active && <p style={{ color: "#e7a9b4", margin: 0 }}>Solde : {carte.solde} ₪</p>}
        {active && fin && <p style={{ color: "#faf6f2", marginBottom: 0 }}>Valable jusqu'au {dateFrCadeau(fin)}</p>}
        <p style={{ color: "#b9aeb0", fontSize: 12, marginBottom: 0 }}>{CONDITIONS_CADEAU}</p>
        <p style={{ color: "#e7a9b4", fontSize: 12, margin: "6px 0 0" }}>rebeccaservices.com · WhatsApp 054-738-0193</p>
      </div>
      <p className="aide">État : {STATUTS_CADEAU[statut] || carte.statut}</p>
      {(carte.statut === "a_payer" || carte.statut === "paiement_annonce") && <Paiement carte={carte} id={id} onAnnonce={lire} />}
      {statut === "active" && (
        <>
          <button type="button" className="bouton sans-impression" onClick={() => window.print()}>🖨️ Imprimer ou enregistrer en PDF</button>
          <p className="aide">Pour l'utiliser : réservez sur le site ou sur WhatsApp, et donnez le code à Rebecca au moment de payer.</p>
          {carte.pourTel && <a className="bouton" href={lienWhatsApp(carte.pourTel, messageOffrir(carte, id))} target="_blank" rel="noopener noreferrer">🎁 Envoyer la carte à {carte.pourNom} sur WhatsApp</a>}
          {!carte.pourTel && <a className="bouton" href={`https://wa.me/?text=${encodeURIComponent(messageOffrir(carte, id))}`} target="_blank" rel="noopener noreferrer">🎁 Envoyer la carte sur WhatsApp</a>}
        </>
      )}
      <p><button type="button" className="lien" onClick={onAccueil}>← Voir le site</button></p>
    </div>
  );
}

export default function OffrirCarte({ onAccueil }) {
  const [f, setF] = useState({ montant: "100", idee: "Au choix", acheteurNom: "", acheteurTel: "", pourNom: "", pourTel: "", message: "", moyen: "Bit" });
  const [erreurs, setErreurs] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const envoyer = async () => {
    const e = validerCarte(f);
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEnCours(true);
    setErreur("");
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }] = await charger();
      const carte = nouvelleCarte(f, genererCode());
      const ref = await addDoc(collection(db, "cartesCadeaux"), { ...carte, creeLe: serverTimestamp() });
      window.location.hash = `#/cadeau/${ref.id}`;
    } catch {
      setErreur("Envoi impossible. Vérifiez la connexion et réessayez.");
    }
    setEnCours(false);
  };
  const champ = (k, label, props = {}) => (
    <label className="champ" style={{ display: "block", marginBottom: 10 }}>{label}
      <input value={f[k]} onChange={maj(k)} {...props} />
      {erreurs[k] && <span className="erreur">{erreurs[k]}</span>}
    </label>
  );
  return (
    <div className="bloc" style={{ maxWidth: 520, margin: "24px auto", padding: 20 }}>
      <h2>🎁 Offrir une carte cadeau</h2>
      <p className="aide">Un trajet aéroport, un soin beauté, des courses… La personne choisit quand elle veut. Valable sur tous les services Rebecca Services.</p>
      <p className="aide">{CONDITIONS_CADEAU}</p>
      <p><strong>Montant</strong></p>
      <div className="pourboire-boutons" style={{ flexWrap: "wrap" }}>
        {MONTANTS_CADEAU.map((m) => <button key={m} type="button" className={String(m) === String(f.montant) ? "actif" : ""} onClick={() => setF({ ...f, montant: String(m) })}>{m} ₪</button>)}
      </div>
      {champ("montant", "Ou un autre montant (₪)", { type: "number", inputMode: "numeric" })}
      <label className="champ" style={{ display: "block", marginBottom: 10 }}>Idée de cadeau
        <select value={f.idee} onChange={maj("idee")}>{IDEES_CADEAU.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      {champ("pourNom", "Pour (prénom)", { maxLength: 60 })}
      {champ("pourTel", "Son téléphone (facultatif, pour lui envoyer la carte)", { type: "tel", inputMode: "tel", maxLength: 30 })}
      <label className="champ" style={{ display: "block", marginBottom: 10 }}>Petit mot (facultatif)
        <textarea value={f.message} onChange={maj("message")} maxLength={300} rows={3} />
      </label>
      {champ("acheteurNom", "De la part de (votre prénom)", { maxLength: 60 })}
      {champ("acheteurTel", "Votre téléphone", { type: "tel", inputMode: "tel", maxLength: 30 })}
      <label className="champ" style={{ display: "block", marginBottom: 10 }}>Je paie par
        <select value={f.moyen} onChange={maj("moyen")}>{MOYENS_CADEAU.map((x) => <option key={x}>{x}</option>)}</select>
        {erreurs.moyen && <span className="erreur">{erreurs.moyen}</span>}
      </label>
      <button type="button" className="bouton" disabled={enCours} onClick={envoyer}>{enCours ? "Envoi…" : "Continuer vers le paiement"}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <p><button type="button" className="lien" onClick={onAccueil}>← Retour</button></p>
    </div>
  );
}
