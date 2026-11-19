import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { aEffacer, lireFichier, resumeImport } from "../pricing/importFichier.js";
import { enregistrerEssence, useEssence } from "../EssenceVue.jsx";
import { ajouterPlein, kmWolt } from "../pricing/essence.js";
import { champOperateur } from "../pricing/reverser.js";
import { ADMIN_ID } from "../pricing/equipe.js";

// 📥 IMPORTER UN FICHIER (19 nov. 2026, 16h03) - Finances, Rebecca seule.
// Claude prépare le tableau (.csv) ; Rebecca le télécharge, l'importe ici, voit l'aperçu, puis « Importer ».
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => String(d || "").split("-").reverse().slice(0, 2).join("/");

export default function ImportFichier({ autresRevenus = [] }) {
  const essence = useEssence();
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState(null); // { nom, r }
  const [etat, setEtat] = useState("");
  const [enCours, setEnCours] = useState(false);

  const choisir = async (e) => {
    setEtat("");
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 500000) return setEtat("Fichier trop gros.");
    setFichier({ nom: f.name, r: lireFichier(await f.text()) });
  };
  const r = fichier && fichier.r;
  const effacees = r ? aEffacer(autresRevenus, r.remplacer) : [];
  const s = r ? resumeImport(r) : null;
  const vide = r && !r.wolt.length && !r.depenses.length && !r.pleins.length && !effacees.length;

  const importer = async () => {
    if (!r || r.erreurs.length) return;
    setEnCours(true);
    setEtat("Import en cours…");
    try {
      for (const l of effacees) await deleteDoc(doc(db, "autresRevenus", l.id));
      let e = essence;
      for (const w of r.wolt) {
        const id = (await addDoc(collection(db, "autresRevenus"), { ...w.ligne, ...champOperateur(ADMIN_ID), creeLe: serverTimestamp(), majLe: serverTimestamp() })).id;
        if (e && w.km > 0) e = kmWolt(e, id, w.km);
      }
      for (const d of r.depenses) await addDoc(collection(db, "depenses"), { ...d, ...champOperateur(ADMIN_ID), creeLe: serverTimestamp() });
      if (e) for (const p of r.pleins) e = ajouterPlein(e, p);
      if (e && (r.pleins.length || r.wolt.some((w) => w.km > 0))) await enregistrerEssence(e);
      setEtat(`✓ Import terminé : ${s.wolt} ligne(s) Wolt${effacees.length ? ` (${effacees.length} ancienne(s) remplacée(s))` : ""}, ${s.depenses} dépense(s), ${s.pleins} plein(s).`);
      setFichier(null);
    } catch {
      setEtat("Import interrompu (connexion ?). Vérifie dans Wolt / Dépenses ce qui est passé avant de recommencer.");
    }
    setEnCours(false);
  };

  if (!ouvert) return <div className="tb-pad"><button type="button" className="tb-bouton tb-clair" onClick={() => setOuvert(true)}>📥 Importer un fichier (préparé par Claude)</button></div>;
  return (
    <div className="tb-bloc">
      <h3>📥 Importer un fichier</h3>
      <p className="tb-note">Claude te prépare le tableau (fichier .csv). Télécharge-le, puis choisis-le ici : tu vois tout avant d'importer.</p>
      <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={choisir} disabled={enCours} />
      {r && (
        <div className="ag-etape-actions">
          <p><strong>{fichier.nom}</strong></p>
          {r.erreurs.length > 0 && (
            <div className="fm-erreur" role="alert">
              <p>⚠️ {r.erreurs.length} ligne(s) à corriger : rien ne sera importé.</p>
              {r.erreurs.slice(0, 10).map((x) => <p key={x}>{x}</p>)}
            </div>
          )}
          {effacees.length > 0 && <p>🗑 {effacees.length} ancienne(s) ligne(s) Wolt remplacée(s) ({r.remplacer.map((x) => `${jj(x.du)} → ${jj(x.au)}`).join(", ")})</p>}
          {s.wolt > 0 && <p>🛵 {s.wolt} ligne(s) Wolt · {shekels(s.woltTotal)} · {s.livraisons} livraisons · {s.km} km</p>}
          {r.wolt.slice(0, 20).map((w, i) => (
            <p key={i} className="tb-note">{jj(w.ligne.debut)} → {jj(w.ligne.fin)} · {shekels(w.ligne.revenu)}{w.ligne.pourboire ? ` + ${shekels(w.ligne.pourboire)} pourboires` : ""}{w.ligne.caution ? ` · caution ${shekels(w.ligne.caution)}` : ""} · {w.ligne.livraisons} liv. · {w.km} km</p>
          ))}
          {s.depenses > 0 && <p>🧾 {s.depenses} dépense(s) · {shekels(s.depensesTotal)}</p>}
          {s.pleins > 0 && <p>⛽ {s.pleins} plein(s) · {shekels(s.pleinsTotal)}</p>}
          {vide && <p className="tb-note">Rien à importer dans ce fichier.</p>}
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours || r.erreurs.length > 0 || vide} onClick={importer}>Importer</button>
            <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => { setFichier(null); setEtat(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {etat && <p className="tb-note" role="status">{etat}</p>}
      <button type="button" className="ag-modifier" onClick={() => setOuvert(false)}>Fermer</button>
    </div>
  );
}
