import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { indicateurs, tuiles } from "./pricing/tableauBord.js";
import { PERIODES_TB, periodeTB } from "./PeriodeTB.jsx";
import PeriodeTB from "./PeriodeTB.jsx";
import TuileActivite from "./components/TuileActivite.jsx";
import Aujourdhui from "./Aujourdhui.jsx";
import { chiffresDuMembre, tuileVisible } from "./pricing/espaceEquipe.js";

// Tableau de bord general (D2a, 9 nov. 2026) : 4 indicateurs G3 sur la periode choisie, les 8 activites,
// puis l'ecran « Aujourd'hui » (missions du jour, a venir, alertes). Lecture seule.
// J2 (9 nov. 2026) : un coequipier (membre) voit SES chiffres et seulement ses activites, jamais ceux de Rebecca.

const shekels = (n) => Math.round(n).toLocaleString("fr-FR") + " ₪";

export default function TableauDeBord({ aller, membre = null }) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  const [erreur, setErreur] = useState("");
  const [type, setType] = useState("jour");

  useEffect(() => {
    const echec = () => setErreur("Impossible de charger les chiffres. Vérifiez la connexion.");
    const a = onSnapshot(refDemandes(), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec);
    const b = onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec);
    return () => {
      a();
      b();
    };
  }, []);

  const periode = periodeTB(type);
  const vue = useMemo(() => (membre ? chiffresDuMembre({ uid: membre.id, fiche: membre, demandes: demandes || [], mouvements }) : null), [membre, demandes, mouvements]);
  const chiffres = useMemo(() => {
    if (!demandes) return null;
    if (!vue) return indicateurs({ demandes, mouvements, periode });
    return { ...indicateurs({ demandes: vue.siennes, mouvements: vue.mouvements, periode }), demandesRecues: indicateurs({ demandes: vue.visibles, periode }).demandesRecues };
  }, [demandes, mouvements, type, vue]); // eslint-disable-line react-hooks/exhaustive-deps
  const listeTuiles = useMemo(() => {
    const t = tuiles({ demandes: vue ? vue.siennes : demandes || [], mouvements: vue ? vue.mouvements : mouvements, periode });
    return membre ? t.filter((x) => tuileVisible(membre, x.id)) : t;
  }, [demandes, mouvements, type, vue]); // eslint-disable-line react-hooks/exhaustive-deps

  const val = (x, argent) => (chiffres ? (argent ? shekels(x) : String(x)) : "…");

  return (
    <div className="tdb">
      <div className="tdb-tete">
        <h1>Bonjour {membre ? String(membre.nom || "").split(" ")[0] : "Rebecca"}</h1>
        <p className="tdb-sous">{membre ? "Tes courses et tes encaissements" : "Vue générale de Rebecca Services"}</p>
      </div>
      <PeriodeTB type={type} changer={setType} />
      {erreur && <p className="tdb-erreur" role="alert">{erreur}</p>}
      <div className="tdb-grille">
        <div className="tdb-chiffre"><span>Chiffre d'affaires réalisé</span><b>{val(chiffres && chiffres.caRealise, true)}</b></div>
        <div className="tdb-chiffre"><span>Prestations terminées</span><b>{val(chiffres && chiffres.prestationsTerminees)}</b></div>
        <div className="tdb-chiffre"><span>Encaissé</span><b>{val(chiffres && chiffres.encaisse, true)}</b></div>
        <div className="tdb-chiffre"><span>Demandes reçues</span><b>{val(chiffres && chiffres.demandesRecues)}</b></div>
      </div>
      <p className="tdb-note">{PERIODES_TB.find((p) => p.id === type).titre} · hors pourboires · {membre ? "tes courses (demandes reçues : tes services)" : "Services coursier et Transport privé"}</p>

      <div className="tdb-titre-ligne">
        <h2>Mes activités</h2>
        <button className="tdb-lien" onClick={() => aller("activites")}>Tout voir</button>
      </div>
      <div className="tdb-tuiles">
        {listeTuiles.map((t) => (
          <TuileActivite key={t.id} activite={t} ouvrir={() => aller("activites", t.id)} />
        ))}
      </div>

      <Aujourdhui aller={aller} />
    </div>
  );
}
