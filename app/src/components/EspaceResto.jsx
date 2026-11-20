import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import AddressField from "./AddressField.jsx";
import { WHATSAPP } from "../contact.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { utcVersLocal, ajouterJours } from "../pricing/calendrier.js";
import { etatDisponibilite } from "../pricing/disponibilite.js";
import { semaineDecalee } from "../pricing/commercants.js";
import GrilleKmResto from "./GrilleKmResto.jsx";
import FormuleResto from "./FormuleResto.jsx";
import {
  LIBELLES, commandePropre, compteARebours, dansSonCreneau, etatCommande, heurePlus, messageWhatsAppResto, peutCommander, releveResto,
  secondesRestantes, semaineResto, tarifsResto, validerCommande,
} from "../pricing/restos.js";

// ESPACE RESTAURANT (V2, 19 nov. 2026) : page privée #/resto/CLE, sans compte (la clé du lien est l'accès).
// Le restaurant envoie une livraison, voit la réponse en direct (refus automatique après 5 minutes sans réponse),
// ses commandes des derniers jours et le relevé de la semaine (livraisons, dû, payé).
const vide = () => ({ client: "", telClient: "", adresse: null, pretA: "", note: "", tresLourds: 0 });
const dfr = (d) => (d ? d.split("-").reverse().join("/") : "");
const h = (x) => String(x || "").replace(":", "h");

export default function EspaceResto({ cle, onAccueil }) {
  const [resto, setResto] = useState(undefined);
  const [etat, setEtat] = useState(null);
  const [commandes, setCommandes] = useState([]);
  const [maintenant, setMaintenant] = useState(Date.now());
  const [f, setF] = useState(vide);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [cleAdresse, setCleAdresse] = useState(0);
  const { date: jour, heure } = utcVersLocal(maintenant);
  const [semaine, setSemaine] = useState(() => semaineResto(utcVersLocal(Date.now()).date));

  useEffect(() => {
    const a = onSnapshot(doc(db, "restos", cle), (s) => setResto(s.exists() ? s.data() : null), () => setResto(null));
    const b = onSnapshot(doc(db, "restosEtat", "enLigne"), (s) => setEtat(s.exists() ? s.data() : null), () => setEtat(null));
    const depuis = ajouterJours(utcVersLocal(Date.now()).date, -35);
    const c = onSnapshot(query(collection(db, "restos", cle, "commandesResto"), where("jour", ">=", depuis)), (s) => setCommandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
    return () => { a(); b(); c(); };
  }, [cle]);

  const enAttente = commandes.filter((c) => etatCommande(c, maintenant) === "nouvelle");
  // Compte à rebours chaque seconde tant qu'une commande attend, sinon toutes les 30 secondes
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), enAttente.length ? 1000 : 30000);
    return () => clearInterval(id);
  }, [enAttente.length]);
  // 5 minutes sans réponse : la commande est refusée automatiquement (notée dans la base)
  useEffect(() => {
    for (const c of commandes) {
      if (c.statut === "nouvelle" && etatCommande(c, maintenant) === "expiree") updateDoc(doc(db, "restos", cle, "commandesResto", c.id), { statut: "expiree" }).catch(() => {});
    }
  }, [commandes, maintenant, cle]);

  if (resto === undefined) return <section className="carte-service" style={{ margin: 16 }}><p>Chargement…</p></section>;
  if (resto === null) {
    return (
      <section className="carte-service" style={{ margin: 16 }}>
        <h2>Espace restaurant</h2>
        <p>Ce lien n'est pas valable (ou il a été remplacé). Demandez votre lien à Rebecca.</p>
        <p><a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, mon lien restaurant ne marche plus.")} target="_blank" rel="noopener noreferrer">💬 Écrire à Rebecca</a></p>
        <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
      </section>
    );
  }

  const possible = peutCommander({ resto, etat, jour, dispo: etatDisponibilite(maintenant) });
  const maj = (k, v) => setF({ ...f, [k]: v });
  const envoyer = async () => {
    const pret = { ...f, pretA: f.pretA || heurePlus(heure, 0) };
    const err = validerCommande(pret);
    if (err) return setErreur(err);
    if (!possible.ok) return setErreur(possible.raison);
    setErreur("");
    setEnvoi(true);
    try {
      const ref = await addDoc(collection(db, "restos", cle, "commandesResto"), { ...commandePropre(pret, jour), creeLe: serverTimestamp() });
      // Notification immédiate sur le téléphone de Rebecca (sans attendre le robot)
      fetch("/.netlify/functions/commande-resto", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle, id: ref.id }) }).catch(() => {});
      setF(vide());
      setCleAdresse((n) => n + 1);
    } catch {
      setErreur("Envoi impossible : vérifiez la connexion, ou envoyez la commande à Rebecca sur WhatsApp.");
    }
    setEnvoi(false);
    return undefined;
  };
  const annuler = (c) => updateDoc(doc(db, "restos", cle, "commandesResto", c.id), { statut: "annulee" }).catch(() => setErreur("Annulation impossible pour l'instant."));

  const duJour = commandes.filter((c) => c.jour === jour).sort((a, b) => (b.pretA || "").localeCompare(a.pretA || ""));
  const r = releveResto(commandes, semaine);

  return (
    <section className="carte-service" style={{ margin: 16 }}>
      <h2>🍕 {resto.nom}</h2>
      <p className="tb-note">Votre espace livraison Rebecca Services</p>
      {resto.tarifs && (
        <details style={{ marginTop: 6 }}>
          <summary className="tb-note">💰 Mes tarifs de livraison · formule {resto.formule === "AB" ? "A + B" : resto.formule || "A"}</summary>
          {resto.formule === "B" || resto.formule === "AB" ? (
            <>
              <p className="tb-note">Vos créneaux réservés : <strong>{resto.creneaux}</strong></p>
              <GrilleKmResto tarifs={resto.tarifs} titre="Pendant vos créneaux (prix B)" />
              <GrilleKmResto tarifs={resto.tarifsA || {}} titre="En dehors de vos créneaux (prix A)" />
            </>
          ) : <GrilleKmResto tarifs={resto.tarifs} titre="Vos prix selon la distance" />}
        </details>
      )}
      <FormuleResto cle={cle} resto={resto} />
      <p><strong>{possible.ok ? "🟢 Rebecca est en ligne : vous pouvez envoyer une commande." : "🔴 " + possible.raison}</strong></p>

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Nouvelle livraison</strong>
        <label>Prénom du client<br /><input value={f.client} maxLength={60} onChange={(e) => maj("client", e.target.value)} /></label>
        <label>Téléphone du client<br /><input inputMode="tel" value={f.telClient} maxLength={20} onChange={(e) => maj("telClient", e.target.value)} /></label>
        <label htmlFor="resto-adresse">Adresse de livraison</label>
        <AddressField key={cleAdresse} id="resto-adresse" valeur={f.adresse} position={false} onChange={(v) => maj("adresse", v)} />
        <label>Commande prête à<br />
          <input type="time" value={f.pretA} onChange={(e) => maj("pretA", e.target.value)} />
        </label>
        <p>
          {[0, 10, 15, 20, 30].map((n) => (
            <button key={n} type="button" className="bouton-secondaire" style={{ marginRight: 6, marginBottom: 6 }} onClick={() => maj("pretA", heurePlus(heure, n))}>{n === 0 ? "Maintenant" : `+${n} min`}</button>
          ))}
        </p>
        {(resto.formule === "B" || resto.formule === "AB") && <p className="tb-note">{dansSonCreneau(resto, jour, f.pretA || heure) ? "🟢 Dans votre créneau réservé : prix B." : "Hors de vos créneaux réservés : prix A."}</p>}
        <label>Articles très lourds (packs d'eau, cartons lourds) : +{tarifsResto(resto, jour, f.pretA || heure).tresLourd ?? 5} ₪ chacun · sacs ordinaires gratuits<br />
          <input type="number" inputMode="numeric" min={0} max={30} value={f.tresLourds || 0} onChange={(e) => maj("tresLourds", Math.max(0, Math.min(30, Math.round(Number(e.target.value) || 0))))} style={{ width: 90 }} />
        </label>
        <br />
        <label>Note pour le livreur (facultatif)<br /><input value={f.note} maxLength={300} onChange={(e) => maj("note", e.target.value)} placeholder="Ex. : 3e étage, code 1234, payé" /></label>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <p>
          <button type="button" disabled={envoi || !possible.ok} onClick={envoyer}>{envoi ? "Envoi…" : "Envoyer la commande"}</button>{" "}
          <a className="bouton-secondaire" href={lienWhatsApp(WHATSAPP, messageWhatsAppResto(resto.nom, f))} target="_blank" rel="noopener noreferrer">💬 Par WhatsApp</a>
        </p>
        <p className="tb-note">Sans réponse en 5 minutes, la commande est refusée automatiquement : vous pouvez alors la confier à quelqu'un d'autre.</p>
      </div>

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Aujourd'hui</strong>
        {duJour.length === 0 && <p className="tb-note">Aucune commande aujourd'hui.</p>}
        {duJour.map((c) => {
          const e = etatCommande(c, maintenant);
          return (
            <div key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 8, marginTop: 8 }}>
              <p><strong>{h(c.pretA)} · {c.client}</strong> · {c.adresse && c.adresse.label}</p>
              <p>
                {LIBELLES[e] || e}
                {e === "nouvelle" && ` · ${compteARebours(secondesRestantes(c, maintenant))}`}
                {(e === "acceptee" || e === "livree") && typeof c.prix === "number" ? ` · ${c.prix} ₪` : ""}
                {e === "acceptee" && c.arriveeVers ? ` · Rebecca arrive vers ${h(c.arriveeVers)}` : ""}
                {e === "acceptee" && c.par && c.par !== "Rebecca" ? ` · livrée par ${c.par}` : ""}
                {e === "refusee" && c.motif ? ` · ${c.motif}` : ""}
              </p>
              {e === "nouvelle" && <button type="button" className="bouton-secondaire" onClick={() => annuler(c)}>Annuler cette commande</button>}
            </div>
          );
        })}
      </div>

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Relevé de la semaine</strong>
        <p>
          <button type="button" className="bouton-secondaire" onClick={() => setSemaine(semaineDecalee(semaine, -1))}>←</button>{" "}
          du {dfr(r.debut)} au {dfr(r.fin)} · paiement le {dfr(r.paiementLe)}{" "}
          <button type="button" className="bouton-secondaire" onClick={() => setSemaine(semaineDecalee(semaine, 1))}>→</button>
        </p>
        {r.lignes.length === 0 ? <p className="tb-note">Aucune livraison faite cette semaine.</p> : (
          <ul>
            {r.lignes.map((l) => <li key={l.c.id}>{dfr(l.c.jour)} {h(l.c.pretA)} · {l.c.client} · {l.du} ₪{l.paye ? " · payé" : ""}</li>)}
          </ul>
        )}
        <p><strong>{r.nb} livraison{r.nb > 1 ? "s" : ""} · dû {r.du} ₪ · payé {r.paye} ₪ · reste {r.reste} ₪</strong></p>
        {resto.moyen && r.reste > 0 && <p className="tb-note">À régler par {resto.moyen}, le dimanche {dfr(r.paiementLe)}.</p>}
      </div>

      <p><a className="bouton-secondaire" href={`#/assistance/resto/${cle}`}>💬 Assistance partenaires</a></p>
      <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
    </section>
  );
}
