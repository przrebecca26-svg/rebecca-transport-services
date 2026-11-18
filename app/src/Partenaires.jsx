import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { OSEK, STATUTS_CANDIDATURE, VEHICULE_UNIQUE, docsPour, libelleCandidature, lienSuiviPartenaire, messageDecision, resumeCandidature, statutDe } from "./pricing/partenaires.js";
import { STATUTS_CANDIDATURE as REGLES_STATUTS, decision, reglagesCommission, soldeCumule, courseDeMission, estBloque, lienAccesCoursier } from "./pricing/coursiers.js";
import CompteCoursier from "./components/CompteCoursier.jsx";

// PARTENAIRES (17 nov. 2026 ; validation complète le 18 nov., étape 2 des coursiers partenaires) - Rebecca seule.
// Candidatures des coursiers : documents (photos), décisions datées (en vérification, complément demandé avec
// les documents à refaire, approuvé, refusé, suspendu), message WhatsApp prêt, lien de suivi du coursier.
const quand = (t) => (t && t.toDate ? t.toDate().toLocaleDateString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
const quandIso = (t) => (t ? new Date(t).toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const lib = (liste, v) => (liste.find((x) => x.v === v) || { l: v || "—" }).l;
const A_TRAITER = ["soumis", "en_verification", "complement_demande"];
const BOUTONS = { en_verification: "Je vérifie", complement_demande: "Demander un complément", approuve: "✓ Approuver", refuse: "Refuser", suspendu: "Suspendre", soumis: "Remettre en « Envoyée »" };

function Documents({ c }) {
  const [docs, setDocs] = useState(null);
  const [grand, setGrand] = useState("");
  useEffect(() => {
    getDocs(query(collection(db, "documentsPartenaires"), where("candidature", "==", c.id)))
      .then((s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? 1 : -1))))
      .catch(() => setDocs([]));
  }, [c.id, c.majLe]);
  if (docs === null) return <p className="tb-note">Chargement des documents…</p>;
  const attendus = docsPour((c.vehicules || [])[0]);
  if (!docs.length) return <p className="tb-note">Aucun document {c.version === 2 ? "(vérifie les règles Firebase v20)" : "(ancienne candidature, sans documents)"}.</p>;
  return (
    <div>
      {attendus.map((a) => {
        const versions = docs.filter((d) => d.type === a.id);
        const d = versions[0];
        return (
          <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0" }}>
            {d ? <img src={d.image} alt={a.label} onClick={() => setGrand(grand === d.id ? "" : d.id)} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} /> : <span style={{ width: 56 }}>❌</span>}
            <span className="tb-note">{a.label}{versions.length > 1 ? ` · ${versions.length} versions (la plus récente)` : ""}</span>
          </div>
        );
      })}
      {grand && <img src={(docs.find((d) => d.id === grand) || {}).image} alt="" onClick={() => setGrand("")} style={{ width: "100%", borderRadius: 12, marginTop: 8 }} />}
      {grand && <p className="tb-note">Touche la photo pour la fermer.</p>}
    </div>
  );
}

function Candidature({ c, suivi, setInfo }) {
  const [ouvert, setOuvert] = useState(false);
  const [vers, setVers] = useState("");
  const [motif, setMotif] = useState("");
  const [aRefaire, setARefaire] = useState([]);
  const [message, setMessage] = useState("");
  const renvoye = statutDe(c) === "complement_demande" && suivi && suivi.statut === "soumis";
  const actuel = renvoye ? "soumis" : statutDe(c);
  const possibles = (REGLES_STATUTS[actuel] || { suivants: [] }).suivants;
  const vehicule = (c.vehicules || [])[0];
  const site = window.location.origin.startsWith("http") ? window.location.origin : undefined;

  const valider = async () => {
    let texteMotif = motif.trim();
    if (vers === "complement_demande") {
      if (!aRefaire.length && texteMotif.length < 3) return setInfo("Coche les documents à refaire ou écris ce qui manque.");
      const noms = docsPour(vehicule).filter((d) => aRefaire.includes(d.id)).map((d) => d.label);
      if (texteMotif.length < 3) texteMotif = "Documents à renvoyer : " + noms.join(", ") + ".";
    }
    const r = decision({ ...c, statut: actuel }, vers, texteMotif);
    if (r.erreur) return setInfo(r.erreur);
    try {
      await updateDoc(doc(db, "candidaturesPartenaires", c.id), { statut: r.statut, historique: r.historique, majLe: serverTimestamp() });
      await setDoc(doc(db, "suiviPartenaires", c.id), {
        statut: r.statut,
        prenom: c.prenom,
        motif: vers === "approuve" || vers === "en_verification" ? "" : texteMotif,
        documentsDemandes: vers === "complement_demande" ? docsPour(vehicule).filter((d) => aRefaire.includes(d.id)) : [],
        majLe: serverTimestamp(),
      }, { merge: true });
      setMessage(messageDecision(c, vers, texteMotif, site));
      setVers("");
      setMotif("");
      setARefaire([]);
      setInfo("");
    } catch {
      setInfo("Enregistrement impossible : vérifie la connexion et les règles Firebase v20.");
    }
  };
  const supprimer = async () => {
    try {
      const s = await getDocs(query(collection(db, "documentsPartenaires"), where("candidature", "==", c.id)));
      await Promise.all(s.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "suiviPartenaires", c.id)).catch(() => {});
      await deleteDoc(doc(db, "candidaturesPartenaires", c.id));
    } catch {
      setInfo("Suppression impossible.");
    }
  };
  const note = (texte) => updateDoc(doc(db, "candidaturesPartenaires", c.id), { note: texte.slice(0, 1000), majLe: serverTimestamp() }).catch(() => {});

  return (
    <div style={{ borderTop: "1px solid var(--g-bord, #3a3236)", padding: "10px 0" }}>
      <button className="tb-carte" style={{ width: "100%" }} onClick={() => setOuvert(!ouvert)}>
        <span className="tb-ligne"><strong>{c.prenom} {c.nom}</strong><span className="tb-badge tb-attente">{libelleCandidature(c.statut)}</span></span>
        <span className="tb-quand">{lib(VEHICULE_UNIQUE, vehicule)} · {quand(c.creeLe)}{renvoye ? " · 📎 documents renvoyés" : ""}</span>
      </button>
      {ouvert && (
        <div className="tb-detail">
          {c.version === 2 ? (
            <p className="tb-note" style={{ whiteSpace: "pre-line" }}>
              {`${c.ville}${c.zones ? ` (zones : ${c.zones})` : ""}\nServices : ${(c.services || []).join(", ")}\nJours : ${(c.jours || []).join(", ")}${c.dispos ? ` · ${c.dispos}` : ""}\n${lib(OSEK, c.osek)} · à verser : ${c.paiement}${c.experience ? `\nExpérience : ${c.experience}` : ""}${c.message ? `\nMessage : ${c.message}` : ""}\nRèglement des coursiers accepté ✓`}
            </p>
          ) : (
            <p className="tb-note" style={{ whiteSpace: "pre-line" }}>{resumeCandidature(c)}</p>
          )}
          <p className="tb-note"><a href={`tel:${c.telephone}`}>{c.telephone}</a> · <a href={`mailto:${c.email}`}>{c.email}</a></p>
          <h4>Documents</h4>
          <Documents c={c} />

          <h4>Décision</h4>
          <div className="tb-actions" style={{ flexWrap: "wrap" }}>
            {possibles.map((p) => (
              <button key={p} className={"tb-bouton" + (vers === p ? "" : " tb-clair") + (p === "refuse" || p === "suspendu" ? " tb-danger" : "")} onClick={() => setVers(vers === p ? "" : p)}>{BOUTONS[p] || p}</button>
            ))}
          </div>
          {vers === "complement_demande" && (
            <div>
              <p className="tb-note">Documents à refaire :</p>
              {docsPour(vehicule).map((d) => (
                <label key={d.id} className="rg-case">
                  <input type="checkbox" checked={aRefaire.includes(d.id)} onChange={() => setARefaire((x) => (x.includes(d.id) ? x.filter((y) => y !== d.id) : [...x, d.id]))} />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          )}
          {vers && vers !== "approuve" && vers !== "en_verification" && vers !== "soumis" && (
            <label className="pm-champ">Motif (visible par le coursier)
              <textarea rows={2} value={motif} maxLength={300} onChange={(e) => setMotif(e.target.value)} placeholder={vers === "complement_demande" ? "Ex. la photo du permis est floue" : ""} />
            </label>
          )}
          {vers && <button className="tb-bouton" onClick={valider}>Enregistrer : {libelleCandidature(vers)}</button>}
          {message && (
            <a className="tb-bouton" href={lienWhatsApp(c.telephone, message)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8 }}>Envoyer le message WhatsApp</a>
          )}
          {statutDe(c) === "approuve" && <p className="tb-note">Approuvé : son lien d'accès (dans le message WhatsApp) est <a href={lienAccesCoursier(c.id, site)}>{lienAccesCoursier(c.id, site)}</a>. Il se connecte, lie son compte, puis tu l'actives dans « Coursiers » plus haut.</p>}

          {(c.historique || []).length > 0 && (
            <>
              <h4>Historique</h4>
              {(c.historique || []).map((h, i) => (
                <p key={i} className="tb-note">{quandIso(h.le)} · {libelleCandidature(h.de)} → <strong>{libelleCandidature(h.vers)}</strong>{h.motif ? ` · ${h.motif}` : ""}</p>
              ))}
            </>
          )}
          <p className="tb-note">Lien de suivi du coursier : <a href={lienSuiviPartenaire(c.id, site)} target="_blank" rel="noopener noreferrer">{lienSuiviPartenaire(c.id, site)}</a></p>
          <label className="pm-champ">Note privée
            <textarea rows={2} defaultValue={c.note || ""} onBlur={(e) => note(e.target.value)} />
          </label>
          <div className="tb-actions">
            <a className="tb-bouton tb-clair" href={lienWhatsApp(c.telephone, `Bonjour ${c.prenom}, c'est Rebecca (Rebecca Services). Merci pour ta candidature !`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <SupprimerEnDeux onOui={supprimer} />
          </div>
        </div>
      )}
    </div>
  );
}

function SupprimerEnDeux({ onOui }) {
  const [sur, setSur] = useState(false);
  if (!sur) return <button className="tb-bouton tb-danger" onClick={() => setSur(true)}>Supprimer</button>;
  return (
    <>
      <button className="tb-bouton tb-danger" onClick={onOui}>Oui, supprimer tout</button>
      <button className="tb-bouton tb-clair" onClick={() => setSur(false)}>Annuler</button>
    </>
  );
}

// 18 nov. 2026 (étape 3) : coursiers liés à leur compte -> activation, disponibilité, compte, versements
function Versement({ k, setInfo }) {
  const [sens, setSens] = useState("vers_coursier");
  const [montant, setMontant] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const noter = async () => {
    const n = Number(String(montant).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return setInfo("Montant invalide.");
    try {
      await addDoc(collection(db, "reglementsCoursiers"), { coursier: k.id, sens, montant: Math.round(n * 100) / 100, date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), creeLe: serverTimestamp() });
      setMontant("");
      setOuvert(false);
      setInfo("Versement noté ✓");
    } catch {
      setInfo("Enregistrement impossible (règles Firebase v21 ?).");
    }
  };
  if (!ouvert) return <button className="tb-bouton tb-clair" onClick={() => setOuvert(true)}>💸 Noter un versement</button>;
  return (
    <div className="tb-bloc">
      <div className="tb-actions">
        <button className={"tb-bouton" + (sens === "vers_coursier" ? "" : " tb-clair")} onClick={() => setSens("vers_coursier")}>Je lui ai versé</button>
        <button className={"tb-bouton" + (sens === "vers_rebecca" ? "" : " tb-clair")} onClick={() => setSens("vers_rebecca")}>Il m'a payé</button>
      </div>
      <label className="pm-champ">Montant (₪)<input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} /></label>
      <div className="tb-actions"><button className="tb-bouton" onClick={noter}>Enregistrer</button><button className="tb-bouton tb-clair" onClick={() => setOuvert(false)}>Annuler</button></div>
    </div>
  );
}

function Coursiers({ candidatures, setInfo }) {
  const [coursiers, setCoursiers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [reglages, setReglages] = useState({});
  const [ouvert, setOuvert] = useState("");
  const [voirTaux, setVoirTaux] = useState(false);
  const [taux, setTaux] = useState(null);
  useEffect(() => {
    const a = onSnapshot(collection(db, "coursiers"), (s) => setCoursiers(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    const b = onSnapshot(collection(db, "missionsCoursiers"), (s) => setMissions(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    const c = onSnapshot(collection(db, "reglementsCoursiers"), (s) => setReglements(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    const e = onSnapshot(doc(db, "reglages", "coursiers"), (s) => setReglages(s.exists() ? s.data() : {}), () => {});
    return () => { a(); b(); c(); e(); };
  }, []);
  const r = reglagesCommission(reglages);
  const activer = async (k) => {
    const cand = candidatures.find((c) => c.id === k.candidature) || {};
    try {
      await updateDoc(doc(db, "coursiers", k.id), { statut: "actif", prenom: cand.prenom || k.prenom || "", nom: cand.nom || "", telephone: cand.telephone || "", activeLe: serverTimestamp(), majLe: serverTimestamp() });
    } catch {
      setInfo("Activation impossible (règles Firebase v21 ?).");
    }
  };
  const statut = (k, st) => updateDoc(doc(db, "coursiers", k.id), { statut: st, disponible: false, majLe: serverTimestamp() }).catch(() => setInfo("Enregistrement impossible."));
  const enregistrerTaux = async () => {
    const t = taux || {};
    const propre = reglagesCommission({ normale: { taux: t.nt, minimum: t.nm }, commercant: { taux: t.ct, minimum: t.cm }, plafondDette: t.pd });
    try {
      await setDoc(doc(db, "reglages", "coursiers"), { ...propre, majLe: serverTimestamp() });
      setVoirTaux(false);
      setInfo("Commissions enregistrées ✓ (les courses déjà proposées gardent leur commission).");
    } catch {
      setInfo("Enregistrement impossible.");
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Coursiers ({coursiers.filter((k) => k.statut === "actif").length} actifs)</h3>
      {coursiers.length === 0 && <p className="tb-note">Aucun coursier lié pour l'instant. Quand tu approuves une candidature, le message WhatsApp contient son lien d'accès : il se connecte, touche « Lier mon compte coursier », puis tu l'actives ici.</p>}
      {coursiers.map((k) => {
        const ms = missions.filter((m) => m.coursier === k.id);
        const rs = reglements.filter((x) => x.coursier === k.id);
        const solde = soldeCumule(ms, rs);
        return (
          <div key={k.id} style={{ borderTop: "1px solid var(--g-bord, #3a3236)", padding: "10px 0" }}>
            <button className="tb-carte" style={{ width: "100%" }} onClick={() => setOuvert(ouvert === k.id ? "" : k.id)}>
              <span className="tb-ligne"><strong>{k.prenom} {k.nom || ""}</strong><span className="tb-badge tb-attente">{k.statut === "actif" ? (k.disponible ? "🟢 Disponible" : "⚪ Indisponible") : k.statut === "a_activer" ? "À activer" : "Suspendu"}</span></span>
              <span className="tb-quand">{ms.filter((m) => m.statut === "terminee").length} courses · {solde > 0 ? `tu lui dois ${solde} ₪` : solde < 0 ? `il te doit ${-solde} ₪${estBloque(solde, reglages) ? " (bloqué)" : ""}` : "à jour"}</span>
            </button>
            {ouvert === k.id && (
              <div>
                <p className="tb-note">{k.email}{k.telephone ? ` · ${k.telephone}` : ""}</p>
                <div className="tb-actions" style={{ flexWrap: "wrap" }}>
                  {k.statut === "a_activer" && <button className="tb-bouton" onClick={() => activer(k)}>✓ Activer son espace</button>}
                  {k.statut === "actif" && <button className="tb-bouton tb-danger" onClick={() => statut(k, "suspendu")}>Suspendre</button>}
                  {k.statut === "suspendu" && <button className="tb-bouton" onClick={() => statut(k, "actif")}>Réactiver</button>}
                  {k.statut === "actif" && <Versement k={k} setInfo={setInfo} />}
                </div>
                {k.statut !== "a_activer" && <CompteCoursier vueAdmin nom={k.prenom} telephone={k.telephone} courses={ms.map(courseDeMission)} reglements={rs} />}
              </div>
            )}
          </div>
        );
      })}
      <button className="lien" onClick={() => { setVoirTaux(!voirTaux); setTaux({ nt: r.normale.taux, nm: r.normale.minimum, ct: r.commercant.taux, cm: r.commercant.minimum, pd: r.plafondDette }); }}>
        Commissions : {r.normale.taux} % (min {r.normale.minimum} ₪) · commerçant apporté {r.commercant.taux} % (min {r.commercant.minimum} ₪) · blocage au-delà de {r.plafondDette} ₪ dus — modifier
      </button>
      {voirTaux && taux && (
        <div className="tb-bloc">
          {[["nt", "Commission (%)"], ["nm", "Minimum (₪)"], ["ct", "Commerçant apporté (%)"], ["cm", "Minimum commerçant (₪)"], ["pd", "Blocage si dette au-delà de (₪)"]].map(([cle, l]) => (
            <label key={cle} className="pm-champ">{l}<input inputMode="decimal" value={taux[cle]} onChange={(e) => setTaux({ ...taux, [cle]: e.target.value })} /></label>
          ))}
          <button className="tb-bouton" onClick={enregistrerTaux}>Enregistrer</button>
        </div>
      )}
      <p className="tb-note">Pour confier une course : ouvre une livraison ou des courses acceptée dans « Demandes », bloc « 🛵 Coursier partenaire ».</p>
    </div>
  );
}

export default function Partenaires({ aller }) {
  const [liste, setListe] = useState(null);
  const [suivis, setSuivis] = useState({});
  const [ouvert, setOuvert] = useState(false);
  const [info, setInfo] = useState("");
  const [filtre, setFiltre] = useState("traiter");
  useEffect(() => onSnapshot(query(collection(db, "candidaturesPartenaires"), orderBy("creeLe", "desc")), (s) => setListe(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => { setListe([]); setInfo("Lecture impossible : as-tu collé les règles Firebase v20 ?"); }), []);
  useEffect(() => onSnapshot(collection(db, "suiviPartenaires"), (s) => setSuivis(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))), () => {}), []);
  useEffect(() => onSnapshot(doc(db, "reglages", "partenaires"), (s) => setOuvert(s.exists() && s.data().ouvert === true), () => {}), []);

  const basculer = () => setDoc(doc(db, "reglages", "partenaires"), { ouvert: !ouvert, majLe: serverTimestamp() }, { merge: true }).catch(() => setInfo("Enregistrement impossible."));

  if (!liste) return <p className="admin-texte tb-pad">Chargement…</p>;
  const compter = (f) => liste.filter((c) => f(statutDe(c))).length;
  const FILTRES = [
    ["traiter", "À traiter", (s) => A_TRAITER.includes(s)],
    ["approuve", "Approuvés", (s) => s === "approuve"],
    ["autres", "Refusés / suspendus", (s) => s === "refuse" || s === "suspendu"],
    ["toutes", "Toutes", () => true],
  ];
  const ftr = FILTRES.find((x) => x[0] === filtre) || FILTRES[0];
  const vues = liste.filter((c) => ftr[2](statutDe(c)));
  return (
    <section className="tb-pad">
      <div className="tb-bloc">
        <h3>Devenir coursier partenaire</h3>
        <p className="tb-note">Page d'inscription : <a href="#/partenaire" target="_blank" rel="noopener noreferrer">ouvrir la page</a> (lien direct : rebecca-services-netanya.netlify.app/#/partenaire). Seulement livraisons et courses.</p>
        <label className="rg-case">
          <input type="checkbox" checked={ouvert} onChange={basculer} />
          <span>{ouvert ? "Visible sur le site (lien en bas de page)" : "Cachée : aucun lien sur le site (tu peux la tester avec le lien direct)"}</span>
        </label>
      </div>
      <Coursiers candidatures={liste} setInfo={setInfo} />
      <div className="tb-bloc">
        <h3>Candidatures ({liste.length})</h3>
        <div className="tb-filtres" style={{ flexWrap: "wrap" }}>
          {FILTRES.map(([v, l, f]) => (
            <button key={v} className={"tb-filtre" + (filtre === v ? " actif" : "")} onClick={() => setFiltre(v)}>{l} <span>{compter(f)}</span></button>
          ))}
        </div>
        {vues.length === 0 && <p className="tb-note">Aucune candidature ici.</p>}
        {vues.map((c) => <Candidature key={c.id} c={c} suivi={suivis[c.id]} setInfo={setInfo} />)}
        {info && <p className="tb-note" role="alert">{info}</p>}
        <p className="tb-note">Statuts : {STATUTS_CANDIDATURE.map((s) => s.l).join(" · ")}. Chaque décision est datée dans l'historique.</p>
      </div>
    </section>
  );
}
