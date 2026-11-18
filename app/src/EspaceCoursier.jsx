import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { NOM, WHATSAPP } from "./contact.js";
import { MOYENS, courseDeMission, estBloque, etapeSuivante, soldeCumule, terminer } from "./pricing/coursiers.js";
import { REGLEMENT_COURSIERS } from "./pricing/partenaires.js";
import { lienWazePoint, lienWhatsApp } from "./pricing/navigation.js";
import { reduirePhoto } from "./photoReduite.js";
import CompteCoursier from "./components/CompteCoursier.jsx";
import "./coursiers.css";

// ESPACE D'UN COURSIER PARTENAIRE (18 nov. 2026, étape 3, validée par Rebecca)
// Il ne voit QUE : sa disponibilité, les courses qu'on lui propose, ses courses (Waze, WhatsApp, étapes,
// photo de preuve obligatoire), son compte (même tableau que Rebecca) et le règlement.
// Jamais les demandes, les clientes, les finances ou les autres activités de Rebecca.
const ONGLETS = [
  { id: "courses", label: "Mes courses" },
  { id: "compte", label: "Mon compte" },
  { id: "reglement", label: "Règlement" },
];
const jj = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

function Terminer({ m, onFini }) {
  const [photo, setPhoto] = useState("");
  const [moyen, setMoyen] = useState("");
  const [pourboire, setPourboire] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const choisir = async (x) => {
    const f = x.target.files && x.target.files[0];
    x.target.value = "";
    if (!f) return;
    setErreur("");
    try {
      setPhoto(await reduirePhoto(f, { cote: 1200, maxOctets: 600000 }));
    } catch (e) {
      setErreur(e.message || "Photo impossible.");
    }
  };
  const valider = async () => {
    const r = terminer(m, { photo, moyen, pourboire: pourboire || 0 });
    if (r.erreur) return setErreur(r.erreur);
    setEnCours(true);
    try {
      await updateDoc(doc(db, "missionsCoursiers", m.id), { ...r.maj, termineeLe: serverTimestamp() });
      onFini();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };
  return (
    <div className="cc-bloc" style={{ marginTop: 8 }}>
      <h3>Course livrée</h3>
      <label className="tb-bouton" style={{ display: "block", textAlign: "center" }}>
        {photo ? "📷 Changer la photo" : "📷 Prendre la photo de preuve *"}
        <input type="file" accept="image/*" capture="environment" onChange={choisir} style={{ display: "none" }} />
      </label>
      {photo && <img src={photo} alt="Preuve de livraison" style={{ width: "100%", borderRadius: 12, marginTop: 8 }} />}
      <p className="cc-gris" style={{ marginTop: 10 }}>Le client a payé par :</p>
      <div className="tb-actions" style={{ flexWrap: "wrap" }}>
        {MOYENS.map((x) => (
          <button key={x.id} className={"tb-bouton" + (moyen === x.id ? "" : " tb-clair")} onClick={() => setMoyen(x.id)}>{x.label}</button>
        ))}
      </div>
      <label className="pm-champ">Pourboire reçu (₪, facultatif)
        <input inputMode="decimal" value={pourboire} onChange={(x) => setPourboire(x.target.value)} />
      </label>
      {erreur && <p className="tb-note" role="alert">{erreur}</p>}
      <button className="tb-bouton" disabled={enCours} onClick={valider}>{enCours ? "Envoi…" : "✓ Terminer la course"}</button>
    </div>
  );
}

function Mission({ m, uid, bloque, prenom }) {
  const [info, setInfo] = useState("");
  const [fin, setFin] = useState(false);
  const accepter = async () => {
    setInfo("");
    try {
      await runTransaction(db, async (t) => {
        const ref = doc(db, "missionsCoursiers", m.id);
        const s = await t.get(ref);
        if (!s.exists() || s.data().statut !== "proposee") throw new Error("prise");
        // la course disparaît chez les autres coursiers (ils ne la voient plus)
        t.update(ref, { statut: "acceptee", coursier: uid, proposeeA: [uid], accepteeLe: serverTimestamp() });
      });
    } catch (e) {
      setInfo(e.message === "prise" ? "Trop tard : un autre coursier a pris cette course." : "Impossible pour l'instant. Réessaie.");
    }
  };
  const etape = etapeSuivante(m);
  const noter = (champ) => updateDoc(doc(db, "missionsCoursiers", m.id), { [champ]: serverTimestamp() }).catch(() => setInfo("Enregistrement impossible."));
  const waze = (a) => (a && a.label && a.label !== "Magasin (voir les détails)" ? lienWazePoint(a) : "");
  return (
    <div className="cc-bloc">
      <div className="cc-ligne" style={{ gridTemplateColumns: "1fr auto" }}>
        <strong>{m.titre}</strong>
        <strong>{m.prix} ₪</strong>
      </div>
      <p className="cc-gris" style={{ margin: "4px 0" }}>{jj(m.date)} · {m.heure} · commission {m.commission && m.commission.montant} ₪ · pour toi {Math.round((m.prix - ((m.commission && m.commission.montant) || 0)) * 100) / 100} ₪ (+ pourboire)</p>
      {m.depart && m.depart.label && <p style={{ margin: "4px 0" }}>📍 {m.depart.label}</p>}
      {m.arrivee && m.arrivee.label && <p style={{ margin: "4px 0" }}>🏁 {m.arrivee.label}</p>}
      {m.details && <p className="cc-gris" style={{ whiteSpace: "pre-line", margin: "4px 0" }}>{m.details}</p>}
      {m.statut === "proposee" && (
        <button className="tb-bouton" disabled={bloque} onClick={accepter}>{bloque ? "Règle d'abord ton compte" : "✓ J'accepte cette course"}</button>
      )}
      {m.statut === "acceptee" && (
        <>
          <div className="tb-actions" style={{ flexWrap: "wrap" }}>
            {waze(m.depart) && <a className="tb-bouton tb-clair" href={waze(m.depart)} target="_blank" rel="noopener noreferrer">Waze récupération</a>}
            {waze(m.arrivee) && <a className="tb-bouton tb-clair" href={waze(m.arrivee)} target="_blank" rel="noopener noreferrer">Waze livraison</a>}
            {m.telDestinataire && <a className="tb-bouton tb-clair" href={lienWhatsApp(m.telDestinataire, `Bonjour ${m.destinataire || ""}, c'est ${prenom}, coursier de ${NOM} : j'arrive avec votre livraison.`)} target="_blank" rel="noopener noreferrer">WhatsApp destinataire</a>}
            {m.telClient && <a className="tb-bouton tb-clair" href={lienWhatsApp(m.telClient, `Bonjour ${m.client || ""}, c'est ${prenom}, coursier de ${NOM}, pour votre course.`)} target="_blank" rel="noopener noreferrer">WhatsApp client</a>}
          </div>
          {etape === "partie" && <button className="tb-bouton" onClick={() => noter("partieLe")}>🛵 Je pars</button>}
          {etape === "recuperee" && <button className="tb-bouton" onClick={() => noter("recupereeLe")}>📦 Colis récupéré</button>}
          {etape === "livree" && !fin && <button className="tb-bouton" onClick={() => setFin(true)}>✓ Livré</button>}
          {etape === "livree" && fin && <Terminer m={m} onFini={() => setFin(false)} />}
        </>
      )}
      {m.statut === "terminee" && <p className="cc-gris">✓ Terminée{m.pourboire ? ` · pourboire ${m.pourboire} ₪` : ""}</p>}
      {info && <p className="tb-note" role="alert">{info}</p>}
    </div>
  );
}

export default function EspaceCoursier({ uid, fiche, deconnecter }) {
  const [onglet, setOnglet] = useState("courses");
  const [proposees, setProposees] = useState([]);
  const [miennes, setMiennes] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [erreur, setErreur] = useState("");
  const [reglages, setReglages] = useState({});
  useEffect(() => onSnapshot(doc(db, "reglages", "coursiers"), (s) => setReglages(s.exists() ? s.data() : {}), () => {}), []);
  useEffect(() => {
    const echec = () => setErreur("Lecture impossible pour l'instant. Recharge la page.");
    const a = onSnapshot(query(collection(db, "missionsCoursiers"), where("proposeeA", "array-contains", uid)), (s) => setProposees(s.docs.map((d) => ({ id: d.id, ...d.data() }))), echec);
    const b = onSnapshot(query(collection(db, "missionsCoursiers"), where("coursier", "==", uid)), (s) => setMiennes(s.docs.map((d) => ({ id: d.id, ...d.data() }))), echec);
    const c = onSnapshot(query(collection(db, "reglementsCoursiers"), where("coursier", "==", uid)), (s) => setReglements(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return () => { a(); b(); c(); };
  }, [uid]);

  const solde = useMemo(() => soldeCumule(miennes, reglements), [miennes, reglements]);
  const bloque = estBloque(solde, reglages);
  const aProposer = proposees.filter((m) => m.statut === "proposee").sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`));
  const enCours = miennes.filter((m) => m.statut === "acceptee").sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`));
  const finies = miennes.filter((m) => m.statut === "terminee").sort((a, b) => `${b.date}${b.heure}`.localeCompare(`${a.date}${a.heure}`)).slice(0, 10);
  const dispo = fiche.disponible === true;
  const basculer = () => updateDoc(doc(db, "coursiers", uid), { disponible: !dispo, majLe: serverTimestamp() }).catch(() => setErreur("Enregistrement impossible."));

  return (
    <div className="admin admin-tableau theme-sombre">
      <header className="ts-entete">
        <span className="ts-titre">Espace coursier · {fiche.prenom}</span>
      </header>
      <main className="ts-contenu" style={{ padding: 16 }}>
        <button className={"tb-bouton" + (dispo ? "" : " tb-clair")} style={{ width: "100%", padding: 14, fontSize: 17 }} onClick={basculer}>
          {dispo ? "🟢 Disponible · toucher pour me mettre indisponible" : "⚪ Indisponible · toucher pour recevoir des courses"}
        </button>
        {bloque && <p className="tb-note" role="alert" style={{ marginTop: 10 }}>Tu dois {Math.abs(solde)} ₪ à Rebecca Services : règle-les pour recevoir de nouvelles courses.</p>}
        {erreur && <p className="tb-note" role="alert">{erreur}</p>}
        <div className="tb-filtres" style={{ margin: "12px 0" }}>
          {ONGLETS.map((o) => (
            <button key={o.id} className={"tb-filtre" + (onglet === o.id ? " actif" : "")} onClick={() => setOnglet(o.id)}>
              {o.label}{o.id === "courses" && aProposer.length ? ` (${aProposer.length})` : ""}
            </button>
          ))}
        </div>
        {onglet === "courses" && (
          <div className="cc">
            <h3>Courses proposées</h3>
            {aProposer.length === 0 && <p className="cc-gris">Aucune course proposée pour l'instant.</p>}
            {aProposer.map((m) => <Mission key={m.id} m={m} uid={uid} bloque={bloque} prenom={fiche.prenom} />)}
            <h3>En cours</h3>
            {enCours.length === 0 && <p className="cc-gris">Aucune course en cours.</p>}
            {enCours.map((m) => <Mission key={m.id} m={m} uid={uid} bloque={bloque} prenom={fiche.prenom} />)}
            {finies.length > 0 && <h3>Dernières courses terminées</h3>}
            {finies.map((m) => <Mission key={m.id} m={m} uid={uid} bloque={bloque} prenom={fiche.prenom} />)}
          </div>
        )}
        {onglet === "compte" && <CompteCoursier nom={fiche.prenom} courses={miennes.map(courseDeMission)} reglements={reglements} />}
        {onglet === "reglement" && (
          <div className="cc-bloc">
            <h3>Règlement des coursiers</h3>
            <ul>{REGLEMENT_COURSIERS.map((r) => <li key={r} style={{ marginBottom: 6 }}>{r}</li>)}</ul>
          </div>
        )}
        <div className="tb-actions" style={{ marginTop: 20 }}>
          <a className="tb-bouton tb-clair" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${fiche.prenom} (coursier).`)} target="_blank" rel="noopener noreferrer">WhatsApp Rebecca</a>
          <button className="tb-bouton tb-clair" onClick={deconnecter}>Se déconnecter</button>
        </div>
      </main>
    </div>
  );
}
