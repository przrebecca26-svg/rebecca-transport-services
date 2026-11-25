import { useState } from "react";
import { useEquipeContexte } from "./equipeContexte.jsx";
import { ADMIN_ID } from "./pricing/equipe.js";
import { vacancesDuJour, ajouterJours } from "./pricing/calendrier.js";
import { JOURS, heureTrajet, trajetsDuJourDate, idsConfies } from "./pricing/tournee.js";
import { confierAuCoequipier, reprendreDuCoequipier } from "./confierBase.js";

// CONFIER DES TRAJETS A JEREMY POUR UNE DATE (12 nov. 2026, 15h32)
// Rebecca choisit une date et les trajets de ce jour-la. Ils deviennent une mission dans le planning de Jeremy
// (collection missionsEquipe, privee a l'equipe) et bloquent ses horaires sur le site (disposEquipe, sans motif) ;
// le Calendrier de Rebecca ne bloque plus que le reste de sa journee (fait par SyncTournee). « Je le reprends » annule.

const jourDe = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const prochainJour = (depuis, w) => {
  for (let i = 0; i < 7; i++) {
    const d = ajouterJours(depuis, i);
    if (jourDe(d) === w) return d;
  }
  return depuis;
};
const dateFr = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default function ConfierTrajets({ donnees, tous, duree, dureesPretes, nomLieu, aujourdhui, jour }) {
  const { membres } = useEquipeContexte();
  const equipiers = (membres || []).filter((m) => m && m.id !== ADMIN_ID);
  const [date, setDate] = useState(() => prochainJour(aujourdhui, jour));
  const [coches, setCoches] = useState([]);
  const [membre, setMembre] = useState("");
  const [info, setInfo] = useState(null); // { texte, lien }
  const [enCours, setEnCours] = useState(false);
  if (equipiers.length === 0) return null;

  const transferts = donnees.transferts || [];
  const valide = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= aujourdhui && jourDe(date) !== 6;
  const confies = valide ? idsConfies(transferts, date) : new Set();
  const duJour = valide ? trajetsDuJourDate(tous, date).filter((r) => !confies.has(r.id)) : [];
  const qui = equipiers.find((m) => m.id === membre) || equipiers[0];
  const vac = valide ? vacancesDuJour(date) : "";

  const confier = async () => {
    if (!coches.length || !qui) return;
    setEnCours(true);
    try {
      const r = await confierAuCoequipier({ donnees, tous, ids: coches, date, duree, nomLieu, membre: qui });
      if (r.lien !== undefined) setCoches([]);
      setInfo(r);
    } catch {
      setInfo({ texte: "Enregistrement impossible : vérifie ta connexion et que les nouvelles règles Firebase (v14) sont publiées." });
    }
    setEnCours(false);
  };

  const reprendre = async (x) => {
    setEnCours(true);
    try {
      await reprendreDuCoequipier({ donnees, transfert: x });
      setInfo({ texte: "Tu as repris ces trajets : ils reviennent dans ton Calendrier." });
    } catch {
      setInfo({ texte: "Modification impossible pour l'instant." });
    }
    setEnCours(false);
  };

  const aVenir = transferts.filter((x) => x.date >= aujourdhui).sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <section className="tdb-bloc">
      <h2>Confier des trajets à {equipiers.length === 1 ? equipiers[0].nom || "mon coéquipier" : "un coéquipier"}</h2>
      <p className="tdb-note">Pour un jour précis : ces trajets passent dans son planning et ton Calendrier se libère.</p>
      <div className="champ">
        <label htmlFor="ct-date">Quel jour ?</label>
        <input id="ct-date" type="date" min={aujourdhui} value={date} onChange={(e) => { setDate(e.target.value); setCoches([]); setInfo(null); }} />
      </div>
      {!valide && <p className="rp-alerte">Choisis un jour à venir, hors samedi.</p>}
      {vac && <p className="tdb-note">🏖️ {vac} : pas d'école ce jour-là.</p>}
      {valide && !vac && duJour.length === 0 && <p className="tdb-note">Aucun trajet à confier ce jour-là.</p>}
      {valide && duJour.length > 0 && (
        <div className="rp-jours" role="group" aria-label="Trajets à confier">
          {duJour.map((r) => (
            <label className="case rp-jour" key={r.id}>
              <input type="checkbox" checked={coches.includes(r.id)} onChange={(e) => setCoches((c) => (e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id)))} />
              <span>{r.nom || "Trajet"} · {(heureTrajet(r, jourDe(date)) || r.heurePrise || "").replace(":", "h")}</span>
            </label>
          ))}
        </div>
      )}
      {equipiers.length > 1 && (
        <div className="champ">
          <label htmlFor="ct-qui">À qui ?</label>
          <select id="ct-qui" value={qui ? qui.id : ""} onChange={(e) => setMembre(e.target.value)}>
            {equipiers.map((m) => <option key={m.id} value={m.id}>{m.nom || "Coéquipier"}</option>)}
          </select>
        </div>
      )}
      {coches.length > 0 && <button type="button" className="tdb-bouton rp-large" disabled={enCours || !dureesPretes} onClick={confier}>Confier {coches.length} trajet{coches.length > 1 ? "s" : ""} à {qui.nom || "mon coéquipier"} ({JOURS[jourDe(date)].toLowerCase()})</button>}
      {info && (
        <div className="rp-correction">
          <p className="tdb-note" role="status">{info.texte}</p>
          {info.lien && <a className="tdb-bouton dr-lien" href={info.lien} target="_blank" rel="noopener noreferrer">Le prévenir sur WhatsApp</a>}
        </div>
      )}
      {aVenir.length > 0 && (
        <>
          <p className="rp-type">Trajets confiés à venir</p>
          {aVenir.map((x) => (
            <div className="rp-forfait" key={x.id}>
              <span><b>{dateFr(x.date)}</b> · {x.nomMembre || "coéquipier"}{x.debut ? ` · ${x.debut.replace(":", "h")} → ${x.fin.replace(":", "h")}` : ""}{x.noms.length ? ` · ${x.noms.join(", ")}` : ""}</span>
              <div className="rp-boutons"><button type="button" className="rp-waze" disabled={enCours} onClick={() => reprendre(x)}>Je le reprends</button></div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
