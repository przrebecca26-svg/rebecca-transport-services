import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import RamassagePlanning from "./RamassagePlanning.jsx";
import TourneeScolaire from "./TourneeScolaire.jsx";
import { useTournee } from "./tourneeBase.js";
import { nomPartage, STATUTS_PARTAGE } from "./pricing/partageRamassage.js";
import { useDemandesRamassage } from "./prioriteBase.js";
import { textePriorite, arriveeFr } from "./pricing/prioriteRamassage.js";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import "./client-commun.css";
import "./devis-rapide.css";

// ONGLET « RAMASSAGE SCOLAIRE » (12 nov. 2026, 15h15) : tout le ramassage au meme endroit.
//  - Devis et demandes : la liste de TOUS les devis (« Devis rapide » faits par Rebecca et « Demande par le site »),
//    puis le calculateur de devis ;
//  - Ma tournee : les trajets d'ecole de chaque jour.

const STATUTS_SITE = { "en attente": "En attente", acceptee: "Acceptée", refusee: "Refusée", terminee: "Terminée", annulee: "Annulée" };
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");

// Trajets partages (15 nov. 2026) : ou en est chaque famille, et le devis provisoire (sans distance : prix a l'ouverture)
function TrajetsPartages({ ouvrir }) {
  const [liste, setListe] = useState([]);
  const { demandes, classees } = useDemandesRamassage();
  const infos = new Map(demandes.map((d) => [d.cle, d]));
  const changer = (id, statut) => updateDoc(doc(db, "trajetsPartages", id), { statut, majLe: serverTimestamp() }).catch(() => {});
  const [lecture, setLecture] = useState("");
  useEffect(
    () =>
      onSnapshot(
        collection(db, "trajetsPartages"),
        (s) => setListe(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => ((a.majLe && a.majLe.seconds) || 0) < ((b.majLe && b.majLe.seconds) || 0) ? 1 : -1)),
        () => setLecture("Trajets partagés illisibles pour l'instant (règles Firebase à publier ?).")
      ),
    []
  );
  if (!liste.length && !lecture) return null;
  return (
    <section className="tdb-bloc">
      <h2>Trajets partagés (site)</h2>
      {lecture && <p className="rp-alerte">{lecture}</p>}
      {liste.map((d) => (
        <div className="rp-forfait" key={d.id}>
          <span>
            <span className="rp-origine">Trajet partagé</span> <b>{d.familles.map((f, i) => nomPartage(d, i)).join(" + ")}</b> · {STATUTS_PARTAGE[d.statut] || d.statut}
            <br />
            {d.familles.map((f, i) => `${nomPartage(d, i)} : ${f.enfants.length ? `${f.enfants.length} enfant${f.enfants.length > 1 ? "s" : ""}` : "en attente"}`).join(" · ")}
            {infos.get("p" + d.id) && (
              <>
                <br />
                <small>Arrivée le {arriveeFr(d.creeLe)}{d.statut === "en cours" ? ` · ${textePriorite(infos.get("p" + d.id), classees)}` : ""}</small>
              </>
            )}
          </span>
          <div className="rp-boutons">
            <button type="button" className="rp-waze" onClick={() => ouvrir({ id: d.id, doc: d, cle: Date.now() })}>Ouvrir dans mon devis</button>
            <a className="rp-waze" href={`#/partage/${d.id}/0`} target="_blank" rel="noopener noreferrer">Voir la page des familles</a>
            {d.statut === "en cours" && <button type="button" className="rp-waze" onClick={() => changer(d.id, "refusee")}>Refusé ❌</button>}
            {d.statut === "en cours" && <button type="button" className="rp-waze" onClick={() => changer(d.id, "annulee")}>Annulé</button>}
          </div>
        </div>
      ))}
      <p className="tdb-note">« Ouvrir dans mon devis » : tous les enfants des familles arrivent dans le devis ci-dessous. Tu vérifies ta tournée, puis « La cliente accepte » crée une fiche par famille et marque le trajet partagé accepté.</p>
    </section>
  );
}

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
  const { demandes, classees } = useDemandesRamassage();
  const infos = new Map(demandes.map((d) => [d.cle, d]));
  const lignes = [
    ...rapides.map((d) => ({ cle: "r" + d.id, origine: "Devis rapide", nom: d.nom, quand: jourFr(d.creeLe), prix: d.total, statut: d.statut === "refuse" ? "Refusé" : d.statut === "annule" ? "Annulé" : "En attente de réponse", ordre: d.arriveeLe || d.creeLe || "" })),
    ...site.filter((d) => !(d.details && d.details.partageId)).map((d) => ({
      cle: "s" + d.id,
      id: d.id,
      origine: "Demande par le site",
      nom: d.nom,
      quand: jourFr(d.date),
      prix: typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime,
      statut: STATUTS_SITE[d.statut] || d.statut || "",
      ordre: d.creeLe && d.creeLe.toDate ? d.creeLe.toDate().toISOString() : d.date || "",
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
            {infos.get(l.cle) && (
              <>
                <br />
                <small>Arrivée le {arriveeFr(infos.get(l.cle).arrivee)}{infos.get(l.cle).enAttente ? ` · ${textePriorite(infos.get(l.cle), classees)}` : ""}</small>
              </>
            )}
          </span>
          {l.id && <div className="rp-boutons"><button type="button" className="rp-waze" onClick={() => aller("demandes", l.id)}>Ouvrir la demande</button></div>}
        </div>
      ))}
      <p className="tdb-note">Les devis rapides se rouvrent, s'envoient sur WhatsApp et se marquent acceptés ou refusés juste en dessous.</p>
      <p className="tdb-note">Priorité : la 1ʳᵉ demande arrivée garde le créneau pendant 1 semaine ; ensuite la suivante passe devant, même si la 1ʳᵉ est encore en attente. Sans réponse au bout de 2 semaines, la demande est annulée automatiquement (la cliente refait sa demande ; avec un compte, tout se remplit seul avec « Refaire »).</p>
    </section>
  );
}

export default function RamassageScolaire({ aller }) {
  const [onglet, setOnglet] = useState("devis");
  const [partage, setPartage] = useState(null);
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
          <TrajetsPartages ouvrir={(p) => { setPartage(p); window.setTimeout(() => { const el = document.getElementById("rp-cliente"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50); }} />
          <ToutesLesDemandes aller={aller} />
          <RamassagePlanning aller={aller} ouvrirPartage={partage} />
        </>
      )}
      {onglet === "tournee" && <TourneeScolaire />}
    </div>
  );
}
