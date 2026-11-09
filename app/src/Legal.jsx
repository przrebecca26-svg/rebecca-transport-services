import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { SECTIONS_DEPART, sectionsValides } from "./textesLegaux.js";

// CONFIDENTIALITE ET CONDITIONS (Lot B, seance B5)
// Le texte est modifiable par Rebecca dans l'espace prive (onglet Reglages) et lu dans la base (reglages/legal).
// Tant que rien n'est enregistre, le texte de depart (textesLegaux.js) est affiche.
// Le bandeau « Version provisoire » reste affiche tant que Rebecca n'a pas marque le texte comme verifie.

export default function Legal({ onRetour }) {
  const [texte, setTexte] = useState({ sections: SECTIONS_DEPART, verifie: false });

  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "legal"),
        (s) => {
          const d = s.exists() ? s.data() : {};
          setTexte({ sections: sectionsValides(d.sections) || SECTIONS_DEPART, verifie: d.statut === "verifie" });
        },
        () => {
          /* hors ligne ou lecture refusee : on garde le texte de depart */
        }
      ),
    []
  );

  return (
    <section className="compte legal">
      <button type="button" className="retour" onClick={onRetour}>
        ← Retour
      </button>
      <header className="titre-service">
        <span aria-hidden="true">📄</span>
        <h2>Confidentialité et conditions</h2>
      </header>
      {!texte.verifie && <p className="compte-info">Version provisoire, en cours de validation.</p>}

      <div className="bloc">
        {texte.sections.map((s, i) => (
          <div key={i}>
            {s.titre && <h3>{s.titre}</h3>}
            {s.texte
              .split(/\n\s*\n/)
              .filter((p) => p.trim())
              .map((p, j) => (
                <p key={j} style={{ whiteSpace: "pre-line" }}>
                  {p.trim()}
                </p>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
