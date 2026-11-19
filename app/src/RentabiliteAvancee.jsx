import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { useEssence } from "./EssenceVue.jsx";
import { coutKm, texteMinutes } from "./pricing/finCourse.js";
import { GROUPES, groupeDe } from "./pricing/monMois.js";
import { SERVICES } from "./services.js";
import { TRANCHES, aVide, evolutionMois, previsionMois, regrouper, sousLeMinimum, trajetsTermines, trancheDe } from "./pricing/rentabilite.js";

// RENTABILITÉ AVANCÉE (19 nov. 2026, V2) — Rebecca seule. Réutilise le bilan de chaque trajet (étapes, compteur,
// pleins) ; ajoute types de prestation, distances, temps et km à vide, 6 derniers mois, trajets sous le minimum
// et prévision du mois. Les prévisions restent à part de l'encaissé. Rien n'est enregistré.
const sh = (n) => `${Math.round(n).toLocaleString("fr-FR")} ₪`;
const nomService = (id) => (SERVICES.find((s) => s.id === id) || {}).titre || id || "Autre";
const nomGroupe = (id) => (GROUPES.find((g) => g.id === id) || {}).l || id;
const moisFr = (m) => new Date(m + "-15T12:00:00Z").toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });

function Tableau({ titre, lignes, nom }) {
  const cles = Object.keys(lignes).sort((a, b) => lignes[b].prix - lignes[a].prix);
  if (!cles.length) return null;
  return (
    <div className="tb-bloc">
      <h3>{titre}</h3>
      <ul className="pm-resume">
        {cles.map((k) => {
          const r = lignes[k];
          return (
            <li key={k}>
              <span>{nom(k)} <small>· {r.trajets} trajet{r.trajets > 1 ? "s" : ""} · moy. {sh(r.prixMoyen)}</small></span>
              <strong>{sh(r.gain)} <small>· {r.gainParHeure != null ? `${r.gainParHeure} ₪/h net` : "temps non noté"}</small></strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function RentabiliteAvancee({ demandes = [], mouvements = [], debut, fin, ref }) {
  const essence = useEssence();
  const [minParHeure, setMin] = useState(0);
  useEffect(() => onSnapshot(doc(db, "reglages", "rentabilite"), (x) => setMin(x.exists() ? Number(x.data().minParHeure) || 0 : 0), () => {}), []);
  const parKm = coutKm(essence ? essence.pleins : []).parKm;
  const r = useMemo(() => {
    const trajets = trajetsTermines(demandes, debut, fin, parKm);
    return {
      trajets,
      parGroupe: regrouper(trajets, (t) => groupeDe(t.service)),
      parType: regrouper(trajets, (t) => t.service),
      parDistance: regrouper(trajets, (t) => (trancheDe(t.kmCourse) || {}).id),
      vide: aVide(trajets),
      bas: sousLeMinimum(trajets, minParHeure),
      evolution: evolutionMois(demandes, ref.slice(0, 7), 6, parKm),
      prevision: previsionMois(ref.slice(0, 7), demandes, mouvements),
    };
  }, [demandes, mouvements, debut, fin, ref, parKm, minParHeure]);
  const maxMois = Math.max(1, ...r.evolution.map((m) => m.prix));
  return (
    <section className="tb-liste fi">
      <h2 className="tb-pad">📈 Rentabilité avancée</h2>
      <p className="tb-note tb-pad">Trajets terminés de la période choisie au-dessus ({r.trajets.length}). Gain net = prix − essence (compteur et pleins, sinon estimation). Les ₪/h ne comptent que les trajets dont les heures sont notées.</p>
      {r.trajets.length === 0 && <p className="tb-note tb-pad">Aucun trajet terminé sur cette période.</p>}
      <Tableau titre="Par activité" lignes={r.parGroupe} nom={nomGroupe} />
      <Tableau titre="Par type de prestation" lignes={r.parType} nom={nomService} />
      <Tableau titre="Par distance de la course" lignes={r.parDistance} nom={(k) => (TRANCHES.find((t) => t.id === k) || {}).l || k} />
      {r.trajets.length > 0 && (
        <div className="tb-bloc">
          <h3>Temps et kilomètres à vide</h3>
          <p className="tb-note">Aller chercher + rentrer : {texteMinutes(r.vide.minutes) || "0 min"}{r.vide.partTemps != null ? ` (${r.vide.partTemps} % de ton temps)` : ""} · environ {Math.round(r.vide.km)} km{r.vide.partKm != null ? ` (${r.vide.partKm} % des km)` : ""}.</p>
        </div>
      )}
      {minParHeure > 0 && (
        <div className="tb-bloc">
          <h3>Sous ton minimum ({minParHeure} ₪/h)</h3>
          {r.bas.length === 0 ? <p className="tb-note">Aucun trajet sous ton minimum sur cette période. 👏</p> : (
            <ul className="pm-resume">
              {r.bas.map((t) => (
                <li key={t.id}><span>{t.date.split("-").reverse().join("/")} · {nomService(t.service)}{t.nom ? ` · ${t.nom}` : ""}</span><strong>{t.gainReelParHeure} ₪/h <small>· {sh(t.prix)} en {texteMinutes(t.total)}</small></strong></li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="tb-bloc">
        <h3>6 derniers mois</h3>
        <ul className="pm-resume">
          {r.evolution.map((m) => (
            <li key={m.mois}>
              <span>{moisFr(m.mois)} <small>· {m.trajets} trajet{m.trajets > 1 ? "s" : ""}</small></span>
              <strong>{sh(m.gain)} <small>· {m.marge != null ? `marge ${m.marge} %` : "—"}{m.gainParHeure != null ? ` · ${m.gainParHeure} ₪/h` : ""}</small></strong>
              <span className="st-barre" style={{ display: "block", height: 6, borderRadius: 3, background: "#B97870", width: `${Math.round((m.prix / maxMois) * 100)}%`, marginTop: 4 }} />
            </li>
          ))}
        </ul>
      </div>
      <div className="tb-bloc">
        <h3>Prévision de {moisFr(ref.slice(0, 7))}</h3>
        <ul className="pm-resume">
          <li><span>Déjà encaissé ce mois-ci</span><strong>{sh(r.prevision.encaisse)}</strong></li>
          <li><span>Reste à encaisser · prestations déjà faites</span><strong>{sh(r.prevision.resteFaites)}</strong></li>
          <li><span>Reste à encaisser · {r.prevision.nbConfirmees} réservation(s) confirmée(s)</span><strong>{sh(r.prevision.resteConfirmees)}</strong></li>
          <li><span><b>Fin de mois prévue</b> (si tout est payé)</span><strong>{sh(r.prevision.finDeMoisPrevue)}</strong></li>
        </ul>
        <p className="tb-note">Prévision seulement : elle n'entre jamais dans Finances tant que l'argent n'est pas encaissé. Wolt à part.</p>
      </div>
    </section>
  );
}
