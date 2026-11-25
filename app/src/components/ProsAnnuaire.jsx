import { useEffect, useMemo, useState } from "react";
import { categoriesVisibles, libelleFormule, lienContactPro, nomCategorie, rechercherPros, villesDesFiches } from "../pricing/pros.js";
import { fermetureEnCours } from "../pricing/assistance.js";
import { compterPro, useAnnuairePros, useCategoriesPros, useImagesPro } from "../prosBase.js";

// ANNUAIRE DES PROFESSIONNELS PARTENAIRES (25 nov. 2026) - #/pros et #/pros/ID
// Page cachée du public jusqu'à l'accord de Rebecca (Réglages -> Pages du site). Rebecca la voit en aperçu dans son
// espace (Professionnels -> Aperçu). Mention « Prestataire indépendant » sur chaque fiche ; aucune demande envoyée
// pendant Chabbat et les fêtes ; Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
const idDansLien = (h) => (/^#\/pros\/([A-Za-z0-9_-]{2,30})$/.exec(h || "") || [])[1] || "";

function Contact({ fiche, onClic }) {
  const [ferme, setFerme] = useState(() => fermetureEnCours());
  useEffect(() => {
    const t = setInterval(() => setFerme(fermetureEnCours()), 60000);
    return () => clearInterval(t);
  }, []);
  const c = lienContactPro(fiche, ferme);
  const r = lienContactPro(fiche, ferme, { rdv: true });
  if (!c.lien) return <p className="tb-note" role="status">{c.message}</p>;
  return (
    <div className="tb-actions">
      <a className="pp-bouton" href={c.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>💬 Contacter</a>
      <a className="bouton-secondaire" href={r.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>📅 Demander un rendez-vous</a>
    </div>
  );
}

function Fiche({ f, categories, ouverte, onOuvrir, apercu }) {
  const img = useImagesPro(f.id);
  useEffect(() => {
    if (ouverte && !apercu) compterPro(f.id, "visites");
  }, [ouverte, f.id, apercu]);
  return (
    <article className="pp-bloc" style={{ padding: 12 }}>
      <button type="button" onClick={onOuvrir} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", width: "100%" }} aria-expanded={ouverte}>
        {img.logo ? <img src={img.logo} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} /> : <span style={{ fontSize: 40 }}>{(categories.find((c) => c.id === f.categorie) || {}).icone || "✨"}</span>}
        <span style={{ flex: 1 }}>
          <strong style={{ fontSize: "1.1em" }}>{f.nomCommercial}</strong>
          {f.verifie && <span title="Documents contrôlés par Rebecca Services" style={{ marginLeft: 6 }}>✅ Partenaire vérifié</span>}
          <br />
          <small>{[nomCategorie(categories, f.categorie), f.metier].filter(Boolean).join(" · ")}</small>
          <br />
          <small>📍 {f.villes}{f.zone ? ` · ${f.zone}` : ""}</small>
        </span>
      </button>
      {ouverte && (
        <div style={{ marginTop: 10 }}>
          {(img.photos || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0" }}>
              {img.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 130, borderRadius: 10 }} />)}
            </div>
          )}
          {f.description && <p style={{ whiteSpace: "pre-line" }}>{f.description}</p>}
          {f.prestations && <p style={{ whiteSpace: "pre-line" }}><b>Prestations :</b> {f.prestations}</p>}
          <p><b>Tarifs :</b> {f.tarifs}</p>
          {f.horaires && <p>🕒 {f.horaires}</p>}
          {(f.langues || []).length > 0 && <p>🗣️ {f.langues.join(", ")}</p>}
          {f.siteDigital && <p><a className="lien" href={f.siteDigital} target="_blank" rel="noopener noreferrer">🌐 Voir sa page ({libelleFormule(f.formule)})</a></p>}
          <Contact fiche={f} onClic={() => !apercu && compterPro(f.id, "whatsapp")} />
          <p className="tb-note" style={{ marginTop: 8 }}>
            <b>Prestataire indépendant.</b> Ce professionnel réalise lui-même ses prestations, sous sa responsabilité. Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
            {f.verifie ? " Le label « Partenaire vérifié » indique que des documents ont été contrôlés ; ce n'est pas une garantie de résultat." : ""}
          </p>
        </div>
      )}
    </article>
  );
}

export default function ProsAnnuaire({ onAccueil, apercu = false }) {
  const fiches = useAnnuairePros();
  const categories = useCategoriesPros();
  const [filtre, setFiltre] = useState({ categorie: "", ville: "", texte: "" });
  const [ouverte, setOuverte] = useState(() => idDansLien(window.location.hash));
  useEffect(() => {
    if (apercu) return undefined;
    const suivre = () => setOuverte(idDansLien(window.location.hash));
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, [apercu]);
  const cats = categoriesVisibles(categories || []);
  // une fiche d'un metier cache n'apparait jamais, meme si la liste publique n'est pas encore a jour
  const visibles = useMemo(() => (fiches || []).filter((f) => cats.some((c) => c.id === f.categorie)), [fiches, cats]);
  const liste = rechercherPros(visibles, filtre);
  const villes = villesDesFiches(visibles);
  const ouvrir = (id) => {
    const suite = ouverte === id ? "" : id;
    setOuverte(suite);
    if (!apercu) window.history.replaceState(null, "", suite ? `#/pros/${suite}` : "#/pros");
  };
  return (
    <section>
      <div className="pp-bloc">
        {onAccueil && <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>}
        <h2>✨ Professionnels partenaires</h2>
        <p>Des professionnels indépendants recommandés en Israël : beauté, ménage, travaux, traiteurs, événements… Contactez-les directement.</p>
        <label className="champ">
          <span>Métier</span>
          <select value={filtre.categorie} onChange={(e) => setFiltre({ ...filtre, categorie: e.target.value })}>
            <option value="">Tous les métiers</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
          </select>
        </label>
        <label className="champ">
          <span>Ville</span>
          <input list="pros-villes" value={filtre.ville} placeholder="ex. Netanya" onChange={(e) => setFiltre({ ...filtre, ville: e.target.value })} />
          <datalist id="pros-villes">{villes.map((v) => <option key={v} value={v} />)}</datalist>
        </label>
        <label className="champ">
          <span>Recherche</span>
          <input value={filtre.texte} placeholder="ex. manucure, plombier, gâteaux" onChange={(e) => setFiltre({ ...filtre, texte: e.target.value })} />
        </label>
        {!fiches && <p className="tb-note">Chargement…</p>}
        {fiches && !liste.length && <p className="tb-note">{visibles.length ? "Aucun professionnel ne correspond à votre recherche." : "Bientôt ici : nos professionnels partenaires."}</p>}
      </div>
      {liste.map((f) => <Fiche key={f.id} f={f} categories={cats} ouverte={ouverte === f.id} onOuvrir={() => ouvrir(f.id)} apercu={apercu} />)}
      {!apercu && (
        <div className="pp-bloc">
          <p><b>Vous êtes professionnel en Israël ?</b> Rejoignez l'annuaire.</p>
          <a className="bouton-secondaire" href="#/pro">Découvrir les formules</a>
        </div>
      )}
    </section>
  );
}
