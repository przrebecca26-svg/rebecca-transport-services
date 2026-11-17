import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { STATUTS_CANDIDATURE, libelleCandidature, messageAcceptation, resumeCandidature } from "./pricing/partenaires.js";

// PARTENAIRES (17 nov. 2026) - Rebecca seule. Candidatures des futurs coursiers venues de la page #/partenaire,
// et l'interrupteur qui montre (ou cache) le lien « Devenir partenaire » sur le site.
// Une candidature acceptee : le coursier se connecte sur /#/admin, puis Rebecca l'active dans la rubrique Equipe
// (services coches, vehicules, plafond) exactement comme Jeremy.
const quand = (t) => (t && t.toDate ? t.toDate().toLocaleDateString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit" }) : "");

export default function Partenaires({ aller }) {
  const [liste, setListe] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [info, setInfo] = useState("");
  const [filtre, setFiltre] = useState("actives");
  useEffect(() => onSnapshot(query(collection(db, "candidaturesPartenaires"), orderBy("creeLe", "desc")), (s) => setListe(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => { setListe([]); setInfo("Lecture impossible : as-tu collé les règles Firebase v19 ?"); }), []);
  useEffect(() => onSnapshot(doc(db, "reglages", "partenaires"), (s) => setOuvert(s.exists() && s.data().ouvert === true), () => {}), []);

  const basculer = () => setDoc(doc(db, "reglages", "partenaires"), { ouvert: !ouvert, majLe: serverTimestamp() }, { merge: true }).catch(() => setInfo("Enregistrement impossible."));
  const statut = (c, s) => updateDoc(doc(db, "candidaturesPartenaires", c.id), { statut: s, majLe: serverTimestamp() }).catch(() => setInfo("Enregistrement impossible."));
  const note = (c, texte) => updateDoc(doc(db, "candidaturesPartenaires", c.id), { note: texte.slice(0, 1000), majLe: serverTimestamp() }).catch(() => {});

  if (!liste) return <p className="admin-texte tb-pad">Chargement…</p>;
  const vues = liste.filter((c) => filtre === "toutes" || !["refusee"].includes(c.statut));
  return (
    <section className="tb-pad">
      <div className="tb-bloc">
        <h3>Devenir partenaire</h3>
        <p className="tb-note">Page d'inscription des coursiers : <a href="#/partenaire" target="_blank" rel="noopener noreferrer">ouvrir la page</a> (lien direct : rebecca-services-netanya.netlify.app/#/partenaire).</p>
        <label className="rg-case">
          <input type="checkbox" checked={ouvert} onChange={basculer} />
          <span>{ouvert ? "Visible sur le site (lien en bas de page)" : "Cachée : aucun lien sur le site (tu peux la tester avec le lien direct)"}</span>
        </label>
        <p className="tb-note">Une candidature acceptée : envoie-lui le message d'accès, il se connecte sur l'espace privé, puis tu l'actives dans <button className="lien" onClick={() => aller && aller("equipe")}>Équipe</button> avec ses services et ses véhicules, comme Jérémy.</p>
      </div>
      <div className="tb-bloc">
        <h3>Candidatures ({liste.length})</h3>
        <div className="tb-filtres">
          {[["actives", "À traiter et acceptées"], ["toutes", "Toutes"]].map(([v, l]) => (
            <button key={v} className={"tb-bouton" + (filtre === v ? "" : " tb-clair")} onClick={() => setFiltre(v)}>{l}</button>
          ))}
        </div>
        {vues.length === 0 && <p className="tb-note">Aucune candidature pour l'instant.</p>}
        {vues.map((c) => (
          <div key={c.id} className="tb-detail" style={{ borderTop: "1px solid var(--g-bord, #3a3236)", padding: "10px 0" }}>
            <p><strong>{c.prenom} {c.nom}</strong> · {libelleCandidature(c.statut)} · {quand(c.creeLe)}</p>
            <p className="tb-note" style={{ whiteSpace: "pre-line" }}>{resumeCandidature(c)}</p>
            <p className="tb-note"><a href={`tel:${c.telephone}`}>{c.telephone}</a> · <a href={`mailto:${c.email}`}>{c.email}</a></p>
            <label className="pm-champ">Statut
              <select value={c.statut} onChange={(e) => statut(c, e.target.value)}>
                {STATUTS_CANDIDATURE.map((s) => <option key={s.id} value={s.id}>{s.l}</option>)}
              </select>
            </label>
            <label className="pm-champ">Note privée
              <textarea rows={2} defaultValue={c.note || ""} onBlur={(e) => note(c, e.target.value)} />
            </label>
            <div className="tb-actions">
              <a className="tb-bouton" href={lienWhatsApp(c.telephone, `Bonjour ${c.prenom}, c'est Rebecca (Rebecca Services). Merci pour ta candidature ! Quand peut-on se parler ?`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              {c.statut === "acceptee" && <a className="tb-bouton tb-clair" href={lienWhatsApp(c.telephone, messageAcceptation(c))} target="_blank" rel="noopener noreferrer">Envoyer l'accès</a>}
              <button className="tb-bouton tb-danger" onClick={() => deleteDoc(doc(db, "candidaturesPartenaires", c.id)).catch(() => setInfo("Suppression impossible."))}>Supprimer</button>
            </div>
          </div>
        ))}
        {info && <p className="tb-note">{info}</p>}
      </div>
    </section>
  );
}
