import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import {
  REGLAGES_PAR_DEFAUT,
  annulationDe,
  calculerAnnulation,
  casSuggere,
  creerAnnulationValidee,
  etatRemboursement,
  situationCourse,
  validerMouvement,
  verifierRemboursementEffectue,
} from "./pricing/comptes.js";
import { synchroniserSuivi } from "./suiviClient.js";
import { soldeCredit } from "./pricing/credit.js";
import { MOYEN_CREDIT, champOperateur, faitPar, recuPar } from "./pricing/reverser.js";
import { nomDe } from "./pricing/quiFait.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import "./paiements.css";

// Paiements, annulations et remboursements d'une course (espace prive de Rebecca).
// Chaque mouvement d'argent est une nouvelle ligne : jamais modifiee, jamais supprimee.
// Une erreur se corrige avec « Corriger une erreur » (nouvelle ligne avec un motif).
// B8 : la correction se choisit avec « Ajouter » / « Retirer » (le clavier iPhone n'a pas de signe moins).
// B3 : l'historique du client (suivi) suit l'acompte recu et l'annulation.
// Aucun frais d'annulation n'est applique sans la validation de Rebecca.
// J4a : chaque paiement note qui a recu l'argent (« Reçu par ») ; une course peut etre payee avec le credit du client
// (la ligne « Course payée avec le crédit » est ajoutee a son carnet en meme temps). L'argent du credit reste chez Rebecca.

const ETATS = {
  acompte_a_recevoir: "Acompte à recevoir",
  confirmee: "Confirmée",
  terminee: "Terminée",
  annulee: "Annulée",
  annulation_a_finaliser: "Annulation à finaliser",
};

const CAS = [
  { id: "client", titre: "Le client annule" },
  { id: "tardive", titre: "Annulation tardive du client" },
  { id: "absence", titre: "Le client ne s'est pas présenté" },
  { id: "rebecca", titre: "J'annule (empêchement de ma part)" },
];
const LIBELLE_CAS = Object.fromEntries(CAS.map((c) => [c.id, c.titre]));
const ETATS_REMBOURSEMENT = { aucun: "Rien à rembourser", a_effectuer: "À effectuer", partiel: "Remboursé en partie", effectue: "Remboursé" };

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const euros = (n) => Math.round(n * 100) / 100 + " ₪";
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const versNombre = (x) => Math.round(Number(String(x).replace(",", ".")) * 100) / 100;

// Instant (en millisecondes) d'une date + heure locales d'Israel
function instantIsrael(date, heure) {
  const naif = Date.parse(`${date}T${heure}:00Z`);
  if (!Number.isFinite(naif)) return null;
  const vu = new Date(naif).toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const decalage = Date.parse(vu.replace(" ", "T") + "Z") - naif;
  return naif - decalage;
}

export default function PaiementsCourse({ d }) {
  const [mouvements, setMouvements] = useState(null); // null = chargement
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [mode, setMode] = useState(null); // null | "paiement" | "correction" | "remboursement" | "annulation"
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState(TARIFS.moyensPaiement[0]);
  const [date, setDate] = useState(aujourdhui());
  const [motif, setMotif] = useState("");
  const [sens, setSens] = useState("retirer"); // correction : "retirer" ou "ajouter"
  const [reference, setReference] = useState("");
  const [cas, setCas] = useState("client");
  const [aConfirmer, setAConfirmer] = useState(null);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { membres, moi } = useEquipeContexte();
  const enEquipe = (membres || []).length > 1;
  const [qui, setQui] = useState(moi); // qui a recu (ou rendu) l'argent
  const [credit, setCredit] = useState(null); // lignes du carnet de credit du client (null = pas de compte ou pas lu)

  // Carnet de credit du client (seulement pour une demande faite avec un compte)
  useEffect(() => {
    if (!d.uid) return undefined;
    return onSnapshot(
      query(collection(db, "creditMouvements"), where("uid", "==", d.uid)),
      (s) => setCredit(s.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setCredit(null)
    );
  }, [d.uid]);
  const soldeClient = credit ? soldeCredit(credit) : 0;

  useEffect(() => {
    const q = query(collection(db, "mouvements"), where("resId", "==", d.id));
    return onSnapshot(
      q,
      (snap) => setMouvements(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setLectureImpossible(true)
    );
  }, [d.id]);

  // Un message d'erreur disparait des qu'un champ est modifie
  useEffect(() => {
    setErreur("");
  }, [montant, motif, date, moyen, reference, cas]);

  const prix = typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null;
  const liste = useMemo(
    () =>
      [...(mouvements || [])]
        .filter((m) => m.kind === "paiement" || m.kind === "correction" || m.kind === "remboursement_effectue")
        .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [mouvements]
  );
  const res = { id: d.id, date: d.date, prixConvenu: prix, statut: d.statut };
  const sit = useMemo(() => situationCourse(res, mouvements || []), [d.id, d.date, d.statut, prix, mouvements]);
  const annulation = useMemo(() => annulationDe(mouvements || [], d.id), [mouvements, d.id]);
  const remb = useMemo(() => etatRemboursement(annulation, mouvements || []), [annulation, mouvements]);
  const calcul = useMemo(
    () => (mode === "annulation" ? calculerAnnulation({ cas, prixConvenu: prix == null ? 0 : prix, encaisse: sit.encaisse }, REGLAGES_PAR_DEFAUT) : null),
    [mode, cas, prix, sit.encaisse]
  );

  if (!["acceptee", "terminee", "annulee"].includes(d.statut)) return null;
  if (lectureImpossible) {
    return (
      <div className="tb-bloc">
        <h3>Paiements</h3>
        <p className="admin-erreur">Lecture des paiements impossible. Vérifie la connexion et les règles Firebase.</p>
      </div>
    );
  }
  if (mouvements === null) {
    return (
      <div className="tb-bloc">
        <h3>Paiements</h3>
        <p className="tb-note">Chargement…</p>
      </div>
    );
  }

  const modifiable = (d.statut === "acceptee" || d.statut === "terminee") && !annulation;
  const etat = annulation && d.statut === "acceptee" ? "annulation_a_finaliser" : sit.etat;
  const paiementsEnregistres = liste.some((m) => m.kind !== "remboursement_effectue");

  const reinitialiser = () => {
    setErreur("");
    setAConfirmer(null);
    setConfirmerAnnulation(false);
    setDate(aujourdhui());
    setMotif("");
    setSens("retirer");
    setReference("");
    setQui(moi);
    setMoyen(TARIFS.moyensPaiement.includes(d.moyenPaiement) ? d.moyenPaiement : TARIFS.moyensPaiement[0]);
  };

  const ouvrir = (m) => {
    reinitialiser();
    setMode(m);
    if (m === "paiement") {
      const resteAcompte = sit.acompte != null && !sit.acompteRecu ? sit.acompte - sit.encaisse : 0;
      const defaut = resteAcompte > 0 ? resteAcompte : sit.resteAPayer;
      setMontant(defaut > 0 ? String(Math.round(defaut * 100) / 100) : "");
    } else if (m === "remboursement") {
      setMontant(remb.reste > 0 ? String(remb.reste) : "");
    } else {
      setMontant("");
    }
    if (m === "annulation") {
      const instant = instantIsrael(d.date, d.heure || "00:00");
      setCas(casSuggere(instant == null ? null : (instant - Date.now()) / 3600000));
    }
  };

  const fermer = () => {
    setMode(null);
    reinitialiser();
  };

  // Construit le mouvement et le verifie (meme verification que les regles Firebase)
  const preparer = () => {
    const saisi = versNombre(montant);
    const n = mode === "correction" ? (sens === "retirer" ? -Math.abs(saisi) : Math.abs(saisi)) : saisi;
    let m;
    if (mode === "paiement") m = { kind: "paiement", resId: d.id, date, montant: n, moyen, ...(moyen === MOYEN_CREDIT ? {} : champOperateur(qui)) };
    else if (mode === "correction") m = { kind: "correction", resId: d.id, date, montant: n, motif: motif.trim().slice(0, 200), ...champOperateur(qui) };
    else {
      m = { kind: "remboursement_effectue", resId: d.id, date, montant: n, moyen, annulationId: annulation ? annulation.id : "", ...champOperateur(qui) };
      if (reference.trim()) m.ref = reference.trim().slice(0, 100);
    }
    let err = validerMouvement(m);
    if (!err && mode === "correction" && sit.encaisse + n < 0) err = "Cette correction rendrait le total encaissé négatif.";
    if (!err && mode === "remboursement") err = verifierRemboursementEffectue(n, annulation, mouvements);
    if (!err && m.moyen === MOYEN_CREDIT && (!d.uid || n > soldeClient + 0.001)) err = `Crédit insuffisant : le client a ${euros(soldeClient)} de crédit.`;
    if (err) {
      setErreur(err);
      return;
    }
    setErreur("");
    setAConfirmer(m);
  };

  const enregistrer = async () => {
    if (!aConfirmer) return;
    setEnCours(true);
    setErreur("");
    try {
      if (aConfirmer.moyen === MOYEN_CREDIT) {
        // Paiement avec le credit : la ligne de paiement et la ligne du carnet du client, en une seule fois
        const lot = writeBatch(db);
        lot.set(doc(collection(db, "mouvements")), { ...aConfirmer, creeLe: serverTimestamp() });
        lot.set(doc(collection(db, "creditMouvements")), { uid: d.uid, kind: "utilisation", montant: -aConfirmer.montant, resId: d.id, date: aConfirmer.date, creeLe: serverTimestamp() });
        await lot.commit();
      } else {
        await addDoc(collection(db, "mouvements"), { ...aConfirmer, creeLe: serverTimestamp() });
      }
      // Acompte recu : le client voit « Confirmée » dans son historique (B3)
      synchroniserSuivi(d, [...(mouvements || []), aConfirmer]);
      fermer();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  // Validation de l'annulation par Rebecca : la ligne d'annulation est ecrite d'abord, puis le statut change
  const validerAnnulation = async () => {
    const email = auth.currentUser && auth.currentUser.email;
    if (!calcul || !email) {
      setErreur("Connexion administrateur introuvable. Reconnecte-toi puis réessaie.");
      return;
    }
    setEnCours(true);
    setErreur("");
    let ecrite = false;
    try {
      const { id: ignore, ...ligne } = creerAnnulationValidee({ id: undefined, resId: d.id, cas, date: aujourdhui(), motif: motif.trim().slice(0, 200), calcul, validePar: email });
      await addDoc(collection(db, "mouvements"), { ...ligne, creeLe: serverTimestamp() });
      ecrite = true;
      if (d.statut !== "annulee") await updateDoc(doc(db, "demandes", d.id), { statut: "annulee", majLe: serverTimestamp() });
      synchroniserSuivi({ ...d, statut: "annulee" }, []);
      fermer();
    } catch {
      setErreur(
        ecrite
          ? "L'annulation est enregistrée mais le statut n'a pas changé : appuie sur « Terminer l'annulation »."
          : "Enregistrement impossible. Vérifie la connexion puis réessaie."
      );
    }
    setEnCours(false);
  };

  const terminerAnnulation = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await updateDoc(doc(db, "demandes", d.id), { statut: "annulee", majLe: serverTimestamp() });
      synchroniserSuivi({ ...d, statut: "annulee" }, []);
    } catch {
      setErreur("Le statut n'a pas pu changer. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const depasse = aConfirmer && aConfirmer.kind === "paiement" && prix != null && sit.encaisse + aConfirmer.montant > prix ? sit.encaisse + aConfirmer.montant - prix : 0;
  const formulaireMouvement = mode !== null && mode !== "annulation" && !aConfirmer;
  const confirmationMouvement = mode !== null && mode !== "annulation" && aConfirmer;
  const libelleMouvement = aConfirmer ? (aConfirmer.kind === "paiement" ? "Paiement" : aConfirmer.kind === "correction" ? "Correction" : "Remboursement") : "";

  return (
    <div className="tb-bloc">
      <h3>Paiements</h3>
      <p>
        <span className={"pm-etat pm-" + etat}>{ETATS[etat] || etat}</span>
      </p>

      {annulation ? (
        <ul className="pm-resume">
          <li>
            <span>Reçu du client</span>
            <strong>{euros(sit.encaisse)}</strong>
          </li>
          <li>
            <span>Conservé (frais d'annulation)</span>
            <strong>{euros(annulation.fraisRetenus)}</strong>
          </li>
          <li>
            <span>Remboursement validé</span>
            <strong>{euros(remb.valide)}</strong>
          </li>
          <li>
            <span>Déjà remboursé</span>
            <strong>{euros(remb.effectue)}</strong>
          </li>
          <li>
            <span>Reste à rembourser</span>
            <strong>{euros(remb.reste)}</strong>
          </li>
        </ul>
      ) : prix == null ? (
        <p className="tb-note">Fixe d'abord le prix (bloc « Prix ») : l'acompte se calcule ensuite.</p>
      ) : (
        <ul className="pm-resume">
          <li>
            <span>Prix convenu</span>
            <strong>{euros(prix)}</strong>
          </li>
          {d.statut === "acceptee" && sit.acompte != null && (
            <li>
              <span>Acompte ({REGLAGES_PAR_DEFAUT.acomptePourcent} %)</span>
              <strong>
                {euros(sit.acompte)} {sit.acompteRecu ? "✓ reçu" : "à recevoir"}
              </strong>
            </li>
          )}
          <li>
            <span>Encaissé</span>
            <strong>{euros(sit.encaisse)}</strong>
          </li>
          <li>
            <span>{d.statut === "terminee" ? "Reste à encaisser" : "Reste à payer"}</span>
            <strong>{euros(sit.resteAPayer)}</strong>
          </li>
          {sit.surplus > 0 && (
            <li>
              <span>Trop-perçu</span>
              <strong>{euros(sit.surplus)}</strong>
            </li>
          )}
        </ul>
      )}

      {annulation && (
        <p className="tb-note">
          {LIBELLE_CAS[annulation.cas] || annulation.cas} · {jourCourt(annulation.date)}
          {annulation.motif ? " · " + annulation.motif : ""} · {ETATS_REMBOURSEMENT[remb.etat]}
        </p>
      )}

      {liste.length > 0 && (
        <ul className="pm-liste">
          {liste.map((m) => (
            <li key={m.id}>
              <span>
                {jourCourt(m.date)} · {m.kind === "paiement" ? m.moyen : m.kind === "correction" ? "Correction" : "Remboursement (" + m.moyen + ")"}
                {m.kind === "correction" && m.motif ? <small> ({m.motif})</small> : null}
                {m.kind === "remboursement_effectue" && m.ref ? <small> ({m.ref})</small> : null}
                {enEquipe && m.moyen !== MOYEN_CREDIT && recuPar(m) !== faitPar(d) ? <small> · reçu par {nomDe(membres, recuPar(m))}, à reverser</small> : null}
                {enEquipe && m.moyen === MOYEN_CREDIT && faitPar(d) !== recuPar(m) ? <small> · crédit gardé par {nomDe(membres, recuPar(m))}, à reverser</small> : null}
              </span>
              <strong>{m.kind === "remboursement_effectue" ? "-" + euros(m.montant) : (m.montant > 0 && m.kind === "correction" ? "+" : "") + euros(m.montant)}</strong>
            </li>
          ))}
        </ul>
      )}
      {liste.length === 0 && <p className="tb-note">Aucun paiement enregistré.</p>}

      {mode === null && (
        <div className="tb-actions">
          {modifiable && (
            <button className="tb-bouton" onClick={() => ouvrir("paiement")}>
              Enregistrer un paiement
            </button>
          )}
          {modifiable && paiementsEnregistres && (
            <button className="tb-bouton tb-clair" onClick={() => ouvrir("correction")}>
              Corriger une erreur
            </button>
          )}
          {modifiable && d.statut === "acceptee" && (
            <button className="tb-bouton tb-danger" onClick={() => ouvrir("annulation")}>
              Annuler la course
            </button>
          )}
          {annulation && remb.reste > 0 && (
            <button className="tb-bouton" onClick={() => ouvrir("remboursement")}>
              Enregistrer le remboursement effectué
            </button>
          )}
          {annulation && d.statut === "acceptee" && (
            <button className="tb-bouton" disabled={enCours} onClick={terminerAnnulation}>
              Terminer l'annulation
            </button>
          )}
          {!annulation && d.statut === "annulee" && (
            <button className="tb-bouton tb-clair" onClick={() => ouvrir("annulation")}>
              Enregistrer le calcul d'annulation
            </button>
          )}
        </div>
      )}

      {formulaireMouvement && (
        <div className="pm-form">
          <h4>{mode === "paiement" ? "Nouveau paiement" : mode === "correction" ? "Corriger une erreur" : "Remboursement effectué"}</h4>
          {mode === "correction" && (
            <div className="tb-filtres" role="radiogroup" aria-label="Retirer ou ajouter">
              <button type="button" role="radio" aria-checked={sens === "retirer"} className={"tb-filtre" + (sens === "retirer" ? " actif" : "")} onClick={() => setSens("retirer")}>− Retirer</button>
              <button type="button" role="radio" aria-checked={sens === "ajouter"} className={"tb-filtre" + (sens === "ajouter" ? " actif" : "")} onClick={() => setSens("ajouter")}>+ Ajouter</button>
            </div>
          )}
          <label className="pm-champ">
            {mode === "paiement" ? "Montant reçu (₪)" : mode === "correction" ? (sens === "retirer" ? "Montant à retirer de l'encaissé (₪)" : "Montant à ajouter à l'encaissé (₪)") : "Montant remboursé au client (₪)"}
            <input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </label>
          {mode !== "correction" && (
            <label className="pm-champ">
              Moyen de paiement
              <select value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                {TARIFS.moyensPaiement.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {mode === "paiement" && d.uid && soldeClient > 0 && <option value={MOYEN_CREDIT}>{MOYEN_CREDIT} (solde {euros(soldeClient)})</option>}
              </select>
            </label>
          )}
          {enEquipe && !(mode === "paiement" && moyen === MOYEN_CREDIT) && (
            <label className="pm-champ">
              {mode === "remboursement" ? "Remboursé par" : mode === "correction" ? "Argent de" : "Reçu par"}
              <select value={qui} onChange={(e) => setQui(e.target.value)}>
                {membres.map((x) => (
                  <option key={x.id} value={x.id}>{x.id === moi ? "Moi (" + x.nom + ")" : x.nom}</option>
                ))}
              </select>
            </label>
          )}
          {mode === "paiement" && moyen === MOYEN_CREDIT && <p className="tb-note">Le montant est retiré du crédit du client (ligne « Course payée avec le crédit » dans sa fiche). L'argent du crédit est gardé par Rebecca.</p>}
          <label className="pm-champ">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {mode === "correction" && (
            <label className="pm-champ">
              Motif (obligatoire)
              <input value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : montant saisi par erreur" />
            </label>
          )}
          {mode === "remboursement" && (
            <label className="pm-champ">
              Référence (facultatif)
              <input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="Ex : virement Bit du 5/11" />
            </label>
          )}
          <div className="tb-actions">
            <button className="tb-bouton" onClick={preparer}>
              Continuer
            </button>
            <button className="tb-bouton tb-clair" onClick={fermer}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {confirmationMouvement && (
        <div className="pm-form">
          <h4>Confirmer ?</h4>
          <p>
            {libelleMouvement} de <strong>{euros(aConfirmer.montant)}</strong>
            {aConfirmer.kind !== "correction" ? <> en <strong>{aConfirmer.moyen}</strong></> : null} le {jourCourt(aConfirmer.date)}.
          </p>
          {aConfirmer.kind === "remboursement_effectue" && <p className="tb-note">À enregistrer seulement si le remboursement a vraiment été effectué.</p>}
          {enEquipe && recuPar(aConfirmer) !== faitPar(d) && <p className="tb-note">Course faite par {nomDe(membres, faitPar(d))} : {euros(aConfirmer.montant)} à reverser par {nomDe(membres, recuPar(aConfirmer))}.</p>}
          {depasse > 0 && <p className="tb-note">Attention : cela dépasse le prix convenu de {euros(depasse)}.</p>}
          <p className="tb-note">Une fois enregistré, il ne peut plus être modifié ni supprimé (une erreur se corrige par une nouvelle ligne).</p>
          <div className="tb-actions">
            <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>
              Confirmer
            </button>
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => setAConfirmer(null)}>
              Modifier
            </button>
          </div>
        </div>
      )}

      {mode === "annulation" && calcul && (
        <div className="pm-form">
          <h4>{confirmerAnnulation ? "Valider l'annulation ?" : "Annuler la course"}</h4>
          {!confirmerAnnulation && (
            <>
              <fieldset className="pm-cas">
                <legend>Que s'est-il passé ?</legend>
                {CAS.map((c) => (
                  <label key={c.id} className="pm-radio">
                    <input type="radio" name="cas-annulation" checked={cas === c.id} onChange={() => setCas(c.id)} />
                    <span>{c.titre}</span>
                  </label>
                ))}
              </fieldset>
              <label className="pm-champ">
                Motif (facultatif)
                <input value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : client injoignable" />
              </label>
            </>
          )}
          <ul className="pm-resume">
            <li>
              <span>Reçu du client</span>
              <strong>{euros(sit.encaisse)}</strong>
            </li>
            <li>
              <span>Frais d'annulation conservés</span>
              <strong>{euros(calcul.fraisRetenus)}</strong>
            </li>
            <li>
              <span>À rembourser au client</span>
              <strong>{euros(calcul.remboursement)}</strong>
            </li>
          </ul>
          {calcul.notes.map((n, i) => (
            <p key={i} className="tb-note">
              {n}
            </p>
          ))}
          <p className="tb-note">Rien n'est enregistré tant que tu n'as pas validé. Une fois validée, l'annulation ne peut plus être modifiée.</p>
          <div className="tb-actions">
            {!confirmerAnnulation ? (
              <>
                <button className="tb-bouton tb-danger" onClick={() => setConfirmerAnnulation(true)}>
                  Valider l'annulation
                </button>
                <button className="tb-bouton tb-clair" onClick={fermer}>
                  Retour
                </button>
              </>
            ) : (
              <>
                <button className="tb-bouton tb-danger" disabled={enCours} onClick={validerAnnulation}>
                  Oui, annuler la course
                </button>
                <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => setConfirmerAnnulation(false)}>
                  Modifier
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {erreur && (
        <p className="admin-erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
