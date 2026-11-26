// « ✅ S'insère après …, +X min de détour, +Y ₪, ordre conseillé » (26 nov. 2026, étape 2) - espace de Rebecca.
// Le calcul se fait sur le serveur (fonction Netlify « insertion ») avec SES droits : sa journée n'est jamais envoyée
// au site public. Calcul automatique à l'ouverture d'une demande en attente (transport, aéroport, livraison).
import { useEffect, useState } from "react";
import { auth } from "../firebase.js";
import { SERVICES_INSERABLES, messageCliente } from "../pricing/insertion.js";
import { lienWhatsApp } from "../pricing/navigation.js";

export default function InsertionJournee({ d }) {
  const concerne = !!d && SERVICES_INSERABLES.includes(d.service) && ["en attente", "acceptee"].includes(d.statut) && !!d.date;
  const [etat, setEtat] = useState({ statut: "" });
  const lancer = async () => {
    setEtat({ statut: "calcul" });
    try {
      const u = auth.currentUser;
      const jeton = u ? await u.getIdToken() : "";
      const r = await fetch("/.netlify/functions/insertion", { method: "POST", headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) }, body: JSON.stringify({ demandeId: d.id }) });
      const o = r.ok ? await r.json() : null;
      if (!o || o.possible == null) setEtat({ statut: "erreur", texte: (o && o.erreur) || `erreur ${r.status}` });
      else setEtat({ statut: "ok", ...o });
    } catch (e) {
      setEtat({ statut: "erreur", texte: e.message });
    }
  };
  useEffect(() => {
    if (concerne && d.statut === "en attente") lancer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d && d.id]);
  if (!concerne) return null;

  return (
    <div className="tb-bloc">
      <h3>🧩 Dans ma journée</h3>
      {etat.statut === "" && <button type="button" className="tb-bouton tb-clair" onClick={lancer}>Vérifier si elle s'insère</button>}
      {etat.statut === "calcul" && <p className="tb-note">Calcul avec les temps de route de ta journée…</p>}
      {etat.statut === "erreur" && (
        <p className="tb-note">Calcul impossible pour l'instant ({etat.texte}). <button type="button" className="lien" onClick={lancer}>Réessayer</button></p>
      )}
      {etat.statut === "ok" && (
        <>
          {etat.possible ? (
            <p><strong>✅ S'insère{etat.lignes[0] ? ` après ${etat.lignes[0].apres}` : ""}</strong>{etat.lignes[0] && etat.lignes[0].avant ? `, avant ${etat.lignes[0].avant}` : ""}.</p>
          ) : etat.proposition ? (
            <p><strong>❌ Pas à cette heure-là</strong> : la marge de {etat.marge} min avant ou après un rendez-vous ne serait pas tenue. Première heure faisable ce jour-là : <strong>{etat.proposition.replace(":", "h")}</strong>.</p>
          ) : (
            <p><strong>❌ Ne s'insère pas ce jour-là</strong> (marge de {etat.marge} min avant et après chaque rendez-vous).</p>
          )}
          {etat.lignes && etat.lignes.length > 0 && (
            <>
              <p className="tb-note">
                +{etat.detourMin} min de détour · environ {etat.coutDetour} ₪ d'essence et d'usure
                {typeof etat.prix === "number" ? ` · +${etat.prix} ₪ de course (≈ ${etat.gain} ₪ gagnés)` : ""}
                {etat.routes === "estimation" ? " · temps de route estimés" : ""}
              </p>
              {etat.lignes.map((l, i) => (
                <div key={i}>
                  {etat.lignes.length > 1 && <p className="tb-note">{i === 0 ? "Aller" : "Retour"} :</p>}
                  <ol className="tb-liste">
                    {l.ordre.map((e, k) => (
                      <li key={k} style={e.nouveau ? { fontWeight: 600 } : { opacity: 0.75 }}>{e.heure} {e.texte}{e.nouveau ? " ← nouveau" : ""}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </>
          )}
          {(() => {
            // Étape 4 : message WhatsApp prêt pour la cliente (oui à son heure, ou l'heure que je peux proposer)
            const texte = messageCliente(d, etat);
            const lien = texte && d.telephone ? lienWhatsApp(d.telephone, texte) : null;
            if (!texte) return null;
            return (
              <>
                <p className="tb-note" style={{ whiteSpace: "pre-wrap" }}>💬 {texte}</p>
                <div className="tb-actions">
                  {lien && <a className="tb-bouton" href={lien} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>}
                  <button type="button" className="tb-bouton tb-clair" onClick={() => navigator.clipboard && navigator.clipboard.writeText(texte).catch(() => {})}>Copier le message</button>
                </div>
              </>
            );
          })()}
          <button type="button" className="tb-bouton tb-clair" onClick={lancer}>Recalculer</button>
        </>
      )}
    </div>
  );
}
