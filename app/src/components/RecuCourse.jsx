import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { NOM, WHATSAPP } from "../contact.js";
import { duDe, encaisseDe } from "../pricing/finCourse.js";

// REÇU PDF (18 nov. 2026, suggestion validée) : reçu de la course prêt à imprimer ou à enregistrer en PDF
// (« Imprimer » puis « Enregistrer dans Fichiers » ou partager sur iPhone). Il ne remplace pas une kabala
// officielle si le comptable en demande une.
const dateFr = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(j || "") ? j.split("-").reverse().join("/") : j || "");
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function RecuCourse({ d }) {
  const [ouvert, setOuvert] = useState(false);
  const [mvts, setMvts] = useState([]);
  const [osek, setOsek] = useState("");
  useEffect(() => {
    if (!ouvert) return undefined;
    getDoc(doc(db, "reglages", "paiement")).then((x) => setOsek(x.exists() ? x.data().osek || "" : "")).catch(() => {});
    return onSnapshot(query(collection(db, "mouvements"), where("resId", "==", d.id)), (s) => setMvts(s.docs.map((x) => x.data())), () => {});
  }, [ouvert, d.id]);
  const imprimer = () => {
    window.print();
    if (!d.recuFaitLe) updateDoc(doc(db, "demandes", d.id), { recuFaitLe: aujourdhui(), majLe: serverTimestamp() }).catch(() => {});
  };
  if (!ouvert) return <button className="tb-bouton tb-clair" onClick={() => setOuvert(true)}>🧾 Reçu PDF</button>;
  const paiements = mvts.filter((m) => m.kind === "paiement").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const du = duDe(d);
  const paye = encaisseDe(mvts, d.id);
  const numero = `${(d.date || aujourdhui()).replace(/-/g, "")}-${String(d.id).slice(0, 5).toUpperCase()}`;
  return (
    <div className="st-rapport" role="dialog" aria-label="Reçu">
      <div className="st-page">
        <h2>{NOM}</h2>
        <p>Netanya · WhatsApp {WHATSAPP}{osek ? ` · Osek n° ${osek}` : ""}</p>
        <h3>Reçu n° {numero}</h3>
        <p>Édité le {dateFr(aujourdhui())}</p>
        <p><b>Client :</b> {d.nom || ""}{d.telephone ? ` · ${d.telephone}` : ""}</p>
        <table>
          <tbody>
            <tr><td>{d.serviceTitre || d.service} · {dateFr(d.date)}{d.heure ? ` à ${d.heure}` : ""}</td><td>{shekels(typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime)}</td></tr>
            {Number(d.ajustement) ? <tr><td>{d.fideliteOfferte ? "Course offerte (fidélité)" : "Ajout / déduction"}</td><td>{shekels(d.ajustement)}</td></tr> : null}
            <tr><td><b>Total</b></td><td><b>{shekels(du)}</b></td></tr>
            {paiements.map((m, i) => <tr key={i}><td>Payé le {dateFr(m.date)} · {m.moyen}</td><td>{shekels(m.montant)}</td></tr>)}
            {d.payeAuCoursier && <tr><td>Payé en espèces au coursier</td><td>{shekels(du)}</td></tr>}
            <tr><td><b>{d.payeAuCoursier || paye >= du ? "Payé ✓" : "Reste à payer"}</b></td><td><b>{d.payeAuCoursier || paye >= du ? shekels(0) : shekels(du - paye)}</b></td></tr>
          </tbody>
        </table>
        <p className="st-petit">Merci pour votre confiance. « Votre temps est précieux, je vous aide à en profiter. »</p>
      </div>
      <div className="tb-actions st-sans-impression">
        <button className="tb-bouton" onClick={imprimer}>Imprimer / PDF</button>
        <button className="tb-bouton tb-clair" onClick={() => setOuvert(false)}>Fermer</button>
      </div>
    </div>
  );
}
