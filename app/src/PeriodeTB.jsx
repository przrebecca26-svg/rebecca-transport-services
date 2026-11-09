import { periodeDe } from "./pricing/bilan.js";

// Choix de la periode des tableaux de bord (D2a) : aujourd'hui, semaine, mois, annee, depuis le debut

export const PERIODES_TB = [
  { id: "jour", titre: "Aujourd'hui" },
  { id: "semaine", titre: "Semaine" },
  { id: "mois", titre: "Mois" },
  { id: "annee", titre: "Année" },
  { id: "tout", titre: "Depuis le début" },
];

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

// Periode (debut, fin) qui contient aujourd'hui ; null = pas de limite
export function periodeTB(type, ref = aujourdhui()) {
  if (type === "annee") return { debut: ref.slice(0, 4) + "-01-01", fin: ref.slice(0, 4) + "-12-31" };
  return periodeDe(type, ref);
}

export default function PeriodeTB({ type, changer }) {
  return (
    <div className="tdb-periodes" role="tablist" aria-label="Période">
      {PERIODES_TB.map((p) => (
        <button key={p.id} role="tab" aria-selected={type === p.id} className={"tdb-pil" + (type === p.id ? " actif" : "")} onClick={() => changer(p.id)}>
          {p.titre}
        </button>
      ))}
    </div>
  );
}
