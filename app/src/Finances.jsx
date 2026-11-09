import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import Bilan from "./Bilan.jsx";
import Depenses from "./Depenses.jsx";
import { ACTIVITES, NOMS_MOIS, PERIODES, PLAFOND_DEFAUT, etatPlafond, finProposee, jourDansAnnee, joursAnnee, syntheseAnnee, validerAutreRevenu } from "./pricing/financesAnnee.js";
import "./paiements.css";
import "./finances.css";

// Onglet « Finances » de l'espace prive (Lot B, seance B4) :
//  - Annee : chiffre d'affaires par activite et par mois, Wolt, pourboires a part, credit, benefice, plafond osek patur ;
//  - Bilan : bilan detaille d'une periode + sauvegarde et journal (Bilan.jsx, inchange) ;
//  - Wolt : saisie des autres revenus (Wolt...) ;
//  - Depenses : Depenses.jsx (inchange).

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

const VUES = [
  { id: "annee", label: "Année" },
  { id: "bilan", label: "Bilan" },
  { id: "wolt", label: "Wolt" },
  { id: "depenses", label: "Dépenses" },
];

const COLLECTIONS = ["demandes", "mouvements", "depenses", "autresRevenus", "avis", "recharges", "creditMouvements"];

// Lecture en direct des collections utiles aux finances
function useDonnees() {
  const [donnees, setDonnees] = useState({});
  const [lectureImpossible, setLectureImpossible] = useState(false);
  useEffect(() => {
    const arrets = COLLECTIONS.map((nom) =>
      onSnapshot(
        collection(db, nom),
        (s) => setDonnees((avant) => ({ ...avant, [nom]: s.docs.map((x) => ({ id: x.id, ...x.data() })) })),
        () => setLectureImpossible(true)
      )
    );
    return () => arrets.forEach((a) => a());
  }, []);
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
function Annee({ donnees, reglages }) {
  const anneeCourante = Number(aujourdhui().slice(0, 4));
  const [annee, setAnnee] = useState(anneeCourante);
  const [moisOuvert, setMoisOuvert] = useState(false);

  const s = useMemo(() => syntheseAnnee({ annee, ...donnees }), [annee, donnees]);
  const enCours = annee === anneeCourante;
  const plafond = etatPlafond(s.cumulPlafond, reglages.plafondOsek, enCours ? jourDansAnnee(aujourdhui()) : null, joursAnnee(annee));
  const t = s.totaux;
  const moisAffiches = s.mois.map((m, i) => ({ ...m, i })).filter((m) => m.ca || m.wolt || m.depenses);

  return (
    <section className="tb-liste fi">
      <div className="dp-mois">
        <button className="dp-fleche" aria-label="Année précédente" onClick={() => setAnnee(annee - 1)}>‹</button>
        <strong>{annee}</strong>
        <button className="dp-fleche" aria-label="Année suivante" disabled={annee >= anneeCourante} onClick={() => setAnnee(annee + 1)}>›</button>
      </div>

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
          Cumul = chiffre d'affaires de toutes mes activités + revenus Wolt (sans les pourboires).
          {reglages.plafondVerifie ? " Plafond vérifié par le comptable." : " Plafond et mode de calcul provisoires, à confirmer avec le comptable (modifiable dans Réglages)."}
        </p>
      </div>

      <div className="tb-bloc">
        <h3>Résultat {annee}</h3>
        <p className="bl-gros">
          <span>Bénéfice</span>
          <strong className={t.benefice < 0 ? "bl-neg" : undefined}>{shekels(t.benefice)}</strong>
        </p>
        <ul className="pm-resume">
          <Ligne nom="Chiffre d'affaires de mes activités" valeur={shekels(t.caActivites)} />
          {ACTIVITES.map((a) => (
            <Ligne key={a.id} sous nom={a.label} valeur={shekels(t[a.id])} />
          ))}
          {t.autre > 0 && <Ligne sous nom="Autres" valeur={shekels(t.autre)} />}
          <Ligne nom="Revenus Wolt et autres" valeur={shekels(t.wolt)} />
          <Ligne nom="Dépenses" valeur={"- " + shekels(t.depenses)} />
        </ul>
        <p className="tb-note">
          {t.courses} course{t.courses > 1 ? "s" : ""} terminée{t.courses > 1 ? "s" : ""}{t.prixMoyen ? ` · prix moyen ${shekels(t.prixMoyen)}` : ""}
          {t.annulations > 0 ? ` · dont ${shekels(t.annulations)} gardés après annulation` : ""}.
        </p>
      </div>

      <div className="tb-bloc">
        <h3>À part (hors chiffre d'affaires)</h3>
        <ul className="pm-resume">
          <Ligne nom="Pourboires de mes clients" valeur={shekels(s.pourboires.clients)} />
          <Ligne nom="Pourboires Wolt" valeur={shekels(s.pourboires.wolt)} />
          <Ligne nom="Recharges de crédit reçues" valeur={shekels(s.credit.rechargesRecues)} />
          <Ligne sous nom="Bonus de crédit offerts" valeur={shekels(s.credit.bonusOfferts)} />
        </ul>
        <p className="tb-note">Les recharges sont de l'argent reçu d'avance : il devient du chiffre d'affaires quand la course est faite. Les bonus sont offerts, ce n'est pas de l'argent reçu. Traitement des pourboires à confirmer avec le comptable.</p>
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
                    <strong className={m.benefice < 0 ? "bl-neg" : undefined}>{shekels(m.benefice)}</strong>
                  </div>
                  <small>
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
            <p className="tb-note">Bénéfice du mois = chiffre d'affaires + Wolt − dépenses.</p>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Vue Wolt (autres revenus) ---------- */
const formulaireVide = () => ({ source: "Wolt", periode: "semaine", debut: aujourdhui(), fin: finProposee("semaine", aujourdhui()), livraisons: "", revenu: "", pourboire: "", detail: "" });

function AutresRevenus({ lignes }) {
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
      setForm({ source: l.source || "Wolt", periode: l.periode, debut: l.debut, fin: l.fin, livraisons: String(l.livraisons ?? ""), revenu: String(l.revenu ?? ""), pourboire: String(l.pourboire ?? ""), detail: l.detail || "" });
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
      if (edition) {
        await updateDoc(doc(db, "autresRevenus", edition), { ...v.ligne, ...(v.ligne.detail ? {} : { detail: deleteField() }), majLe: serverTimestamp() });
      } else {
        await addDoc(collection(db, "autresRevenus"), { ...v.ligne, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      }
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

export default function Finances() {
  const [vue, setVue] = useState("annee");
  const [reglages, setReglages] = useState({ plafondOsek: PLAFOND_DEFAUT, plafondVerifie: false });
  const { donnees, pret, lectureImpossible } = useDonnees();

  // Plafond de l'osek patur (reglage prive, onglet Reglages)
  useEffect(
    () =>
      onSnapshot(
        doc(db, "admin", "reglages"),
        (s) => {
          const d = s.exists() ? s.data() : {};
          const p = Number(d.plafondOsek);
          setReglages({ plafondOsek: Number.isFinite(p) && p > 0 ? p : PLAFOND_DEFAUT, plafondVerifie: d.plafondVerifie === true });
        },
        () => {}
      ),
    []
  );

  return (
    <>
      <div className="tb-filtres tb-pad fi-choix" role="tablist" aria-label="Finances">
        {VUES.map((v) => (
          <button key={v.id} role="tab" aria-selected={vue === v.id} className={"tb-filtre" + (vue === v.id ? " actif" : "")} onClick={() => setVue(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {vue === "bilan" && <Bilan />}
      {vue === "depenses" && <Depenses />}
      {(vue === "annee" || vue === "wolt") && lectureImpossible && <p className="admin-erreur tb-pad" role="alert">Lecture des finances impossible. Vérifie la connexion et les règles Firebase.</p>}
      {(vue === "annee" || vue === "wolt") && !lectureImpossible && !pret && <p className="admin-texte tb-pad">Chargement des finances…</p>}
      {vue === "annee" && pret && <Annee donnees={donnees} reglages={reglages} />}
      {vue === "wolt" && pret && <AutresRevenus lignes={donnees.autresRevenus} />}
    </>
  );
}
