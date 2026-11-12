import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { ACTIVITES_TB, indicateurs, repartitionServices, serieCA, tuiles } from "./pricing/tableauBord.js";
import PeriodeTB, { periodeTB } from "./PeriodeTB.jsx";
import TuileActivite from "./components/TuileActivite.jsx";
import { chiffresDuMembre, tuileVisible } from "./pricing/espaceEquipe.js";

// Rubrique « Activités » (D2a, 9 nov. 2026) : les 8 activites, puis le tableau de bord d'une activite active.
// Indicateurs G3 valides ; aucun chiffre pour les activites « Bientôt » ; km seulement « estimés ».
// J2 (9 nov. 2026) : un coequipier voit seulement ses activites et SES chiffres (ses courses, ses encaissements).

const shekels = (n) => Math.round(n).toLocaleString("fr-FR") + " ₪";
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Chiffre d'affaires par jour (semaine, mois) ou par mois (annee)
function barres(type, activite, demandes, mouvements) {
  const periode = periodeTB(type);
  if (type === "annee") {
    const a = periode.debut.slice(0, 4);
    return MOIS.map((m, i) => {
      const debut = `${a}-${String(i + 1).padStart(2, "0")}-01`;
      const fin = new Date(Date.UTC(Number(a), i + 1, 0, 12)).toISOString().slice(0, 10);
      return { label: m, ca: indicateurs({ activite, demandes, mouvements, periode: { debut, fin } }).caRealise };
    });
  }
  if (type === "semaine" || type === "mois") {
    return serieCA({ activite, demandes, mouvements, periode }).map((x) => ({ label: String(Number(x.date.slice(8))), ca: x.ca }));
  }
  return [];
}

function Graphique({ donnees }) {
  if (!donnees.length) return <p className="tdb-note">Choisissez Semaine, Mois ou Année pour voir l'évolution.</p>;
  const max = Math.max(...donnees.map((d) => d.ca), 0);
  if (max === 0) return <p className="tdb-note">Aucun chiffre d'affaires réalisé sur cette période.</p>;
  return (
    <div className="tdb-barres" role="img" aria-label="Chiffre d'affaires réalisé sur la période">
      {donnees.map((d, i) => (
        <div key={i} className="tdb-barre" title={`${d.label} : ${shekels(d.ca)}`}>
          <span style={{ height: Math.max(2, Math.round((d.ca / max) * 100)) + "%" }} />
          <small>{donnees.length <= 12 || i % 5 === 0 ? d.label : ""}</small>
        </div>
      ))}
    </div>
  );
}

function TableauActivite({ activite, demandes, mouvements, retour }) {
  const [type, setType] = useState("mois");
  const periode = periodeTB(type);
  const c = indicateurs({ activite: activite.id, demandes, mouvements, periode });
  const rep = repartitionServices({ activite: activite.id, demandes, periode });
  const totalRep = rep.reduce((s, r) => s + r.nombre, 0);
  return (
    <div className="tdb">
      <button className="tdb-retour" onClick={retour}>← Mes activités</button>
      <div className="tdb-tete">
        <h1>{activite.titre}</h1>
        <p className="tdb-sous">Tableau de bord de l'activité</p>
      </div>
      <PeriodeTB type={type} changer={setType} />
      <div className="tdb-grille">
        <div className="tdb-chiffre"><span>Chiffre d'affaires réalisé</span><b>{shekels(c.caRealise)}</b></div>
        <div className="tdb-chiffre"><span>Prestations terminées</span><b>{c.prestationsTerminees}</b></div>
        <div className="tdb-chiffre"><span>Encaissé</span><b>{shekels(c.encaisse)}</b></div>
        <div className="tdb-chiffre"><span>Demandes reçues</span><b>{c.demandesRecues}</b></div>
      </div>
      <p className="tdb-note">Pourboires (à part) : {shekels(c.pourboires)} · Prix moyen : {c.prestationsTerminees ? shekels(c.prixMoyen) : "—"} · Km estimés : {c.kmEstimes} km</p>

      <section className="tdb-bloc">
        <h2>Chiffre d'affaires réalisé</h2>
        <Graphique donnees={barres(type, activite.id, demandes, mouvements)} />
      </section>
      <section className="tdb-bloc">
        <h2>Répartition des prestations terminées</h2>
        {totalRep === 0 && <p className="tdb-note">Aucune prestation terminée sur cette période.</p>}
        {rep.map((r) => (
          <div key={r.service} className="tdb-rep">
            <span>{r.titre}</span>
            <span className="tdb-rep-barre"><i style={{ width: Math.round((r.nombre / totalRep) * 100) + "%" }} /></span>
            <b>{r.nombre}</b>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function Activites({ cible, membre = null }) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  const [ouverte, setOuverte] = useState(cible || null);
  const [type, setType] = useState("mois");

  useEffect(() => {
    const a = onSnapshot(refDemandes(), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setDemandes([]));
    const b = onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
    return () => {
      a();
      b();
    };
  }, []);

  const periode = periodeTB(type);
  const vue = useMemo(() => (membre ? chiffresDuMembre({ uid: membre.id, fiche: membre, demandes: demandes || [], mouvements }) : null), [membre, demandes, mouvements]);
  const sesDemandes = vue ? vue.siennes : demandes;
  const sesMouvements = vue ? vue.mouvements : mouvements;
  const liste = useMemo(() => {
    const t = tuiles({ demandes: sesDemandes || [], mouvements: sesMouvements, periode });
    return membre ? t.filter((x) => tuileVisible(membre, x.id)) : t;
  }, [sesDemandes, sesMouvements, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = ACTIVITES_TB.find((a) => a.id === ouverte && a.etat === "active" && (!membre || tuileVisible(membre, a.id)));
  if (act && demandes) return <TableauActivite activite={act} demandes={sesDemandes} mouvements={sesMouvements} retour={() => setOuverte(null)} />;

  return (
    <div className="tdb">
      <div className="tdb-tete">
        <h1>Mes activités</h1>
        <p className="tdb-sous">Touchez une activité active pour ouvrir son tableau de bord</p>
      </div>
      <PeriodeTB type={type} changer={setType} />
      {!demandes && <p className="tdb-note">Chargement…</p>}
      <div className="tdb-tuiles">
        {liste.map((t) => (
          <TuileActivite key={t.id} activite={t} ouvrir={() => setOuverte(t.id)} />
        ))}
      </div>
      <p className="tdb-note">Les activités « Bientôt » s'ouvriront à leur lancement, avec leurs propres indicateurs.</p>
    </div>
  );
}
