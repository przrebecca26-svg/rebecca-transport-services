import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { FILTRES, construireFiches, estSansCompte, filtrer, telNormalise } from "./pricing/clients.js";
import FicheClient from "./FicheClient.jsx";
import "./clients.css";

// Onglet « Clients » de l'espace prive (Lot B, seance B2) : liste, recherche et fiche complete.
// Clients avec compte (collection clients) + clients sans compte reconnus par leur telephone (demandes).

const COLLECTIONS = ["clients", "demandes", "clientsAdmin", "autorisations", "recharges", "mouvements"];

const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export default function Clients({ aller, cible }) {
  const [donnees, setDonnees] = useState({});
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [filtre, setFiltre] = useState("tous");
  const [texte, setTexte] = useState("");
  const [ouverte, setOuverte] = useState(cible || null);

  useEffect(() => {
    const arrets = COLLECTIONS.map((nom) =>
      onSnapshot(
        collection(db, nom),
        (s) => setDonnees((avant) => ({ ...avant, [nom]: s.docs.map((x) => ({ id: x.id, ...x.data() })) })),
        () => setLectureImpossible(true)
      )
    );
    return () => arrets.forEach((a) => a());
  }, []);

  const pret = COLLECTIONS.every((n) => Array.isArray(donnees[n]));

  const fiches = useMemo(() => {
    if (!pret) return [];
    const admins = Object.fromEntries(donnees.clientsAdmin.map((x) => [x.id, x]));
    const transport = new Set(donnees.autorisations.filter((a) => a.activite === "transport" && a.actif === true).map((a) => a.uid || String(a.id).split("__")[0]));
    return construireFiches({ clients: donnees.clients, demandes: donnees.demandes, admins, transport, recharges: donnees.recharges, mouvements: donnees.mouvements });
  }, [pret, donnees]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture des clients impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (!pret) return <p className="admin-texte tb-pad">Chargement des clients…</p>;

  // Fiche demandee ; une cle « tel_… » peut appartenir a un compte (meme numero de telephone)
  const courante =
    ouverte && (fiches.find((f) => f.cle === ouverte) || (estSansCompte(ouverte) && fiches.find((f) => telNormalise(f.telephone) === ouverte.slice(4))));
  if (ouverte && courante) {
    return (
      <FicheClient
        key={courante.cle}
        fiche={courante}
        admin={donnees.clientsAdmin.find((x) => x.id === courante.cle) || null}
        recharges={donnees.recharges.filter((r) => r.uid === courante.cle)}
        clients={donnees.clients}
        aller={aller}
        onFermer={() => setOuverte(null)}
      />
    );
  }

  const visibles = filtrer(fiches, filtre, texte);
  const compte = (id) => filtrer(fiches, id, "").length;

  return (
    <section className="tb-liste cl">
      {ouverte && !courante && <p className="tb-note">Cette fiche client est introuvable.</p>}
      <input
        className="cl-recherche"
        type="search"
        inputMode="search"
        placeholder="Rechercher : nom, téléphone, e-mail"
        aria-label="Rechercher un client"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
      />
      <div className="tb-filtres" role="tablist" aria-label="Filtrer les clients">
        {FILTRES.map((f) => (
          <button key={f.id} role="tab" aria-selected={filtre === f.id} className={"tb-filtre" + (filtre === f.id ? " actif" : "")} onClick={() => setFiltre(f.id)}>
            {f.label} <span>{compte(f.id)}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className="admin-texte tb-pad">Aucun client trouvé.</p>}

      {visibles.map((f) => (
        <button key={f.cle} className="tb-carte" onClick={() => setOuverte(f.cle)}>
          <span className="tb-ligne">
            <strong>{f.nom}</strong>
            <span className="cl-badges">
              {f.bloque && <span className="tb-badge tb-refusee">Bloqué</span>}
              {f.rechargesEnAttente > 0 && <span className="tb-badge tb-attente">Recharge</span>}
              {f.transport && <span className="tb-badge tb-terminee">Transport</span>}
              <span className={"tb-badge " + (f.avecCompte ? "tb-acceptee" : "tb-annulee")}>{f.avecCompte ? "Compte" : "Sans compte"}</span>
            </span>
          </span>
          <span className="tb-quand">
            {f.telephone || "—"}
            {f.aNotes ? " · 📝" : ""}
          </span>
          <span className="tb-ligne">
            <span>
              {f.stats.nbDemandes} demande{f.stats.nbDemandes > 1 ? "s" : ""}
              {f.derniereDate ? ` · dernière le ${jourCourt(f.derniereDate)}` : ""}
            </span>
            {f.stats.resteAPayer > 0 && <strong className="cl-reste">reste {Math.round(f.stats.resteAPayer)} ₪</strong>}
          </span>
        </button>
      ))}
    </section>
  );
}
