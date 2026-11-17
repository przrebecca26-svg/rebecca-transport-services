import { useEffect, useState } from "react";

// Lien « Devenir partenaire » du pied de page (17 nov. 2026) : affiche SEULEMENT quand Rebecca a ouvert
// les inscriptions (Admin → Partenaires → « Visible sur le site »). Firebase est charge apres l'affichage.
export default function LienPartenaire() {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let fini = false;
    const t = setTimeout(() => {
      Promise.all([import("../firebase.js"), import("firebase/firestore")])
        .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "partenaires")))
        .then((s) => !fini && setOuvert(s.exists() && s.data().ouvert === true))
        .catch(() => {});
    }, 1500);
    return () => {
      fini = true;
      clearTimeout(t);
    };
  }, []);
  if (!ouvert) return null;
  return (
    <>
      <br />
      <a className="lien" href="#/partenaire">Devenir partenaire de Rebecca Services</a>
    </>
  );
}
