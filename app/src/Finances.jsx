import { useState } from "react";
import Bilan from "./Bilan.jsx";
import Depenses from "./Depenses.jsx";

// Onglet « Finances » (version de depart, seance B1) : regroupe le Bilan et les Depenses existants.
// Ce fichier sera remplace par la version complete a la seance B4.

export default function Finances() {
  const [vue, setVue] = useState("bilan");
  return (
    <>
      <div className="tb-filtres tb-pad fi-choix" role="tablist" aria-label="Finances">
        <button role="tab" aria-selected={vue === "bilan"} className={"tb-filtre" + (vue === "bilan" ? " actif" : "")} onClick={() => setVue("bilan")}>Bilan</button>
        <button role="tab" aria-selected={vue === "depenses"} className={"tb-filtre" + (vue === "depenses" ? " actif" : "")} onClick={() => setVue("depenses")}>Dépenses</button>
      </div>
      {vue === "bilan" ? <Bilan /> : <Depenses />}
    </>
  );
}
