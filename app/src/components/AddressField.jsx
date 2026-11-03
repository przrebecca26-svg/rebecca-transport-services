import { useEffect, useRef, useState } from "react";
import { chercherAdresses } from "../routing.js";

// Champ adresse avec suggestions. Si la recherche est indisponible, le client peut
// quand meme ecrire son adresse : Rebecca confirmera le prix (on ne bloque jamais le client).
export default function AddressField({ id, valeur, onChange, erreur }) {
  const [texte, setTexte] = useState(valeur && valeur.label ? valeur.label : "");
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [panne, setPanne] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!ouvert || texte.trim().length < 3 || (valeur && typeof valeur.lat === "number" && valeur.label === texte)) {
      setListe([]);
      return;
    }
    const num = ++reqRef.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await chercherAdresses(texte, ctrl.signal);
        if (num === reqRef.current) {
          setListe(r);
          setPanne(false);
        }
      } catch (e) {
        if (e.name !== "AbortError" && num === reqRef.current) setPanne(true);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [texte, ouvert, valeur]);

  return (
    <div className="adresse">
      <input
        id={id}
        type="text"
        value={texte}
        autoComplete="off"
        placeholder="Commencez à écrire l'adresse…"
        aria-invalid={!!erreur}
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
          // adresse tapee a la main : pas de coordonnees, Rebecca confirmera le prix
          onChange(e.target.value.trim() ? { label: e.target.value } : null);
        }}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
      />
      {valeur && typeof valeur.lat === "number" && <span className="ok-adresse">✓ adresse reconnue</span>}
      {valeur && valeur.label && typeof valeur.lat !== "number" && (
        <span className="aide">{panne ? "Recherche indisponible : Rebecca confirmera le prix." : "Choisissez une suggestion pour un prix automatique."}</span>
      )}
      {ouvert && liste.length > 0 && (
        <ul className="suggestions" role="listbox">
          {liste.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTexte(a.label);
                  setOuvert(false);
                  setListe([]);
                  onChange(a);
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
