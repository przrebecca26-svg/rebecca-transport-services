import { useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import CommandesRestoAdmin, { useCommandes, useRestos } from "./components/CommandesRestoAdmin.jsx";
import AddressField from "./components/AddressField.jsx";
import MenageRestos from "./components/MenageRestos.jsx";
import RelevesRestos from "./components/RelevesRestos.jsx";
import { LIBELLES, SUJETS_AIDE_RESTO, champsCorrectionCommande, etatCommande, messageAideResto, numeroCommande } from "./pricing/restos.js";
import { avecDelai, messageErreurSuppression, supprimerCommandeResto } from "./suppression.js";
import { lienAppel } from "./pricing/navigation.js";
import { utcVersLocal } from "./pricing/calendrier.js";
import { lienWhatsApp } from "./pricing/navigation.js";

// COMMANDES DES RESTAURANTS (19 nov. 2026, Rebecca) : un onglet dans le menu, avec une pastille, pour retrouver
// chaque commande des restaurants partenaires (en attente, acceptée, refusée, livrée) et tous ses détails.
// La notification « 🍕 Commande … » ouvre directement cet onglet. Lecture seule : on répond en haut de l'écran
// (carte de la commande, avec « En ligne »), et la livraison acceptée se gère dans le Calendrier.
const h = (x) => String(x || "").replace(":", "h");
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : d);
// 20 nov. 2026 (Rebecca) : À valider / En cours / Terminées, chaque commande se range toute seule
const FILTRES = [
  { v: "nouvelle", l: "À valider" },
  { v: "acceptee", l: "En cours" },
  { v: "livree", l: "Terminées" },
  { v: "refus", l: "Refusées / annulées" },
  { v: "tous", l: "Toutes" },
];
const dansFiltre = (f, e) => f === "tous" || (f === "refus" ? ["refusee", "expiree", "annulee"].includes(e) : e === f);

// Pastille du menu : commandes qui attendent une réponse
export function useCompteurCommandesResto(actif) {
  const restos = useRestos();
  const commandes = useCommandes(actif ? restos : []);
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return actif ? commandes.filter((c) => etatCommande(c, maintenant) === "nouvelle").length : 0;
}

export default function CommandesResto({ aller }) {
  const restos = useRestos();
  const commandes = useCommandes(restos);
  const [filtre, setFiltre] = useState("");
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const nom = (cle) => (restos.find((r) => r.cle === cle) || {}).nom || "Restaurant";
  const avecEtat = commandes.map((c) => ({ ...c, etat: etatCommande(c, maintenant) }));
  // Onglet ouvert : « À valider » s'il y en a, sinon « En cours »
  const vu = filtre || (avecEtat.some((c) => c.etat === "nouvelle") ? "nouvelle" : "acceptee");
  const plusTotDabord = vu === "nouvelle" || vu === "acceptee";
  const liste = avecEtat
    .filter((c) => dansFiltre(vu, c.etat))
    .sort((a, b) => (plusTotDabord ? 1 : -1) * (String(a.jour) + String(a.pretA)).localeCompare(String(b.jour) + String(b.pretA)));
  const jours = [...new Set(liste.map((c) => c.jour))];
  const aujourdhui = utcVersLocal(maintenant).date;

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Commandes restaurants</h1>
        <p className="tdb-sous">Tout ce qui concerne les restaurants est ici, à part de Rebecca Services : « En ligne », commandes WhatsApp, et chaque commande sur 14 jours (modifier, annuler, supprimer, demander une info).</p>
      </div>
      <CommandesRestoAdmin aller={aller} carte={false} />
      <div className="tb-filtres" role="tablist" aria-label="Commandes">
        {FILTRES.map((f) => (
          <button key={f.v} role="tab" aria-selected={vu === f.v} className={"tb-filtre" + (vu === f.v ? " actif" : "")} onClick={() => setFiltre(f.v)}>
            {f.l} <span>{avecEtat.filter((c) => dansFiltre(f.v, c.etat)).length}</span>
          </button>
        ))}
      </div>
      {!restos.length && <p className="tdb-note tb-pad">Aucun restaurant partenaire avec un lien actif.</p>}
      {restos.length > 0 && liste.length === 0 && <p className="tdb-note tb-pad">Aucune commande ici pour l'instant.</p>}
      {jours.map((j) => (
        <section key={j} className="tdb-bloc">
          <h2>{j === aujourdhui ? "Aujourd'hui" : jourFr(j)}</h2>
          {liste.filter((c) => c.jour === j).map((c) => <LigneCommande key={c.cle + c.id} c={c} resto={restos.find((r) => r.cle === c.cle)} nomResto={nom(c.cle)} aller={aller} />)}
        </section>
      ))}
      {restos.length > 0 && <RelevesRestos restos={restos} commandes={commandes} />}
      <MenageRestos />
    </div>
  );
}

// Une commande avec ses boutons (22 nov. 2026, Rebecca) : modifier, annuler, supprimer, demander une info / assistance
export function LigneCommande({ c, resto, nomResto, aller }) {
  const [mode, setMode] = useState("");
  const [f, setF] = useState(null);
  const [prix, setPrix] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const telResto = (resto && resto.telephone) || "";
  const ouvrir = (m) => {
    setInfo("");
    if (m === "modifier") {
      setF({ client: c.client || "", telClient: c.telClient || "", adresse: c.adresse || null, pretA: c.pretA || "", jour: c.jour || "", note: c.note || "", tresLourds: c.tresLourds || 0, numero: c.numero || "", prioritaire: c.prioritaire === true });
      setPrix(typeof c.prix === "number" ? String(c.prix) : "");
    }
    setMode(mode === m ? "" : m);
  };
  const enregistrer = async () => {
    const r = champsCorrectionCommande(c, f, prix);
    if (r.erreur) return setInfo(r.erreur);
    setEnCours(true);
    try {
      await updateDoc(doc(db, "restos", c.cle, "commandesResto", c.id), r.commande);
      if (c.demandeId) await updateDoc(doc(db, "demandes", c.demandeId), { ...r.demande, majLe: serverTimestamp() }).catch(() => {});
      setMode("");
      setInfo("✓ Commande corrigée (et sa livraison dans le Calendrier).");
    } catch {
      setInfo("Correction impossible : vérifie la connexion et que les règles Firebase v35 sont publiées.");
    }
    setEnCours(false);
    return undefined;
  };
  const annuler = async () => {
    setEnCours(true);
    try {
      await updateDoc(doc(db, "restos", c.cle, "commandesResto", c.id), { statut: "annulee", motif: "Annulée par Rebecca", reponduLe: serverTimestamp() });
      if (c.demandeId) await deleteDoc(doc(db, "demandes", c.demandeId)).catch(() => {});
      setMode("");
    } catch {
      setInfo("Annulation impossible pour l'instant.");
    }
    setEnCours(false);
  };
  const supprimer = async () => {
    setEnCours(true);
    setInfo("Suppression en cours…");
    try {
      await avecDelai(supprimerCommandeResto(c));
      setMode("");
      setInfo("✓ Supprimée.");
    } catch (e) {
      setInfo(messageErreurSuppression(e));
    }
    setEnCours(false);
  };
  const lien = (sujet) => {
    const s = SUJETS_AIDE_RESTO.find((x) => x.id === sujet);
    const tel = s && s.vers === "client" ? c.telClient : telResto;
    return tel ? lienWhatsApp(tel, messageAideResto(sujet, nomResto, c)) : null;
  };
  const maj = (k, v) => setF({ ...f, [k]: v });
  return (
    <div className="bloc">
      <p className="rp-type">🍕 {nomResto} · {numeroCommande(c)}{c.prioritaire ? " · ⚡ prioritaire" : ""} · prête à {h(c.pretA)}{c.programmee ? " · 📅 programmée" : ""}</p>
      <p><strong>{LIBELLES[c.etat] || c.etat}</strong>{typeof c.prix === "number" ? ` · ${c.prix} ₪` : ""}{typeof c.km === "number" ? ` · ${String(c.km).replace(".", ",")} km` : ""}{c.par ? ` · par ${c.par}` : ""}{c.source === "whatsapp" ? " · saisie WhatsApp" : ""}{c.payee ? " · payée ✓" : ""}</p>
      <p>👤 {c.client || "Client"}{c.telClient ? <> · <a className="rp-waze" href={lienAppel(c.telClient)}>{c.telClient}</a></> : null}</p>
      {c.adresse && c.adresse.label && <p>🏠 {c.adresse.label}</p>}
      {c.note && <p className="tdb-note">📝 {c.note}</p>}
      {c.tresLourds > 0 && <p className="tdb-note">📦 {c.tresLourds} article{c.tresLourds > 1 ? "s" : ""} très lourd{c.tresLourds > 1 ? "s" : ""}</p>}
      {c.motif && <p className="tdb-note">Motif : {c.motif}</p>}
      {c.etat === "acceptee" && c.etape && <p className="tdb-note">🚗 {c.etape}</p>}
      {c.etat === "nouvelle" && <p className="tdb-note">{c.programmee ? "Réponds avec la carte en bas de l'écran (pas de délai)." : "Passe « 🟢 En ligne » : la carte pour répondre apparaît en bas de l'écran."}</p>}
      <div className="rp-boutons">
        {c.etat === "acceptee" && <button type="button" className="rp-waze" onClick={() => aller("agenda")}>📅 Calendrier</button>}
        {["nouvelle", "acceptee"].includes(c.etat) && <button type="button" className="rp-waze" onClick={() => ouvrir("modifier")}>✏️ Modifier</button>}
        <button type="button" className="rp-waze" onClick={() => ouvrir("aide")}>🛟 Info / assistance</button>
        {c.etat === "acceptee" && <button type="button" className="rp-waze" onClick={() => ouvrir("annuler")}>✗ Annuler</button>}
        <button type="button" className="rp-waze" onClick={() => ouvrir("supprimer")}>🗑 Supprimer</button>
      </div>
      {mode === "aide" && (
        <div className="rp-boutons">
          {SUJETS_AIDE_RESTO.map((x) => {
            const l = lien(x.id);
            return l ? <a key={x.id} className="rp-waze" href={l} target="_blank" rel="noopener noreferrer">{x.libelle}</a> : null;
          })}
          {telResto && <a className="rp-waze" href={lienAppel(telResto)}>📞 Appeler le restaurant</a>}
          {c.telClient && <a className="rp-waze" href={lienAppel(c.telClient)}>📞 Appeler le client</a>}
          {!telResto && <p className="tdb-note">Le restaurant n'a pas de téléphone dans sa fiche (Répertoire).</p>}
        </div>
      )}
      {mode === "annuler" && (
        <div className="rp-boutons">
          <span className="tdb-note">Annuler cette livraison ? Elle sort du Calendrier ; le restaurant voit « annulée ».</span>
          <button type="button" className="rp-waze" disabled={enCours} onClick={annuler}>Oui, annuler</button>
          <button type="button" className="rp-waze" onClick={() => setMode("")}>Non</button>
        </div>
      )}
      {mode === "supprimer" && (
        <div className="rp-boutons">
          <span className="tdb-note">Supprimer pour de bon (test, erreur) ? La commande, sa livraison du Calendrier et ses paiements partent, sans trace.</span>
          <button type="button" className="rp-waze" disabled={enCours} onClick={supprimer}>{enCours ? "Suppression…" : "Oui, supprimer"}</button>
          <button type="button" className="rp-waze" onClick={() => setMode("")}>Non</button>
        </div>
      )}
      {mode === "modifier" && f && (
        <div className="tdb-bloc">
          <label className="champ">N° de commande du restaurant<input value={f.numero} maxLength={20} onChange={(e) => maj("numero", e.target.value)} /></label>
          <label className="champ" style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={!!f.prioritaire} onChange={(e) => maj("prioritaire", e.target.checked)} style={{ width: 22, height: 22 }} /> ⚡ Prioritaire</label>
          <label className="champ">Prénom du client<input value={f.client} maxLength={60} onChange={(e) => maj("client", e.target.value)} /></label>
          <label className="champ">Téléphone du client<input inputMode="tel" value={f.telClient} maxLength={20} onChange={(e) => maj("telClient", e.target.value)} /></label>
          <label className="champ" htmlFor={"cr-ad-" + c.id}>Adresse de livraison</label>
          <AddressField id={"cr-ad-" + c.id} valeur={f.adresse} position={false} onChange={(v) => maj("adresse", v)} />
          <label className="champ">Jour<input type="date" value={f.jour} onChange={(e) => maj("jour", e.target.value)} /></label>
          <label className="champ">Prête à<input type="time" value={f.pretA} onChange={(e) => maj("pretA", e.target.value)} /></label>
          <label className="champ">Articles très lourds<input type="text" inputMode="numeric" value={String(f.tresLourds || 0)} onChange={(e) => maj("tresLourds", Math.min(30, Number(e.target.value.replace(/\D/g, "")) || 0))} /></label>
          <label className="champ">Note<input value={f.note} maxLength={300} onChange={(e) => maj("note", e.target.value)} /></label>
          <label className="champ">Prix de la livraison (₪)<input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value.replace(/[^0-9.,]/g, ""))} /></label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours} onClick={enregistrer}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setMode("")}>Fermer</button>
          </div>
        </div>
      )}
      {info && <p className="tdb-note" role="status">{info}</p>}
    </div>
  );
}
