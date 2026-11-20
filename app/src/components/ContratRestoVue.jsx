import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { SignatureVue } from "./SignatureDoigt.jsx";
import { partagerPdf } from "../pricing/pdfSimple.js";
import { articlesContrat, contratPdf, lignesSignatures, numeroContrat } from "../pricing/contratResto.js";
import "../partenariat.css";

// CONTRAT D'UN RESTAURANT PARTENAIRE EN LIGNE (19 nov. 2026) - #/contrat-resto/ID
// Le lien (identifiant impossible à deviner) est envoyé par e-mail au restaurant et à Rebecca.
// Dates : un horodatage Firebase devient « AAAA-MM-JJTHH:MM » (heure d'Israël)
const enTexte = (t) => {
  if (!t) return "";
  if (typeof t === "string") return t;
  const d = typeof t.toDate === "function" ? t.toDate() : new Date(t);
  return `${d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" })}T${d.toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })}`;
};
export const contratLisible = (c) => (c ? { ...c, signeLe: enTexte(c.signeLe), valideLe: enTexte(c.valideLe) } : c);

export default function ContratRestoVue({ id, onAccueil }) {
  const [c, setC] = useState(undefined);
  useEffect(() => {
    getDoc(doc(db, "contratsRestos", id)).then((s) => setC(s.exists() ? contratLisible(s.data()) : null)).catch(() => setC(null));
  }, [id]);
  if (c === undefined) return <div className="pp"><section className="pp-bloc">Chargement…</section></div>;
  if (!c) return <div className="pp"><section className="pp-bloc">Ce contrat est introuvable.<br /><button type="button" className="pp-lien" onClick={onAccueil}>rebeccaservices.com</button></section></div>;
  const numero = numeroContrat(id, c.signeLe);
  const retour = (() => { try { return sessionStorage.getItem("rs-retour-contrat") || ""; } catch { return ""; } })();
  const revenir = () => {
    try { sessionStorage.removeItem("rs-retour-contrat"); } catch { /* rien */ }
    window.location.hash = retour;
  };
  return (
    <div className="pp">
      {retour && <button type="button" className="pp-lien" style={{ display: "block", margin: "10px 16px 0", fontSize: 16 }} onClick={revenir}>← Retour à Partenaires</button>}
      <header className="pp-entete">
        <img src="/brand/logo-medaillon%20.png" alt="Rebecca Services" className="pp-logo" />
        <div>
          <h1>Contrat de partenariat livraison</h1>
          <p>{c.nom} · n° {numero}</p>
        </div>
      </header>
      <section className="pp-bloc">
        <p className="pp-statut">{c.statut === "valide" ? "✓ Contrat actif, signé des deux côtés" : "✍️ Signé par le restaurant · en attente de validation par Rebecca Services"}</p>
        <button type="button" className="pp-bouton" onClick={() => partagerPdf(contratPdf(c, id), `Contrat-${numero}.pdf`, "Contrat de partenariat")}>📄 Télécharger le PDF</button>
        {articlesContrat(c).map((a) => (
          <div key={a.titre} className="pp-article ouvert">
            <h3>{a.titre}</h3>
            {a.lignes.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        ))}
        <h3>Signatures</h3>
        {lignesSignatures(c, id).map((l) => <p key={l}>{l}</p>)}
        <SignatureVue valeur={c.signature} />
        <p className="pp-note">Signature de {c.signataire}</p>
      </section>
      <footer className="pp-pied">
        <button type="button" className="pp-lien" onClick={onAccueil}>rebeccaservices.com</button>
      </footer>
    </div>
  );
}
