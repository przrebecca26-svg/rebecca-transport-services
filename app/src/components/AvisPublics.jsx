import { useEffect, useState } from "react";
import { lireAvisPublics } from "../pricing/suiteClient.js";

// Avis publies par Rebecca (Reglages → « Avis sur mon site »), page d'accueil (17 nov. 2026).
// Firebase n'est charge qu'ici, apres l'affichage de la page.
export default function AvisPublics() {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    let actif = true;
    Promise.all([import("../firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "avisPublics")))
      .then((x) => actif && setListe(lireAvisPublics(x.exists() ? x.data().json : "[]")))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);
  if (!liste.length) return null;
  const moyenne = Math.round((liste.reduce((s, a) => s + a.etoiles, 0) / liste.length) * 10) / 10;
  return (
    <section className="bloc avis-publics" aria-label="Avis des clientes">
      <h2>Ils m'ont fait confiance ⭐ {String(moyenne).replace(".", ",")}/5</h2>
      <div className="avis-liste">
        {liste.slice(0, 12).map((a) => (
          <figure key={a.id} className="avis-carte">
            <div aria-label={`${a.etoiles} étoiles sur 5`}>{"★".repeat(a.etoiles)}{"☆".repeat(5 - a.etoiles)}</div>
            {a.texte && <blockquote dir="auto">« {a.texte} »</blockquote>}
            <figcaption>{a.prenom}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
