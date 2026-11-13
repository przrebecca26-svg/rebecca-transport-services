import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { ajouterPlein, essenceDuMois, lireEssence, retirerPlein } from "./pricing/essence.js";

// MON ESSENCE (13 nov. 2026) - Finances -> Essence (Rebecca seule). Document prive admin/essence.
// Tous les pleins, et chaque mois : travail Rebecca Services, travail Wolt, perso.
const REF = () => doc(db, "admin", "essence");
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const km = (n) => `${Math.round(n).toLocaleString("fr-FR")} km`;
const nomMois = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const decaler = (m, d) => {
  const [a, n] = m.split("-").map(Number);
  const t = a * 12 + n - 1 + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export function useEssence() {
  const [e, setE] = useState(null);
  useEffect(() => onSnapshot(REF(), (s) => setE(lireEssence(s.exists() ? s.data().json : "{}")), () => setE(lireEssence("{}"))), []);
  return e;
}
export const enregistrerEssence = (e) => setDoc(REF(), { json: JSON.stringify(e), majLe: serverTimestamp() });

export default function EssenceVue({ demandes = [], autresRevenus = [] }) {
  const e = useEssence();
  const [mois, setMois] = useState(aujourdhui().slice(0, 7));
  const [form, setForm] = useState(null);
  const [tournee, setTournee] = useState(null);
  const [erreur, setErreur] = useState("");
  if (!e) return <p className="admin-texte tb-pad">Chargement…</p>;
  const wolt = autresRevenus.filter((l) => !l.operateur && /wolt/i.test(l.source || "Wolt"));
  const s = essenceDuMois(mois, e, demandes, wolt);
  const sauver = async (suite) => {
    setErreur("");
    try {
      await enregistrerEssence(suite);
      return true;
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
      return false;
    }
  };
  const pleinsMois = e.pleins.filter((p) => p.date.startsWith(mois)).sort((a, b) => b.date.localeCompare(a.date));
  const pct = (x) => (s.total > 0 ? ` (${Math.round((x / s.total) * 100)} %)` : "");

  return (
    <section className="tb-liste fi">
      <div className="tb-bloc">
        <div className="tb-actions">
          <button type="button" className="tb-bouton tb-clair" onClick={() => setMois(decaler(mois, -1))}>‹</button>
          <strong style={{ alignSelf: "center" }}>{nomMois(mois)}</strong>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setMois(decaler(mois, 1))}>›</button>
        </div>
        <p className="bl-gros"><span>Essence payée</span><strong>{shekels(s.total)}</strong></p>
        <p className="tb-note">{s.nbPleins} plein{s.nbPleins > 1 ? "s" : ""}{s.litres ? ` · ${s.litres} L` : ""}{s.kmTotal ? ` · ${km(s.kmTotal)} roulés (compteur)` : ""}</p>
        <p>🚗 <strong>Rebecca Services</strong> : {shekels(s.essenceRS)}{pct(s.essenceRS)} · {km(s.kmRS)} <small>(courses {km(s.kmCourses)} + tournée {km(s.kmTournee)} sur {s.joursEcole} jours d'école)</small></p>
        <p>🛵 <strong>Wolt</strong> : {shekels(s.essenceWolt)}{pct(s.essenceWolt)} · {km(s.kmWolt)} · {s.livraisonsWolt} livraisons · gagné {shekels(s.gainsWolt)} → <strong>{shekels(s.gainWoltNet)}</strong> après essence</p>
        <p>🏠 <strong>Perso</strong> : {shekels(s.essencePerso)}{pct(s.essencePerso)}{s.kmPerso != null ? ` · ${km(s.kmPerso)}` : ""}</p>
        <p className="tb-note">Ces pleins ne sont pas comptés dans tes dépenses : ils ne changent pas ton bénéfice. {s.kmTotal ? "La part de chacun suit les km roulés." : "Note le compteur à chaque plein pour une répartition au km près ; sinon c'est km × consommation de ta voiture."} La part déductible aux impôts, c'est le comptable qui la fixe.</p>
        {!form && <button type="button" className="tb-bouton" onClick={() => setForm({ date: aujourdhui(), montant: "", litres: "", compteur: "" })}>+ Ajouter un plein</button>}
      </div>

      {form && (
        <div className="tb-bloc pm-form">
          <h4>Nouveau plein</h4>
          <label className="pm-champ">Date<input type="date" value={form.date} onChange={(x) => setForm({ ...form, date: x.target.value })} /></label>
          <label className="pm-champ">Montant (₪)<input inputMode="decimal" value={form.montant} onChange={(x) => setForm({ ...form, montant: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="pm-champ">Litres (facultatif)<input inputMode="decimal" value={form.litres} onChange={(x) => setForm({ ...form, litres: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="pm-champ">Compteur kilométrique (facultatif)<input inputMode="numeric" value={form.compteur} onChange={(x) => setForm({ ...form, compteur: x.target.value.replace(/[^0-9]/g, "") })} /></label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!(Number(String(form.montant).replace(",", ".")) > 0)} onClick={async () => (await sauver(ajouterPlein(e, form))) && setForm(null)}>Enregistrer</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setForm(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="tb-bloc">
        <h4>Pleins du mois</h4>
        {pleinsMois.length === 0 && <p className="tb-note">Aucun plein ce mois-ci.</p>}
        {pleinsMois.map((p) => (
          <p key={p.id}>
            {p.date.slice(8, 10)}/{p.date.slice(5, 7)} · <strong>{shekels(p.montant)}</strong>{p.litres ? ` · ${p.litres} L` : ""}{p.compteur ? ` · compteur ${p.compteur.toLocaleString("fr-FR")}` : ""}{" "}
            <button type="button" className="fm-petit clair" onClick={() => sauver(retirerPlein(e, p.id))}>Supprimer</button>
          </p>
        ))}
      </div>

      <div className="tb-bloc">
        <h4>Ma tournée scolaire</h4>
        <p className="tb-note">Km de ta tournée par jour d'école (matin + après-midi). Actuellement : {e.tourneeKmJour ? km(e.tourneeKmJour) : "pas encore renseigné"}.</p>
        {tournee === null ? (
          <button type="button" className="tb-bouton tb-clair" onClick={() => setTournee(String(e.tourneeKmJour || ""))}>Modifier</button>
        ) : (
          <div className="tb-actions">
            <input inputMode="decimal" value={tournee} onChange={(x) => setTournee(x.target.value.replace(/[^0-9.,]/g, ""))} aria-label="Km par jour" />
            <button type="button" className="tb-bouton" onClick={async () => (await sauver({ ...e, tourneeKmJour: Number(String(tournee).replace(",", ".")) || 0 })) && setTournee(null)}>Enregistrer</button>
          </div>
        )}
      </div>
      {erreur && <p className="fm-erreur tb-pad" role="alert">{erreur}</p>}
    </section>
  );
}
