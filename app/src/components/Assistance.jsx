import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";
import { useClient } from "../client.js";
import { SITE } from "../site.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { statutSuivi } from "../profil.js";
import { prochainesFermetures } from "../pricing/calendrier.js";
import {
  CATEGORIES, CLE_LOCALE, MESSAGES_FERMETURE, NON_DISPO, URGENCES_VITALES, ajouterConversationLocale, bandeauFermeture, conversationPropre,
  erreursAssistance, fermetureEnCours, formulaireAssistance, libelleStatut, messagePropre, sujetDe, sujetsDe, urgenceDe,
} from "../pricing/assistance.js";

// ASSISTANCE CLIENTS (19 nov. 2026, étape 1 sans IA) - #/assistance, #/assistance/resto/CLE, #/assistance/ID
const WHATSAPP = "972547380193";
const lireLocales = () => {
  try {
    const l = JSON.parse(window.localStorage.getItem(CLE_LOCALE) || "[]");
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
};
const garderLocale = (id, titre) => {
  try {
    window.localStorage.setItem(CLE_LOCALE, JSON.stringify(ajouterConversationLocale(lireLocales(), id, titre)));
  } catch {
    /* navigation privée */
  }
};
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");
const heureDe = (t) => (t && t.toDate ? t.toDate().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const ligne = (label, v) => (
  <p style={{ margin: "4px 0" }}><b>{label} :</b> {v || NON_DISPO}</p>
);

// Les demandes du client connecté (suivi) : les plus récentes d'abord
function useMesDemandes(uid) {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    if (!uid) {
      setListe(null);
      return;
    }
    getDocs(query(collection(db, "suivi"), where("uid", "==", uid)))
      .then((s) => setListe(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => `${b.date} ${b.heure}`.localeCompare(`${a.date} ${a.heure}`)).slice(0, 15)))
      .catch(() => setListe([]));
  }, [uid]);
  return liste;
}

function Prestation({ d, avecSuivi }) {
  const [gps, setGps] = useState(false);
  useEffect(() => {
    if (!avecSuivi) return;
    getDoc(doc(db, "positions", d.id)).then((s) => setGps(s.exists() && s.data().actif === true), () => setGps(false));
  }, [d.id, avecSuivi]);
  const prix = typeof d.prixFinal === "number" ? `${d.prixFinal} ₪ (confirmé)` : typeof d.prixEstime === "number" ? `${d.prixEstime} ₪ (estimation)` : d.surDevis ? "Sur devis" : "";
  return (
    <div className="carte-service" style={{ marginTop: 8 }}>
      {ligne("Prestation", d.serviceTitre)}
      {ligne("Date et heure", d.date ? `${jourFr(d.date)}${d.heure ? " à " + d.heure : ""}` : "")}
      {ligne("Statut", statutSuivi(d.statut).texte)}
      {avecSuivi && ligne("Avancement", d.avancement)}
      {avecSuivi && ligne("Arrivée estimée", d.arriveeEstimee)}
      {!avecSuivi && ligne("Prix", prix)}
      {avecSuivi && gps && <p><a className="bouton" href={`#/position/${d.id}`}>📍 Voir le suivi GPS</a></p>}
    </div>
  );
}

// Les vraies informations du client pour ce sujet
function Donnees({ sujet, demandes, connecte, choisie, setChoisie }) {
  if (sujet.donnees === "fermetures") {
    const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
    const liste = prochainesFermetures(jour, 3);
    return (
      <div className="carte-service" style={{ marginTop: 8 }}>
        <b>Prochaines fermetures</b>
        {liste.length ? liste.map((p) => <p key={p.debutUtc} style={{ margin: "4px 0" }}>{p.label} : du {jourFr(p.debut.date)} {p.debut.heure} au {jourFr(p.fin.date)} {p.fin.heure}</p>) : <p>{NON_DISPO}</p>}
      </div>
    );
  }
  if (!sujet.donnees) return null;
  if (!connecte) return <p className="note">Connectez-vous à votre compte pour voir vos réservations ici, ou écrivez directement à Rebecca.</p>;
  if (demandes === null) return <p className="note">Chargement de vos réservations…</p>;
  if (!demandes.length) return <p className="note">Aucune réservation trouvée sur votre compte.</p>;
  const d = demandes.find((x) => x.id === choisie) || demandes[0];
  return (
    <>
      {demandes.length > 1 && (
        <div className="champ"><label>Réservation concernée
          <select value={d.id} onChange={(e) => setChoisie(e.target.value)}>
            {demandes.map((x) => <option key={x.id} value={x.id}>{jourFr(x.date)} {x.heure} · {x.serviceTitre}</option>)}
          </select>
        </label></div>
      )}
      <Prestation key={d.id} d={d} avecSuivi={sujet.donnees === "suivi"} />
    </>
  );
}

function Formulaire({ sujet, client, demandes, choisie, resto, onCree }) {
  const [f, setF] = useState(() => formulaireAssistance(client.profil ? { ...client.profil, email: (client.user && client.user.email) || client.profil.email } : null));
  const [erreurs, setErreurs] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const demande = (demandes || []).find((x) => x.id === choisie) || (sujet.donnees && sujet.donnees !== "fermetures" && demandes && demandes[0]) || null;
  const envoyer = async () => {
    const e = erreursAssistance(f);
    setErreurs(e);
    if (e.length) return;
    setEnCours(true);
    try {
      const ferme = !!fermetureEnCours();
      const urgence = urgenceDe(sujet.id, { message: f.message, demande, urgentCoche: f.urgent, ferme });
      const resume = demande ? `${demande.serviceTitre || ""} ${jourFr(demande.date)} ${demande.heure || ""} · ${statutSuivi(demande.statut).texte}` : "";
      const ref = doc(collection(db, "assistance"));
      const lot = writeBatch(db);
      lot.set(ref, { ...conversationPropre(sujet.id, { ...f, demandeId: demande ? demande.id : "" }, { uid: client.user && client.user.uid ? client.user.uid : "", source: resto ? "resto" : "site", urgence, ferme, resume: resto ? `Restaurant (espace partenaire)${resume ? " · " + resume : ""}` : resume }), creeLe: serverTimestamp(), majLe: serverTimestamp() });
      lot.set(doc(collection(db, "assistance", ref.id, "messages")), { ...messagePropre("client", f.message), creeLe: serverTimestamp() });
      await lot.commit();
      fetch("/.netlify/functions/assistance", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ref.id }) }).catch(() => {});
      garderLocale(ref.id, sujet.question);
      onCree(ref.id);
    } catch {
      setErreurs(["L'envoi n'a pas marché. Vérifiez la connexion et réessayez, ou écrivez sur WhatsApp."]);
    }
    setEnCours(false);
  };
  return (
    <div className="carte-service" style={{ marginTop: 10 }}>
      <h3>Parler directement à Rebecca</h3>
      <div className="champ"><label>Votre nom<input type="text" maxLength={80} value={f.nom} onChange={(e) => maj("nom", e.target.value)} /></label></div>
      <div className="champ"><label>Téléphone<input type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} /></label></div>
      <div className="champ"><label>E-mail (facultatif : pour être prévenu de la réponse)<input type="email" inputMode="email" maxLength={120} value={f.email} onChange={(e) => maj("email", e.target.value)} /></label></div>
      <div className="champ"><label>Votre message<textarea rows={4} maxLength={2000} value={f.message} onChange={(e) => maj("message", e.target.value)} /></label></div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={f.urgent} onChange={(e) => maj("urgent", e.target.checked)} /> C'est urgent (prestation en cours ou dans moins d'une heure)
      </label>
      <p className="note">Ne communiquez jamais de mot de passe ni de code par message.</p>
      {erreurs.length > 0 && <ul role="alert">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <button type="button" className="bouton" disabled={enCours} onClick={envoyer}>{enCours ? "Envoi…" : "Envoyer à Rebecca"}</button>
    </div>
  );
}

function AccueilAssistance({ resto, onAccueil, ouvrir }) {
  const client = useClient();
  const uid = client.user && client.user.uid ? client.user.uid : "";
  const demandes = useMesDemandes(uid);
  const [cat, setCat] = useState("");
  const [sujetId, setSujetId] = useState("");
  const [resolu, setResolu] = useState(null); // null | true | false
  const [choisie, setChoisie] = useState("");
  const locales = lireLocales();
  const ferme = fermetureEnCours();
  const sujet = sujetDe(sujetId);
  const choisir = (id) => {
    setSujetId(id);
    const s = sujetDe(id);
    setResolu(s && s.toujours ? false : null);
    window.scrollTo(0, 0);
  };
  return (
    <section style={{ margin: 16 }}>
      <h2>💬 Assistance Rebecca Services</h2>
      {ferme && <p className="carte-service">🕯️ {MESSAGES_FERMETURE.general}</p>}

      {!sujet && (
        <>
          {locales.length > 0 && (
            <div className="carte-service">
              <b>Mes conversations</b>
              {locales.map((c) => <p key={c.id} style={{ margin: "4px 0" }}><a href={`#/assistance/${c.id}`}>{jourFr(c.le)} · {c.titre}</a></p>)}
            </div>
          )}
          {resto && (
            <button type="button" className="carte-service" style={{ width: "100%", textAlign: "left", marginTop: 10 }} onClick={() => choisir("restaurant")}>
              🍕 <b>Assistance partenaires</b> — {sujetDe("restaurant").question}
            </button>
          )}
          {CATEGORIES.map((c) => (
            <div key={c.id} className="carte-service" style={{ marginTop: 10 }}>
              <button type="button" className="lien" style={{ fontWeight: 700, fontSize: 17 }} aria-expanded={cat === c.id} onClick={() => setCat(cat === c.id ? "" : c.id)}>{c.icone} {c.titre} {cat === c.id ? "▴" : "▾"}</button>
              {cat === c.id && sujetsDe(c.id, false).map((s) => (
                <p key={s.id} style={{ margin: "8px 0" }}><button type="button" className="bouton-secondaire" style={{ width: "100%", textAlign: "left" }} onClick={() => choisir(s.id)}>{s.question}</button></p>
              ))}
            </div>
          ))}
          <p style={{ marginTop: 14 }}><button type="button" className="bouton" onClick={() => choisir("autre")}>Parler directement à Rebecca</button></p>
        </>
      )}

      {sujet && (
        <>
          <button type="button" className="lien" onClick={() => setSujetId("")}>← Tous les sujets</button>
          <h3>{sujet.question}</h3>
          <p>{sujet.reponse}</p>
          {sujet.vitale && <p className="note">🚨 {URGENCES_VITALES}</p>}
          <Donnees sujet={sujet} demandes={demandes} connecte={!!uid} choisie={choisie} setChoisie={setChoisie} />
          {sujet.liens && <p><button type="button" className="bouton" onClick={onAccueil}>Voir les services et réserver</button></p>}
          {sujet.id === "restaurant" && resto && <p><a className="bouton-secondaire" href={`#/resto/${resto}`}>Retour à mon espace restaurant</a></p>}
          {resolu === null && (
            <div className="carte-service" style={{ marginTop: 10 }}>
              <b>Votre question est-elle résolue ?</b>
              <p>
                <button type="button" className="bouton" onClick={() => setResolu(true)}>Oui, merci</button>{" "}
                <button type="button" className="bouton-secondaire" onClick={() => setResolu(false)}>Non, parler à Rebecca</button>
              </p>
            </div>
          )}
          {resolu === true && <p className="carte-service">Merci ! Bonne journée avec Rebecca Services. <button type="button" className="lien" onClick={() => setSujetId("")}>Autre question</button></p>}
          {resolu === false && <Formulaire sujet={sujet} client={client} demandes={demandes} choisie={choisie} resto={resto} onCree={ouvrir} />}
          {ferme && resolu === false && <p className="note">{MESSAGES_FERMETURE.transmis}</p>}
        </>
      )}
      <p style={{ marginTop: 16 }}>
        <a className="lien" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, j'ai une question.")} target="_blank" rel="noopener noreferrer">Ou écrire sur WhatsApp</a>
        {" · "}
        <button type="button" className="lien" onClick={onAccueil}>Accueil</button>
      </p>
    </section>
  );
}

function Conversation({ id, onRetour }) {
  const [c, setC] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState("");
  useEffect(() => onSnapshot(doc(db, "assistance", id), (s) => setC(s.exists() ? s.data() : null), () => setC(null)), [id]);
  useEffect(() => onSnapshot(query(collection(db, "assistance", id, "messages"), orderBy("creeLe")), (s) => setMessages(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {}), [id]);
  useEffect(() => {
    if (c) garderLocale(id, c.titre);
  }, [c, id]);
  if (c === undefined) return <section className="carte-service" style={{ margin: 16 }}>Chargement…</section>;
  if (c === null) return <section className="carte-service" style={{ margin: 16 }}>Conversation introuvable. <button type="button" className="lien" onClick={onRetour}>Assistance</button></section>;
  const ferme = fermetureEnCours();
  const bandeau = bandeauFermeture(c, messages, !!ferme);
  const envoyer = async () => {
    const t = texte.trim();
    if (t.length < 1) return;
    setInfo("");
    try {
      await addDoc(collection(db, "assistance", id, "messages"), { ...messagePropre("client", t), creeLe: serverTimestamp() });
      await updateDoc(doc(db, "assistance", id), { dernierDe: "client", aLire: true, majLe: serverTimestamp() });
      fetch("/.netlify/functions/assistance", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
      setTexte("");
    } catch {
      setInfo("Envoi impossible pour l'instant. Réessayez ou écrivez sur WhatsApp.");
    }
  };
  return (
    <section style={{ margin: 16 }}>
      <button type="button" className="lien" onClick={onRetour}>← Assistance</button>
      <h2>{c.titre}</h2>
      <p className="note">Statut : {libelleStatut(c.statut)}{c.urgence === "haute" ? " · urgent" : ""}</p>
      {bandeau && <p className="carte-service">🕯️ {bandeau}</p>}
      {messages.map((m) => (
        <div key={m.id} className="carte-service" style={{ marginTop: 8, marginLeft: m.de === "client" ? 30 : 0, marginRight: m.de === "client" ? 0 : 30 }}>
          <small>{m.de === "rebecca" ? "Rebecca" : "Vous"} · {heureDe(m.creeLe)}</small>
          <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{m.texte}</p>
        </div>
      ))}
      {messages.length > 0 && !messages.some((m) => m.de === "rebecca") && <p className="note">✓ Message bien reçu. Rebecca vous répondra ici{c.email ? " et par e-mail" : ""}. Gardez ce lien : {SITE.replace("https://", "")}/#/assistance/{id}</p>}
      {c.statut === "resolue" ? (
        <p className="carte-service">Cette conversation est terminée. Pour une nouvelle question, revenez à l'assistance.</p>
      ) : (
        <div className="carte-service" style={{ marginTop: 10 }}>
          <div className="champ"><label>Ajouter un message<textarea rows={3} maxLength={2000} value={texte} onChange={(e) => setTexte(e.target.value)} /></label></div>
          <button type="button" className="bouton" onClick={envoyer}>Envoyer</button>
          {info && <p role="alert">{info}</p>}
        </div>
      )}
    </section>
  );
}

export default function Assistance({ lien, onAccueil }) {
  const ouvrir = (id) => {
    window.location.hash = `#/assistance/${id}`;
  };
  if (lien && lien.vue === "conversation") return <Conversation id={lien.id} onRetour={() => { window.location.hash = "#/assistance"; }} />;
  return <AccueilAssistance resto={lien && lien.resto} onAccueil={onAccueil} ouvrir={ouvrir} />;
}
