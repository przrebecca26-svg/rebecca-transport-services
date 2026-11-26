import { aConfirmerClient } from "../services.js";
import { prixFr } from "../pricing/partage.js";
import { texteDuree } from "../pricing/circulation.js";

// Devis affiche au client. N'affiche JAMAIS le gain de Rebecca ni les alertes internes.
// insertion (26 nov. 2026, étape 2) : { statut: calcul | non | erreur, proposition: "HH:MM" } quand l'heure tombe dans
// un moment pris par Rebecca ; onHeure(h) : choisir l'heure proposée
export default function Devis({ resultat, trajet, pretPourCalcul, manque, quand, insertion = null, onHeure = null }) {
  if (resultat && resultat.bloque) {
    const f = resultat.disponibleA;
    const ins = insertion || {};
    if (ins.statut === "calcul") {
      return (
        <section className="devis attente" aria-live="polite">
          <h3>Votre devis</h3>
          <p>Je regarde si Rebecca peut organiser sa journée pour vous à cette heure-là…</p>
        </section>
      );
    }
    const proposition = ins.statut === "non" && ins.proposition ? ins.proposition : "";
    return (
      <section className="devis bloque" aria-live="polite">
        <h3>Rebecca n'est pas disponible</h3>
        <p>{ins.statut === "non" ? "Rebecca a déjà un rendez-vous à ce moment-là et ne peut pas être là à cette heure." : resultat.raison}</p>
        {proposition ? (
          <p>
            Elle peut s'organiser pour vous ce jour-là à partir de <strong>{proposition.replace(":", "h")}</strong>.{" "}
            {onHeure && <button type="button" className="lien" onClick={() => onHeure(proposition)}>Choisir {proposition.replace(":", "h")}</button>}
          </p>
        ) : (
          f && <p>Prochaine disponibilité : <strong>{f.date.split("-").reverse().join("/")} à {f.heure}</strong>. Choisissez une autre date ou heure.</p>
        )}
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
      {resultat.details && resultat.details.partage && (
        <div className="partage">
          <p className="note"><strong>{resultat.details.partage.mode === "egal" ? `Parts égales entre les ${resultat.details.partage.parts.length} familles` : "Chaque famille paie sa part"}</strong></p>
          <ul className="detail">
            {resultat.details.partage.parts.map((p, i) => (
              <li key={i}><span>{p.nom} ({p.personnes})</span><span>{prixFr(p.montant)} ₪</span></li>
            ))}
          </ul>
        </div>
      )}
      {notes.map((n, i) => (
        <p className="note" key={i}>• {n}</p>
      ))}
      {trajet && trajet.statut === "ok" && trajet.km >= 1 && <p className="note">Trajet estimé : {String(trajet.km).replace(".", ",")} km, {texteDuree(trajet.minutes, quand && quand.date, quand && quand.heure)}{quand && quand.heure ? ` en partant à ${quand.heure}` : ""}.</p>}
      <p className="note">Prix estimatif : Rebecca confirme le prix définitif avec la réservation. Aucun supplément surprise.</p>
    </section>
  );
}
