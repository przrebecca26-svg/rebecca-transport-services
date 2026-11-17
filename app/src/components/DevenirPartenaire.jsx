import { useEffect, useState } from "react";
import { JOURS, MAXP, SERVICES_PARTENAIRE, STATUTS_FISCAUX, VEHICULES, construireCandidature, erreursPartenaire } from "../pricing/partenaires.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// DEVENIR PARTENAIRE (17 nov. 2026) - page #/partenaire : un futur coursier s'inscrit.
// Tant que Rebecca n'a pas ouvert les inscriptions, aucun lien ne mene ici (et un bandeau le dit).
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

function Texte({ titre, k, f, set, e, requis, type = "text", max = 200, long }) {
  return (
    <div className="champ">
      <label>{titre}{requis && " *"}
        {long ? (
          <textarea rows={3} maxLength={max} value={f[k] || ""} onChange={(x) => set(k, x.target.value)} />
        ) : (
          <input type={type} maxLength={max} value={f[k] || ""} onChange={(x) => set(k, x.target.value)} inputMode={type === "tel" ? "tel" : undefined} />
        )}
      </label>
      {e[k] && <span className="erreur" role="alert">{e[k]}</span>}
    </div>
  );
}

export default function DevenirPartenaire({ onAccueil, onLegal }) {
  const [f, setF] = useState({ vehicules: [], services: [], jours: [] });
  const [e, setE] = useState({});
  const [etat, setEtat] = useState({ enCours: false, ok: false, erreur: "" });
  const [ouvert, setOuvert] = useState(null);
  useEffect(() => {
    charger()
      .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "reglages", "partenaires")))
      .then((s) => setOuvert(s.exists() && s.data().ouvert === true))
      .catch(() => setOuvert(false));
  }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const envoyer = async () => {
    const err = erreursPartenaire(f);
    setE(err);
    if (Object.keys(err).length || etat.enCours) return;
    setEtat({ enCours: true, ok: false, erreur: "" });
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }] = await charger();
      await addDoc(collection(db, "candidaturesPartenaires"), { ...construireCandidature(f), creeLe: serverTimestamp() });
      window.scrollTo(0, 0);
      setEtat({ enCours: false, ok: true, erreur: "" });
    } catch {
      setEtat({ enCours: false, ok: false, erreur: "L'envoi n'a pas marché. Vérifiez la connexion puis réessayez." });
    }
  };

  if (etat.ok)
    return (
      <div className="bloc" style={{ maxWidth: 560, margin: "24px auto", padding: 20 }}>
        <h2>Merci {f.prenom} !</h2>
        <p>Votre candidature est bien arrivée. Je l'étudie et je vous recontacte sur WhatsApp pour faire connaissance.</p>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${f.prenom} ${f.nom} : je viens de m'inscrire pour devenir partenaire coursier.`)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }}>Prévenir Rebecca sur WhatsApp</a>
        <button type="button" className="lien" onClick={onAccueil} style={{ marginTop: 10 }}>Voir le site</button>
      </div>
    );

  return (
    <section className="catalogue-nails" style={{ maxWidth: 620, margin: "0 auto" }}>
      <button className="lien" onClick={onAccueil}>← Accueil</button>
      <h2>Devenir partenaire de Rebecca Services</h2>
      {ouvert === false && <p className="aide" style={{ border: "1px dashed", padding: 8, borderRadius: 8 }}>Page en préparation : elle n'est pas encore annoncée sur le site.</p>}
      <p>Vous êtes coursier, livreur ou chauffeur et vous voulez travailler avec moi pour les livraisons, les courses et les transports ? Laissez-moi vos informations : je vous recontacte pour faire connaissance.</p>
      <Texte titre="Prénom" k="prenom" requis f={f} set={set} e={e} max={MAXP.nom} />
      <Texte titre="Nom" k="nom" requis f={f} set={set} e={e} max={MAXP.nom} />
      <Texte titre="Téléphone / WhatsApp" k="telephone" type="tel" requis f={f} set={set} e={e} max={MAXP.telephone} />
      <Texte titre="E-mail" k="email" type="email" requis f={f} set={set} e={e} max={MAXP.email} />
      <Texte titre="Ville" k="ville" requis f={f} set={set} e={e} max={MAXP.ville} />
      <Texte titre="Zones où vous pouvez travailler (facultatif)" k="zones" f={f} set={set} e={e} max={MAXP.zones} />
      <Cases titre="Moyen de déplacement" options={VEHICULES} valeurs={f.vehicules} onChange={(v) => set("vehicules", v)} erreur={e.vehicules} />
      <label className="case"><input type="checkbox" checked={f.permis === true} onChange={(x) => set("permis", x.target.checked)} /><span>J'ai un permis de conduire valide</span></label>
      <label className="case"><input type="checkbox" checked={f.assurance === true} onChange={(x) => set("assurance", x.target.checked)} /><span>Mon véhicule est assuré pour ce travail</span></label>
      <Cases titre="Services qui vous intéressent" options={SERVICES_PARTENAIRE} valeurs={f.services} onChange={(v) => set("services", v)} erreur={e.services} />
      <Cases titre="Jours disponibles (jamais pendant Chabbat et les fêtes)" options={JOURS} valeurs={f.jours} onChange={(v) => set("jours", v)} erreur={e.jours} />
      <Texte titre="Horaires disponibles (facultatif)" k="dispos" f={f} set={set} e={e} max={MAXP.dispos} />
      <div className="champ">
        <label>Statut (facultatif)
          <select value={f.statutFiscal || ""} onChange={(x) => set("statutFiscal", x.target.value)}>
            <option value="">—</option>
            {STATUTS_FISCAUX.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <Texte titre="Votre expérience (Wolt, livraisons, transport…) (facultatif)" k="experience" long f={f} set={set} e={e} max={MAXP.experience} />
      <Texte titre="Un message pour moi (facultatif)" k="message" long f={f} set={set} e={e} max={MAXP.message} />
      <label className="case"><input type="checkbox" checked={f.majeur === true} onChange={(x) => set("majeur", x.target.checked)} /><span>J'ai 18 ans ou plus *</span></label>
      {e.majeur && <span className="erreur" role="alert">{e.majeur}</span>}
      <label className="case"><input type="checkbox" checked={f.consentement === true} onChange={(x) => set("consentement", x.target.checked)} /><span>J'accepte que mes informations soient utilisées pour étudier ma candidature. *</span></label>
      <button type="button" className="lien" onClick={onLegal}>Confidentialité et conditions</button>
      {e.consentement && <span className="erreur" role="alert">{e.consentement}</span>}
      {Object.keys(e).length > 0 && <p className="erreur" role="alert">Vérifiez les champs signalés.</p>}
      {etat.erreur && <p className="erreur" role="alert">{etat.erreur}</p>}
      <button type="button" className="bouton" disabled={etat.enCours} onClick={envoyer}>{etat.enCours ? "Envoi…" : "Envoyer ma candidature"}</button>
    </section>
  );
}
