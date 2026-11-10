import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, ACTIVITES_DEPART, avecAjustement, libellePrix, libelleDuree } from "../pricing/catalogue.js";
import { creneauxDuJour } from "../pricing/rendezvous.js";
import { TARIFS } from "../pricing/config.js";

// Catalogue et réservation pour Nails Prestige
export default function CatalogueNails({ onRetour, onReserver }) {
  const [prestations, setPrestations] = useState([]);
  const [activite, setActivite] = useState(null);
  const [selection, setSelection] = useState(null);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [occupes, setOccupes] = useState([]);

  useEffect(() => {
    const unsubCat = onSnapshot(
      query(collection(db, "catalogue"), where("activite", "==", "nails")),
      (s) => {
        const items = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.publiee);
        setPrestations(items.length ? items : CATALOGUE_DEPART.filter((p) => p.activite === "nails" && p.publiee));
      },
      () => setPrestations(CATALOGUE_DEPART.filter((p) => p.activite === "nails"))
    );
    const unsubAct = onSnapshot(
      collection(db, "activites"),
      (s) => {
        const a = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.id === "nails") || ACTIVITES_DEPART.find((x) => x.id === "nails");
        setActivite(a);
      },
      () => setActivite(ACTIVITES_DEPART.find((x) => x.id === "nails"))
    );
    const unsubOcc = onSnapshot(collection(db, "creneauxOccupes"), (s) => setOccupes(s.docs.map((d) => d.data())), () => {});
    return () => {
      unsubCat();
      unsubAct();
      unsubOcc();
    };
  }, []);

  useEffect(() => {
    if (!selection || !date || !activite) return;
    const slots = creneauxDuJour({
      activite,
      dureeMinutes: selection.dureeMinutes || 60,
      date,
      occupes,
      service: "nails",
    });
    setCreneaux(slots);
    setHeure("");
  }, [selection, date, activite, occupes]);

  const categories = [...new Set(prestations.map((p) => p.categorie))];

  if (selection) {
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setSelection(null)}>← Retour au catalogue</button>
        <h2>{p.nom}</h2>
        <p>{p.description}</p>
        <p><strong>{libellePrix(p)}</strong> · {libelleDuree(p)}</p>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </label>
        {date && (
          <div className="creneaux">
            <p>Créneaux disponibles :</p>
            {creneaux.filter((c) => c.libre).length === 0 && <p>Aucun créneau libre ce jour.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {creneaux.map((c) => (
                <button
                  key={c.heure}
                  disabled={!c.libre}
                  className={heure === c.heure ? "actif" : ""}
                  onClick={() => setHeure(c.heure)}
                  style={{ opacity: c.libre ? 1 : 0.4 }}
                >
                  {c.heure}
                </button>
              ))}
            </div>
          </div>
        )}
        {heure && (
          <button
            className="bouton"
            onClick={() => onReserver({ service: "nails", prestation: p, date, heure })}
          >
            Continuer la réservation
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-nails-prestige.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Nails Prestige</h2>
      </div>
      <p>Prestations d'onglerie. Choisissez une prestation pour réserver.</p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {prestations.filter((p) => p.categorie === cat).map((p) => {
            const aff = avecAjustement(p, activite?.ajustementPourcent || 0);
            return (
              <button key={p.id} className="carte-service" onClick={() => setSelection(p)}>
                <span className="corps">
                  <strong>{aff.nom}</strong>
                  <small>{aff.description || libelleDuree(aff)}</small>
                </span>
                <span className="prix">{libellePrix(aff)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
