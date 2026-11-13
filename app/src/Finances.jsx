import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import Bilan from "./Bilan.jsx";
import Depenses from "./Depenses.jsx";
import { ACTIVITES, NOMS_MOIS, PERIODES, PLAFOND_DEFAUT, encaisseAnnee, etatPlafond, finProposee, jourDansAnnee, joursAnnee, syntheseAnnee, validerAutreRevenu } from "./pricing/financesAnnee.js";
import { ADMIN_ID, lignesDe, syntheseMembre } from "./pricing/equipe.js";
import { argentDe, champOperateur, lignesAReverser, parVehicule, soldesDe, validerReversement } from "./pricing/reverser.js";
import { libelleType, nomDe, vehiculesEffectifs } from "./pricing/quiFait.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import MonMoisVue from "./MonMoisVue.jsx";
import EssenceVue, { enregistrerEssence, useEssence } from "./EssenceVue.jsx";
import { kmWolt } from "./pricing/essence.js";
import "./paiements.css";
import "./finances.css";

// Onglet « Finances » de l'espace prive (Lot B, seance B4) :
//  - Annee : chiffre d'affaires par activite et par mois, Wolt, pourboires a part, credit, benefice, plafond osek patur ;
//  - Bilan : bilan detaille d'une periode + sauvegarde et journal (Bilan.jsx, inchange) ;
//  - Wolt : saisie des autres revenus (Wolt...) ;
//  - Depenses : Depenses.jsx (inchange).
// J4a (Lot J, 9 nov. 2026) : finances PAR PERSONNE. Rebecca : filtre Moi / Jeremy / Global ; un coequipier : « Mes finances »
// (seulement les siennes, avec son plafond). Chiffre d'affaires et plafond = courses faites par la personne.
// Onglet « À reverser » : argent recu par l'un pour une course de l'autre, dans les deux sens ; credit prepaye garde par Rebecca.
// Bloc « Par véhicule » : frais estimes (carburant + usure) selon le vehicule reellement utilise.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

const VUES = [
  { id: "monmois", label: "Mon mois", rebecca: true }, // 13 nov. 2026 : ce que je gagne vraiment par mois
  { id: "annee", label: "Année" },
  { id: "reverser", label: "À reverser", equipe: true },
  { id: "bilan", label: "Bilan", rebecca: true },
  { id: "wolt", label: "Wolt" },
  { id: "depenses", label: "Dépenses" },
  { id: "essence", label: "Essence", rebecca: true }, // 13 nov. 2026 : pleins, travail (Rebecca Services, Wolt) et perso
];

const COLLECTIONS = ["demandes", "mouvements", "depenses", "autresRevenus", "avis", "recharges", "creditMouvements", "reversements"];
// Un coequipier ne lit que SES depenses, SON Wolt et SES recharges encaissees ; jamais le carnet de credit complet.
const SEULEMENT_SIENNES = ["depenses", "autresRevenus", "recharges"];

// Lecture en direct des collections utiles aux finances
// reversements : collection creee en J4a (lue seulement apres les regles v9 ; avant, liste vide)
function useDonnees(moi, estRebecca) {
  const [donnees, setDonnees] = useState({});
  const [lectureImpossible, setLectureImpossible] = useState(false);
  useEffect(() => {
    setDonnees({});
    const noms = estRebecca ? COLLECTIONS : COLLECTIONS.filter((n) => n !== "creditMouvements");
    const arrets = noms.map((nom) =>
      onSnapshot(
        nom === "demandes" ? refDemandes() : !estRebecca && SEULEMENT_SIENNES.includes(nom) ? query(collection(db, nom), where("operateur", "==", moi)) : collection(db, nom),
        (s) => setDonnees((avant) => ({ ...avant, [nom]: s.docs.map((x) => ({ id: x.id, ...x.data() })) })),
        () => (nom === "reversements" ? setDonnees((avant) => ({ ...avant, reversements: [] })) : setLectureImpossible(true))
      )
    );
    if (!estRebecca) setDonnees((avant) => ({ ...avant, creditMouvements: [] }));
    return () => arrets.forEach((a) => a());
  }, [moi, estRebecca]);
  return { donnees, pret: COLLECTIONS.every((n) => Array.isArray(donnees[n])), lectureImpossible };
}

function Ligne({ nom, valeur, sous, classe }) {
  return (
    <li className={sous ? "bl-sous" : undefined}>
      <span>{nom}</span>
      <strong className={classe}>{valeur}</strong>
    </li>
  );
}

/* ---------- Vue Annee ---------- */
function Annee({ donnees, reglages, personne, membres, vehicules, enEquipe }) {
  const anneeCourante = Number(aujourdhui().slice(0, 4));
  const [annee, setAnnee] = useState(anneeCourante);
  const [moisOuvert, setMoisOuvert] = useState(false);

  const global = personne === "tous";
  // Chacun son osek patur : seulement les courses faites par la personne (anciennes courses = Rebecca)
  // Rebecca seule dans l'equipe : exactement le calcul d'avant (toutes les courses)
  const s = useMemo(() => (global || !enEquipe ? syntheseAnnee({ annee, ...donnees }) : syntheseMembre(personne, { annee, ...donnees })), [annee, donnees, personne, enEquipe]);
  const enCours = annee === anneeCourante;
  const plafond = etatPlafond(s.cumulPlafond, reglages.plafondOsek, enCours ? jourDansAnnee(aujourdhui()) : null, joursAnnee(annee));
  const courses = useMemo(() => (global ? donnees.demandes : donnees.demandes.filter((d) => (d.realisePar || d.attribueA || ADMIN_ID) === personne)), [donnees.demandes, personne]);
  const vehiculesTous = useMemo(() => vehiculesEffectifs(vehicules), [vehicules]);
  const lignesVehicules = useMemo(() => parVehicule({ annee, demandes: courses, depenses: global ? donnees.depenses : lignesDe(donnees.depenses, personne), vehicules: vehiculesTous }), [annee, courses, donnees.depenses, personne, vehiculesTous]);
  const argent = useMemo(() => (global || !enEquipe ? null : argentDe(personne, donnees)), [donnees, personne, enEquipe]);
  const nom = global ? "toute l'équipe" : nomDe(membres, personne);
  const t = s.totaux;
  // 13 nov. 2026 : ce qui est vraiment encaisse, ce qui reste a encaisser, et le total
  const c = useMemo(() => encaisseAnnee({ annee, demandes: courses, mouvements: donnees.mouvements, depenses: global || !enEquipe ? donnees.depenses : lignesDe(donnees.depenses, personne), autresRevenus: global || !enEquipe ? donnees.autresRevenus : lignesDe(donnees.autresRevenus, personne) }), [annee, courses, donnees, personne, global, enEquipe]);
  const ct = c.totaux;
  const moisAffiches = s.mois.map((m, i) => ({ ...m, i })).filter((m) => m.ca || m.wolt || m.depenses || c.mois[m.i].encaisse || c.mois[m.i].reste);

  return (
    <section className="tb-liste fi">
      <div className="dp-mois">
        <button className="dp-fleche" aria-label="Année précédente" onClick={() => setAnnee(annee - 1)}>‹</button>
        <strong>{annee}</strong>
        <button className="dp-fleche" aria-label="Année suivante" disabled={annee >= anneeCourante} onClick={() => setAnnee(annee + 1)}>›</button>
      </div>

      {global && <p className="tb-note tb-pad">Vue globale : chiffres de toute l'équipe additionnés. Chacun a son propre osek patur : le plafond se regarde personne par personne.</p>}
      {!global && (
      <div className={"tb-bloc fi-plafond fi-" + plafond.niveau}>
        <h3>Plafond de l'osek patur</h3>
        <p className="bl-gros">
          <span>Cumul {annee}</span>
          <strong>{shekels(s.cumulPlafond)}</strong>
        </p>
        <div className="fi-jauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, plafond.pourcent)} aria-label="Part du plafond utilisée">
          <span style={{ width: Math.min(100, plafond.pourcent) + "%" }} />
        </div>
        <p>
          <strong>{plafond.pourcent} %</strong> du plafond de {shekels(plafond.plafond)} · reste {shekels(plafond.reste)}
        </p>
        {plafond.niveau === "attention" && <p className="fi-alerte">Tu approches du plafond : parles-en à ton comptable.</p>}
        {plafond.niveau === "depasse" && <p className="fi-alerte">Plafond atteint : contacte ton comptable rapidement.</p>}
        {enCours && plafond.estimation != null && (
          <p className={plafond.estimationDepasse ? "fi-alerte" : "tb-note"}>
            Au rythme actuel, fin {annee} ≈ {shekels(plafond.estimation)}{plafond.estimationDepasse ? " : au-dessus du plafond." : "."}
          </p>
        )}
        <p className="tb-note">
          Cumul de {nom} = chiffre d'affaires des courses faites par {nom} + revenus Wolt (sans les pourboires).
          {reglages.plafondVerifie ? " Plafond vérifié par le comptable." : " Plafond et mode de calcul provisoires, à confirmer avec le comptable (modifiable dans Réglages)."}
        </p>
      </div>
      )}

      <div className="tb-bloc">
        <h3>Résultat {annee}</h3>
        <p className="bl-gros">
          <span>Bénéfice encaissé</span>
          <strong className={ct.beneficeEncaisse < 0 ? "bl-neg" : undefined}>{shekels(ct.beneficeEncaisse)}</strong>
        </p>
        <ul className="pm-resume">
          <Ligne nom="Encaissé" valeur={shekels(ct.encaisse + ct.wolt)} />
          <Ligne sous nom="Rebecca Services" valeur={shekels(ct.encaisse)} />
          <Ligne sous nom="Wolt et autres" valeur={shekels(ct.wolt)} />
          {ct.troc > 0 && <Ligne nom="Réglé en troc (sans argent)" valeur={shekels(ct.troc)} />}
          <Ligne nom="Reste à encaisser" valeur={shekels(ct.reste)} classe={ct.reste > 0 ? "bl-neg" : undefined} />
          <Ligne nom="Total" valeur={shekels(ct.total + ct.wolt)} />
          <Ligne nom="Dépenses" valeur={"- " + shekels(ct.depenses)} />
        </ul>
        <p className="tb-note">Bénéfice encaissé = encaissé (Rebecca Services + Wolt) − dépenses. Le reste à encaisser n'y est pas tant que tu ne l'as pas reçu. Wolt compte aussi dans ton plafond d'osek patur.</p>
      </div>

      <div className="tb-bloc">
        <h3>Courses faites {annee} (facturé)</h3>
        <ul className="pm-resume">
          <Ligne nom={"Chiffre d'affaires · " + nom} valeur={shekels(t.caActivites)} />
          {ACTIVITES.map((a) => (
            <Ligne key={a.id} sous nom={a.label} valeur={shekels(t[a.id])} />
          ))}
          {t.autre > 0 && <Ligne sous nom="Autres" valeur={shekels(t.autre)} />}
        </ul>
        <p className="tb-note">
          {t.courses} course{t.courses > 1 ? "s" : ""} terminée{t.courses > 1 ? "s" : ""}{t.prixMoyen ? ` · prix moyen ${shekels(t.prixMoyen)}` : ""}
          {t.annulations > 0 ? ` · dont ${shekels(t.annulations)} gardés après annulation` : ""}.
        </p>
      </div>

      {argent && (
        <div className="tb-bloc">
          <h3>Argent reçu · {nom}</h3>
          <ul className="pm-resume">
            <Ligne nom="Encaissé de la main des clients" valeur={shekels(argent.encaisse)} />
            {argent.pourLesAutres > 0 && <Ligne sous nom="dont pour les courses des autres (à reverser)" valeur={"- " + shekels(argent.pourLesAutres)} />}
            {argent.recuParLesAutres > 0 && <Ligne sous nom={"Courses de " + nom + " encaissées par un autre (à recevoir)"} valeur={"+ " + shekels(argent.recuParLesAutres)} />}
            {argent.creditADonner > 0 && <Ligne sous nom="Courses des autres payées avec le crédit (à reverser)" valeur={"- " + shekels(argent.creditADonner)} />}
            {argent.creditARecevoir > 0 && <Ligne sous nom={"Courses de " + nom + " payées avec le crédit (à recevoir)"} valeur={"+ " + shekels(argent.creditARecevoir)} />}
            {argent.rechargesADonner > 0 && <Ligne sous nom="Recharges de crédit encaissées (à reverser à Rebecca)" valeur={shekels(argent.rechargesADonner)} />}
            {argent.rechargesARecevoir > 0 && <Ligne sous nom="Recharges encaissées par un autre (à recevoir)" valeur={"+ " + shekels(argent.rechargesARecevoir)} />}
            <Ligne nom="Une fois tout reversé" valeur={shekels(argent.aMoiAuFinal)} />
          </ul>
          <p className="tb-note">Toutes années confondues. Le détail et le bouton « C'est reversé » sont dans l'onglet « À reverser ».</p>
        </div>
      )}

      {lignesVehicules.length > 0 && (
        <div className="tb-bloc">
          <h3>Par véhicule {annee}</h3>
          <ul className="fi-mois">
            {lignesVehicules.map((l) => (
              <li key={l.id}>
                <div className="tb-ligne">
                  <strong>{l.nom}</strong>
                  <strong className={l.beneficeEstime < 0 ? "bl-neg" : undefined}>{shekels(l.beneficeEstime)}</strong>
                </div>
                <small>
                  {l.type ? libelleType(l.type) + " · " : ""}{l.courses} course{l.courses > 1 ? "s" : ""} · {l.km} km · CA {shekels(l.ca)} · frais estimés {shekels(l.fraisEstimes)}
                  {l.depenses ? ` · dépenses notées ${shekels(l.depenses)}` : ""}
                </small>
              </li>
            ))}
          </ul>
          <p className="tb-note">Bénéfice estimé = chiffre d'affaires − frais estimés du véhicule (carburant + usure, retour à vide compris). Vélo : sans frais. Le prix client ne change jamais selon le véhicule.</p>
        </div>
      )}

      <div className="tb-bloc">
        <h3>À part (hors chiffre d'affaires)</h3>
        <ul className="pm-resume">
          <Ligne nom="Pourboires de mes clients" valeur={shekels(s.pourboires.clients)} />
          <Ligne nom="Pourboires Wolt" valeur={shekels(s.pourboires.wolt)} />
          {(global || personne === ADMIN_ID) && <Ligne nom="Recharges de crédit reçues" valeur={shekels(s.credit.rechargesRecues)} />}
          {(global || personne === ADMIN_ID) && <Ligne sous nom="Bonus de crédit offerts" valeur={shekels(s.credit.bonusOfferts)} />}
        </ul>
        <p className="tb-note">{personne !== ADMIN_ID && !global ? "Le crédit prépayé des clients est gardé par Rebecca : il n'apparaît pas ici. " : ""}Les recharges sont de l'argent reçu d'avance : il devient du chiffre d'affaires quand la course est faite. Les bonus sont offerts, ce n'est pas de l'argent reçu. Traitement des pourboires à confirmer avec le comptable.</p>
      </div>

      <div className="tb-bloc">
        <h3>Mois par mois</h3>
        {moisAffiches.length === 0 && <p className="tb-note">Aucune donnée pour {annee}.</p>}
        {moisAffiches.length > 0 && (
          <>
            <ul className="fi-mois">
              {(moisOuvert ? moisAffiches : moisAffiches.slice(-3)).map((m) => (
                <li key={m.i}>
                  <div className="tb-ligne">
                    <strong>{NOMS_MOIS[m.i]}</strong>
                    <strong className={c.mois[m.i].beneficeEncaisse < 0 ? "bl-neg" : undefined}>{shekels(c.mois[m.i].beneficeEncaisse)}</strong>
                  </div>
                  <small>
                    Encaissé {shekels(c.mois[m.i].encaisse + c.mois[m.i].wolt)} (dont Wolt {shekels(c.mois[m.i].wolt)}){c.mois[m.i].troc ? ` · troc ${shekels(c.mois[m.i].troc)}` : ""} · reste à encaisser {shekels(c.mois[m.i].reste)}
                    <br />
                    Coursier {shekels(m.coursier)} · Transport {shekels(m.transport)}
                    {m.annulations ? ` · Annulations ${shekels(m.annulations)}` : ""} · Wolt {shekels(m.wolt)} · Dépenses {shekels(m.depenses)}
                  </small>
                </li>
              ))}
            </ul>
            {moisAffiches.length > 3 && (
              <button className="tb-retour aj-lien" onClick={() => setMoisOuvert(!moisOuvert)}>
                {moisOuvert ? "Voir seulement les 3 derniers mois" : `Voir les ${moisAffiches.length} mois`}
              </button>
            )}
            <p className="tb-note">Bénéfice du mois = encaissé + Wolt − dépenses.</p>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Vue Wolt (autres revenus) ---------- */
const formulaireVide = () => ({ source: "Wolt", periode: "semaine", debut: aujourdhui(), fin: finProposee("semaine", aujourdhui()), livraisons: "", revenu: "", pourboire: "", detail: "", km: "" });

function AutresRevenus({ lignes: toutes, moi }) {
  const lignes = lignesDe(toutes, moi); // chacun son Wolt
  // 13 nov. 2026 : les km de chaque ligne Wolt (Rebecca) sont gardes dans admin/essence, pour la vue Essence
  const essence = useEssence();
  const avecKm = moi === ADMIN_ID && essence;
  const [form, setForm] = useState(null); // null = ferme
  const [edition, setEdition] = useState(null); // id de la ligne modifiee
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const annee = Number(aujourdhui().slice(0, 4));
  const [voirTout, setVoirTout] = useState(false);

  const triees = [...lignes].sort((a, b) => String(b.debut).localeCompare(String(a.debut)));
  const visibles = voirTout ? triees : triees.filter((l) => String(l.debut).startsWith(String(annee)));
  const totalAnnee = triees.filter((l) => String(l.debut).startsWith(String(annee))).reduce((s, l) => s + (Number(l.revenu) || 0), 0);

  const ouvrir = (l) => {
    setErreur("");
    setConfirmerSuppression(false);
    if (l) {
      setEdition(l.id);
      setForm({ source: l.source || "Wolt", periode: l.periode, debut: l.debut, fin: l.fin, livraisons: String(l.livraisons ?? ""), revenu: String(l.revenu ?? ""), pourboire: String(l.pourboire ?? ""), detail: l.detail || "", km: essence && essence.woltKm[l.id] ? String(essence.woltKm[l.id]) : "" });
    } else {
      setEdition(null);
      setForm(formulaireVide());
    }
  };
  const fermer = () => {
    setForm(null);
    setEdition(null);
    setErreur("");
    setConfirmerSuppression(false);
  };
  const changer = (champ, valeur) => {
    const f = { ...form, [champ]: valeur };
    if (champ === "periode" || champ === "debut") f.fin = finProposee(f.periode, f.debut);
    setForm(f);
  };

  const enregistrer = async () => {
    const v = validerAutreRevenu(form);
    if (v.erreur) {
      setErreur(v.erreur);
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      let id = edition;
      if (edition) {
        await updateDoc(doc(db, "autresRevenus", edition), { ...v.ligne, ...(v.ligne.detail ? {} : { detail: deleteField() }), majLe: serverTimestamp() });
      } else {
        id = (await addDoc(collection(db, "autresRevenus"), { ...v.ligne, ...champOperateur(moi), creeLe: serverTimestamp(), majLe: serverTimestamp() })).id;
      }
      if (avecKm && (form.km || essence.woltKm[id])) await enregistrerEssence(kmWolt(essence, id, form.km));
      fermer();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };
  const supprimer = async () => {
    setEnCours(true);
    try {
      await deleteDoc(doc(db, "autresRevenus", edition));
      fermer();
    } catch {
      setErreur("Suppression impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  return (
    <section className="tb-liste fi">
      <div className="tb-bloc">
        <h3>Revenus Wolt et autres</h3>
        <p className="bl-gros">
          <span>Total {annee}</span>
          <strong>{shekels(totalAnnee)}</strong>
        </p>
        <p className="tb-note">Saisis ici ce que tu gagnes en dehors de Rebecca Services (Wolt…), par jour, par semaine ou par mois. Ces revenus comptent dans le plafond de l'osek patur ; les pourboires restent à part.</p>
        {!form && <button className="tb-bouton" onClick={() => ouvrir(null)}>+ Ajouter un revenu</button>}
      </div>

      {form && (
        <div className="tb-bloc pm-form">
          <h4>{edition ? "Modifier ce revenu" : "Nouveau revenu"}</h4>
          <label className="pm-champ">
            Source
            <input value={form.source} maxLength={40} onChange={(e) => changer("source", e.target.value)} />
          </label>
          <label className="pm-champ">
            Période
            <select value={form.periode} onChange={(e) => changer("periode", e.target.value)}>
              {PERIODES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <div className="fi-deux">
            <label className="pm-champ">
              Du
              <input type="date" value={form.debut} onChange={(e) => changer("debut", e.target.value)} />
            </label>
            <label className="pm-champ">
              Au
              <input type="date" value={form.fin} onChange={(e) => changer("fin", e.target.value)} />
            </label>
          </div>
          <label className="pm-champ">
            Nombre de livraisons
            <input inputMode="numeric" value={form.livraisons} onChange={(e) => changer("livraisons", e.target.value)} placeholder="0" />
          </label>
          {avecKm && (
            <label className="pm-champ">
              Kilomètres parcourus (pour ta vue Essence)
              <input inputMode="decimal" value={form.km} onChange={(e) => changer("km", e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0" />
            </label>
          )}
          <div className="fi-deux">
            <label className="pm-champ">
              Revenu (₪)
              <input inputMode="decimal" value={form.revenu} onChange={(e) => changer("revenu", e.target.value)} placeholder="0" />
            </label>
            <label className="pm-champ">
              Pourboires (₪)
              <input inputMode="decimal" value={form.pourboire} onChange={(e) => changer("pourboire", e.target.value)} placeholder="0" />
            </label>
          </div>
          <label className="pm-champ">
            Détail (facultatif, obligatoire pour une correction négative)
            <input value={form.detail} maxLength={200} onChange={(e) => changer("detail", e.target.value)} />
          </label>
          <div className="tb-actions">
            <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>Enregistrer</button>
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={fermer}>Annuler</button>
          </div>
          {edition && !confirmerSuppression && (
            <button className="tb-retour aj-lien" onClick={() => setConfirmerSuppression(true)}>Supprimer cette ligne…</button>
          )}
          {edition && confirmerSuppression && (
            <div className="tb-actions">
              <button className="tb-bouton tb-danger" disabled={enCours} onClick={supprimer}>Oui, supprimer</button>
              <button className="tb-bouton tb-clair" onClick={() => setConfirmerSuppression(false)}>Garder</button>
            </div>
          )}
          {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
        </div>
      )}

      {visibles.length === 0 && <p className="tb-note tb-pad">Aucun revenu saisi pour {annee}.</p>}
      {visibles.map((l) => (
        <button key={l.id} className="tb-carte" onClick={() => ouvrir(l)}>
          <span className="tb-ligne">
            <strong>{l.source}</strong>
            <strong>{shekels(Number(l.revenu) || 0)}</strong>
          </span>
          <span className="tb-quand">
            {l.periode === "jour" ? jourCourt(l.debut) : `${jourCourt(l.debut)} → ${jourCourt(l.fin)}`} · {l.livraisons} livraison{l.livraisons > 1 ? "s" : ""}
            {Number(l.pourboire) ? ` · pourboires ${shekels(Number(l.pourboire))}` : ""}
          </span>
          {l.detail && <span className="tb-quand">{l.detail}</span>}
        </button>
      ))}
      {triees.length > visibles.length && <button className="tb-retour aj-lien" onClick={() => setVoirTout(true)}>Voir les années précédentes</button>}
    </section>
  );
}

/* ---------- Vue « À reverser » (J4a) ---------- */
const CAUSES = { credit: "payée avec le crédit du client", encaisse: "encaissée par", recharge: "recharge de crédit encaissée par" };

function AReverser({ donnees, moi, membres }) {
  const lignes = useMemo(() => lignesAReverser(donnees), [donnees]);
  const reversements = donnees.reversements || [];
  const soldes = soldesDe(moi, membres, { lignes, reversements });
  const [form, setForm] = useState(null); // { de, vers, montant, date, note }
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [toutVoir, setToutVoir] = useState(false);

  const miennes = lignes.filter((l) => l.de === moi || l.vers === moi).reverse();
  const historique = reversements.filter((r) => r.de === moi || r.vers === moi).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const visibles = toutVoir ? miennes : miennes.slice(0, 10);

  const ouvrir = (sol) => {
    setErreur("");
    setForm({ de: sol.de, vers: sol.vers, montant: String(sol.montant), date: aujourdhui(), note: "", solde: sol });
  };
  const enregistrer = async () => {
    const v = validerReversement({ ...form, montant: Number(String(form.montant).replace(",", ".")) }, form.solde);
    if (v.erreur) {
      setErreur(v.erreur);
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      await addDoc(collection(db, "reversements"), { ...v.ligne, declarePar: moi, creeLe: serverTimestamp() });
      setForm(null);
    } catch {
      setErreur("Enregistrement impossible pour l'instant (connexion ou règles Firebase pas encore à jour).");
    }
    setEnCours(false);
  };

  const libelleLigne = (l) => {
    const d = l.demande;
    const course = d ? `${d.serviceTitre || d.service} du ${jourCourt(d.date)}${d.nom ? " · " + d.nom : ""}` : "";
    if (l.cause === "credit") return `${course} : ${CAUSES.credit}`;
    if (l.cause === "recharge") return `Recharge de crédit du ${jourCourt(l.date)} : ${CAUSES.recharge} ${nomDe(membres, l.de)}`;
    return `${course} : ${CAUSES.encaisse} ${nomDe(membres, l.de)}`;
  };

  return (
    <section className="tb-liste fi">
      {soldes.map((sol) => (
        <div key={sol.membre.id} className="tb-bloc">
          <h3>Entre {nomDe(membres, moi)} et {sol.membre.nom}</h3>
          {sol.montant === 0 ? (
            <p className="bl-gros"><span>Tout est à jour</span><strong>0 ₪</strong></p>
          ) : (
            <p className="bl-gros">
              <span>{sol.de === moi ? `À reverser à ${sol.membre.nom}` : `${sol.membre.nom} doit te reverser`}</span>
              <strong>{shekels(sol.montant)}</strong>
            </p>
          )}
          {sol.montant > 0 && !form && <button className="tb-bouton" onClick={() => ouvrir(sol)}>C'est reversé</button>}
          {form && form.solde.membre.id === sol.membre.id && (
            <div className="pm-form">
              <h4>{nomDe(membres, form.de)} reverse à {nomDe(membres, form.vers)}</h4>
              <label className="pm-champ">
                Montant (₪)
                <input inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
              </label>
              <label className="pm-champ">
                Date
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="pm-champ">
                Détail (facultatif)
                <input value={form.note} maxLength={200} placeholder="Ex : en espèces, par Bit" onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              <p className="tb-note">Une fois enregistré, le reversement ne peut plus être modifié ni supprimé.</p>
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>Confirmer</button>
                <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => setForm(null)}>Annuler</button>
              </div>
            </div>
          )}
          {erreur && form && form.solde.membre.id === sol.membre.id && <p className="admin-erreur" role="alert">{erreur}</p>}
        </div>
      ))}

      <div className="tb-bloc">
        <h3>Détail</h3>
        {miennes.length === 0 && <p className="tb-note">Rien à reverser : chacun a encaissé ses propres courses.</p>}
        {miennes.length > 0 && (
          <ul className="pm-liste">
            {visibles.map((l) => (
              <li key={l.id}>
                <span>
                  {libelleLigne(l)}
                  <small> · {l.de === moi ? "à reverser à " + nomDe(membres, l.vers) : "à recevoir de " + nomDe(membres, l.de)}</small>
                </span>
                <strong>{shekels(l.montant)}</strong>
              </li>
            ))}
          </ul>
        )}
        {miennes.length > visibles.length && <button className="tb-retour aj-lien" onClick={() => setToutVoir(true)}>Voir les {miennes.length} lignes</button>}
        <p className="tb-note">Le chiffre d'affaires de chaque course compte pour celui qui l'a faite. L'argent du crédit prépayé est gardé par Rebecca.</p>
      </div>

      {historique.length > 0 && (
        <div className="tb-bloc">
          <h3>Reversements faits</h3>
          <ul className="pm-liste">
            {historique.map((r) => (
              <li key={r.id}>
                <span>
                  {jourCourt(r.date)} · {nomDe(membres, r.de)} → {nomDe(membres, r.vers)}
                  {r.note ? <small> ({r.note})</small> : null}
                </span>
                <strong>{shekels(Number(r.montant) || 0)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// membre : fiche du coequipier pour « Mes finances » (null = espace de Rebecca)
export default function Finances({ membre = null }) {
  const { membres, vehicules } = useEquipeContexte();
  const estRebecca = !membre;
  const moi = membre ? membre.id : ADMIN_ID;
  const enEquipe = (membres || []).length > 1;
  const [vue, setVue] = useState(estRebecca ? "monmois" : "annee");
  const [personne, setPersonne] = useState(moi); // Rebecca : son id, celui d'un membre ou "tous"
  const [reglages, setReglages] = useState({ plafondOsek: PLAFOND_DEFAUT, plafondVerifie: false });
  const { donnees, pret, lectureImpossible } = useDonnees(moi, estRebecca);

  // Plafond de l'osek patur de Rebecca (reglage prive, onglet Reglages) ; jamais lu par un coequipier
  useEffect(() => {
    if (!estRebecca) return undefined;
    return onSnapshot(
      doc(db, "admin", "reglages"),
      (s) => {
        const d = s.exists() ? s.data() : {};
        const p = Number(d.plafondOsek);
        setReglages({ plafondOsek: Number.isFinite(p) && p > 0 ? p : PLAFOND_DEFAUT, plafondVerifie: d.plafondVerifie === true });
      },
      () => {}
    );
  }, [estRebecca]);

  // Plafond de la personne regardee : celui de Rebecca, ou celui de la fiche du membre (son osek a lui)
  const fichePersonne = (membres || []).find((m) => m.id === personne) || membre || {};
  const reglagesPersonne = personne === ADMIN_ID ? reglages : { plafondOsek: Number(fichePersonne.plafond) > 0 ? Number(fichePersonne.plafond) : PLAFOND_DEFAUT, plafondVerifie: false };
  const mesVehicules = useMemo(() => vehiculesEffectifs(vehicules).filter((v) => v.actif !== false && (v.proprietaire === moi || (v.partageAvec || []).includes(moi))), [vehicules, moi]);
  const vues = VUES.filter((v) => (!v.equipe || enEquipe) && (!v.rebecca || estRebecca));
  const choixPersonne = estRebecca && enEquipe && (vue === "annee" || vue === "bilan");
  const besoinDonnees = vue === "annee" || vue === "wolt" || vue === "reverser" || vue === "essence" || vue === "monmois";

  return (
    <>
      <div className="tb-filtres tb-pad fi-choix" role="tablist" aria-label="Finances">
        {vues.map((v) => (
          <button key={v.id} role="tab" aria-selected={vue === v.id} className={"tb-filtre" + (vue === v.id ? " actif" : "")} onClick={() => setVue(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {choixPersonne && (
        <div className="tb-filtres tb-pad" role="tablist" aria-label="Finances de qui">
          {[...membres.map((m) => ({ id: m.id, label: m.id === moi ? "Moi" : m.nom })), { id: "tous", label: "Global" }].map((o) => (
            <button key={o.id} role="tab" aria-selected={personne === o.id} className={"tb-filtre" + (personne === o.id ? " actif" : "")} onClick={() => setPersonne(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {vue === "bilan" && <Bilan personne={enEquipe ? personne : "tous"} />}
      {vue === "depenses" && <Depenses moi={moi} vehicules={mesVehicules} />}
      {besoinDonnees && lectureImpossible && <p className="admin-erreur tb-pad" role="alert">Lecture des finances impossible. Vérifie la connexion et les règles Firebase.</p>}
      {besoinDonnees && !lectureImpossible && !pret && <p className="admin-texte tb-pad">Chargement des finances…</p>}
      {vue === "annee" && pret && <Annee donnees={donnees} reglages={reglagesPersonne} personne={estRebecca && enEquipe ? personne : moi} membres={membres} vehicules={vehicules} enEquipe={enEquipe} />}
      {vue === "reverser" && pret && <AReverser donnees={donnees} moi={moi} membres={membres} />}
      {vue === "wolt" && pret && <AutresRevenus lignes={donnees.autresRevenus} moi={moi} />}
      {vue === "monmois" && pret && estRebecca && <MonMoisVue donnees={donnees} />}
      {vue === "essence" && pret && estRebecca && <EssenceVue demandes={donnees.demandes} autresRevenus={donnees.autresRevenus} />}
    </>
  );
}
