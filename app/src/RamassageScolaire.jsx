import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import RamassagePlanning from "./RamassagePlanning.jsx";
import TourneeScolaire from "./TourneeScolaire.jsx";
import { useTournee } from "./tourneeBase.js";
import "./client-commun.css";
import "./devis-rapide.css";

// ONGLET « RAMASSAGE SCOLAIRE » (12 nov. 2026, 15h15) : tout le ramassage au meme endroit.
//  - Devis et demandes : la liste de TOUS les devis (« Devis rapide » faits par Rebecca et « Demande par le site »),
//    puis le calculateur de devis ;
//  - Ma tournee : les trajets d'ecole de chaque jour.

const STATUTS_SITE = { "en attente": "En attente", acceptee: "Acceptée", refusee: "Refusée", terminee: "Terminée", annulee: "Annulée" };
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");

function ToutesLesDemandes({ aller }) {
  const base = useTournee();
  const [site, setSite] = useState([]);
  const [lecture, setLecture] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "demandes"), where("service", "==", "ramassage")),
        (s) => setSite(s.docs.map((x) => ({ id: x.id, ...x.data() })).filter((d) => d.source !== "manuel")),
        () => setLecture("Demandes du site illisibles pour l'instant.")
      ),
    []
  );
  const rapides = base.donnees.devis || [];
  const lignes = [
    ...rapides.map((d) => ({ cle: "r" + d.id, origine: "Devis rapide", nom: d.nom, quand: jourFr(d.creeLe), prix: d.total, statut: d.statut === "refuse" ? "Refusé" : "En attente de réponse", ordre: d.creeLe || "" })),
    ...site.map((d) => ({
      cle: "s" + d.id,
      id: d.id,
      origine: "Demande par le site",
      nom: d.nom,
      quand: jourFr(d.date),
      prix: typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime,
      statut: STATUTS_SITE[d.statut] || d.statut || "",
      ordre: d.creeLe && d.creeLe.toDate ? d.creeLe.toDate().toISOString().slice(0, 10) : d.date || "",
    })),
  ].sort((a, b) => (a.ordre < b.ordre ? 1 : -1));

  return (
    <section className="tdb-bloc">
      <h2>Tous les devis et demandes</h2>
      {lecture && <p className="rp-alerte">{lecture}</p>}
      {lignes.length === 0 && <p className="tdb-note">Aucun devis ni demande de ramassage pour l'instant.</p>}
      {lignes.map((l) => (
        <div className="rp-forfait" key={l.cle}>
          <span>
            <span className={"rp-origine" + (l.origine === "Devis rapide" ? " rapide" : "")}>{l.origine}</span> <b>{l.nom || "Sans nom"}</b>
            {l.quand ? ` · ${l.quand}` : ""}{typeof l.prix === "number" ? ` · ${l.prix} ₪` : ""} · {l.statut}
          </span>
          {l.id && <div className="rp-boutons"><button type="button" className="rp-waze" onClick={() => aller("demandes", l.id)}>Ouvrir la demande</button></div>}
        </div>
      ))}
      <p className="tdb-note">Les devis rapides se rouvrent, s'envoient sur WhatsApp et se marquent acceptés ou refusés juste en dessous.</p>
    </section>
  );
}

export default function RamassageScolaire({ aller }) {
  const [onglet, setOnglet] = useState("devis");
  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Ramassage scolaire</h1>
      </div>
      <div className="choix rp-deux">
        <button type="button" className={onglet === "devis" ? "actif" : ""} aria-pressed={onglet === "devis"} onClick={() => setOnglet("devis")}>Devis et demandes</button>
        <button type="button" className={onglet === "tournee" ? "actif" : ""} aria-pressed={onglet === "tournee"} onClick={() => setOnglet("tournee")}>Ma tournée</button>
      </div>
      {onglet === "devis" && (
        <>
          <ToutesLesDemandes aller={aller} />
          <RamassagePlanning aller={aller} />
        </>
      )}
      {onglet === "tournee" && <TourneeScolaire />}
    </div>
  );
}
