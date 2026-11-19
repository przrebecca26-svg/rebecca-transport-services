import { useEffect, useState } from "react";
import { useCommandes, useRestos } from "./components/CommandesRestoAdmin.jsx";
import { LIBELLES, etatCommande } from "./pricing/restos.js";
import { utcVersLocal } from "./pricing/calendrier.js";
import { lienWhatsApp } from "./pricing/navigation.js";

// COMMANDES DES RESTAURANTS (19 nov. 2026, Rebecca) : un onglet dans le menu, avec une pastille, pour retrouver
// chaque commande des restaurants partenaires (en attente, acceptée, refusée, livrée) et tous ses détails.
// La notification « 🍕 Commande … » ouvre directement cet onglet. Lecture seule : on répond en haut de l'écran
// (carte de la commande, avec « En ligne »), et la livraison acceptée se gère dans le Calendrier.
const h = (x) => String(x || "").replace(":", "h");
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : d);
const FILTRES = [
  { v: "tous", l: "Toutes" },
  { v: "nouvelle", l: "En attente" },
  { v: "acceptee", l: "Acceptées" },
  { v: "livree", l: "Livrées" },
  { v: "refus", l: "Refusées" },
];
const dansFiltre = (f, e) => f === "tous" || (f === "refus" ? ["refusee", "expiree", "annulee"].includes(e) : e === f);

// Pastille du menu : commandes qui attendent une réponse
export function useCompteurCommandesResto(actif) {
  const restos = useRestos();
  const commandes = useCommandes(actif ? restos : []);
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return actif ? commandes.filter((c) => etatCommande(c, maintenant) === "nouvelle").length : 0;
}

export default function CommandesResto({ aller }) {
  const restos = useRestos();
  const commandes = useCommandes(restos);
  const [filtre, setFiltre] = useState("tous");
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const nom = (cle) => (restos.find((r) => r.cle === cle) || {}).nom || "Restaurant";
  const avecEtat = commandes.map((c) => ({ ...c, etat: etatCommande(c, maintenant) }));
  const liste = avecEtat
    .filter((c) => dansFiltre(filtre, c.etat))
    .sort((a, b) => (String(b.jour) + String(b.pretA)).localeCompare(String(a.jour) + String(a.pretA)));
  const jours = [...new Set(liste.map((c) => c.jour))];
  const aujourdhui = utcVersLocal(maintenant).date;

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Commandes restaurants</h1>
        <p className="tdb-sous">Les commandes de tes restaurants partenaires sur 14 jours, avec tous les détails. Pour répondre : passe « 🟢 En ligne », la commande apparaît en grand en haut de l'écran.</p>
      </div>
      <div className="tb-filtres" role="tablist" aria-label="Commandes">
        {FILTRES.map((f) => (
          <button key={f.v} role="tab" aria-selected={filtre === f.v} className={"tb-filtre" + (filtre === f.v ? " actif" : "")} onClick={() => setFiltre(f.v)}>
            {f.l} <span>{avecEtat.filter((c) => dansFiltre(f.v, c.etat)).length}</span>
          </button>
        ))}
      </div>
      {!restos.length && <p className="tdb-note tb-pad">Aucun restaurant partenaire avec un lien actif.</p>}
      {restos.length > 0 && liste.length === 0 && <p className="tdb-note tb-pad">Aucune commande ici pour l'instant.</p>}
      {jours.map((j) => (
        <section key={j} className="tdb-bloc">
          <h2>{j === aujourdhui ? "Aujourd'hui" : jourFr(j)}</h2>
          {liste.filter((c) => c.jour === j).map((c) => (
            <div key={c.cle + c.id} className="bloc">
              <p className="rp-type">🍕 {nom(c.cle)} · prête à {h(c.pretA)}</p>
              <p><strong>{LIBELLES[c.etat] || c.etat}</strong>{typeof c.prix === "number" ? ` · ${c.prix} ₪` : ""}{typeof c.km === "number" ? ` · ${String(c.km).replace(".", ",")} km` : ""}{c.par ? ` · par ${c.par}` : ""}{c.source === "whatsapp" ? " · saisie WhatsApp" : ""}</p>
              <p>👤 {c.client || "Client"}{c.telClient ? <> · <a className="rp-waze" href={lienWhatsApp(c.telClient)} target="_blank" rel="noopener noreferrer">{c.telClient}</a></> : null}</p>
              {c.adresse && c.adresse.label && <p>🏠 {c.adresse.label}</p>}
              {c.note && <p className="tdb-note">📝 {c.note}</p>}
              {c.motif && <p className="tdb-note">Motif : {c.motif}</p>}
              {c.demandeId && (
                <div className="rp-boutons">
                  <button type="button" className="rp-waze" onClick={() => aller("demandes", c.demandeId)}>Ouvrir la livraison</button>
                  <button type="button" className="rp-waze" onClick={() => aller("agenda")}>Calendrier</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
