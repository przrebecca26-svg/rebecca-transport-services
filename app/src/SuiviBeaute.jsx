import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { CATALOGUE_DEPART } from "./pricing/catalogue.js";
import { ACTIVITES_SUIVI, MAX_VERSEMENTS, ajouterCure, ajouterSeance, ajouterVersement, etatCure, idDocSuivi, lireSuivi, resumeActivite, retirerCure, retirerSeance } from "./pricing/suiviBeaute.js";

// ONGLET « SUIVI » DE LA FICHE (13 nov. 2026, 09h49) - Rebecca seule (beaute : jamais Jeremy).
// Une ligne par seance : date, prestation, prix, paye, moyen, produits achetes, prochain rendez-vous, commentaire.
// Cures (Slim & Lift, RegenX...) : prix, nombre de seances, versements notes un par un (4 maximum apres l'acompte).
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "");
const SEANCE_VIDE = () => ({ activite: "nails", date: aujourdhui(), prestation: "", prix: "", paye: "", moyen: TARIFS.moyensPaiement[0], produits: "", prixProduits: "", prochainRdv: "", commentaire: "", cure: "" });
const MOYENS = [...TARIFS.moyensPaiement, "Chèque"];

export default function SuiviBeaute({ cle }) {
  const ref = doc(db, "admin", idDocSuivi(cle));
  const [s, setS] = useState(null);
  const [filtre, setFiltre] = useState("");
  const [seance, setSeance] = useState(null);
  const [cure, setCure] = useState(null);
  const [versement, setVersement] = useState(null); // { cureId, date, montant, moyen, note }
  const [message, setMessage] = useState("");
  useEffect(() => onSnapshot(ref, (x) => setS(lireSuivi(x.exists() ? x.data().json : "{}")), () => setS(lireSuivi("{}"))), [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="tdb-note">Chargement du suivi…</p>;
  const sauver = async (suite) => {
    setMessage("");
    try {
      await setDoc(ref, { json: JSON.stringify(suite), majLe: serverTimestamp() });
      return true;
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
      return false;
    }
  };
  const nomAct = (v) => (ACTIVITES_SUIVI.find((a) => a.v === v) || {}).l || v;
  const seances = s.seances.filter((x) => !filtre || x.activite === filtre).sort((a, b) => b.date.localeCompare(a.date));
  const cures = s.cures.filter((c) => !filtre || c.activite === filtre);
  const r = resumeActivite(s, filtre, aujourdhui());
  const set = (k, v) => setSeance((x) => ({ ...x, [k]: v }));

  return (
    <section className="tdb-bloc">
      <div className="tb-filtres" role="tablist" aria-label="Activité">
        {[{ v: "", l: "Toutes" }, ...ACTIVITES_SUIVI].map((a) => (
          <button key={a.v || "tout"} role="tab" aria-selected={filtre === a.v} className={"tb-filtre" + (filtre === a.v ? " actif" : "")} onClick={() => setFiltre(a.v)}>{a.l}</button>
        ))}
      </div>
      <p className="tdb-note">{r.nb} séance{r.nb > 1 ? "s" : ""}{r.impaye ? ` · reste à payer ${shekels(r.impaye)}` : " · tout est payé"}{r.prochain ? ` · prochain rendez-vous le ${jj(r.prochain)}` : ""}</p>

      {cures.map((c) => {
        const e = etatCure(s, c);
        return (
          <div key={c.id} className="bloc">
            <p><strong>{c.nom}</strong> <small>({nomAct(c.activite)})</small></p>
            <p className="tdb-note">Séances : {e.faites} / {c.seances} · payé {shekels(e.paye)} sur {shekels(c.prix)} · <strong>reste {shekels(e.reste)}</strong></p>
            {c.versements.map((v, i) => <p key={i} className="tdb-note">{jj(v.date)} · {shekels(v.montant)} · {v.moyen}{v.note ? " · " + v.note : ""}</p>)}
            {versement && versement.cureId === c.id ? (
              <div className="rp-correction">
                <label className="champ">Date<input type="date" value={versement.date} onChange={(x) => setVersement({ ...versement, date: x.target.value })} /></label>
                <label className="champ">Montant (₪)<input inputMode="decimal" value={versement.montant} onChange={(x) => setVersement({ ...versement, montant: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
                <label className="champ">Moyen<select value={versement.moyen} onChange={(x) => setVersement({ ...versement, moyen: x.target.value })}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label className="champ">Note (acompte, chèque n°…)<input maxLength={100} value={versement.note} onChange={(x) => setVersement({ ...versement, note: x.target.value })} /></label>
                <div className="tb-actions">
                  <button type="button" className="tb-bouton" disabled={!(Number(String(versement.montant).replace(",", ".")) > 0)} onClick={async () => (await sauver(ajouterVersement(s, c.id, versement))) && setVersement(null)}>Enregistrer</button>
                  <button type="button" className="tb-bouton tb-clair" onClick={() => setVersement(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div className="tb-actions">
                {e.reste > 0 && e.versementsRestants > 0 && <button type="button" className="tb-bouton" onClick={() => setVersement({ cureId: c.id, date: aujourdhui(), montant: String(Math.ceil(e.reste / Math.min(MAX_VERSEMENTS, e.versementsRestants))), moyen: MOYENS[0], note: c.versements.length === 0 ? "Acompte" : "" })}>+ Versement</button>}
                <button type="button" className="tb-bouton tb-clair" onClick={() => setSeance({ ...SEANCE_VIDE(), activite: c.activite, cure: c.id, prestation: `${c.nom} · séance ${e.faites + 1}` })}>+ Séance de la cure</button>
                <button type="button" className="dr-secondaire" onClick={() => window.confirm("Supprimer cette cure du suivi ?") && sauver(retirerCure(s, c.id))}>Supprimer</button>
              </div>
            )}
          </div>
        );
      })}

      {seance ? (
        <div className="bloc">
          <h4>Nouvelle séance</h4>
          <label className="champ">Activité<select value={seance.activite} onChange={(x) => set("activite", x.target.value)}>{ACTIVITES_SUIVI.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></label>
          <label className="champ">Date<input type="date" value={seance.date} onChange={(x) => set("date", x.target.value)} /></label>
          <label className="champ">Ce que je lui ai fait
            <input list={"pr-" + seance.activite} maxLength={120} value={seance.prestation} onChange={(x) => set("prestation", x.target.value)} />
            <datalist id={"pr-" + seance.activite}>{CATALOGUE_DEPART.filter((p) => p.activite === seance.activite).map((p) => <option key={p.id} value={p.nom} />)}</datalist>
          </label>
          {!seance.cure && <label className="champ">Prix (₪)<input inputMode="decimal" value={seance.prix} onChange={(x) => set("prix", x.target.value.replace(/[^0-9.,]/g, ""))} /></label>}
          <label className="champ">Produits achetés (facultatif)<input maxLength={200} value={seance.produits} onChange={(x) => set("produits", x.target.value)} /></label>
          {seance.produits && <label className="champ">Prix des produits (₪)<input inputMode="decimal" value={seance.prixProduits} onChange={(x) => set("prixProduits", x.target.value.replace(/[^0-9.,]/g, ""))} /></label>}
          {!seance.cure && <label className="champ">Elle a payé (₪, vide = pas encore)<input inputMode="decimal" value={seance.paye} onChange={(x) => set("paye", x.target.value.replace(/[^0-9.,]/g, ""))} /></label>}
          {!seance.cure && Number(seance.paye) > 0 && <label className="champ">Moyen<select value={seance.moyen} onChange={(x) => set("moyen", x.target.value)}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select></label>}
          <label className="champ">Prochain rendez-vous<input type="date" value={seance.prochainRdv} onChange={(x) => set("prochainRdv", x.target.value)} /></label>
          <label className="champ">Commentaire<textarea rows={3} maxLength={1000} value={seance.commentaire} onChange={(x) => set("commentaire", x.target.value)} /></label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!seance.date} onClick={async () => (await sauver(ajouterSeance(s, seance))) && setSeance(null)}>Enregistrer la séance</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setSeance(null)}>Annuler</button>
          </div>
        </div>
      ) : cure ? (
        <div className="bloc">
          <h4>Nouvelle cure ou forfait</h4>
          <label className="champ">Activité<select value={cure.activite} onChange={(x) => setCure({ ...cure, activite: x.target.value })}>{ACTIVITES_SUIVI.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></label>
          <label className="champ">Nom<input list="cures-cat" maxLength={120} value={cure.nom} onChange={(x) => setCure({ ...cure, nom: x.target.value })} /><datalist id="cures-cat">{CATALOGUE_DEPART.filter((p) => p.seances).map((p) => <option key={p.id} value={p.nom} />)}</datalist></label>
          <label className="champ">Prix total (₪)<input inputMode="decimal" value={cure.prix} onChange={(x) => setCure({ ...cure, prix: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="champ">Nombre de séances<input inputMode="numeric" value={cure.seances} onChange={(x) => setCure({ ...cure, seances: x.target.value.replace(/[^0-9]/g, "") })} /></label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!cure.nom.trim()} onClick={async () => (await sauver(ajouterCure(s, { ...cure, debut: aujourdhui() }))) && setCure(null)}>Créer la cure</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setCure(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="tb-actions">
          <button type="button" className="tb-bouton" onClick={() => setSeance({ ...SEANCE_VIDE(), activite: filtre || "nails" })}>+ Séance</button>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setCure({ activite: filtre || "slim", nom: "", prix: "", seances: "8" })}>+ Cure ou forfait</button>
        </div>
      )}

      <ul className="ag-fil" style={{ marginTop: 12 }}>
        {seances.length === 0 && <li className="ag-etape">Aucune séance notée.</li>}
        {seances.map((x) => (
          <li key={x.id} className="ag-etape">
            <div className="ag-etape-ligne">
              <b>{jj(x.date)}</b>
              <span>
                <small>{nomAct(x.activite)} · </small>{x.prestation || "Séance"}
                {!x.cure && <strong> · {shekels(x.prix + x.prixProduits)}</strong>}
                {!x.cure && <small>{x.paye >= x.prix + x.prixProduits ? ` · payé (${x.moyen})` : x.paye > 0 ? ` · payé ${shekels(x.paye)}, reste ${shekels(x.prix + x.prixProduits - x.paye)}` : " · pas encore payé"}</small>}
                {x.cure && <small> · cure</small>}
                {x.produits && <small> · produits : {x.produits}</small>}
                {x.prochainRdv && <small> · prochain RDV {jj(x.prochainRdv)}</small>}
                {x.commentaire && <small style={{ display: "block" }}>{x.commentaire}</small>}
              </span>
              <button type="button" className="ag-modifier" onClick={() => window.confirm("Supprimer cette séance ?") && sauver(retirerSeance(s, x.id))}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="tdb-note">Le suivi est ton carnet. L'argent des réservations du site se note toujours dans la réservation (Demandes) pour arriver dans Finances.</p>
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </section>
  );
}
