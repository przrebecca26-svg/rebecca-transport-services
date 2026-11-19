import { useEffect, useState } from "react";
import { normaliserRevolut } from "../pricing/suiteClient.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// PAYER LE POURBOIRE (19 nov. 2026, test C) : après l'avis, la cliente voit comment l'envoyer (PayPal, Revolut,
// Bit, espèces) et prévient Rebecca sur WhatsApp. Rebecca l'enregistre ensuite comme pourboire (💰 Encaissé).
// Aucune écriture dans la base : pas de nouvelle règle Firebase.
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

export default function PayerPourboire({ montant, prenom = "", course = "" }) {
  const [liens, setLiens] = useState(null);
  useEffect(() => {
    charger().then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "paiement"))).then((x) => setLiens(x.exists() ? x.data() : {})).catch(() => setLiens({}));
  }, []);
  if (!(montant > 0)) return null;
  const l = liens || {};
  const paypal = /^https:\/\//.test(l.paypal || "") ? `${l.paypal.trim().replace(/\/$/, "")}${/paypal\.me\//.test(l.paypal) ? `/${montant}ILS` : ""}` : "";
  const revolut = normaliserRevolut(l.revolut);
  const bit = String(l.bit || "").trim();
  const prevenir = (moyen) => lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je vous ai envoyé un pourboire de ${montant} ₪ par ${moyen}${course ? ` pour ${course}` : ""}. Merci ! ${prenom}`.trim());
  return (
    <div className="hist-avis">
      <p className="aide">💝 Pour envoyer votre pourboire de <strong>{montant} ₪</strong> :</p>
      <div className="pourboire-boutons" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        {paypal && <a className="actif" href={paypal} target="_blank" rel="noopener noreferrer">Payer par PayPal</a>}
        {revolut && <a className="actif" href={revolut} target="_blank" rel="noopener noreferrer">Payer par Revolut</a>}
        {bit.replace(/\D/g, "").length >= 9 && <p className="aide">Bit : envoyez {montant} ₪ au <strong dir="ltr">{bit}</strong></p>}
        <p className="aide">Ou en espèces lors de votre prochaine course.</p>
      </div>
      <p className="aide">Une fois envoyé, prévenez Rebecca :</p>
      <div className="pourboire-boutons" style={{ flexWrap: "wrap" }}>
        {["Bit", "PayPal", "Revolut", "Espèces"].map((m) => <a key={m} href={prevenir(m)} target="_blank" rel="noopener noreferrer">J'ai envoyé par {m}</a>)}
      </div>
    </div>
  );
}
