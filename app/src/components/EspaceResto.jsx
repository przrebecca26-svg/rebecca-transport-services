import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import AddressField from "./AddressField.jsx";
import { calculerTrajet } from "../routing.js";
import { WHATSAPP } from "../contact.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { utcVersLocal, ajouterJours, localVersUtc, periodesFermees } from "../pricing/calendrier.js";
import { etatDisponibilite } from "../pricing/disponibilite.js";
import { semaineDecalee } from "../pricing/commercants.js";
import GrilleKmResto from "./GrilleKmResto.jsx";
import FormuleResto from "./FormuleResto.jsx";
import { EditeurCarte } from "./RestosVitrine.jsx";
import { proposerMenu, useMenuPropose } from "../menusRestosBase.js";

// 26 nov. 2026 : « Mon menu en ligne » : le restaurant tape son menu et l'envoie à Rebecca, qui le valide
function MonMenu({ cle }) {
  const propose = useMenuPropose(cle);
  const [texte, setTexte] = useState(null);
  const [info, setInfo] = useState("");
  const vu = texte != null ? texte : (propose && propose.texte) || "";
  const envoyer = async () => {
    setInfo("Envoi…");
    try {
      await proposerMenu(cle, vu);
      setInfo("✅ Envoyé : Rebecca le vérifie, puis il apparaît sur le site.");
      setTexte(null);
    } catch {
      setInfo("Envoi impossible pour l'instant : envoyez votre menu à Rebecca sur WhatsApp (photo ou liste).");
    }
  };
  return (
    <details style={{ marginTop: 10 }}>
      <summary><b>📋 Mon menu en ligne</b>{propose ? (propose.statut === "publie" ? " · ✅ publié sur le site" : " · ⏳ en attente de validation") : ""}</summary>
      <p className="tb-note">Vos plats avec leur nom, un descriptif et le prix. Les clients commandent sur rebeccaservices.com/#/restaurants ; la commande vous arrive par WhatsApp, le client vous paie le repas et Rebecca Services livre.</p>
      <EditeurCarte texte={vu} onChange={setTexte} />
      <div className="tb-actions">
        <button type="button" className="pp-bouton" disabled={!vu.trim()} onClick={envoyer}>Envoyer mon menu à Rebecca</button>
      </div>
      {info && <p className="tb-note">{info}</p>}
    </details>
  );
}
import "../espace-resto.css"; // 22 nov. 2026 : boutons et champs au style du site (ils étaient gris, par défaut)
import {
  JOURS_PROGRAMMATION, LIBELLES, commandePropre, compteARebours, dansSonCreneau, etatCommande, heurePlus, messageWhatsAppResto, peutCommander, peutProgrammer, prixCommandeResto, releveResto,
  secondesRestantes, semaineResto, tarifsResto, validerCommande, numeroCommande,
} from "../pricing/restos.js";

// ESPACE RESTAURANT (V2, 19 nov. 2026) : page privée #/resto/CLE, sans compte (la clé du lien est l'accès).
// Le restaurant envoie une livraison, voit la réponse en direct (refus automatique après 5 minutes sans réponse),
// ses commandes des derniers jours et le relevé de la semaine (livraisons, dû, payé).
const vide = () => ({ client: "", telClient: "", adresse: null, pretA: "", note: "", tresLourds: 0, numero: "", prioritaire: false });
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
  // 20 nov. 2026 : « Pour quand ? » aujourd'hui ou un autre jour (commande programmée)
  const [quand, setQuand] = useState("auj");
  const [jourChoisi, setJourChoisi] = useState("");
  // 20 nov. 2026 (Rebecca) : le restaurant voit le prix de la livraison AVANT d'envoyer
  const [trajet, setTrajet] = useState(null);
  const latResto = resto && resto.adresse ? resto.adresse.lat : null;
  const latClient = f.adresse ? f.adresse.lat : null;
  const lonClient = f.adresse ? f.adresse.lon : null;
  useEffect(() => {
    setTrajet(null);
    if (!resto || !resto.adresse || typeof latResto !== "number" || typeof latClient !== "number") return undefined;
    let fini = false;
    calculerTrajet(resto.adresse, f.adresse).then((t) => !fini && setTrajet(t)).catch(() => !fini && setTrajet({ erreur: true }));
    return () => { fini = true; };
  }, [latResto, latClient, lonClient]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (resto === undefined) return <section className="carte-service espace-resto" style={{ margin: 16 }}><p>Chargement…</p></section>;
  // 20 nov. 2026 (Rebecca) : lien désactivé = la page ne s'ouvre plus du tout (ni tarifs, ni commandes, ni relevé)
  if (resto === null || resto.actif === false) {
    return (
      <section className="carte-service espace-resto" style={{ margin: 16 }}>
        <h2>Espace restaurant</h2>
        <p>Ce lien n'est pas valable (ou il a été remplacé). Demandez votre lien à Rebecca.</p>
        <p><a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, mon lien restaurant ne marche plus.")} target="_blank" rel="noopener noreferrer">💬 Écrire à Rebecca</a></p>
        <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
      </section>
    );
  }

  const programmee = quand === "autre";
  const jourCmd = programmee ? jourChoisi : jour;
  const fermetureLe = (() => {
    if (!programmee || !/^\d{4}-\d{2}-\d{2}$/.test(jourChoisi)) return "";
    const t = localVersUtc(jourChoisi, f.pretA || "12:00");
    const p = periodesFermees(jourChoisi, 1).find((x) => x.type !== "personnel" && x.debutUtc <= t && x.finUtc > t);
    return p ? p.label : "";
  })();
  const possible = programmee
    ? peutProgrammer({ resto, aujourdhui: jour, jourChoisi, pretA: f.pretA, dispo: etatDisponibilite(maintenant), fermeture: fermetureLe })
    : peutCommander({ resto, etat, jour, dispo: etatDisponibilite(maintenant) });
  const maj = (k, v) => setF({ ...f, [k]: v });
  const envoyer = async () => {
    if (programmee && !f.pretA) return setErreur("Indiquez l'heure à laquelle la commande sera prête.");
    const pret = { ...f, pretA: f.pretA || heurePlus(heure, 0) };
    const err = validerCommande(pret);
    if (err) return setErreur(err);
    if (!possible.ok) return setErreur(possible.raison);
    setErreur("");
    setEnvoi(true);
    try {
      const doc0 = { ...commandePropre(pret, jourCmd, "lien", programmee), creeLe: serverTimestamp() };
      let ref;
      try {
        ref = await addDoc(collection(db, "restos", cle, "commandesResto"), doc0);
      } catch (e) {
        // Règles pas encore à jour (v36) : le numéro et « prioritaire » passent dans la note
        if (!(doc0.numero || doc0.prioritaire)) throw e;
        const { numero, prioritaire, ...reste } = doc0;
        const note = [numero ? `N° ${numero}` : "", prioritaire ? "⚡ PRIORITAIRE" : "", reste.note].filter(Boolean).join(" · ").slice(0, 300);
        ref = await addDoc(collection(db, "restos", cle, "commandesResto"), { ...reste, note });
      }
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

  const avecB = resto.formule === "B" || resto.formule === "AB";
  const prixAffiche = trajet && typeof trajet.km === "number" ? prixCommandeResto({ ...resto, cle }, jourCmd, f.pretA || heure, trajet.km, f.tresLourds, commandes) : null;
  const infosWhatsApp = {
    jour: programmee && jourChoisi ? jourChoisi : "",
    prix: prixAffiche != null ? prixAffiche : undefined,
    km: trajet && typeof trajet.km === "number" ? trajet.km : undefined,
    formule: avecB ? (dansSonCreneau(resto, jourCmd, f.pretA || heure) ? "B" : "A") : "",
  };
  const duJour = commandes.filter((c) => c.jour === jour).sort((a, b) => (b.pretA || "").localeCompare(a.pretA || ""));
  const aVenir = commandes.filter((c) => c.jour > jour && !["annulee", "refusee", "expiree"].includes(c.statut)).sort((a, b) => (a.jour + a.pretA).localeCompare(b.jour + b.pretA));
  const r = releveResto(commandes, semaine);

  return (
    <section className="carte-service espace-resto" style={{ margin: 16 }}>
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
      <p><strong>{possible.ok ? (programmee ? "🟢 Vous pouvez programmer cette commande." : "🟢 Rebecca est en ligne : vous pouvez envoyer une commande.") : "🔴 " + possible.raison}</strong></p>

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Nouvelle livraison</strong>
        {/* 22 nov. 2026 (Rebecca) : le numéro de la commande, pour que Rebecca sache laquelle récupérer */}
        <label>N° de commande (votre ticket, facultatif)<br /><input value={f.numero} maxLength={20} inputMode="text" placeholder="Ex. : 457 (sinon un code est donné automatiquement)" onChange={(e) => maj("numero", e.target.value)} /></label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600 }}><input type="checkbox" checked={!!f.prioritaire} onChange={(e) => maj("prioritaire", e.target.checked)} style={{ width: 22, height: 22, minHeight: 0 }} /> ⚡ Prioritaire (à livrer en premier)</label>
        <label>Prénom du client<br /><input value={f.client} maxLength={60} onChange={(e) => maj("client", e.target.value)} /></label>
        <label>Téléphone du client<br /><input inputMode="tel" value={f.telClient} maxLength={20} onChange={(e) => maj("telClient", e.target.value)} /></label>
        <label htmlFor="resto-adresse">Adresse de livraison</label>
        <AddressField key={cleAdresse} id="resto-adresse" valeur={f.adresse} position={false} onChange={(v) => maj("adresse", v)} />
        <p style={{ margin: "8px 0 4px" }}>Pour quand ?</p>
        <p>
          <button type="button" className={quand === "auj" ? "" : "bouton-secondaire"} style={{ marginRight: 6 }} onClick={() => setQuand("auj")}>Aujourd'hui</button>
          <button type="button" className={quand === "autre" ? "" : "bouton-secondaire"} onClick={() => { setQuand("autre"); if (!jourChoisi) setJourChoisi(ajouterJours(jour, 1)); }}>📅 Un autre jour</button>
        </p>
        {programmee && (
          <label>Jour de la livraison<br />
            <input type="date" value={jourChoisi} min={ajouterJours(jour, 1)} max={ajouterJours(jour, JOURS_PROGRAMMATION)} onChange={(e) => setJourChoisi(e.target.value)} />
          </label>
        )}
        <label>Commande prête à<br />
          <input type="time" value={f.pretA} onChange={(e) => maj("pretA", e.target.value)} />
        </label>
        {!programmee && <p>
          {[0, 10, 15, 20, 30, 45, 60, 90, 120].map((n) => (
            <button key={n} type="button" className="bouton-secondaire" style={{ marginRight: 6, marginBottom: 6 }} onClick={() => maj("pretA", heurePlus(heure, n))}>{n === 0 ? "Maintenant" : n >= 60 ? `+${n / 60} h`.replace(".5 h", " h 30") : `+${n} min`}</button>
          ))}
        </p>}
        {(resto.formule === "B" || resto.formule === "AB") && <p className="tb-note">{dansSonCreneau(resto, jourCmd, f.pretA || heure) ? "🟢 Dans votre créneau réservé : prix B." : "Hors de vos créneaux réservés : prix A."}</p>}
        {f.adresse && (() => {
          if (!trajet) return <p className="tb-note">Calcul du prix…</p>;
          if (trajet.erreur || typeof trajet.km !== "number") return <p className="tb-note">Prix : Rebecca vous le confirme (distance impossible à calculer).</p>;
          const p = prixCommandeResto({ ...resto, cle }, jourCmd, f.pretA || heure, trajet.km, f.tresLourds, commandes);
          return (
            <p><strong>💰 Prix de la livraison : {p != null ? `${p} ₪` : "sur devis (longue distance)"}</strong>
              <span className="tb-note"> · {trajet.km} km{(resto.formule === "B" || resto.formule === "AB") ? (dansSonCreneau(resto, jourCmd, f.pretA || heure) ? " · prix B (créneau)" : " · prix A (hors créneau)") : ""}</span></p>
          );
        })()}
        <label>Articles très lourds (packs d'eau, cartons lourds) : +{tarifsResto(resto, jourCmd, f.pretA || heure).tresLourd ?? 5} ₪ chacun · sacs ordinaires gratuits<br />
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(f.tresLourds || 0)} onFocus={(e) => e.target.select()} onChange={(e) => maj("tresLourds", Math.max(0, Math.min(30, Number(e.target.value.replace(/\D/g, "")) || 0)))} style={{ width: 90 }} />
        </label>
        <br />
        <label>Note pour le livreur (facultatif)<br /><input value={f.note} maxLength={300} onChange={(e) => maj("note", e.target.value)} placeholder="Ex. : 3e étage, code 1234, payé" /></label>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <p>
          <button type="button" disabled={envoi || !possible.ok} onClick={envoyer}>{envoi ? "Envoi…" : "Envoyer la commande"}</button>{" "}
          <a className="bouton-secondaire" href={lienWhatsApp(WHATSAPP, messageWhatsAppResto(resto.nom, f, infosWhatsApp))} target="_blank" rel="noopener noreferrer" onClick={(e) => {
            // 25 nov. 2026 (Rebecca : message WhatsApp vide « Une livraison : ») : on n'envoie pas une commande vide
            if (!(f.adresse && f.adresse.label) && !String(f.client || "").trim()) { e.preventDefault(); setErreur("Remplissez d'abord la commande (client, adresse, heure) : le message WhatsApp la reprend. Une commande déjà envoyée avec « Envoyer la commande » n'a pas besoin de WhatsApp."); }
          }}>💬 Par WhatsApp</a>
        </p>
        <p className="tb-note">{programmee ? "Commande programmée : Rebecca vous répond dès qu'elle la voit (pas de refus automatique). Vous pouvez l'annuler tant qu'elle n'a pas répondu." : "Sans réponse en 5 minutes, la commande est refusée automatiquement : vous pouvez alors la confier à quelqu'un d'autre."}</p>
      </div>

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Aujourd'hui</strong>
        {duJour.length === 0 && <p className="tb-note">Aucune commande aujourd'hui.</p>}
        {duJour.map((c) => {
          const e = etatCommande(c, maintenant);
          return (
            <div key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 8, marginTop: 8 }}>
              <p><strong>{numeroCommande(c)}{c.prioritaire ? " ⚡" : ""} · {h(c.pretA)} · {c.client}</strong> · {c.adresse && c.adresse.label}</p>
              <p>
                {LIBELLES[e] || e}
                {e === "nouvelle" && ` · ${compteARebours(secondesRestantes(c, maintenant))}`}
                {(e === "acceptee" || e === "livree") && typeof c.prix === "number" ? ` · ${c.prix} ₪` : ""}
                {e === "acceptee" && c.arriveeVers ? ` · Rebecca arrive vers ${h(c.arriveeVers)}` : ""}
                {e === "acceptee" && c.par && c.par !== "Rebecca" ? ` · livrée par ${c.par}` : ""}
                {e === "refusee" && c.motif ? ` · ${c.motif}` : ""}
              </p>
              {e === "acceptee" && c.etape && <p className="tdb-note">🚗 {c.etape}</p>}
              {e === "nouvelle" && <button type="button" className="bouton-secondaire" onClick={() => annuler(c)}>Annuler cette commande</button>}
            </div>
          );
        })}
      </div>

      {aVenir.length > 0 && (
        <div className="carte-service" style={{ marginTop: 10 }}>
          <strong>📅 Commandes programmées</strong>
          {aVenir.map((c) => (
            <div key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 8, marginTop: 8 }}>
              <p><strong>{numeroCommande(c)} · {dfr(c.jour)} à {h(c.pretA)} · {c.client}</strong> · {c.adresse && c.adresse.label}</p>
              <p>{c.statut === "nouvelle" ? "⏳ En attente de la réponse de Rebecca" : LIBELLES[c.statut] || c.statut}{c.statut === "acceptee" && typeof c.prix === "number" ? ` · ${c.prix} ₪` : ""}{c.statut === "refusee" && c.motif ? ` · ${c.motif}` : ""}</p>
              {c.statut === "nouvelle" && <button type="button" className="bouton-secondaire" onClick={() => annuler(c)}>Annuler cette commande</button>}
            </div>
          ))}
        </div>
      )}

      <div className="carte-service" style={{ marginTop: 10 }}>
        <strong>Relevé de la semaine</strong>
        <p>
          <button type="button" className="bouton-secondaire" onClick={() => setSemaine(semaineDecalee(semaine, -1))}>←</button>{" "}
          du {dfr(r.debut)} au {dfr(r.fin)} · paiement le {dfr(r.paiementLe)}{" "}
          <button type="button" className="bouton-secondaire" onClick={() => setSemaine(semaineDecalee(semaine, 1))}>→</button>
        </p>
        {r.lignes.length === 0 ? <p className="tb-note">Aucune livraison faite cette semaine.</p> : (
          <ul>
            {r.lignes.map((l) => <li key={l.c.id}>{dfr(l.c.jour)} {h(l.c.pretA)} · {numeroCommande(l.c)} · {l.c.client} · {l.du} ₪{l.paye ? " · payé" : ""}</li>)}
          </ul>
        )}
        <p><strong>{r.nb} livraison{r.nb > 1 ? "s" : ""} · dû {r.du} ₪ · payé {r.paye} ₪ · reste {r.reste} ₪</strong></p>
        {resto.moyen && r.reste > 0 && <p className="tb-note">À régler par {resto.moyen}, le dimanche {dfr(r.paiementLe)}.</p>}
      </div>

      <MonMenu cle={cle} />
      <p><a className="bouton-secondaire" href={`#/assistance/resto/${cle}`}>💬 Assistance partenaires</a></p>
      <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
    </section>
  );
}
