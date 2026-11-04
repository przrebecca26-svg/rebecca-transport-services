import { useEffect, useRef, useState } from "react";
import { adresseDepuisPosition, chercherAdresses, positionActuelle } from "../routing.js";
import { compteOuvert, useClient } from "../client.js";
import "../client-commun.css";

// Champ adresse avec suggestions. Si la recherche est indisponible, le client peut
// quand meme ecrire son adresse : Rebecca confirmera le prix (on ne bloque jamais le client).
// En plus :
//  - bouton "Utiliser ma position" (comme le partage de position sur WhatsApp) ;
//  - raccourcis vers les adresses enregistrees du compte (Maison, Travail...) quand raccourcis = true.
export default function AddressField({ id, valeur, onChange, erreur, raccourcis = false, position = true }) {
  const client = useClient();
  const [texte, setTexte] = useState(valeur && valeur.label ? valeur.label : "");
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [panne, setPanne] = useState(false);
  const [gps, setGps] = useState({ enCours: false, erreur: "" });
  const reqRef = useRef(0);
  const gpsRef = useRef(null);

  // Adresse remplie de l'exterieur (favori, enfant enregistre, "Refaire ce trajet") : le texte suit
  const labelExterne = valeur && valeur.label ? valeur.label : "";
  useEffect(() => {
    setTexte((t) => (t.trim() === labelExterne.trim() ? t : labelExterne));
  }, [labelExterne]);

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

  // On arrete une recherche de position en cours si le champ disparait
  useEffect(() => () => gpsRef.current && gpsRef.current.abort(), []);

  const choisir = (a) => {
    setTexte(a.label);
    setOuvert(false);
    setListe([]);
    setGps({ enCours: false, erreur: "" });
    onChange(a);
  };

  const maPosition = async () => {
    if (gps.enCours) return;
    setGps({ enCours: true, erreur: "" });
    const ctrl = new AbortController();
    gpsRef.current = ctrl;
    try {
      const p = await positionActuelle();
      const a = await adresseDepuisPosition(p.lat, p.lon, ctrl.signal);
      if (!ctrl.signal.aborted) choisir(a);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setGps({ enCours: false, erreur: (e && e.message) || "Position introuvable. Tapez l'adresse." });
    }
  };

  // Adresses enregistrees du compte (seulement si le compte est ouvert)
  const enregistrees = raccourcis && compteOuvert(client) && client.profil && Array.isArray(client.profil.adresses) ? client.profil.adresses.filter((a) => a && a.label) : [];

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
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(a)}>
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(position || enregistrees.length > 0) && (
        <div className="adresse-raccourcis">
          {position && (
            <button type="button" className="adresse-position" disabled={gps.enCours} onClick={maPosition}>
              {gps.enCours ? "Recherche de votre position…" : "📍 Utiliser ma position"}
            </button>
          )}
          {enregistrees.map((a, i) => (
            <button
              key={i}
              type="button"
              title={a.label}
              onClick={() => {
                const r = { label: a.label };
                if (typeof a.lat === "number" && typeof a.lon === "number") {
                  r.lat = a.lat;
                  r.lon = a.lon;
                }
                choisir(r);
                if (typeof r.lat !== "number") setOuvert(true); // sans coordonnees : on propose les suggestions
              }}
            >
              {a.nom}
            </button>
          ))}
        </div>
      )}
      {gps.erreur && <span className="erreur">{gps.erreur}</span>}
    </div>
  );
}
