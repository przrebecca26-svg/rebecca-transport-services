import { useEffect, useState } from "react";
import {
  JOURS, MAXP, OSEK, REGLEMENT_COURSIERS, SERVICES_PARTENAIRE, VEHICULE_UNIQUE, construireInscription, docsPour, erreursInscription,
  idDocument, lienSuiviPartenaire, suiviInitial,
} from "../pricing/partenaires.js";
import { reduirePhoto } from "../photoReduite.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// DEVENIR PARTENAIRE (17 nov. 2026 ; inscription complète le 18 nov., étape 2 des coursiers partenaires)
// Page #/partenaire : un futur coursier s'inscrit avec ses documents (photos réduites dans le téléphone).
// Il reçoit ensuite son lien de suivi #/partenaire/ID. Tant que Rebecca n'a pas ouvert les inscriptions,
// aucun lien du site ne mène ici (et un bandeau le dit).
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);

function Cases({ titre, options, valeurs = [], onChange, erreur }) {
  return (
    <fieldset className="champ">
      <legend>{titre} *</legend>
      {options.map((o) => {
        const v = o.v || o;
        return (
          <label key={v} className="case">
            <input type="checkbox" checked={valeurs.includes(v)} onChange={() => onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v])} />
            <span>{o.l || o}</span>
          </label>
        );
      })}
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </fieldset>
  );
}

function Choix({ titre, options, valeur, onChange, erreur }) {
  return (
    <fieldset className="champ">
      <legend>{titre} *</legend>
      {options.map((o) => (
        <label key={o.v} className="case">
          <input type="radio" checked={valeur === o.v} onChange={() => onChange(o.v)} />
          <span>{o.l}</span>
        </label>
      ))}
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </fieldset>
  );
}

function Texte({ titre, k, f, set, e, requis, type = "text", max = 200, long, aide }) {
  return (
    <div className="champ">
      <label>{titre}{requis && " *"}
        {long ? (
          <textarea rows={3} maxLength={max} value={f[k] || ""} onChange={(x) => set(k, x.target.value)} />
        ) : (
          <input type={type} maxLength={max} value={f[k] || ""} onChange={(x) => set(k, x.target.value)} inputMode={type === "tel" ? "tel" : undefined} />
        )}
      </label>
      {aide && <span className="aide">{aide}</span>}
      {e[k] && <span className="erreur" role="alert">{e[k]}</span>}
    </div>
  );
}

// Une photo de document : prise ou choisie, réduite, aperçu, « Changer »
export function PhotoDocument({ label, valeur, onChange }) {
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const choisir = async (x) => {
    const fichier = x.target.files && x.target.files[0];
    x.target.value = "";
    if (!fichier) return;
    setErreur("");
    setEnCours(true);
    try {
      onChange(await reduirePhoto(fichier));
    } catch (err) {
      setErreur(err.message || "Photo impossible.");
    }
    setEnCours(false);
  };
  return (
    <div className="champ" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {valeur ? <img src={valeur} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} /> : <span style={{ width: 64, height: 64, borderRadius: 8, border: "1px dashed", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>📄</span>}
      <label style={{ flex: 1 }}>
        <span>{label} *</span>
        <span className="bouton" style={{ display: "block", textAlign: "center", marginTop: 4, padding: "8px 10px" }}>{enCours ? "Préparation…" : valeur ? "Changer la photo" : "Prendre / choisir la photo"}</span>
        <input type="file" accept="image/*" onChange={choisir} style={{ display: "none" }} />
      </label>
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </div>
  );
}

export default function DevenirPartenaire({ onAccueil, onLegal }) {
  const [f, setF] = useState({ services: [], jours: [], documents: {} });
  const [e, setE] = useState({});
  const [etat, setEtat] = useState({ enCours: false, id: "", erreur: "", etape: "" });
  const [ouvert, setOuvert] = useState(null);
  const [voirReglement, setVoirReglement] = useState(false);
  useEffect(() => {
    charger()
      .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "partenaires")))
      .then((s) => setOuvert(s.exists() && s.data().ouvert === true))
      .catch(() => setOuvert(false));
  }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setDocument = (id, image) => setF((x) => ({ ...x, documents: { ...x.documents, [id]: image } }));

  const envoyer = async () => {
    const err = erreursInscription(f);
    setE(err);
    if (Object.keys(err).length || etat.enCours) return;
    setEtat({ enCours: true, id: "", erreur: "", etape: "Envoi de la candidature…" });
    try {
      const [{ db }, { collection, doc, serverTimestamp, setDoc, writeBatch }] = await charger();
      const ref = doc(collection(db, "candidaturesPartenaires"));
      const c = construireInscription(f);
      const lot = writeBatch(db);
      lot.set(ref, { ...c, creeLe: serverTimestamp() });
      lot.set(doc(db, "suiviPartenaires", ref.id), { ...suiviInitial(c), creeLe: serverTimestamp() });
      await lot.commit();
      const docs = docsPour(f.vehicule).filter((d) => f.documents[d.id]); // facultatifs : seulement s'ils sont là
      for (let i = 0; i < docs.length; i++) {
        setEtat((x) => ({ ...x, etape: `Envoi des documents (${i + 1}/${docs.length})…` }));
        await setDoc(doc(db, "documentsPartenaires", idDocument(ref.id, docs[i].id)), { candidature: ref.id, type: docs[i].id, image: f.documents[docs[i].id], creeLe: serverTimestamp() });
      }
      window.scrollTo(0, 0);
      setEtat({ enCours: false, id: ref.id, erreur: "", etape: "" });
    } catch {
      setEtat({ enCours: false, id: "", erreur: "L'envoi n'a pas marché. Vérifiez la connexion puis réessayez (ou écrivez-moi sur WhatsApp).", etape: "" });
    }
  };

  if (etat.id) {
    const lien = lienSuiviPartenaire(etat.id, window.location.origin.startsWith("http") ? window.location.origin : undefined);
    return (
      <div className="bloc" style={{ maxWidth: 560, margin: "24px auto", padding: 20 }}>
        <h2>Merci {f.prenom} !</h2>
        <p>Votre candidature et vos documents sont bien arrivés. Je les vérifie et je vous recontacte sur WhatsApp.</p>
        <p className="aide">Gardez ce lien pour suivre votre candidature (et envoyer un document si je vous en demande un) :<br /><a href={lien}>{lien}</a></p>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${f.prenom} ${f.nom} : je viens de m'inscrire comme coursier partenaire. Mon lien : ${lien}`)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }}>Prévenir Rebecca sur WhatsApp</a>
        <button type="button" className="lien" onClick={onAccueil} style={{ marginTop: 10 }}>Voir le site</button>
      </div>
    );
  }

  const docs = f.vehicule ? docsPour(f.vehicule) : [];
  return (
    <section className="catalogue-nails" style={{ maxWidth: 620, margin: "0 auto" }}>
      <button className="lien" onClick={onAccueil}>← Accueil</button>
      <h2>Devenir coursier partenaire</h2>
      {ouvert === false && <p className="aide" style={{ border: "1px dashed", padding: 8, borderRadius: 8 }}>Page en préparation : elle n'est pas encore annoncée sur le site.</p>}
      <p>Vous êtes coursier ou livreur et vous voulez faire des livraisons et des courses avec Rebecca Services ? Inscrivez-vous avec vos documents : je vérifie tout et je vous recontacte.</p>

      <h3>Vous</h3>
      <Texte titre="Prénom" k="prenom" requis f={f} set={set} e={e} max={MAXP.nom} />
      <Texte titre="Nom" k="nom" requis f={f} set={set} e={e} max={MAXP.nom} />
      <Texte titre="Téléphone / WhatsApp" k="telephone" type="tel" requis f={f} set={set} e={e} max={MAXP.telephone} />
      <Texte titre="E-mail" k="email" type="email" requis f={f} set={set} e={e} max={MAXP.email} />
      <Texte titre="Ville" k="ville" requis f={f} set={set} e={e} max={MAXP.ville} />
      <Texte titre="Zones où vous pouvez travailler (facultatif)" k="zones" f={f} set={set} e={e} max={MAXP.zones} />

      <h3>Votre travail</h3>
      <Choix titre="Moyen de déplacement" options={VEHICULE_UNIQUE} valeur={f.vehicule} onChange={(v) => set("vehicule", v)} erreur={e.vehicule} />
      <Cases titre="Services" options={SERVICES_PARTENAIRE} valeurs={f.services} onChange={(v) => set("services", v)} erreur={e.services} />
      <Cases titre="Jours disponibles (jamais pendant Chabbat et les fêtes)" options={JOURS} valeurs={f.jours} onChange={(v) => set("jours", v)} erreur={e.jours} />
      <Texte titre="Horaires disponibles (facultatif)" k="dispos" f={f} set={set} e={e} max={MAXP.dispos} />
      <Texte titre="Votre expérience (Wolt, livraisons…) (facultatif)" k="experience" long f={f} set={set} e={e} max={MAXP.experience} />

      <h3>Statut et paiement</h3>
      <Choix titre="Votre osek" options={OSEK} valeur={f.osek} onChange={(v) => set("osek", v)} erreur={e.osek} />
      <Texte titre="Où vous verser l'argent" k="paiement" requis f={f} set={set} e={e} max={200} aide="Numéro Bit ou PayBox, ou banque, agence et numéro de compte." />

      <h3>Documents</h3>
      {!f.vehicule && <p className="aide">Choisissez d'abord votre moyen de déplacement : la liste des documents s'affiche ici.</p>}
      {docs.map((d) => <PhotoDocument key={d.id} label={d.facultatif ? d.label : d.label + " *"} valeur={f.documents[d.id]} onChange={(img) => setDocument(d.id, img)} />)}
      {e.documents && <span className="erreur" role="alert">{e.documents}</span>}
      {f.vehicule && <p className="aide">Vos documents sont visibles par Rebecca seule.</p>}

      <h3>Règlement des coursiers</h3>
      <button type="button" className="lien" onClick={() => setVoirReglement(!voirReglement)}>{voirReglement ? "Masquer le règlement" : "Lire le règlement"}</button>
      {voirReglement && <ul className="aide">{REGLEMENT_COURSIERS.map((r) => <li key={r}>{r}</li>)}</ul>}
      <label className="case"><input type="checkbox" checked={f.reglement === true} onChange={(x) => set("reglement", x.target.checked)} /><span>J'ai lu et j'accepte le règlement des coursiers *</span></label>
      {e.reglement && <span className="erreur" role="alert">{e.reglement}</span>}

      <Texte titre="Un message pour moi (facultatif)" k="message" long f={f} set={set} e={e} max={MAXP.message} />
      <label className="case"><input type="checkbox" checked={f.majeur === true} onChange={(x) => set("majeur", x.target.checked)} /><span>J'ai 18 ans ou plus *</span></label>
      {e.majeur && <span className="erreur" role="alert">{e.majeur}</span>}
      <label className="case"><input type="checkbox" checked={f.consentement === true} onChange={(x) => set("consentement", x.target.checked)} /><span>J'accepte que mes informations et mes documents soient utilisés pour étudier ma candidature. *</span></label>
      <button type="button" className="lien" onClick={onLegal}>Confidentialité et conditions</button>
      {e.consentement && <span className="erreur" role="alert">{e.consentement}</span>}
      {Object.keys(e).length > 0 && <p className="erreur" role="alert">Vérifiez les champs signalés.</p>}
      {etat.erreur && <p className="erreur" role="alert">{etat.erreur}</p>}
      <button type="button" className="bouton" disabled={etat.enCours} onClick={envoyer}>{etat.enCours ? etat.etape || "Envoi…" : "Envoyer ma candidature"}</button>
    </section>
  );
}
