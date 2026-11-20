import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { SITE } from "../site.js";
import { useContratsRestos } from "../contratsRestosBase.js";
import { LIEN_INSCRIPTION, TARIFS_STANDARD, numeroContrat, tarifsConformes, tarifsStandard } from "../pricing/contratResto.js";
import { contratLisible } from "./ContratRestoVue.jsx";
import GrilleKmResto from "./GrilleKmResto.jsx";

// RESTAURANTS PARTENAIRES (19 nov. 2026) - dans Partenaires, Rebecca seule.
// Le lien d'inscription (le même pour tous), les contrats signés, et les prix standard des formules.
const STATUTS = { signe: "✍️ Signé · à activer", valide: "✓ Actif" };
const MESSAGE = (lien) => `Bonjour ! Voici la présentation du partenariat livraison de Rebecca Services, avec les conditions et l'inscription en ligne : ${lien}\n\nVous choisissez votre formule, vous signez avec le doigt et vous recevez le contrat par e-mail. Rebecca`;

function PrixStandard() {
  const [reglage, setReglage] = useState(null);
  const [t, setT] = useState(null);
  const [info, setInfo] = useState("");
  useEffect(() => onSnapshot(doc(db, "reglages", "restos"), (s) => setReglage(s.exists() ? s.data() : {}), () => setReglage({})), []);
  useEffect(() => {
    if (reglage && !t) setT(tarifsStandard(reglage));
  }, [reglage, t]);
  if (!t) return null;
  const maj = (f, k, v) => setT({ ...t, [f]: { ...t[f], [k]: Math.max(0, Math.min(999, Math.round(Number(v) || 0))) } });
  const enregistrer = () => setDoc(doc(db, "reglages", "restos"), { A: { ...t.A, parHeure: 0 }, B: t.B, majLe: serverTimestamp() }).then(() => setInfo("✓ Prix enregistrés : la page d'inscription les affiche tout de suite."), () => setInfo("Enregistrement impossible."));
  const CHAMPS = [["jusqua3", "Jusqu'à 3 km"], ["de3a6", "De 3 à 6 km"], ["enPlus", "Commande en plus"], ["tresLourd", "Article très lourd (pack d'eau…)"]];
  return (
    <details>
      <summary className="tb-note">Prix des formules sur la page d'inscription</summary>
      {["A", "B"].map((f) => (
        <div key={f} className="rp-correction">
          <p className="rp-type">Formule {f}</p>
          {CHAMPS.map(([k, l]) => (
            <div key={k} className="champ"><label>{l} (₪)<input type="number" inputMode="numeric" value={t[f][k]} onChange={(e) => maj(f, k, e.target.value)} /></label></div>
          ))}
          {f === "B" && <div className="champ"><label>Minimum par heure de créneau (₪) · créneau de 2 h au moins<input type="number" inputMode="numeric" value={t.B.parHeure} onChange={(e) => maj("B", "parHeure", e.target.value)} /></label></div>}
          <GrilleKmResto tarifs={t[f]} titre={`Grille de la formule ${f} (6-12 km calculés tout seuls)`} />
        </div>
      ))}
      <div className="tb-actions">
        <button type="button" className="tb-bouton" onClick={enregistrer}>Enregistrer les prix</button>
        <button type="button" className="tb-bouton tb-clair" onClick={() => setT(TARIFS_STANDARD)}>Prix d'origine</button>
      </div>
      <p className="tdb-note">Un contrat déjà signé garde les prix du jour de sa signature.</p>
      {info && <p className="tdb-note" role="status">{info}</p>}
    </details>
  );
}

export default function RestosPartenaires({ aller }) {
  const liste = useContratsRestos();
  const [reglage, setReglage] = useState(null);
  const [copie, setCopie] = useState(false);
  useEffect(() => onSnapshot(doc(db, "reglages", "restos"), (s) => setReglage(s.exists() ? s.data() : {}), () => {}), []);
  const lien = `${SITE}/${LIEN_INSCRIPTION}`;
  const copier = () => navigator.clipboard && navigator.clipboard.writeText(lien).then(() => setCopie(true), () => {});
  return (
    <div className="tb-bloc">
      <h3>Restaurants partenaires</h3>
      <p className="tb-note">Le même lien pour tous les restaurants : présentation, conditions, formule, signature au doigt. Le contrat part par e-mail au restaurant et à toi, et la fiche arrive toute seule dans ton Répertoire (Commerçants).</p>
      <p className="tdb-note" style={{ wordBreak: "break-all" }}>{lien}</p>
      <div className="tb-actions">
        <a className="tb-bouton" href={`https://wa.me/?text=${encodeURIComponent(MESSAGE(lien))}`} target="_blank" rel="noopener noreferrer">💬 Envoyer sur WhatsApp</a>
        <button type="button" className="tb-bouton tb-clair" onClick={copier}>{copie ? "✓ Copié" : "Copier le lien"}</button>
        <a className="tb-bouton tb-clair" href={LIEN_INSCRIPTION} target="_blank" rel="noopener noreferrer">Voir la page</a>
      </div>
      <PrixStandard />
      <p className="rp-type">Contrats ({liste ? liste.length : "…"})</p>
      {liste && !liste.length && <p className="tb-note">Aucun restaurant inscrit pour l'instant.</p>}
      {(liste || []).map((x) => {
        const c = contratLisible(x);
        return (
          <div key={c.id} className="rp-correction">
            <b>{c.nom}</b> <span className="tb-note">· {STATUTS[c.statut] || c.statut} · formule {c.formule}</span>
            <p className="tdb-note">n° {numeroContrat(c.id, c.signeLe)} · {c.responsable} · {c.portable || c.telephone} · {c.email}</p>
            {reglage && !tarifsConformes(c, tarifsStandard(reglage)) && <p className="tdb-note">⚠️ Les prix signés ne sont plus les prix standard actuels (le contrat garde ceux du jour de la signature).</p>}
            {c.statut === "signe" && <p className="tdb-note">Pour l'activer : Répertoire → Commerçants → {c.nom} → « Créer le lien du restaurant » (ça contresigne le contrat).</p>}
            <div className="tb-actions">
              <a
                className="tb-bouton tb-clair"
                href={`#/contrat-resto/${c.id}`}
                onClick={() => {
                  // 20 nov. 2026 : depuis l'icône iPhone, le contrat s'ouvre dans l'appli -> bouton « ← Retour à Partenaires »
                  try { sessionStorage.setItem("rs-retour-contrat", "#/admin?onglet=partenaires"); } catch { /* pas de stockage : pas de bouton retour */ }
                }}
              >📄 Voir le contrat</a>
              {aller && <button type="button" className="tb-bouton tb-clair" onClick={() => aller("repertoire")}>Ouvrir le Répertoire</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
