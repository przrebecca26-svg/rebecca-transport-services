import { useState } from "react";
import { CONDITIONS_ANNUAIRE, FORMULES_PRO, LANGUES, categoriesVisibles, erreursInscription, inscriptionVide, messageInscriptionWhatsApp } from "../pricing/pros.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { envoyerCandidature, useCategoriesPros } from "../prosBase.js";

// « VOUS ÊTES PROFESSIONNEL EN ISRAËL ? » (25 nov. 2026) - #/pro
// Page de recrutement + inscription. Aucune promesse de clients ni de revenus. Le dossier est « soumis » : il n'est
// JAMAIS publié sans la décision de Rebecca. Si l'enregistrement en ligne n'est pas encore possible (règles v37 pas
// publiées), le dossier complet part à Rebecca par WhatsApp : rien n'est perdu.

function Champ({ label, k, f, setF, e, type = "text", aide, multi, requis }) {
  return (
    <label className="champ">
      <span>{label}{requis ? " *" : ""}</span>
      {multi ? <textarea rows={4} value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value })} /> : <input type={type} value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value })} />}
      {aide && <span className="aide">{aide}</span>}
      {e[k] && <span className="erreur" role="alert">{e[k]}</span>}
    </label>
  );
}

export default function ProInscription({ onAccueil }) {
  const categories = useCategoriesPros();
  const cats = categoriesVisibles(categories || []);
  const [f, setF] = useState(inscriptionVide);
  const [e, setE] = useState({});
  const [etat, setEtat] = useState({ fait: false, lien: "", enCours: false });
  const envoyer = async () => {
    const err = erreursInscription(f);
    setE(err);
    if (Object.keys(err).length) return;
    setEtat({ fait: false, lien: "", enCours: true });
    const lien = lienWhatsApp(WHATSAPP, messageInscriptionWhatsApp(f, categories || []));
    try {
      await envoyerCandidature(f);
      setEtat({ fait: true, lien, enLigne: true, enCours: false });
    } catch {
      // enregistrement en ligne pas encore ouvert : le dossier part par WhatsApp
      setEtat({ fait: true, lien, enLigne: false, enCours: false });
    }
  };
  if (etat.fait)
    return (
      <section className="pp-bloc">
        <h2>Merci !</h2>
        {etat.enLigne ? (
          <p>Votre dossier est bien enregistré. Rebecca Services l'examine : votre fiche ne sera publiée qu'après validation. Envoyez vos justificatifs (identité, osek, assurance) en photo sur WhatsApp.</p>
        ) : (
          <p>Dernière étape : envoyez votre dossier à Rebecca Services sur WhatsApp, avec vos justificatifs (identité, osek, assurance) en photo. Votre fiche ne sera publiée qu'après validation.</p>
        )}
        <div className="tb-actions">
          <a className="pp-bouton" href={etat.lien} target="_blank" rel="noopener noreferrer">💬 {etat.enLigne ? "Envoyer mes justificatifs" : "Envoyer mon dossier"}</a>
          {onAccueil && <button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil</button>}
        </div>
      </section>
    );
  const cocher = (k) => setF({ ...f, [k]: !f[k] });
  return (
    <section>
      <div className="pp-bloc">
        {onAccueil && <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>}
        <h2>Vous êtes professionnel en Israël ?</h2>
        <p>Développez votre activité avec Rebecca Services : apparaissez dans notre annuaire de professionnels indépendants et, si vous le souhaitez, obtenez votre propre page et vos outils de gestion.</p>
        <ul>
          {FORMULES_PRO.map((x) => <li key={x.v}><b>{x.l}</b> : {x.detail}{x.v === "referencement" ? "" : " — sur devis"}</li>)}
        </ul>
        <p className="tb-note">Chaque fiche est vérifiée avant publication. Nous ne promettons pas de volume de clients ni de revenus. Vous restez seul responsable de vos prestations et de leur paiement.</p>
      </div>
      <div className="pp-bloc">
        <h3>Votre inscription</h3>
        <Champ label="Nom commercial" k="nomCommercial" f={f} setF={setF} e={e} requis />
        <Champ label="Prénom" k="prenom" f={f} setF={setF} e={e} requis />
        <Champ label="Nom" k="nom" f={f} setF={setF} e={e} requis />
        <label className="champ">
          <span>Métier *</span>
          <select value={f.categorie} onChange={(x) => setF({ ...f, categorie: x.target.value })}>
            <option value="">Choisir…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
          </select>
          {e.categorie && <span className="erreur" role="alert">{e.categorie}</span>}
        </label>
        <Champ label="Votre spécialité" k="metier" f={f} setF={setF} e={e} aide="ex. prothésiste ongulaire, plombier, pâtissière" />
        <Champ label="Présentation de votre activité" k="description" f={f} setF={setF} e={e} multi requis />
        <Champ label="Prestations proposées" k="prestations" f={f} setF={setF} e={e} multi />
        <Champ label="Tarifs indicatifs" k="tarifs" f={f} setF={setF} e={e} aide="ou laissez vide : « sur devis »" />
        <Champ label="Villes" k="villes" f={f} setF={setF} e={e} aide="ex. Netanya, Hadera" requis />
        <Champ label="Zone d'intervention" k="zone" f={f} setF={setF} e={e} aide="ex. 20 km autour de Netanya, toute Israël" />
        <fieldset className="champ">
          <legend>Langues parlées</legend>
          {LANGUES.map((l) => (
            <label key={l} className="case">
              <input type="checkbox" checked={f.langues.includes(l)} onChange={() => setF({ ...f, langues: f.langues.includes(l) ? f.langues.filter((x) => x !== l) : [...f.langues, l] })} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>
        <Champ label="Horaires" k="horaires" f={f} setF={setF} e={e} />
        <Champ label="Téléphone" k="telephone" f={f} setF={setF} e={e} type="tel" />
        <Champ label="WhatsApp" k="whatsapp" f={f} setF={setF} e={e} type="tel" />
        <label className="case"><input type="checkbox" checked={f.whatsappPublic} onChange={() => cocher("whatsappPublic")} /><span>Afficher mon numéro sur ma fiche</span></label>
        <Champ label="E-mail" k="email" f={f} setF={setF} e={e} type="email" />
        <Champ label="Numéro d'osek" k="osek" f={f} setF={setF} e={e} requis />
        <fieldset className="champ">
          <legend>Formule souhaitée</legend>
          {FORMULES_PRO.map((x) => (
            <label key={x.v} className="case"><input type="radio" checked={f.formule === x.v} onChange={() => setF({ ...f, formule: x.v })} /><span>{x.l}</span></label>
          ))}
        </fieldset>
        <div className="champ">
          <span>Conditions de l'annuaire</span>
          <ul className="tb-note">{CONDITIONS_ANNUAIRE.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <label className="case"><input type="checkbox" checked={f.independant} onChange={() => cocher("independant")} /><span>Je suis un professionnel indépendant et je réalise moi-même mes prestations *</span></label>
        {e.independant && <span className="erreur" role="alert">{e.independant}</span>}
        <label className="case"><input type="checkbox" checked={f.conditions} onChange={() => cocher("conditions")} /><span>J'accepte les conditions de l'annuaire *</span></label>
        {e.conditions && <span className="erreur" role="alert">{e.conditions}</span>}
        {Object.keys(e).length > 0 && <p className="erreur" role="alert">Vérifiez les champs signalés.</p>}
        <button type="button" className="pp-bouton" disabled={etat.enCours} onClick={envoyer}>{etat.enCours ? "Envoi…" : "Envoyer mon inscription"}</button>
      </div>
    </section>
  );
}
