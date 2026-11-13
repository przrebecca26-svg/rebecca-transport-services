import { useState } from "react";
import { GROUPES, monMois } from "./pricing/monMois.js";
import { useEssence } from "./EssenceVue.jsx";

// MON MOIS (13 nov. 2026) - Finances, premier onglet : ce que je gagne vraiment, mois par mois, en un coup d'oeil.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const nomMois = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const decaler = (m, d) => {
  const [a, n] = m.split("-").map(Number);
  const t = a * 12 + n - 1 + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

function Ligne({ nom, valeur, fort, neg }) {
  return (
    <li>
      <span>{fort ? <strong>{nom}</strong> : nom}</span>
      <strong className={neg ? "bl-neg" : undefined}>{valeur}</strong>
    </li>
  );
}

export default function MonMoisVue({ donnees, aller }) {
  const essence = useEssence();
  const [mois, setMois] = useState(aujourdhui().slice(0, 7));
  const r = monMois(mois, { ...donnees, essence });
  const e = r.essence;
  return (
    <section className="tb-liste fi">
      <div className="dp-mois">
        <button className="dp-fleche" aria-label="Mois précédent" onClick={() => setMois(decaler(mois, -1))}>‹</button>
        <strong style={{ textTransform: "capitalize" }}>{nomMois(mois)}</strong>
        <button className="dp-fleche" aria-label="Mois suivant" disabled={mois >= aujourdhui().slice(0, 7)} onClick={() => setMois(decaler(mois, 1))}>›</button>
      </div>

      <div className="tb-bloc">
        <p className="bl-gros">
          <span>Ce que je gagne vraiment</span>
          <strong className={r.beneficeReel < 0 ? "bl-neg" : undefined}>{shekels(r.beneficeReel)}</strong>
        </p>
        <p className="tb-note">= ce que j'ai encaissé − essence de travail − dépenses.</p>
      </div>

      <div className="tb-bloc">
        <h3>J'ai encaissé · {shekels(r.totalGagne)}</h3>
        <ul className="pm-resume">
          {GROUPES.filter((g) => r.gagne[g.id] || g.id === "ramassage" || g.id === "coursier").map((g) => <Ligne key={g.id} nom={g.l} valeur={shekels(r.gagne[g.id])} />)}
          <Ligne nom="Wolt" valeur={shekels(r.wolt)} />
        </ul>
        {r.resteAEncaisser > 0 && <p className="tb-note">Pas encore encaissé pour les courses de ce mois : <strong>{shekels(r.resteAEncaisser)}</strong> (compté quand tu le reçois).</p>}
        {r.troc > 0 && <p className="tb-note">Réglé en troc (sans argent) : {shekels(r.troc)}.</p>}
      </div>

      <div className="tb-bloc">
        <h3>Mes dépenses · {shekels(r.essenceTravail + r.totalDepenses)}</h3>
        <ul className="pm-resume">
          <Ligne nom="Essence de travail" valeur={"- " + shekels(r.essenceTravail)} />
          {e && e.total > 0 && <li className="bl-sous"><span>Rebecca Services {shekels(e.essenceRS)} · Wolt {shekels(e.essenceWolt)}</span><strong /></li>}
          {Object.entries(r.depenses).map(([c, v]) => <Ligne key={c} nom={c} valeur={"- " + shekels(v)} />)}
        </ul>
        {e && e.total > 0 ? (
          <p className="tb-note">Essence payée ce mois : {shekels(e.total)}, dont perso {shekels(e.essencePerso)} (pas retirée de ce que tu gagnes).</p>
        ) : (
          <p className="tb-note">Pas encore de plein ce mois-ci : ajoute-les dans l'onglet Essence pour un bénéfice réel.</p>
        )}
      </div>
      {aller && <p className="tb-note tb-pad">Détail de l'année et plafond de l'osek : onglet Année.</p>}
    </section>
  );
}
