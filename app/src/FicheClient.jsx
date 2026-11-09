import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienAppel, lienWhatsApp } from "./pricing/navigation.js";
import { bonusRecharge, soldeCredit } from "./pricing/credit.js";
import { lignesRecharge, validerCorrectionCredit } from "./pricing/clients.js";
import { LIBELLE_ORIGINE } from "./pricing/ajoutManuel.js";
import { Remerciement } from "./AjoutManuel.jsx";

// Fiche client complete (espace prive de Rebecca, Lot B seance B2).
// Notes privees et blocage : clientsAdmin/{cle} (jamais visibles du client).
// Acces Transport prive : autorisations/{uid}__transport (remplace la console Firebase).
// Credit : Rebecca confirme les recharges declarees ; le carnet (creditMouvements) n'est jamais modifie, on ajoute des lignes.
// B7 : origine du client, pre-fiche (client ajoute a la main) et sa fusion avec le compte, message de remerciement.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const dateDe = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" }) : "");
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  refusee: { label: "Refusée", classe: "refusee" },
  terminee: { label: "Terminée", classe: "terminee" },
  annulee: { label: "Annulée", classe: "annulee" },
};
const LIBELLES_CREDIT = { recharge: "Recharge", bonus: "Bonus offert", utilisation: "Course payée avec le crédit", correction: "Correction", cadeau: "Cadeau reçu" };
const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);

function Bloc({ titre, children, className = "" }) {
  return (
    <div className={"tb-bloc " + className}>
      <h3>{titre}</h3>
      {children}
    </div>
  );
}

export default function FicheClient({ fiche, admin, recharges, clients, aller, onModifier, onFermer }) {
  const p = fiche.profil;
  const uid = fiche.avecCompte ? fiche.cle : null;
  const [notes, setNotes] = useState((admin && admin.notes) || "");
  const [motif, setMotif] = useState((admin && admin.motifBlocage) || "");
  const [confirmerBlocage, setConfirmerBlocage] = useState(false);
  const [credit, setCredit] = useState(uid ? null : []);
  const [avis, setAvis] = useState([]);
  const [correction, setCorrection] = useState({ ouvert: false, montant: "", motif: "" });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  // Carnet de credit et avis du compte
  useEffect(() => {
    if (!uid) return undefined;
    const arrets = [
      onSnapshot(query(collection(db, "creditMouvements"), where("uid", "==", uid)), (s) => setCredit(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setCredit([])),
      onSnapshot(query(collection(db, "avis"), where("uid", "==", uid)), (s) => setAvis(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setAvis([])),
    ];
    return () => arrets.forEach((a) => a());
  }, [uid]);

  const executer = async (action, message) => {
    setErreur("");
    setInfo("");
    setEnCours(true);
    try {
      await action();
      if (message) setInfo(message);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const refAdmin = doc(db, "clientsAdmin", fiche.cle);
  const enregistrerNotes = () => executer(() => setDoc(refAdmin, { notes: notes.trim().slice(0, 3000), majLe: serverTimestamp() }, { merge: true }), "Notes enregistrées.");
  const changerBlocage = (bloque) =>
    executer(async () => {
      await setDoc(refAdmin, { bloque, motifBlocage: bloque ? motif.trim().slice(0, 200) : "", majLe: serverTimestamp() }, { merge: true });
      setConfirmerBlocage(false);
    }, bloque ? "Client bloqué." : "Client débloqué.");
  const changerTransport = () =>
    executer(
      () => setDoc(doc(db, "autorisations", uid + "__transport"), { uid, activite: "transport", actif: !fiche.transport, majLe: serverTimestamp() }, { merge: true }),
      fiche.transport ? "Transport privé désactivé pour ce client." : "Transport privé activé : le client le voit sur le site."
    );

  // Recharge : statut « confirmée » + lignes du carnet (recharge et bonus), en une seule fois
  const confirmerRecharge = (r) => {
    let dest = r.uid;
    if (r.cadeau) {
      const email = String(r.cadeau.email || "").trim().toLowerCase();
      const c = clients.find((x) => String(x.email || "").trim().toLowerCase() === email);
      if (!c) {
        setErreur(`Aucun compte avec l'e-mail ${r.cadeau.email} : le cadeau ne peut pas encore être crédité.`);
        return;
      }
      dest = c.id;
    }
    const lignes = lignesRecharge(r, bonusRecharge(Number(r.montant)), dest, aujourdhui());
    executer(async () => {
      const lot = writeBatch(db);
      lot.update(doc(db, "recharges", r.id), { statut: "confirmée", creditUid: dest, confirmeLe: serverTimestamp() });
      for (const l of lignes) lot.set(doc(collection(db, "creditMouvements")), { ...l, creeLe: serverTimestamp() });
      await lot.commit();
    }, "Recharge confirmée : le crédit est ajouté.");
  };
  const refuserRecharge = (r) => executer(() => updateDoc(doc(db, "recharges", r.id), { statut: "refusée", refuseLe: serverTimestamp() }), "Recharge refusée.");

  const ajouterCorrection = () => {
    const v = validerCorrectionCredit(correction.montant, correction.motif);
    if (v.erreur) {
      setErreur(v.erreur);
      return;
    }
    executer(async () => {
      await addDoc(collection(db, "creditMouvements"), { uid, kind: "correction", montant: v.montant, motif: correction.motif.trim().slice(0, 200), date: aujourdhui(), creeLe: serverTimestamp() });
      setCorrection({ ouvert: false, montant: "", motif: "" });
    }, "Correction ajoutée au carnet.");
  };

  const prenom = (p && p.prenom) || fiche.nom.split(" ")[0];
  const whatsapp = lienWhatsApp(fiche.telephone, `Bonjour ${prenom}, `);
  const appel = lienAppel(fiche.telephone);
  const s = fiche.stats;
  const solde = credit ? soldeCredit(credit) : 0;
  const enAttente = recharges.filter((r) => r.statut === "en attente");
  const autresRecharges = recharges.filter((r) => r.statut !== "en attente");
  const carnet = credit ? [...credit].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))) : [];
  const adresses = (p && Array.isArray(p.adresses) && p.adresses) || [];
  const enfants = (p && Array.isArray(p.enfants) && p.enfants) || [];
  const favoris = (p && Array.isArray(p.favoris) && p.favoris) || [];
  const pf = fiche.preFiche || null;
  const fusionnee = !!(pf && fiche.avecCompte && pf.cle !== fiche.cle);

  return (
    <section className="tb-detail fc">
      <button className="tb-retour" onClick={onFermer}>← Tous les clients</button>
      <div className="tb-ligne">
        <h2>{fiche.nom}</h2>
        <span className={"tb-badge " + (fiche.avecCompte ? "tb-acceptee" : "tb-annulee")}>{fiche.avecCompte ? "Compte" : "Sans compte"}</span>
      </div>
      {fiche.bloque && <p className="fc-alerte">Client bloqué{admin && admin.motifBlocage ? ` : ${admin.motifBlocage}` : ""}</p>}

      <Bloc titre="Contact">
        <p>{fiche.telephone || "Pas de téléphone"}</p>
        {fiche.email && <p className="fc-mail">{fiche.email}</p>}
        <div className="tb-actions">
          {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
        </div>
        {!p && pf && pf.adresse && <p dir="auto">{pf.adresse}</p>}
        {fiche.origine && <p>Origine : <strong>{LIBELLE_ORIGINE[fiche.origine] || fiche.origine}</strong></p>}
        {p && p.creeLe && <p className="tb-note">Compte créé le {dateDe(p.creeLe)}</p>}
        {!fiche.avecCompte && <p className="tb-note">Client sans compte : reconnu par son numéro de téléphone. S'il crée un compte avec ce numéro, sa fiche s'y rattache.</p>}
        {fusionnee && <p className="tb-note">Pré-fiche fusionnée avec son compte ✓ (même numéro de téléphone).</p>}
        <div className="tb-actions">
          <button className="tb-bouton tb-clair" onClick={() => aller("demandes", "nouvelle:" + fiche.cle)}>+ Ajouter une course</button>
          {onModifier && <button className="tb-bouton tb-clair" onClick={onModifier}>{fiche.avecCompte ? "Modifier l'origine" : "Modifier les infos"}</button>}
        </div>
      </Bloc>

      {!fiche.avecCompte && <Remerciement prenom={(pf && pf.prenom) || prenom} telephone={fiche.telephone} email={fiche.email} />}

      <div className="fc-chiffres">
        <div><strong>{s.nbTerminees}</strong><small>course{s.nbTerminees > 1 ? "s" : ""} faite{s.nbTerminees > 1 ? "s" : ""}</small></div>
        <div><strong>{shekels(s.chiffreAffaires)}</strong><small>chiffre d'affaires</small></div>
        <div className={s.resteAPayer > 0 ? "alerte" : ""}><strong>{shekels(s.resteAPayer)}</strong><small>reste à payer</small></div>
      </div>

      {uid && (
        <Bloc titre="Transport privé">
          <div className="fc-interrupteur">
            <span>{fiche.transport ? "Activé : le client voit l'espace Transport privé." : "Désactivé : le client ne voit que les Services coursier."}</span>
            <button
              role="switch"
              aria-checked={fiche.transport}
              aria-label="Accès au Transport privé"
              className={"fc-switch" + (fiche.transport ? " on" : "")}
              disabled={enCours}
              onClick={changerTransport}
            >
              <span />
            </button>
          </div>
        </Bloc>
      )}

      <Bloc titre="Mes notes privées">
        <textarea className="fc-notes" rows={4} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : préfère être appelée, retard le 3 mars, code de l'immeuble…" />
        <div className="tb-actions">
          <button className="tb-bouton" disabled={enCours || notes === ((admin && admin.notes) || "")} onClick={enregistrerNotes}>Enregistrer les notes</button>
        </div>
        <p className="tb-note">Jamais visibles par le client.</p>
        {fusionnee && pf.notes && <p className="tb-note fc-avant">Notes d'avant son compte : {pf.notes}</p>}
      </Bloc>

      <Bloc titre="Préférences et paiements">
        {p && Array.isArray(p.moyensPreferes) && p.moyensPreferes.length > 0 && <p>Moyens préférés : <strong>{p.moyensPreferes.join(", ")}</strong></p>}
        {Object.keys(s.moyensPrevus).length > 0 && (
          <p>Prévus dans ses demandes : {Object.entries(s.moyensPrevus).map(([m, n]) => `${m} (${n})`).join(", ")}</p>
        )}
        {Object.keys(s.moyensUtilises).length > 0 ? (
          <p>Réellement payé : {Object.entries(s.moyensUtilises).map(([m, n]) => `${m} ${shekels(n)}`).join(", ")}</p>
        ) : (
          <p className="tb-note">Aucun paiement enregistré.</p>
        )}
        <p>Encaissé au total : <strong>{shekels(s.encaisse)}</strong>{s.prixMoyen ? ` · prix moyen ${shekels(s.prixMoyen)}` : ""}</p>
        {(s.nbAnnulees > 0 || s.nbRefusees > 0) && <p className="tb-note">{s.nbAnnulees} annulée(s) · {s.nbRefusees} refusée(s)</p>}
      </Bloc>

      {uid && (
        <Bloc titre={`Crédit : ${credit ? shekels(solde) : "…"}`}>
          {enAttente.length > 0 && <p className="aj-sous-titre">Recharges à confirmer</p>}
          {enAttente.map((r) => (
            <div key={r.id} className="fc-recharge">
              <p>
                <strong>{r.montant} ₪</strong> · {r.moyen} · payé le {jourCourt(r.date)}
                {bonusRecharge(Number(r.montant)) > 0 ? ` · bonus ${bonusRecharge(Number(r.montant))} ₪` : ""}
              </p>
              {r.cadeau && <p className="tb-note">Cadeau pour {r.cadeau.nom} ({r.cadeau.email}){r.cadeau.message ? ` : « ${r.cadeau.message} »` : ""}</p>}
              <p className="tb-note">Vérifie d'abord que tu as bien reçu l'argent.</p>
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={() => confirmerRecharge(r)}>Argent reçu : confirmer</button>
                <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => refuserRecharge(r)}>Refuser</button>
              </div>
            </div>
          ))}
          {carnet.length === 0 && enAttente.length === 0 && <p className="tb-note">Aucun mouvement de crédit.</p>}
          {carnet.length > 0 && (
            <ul className="fc-liste">
              {carnet.map((m) => (
                <li key={m.id}>
                  <span>{LIBELLES_CREDIT[m.kind] || "Mouvement"}{m.date ? " · " + jourCourt(m.date) : ""}{m.motif ? " · " + m.motif : ""}</span>
                  <strong className={m.montant < 0 ? "fc-neg" : "fc-pos"}>{m.montant > 0 ? "+" : ""}{m.montant} ₪</strong>
                </li>
              ))}
            </ul>
          )}
          {autresRecharges.length > 0 && (
            <p className="tb-note">Recharges traitées : {autresRecharges.map((r) => `${r.montant} ₪ ${r.statut}`).join(" · ")}</p>
          )}
          {!correction.ouvert ? (
            <button className="tb-retour aj-lien" onClick={() => setCorrection({ ...correction, ouvert: true })}>Corriger le crédit</button>
          ) : (
            <div className="fc-correction">
              <input inputMode="decimal" placeholder="Montant (ex : 50 ou -20)" aria-label="Montant de la correction" value={correction.montant} onChange={(e) => setCorrection({ ...correction, montant: e.target.value })} />
              <input placeholder="Motif (obligatoire)" aria-label="Motif de la correction" maxLength={200} value={correction.motif} onChange={(e) => setCorrection({ ...correction, motif: e.target.value })} />
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={ajouterCorrection}>Ajouter la correction</button>
                <button className="tb-bouton tb-clair" onClick={() => setCorrection({ ouvert: false, montant: "", motif: "" })}>Annuler</button>
              </div>
            </div>
          )}
        </Bloc>
      )}

      <Bloc titre={`Historique (${fiche.demandes.length})`}>
        {fiche.demandes.length === 0 && <p className="tb-note">Aucune demande.</p>}
        {fiche.demandes.map((d) => {
          const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
          const prix = prixDe(d);
          return (
            <button key={d.id} className="fc-demande" onClick={() => aller("demandes", d.id)}>
              <span className="tb-ligne">
                <strong>{d.serviceTitre}</strong>
                <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
              </span>
              <span className="tb-ligne">
                <small>{jourCourt(d.date)} · {d.heure}</small>
                <small>{prix != null ? prix + " ₪" : d.surDevis ? "Sur devis" : ""}</small>
              </span>
            </button>
          );
        })}
      </Bloc>

      {p && (
        <Bloc titre="Adresses">
          {p.adresse && <p><small>Adresse principale</small><br /><span dir="auto">{p.adresse}</span></p>}
          {adresses.map((a, i) => (
            <p key={i}><small>{a.nom}</small><br /><span dir="auto">{a.label}</span></p>
          ))}
          {!p.adresse && adresses.length === 0 && <p className="tb-note">Aucune adresse enregistrée.</p>}
        </Bloc>
      )}

      {enfants.length > 0 && (
        <Bloc titre={`Enfants (${enfants.length})`}>
          {enfants.map((en, i) => (
            <div key={i} className="fc-enfant">
              <p><strong>{en.prenom}</strong>{en.age ? `, ${en.age} ans` : ""}{en.classe ? ` · ${en.classe}` : ""}{en.ecole ? ` · ${en.ecole}` : ""}</p>
              {en.adresse && <p dir="auto">{en.adresse}</p>}
              {en.horaires && <p>Horaires : {en.horaires}</p>}
              {en.telephoneUrgence && <p>Urgence : <a href={lienAppel(en.telephoneUrgence) || undefined}>{en.telephoneUrgence}</a></p>}
              {en.personnesAutorisees && <p>Personnes autorisées : {en.personnesAutorisees}</p>}
            </div>
          ))}
        </Bloc>
      )}

      {favoris.length > 0 && (
        <Bloc titre="Trajets favoris">
          <ul className="fc-liste">
            {favoris.map((f, i) => (
              <li key={i}><span>{f.nom}</span><small>{f.service}</small></li>
            ))}
          </ul>
        </Bloc>
      )}

      {avis.length > 0 && (
        <Bloc titre={`Avis (${avis.length})`}>
          {avis.map((a) => (
            <div key={a.id} className="fc-avis">
              <p>{"★".repeat(a.etoiles)}{"☆".repeat(Math.max(0, 5 - a.etoiles))}{a.pourboire > 0 ? ` · pourboire ${a.pourboire} ₪` : ""}</p>
              {a.commentaire && <p className="tb-note">« {a.commentaire} »</p>}
            </div>
          ))}
        </Bloc>
      )}

      <Bloc titre="Blocage" className="fc-blocage">
        {fiche.bloque ? (
          <>
            <p>Ce client est bloqué{admin && admin.motifBlocage ? ` (${admin.motifBlocage})` : ""}.</p>
            <div className="tb-actions">
              <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => changerBlocage(false)}>Débloquer</button>
            </div>
          </>
        ) : !confirmerBlocage ? (
          <>
            <p className="tb-note">
              {uid ? "Un client bloqué ne peut plus envoyer de demande avec son compte, ni recharger son crédit." : "Client sans compte : le blocage sert de repère pour toi (une demande sans compte reste possible)."}
            </p>
            <button className="tb-retour aj-lien" onClick={() => setConfirmerBlocage(true)}>Bloquer ce client…</button>
          </>
        ) : (
          <>
            <input className="fc-motif" placeholder="Motif (facultatif)" aria-label="Motif du blocage" maxLength={200} value={motif} onChange={(e) => setMotif(e.target.value)} />
            <div className="tb-actions">
              <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => changerBlocage(true)}>Confirmer le blocage</button>
              <button className="tb-bouton tb-clair" onClick={() => setConfirmerBlocage(false)}>Annuler</button>
            </div>
          </>
        )}
      </Bloc>

      {(info || erreur) && (
        <button className={"fc-message" + (erreur ? " erreur" : "")} role={erreur ? "alert" : "status"} onClick={() => { setInfo(""); setErreur(""); }}>
          {erreur || info} <span aria-hidden="true">✕</span>
        </button>
      )}
    </section>
  );
}
