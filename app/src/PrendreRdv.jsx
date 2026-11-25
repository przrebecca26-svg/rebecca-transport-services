import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { enregistrerDemande } from "./demandes.js";
import { CATALOGUE_DEPART } from "./pricing/catalogue.js";
import { cellulesDe } from "./pricing/rendezvous.js";
import { entreesRepertoire, filtrerEntrees } from "./pricing/fichesRepertoire.js";
import { useFichesClientes } from "./Repertoire.jsx";
import ChoixAge from "./components/ChoixAge.jsx";

// PRENDRE UN RENDEZ-VOUS (25 nov. 2026) - Rebecca : « je n'ai pas l'onglet prendre rdv à la place de la cliente ;
// ajouter une tâche ne remplit pas bien : pas de prestation, pas de prix ». Comme un devis : je choisis la fiche
// (ou je crée la cliente), l'activité, la prestation ; prix et durée se remplissent et restent modifiables.
// Le rendez-vous bloque le créneau, arrive dans le Calendrier et s'encaisse avec « 💰 Encaissé ».
const ACTIVITES = [
  { id: "nails", titre: "Nails Prestige" },
  { id: "hair", titre: "Prestige Hair" },
  { id: "slim", titre: "Prestige Slim & Lift" },
  { id: "regenx", titre: "RegenX" },
];
const MOYENS = ["Espèces", "Bit", "Revolut", "PayPal", "Carte bancaire", "Virement"];
const jourJ = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function PrendreRdv() {
  const fc = useFichesClientes();
  const [catalogue, setCatalogue] = useState(null);
  useEffect(() => onSnapshot(collection(db, "catalogue"), (s) => setCatalogue(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setCatalogue([])), []);
  const [texte, setTexte] = useState("");
  const [client, setClient] = useState(null); // { nom, telephone, age, nouvelle }
  const [f, setF] = useState({ activite: "nails", prestation: "", prix: "", duree: "", date: jourJ(), heure: "10:00", moyen: "Espèces", notes: "", faite: false, recu: "" });
  const [etat, setEtat] = useState({ enCours: false, msg: "", ok: false });
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const entrees = useMemo(() => entreesRepertoire(fc.familles || [], fc.fiches, fc.categories), [fc.familles, fc.fiches, fc.categories]);
  const trouvees = texte.trim().length >= 2 ? filtrerEntrees(entrees, "tous", texte).slice(0, 8) : [];
  const liste = (catalogue && catalogue.length ? catalogue : CATALOGUE_DEPART).filter((p) => p.activite === f.activite && !p.option);
  const choisirPrestation = (nom) => {
    const p = liste.find((x) => x.nom === nom);
    setF((x) => ({ ...x, prestation: nom, prix: p && p.prix != null ? String(p.prix) : x.prix, duree: p && p.dureeMinutes ? String(p.dureeMinutes) : x.duree }));
  };

  const enregistrer = async (forcer = false) => {
    const prix = Number(String(f.prix).replace(",", "."));
    const duree = Number(f.duree) || 60;
    if (!client || !String(client.nom || "").trim()) return setEtat({ msg: "Choisis la fiche de la cliente (ou crée-la)." });
    if (!f.prestation) return setEtat({ msg: "Choisis la prestation." });
    if (!(prix >= 0)) return setEtat({ msg: "Prix invalide (0 = gratuit)." });
    const act = ACTIVITES.find((a) => a.id === f.activite);
    const cellules = cellulesDe(f.heure, duree, 0);
    const demande = {
      service: f.activite,
      serviceTitre: `${act.titre} – ${f.prestation}`,
      date: f.date,
      heure: f.heure,
      nom: String(client.nom).trim().slice(0, 100),
      telephone: String(client.telephone || "").trim().slice(0, 30),
      moyenPaiement: f.moyen,
      prixEstime: null,
      prixFinal: prix,
      surDevis: false,
      details: { prestation: f.prestation, duree, cellules, ...(client.age ? { age: client.age } : {}), ...(f.notes.trim() ? { notes: f.notes.trim().slice(0, 500) } : {}) },
      message: `Rendez-vous pris par Rebecca : ${act.titre} – ${f.prestation}, le ${f.date.split("-").reverse().join("/")} à ${f.heure.replace(":", "h")}, ${prix} ₪.`,
      statut: f.faite ? "terminee" : "acceptee",
      source: "manuel",
      kmEstime: null,
      minutesEstimees: duree,
    };
    setEtat({ enCours: true, msg: "" });
    try {
      await enregistrerDemande(demande, forcer ? {} : { verrou: { date: f.date, cellules } });
      setEtat({ ok: true, msg: `✓ Rendez-vous enregistré : il est dans le Calendrier du ${f.date.split("-").reverse().join("/")} à ${f.heure.replace(":", "h")}.` });
    } catch (e) {
      if (e && e.code === "creneau-pris") return setEtat({ msg: "Ce créneau est déjà pris sur le site.", conflit: true });
      setEtat({ msg: "Enregistrement impossible (connexion ?)." });
    }
  };

  if (etat.ok) {
    return (
      <section className="tb-liste">
        <div className="tb-bloc"><p>{etat.msg}</p>
          <div className="tb-actions"><button className="tb-bouton" onClick={() => { setEtat({}); setClient(null); setTexte(""); maj("prestation", ""); }}>Prendre un autre rendez-vous</button></div>
          <p className="tb-note">Pour l'encaisser : Calendrier → le rendez-vous → « 💰 Encaissé ».</p>
        </div>
      </section>
    );
  }
  return (
    <section className="tb-liste">
      <div className="tb-bloc">
        <h3>1. La cliente</h3>
        {client ? (
          <p><strong>{client.nom}</strong> {client.telephone && `· ${client.telephone}`} <button type="button" className="tb-bouton tb-clair" onClick={() => setClient(null)}>Changer</button></p>
        ) : (
          <>
            <input type="search" placeholder="Nom, prénom ou téléphone (ex. Debo)" value={texte} onChange={(e) => setTexte(e.target.value)} />
            {trouvees.map((e) => (
              <button key={e.cle} type="button" className="tb-carte" style={{ width: "100%", textAlign: "left" }} onClick={() => setClient({ nom: e.nom, telephone: e.telephone || "" })}>
                <span className="tb-ligne"><strong>{e.nom}</strong><span>{e.telephone}</span></span>
              </button>
            ))}
            {texte.trim().length >= 2 && !trouvees.length && <p className="tb-note">Aucune fiche trouvée.</p>}
            <button type="button" className="tb-bouton tb-clair" onClick={() => setClient({ nom: texte.trim(), telephone: "", nouvelle: true })}>＋ Nouvelle cliente</button>
          </>
        )}
        {client && client.nouvelle && (
          <>
            <label className="champ">Nom et prénom<input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} /></label>
            <label className="champ">Téléphone<input inputMode="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} /></label>
            <ChoixAge valeur={client.age || ""} changer={(v) => setClient({ ...client, age: v })} />
            <p className="tb-note">Sa fiche se crée toute seule avec ce rendez-vous.</p>
          </>
        )}
      </div>
      <div className="tb-bloc">
        <h3>2. Le rendez-vous</h3>
        <label className="champ">Activité
          <select value={f.activite} onChange={(e) => setF({ ...f, activite: e.target.value, prestation: "", prix: "", duree: "" })}>{ACTIVITES.map((a) => <option key={a.id} value={a.id}>{a.titre}</option>)}</select>
        </label>
        <label className="champ">Prestation
          <select value={f.prestation} onChange={(e) => choisirPrestation(e.target.value)}>
            <option value="">— choisir —</option>
            {liste.map((p) => <option key={p.id || p.nom} value={p.nom}>{p.nom}{p.prix != null ? ` · ${p.prix} ₪` : ""}</option>)}
          </select>
        </label>
        <label className="champ">Prix (₪, modifiable, 0 = offert)<input inputMode="decimal" value={f.prix} onChange={(e) => maj("prix", e.target.value)} /></label>
        <label className="champ">Durée (minutes)<input inputMode="numeric" value={f.duree} onChange={(e) => maj("duree", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="champ">Date<input type="date" value={f.date} onChange={(e) => maj("date", e.target.value)} /></label>
        <label className="champ">Heure<input type="time" value={f.heure} onChange={(e) => maj("heure", e.target.value)} /></label>
        <label className="champ">Paiement prévu<select value={f.moyen} onChange={(e) => maj("moyen", e.target.value)}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="champ">Note (facultatif)<input value={f.notes} onChange={(e) => maj("notes", e.target.value)} /></label>
        <label className="rg-case" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.faite} onChange={(e) => maj("faite", e.target.checked)} /> Déjà fait</label>
        {etat.msg && <p className="fm-erreur" role="alert">{etat.msg}</p>}
        <div className="tb-actions">
          <button type="button" className="tb-bouton" disabled={etat.enCours} onClick={() => enregistrer(false)}>{etat.enCours ? "Enregistrement…" : "Enregistrer le rendez-vous"}</button>
          {etat.conflit && <button type="button" className="tb-bouton tb-clair" onClick={() => enregistrer(true)}>Enregistrer quand même</button>}
        </div>
      </div>
    </section>
  );
}
