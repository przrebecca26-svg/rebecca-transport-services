import { useState } from "react";
import { enregistrerCleGoogle } from "../repertoireBase.js";
import { useFermetures } from "../fermetures.js";
import { definirCleGoogle, googleActif } from "../routing.js";

// Recherche d'adresses Google : Rebecca colle sa cle ici (jamais ecrite dans le programme).
// 19 nov. 2026 (Rebecca) : deplacee du Repertoire vers Reglages ; quand la cle marche, on n'affiche plus une case vide
// « Colle ici ta clé » (trompeur) mais « ✅ Clé enregistrée » et un bouton « Changer la clé ».
export default function RechercheGoogle() {
  useFermetures(); // charge la cle deja enregistree
  const [cle, setCle] = useState("");
  const [message, setMessage] = useState("");
  const [changer, setChanger] = useState(false);
  const actif = googleActif();
  const enregistrer = async (valeur) => {
    try {
      await enregistrerCleGoogle(valeur);
      definirCleGoogle(valeur);
      setCle("");
      setChanger(false);
      setMessage(valeur ? (googleActif() ? "Clé enregistrée : la recherche Google est active." : "Cette clé n'a pas la bonne forme : vérifie que tu as tout copié.") : "Recherche Google arrêtée : retour au service gratuit.");
    } catch {
      setMessage("Enregistrement impossible : seule Rebecca peut régler la recherche Google.");
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Recherche d'adresses Google</h3>
      <p className="tb-note">{actif ? "✅ Clé enregistrée : écoles et magasins par leur nom, en français, anglais ou hébreu, avec les numéros de rue." : "Pas encore active : la recherche utilise le service gratuit."}</p>
      {actif && !changer ? (
        <div className="tb-actions">
          <button type="button" className="tb-bouton tb-clair" onClick={() => setChanger(true)}>Changer la clé</button>
        </div>
      ) : (
        <div className="tb-actions">
          <input className="dr-tel" type="text" autoComplete="off" placeholder="Colle ici ta clé Google" value={cle} onChange={(e) => setCle(e.target.value)} />
          <button type="button" className="tb-bouton" disabled={!cle.trim()} onClick={() => enregistrer(cle.trim())}>Enregistrer la clé</button>
          {actif && <button type="button" className="tb-bouton tb-clair" onClick={() => enregistrer("")}>Arrêter la recherche Google</button>}
          {actif && <button type="button" className="tb-bouton tb-clair" onClick={() => setChanger(false)}>Annuler</button>}
        </div>
      )}
      {message && <p className="tb-note" role="status">{message}</p>}
    </div>
  );
}
