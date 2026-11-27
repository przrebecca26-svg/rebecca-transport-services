import PageProVue from "./PageProVue.jsx";
import { useApercu, usePagePublique } from "../pagesProBase.js";

// PAGE D'UN PROFESSIONNEL EN LIGNE (rebeccaservices.com/p/adresse) ou APERCU PRIVE (#/apercu/jeton) - lot 1
// Une page suspendue ou archivee n'affiche que « momentanément indisponible » : ses donnees restent chez Rebecca.
function Indispo({ titre, texte }) {
  return (
    <div className="pv-indispo">
      <h1 style={{ margin: 0 }}>{titre}</h1>
      <p style={{ margin: 0 }}>{texte}</p>
      <a href="https://rebeccaservices.com/#/pros">Voir les professionnels partenaires de Rebecca Services</a>
    </div>
  );
}

function Contenu({ page, apercu }) {
  if (page === undefined) return <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;
  if (!page) return <Indispo titre="Page introuvable" texte={apercu ? "Ce lien d'aperçu a expiré ou a été retiré." : "Cette adresse ne correspond à aucune page."} />;
  if (page.statut !== "publiee") return <Indispo titre={page.nom || "Page indisponible"} texte="Cette page est momentanément indisponible." />;
  return (
    <>
      {apercu && <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#191518", color: "#F1AEB7", textAlign: "center", padding: "8px 12px", fontSize: 14, fontFamily: "Inter, Arial, sans-serif" }}>Aperçu privé — cette page n'est pas encore publiée</div>}
      <PageProVue page={page} />
    </>
  );
}
export function PageEnLigne({ adresse }) {
  return <Contenu page={usePagePublique(adresse)} />;
}
export function ApercuPrive({ jeton }) {
  return <Contenu page={useApercu(jeton)} apercu />;
}
