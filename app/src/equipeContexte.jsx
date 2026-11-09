import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { attribueA, initiale, membresDe, nomDe } from "./pricing/quiFait.js";

// EQUIPE DANS L'ESPACE PRIVE (Lot J, seance J3, 9 nov. 2026)
// Une seule lecture de l'equipe et des vehicules, partagee par tous les ecrans (demandes, calendrier, fiches).
// Avant les regles Firestore v9 (J5), la lecture est refusee : l'equipe se reduit a Rebecca, rien ne change pour elle.

export const EquipeContexte = createContext({ membres: membresDe(), vehicules: [], moi: ADMIN_ID, membre: null });
export const useEquipeContexte = () => useContext(EquipeContexte);

export function useEquipeDonnees() {
  const [fiches, setFiches] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  useEffect(() => {
    const a = onSnapshot(collection(db, "equipe"), (s) => setFiches(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setFiches([]));
    const b = onSnapshot(collection(db, "vehicules"), (s) => setVehicules(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setVehicules([]));
    return () => {
      a();
      b();
    };
  }, []);
  return { membres: membresDe({ ficheRebecca: fiches.find((f) => f.id === ADMIN_ID) || null, fiches }), vehicules };
}

// Pastille « R » / « J » : qui fait la course (rien tant que Rebecca est seule dans l'equipe)
export function Pastille({ d }) {
  const { membres } = useEquipeContexte();
  if (!membres || membres.length < 2) return null;
  const id = attribueA(d);
  return (
    <span className={"qf-pastille" + (id === ADMIN_ID ? " qf-rebecca" : " qf-autre")} title={"Fait par " + nomDe(membres, id)}>
      {initiale(membres, id)}
    </span>
  );
}

// Filtre « Moi / Rebecca / Jeremy / Tous »
export function FiltrePersonne({ valeur, changer }) {
  const { membres, moi } = useEquipeContexte();
  if (!membres || membres.length < 2) return null;
  const options = [{ id: "tous", label: "Tous" }, { id: "moi", label: "Moi" }, ...membres.filter((m) => m.id !== moi).map((m) => ({ id: m.id, label: m.nom }))];
  return (
    <div className="tb-filtres" role="tablist" aria-label="Filtrer par personne">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={valeur === o.id} className={"tb-filtre" + (valeur === o.id ? " actif" : "")} onClick={() => changer(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
