import { aConfirmerClient } from "../services.js";

// Devis affiche au client. N'affiche JAMAIS le gain de Rebecca ni les alertes internes.
export default function Devis({ resultat, trajet, pretPourCalcul, manque }) {
  if (resultat && resultat.bloque) {
    const f = resultat.disponibleA;
    return (
      <section className="devis bloque" aria-live="polite">
        <h3>Rebecca n'est pas disponible</h3>
        <p>{resultat.raison}</p>
        {f && <p>Prochaine disponibilité : <strong>{f.date.split("-").reverse().join("/")} à {f.heure}</strong>. Choisissez une autre date ou heure.</p>}
      </section>
    );
  }
  if (!pretPourCalcul) {
    return (
      <section className="devis attente" aria-live="polite">
        <h3>Votre devis</h3>
        <p>{manque || "Complétez le formulaire : le prix s'affiche ici automatiquement."}</p>
      </section>
    );
  }
  if (trajet && trajet.statut === "chargement") {
    return (
      <section className="devis attente" aria-live="polite">
        <h3>Votre devis</h3>
        <p>Calcul du trajet en cours…</p>
      </section>
    );
  }
  if (!resultat || !resultat.ok) {
    return (
      <section className="devis attente" aria-live="polite">
        <h3>Votre devis</h3>
        <p>Prix à confirmer par Rebecca. Vous pouvez envoyer votre demande, elle vous répondra rapidement.</p>
      </section>
    );
  }
  const notes = aConfirmerClient(resultat);
  return (
    <section className="devis" aria-live="polite">
      <h3>Votre devis</h3>
      {resultat.devis ? (
        <p className="total">Sur devis</p>
      ) : (
        <p className="total">{resultat.total} ₪ <small>estimation</small></p>
      )}
      {resultat.lignes.length > 0 && (
        <ul className="detail">
          {resultat.lignes.map((l, i) => (
            <li key={i}><span>{l.libelle}</span><span>{l.montant} ₪</span></li>
          ))}
        </ul>
      )}
      {resultat.separe && resultat.separe.length > 0 && (
        <ul className="detail separe">
          {resultat.separe.map((l, i) => (
            <li key={i}><span>{l.libelle} (hors prestation)</span><span>{l.montant} ₪</span></li>
          ))}
        </ul>
      )}
      {notes.map((n, i) => (
        <p className="note" key={i}>• {n}</p>
      ))}
      {trajet && trajet.statut === "ok" && trajet.km >= 1 && <p className="note">Trajet estimé : {trajet.km} km, environ {trajet.minutes} min.</p>}
      <p className="note">Prix estimatif : Rebecca confirme le prix définitif avec la réservation. Aucun supplément surprise.</p>
    </section>
  );
}
