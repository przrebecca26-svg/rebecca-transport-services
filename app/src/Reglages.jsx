import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { MAX_AVIS_PUBLICS, avisPublic, lireAvisPublics, normaliserRevolut } from "./pricing/suiteClient.js";
import { db } from "./firebase.js";
import { oublierModele } from "./mailClient.js";
import { MARGE_DEFAUT } from "./pricing/enchainement.js";
import { PLAFOND_DEFAUT } from "./pricing/financesAnnee.js";
import { MAX_SECTIONS, MAX_TEXTE, MAX_TITRE, SECTIONS_DEPART, VERSION_TEXTE, sectionsValides } from "./textesLegaux.js";
import ReglagesAuto from "./ReglagesAuto.jsx";
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
  const [depuisDepart, setDepuisDepart] = useState(false); // 17 nov. 2026 : nouveau texte de depart repris

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
    setDepuisDepart(true);
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
        version: depuisDepart ? VERSION_TEXTE : (doc0 && doc0.version) || "",
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
      {doc0 && doc0.version !== VERSION_TEXTE && (
        <p className="dm-verif dm-alerte">Nouveau texte de départ du 17 novembre (toutes les activités, acomptes, paiements, e-mails, Digital, Epoxy) : touche « Remettre le texte de départ » tout en bas, relis, puis « Enregistrer le texte ».</p>
      )}
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

/* ---------- E-mails aux clientes (17 nov. 2026) ---------- */
// Identifiant du modele EmailJS « message a une cliente » (reglages/emails.modeleClient), lu par mailClient.js
function EmailsClientes() {
  const [valeur, setValeur] = useState("");
  const [enBase, setEnBase] = useState(null);
  const [message, setMessage] = useState(null);
  useEffect(
    () => onSnapshot(doc(db, "reglages", "emails"), (x) => {
      const m = x.exists() ? String(x.data().modeleClient || "") : "";
      setEnBase(m);
      setValeur((v) => v || m);
    }, () => setEnBase("")),
    []
  );
  const enregistrer = async () => {
    const m = valeur.trim();
    if (!/^template_[A-Za-z0-9_-]{3,60}$/.test(m)) return setMessage({ erreur: true, texte: "Colle l'identifiant du modèle, il commence par « template_ »." });
    try {
      await setDoc(doc(db, "reglages", "emails"), { modeleClient: m, majLe: serverTimestamp() });
      oublierModele();
      setMessage({ texte: "Enregistré : les messages partiront aussi par e-mail." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion." });
    }
  };
  return (
    <div className="tb-bloc">
      <h3>E-mails aux clientes</h3>
      <p className="tb-note">Merci, rappel de la veille, « je suis en route » et demande d'avis partent aussi par e-mail, tout seuls, quand la cliente a donné son adresse.</p>
      <p className="tb-note">{enBase ? "✅ Activé." : "À faire une fois : sur emailjs.com → Email Templates → Create New Template. Sujet : {{sujet}} · Contenu : {{{message_html}}} · To Email : {{to_email}} · From Name : Rebecca Services. Enregistre, copie son identifiant (template_…) et colle-le ici."}</p>
      <label className="pm-champ">
        Identifiant du modèle
        <input value={valeur} maxLength={70} onChange={(e) => { setValeur(e.target.value); setMessage(null); }} placeholder="template_xxxxxxx" />
      </label>
      <div className="tb-actions">
        <button className="tb-bouton" disabled={valeur.trim() === (enBase || "")} onClick={enregistrer}>Enregistrer</button>
      </div>
      <Message m={message} />
    </div>
  );
}

/* ---------- Mon minimum par heure (17 nov. 2026) ---------- */
function Minimum() {
  const [valeur, setValeur] = useState("");
  const [enBase, setEnBase] = useState(null);
  const [message, setMessage] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "rentabilite"), (x) => {
    const n = x.exists() ? Number(x.data().minParHeure) || 0 : 0;
    setEnBase(n);
    setValeur((v) => v || (n ? String(n) : ""));
  }, () => setEnBase(0)), []);
  const enregistrer = async () => {
    const n = lireNombre(valeur);
    if (n == null || n < 0 || n > 1000) return setMessage({ erreur: true, texte: "Indique un montant en ₪ par heure (0 = pas d'alerte)." });
    try {
      await setDoc(doc(db, "reglages", "rentabilite"), { minParHeure: Math.round(n), majLe: serverTimestamp() });
      setMessage({ texte: "Enregistré." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion." });
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Mon minimum par heure</h3>
      <p className="tb-note">Dans le Devis rapide, une alerte s'affiche quand une course te rapporterait moins que ce montant par heure (après essence, retour à vide compris), avec un prix conseillé. 0 = pas d'alerte.</p>
      <label className="pm-champ">₪ par heure<input inputMode="numeric" value={valeur} onChange={(e) => { setValeur(e.target.value); setMessage(null); }} placeholder="ex. 80" /></label>
      <div className="tb-actions"><button className="tb-bouton" disabled={String(enBase || "") === valeur.trim()} onClick={enregistrer}>Enregistrer</button></div>
      <Message m={message} />
    </div>
  );
}

/* ---------- Paiement en ligne (17 nov. 2026) ---------- */
function PaiementEnLigne() {
  const [f, setF] = useState({ bit: "", paybox: "", revolut: "", paypal: "", avisGoogle: "", osek: "" });
  const [message, setMessage] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "paiement"), (x) => x.exists() && setF((v) => (v.bit || v.paybox || v.revolut || v.paypal ? v : { bit: x.data().bit || "", paybox: x.data().paybox || "", revolut: x.data().revolut || "", paypal: x.data().paypal || "", avisGoogle: x.data().avisGoogle || "", osek: x.data().osek || "" })), () => {}), []);
  const enregistrer = async () => {
    const bit = f.bit.trim();
    const paybox = f.paybox.trim();
    const paypal = f.paypal.trim();
    const avisGoogle = (f.avisGoogle || "").trim();
    const revolut = normaliserRevolut(f.revolut);
    if (f.revolut.trim() && !revolut) return setMessage({ erreur: true, texte: "Revolut : mets ton @pseudo (ex. @rebecca) ou ton lien revolut.me." });
    if (bit && bit.replace(/\D/g, "").length < 9) return setMessage({ erreur: true, texte: "Numéro Bit : ton numéro de téléphone (ex. 050 123 4567)." });
    if ([paybox, paypal, avisGoogle].some((u) => u && !/^https:\/\/\S+$/.test(u))) return setMessage({ erreur: true, texte: "Les liens doivent commencer par https://" });
    try {
      await setDoc(doc(db, "reglages", "paiement"), { bit: bit.slice(0, 20), paybox: paybox.slice(0, 300), revolut: revolut.slice(0, 300), paypal: paypal.slice(0, 300), avisGoogle: avisGoogle.slice(0, 300), osek: String(f.osek || "").replace(/[^0-9]/g, "").slice(0, 12), majLe: serverTimestamp() });
      setF((v) => ({ ...v, revolut }));
      setMessage({ texte: "Enregistré : le bouton « 💳 Envoyer le lien de paiement » apparaît sur les courses à encaisser." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion." });
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Paiement en ligne</h3>
      <p className="tb-note">Remplis ceux que tu utilises (laisse vide les autres). Ils sont envoyés à la cliente avec le montant à payer.</p>
      <label className="pm-champ">Bit (ton numéro)<input inputMode="tel" value={f.bit} onChange={(e) => setF({ ...f, bit: e.target.value })} placeholder="050 123 4567" /></label>
      <label className="pm-champ">Lien PayBox<input value={f.paybox} onChange={(e) => setF({ ...f, paybox: e.target.value })} placeholder="https://payboxapp.page.link/..." /></label>
      <label className="pm-champ">Lien Revolut<input value={f.revolut} onChange={(e) => setF({ ...f, revolut: e.target.value })} placeholder="@tonpseudo ou https://revolut.me/tonpseudo" /></label>
      <label className="pm-champ">Lien PayPal.me<input value={f.paypal} onChange={(e) => setF({ ...f, paypal: e.target.value })} placeholder="https://paypal.me/tonnom" /></label>
      <label className="pm-champ">Lien « Laisser un avis Google » (18 nov.)<input value={f.avisGoogle} onChange={(e) => setF({ ...f, avisGoogle: e.target.value })} placeholder="https://g.page/r/.../review" /></label>
      <p className="tb-note">Fiche Google Business → « Demander des avis » → copier le lien. Il est ajouté aux messages de remerciement et de demande d'avis.</p>
      <label className="pm-champ">Numéro d'osek (imprimé sur les reçus)<input inputMode="numeric" value={f.osek} onChange={(e) => setF({ ...f, osek: e.target.value })} /></label>
      <div className="tb-actions"><button className="tb-bouton" onClick={enregistrer}>Enregistrer</button></div>
      <Message m={message} />
    </div>
  );
}

/* ---------- Avis publies sur le site (17 nov. 2026) ---------- */
function AvisSurLeSite() {
  const [avis, setAvis] = useState(null);
  const [noms, setNoms] = useState({});
  const [publies, setPublies] = useState([]);
  const [message, setMessage] = useState(null);
  useEffect(() => onSnapshot(collection(db, "avis"), (x) => setAvis(x.docs.map((y) => ({ id: y.id, ...y.data() })).sort((a, b) => (b.creeLe?.seconds || 0) - (a.creeLe?.seconds || 0))), () => setAvis([])), []);
  useEffect(() => onSnapshot(doc(db, "reglages", "avisPublics"), (x) => setPublies(lireAvisPublics(x.exists() ? x.data().json : "[]")), () => {}), []);
  useEffect(() => {
    for (const a of avis || []) {
      if (!a.uid || noms[a.uid] !== undefined) continue;
      setNoms((n) => ({ ...n, [a.uid]: "" }));
      getDoc(doc(db, "clients", a.uid)).then((c) => setNoms((n) => ({ ...n, [a.uid]: c.exists() ? c.data().prenom || "" : "" }))).catch(() => {});
    }
  }, [avis]);
  const basculer = async (a) => {
    const deja = publies.some((p) => p.id === a.id);
    const liste = deja ? publies.filter((p) => p.id !== a.id) : [avisPublic(a, noms[a.uid]), ...publies].slice(0, MAX_AVIS_PUBLICS);
    try {
      await setDoc(doc(db, "reglages", "avisPublics"), { json: JSON.stringify(liste), majLe: serverTimestamp() });
      setMessage(null);
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion." });
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Avis sur mon site</h3>
      <p className="tb-note">Coche les avis à montrer sur la page d'accueil (prénom, étoiles et commentaire). {publies.length} publié{publies.length > 1 ? "s" : ""}.</p>
      {avis === null && <p className="tb-note">Chargement…</p>}
      {avis && avis.length === 0 && <p className="tb-note">Pas encore d'avis : ils arrivent quand une cliente avec un compte note sa course.</p>}
      {(avis || []).slice(0, 60).map((a) => (
        <label key={a.id} className="pm-champ" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input type="checkbox" checked={publies.some((p) => p.id === a.id)} onChange={() => basculer(a)} />
          <span>{"★".repeat(a.etoiles || 0)} {noms[a.uid] || "Cliente"}{a.commentaire ? ` — ${a.commentaire}` : ""}</span>
        </label>
      ))}
      <Message m={message} />
    </div>
  );
}

export default function Reglages() {
  return (
    <section className="tb-liste rg">
      <Marge />
      <Plafond />
      <Minimum />
      <PaiementEnLigne />
      <AvisSurLeSite />
      <EmailsClientes />
      <ReglagesAuto />
      <Textes />
      <p className="tb-note tb-pad">Les tarifs, les durées et les horaires des activités deviendront modifiables ici au Lot C.</p>
    </section>
  );
}
