import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { lienPaye } from "./pricing/suiteClient.js";
import { CATALOGUE_DEPART, libellePrix } from "./pricing/catalogue.js";
import { envoyerMailClient } from "./mailClient.js";
import {
  FORMULES, MAINTENANCES, PRIX_MAX_DEMANDE, QUESTIONS_DOSSIER, REGLE_D4, STATUTS, STATUTS_ACTIFS, aFournir, avancement, bilanEcheances, cahierDepuisTexte,
  cahierPropre, demandeEcheance, devisAutomatique, echeancier, enHeures, etatEcheance, finGarantie, libelleStatut, lienProjet, lignesPropres, maintenanceDuMois, messageDevis,
  messageLienSuivi, messagePaiementEcheance, prixConseille, resumeDemandeDigital, totalDevis,
} from "./pricing/digital.js";
import "./digital.css";

// PROJETS DIGITAL (17 nov. 2026) - espace prive de Rebecca (jamais un coequipier)
// Demandes du questionnaire, statut, devis (lignes du catalogue + regle des heures), echeancier 40 / 30 / 30,
// cahier des charges a cocher (visible par le client sur son lien), livraison et garantie de 60 jours, maintenance.
// Chaque paiement demande devient une « course » Digital terminee : il compte dans Finances et le tableau de bord.
// Les notes privees et les heures restent dans projetsDigitalPrive (jamais lisibles par le client).
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (x) => `${String(Math.round((Number(x) || 0) * 100) / 100).replace(".", ",")} ₪`;
const MOYENS = ["Virement", "Bit", "PayPal", "Revolut", "Espèces", "Carte bancaire"];
const quand = (t) => (t && t.toDate ? t.toDate().toLocaleDateString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit" }) : "");

export default function ProjetsDigital() {
  const [projets, setProjets] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  const [catalogue, setCatalogue] = useState(null); // attendu avant d'ouvrir une fiche (devis automatique)
  const [choisi, setChoisi] = useState(null);
  const [filtre, setFiltre] = useState("actifs");
  const [erreur, setErreur] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "projetsDigital"), orderBy("creeLe", "desc")), (s) => setProjets(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setErreur("Lecture impossible : as-tu collé les règles Firebase v19 ?")), []);
  useEffect(() => onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  useEffect(
    () =>
      onSnapshot(query(collection(db, "catalogue"), where("activite", "==", "digital")), (s) => {
        const l = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCatalogue(l.length ? l : CATALOGUE_DEPART.filter((p) => p.activite === "digital"));
      }, () => setCatalogue(CATALOGUE_DEPART.filter((p) => p.activite === "digital"))),
    []
  );

  if (erreur) return <p className="admin-texte tb-pad">{erreur}</p>;
  if (!projets || !catalogue) return <p className="admin-texte tb-pad">Chargement…</p>;
  const projet = choisi && projets.find((p) => p.id === choisi);
  if (projet) return <FicheProjet key={projet.id} p={projet} projets={projets} mouvements={mouvements} catalogue={catalogue} onRetour={() => setChoisi(null)} />;

  const liste = projets.filter((p) => filtre === "tous" || (filtre === "nouvelles" ? p.statut === "nouvelle" : STATUTS_ACTIFS.includes(p.statut)));
  const gros = projets.filter((p) => ["devis_accepte", "en_cours", "a_valider"].includes(p.statut) && p.formule !== "Essentielle").length;
  return (
    <section className="tb-pad">
      <div className="tb-bloc">
        <h3>Projets Digital</h3>
        <p className="tb-note">Les demandes de devis du site arrivent ici. Chaque client a un lien de suivi personnel (statut, devis, paiements, cahier des charges).</p>
        {gros > 1 && <p className="dm-verif dm-alerte">⚠️ {gros} gros projets en même temps : ta règle est un gros projet à la fois (+ un petit si possible).</p>}
        <div className="tb-filtres">
          {[["actifs", "En cours"], ["nouvelles", "Nouvelles demandes"], ["tous", "Tous"]].map(([v, l]) => (
            <button key={v} className={"tb-bouton" + (filtre === v ? "" : " tb-clair")} onClick={() => setFiltre(v)}>{l}</button>
          ))}
        </div>
        {liste.length === 0 && <p className="tb-note">Aucun projet ici pour l'instant.</p>}
        {liste.map((p) => {
          const b = bilanEcheances(p.echeances, mouvements);
          return (
            <button key={p.id} className="tb-adresse dg-liste-projet" onClick={() => setChoisi(p.id)}>
              <div>
                <p>{p.entreprise || p.nom}{p.entreprise ? ` · ${p.nom}` : ""}</p>
                <small>{libelleStatut(p.statut)}{p.formule ? ` · ${p.formule}` : p.formuleConseillee ? ` · conseillée : ${p.formuleConseillee}` : ""} · {quand(p.creeLe)}</small>
              </div>
              <small>{b.total ? `${shekels(b.recu)} / ${shekels(b.total)}` : p.budget || ""}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FicheProjet({ p, projets, mouvements, catalogue, onRetour }) {
  // 17 nov. 2026 : sans devis enregistre, la fiche propose tout de suite le devis calcule a partir des reponses du client
  const auto = useMemo(() => devisAutomatique(p, catalogue), [p, catalogue]);
  const dejaDevis = lignesPropres(p.lignesDevis).length > 0;
  const [f, setF] = useState(() => ({
    statut: p.statut,
    formule: p.formule || (dejaDevis ? p.formuleConseillee || "" : auto.formule),
    lignesDevis: dejaDevis ? lignesPropres(p.lignesDevis) : auto.lignes,
    devisNote: p.devisNote || "",
    cahier: cahierPropre(p.cahier),
    consultation: { date: (p.consultation && p.consultation.date) || "", heure: (p.consultation && p.consultation.heure) || "" },
    livraisonLe: p.livraisonLe || "",
    maintenance: { niveau: (p.maintenance && p.maintenance.niveau) || "", interventions: (p.maintenance && p.maintenance.interventions) || [] },
    messageClient: p.messageClient || "",
  }));
  const [prive, setPrive] = useState({ notes: "", heures: dejaDevis ? "" : String(auto.heures || ""), taux: String(REGLE_D4.taux) });
  const [priveCharge, setPriveCharge] = useState(false);
  const [modifie, setModifie] = useState(!dejaDevis);
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [ajout, setAjout] = useState("");
  const [colle, setColle] = useState("");
  const [moyen, setMoyen] = useState("Virement");
  const [inter, setInter] = useState({ date: aujourdhui(), minutes: "", texte: "" });
  const [supprimer, setSupprimer] = useState(false);

  useEffect(
    () =>
      onSnapshot(doc(db, "projetsDigitalPrive", p.id), (s) => {
        if (s.exists() && !priveCharge) {
          const d = s.data();
          setPrive((x) => ({ notes: d.notes || "", heures: d.heures != null ? String(d.heures) : x.heures, taux: d.taux != null ? String(d.taux) : String(REGLE_D4.taux) }));
        }
        setPriveCharge(true);
      }, () => setPriveCharge(true)),
    [p.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Paiement confirme ailleurs (Aujourd'hui → « J'ai payé » de la cliente) : on marque l'echeance payee pour le client
  const echeances = Array.isArray(p.echeances) ? p.echeances : [];
  useEffect(() => {
    if (!echeances.some((e) => !e.payeLe && etatEcheance(e, mouvements).etat === "paye")) return;
    const maj = echeances.map((e) => (!e.payeLe && etatEcheance(e, mouvements).etat === "paye" ? { ...e, payeLe: aujourdhui() } : e));
    updateDoc(doc(db, "projetsDigital", p.id), { echeances: maj, majLe: serverTimestamp() }).catch(() => {});
  }, [mouvements, p.echeances]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    setF((x) => ({ ...x, [k]: v }));
    setModifie(true);
    setInfo("");
  };
  const lignes = f.lignesDevis;
  const total = totalDevis(lignes);
  const conseille = prixConseille(prive.heures, prive.taux);
  const av = avancement(f.cahier);
  const mois = aujourdhui().slice(0, 7);
  const maint = maintenanceDuMois(f.maintenance, mois);
  const manque = aFournir(p.dossier, f.formule);
  const bilan = bilanEcheances(echeances, mouvements);
  const autresGros = projets.filter((x) => x.id !== p.id && ["devis_accepte", "en_cours", "a_valider"].includes(x.statut) && x.formule !== "Essentielle").length;
  const triCatalogue = useMemo(() => [...catalogue].sort((a, b) => String(a.categorie).localeCompare(String(b.categorie)) || (a.ordre ?? 0) - (b.ordre ?? 0)), [catalogue]);

  const champsPublics = () => ({
    statut: f.statut,
    formule: FORMULES.includes(f.formule) ? f.formule : "",
    lignesDevis: lignesPropres(f.lignesDevis),
    totalDevis: totalDevis(f.lignesDevis),
    devisNote: String(f.devisNote || "").slice(0, 1500),
    cahier: cahierPropre(f.cahier),
    consultation: { date: f.consultation.date || "", heure: f.consultation.heure || "" },
    livraisonLe: f.livraisonLe || "",
    maintenance: { niveau: MAINTENANCES.includes(f.maintenance.niveau) ? f.maintenance.niveau : "", interventions: (f.maintenance.interventions || []).slice(-60) },
    messageClient: String(f.messageClient || "").slice(0, 1000),
    majLe: serverTimestamp(),
  });
  const action = async (fn, ok) => {
    setEnCours(true);
    setInfo("");
    try {
      await fn();
      setInfo(ok);
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion (et les règles Firebase v19).");
    }
    setEnCours(false);
  };
  const enregistrer = (extra = {}, ok = "Enregistré ✓ Le client voit la mise à jour sur son lien.") =>
    action(async () => {
      await updateDoc(doc(db, "projetsDigital", p.id), { ...champsPublics(), ...extra });
      await setDoc(doc(db, "projetsDigitalPrive", p.id), { notes: prive.notes.slice(0, 5000), heures: Number(String(prive.heures).replace(",", ".")) || null, taux: Number(prive.taux) || REGLE_D4.taux, majLe: serverTimestamp() });
      setModifie(false);
    }, ok);

  const ajouterLigne = (id) => {
    const x = catalogue.find((c) => c.id === id);
    if (!x) return;
    set("lignesDevis", [...lignes, { libelle: x.nom, montant: typeof x.prix === "number" ? x.prix : 0 }]);
    setAjout("");
  };
  const changerLigne = (i, k, v) => set("lignesDevis", lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const wa = (texte) => lienWhatsApp(p.telephone, texte);
  const envoyerDevis = () => {
    const texte = messageDevis({ ...p, ...champsPublics(), id: p.id });
    enregistrer({ statut: "devis_envoye", devisEnvoyeLe: serverTimestamp() }, "Devis enregistré et marqué « envoyé ».");
    setF((x) => ({ ...x, statut: "devis_envoye" }));
    envoyerMailClient(p, "Votre devis - Rebecca Services", texte).then((x) => x && setInfo((i) => `${i} ${x}`)).catch(() => {});
  };

  const creerEcheancier = () => {
    const e = echeancier(total);
    if (!e.length) return setInfo("Le devis est vide : ajoute ses lignes d'abord.");
    if (e.some((x) => x.montant > PRIX_MAX_DEMANDE)) return setInfo(`Une échéance dépasse ${shekels(PRIX_MAX_DEMANDE)} : découpe le projet ou préviens Claude.`);
    action(() => updateDoc(doc(db, "projetsDigital", p.id), { echeances: e, majLe: serverTimestamp() }), "Échéancier 40 / 30 / 30 créé ✓");
  };
  // Demander un paiement : une course Digital « terminee » (comptee dans Finances, reste a encaisser) + lien de paiement
  const demanderPaiement = (i) =>
    action(async () => {
      const e = echeances[i];
      const lot = writeBatch(db);
      const ref = doc(collection(db, "demandes"));
      lot.set(ref, { ...demandeEcheance(p, e, i, aujourdhui()), creeLe: serverTimestamp(), majLe: serverTimestamp() });
      lot.update(doc(db, "projetsDigital", p.id), { echeances: echeances.map((x, j) => (j === i ? { ...x, demandeId: ref.id, demandeLe: aujourdhui() } : x)), majLe: serverTimestamp() });
      await lot.commit();
      const texte = messagePaiementEcheance(p, e, lienPaye({ id: ref.id, nom: p.nom }, e.montant, i === 0 ? "acompte" : "solde"));
      window.open(wa(texte), "_blank", "noopener");
      envoyerMailClient(p, "Paiement de votre projet - Rebecca Services", texte).catch(() => {});
    }, "Paiement demandé ✓ Il compte dans tes finances (reste à encaisser jusqu'au paiement).");
  const recu = (i) =>
    action(async () => {
      const e = echeances[i];
      const r = etatEcheance(e, mouvements);
      if (r.reste > 0) await addDoc(collection(db, "mouvements"), { kind: "paiement", resId: e.demandeId, date: aujourdhui(), montant: r.reste, moyen, creeLe: serverTimestamp() });
      await updateDoc(doc(db, "projetsDigital", p.id), { echeances: echeances.map((x, j) => (j === i ? { ...x, payeLe: aujourdhui() } : x)), majLe: serverTimestamp() });
    }, "Paiement noté ✓");

  const ajouterIntervention = () => {
    const minutes = Math.round(Number(String(inter.minutes).replace(",", ".")) || 0);
    if (!(minutes > 0) || !inter.texte.trim()) return setInfo("Indique la durée (minutes) et ce qui a été fait.");
    set("maintenance", { ...f.maintenance, interventions: [...(f.maintenance.interventions || []), { date: inter.date, minutes, texte: inter.texte.trim().slice(0, 200) }] });
    setInter({ date: aujourdhui(), minutes: "", texte: "" });
  };

  return (
    <section className="tb-pad">
      <button className="tb-retour aj-lien" onClick={onRetour}>← Tous les projets</button>

      <div className="tb-bloc">
        <h3>{p.entreprise || p.nom}</h3>
        <p className="tb-note">{p.nom} · <a href={`tel:${p.telephone}`}>{p.telephone}</a> · <a href={`mailto:${p.email}`}>{p.email}</a> · reçu le {quand(p.creeLe)}</p>
        <p className="tb-note" style={{ whiteSpace: "pre-line" }}>{resumeDemandeDigital(p)}</p>
        <div className="tb-actions">
          <a className="tb-bouton" href={wa(`Bonjour ${String(p.nom).split(" ")[0]}, c'est Rebecca au sujet de votre projet Digital & Applications.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="tb-bouton tb-clair" href={wa(messageLienSuivi(p))} target="_blank" rel="noopener noreferrer" onClick={() => envoyerMailClient(p, "Le suivi de votre projet - Rebecca Services", messageLienSuivi(p)).catch(() => {})}>Envoyer son lien de suivi</a>
          <a className="tb-bouton tb-clair" href={`#/projet/${p.id}`} target="_blank" rel="noopener noreferrer">Voir comme le client</a>
        </div>
        <p className="tb-note" style={{ wordBreak: "break-all" }}>{lienProjet(p.id)}</p>
      </div>

      <div className="tb-bloc">
        <h3>Statut</h3>
        <label className="pm-champ">Où en est le projet
          <select value={f.statut} onChange={(e) => set("statut", e.target.value)}>
            {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.l}</option>)}
          </select>
        </label>
        {autresGros > 0 && ["devis_accepte", "en_cours"].includes(f.statut) && f.formule !== "Essentielle" && <p className="dm-verif dm-alerte">⚠️ Tu as déjà {autresGros} gros projet en cours.</p>}
        <div className="tb-ligne">
          <label className="pm-champ">Consultation gratuite : date<input type="date" value={f.consultation.date} onChange={(e) => set("consultation", { ...f.consultation, date: e.target.value })} /></label>
          <label className="pm-champ">Heure<input type="time" value={f.consultation.heure} onChange={(e) => set("consultation", { ...f.consultation, heure: e.target.value })} /></label>
        </div>
        <label className="pm-champ">Message visible par le client (facultatif)
          <textarea rows={2} maxLength={1000} value={f.messageClient} onChange={(e) => set("messageClient", e.target.value)} placeholder="Ex : je vous envoie la première version jeudi." />
        </label>
      </div>

      <div className="tb-bloc">
        <h3>Devis</h3>
        {!dejaDevis && <p className="tb-note">✨ Devis proposé automatiquement d'après les réponses du client (formule, fonctions demandées, prix du catalogue). Vérifie, ajuste si besoin, puis « Enregistrer ».</p>}
        {auto.notes.map((n, i) => <p key={i} className="dm-verif dm-alerte">{n}</p>)}
        <button className="tb-bouton tb-clair" onClick={() => { const a = devisAutomatique(p, catalogue, Number(prive.taux) || REGLE_D4.taux); setF((x) => ({ ...x, formule: a.formule, lignesDevis: a.lignes })); setPrive((x) => ({ ...x, heures: String(a.heures || "") })); setModifie(true); setInfo("Devis recalculé à partir des réponses du client ✓ Pense à « Enregistrer »."); }}>✨ Recalculer le devis automatiquement</button>
        <label className="pm-champ">Formule
          <select value={f.formule} onChange={(e) => set("formule", e.target.value)}>
            <option value="">—</option>
            {FORMULES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <p className="aj-sous-titre">Calcul des heures (privé, jamais montré au client) : rempli tout seul, tu peux le changer</p>
        <div className="tb-ligne">
          <label className="pm-champ">Heures estimées<input inputMode="decimal" value={prive.heures} onChange={(e) => { setPrive({ ...prive, heures: e.target.value }); setModifie(true); }} /></label>
          <label className="pm-champ">₪ / heure ({REGLE_D4.tauxMin} à {REGLE_D4.tauxMax})<input inputMode="numeric" value={prive.taux} onChange={(e) => { setPrive({ ...prive, taux: e.target.value }); setModifie(true); }} /></label>
        </div>
        {conseille > 0 && (
          <p className="tb-note">Prix conseillé (heures × taux + {REGLE_D4.marge} %) : <strong>{shekels(conseille)}</strong>{" "}
            <button className="tb-bouton tb-clair" onClick={() => set("lignesDevis", [...lignes, { libelle: `Développement${f.formule ? ` – formule ${f.formule}` : ""}`, montant: conseille }])}>Ajouter au devis</button>
          </p>
        )}
        <p className="aj-sous-titre">Lignes du devis (montant négatif = déduction, ex. étude déduite)</p>
        {lignes.map((l, i) => (
          <div key={i} className="dg-ligne">
            <input value={l.libelle} maxLength={120} onChange={(e) => changerLigne(i, "libelle", e.target.value)} aria-label="Libellé" />
            <input inputMode="decimal" value={l.montant} onChange={(e) => changerLigne(i, "montant", e.target.value)} aria-label="Montant" />
            <button className="rg-mini" aria-label="Retirer la ligne" onClick={() => set("lignesDevis", lignes.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="tb-ligne">
          <select value={ajout} onChange={(e) => ajouterLigne(e.target.value)} aria-label="Ajouter depuis le catalogue">
            <option value="">+ Ajouter depuis le catalogue…</option>
            {triCatalogue.map((c) => <option key={c.id} value={c.id}>{c.categorie} · {c.nom} ({libellePrix(c)})</option>)}
          </select>
          <button className="tb-bouton tb-clair" onClick={() => set("lignesDevis", [...lignes, { libelle: "", montant: "" }])}>+ Ligne libre</button>
        </div>
        <p><strong>Total : {shekels(total)}</strong></p>
        <label className="pm-champ">Précisions visibles sur le devis (facultatif)
          <textarea rows={3} maxLength={1500} value={f.devisNote} onChange={(e) => set("devisNote", e.target.value)} placeholder="Délai, ce qui est compris, validité du devis…" />
        </label>
        <div className="tb-actions">
          <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => enregistrer()}>Enregistrer</button>
          {total > 0 && <a className="tb-bouton" href={wa(messageDevis({ ...p, formule: f.formule, lignesDevis: lignes, id: p.id }))} target="_blank" rel="noopener noreferrer" onClick={envoyerDevis}>Envoyer le devis</a>}
        </div>
        {p.devisAccepteLe && <p className="tb-note">✅ Accepté par le client le {quand(p.devisAccepteLe)}.</p>}
      </div>

      <div className="tb-bloc">
        <h3>Paiements 40 / 30 / 30</h3>
        {!echeances.length ? (
          <button className="tb-bouton" disabled={enCours || !(total > 0)} onClick={creerEcheancier}>Créer l'échéancier ({shekels(total)})</button>
        ) : (
          <>
            <p className="tb-note">Reçu {shekels(bilan.recu)} sur {shekels(bilan.total)} · reste {shekels(bilan.reste)}</p>
            <label className="pm-champ">Moyen de paiement reçu
              <select value={moyen} onChange={(e) => setMoyen(e.target.value)}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            {echeances.map((e, i) => {
              const r = etatEcheance(e, mouvements);
              return (
                <div key={i} className="tb-adresse">
                  <div><p>{e.libelle} ({e.pourcent} %)</p><small>{shekels(e.montant)}{r.recu > 0 && r.reste > 0 ? ` · reçu ${shekels(r.recu)}` : ""}</small></div>
                  {e.payeLe || r.etat === "paye" ? (
                    <span className="dg-paye">Payé ✓</span>
                  ) : !e.demandeId ? (
                    <button className="tb-bouton" disabled={enCours} onClick={() => demanderPaiement(i)}>Demander</button>
                  ) : (
                    <button className="tb-bouton" disabled={enCours} onClick={() => recu(i)}>✓ Reçu</button>
                  )}
                </div>
              );
            })}
            {Math.abs(bilan.total - total) > 0.5 && !echeances.some((e) => e.demandeId) && (
              <button className="tb-retour aj-lien" onClick={() => action(() => updateDoc(doc(db, "projetsDigital", p.id), { echeances: echeancier(total), majLe: serverTimestamp() }), "Échéancier recalculé ✓")}>Recalculer l'échéancier avec le nouveau total</button>
            )}
          </>
        )}
      </div>

      <div className="tb-bloc">
        <h3>Cahier des charges · {av.faits} / {av.total}</h3>
        <p className="tb-note">Le client voit cette liste sur son lien : ce qui est coché apparaît barré et grisé.</p>
        {f.cahier.map((x, i) => (
          <div key={i} className="dg-tache">
            <input type="checkbox" checked={x.fait} onChange={(e) => set("cahier", f.cahier.map((y, j) => (j === i ? { ...y, fait: e.target.checked } : y)))} aria-label="Fait" />
            <input type="text" className={x.fait ? "dg-coche" : ""} value={x.texte} maxLength={200} onChange={(e) => set("cahier", f.cahier.map((y, j) => (j === i ? { ...y, texte: e.target.value } : y)))} />
            <button className="rg-mini" aria-label="Retirer" onClick={() => set("cahier", f.cahier.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="tb-retour aj-lien" onClick={() => set("cahier", [...f.cahier, { texte: "", fait: false }])}>+ Ajouter un point</button>
        <label className="pm-champ">Coller plusieurs points (une ligne = un point)
          <textarea rows={3} value={colle} onChange={(e) => setColle(e.target.value)} placeholder={"Page d'accueil\nFormulaire de contact\nEspace client"} />
        </label>
        {colle.trim() && <button className="tb-bouton tb-clair" onClick={() => { set("cahier", cahierPropre([...f.cahier, ...cahierDepuisTexte(colle)])); setColle(""); }}>Ajouter ces points</button>}
      </div>

      <div className="tb-bloc">
        <h3>Livraison, garantie et maintenance</h3>
        <div className="tb-ligne">
          <label className="pm-champ">Livré le<input type="date" value={f.livraisonLe} onChange={(e) => set("livraisonLe", e.target.value)} /></label>
          {!f.livraisonLe && <button className="tb-bouton tb-clair" onClick={() => { set("livraisonLe", aujourdhui()); set("statut", "garantie"); }}>Livré aujourd'hui</button>}
        </div>
        {f.livraisonLe && <p className="tb-note">Garantie corrective jusqu'au {finGarantie(f.livraisonLe)} (60 jours). La maintenance commence au plus tôt après.</p>}
        <label className="pm-champ">Forfait de maintenance
          <select value={f.maintenance.niveau} onChange={(e) => set("maintenance", { ...f.maintenance, niveau: e.target.value })}>
            <option value="">Aucun</option>
            {MAINTENANCES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        {f.maintenance.niveau && (
          <>
            <p className="tb-note">Ce mois-ci : {enHeures(maint.utilise)} sur {enHeures(maint.inclus)} incluses{maint.depassement > 0 ? ` · dépassement ${enHeures(maint.depassement)} (à facturer après accord du client)` : ` · reste ${enHeures(maint.restant)}`}.</p>
            {maint.interventions.map((x, i) => <p key={i} className="tb-note">{x.date} · {enHeures(x.minutes)} · {x.texte}</p>)}
            <div className="tb-ligne">
              <label className="pm-champ">Date<input type="date" value={inter.date} onChange={(e) => setInter({ ...inter, date: e.target.value })} /></label>
              <label className="pm-champ">Minutes<input inputMode="numeric" value={inter.minutes} onChange={(e) => setInter({ ...inter, minutes: e.target.value })} /></label>
            </div>
            <label className="pm-champ">Ce qui a été fait<input value={inter.texte} maxLength={200} onChange={(e) => setInter({ ...inter, texte: e.target.value })} /></label>
            <button className="tb-bouton tb-clair" onClick={ajouterIntervention}>+ Noter l'intervention</button>
          </>
        )}
      </div>

      <div className="tb-bloc">
        <h3>Dossier de lancement du client</h3>
        <p className="tb-note">Le client le remplit sur son lien dès que le devis est envoyé. {manque.length ? `Encore à fournir : ${manque.length} point(s).` : "Complet ✓"}</p>
        {QUESTIONS_DOSSIER.filter((q) => p.dossier && p.dossier[q.id]).map((q) => (
          <p key={q.id} className="tb-note"><strong>{q.l}</strong><br /><span style={{ whiteSpace: "pre-line" }}>{p.dossier[q.id]}</span></p>
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Notes privées</h3>
        <textarea rows={4} maxLength={5000} value={prive.notes} onChange={(e) => { setPrive({ ...prive, notes: e.target.value }); setModifie(true); }} placeholder="Jamais visibles par le client." style={{ width: "100%" }} />
      </div>

      <div className="tb-actions" style={{ position: "sticky", bottom: 0, padding: "10px 0", background: "var(--g-fond, #080709)" }}>
        <button className="tb-bouton" disabled={!modifie || enCours} onClick={() => enregistrer()}>Enregistrer la fiche</button>
      </div>
      {info && <p className="tb-note" role="status">{info}</p>}

      <div className="tb-bloc">
        {!supprimer ? (
          <button className="tb-retour aj-lien" onClick={() => setSupprimer(true)}>Supprimer ce projet…</button>
        ) : (
          <div className="tb-actions">
            <button className="tb-bouton tb-danger" onClick={() => action(async () => { await deleteDoc(doc(db, "projetsDigital", p.id)); await deleteDoc(doc(db, "projetsDigitalPrive", p.id)).catch(() => {}); onRetour(); }, "Projet supprimé.")}>Oui, supprimer (les paiements restent dans Finances)</button>
            <button className="tb-bouton tb-clair" onClick={() => setSupprimer(false)}>Non</button>
          </div>
        )}
      </div>
    </section>
  );
}
