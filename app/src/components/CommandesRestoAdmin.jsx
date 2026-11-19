import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";
import AddressField from "./AddressField.jsx";
import { calculerTrajet } from "../routing.js";
import { utcVersLocal, ajouterJours } from "../pricing/calendrier.js";
import { lienWhatsApp, lienAppel } from "../pricing/navigation.js";
import { ADMIN_ID, peutFaire } from "../pricing/equipe.js";
import { messageProposition, proposer } from "../pricing/quiFait.js";
import { useEquipeContexte } from "../equipeContexte.jsx";
import { jouerSon, useStylesNotif } from "../sons.js";
import {
  commandePropre, compteARebours, coursesProches, demandeDepuisCommande, enLigneActif, etatCommande, heurePlus, majSuivi,
  prixCommande, secondesRestantes, validerCommande,
} from "../pricing/restos.js";

// BOUTON « EN LIGNE » + COMMANDES DES RESTAURANTS (V2, 19 nov. 2026) - en haut de l'espace privé, Rebecca seule.
// En ligne : chaque commande envoyée par le lien d'un restaurant apparaît en grand (avec un son) :
// Accepter (la livraison va dans le Calendrier) / Refuser / Passer à Jérémy / Passer à un coursier.
// Sans réponse en 5 minutes, elle est refusée automatiquement. « 🍕 Commande WhatsApp » : Rebecca saisit
// une commande reçue par WhatsApp (elle est acceptée tout de suite).
const h = (x) => String(x || "").replace(":", "h");
const MOTIFS = ["Pas disponible maintenant", "Trop loin", "Déjà en course"];

function useRestos() {
  const [restos, setRestos] = useState([]);
  useEffect(() => onSnapshot(query(collection(db, "restos"), where("actif", "==", true)), (s) => setRestos(s.docs.map((x) => ({ cle: x.id, ...x.data() }))), () => setRestos([])), []);
  return restos;
}

// Commandes des 14 derniers jours de chaque restaurant (une écoute par restaurant : peu de restaurants)
function useCommandes(restos) {
  const [parResto, setParResto] = useState({});
  const cles = restos.map((r) => r.cle).sort().join(",");
  useEffect(() => {
    const depuis = ajouterJours(utcVersLocal(Date.now()).date, -14);
    const arrets = cles ? cles.split(",").map((cle) =>
      onSnapshot(query(collection(db, "restos", cle, "commandesResto"), where("jour", ">=", depuis)), (s) => setParResto((p) => ({ ...p, [cle]: s.docs.map((x) => ({ id: x.id, cle, ...x.data() })) })), () => {})
    ) : [];
    return () => arrets.forEach((a) => a());
  }, [cles]);
  return useMemo(() => Object.values(parResto).flat(), [parResto]);
}

export default function CommandesRestoAdmin({ aller }) {
  const { membres } = useEquipeContexte();
  const restos = useRestos();
  const commandes = useCommandes(restos);
  const [etat, setEtat] = useState(null);
  const [maintenant, setMaintenant] = useState(Date.now());
  const [saisie, setSaisie] = useState(false);
  const [info, setInfo] = useState("");
  const styles = useStylesNotif(true);
  const jour = utcVersLocal(maintenant).date;
  useEffect(() => onSnapshot(doc(db, "restosEtat", "enLigne"), (s) => setEtat(s.exists() ? s.data() : null), () => {}), []);
  const enLigne = enLigneActif(etat, jour);
  const enAttente = commandes.filter((c) => etatCommande(c, maintenant) === "nouvelle").sort((a, b) => (a.creeLe && a.creeLe.toMillis ? a.creeLe.toMillis() : 0) - (b.creeLe && b.creeLe.toMillis ? b.creeLe.toMillis() : 0));
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), enAttente.length ? 1000 : 30000);
    return () => clearInterval(id);
  }, [enAttente.length]);
  // Un son à chaque nouvelle commande
  const avant = useRef(null);
  useEffect(() => {
    if (avant.current != null && enAttente.length > avant.current) jouerSon(styles.nouvelle.son);
    avant.current = enAttente.length;
  }, [enAttente.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suivi : livraison terminée -> « Livrée » chez le restaurant ; payée (relevé) -> « payé » ; prix changé -> suit
  const aSuivre = commandes.filter((c) => c.demandeId && (c.statut === "acceptee" || (c.statut === "livree" && !c.payee)));
  const cleSuivi = aSuivre.map((c) => c.id + c.statut).join(",");
  useEffect(() => {
    if (!aSuivre.length) return undefined;
    let fini = false;
    const verifier = async () => {
      try {
        const ids = aSuivre.map((c) => c.demandeId);
        const mvts = [];
        for (let i = 0; i < ids.length; i += 10) {
          const s = await getDocs(query(collection(db, "mouvements"), where("resId", "in", ids.slice(i, i + 10))));
          mvts.push(...s.docs.map((x) => x.data()));
        }
        for (const c of aSuivre) {
          if (fini) return;
          const d = await getDoc(doc(db, "demandes", c.demandeId));
          const maj = d.exists() ? majSuivi(c, { id: d.id, ...d.data() }, mvts) : null;
          if (maj) await updateDoc(doc(db, "restos", c.cle, "commandesResto", c.id), maj);
        }
      } catch {
        /* on réessaie au prochain passage */
      }
    };
    verifier();
    const id = setInterval(verifier, 5 * 60000);
    return () => { fini = true; clearInterval(id); };
  }, [cleSuivi]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!restos.length) return null;
  const basculer = async () => {
    try {
      await setDoc(doc(db, "restosEtat", "enLigne"), { enLigne: !enLigne, jour, majLe: serverTimestamp() });
    } catch {
      setInfo("Impossible pour l'instant : vérifie la connexion et les règles Firebase v29.");
    }
  };
  const duJour = commandes.filter((c) => c.jour === jour && ["acceptee", "livree"].includes(c.statut)).length;
  const actuelle = enLigne ? enAttente[0] : null;

  return (
    <>
      <div className="tb-actions" style={{ margin: "8px 0" }}>
        <button type="button" className={"tb-bouton" + (enLigne ? "" : " tb-clair")} onClick={basculer} aria-pressed={enLigne}>
          {enLigne ? "🟢 En ligne (restaurants)" : "⚪ Hors ligne (restaurants)"}
        </button>
        <button type="button" className="tb-bouton tb-clair" onClick={() => setSaisie(!saisie)}>🍕 Commande WhatsApp</button>
        {duJour > 0 && <span className="tdb-note">{duJour} livraison{duJour > 1 ? "s" : ""} restaurant aujourd'hui</span>}
      </div>
      {!enLigne && enAttente.length > 0 && <p className="tdb-note">🍕 {enAttente.length} commande(s) en attente : passe « En ligne » pour répondre.</p>}
      {info && <p className="tdb-note" role="status">{info}</p>}
      {saisie && <SaisieWhatsApp restos={restos} jour={jour} heure={utcVersLocal(maintenant).heure} fermer={() => setSaisie(false)} />}
      {actuelle && <CarteCommande key={actuelle.id} c={actuelle} resto={restos.find((r) => r.cle === actuelle.cle)} maintenant={maintenant} reste={enAttente.length - 1} membres={membres} aller={aller} />}
    </>
  );
}

// Livraison créée dans le Calendrier + commande mise à jour, en une seule fois
async function accepterCommande(resto, c, { prix, km, minutes, par = "Rebecca" }) {
  const refD = doc(collection(db, "demandes"));
  const demande = demandeDepuisCommande(resto, c, { cle: resto.cle, id: c.id, prix, km, minutes });
  const b = writeBatch(db);
  b.set(refD, { ...demande, creeLe: serverTimestamp() });
  b.update(doc(db, "restos", resto.cle, "commandesResto", c.id), { statut: "acceptee", prix: demande.prixFinal, km: km ?? null, demandeId: refD.id, reponduLe: serverTimestamp(), arriveeVers: c.pretA, par });
  await b.commit();
  return { id: refD.id, ...demande };
}

function CarteCommande({ c, resto, maintenant, reste, membres, aller }) {
  const [trajet, setTrajet] = useState(null);
  const [prix, setPrix] = useState("");
  const [demandes, setDemandes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState("");
  const [prevenir, setPrevenir] = useState(null);
  useEffect(() => {
    let fini = false;
    if (resto && resto.adresse && typeof resto.adresse.lat === "number" && c.adresse && typeof c.adresse.lat === "number") {
      calculerTrajet(resto.adresse, c.adresse).then((t) => {
        if (fini) return;
        setTrajet(t);
        const p = prixCommande(resto.tarifs, t.km);
        if (p != null) setPrix((x) => x || String(p));
      }).catch(() => {});
    }
    getDocs(query(collection(db, "demandes"), where("date", "==", c.jour))).then((s) => !fini && setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() })))).catch(() => {});
    return () => { fini = true; };
  }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!resto) return null;
  const proches = coursesProches(demandes, c.jour, c.pretA);
  const equipiers = (membres || []).filter((m) => m && m.id !== ADMIN_ID && peutFaire(m, "livraison"));
  const prixOk = () => {
    const p = Number(String(prix).replace(",", "."));
    if (!(p > 0 && p <= 2000)) {
      setInfo("Indique le prix de la livraison.");
      return null;
    }
    return p;
  };
  const accepter = async (vers) => {
    const p = prixOk();
    if (p == null) return;
    setEnCours(true);
    setInfo("");
    try {
      const m = vers && vers !== "coursier" ? equipiers.find((x) => x.id === vers) : null;
      const d = await accepterCommande(resto, c, { prix: p, km: trajet ? trajet.km : null, minutes: trajet ? trajet.minutes : null, par: m ? m.nom || "Jérémy" : vers === "coursier" ? "un coursier partenaire" : "Rebecca" });
      if (m) {
        const r = proposer(d, m.id, ADMIN_ID, Date.now());
        if (r.maj) await updateDoc(doc(db, "demandes", d.id), r.maj);
        setPrevenir({ nom: m.nom, lien: lienWhatsApp(m.telephone, messageProposition(d, "Rebecca", m.nom || "Jérémy")) });
        setEnCours(false);
        return;
      }
      if (vers === "coursier") aller("demandes", d.id);
    } catch {
      setInfo("Impossible pour l'instant : vérifie la connexion et les règles Firebase v29.");
    }
    setEnCours(false);
  };
  const refuser = async (motif) => {
    setEnCours(true);
    try {
      await updateDoc(doc(db, "restos", c.cle, "commandesResto", c.id), { statut: "refusee", motif, reponduLe: serverTimestamp() });
    } catch {
      setInfo("Impossible pour l'instant.");
    }
    setEnCours(false);
  };
  const s = secondesRestantes(c, maintenant);

  if (prevenir) {
    return (
      <div className="tdb-bloc" style={{ position: "fixed", left: 8, right: 8, bottom: 8, zIndex: 1000, boxShadow: "0 8px 30px rgba(0,0,0,.6)" }}>
        <p>✓ Acceptée et proposée à {prevenir.nom} : elle est dans « À accepter » chez lui.</p>
        <div className="tb-actions">
          <a className="tb-bouton" href={prevenir.lien} target="_blank" rel="noopener noreferrer">💬 Prévenir {prevenir.nom}</a>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setPrevenir(null)}>Fermer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="tdb-bloc" role="alertdialog" aria-label="Nouvelle commande restaurant" style={{ position: "fixed", left: 8, right: 8, bottom: 8, zIndex: 1000, maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 30px rgba(0,0,0,.6)" }}>
      <p className="rp-type">🍕 {resto.nom} · réponds dans {compteARebours(s)}{reste > 0 ? ` · +${reste} autre(s)` : ""}</p>
      <p><strong>Prête à {h(c.pretA)}</strong>{trajet ? ` · ${trajet.km} km · ${trajet.minutes} min` : ""}</p>
      <p className="tdb-note">📍 Récupérer : {resto.adresse ? resto.adresse.label : "—"}{resto.telephone ? <> · <a href={lienAppel(resto.telephone)}>{resto.telephone}</a></> : null}</p>
      <p className="tdb-note">🏠 Livrer : {c.adresse ? c.adresse.label : "—"}</p>
      <p className="tdb-note">👤 {c.client} · <a href={lienAppel(c.telClient)}>{c.telClient}</a>{c.note ? ` · ${c.note}` : ""}</p>
      {proches.length > 0 && <p className="tdb-note">⚠️ Tes courses passent avant : {proches.map((d) => `${h(d.heure)} ${d.serviceTitre || d.service} (${d.nom || ""})`).join(" · ")}</p>}
      <label className="champ">Prix de la livraison (₪)
        <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder={trajet ? "au-delà de 6 km : ton prix" : "km inconnus : ton prix"} />
      </label>
      {info && <p className="fm-erreur" role="alert">{info}</p>}
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={enCours} onClick={() => accepter(null)}>✓ Accepter</button>
        {equipiers.map((m) => <button key={m.id} type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => accepter(m.id)}>→ {m.nom || "Équipier"}</button>)}
        <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => accepter("coursier")}>→ Un coursier</button>
      </div>
      <div className="tb-actions">
        {MOTIFS.map((m) => <button key={m} type="button" className="tb-bouton ag-danger" disabled={enCours} onClick={() => refuser(m)}>✗ {m}</button>)}
      </div>
    </div>
  );
}

// Commande reçue par WhatsApp : Rebecca la saisit, elle est acceptée tout de suite (livraison dans le Calendrier)
function SaisieWhatsApp({ restos, jour, heure, fermer }) {
  const [cle, setCle] = useState(restos[0] ? restos[0].cle : "");
  const [f, setF] = useState({ client: "", telClient: "", adresse: null, pretA: "", note: "" });
  const [prix, setPrix] = useState("");
  const [trajet, setTrajet] = useState(null);
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const resto = restos.find((r) => r.cle === cle);
  const maj = (k, v) => setF({ ...f, [k]: v });
  useEffect(() => {
    let fini = false;
    setTrajet(null);
    if (resto && resto.adresse && typeof resto.adresse.lat === "number" && f.adresse && typeof f.adresse.lat === "number") {
      calculerTrajet(resto.adresse, f.adresse).then((t) => {
        if (fini) return;
        setTrajet(t);
        const p = prixCommande(resto.tarifs, t.km);
        if (p != null) setPrix(String(p));
      }).catch(() => {});
    }
    return () => { fini = true; };
  }, [cle, f.adresse && f.adresse.label]); // eslint-disable-line react-hooks/exhaustive-deps
  const enregistrer = async () => {
    const pret = { ...f, pretA: f.pretA || heurePlus(heure, 0) };
    const err = validerCommande(pret);
    if (err) return setInfo(err);
    const p = Number(String(prix).replace(",", "."));
    if (!(p > 0 && p <= 2000)) return setInfo("Indique le prix de la livraison.");
    setEnCours(true);
    try {
      const refC = doc(collection(db, "restos", cle, "commandesResto"));
      const c = { ...commandePropre(pret, jour, "whatsapp"), id: refC.id };
      const refD = doc(collection(db, "demandes"));
      const demande = demandeDepuisCommande(resto, c, { cle, id: refC.id, prix: p, km: trajet ? trajet.km : null, minutes: trajet ? trajet.minutes : null });
      const b = writeBatch(db);
      const { id, ...sansId } = c; // eslint-disable-line no-unused-vars
      b.set(refD, { ...demande, creeLe: serverTimestamp() });
      b.set(refC, { ...sansId, prix: demande.prixFinal, km: trajet ? trajet.km : null, demandeId: refD.id, arriveeVers: pret.pretA, par: "Rebecca", creeLe: serverTimestamp() });
      await b.commit();
      setInfo(`✓ Livraison de ${h(pret.pretA)} ajoutée au Calendrier (${demande.prixFinal} ₪, relevé de ${resto.nom}).`);
      setF({ client: "", telClient: "", adresse: null, pretA: "", note: "" });
      setPrix("");
    } catch {
      setInfo("Impossible pour l'instant : vérifie la connexion et les règles Firebase v29.");
    }
    setEnCours(false);
    return undefined;
  };
  return (
    <div className="tdb-bloc">
      <p className="rp-type">🍕 Commande reçue par WhatsApp</p>
      <label className="champ">Restaurant
        <select value={cle} onChange={(e) => setCle(e.target.value)}>{restos.map((r) => <option key={r.cle} value={r.cle}>{r.nom}</option>)}</select>
      </label>
      <label className="champ">Prénom du client<input value={f.client} maxLength={60} onChange={(e) => maj("client", e.target.value)} /></label>
      <label className="champ">Téléphone du client<input inputMode="tel" value={f.telClient} maxLength={20} onChange={(e) => maj("telClient", e.target.value)} /></label>
      <label className="champ" htmlFor="rw-adresse">Adresse de livraison</label>
      <AddressField id="rw-adresse" valeur={f.adresse} position={false} onChange={(v) => maj("adresse", v)} />
      <label className="champ">Prête à<input type="time" value={f.pretA} onChange={(e) => maj("pretA", e.target.value)} /></label>
      <div className="tb-actions">
        {[0, 10, 20, 30].map((n) => <button key={n} type="button" className="tb-bouton tb-clair" onClick={() => maj("pretA", heurePlus(heure, n))}>{n === 0 ? "Maintenant" : `+${n} min`}</button>)}
      </div>
      <label className="champ">Note (facultatif)<input value={f.note} maxLength={300} onChange={(e) => maj("note", e.target.value)} /></label>
      <label className="champ">Prix (₪){trajet ? ` · ${trajet.km} km` : ""}<input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value.replace(/[^0-9.,]/g, ""))} /></label>
      {info && <p className="tdb-note" role="status">{info}</p>}
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={enCours} onClick={enregistrer}>Ajouter au Calendrier</button>
        <button type="button" className="tb-bouton tb-clair" onClick={fermer}>Fermer</button>
      </div>
    </div>
  );
}
