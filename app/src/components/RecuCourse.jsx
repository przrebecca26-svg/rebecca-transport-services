import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { NOM, WHATSAPP } from "../contact.js";
import { duDe, encaisseDe } from "../pricing/finCourse.js";
import { recuPdf } from "../pricing/documentsPdf.js";
import { partagerPdf } from "../pricing/pdfSimple.js";

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
  const [info, setInfo] = useState("");
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
  const soldeOk = d.payeAuCoursier || paye >= du;
  const prixBase = typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime;
  // 19 nov. 2026 : vrai fichier PDF + feuille de partage (l'impression est bloquée dans l'appli de l'écran d'accueil)
  const partager = async () => {
    setInfo("");
    const lignes = [
      { libelle: `${d.serviceTitre || d.service} · ${dateFr(d.date)}${d.heure ? ` à ${d.heure}` : ""}`, montant: prixBase },
      ...(Number(d.ajustement) ? [{ libelle: d.fideliteOfferte ? "Course offerte (fidélité)" : "Ajout / déduction", montant: d.ajustement }] : []),
      { libelle: "Total", montant: du, gras: true },
      ...paiements.map((m) => ({ libelle: `Payé le ${dateFr(m.date)} · ${m.moyen}`, montant: m.montant })),
      ...(d.payeAuCoursier ? [{ libelle: "Payé en espèces au coursier", montant: du }] : []),
      { libelle: soldeOk ? "Payé ✓" : "Reste à payer", montant: soldeOk ? 0 : du - paye, gras: true },
    ];
    try {
      const octets = recuPdf({ nom: NOM, sousTitre: `Netanya · WhatsApp ${WHATSAPP}${osek ? ` · Osek n° ${osek}` : ""}`, numero, edite: dateFr(aujourdhui()), client: `${d.nom || ""}${d.telephone ? ` · ${d.telephone}` : ""}`, lignes, merci: "Merci pour votre confiance. « Votre temps est précieux, je vous aide à en profiter. »" });
      const r = await partagerPdf(octets, `Recu-${numero}.pdf`, `Reçu ${numero}`);
      if (r !== "annule" && !d.recuFaitLe) updateDoc(doc(db, "demandes", d.id), { recuFaitLe: aujourdhui(), majLe: serverTimestamp() }).catch(() => {});
      if (r === "telecharge") setInfo("PDF téléchargé.");
    } catch {
      setInfo("PDF impossible pour l'instant.");
    }
  };
  // 19 nov. 2026 : affiche par-dessus toute la page (avant, le reçu restait coincé dans la carte de la course :
  // fond transparent, textes mélangés au Calendrier, bouton « Fermer » invisible)
  return createPortal(
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
            <tr><td><b>{soldeOk ? "Payé ✓" : "Reste à payer"}</b></td><td><b>{soldeOk ? shekels(0) : shekels(du - paye)}</b></td></tr>
          </tbody>
        </table>
        <p className="st-petit">Merci pour votre confiance. « Votre temps est précieux, je vous aide à en profiter. »</p>
      </div>
      <div className="tb-actions st-sans-impression">
        <button className="tb-bouton" onClick={partager}>📤 Partager le PDF</button>
        <button className="tb-bouton tb-clair" onClick={imprimer}>Imprimer</button>
        <button className="tb-bouton tb-clair" onClick={() => setOuvert(false)}>Fermer</button>
      </div>
      {info && <p className="st-petit st-sans-impression" role="status">{info}</p>}
    </div>,
    document.body
  );
}
