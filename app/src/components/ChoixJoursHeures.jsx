import { useEffect, useState } from "react";
import { HEURES_LISTE, NOMS_JOURS, erreurLigne, lignesDepuisTexte, texteDepuisLignes } from "../pricing/creneauxResto.js";

// CHOISIR DES JOURS ET DES HEURES AVEC DES LISTES (20 nov. 2026, Rebecca) : « un déroulé où il choisit les jours et
// les horaires, de telle heure à telle heure ». Pour les créneaux réservés (formule B, 2 h au moins) et pour les
// horaires d'ouverture du restaurant. Le résultat reste le même texte qu'avant (« jeudi 19h-21h, dim-jeu 11h-23h »).
const MAJ = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const heureLue = (hm) => `${Number(hm.slice(0, 2))}h${hm.slice(3) === "00" ? "" : hm.slice(3)}`;

export default function ChoixJoursHeures({ valeur, onChange, minHeures = 2, ajout = "+ Ajouter un créneau", defaut = { de: 4, a: 4, debut: "19:00", fin: "21:00" }, classe = "pp-champ" }) {
  const [lignes, setLignes] = useState(() => {
    const l = lignesDepuisTexte(valeur);
    return l.length ? l : [defaut];
  });
  const changer = (suite) => {
    setLignes(suite);
    onChange(texteDepuisLignes(suite.filter((l) => !erreurLigne(l, minHeures))));
  };
  // Le choix proposé compte tout de suite (même sans toucher aux listes)
  useEffect(() => {
    if (!valeur) onChange(texteDepuisLignes(lignes.filter((l) => !erreurLigne(l, minHeures))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const maj = (i, k, v) => changer(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const choixJour = (i, k, l) => (
    <select value={l[k]} onChange={(e) => maj(i, k, Number(e.target.value))} aria-label={k === "de" ? "Du jour" : "Au jour"}>
      {NOMS_JOURS.map((n, j) => <option key={n} value={j}>{MAJ(n)}</option>)}
    </select>
  );
  const choixHeure = (i, k, l) => (
    <select value={l[k]} onChange={(e) => maj(i, k, e.target.value)} aria-label={k === "debut" ? "De" : "À"}>
      {HEURES_LISTE.map((h) => <option key={h} value={h}>{heureLue(h)}</option>)}
    </select>
  );
  return (
    <div>
      {lignes.map((l, i) => {
        const err = erreurLigne(l, minHeures);
        return (
          <div key={i} className={classe} style={{ borderTop: i ? "1px solid rgba(255,255,255,.08)" : 0, paddingTop: i ? 8 : 0 }}>
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              du {choixJour(i, "de", l)} au {choixJour(i, "a", l)}
            </span>
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
              de {choixHeure(i, "debut", l)} à {choixHeure(i, "fin", l)}
              {lignes.length > 1 && <button type="button" className="pp-lien" onClick={() => changer(lignes.filter((_, j) => j !== i))}>Retirer</button>}
            </span>
            {err && <small style={{ color: "#f08a9c" }}>{err}</small>}
          </div>
        );
      })}
      <button type="button" className="pp-lien" onClick={() => changer([...lignes, { ...(lignes[lignes.length - 1] || defaut) }])}>{ajout}</button>
    </div>
  );
}
