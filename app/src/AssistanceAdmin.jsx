import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { SITE } from "./site.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { envoyerEmailA } from "./mailClient.js";
import { STATUTS_ASSISTANCE, emailReponse, libelleStatut, lienConversation, messagePropre } from "./pricing/assistance.js";

// ASSISTANCE - boîte de réception de Rebecca (19 nov. 2026, étape 1 sans IA). Rebecca seule.
// Chaque conversation : le sujet choisi, la réservation liée, les messages ; Rebecca répond (le client voit la
// réponse sur sa page et la reçoit par e-mail s'il a donné son adresse) et change le statut.
const quand = (t) => (t && t.toDate ? t.toDate().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
const FILTRES = [
  ["ouvertes", "À traiter", (c) => c.statut !== "resolue"],
  ["urgentes", "Urgentes", (c) => c.statut !== "resolue" && c.urgence === "haute"],
  ["resolues", "Résolues", (c) => c.statut === "resolue"],
  ["toutes", "Toutes", () => true],
];

export function useConversations(actif = true) {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    if (!actif) return undefined;
    return onSnapshot(collection(db, "assistance"), (s) => setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.majLe) - ms(a.majLe))), () => setListe([]));
  }, [actif]);
  return liste;
}

function Fil({ c, retour }) {
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => onSnapshot(query(collection(db, "assistance", c.id, "messages"), orderBy("creeLe")), (s) => setMessages(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {}), [c.id]);
  useEffect(() => {
    if (c.aLire) updateDoc(doc(db, "assistance", c.id), { aLire: false }).catch(() => {});
  }, [c.id, c.aLire]);
  const statut = (v) => updateDoc(doc(db, "assistance", c.id), { statut: v, majLe: serverTimestamp() }).catch(() => setInfo("Changement impossible (règles v31 ?)."));
  const repondre = async () => {
    const t = texte.trim();
    if (!t) return;
    setEnCours(true);
    setInfo("");
    try {
      await addDoc(collection(db, "assistance", c.id, "messages"), { ...messagePropre("rebecca", t), creeLe: serverTimestamp() });
      await updateDoc(doc(db, "assistance", c.id), { dernierDe: "rebecca", aLire: false, statut: c.statut === "nouvelle" ? "en_cours" : c.statut, majLe: serverTimestamp() });
      setTexte("");
      if (c.email) {
        const ok = await envoyerEmailA(c.email, c.nom, `Réponse de Rebecca Services · ${c.titre}`.slice(0, 150), emailReponse(c, t, lienConversation(c.id, SITE)));
        setInfo(ok ? "✓ Réponse envoyée (et par e-mail)." : "✓ Réponse envoyée. L'e-mail n'est pas parti : préviens-le sur WhatsApp.");
      } else setInfo("✓ Réponse envoyée. Pas d'e-mail : préviens-le sur WhatsApp avec le lien.");
    } catch {
      setInfo("Envoi impossible pour l'instant (règles v31 ?).");
    }
    setEnCours(false);
  };
  const lien = lienConversation(c.id, SITE);
  return (
    <div className="tb-bloc">
      <button type="button" className="tb-bouton tb-clair" onClick={retour}>← Toutes les conversations</button>
      <h3>{c.urgence === "haute" ? "🔴 " : ""}{c.titre}</h3>
      <p className="tb-note">{c.nom} · {c.telephone}{c.email ? ` · ${c.email}` : ""} · {c.source === "resto" ? "restaurant partenaire" : c.uid ? "compte client" : "sans compte"} · {quand(c.creeLe)}</p>
      {c.resume && <p className="tb-note">📋 {c.resume}</p>}
      {c.ferme && <p className="tb-note">🕯️ Envoyée pendant une fermeture (Chabbat ou fête).</p>}
      <div className="tb-filtres" style={{ flexWrap: "wrap" }}>
        {STATUTS_ASSISTANCE.map((s) => (
          <button key={s.v} type="button" className={"tb-filtre" + (c.statut === s.v ? " actif" : "")} onClick={() => statut(s.v)}>{s.l}</button>
        ))}
      </div>
      {messages.map((m) => (
        <div key={m.id} className="rp-correction" style={{ marginLeft: m.de === "rebecca" ? 30 : 0, marginRight: m.de === "rebecca" ? 0 : 30 }}>
          <small className="tb-note">{m.de === "rebecca" ? "Toi" : c.nom} · {quand(m.creeLe)}</small>
          <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{m.texte}</p>
        </div>
      ))}
      <div className="champ"><label>Ta réponse<textarea rows={4} maxLength={2000} value={texte} onChange={(e) => setTexte(e.target.value)} /></label></div>
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={enCours} onClick={repondre}>{enCours ? "Envoi…" : "Répondre"}</button>
        {c.telephone && <a className="tb-bouton tb-clair" href={lienWhatsApp(c.telephone, `Bonjour ${c.nom}, Rebecca Services vous a répondu : ${lien}`)} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
        {c.telephone && <a className="tb-bouton tb-clair" href={`tel:${c.telephone}`}>📞 Appeler</a>}
      </div>
      {info && <p className="tdb-note" role="status">{info}</p>}
    </div>
  );
}

export default function AssistanceAdmin() {
  const liste = useConversations();
  const [filtre, setFiltre] = useState("ouvertes");
  const [ouverte, setOuverte] = useState("");
  if (!liste) return <p className="admin-texte tb-pad">Chargement…</p>;
  const c = liste.find((x) => x.id === ouverte);
  if (c) return <section className="tb-pad"><Fil c={c} retour={() => setOuverte("")} /></section>;
  const ftr = FILTRES.find((x) => x[0] === filtre) || FILTRES[0];
  const vues = liste.filter(ftr[2]).sort((a, b) => (b.urgence === "haute") - (a.urgence === "haute") || ms(b.majLe) - ms(a.majLe));
  return (
    <section className="tb-pad">
      <div className="tb-bloc">
        <h3>Assistance</h3>
        <p className="tb-note">Les messages des clients depuis le bouton « 💬 Assistance » du site et de l'espace restaurant. Lien à donner : {SITE.replace("https://", "")}/#/assistance</p>
        <div className="tb-filtres" style={{ flexWrap: "wrap" }}>
          {FILTRES.map(([v, l, f]) => (
            <button key={v} type="button" className={"tb-filtre" + (filtre === v ? " actif" : "")} onClick={() => setFiltre(v)}>{l} <span>{liste.filter(f).length}</span></button>
          ))}
        </div>
        {vues.length === 0 && <p className="tb-note">Aucune conversation ici.</p>}
        {vues.map((x) => (
          <button key={x.id} type="button" className="rp-correction" style={{ display: "block", width: "100%", textAlign: "left" }} onClick={() => setOuverte(x.id)}>
            <b>{x.aLire ? "● " : ""}{x.urgence === "haute" ? "🔴 " : ""}{x.nom}</b> <span className="tb-note">· {libelleStatut(x.statut)} · {quand(x.majLe)}</span>
            <br /><span className="tb-note">{x.titre}{x.dernierDe === "client" && x.statut !== "resolue" ? " · attend ta réponse" : ""}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
