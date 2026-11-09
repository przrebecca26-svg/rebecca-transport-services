import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { MARGE_DEFAUT } from "./pricing/enchainement.js";
import { PLAFOND_DEFAUT } from "./pricing/financesAnnee.js";
import { MAX_SECTIONS, MAX_TEXTE, MAX_TITRE, SECTIONS_DEPART, sectionsValides } from "./textesLegaux.js";
import "./reglages.css";

// Onglet « Reglages » de l'espace prive (Lot B, seance B5) :
//  - marge entre deux courses (reglages/enchainement, lu par l'onglet Demandes) ;
//  - plafond de l'osek patur (admin/reglages, prive, lu par l'onglet Finances) ;
//  - textes « Confidentialite et conditions » (reglages/legal, lu par la page publique), etat provisoire / verifie.
// Les regles Firestore v7 autorisent deja ces ecritures (reglages et admin : Rebecca seule).

const lireNombre = (s) => {
  const t = String(s == null ? "" : s).trim().replace(",", ".").replace(/\s/g, "");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : null;
};

function Message({ m }) {
  if (!m) return null;
  return <p className={m.erreur ? "admin-erreur" : "rg-ok"} role={m.erreur ? "alert" : "status"}>{m.texte}</p>;
}

/* ---------- Marge entre deux courses ---------- */
function Marge() {
  const [valeur, setValeur] = useState("");
  const [enBase, setEnBase] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "enchainement"),
        (s) => {
          const m = s.exists() ? Number(s.data().margeMinutes) : MARGE_DEFAUT;
          const v = Number.isFinite(m) ? m : MARGE_DEFAUT;
          setEnBase(v);
          setValeur((avant) => (avant === "" ? String(v) : avant));
        },
        () => setEnBase(MARGE_DEFAUT)
      ),
    []
  );

  const enregistrer = async () => {
    const n = lireNombre(valeur);
    if (n == null || !Number.isInteger(n) || n < 0 || n > 180) {
      setMessage({ erreur: true, texte: "Indique un nombre de minutes entre 0 et 180." });
      return;
    }
    try {
      await setDoc(doc(db, "reglages", "enchainement"), { margeMinutes: n, majLe: serverTimestamp() });
      setMessage({ texte: "Marge enregistrée." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion puis réessaie." });
    }
  };

  return (
    <div className="tb-bloc">
      <h3>Marge entre deux courses</h3>
      <p className="tb-note">Quand tu acceptes une course, l'application vérifie que tu as le temps de faire le trajet jusqu'à la course suivante, plus cette marge (bouchons, imprévus).</p>
      <div className="rg-ligne">
        <input inputMode="numeric" value={valeur} onChange={(e) => { setValeur(e.target.value); setMessage(null); }} aria-label="Marge en minutes" />
        <span>minutes</span>
        <button className="tb-bouton" disabled={enBase != null && lireNombre(valeur) === enBase} onClick={enregistrer}>Enregistrer</button>
      </div>
      <Message m={message} />
    </div>
  );
}

/* ---------- Plafond de l'osek patur ---------- */
function Plafond() {
  const [form, setForm] = useState(null);
  const [enBase, setEnBase] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "admin", "reglages"),
        (s) => {
          const d = s.exists() ? s.data() : {};
          const p = Number(d.plafondOsek);
          const v = { plafond: String(Number.isFinite(p) && p > 0 ? p : PLAFOND_DEFAUT), verifie: d.plafondVerifie === true, note: d.plafondNote || "" };
          setEnBase(v);
          setForm((avant) => avant || v);
        },
        () => setForm((avant) => avant || { plafond: String(PLAFOND_DEFAUT), verifie: false, note: "" })
      ),
    []
  );

  if (!form) return null;
  const change = enBase && (form.plafond !== enBase.plafond || form.verifie !== enBase.verifie || form.note !== enBase.note);

  const enregistrer = async () => {
    const n = lireNombre(form.plafond);
    if (n == null || n < 1000 || n > 10000000) {
      setMessage({ erreur: true, texte: "Indique un plafond en shekels (par exemple 100000)." });
      return;
    }
    try {
      await setDoc(
        doc(db, "admin", "reglages"),
        { plafondOsek: Math.round(n), plafondVerifie: form.verifie, plafondNote: form.note.trim().slice(0, 200), majLe: serverTimestamp() },
        { merge: true }
      );
      setForm({ ...form, plafond: String(Math.round(n)), note: form.note.trim().slice(0, 200) });
      setMessage({ texte: "Plafond enregistré." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion puis réessaie." });
    }
  };

  return (
    <div className="tb-bloc">
      <h3>Plafond de l'osek patur</h3>
      <p className="tb-note">Comparé dans Finances au cumul de l'année (toutes mes activités + Wolt). Jamais visible par les clients.</p>
      <div className="rg-ligne">
        <input inputMode="numeric" value={form.plafond} onChange={(e) => { setForm({ ...form, plafond: e.target.value }); setMessage(null); }} aria-label="Plafond en shekels" />
        <span>₪ par an</span>
      </div>
      <label className="rg-case">
        <input type="checkbox" checked={form.verifie} onChange={(e) => { setForm({ ...form, verifie: e.target.checked }); setMessage(null); }} />
        <span>Vérifié par mon comptable</span>
      </label>
      <label className="pm-champ">
        Note (facultatif)
        <input value={form.note} maxLength={200} onChange={(e) => { setForm({ ...form, note: e.target.value }); setMessage(null); }} placeholder="Ex : confirmé par téléphone le 12/11" />
      </label>
      <p className={"rg-etat" + (enBase && enBase.verifie ? " rg-verifie" : "")}>{enBase && enBase.verifie ? "État : vérifié" : "État : provisoire"}</p>
      <div className="tb-actions">
        <button className="tb-bouton" disabled={!change} onClick={enregistrer}>Enregistrer</button>
      </div>
      <Message m={message} />
    </div>
  );
}

/* ---------- Textes « Confidentialite et conditions » ---------- */
function Textes() {
  const [doc0, setDoc0] = useState(undefined); // undefined = chargement, null = rien en base
  const [sections, setSections] = useState(null);
  const [statut, setStatut] = useState("provisoire");
  const [verifiePar, setVerifiePar] = useState("");
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "legal"),
        (s) => setDoc0(s.exists() ? s.data() : null),
        () => setDoc0(null)
      ),
    []
  );

  // Premier chargement (ou rechargement quand rien n'est en cours de modification)
  useEffect(() => {
    if (doc0 === undefined || modifie) return;
    setSections(sectionsValides(doc0 && doc0.sections) || SECTIONS_DEPART.map((s) => ({ ...s })));
    setStatut(doc0 && doc0.statut === "verifie" ? "verifie" : "provisoire");
    setVerifiePar((doc0 && doc0.verifiePar) || "");
  }, [doc0]);

  if (!sections) return <div className="tb-bloc"><h3>Confidentialité et conditions</h3><p className="tb-note">Chargement…</p></div>;

  const toucher = () => {
    setModifie(true);
    setMessage(null);
  };
  const changer = (i, champ, valeur) => {
    setSections(sections.map((s, j) => (j === i ? { ...s, [champ]: valeur } : s)));
    toucher();
  };
  const deplacer = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= sections.length) return;
    const copie = [...sections];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    setSections(copie);
    toucher();
  };
  const retirer = (i) => {
    setSections(sections.filter((_, j) => j !== i));
    toucher();
  };
  const ajouter = () => {
    if (sections.length >= MAX_SECTIONS) return;
    setSections([...sections, { titre: "", texte: "" }]);
    toucher();
  };
  const texteDepart = () => {
    setSections(SECTIONS_DEPART.map((s) => ({ ...s })));
    toucher();
  };
  const annuler = () => {
    setModifie(false);
    setSections(sectionsValides(doc0 && doc0.sections) || SECTIONS_DEPART.map((s) => ({ ...s })));
    setStatut(doc0 && doc0.statut === "verifie" ? "verifie" : "provisoire");
    setVerifiePar((doc0 && doc0.verifiePar) || "");
    setMessage(null);
  };

  const enregistrer = async () => {
    const propres = sections.map((s) => ({ titre: s.titre.trim().slice(0, MAX_TITRE), texte: s.texte.trim().slice(0, MAX_TEXTE) })).filter((s) => s.titre || s.texte);
    if (propres.length === 0) {
      setMessage({ erreur: true, texte: "Le texte ne peut pas être vide." });
      return;
    }
    if (statut === "verifie" && verifiePar.trim().length < 2) {
      setMessage({ erreur: true, texte: "Indique qui a vérifié le texte (ex : mon comptable, mon avocat)." });
      return;
    }
    setEnCours(true);
    try {
      await setDoc(doc(db, "reglages", "legal"), {
        sections: propres,
        statut,
        verifiePar: statut === "verifie" ? verifiePar.trim().slice(0, 80) : "",
        majLe: serverTimestamp(),
      });
      setModifie(false);
      setMessage({ texte: "Texte enregistré : il est visible tout de suite sur le site." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion puis réessaie." });
    }
    setEnCours(false);
  };

  return (
    <div className="tb-bloc">
      <h3>Confidentialité et conditions</h3>
      <p className="tb-note">
        Le texte de la page publique « Confidentialité et conditions ». {doc0 ? "" : "Pour l'instant, c'est le texte de départ (jamais enregistré). "}Une ligne vide sépare deux paragraphes.
      </p>
      <p className={"rg-etat" + (doc0 && doc0.statut === "verifie" ? " rg-verifie" : "")}>
        {doc0 && doc0.statut === "verifie" ? `État : vérifié${doc0.verifiePar ? " par " + doc0.verifiePar : ""}` : "État : provisoire (le site affiche « Version provisoire »)"}
      </p>

      {sections.map((s, i) => (
        <div key={i} className="rg-section">
          <div className="rg-section-tete">
            <input value={s.titre} maxLength={MAX_TITRE} onChange={(e) => changer(i, "titre", e.target.value)} placeholder="Titre" aria-label={`Titre de la section ${i + 1}`} />
            <button className="rg-mini" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}>↑</button>
            <button className="rg-mini" aria-label="Descendre" disabled={i === sections.length - 1} onClick={() => deplacer(i, 1)}>↓</button>
            <button className="rg-mini" aria-label="Supprimer la section" onClick={() => retirer(i)}>✕</button>
          </div>
          <textarea value={s.texte} maxLength={MAX_TEXTE} rows={5} onChange={(e) => changer(i, "texte", e.target.value)} aria-label={`Texte de la section ${i + 1}`} />
        </div>
      ))}
      {sections.length < MAX_SECTIONS && <button className="tb-retour aj-lien" onClick={ajouter}>+ Ajouter une section</button>}

      <fieldset className="rg-statut">
        <legend>État du texte</legend>
        <label className="rg-case">
          <input type="radio" name="statut-legal" checked={statut === "provisoire"} onChange={() => { setStatut("provisoire"); toucher(); }} />
          <span>Provisoire</span>
        </label>
        <label className="rg-case">
          <input type="radio" name="statut-legal" checked={statut === "verifie"} onChange={() => { setStatut("verifie"); toucher(); }} />
          <span>Vérifié par un professionnel</span>
        </label>
        {statut === "verifie" && (
          <label className="pm-champ">
            Vérifié par
            <input value={verifiePar} maxLength={80} onChange={(e) => { setVerifiePar(e.target.value); toucher(); }} placeholder="Ex : mon comptable, mon avocat" />
          </label>
        )}
      </fieldset>

      <div className="tb-actions">
        <button className="tb-bouton" disabled={!modifie || enCours} onClick={enregistrer}>Enregistrer le texte</button>
        {modifie && <button className="tb-bouton tb-clair" onClick={annuler}>Annuler mes changements</button>}
      </div>
      <button className="tb-retour aj-lien" onClick={texteDepart}>Remettre le texte de départ</button>
      <Message m={message} />
    </div>
  );
}

export default function Reglages() {
  return (
    <section className="tb-liste rg">
      <Marge />
      <Plafond />
      <Textes />
      <p className="tb-note tb-pad">Les tarifs, les durées et les horaires des activités deviendront modifiables ici au Lot C.</p>
    </section>
  );
}
