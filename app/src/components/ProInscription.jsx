import { useState } from "react";
import { CONDITIONS_ANNUAIRE, FORMULES_PRO, LANGUES, categoriesVisibles, erreursInscription, inscriptionVide, messageInscriptionWhatsApp } from "../pricing/pros.js";
import { LANGUES_SITE, langueDepart, memoriserLangue, nomMetier, sens, traduction } from "../pricing/prosTextes.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { envoyerCandidature, useCategoriesPros } from "../prosBase.js";
import { useHebreuPros } from "../prosBase.js";

// « VOUS ÊTES PROFESSIONNEL EN ISRAËL ? » (25 nov. 2026) - #/pro, en français et en hébreu (RTL)
// Page de recrutement + inscription. Aucune promesse de clients ni de revenus. Le dossier est « soumis » : il n'est
// JAMAIS publié sans la décision de Rebecca. Si l'enregistrement en ligne échoue, le dossier complet part à Rebecca
// par WhatsApp (toujours en français, pour elle) : rien n'est perdu.

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
  const [langue, setLangue] = useState(langueDepart);
  const hebreu = useHebreuPros(); // 26 nov. 2026 : hébreu caché tant que Rebecca ne l'active pas
  const langueVue = hebreu ? langue : "fr";
  const t = traduction(langueVue);
  const [f, setF] = useState(inscriptionVide);
  const [eBrut, setE] = useState({});
  const [etat, setEtat] = useState({ fait: false, lien: "", enCours: false });
  // erreurs (écrites en français dans la logique) traduites à l'affichage
  const e = Object.fromEntries(Object.entries(eBrut).map(([k, v]) => [k, (t.erreurs && t.erreurs[v]) || v]));
  const conditions = t.conditions || CONDITIONS_ANNUAIRE;
  const formule = (v) => (t.formules && t.formules[v]) || [FORMULES_PRO.find((x) => x.v === v).l, FORMULES_PRO.find((x) => x.v === v).detail];
  const changerLangue = (l) => {
    setLangue(l);
    memoriserLangue(l);
  };
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
      // enregistrement en ligne impossible : le dossier part par WhatsApp
      setEtat({ fait: true, lien, enLigne: false, enCours: false });
    }
  };
  const choixLangue = (
    <div className="tb-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
      {onAccueil ? <button type="button" className="tdb-retour" onClick={onAccueil}>{t.accueil}</button> : <span />}
      <span className="tb-actions">
        {(hebreu ? LANGUES_SITE : []).map((l) => <button key={l.v} type="button" className={langueVue === l.v ? "pp-bouton" : "bouton-secondaire"} onClick={() => changerLangue(l.v)}>{l.l}</button>)}
      </span>
    </div>
  );
  if (etat.fait)
    return (
      <section className="pp-bloc" dir={sens(langueVue)} lang={langueVue}>
        <h2>{t.merci}</h2>
        <p>{etat.enLigne ? t.merciEnLigne : t.merciWhatsApp}</p>
        <div className="tb-actions">
          <a className="pp-bouton" href={etat.lien} target="_blank" rel="noopener noreferrer">{etat.enLigne ? t.envoyerJustifs : t.envoyerDossier}</a>
          {onAccueil && <button type="button" className="bouton-secondaire" onClick={onAccueil}>{t.accueilBouton}</button>}
        </div>
      </section>
    );
  const cocher = (k) => setF({ ...f, [k]: !f[k] });
  return (
    <section dir={sens(langueVue)} lang={langueVue}>
      <div className="pp-bloc">
        {choixLangue}
        <h2>{t.insTitre}</h2>
        <p>{t.insIntro}</p>
        <ul>
          {FORMULES_PRO.map((x) => <li key={x.v}><b>{formule(x.v)[0]}</b>{langueVue === "he" ? ": " : " : "}{formule(x.v)[1]}{x.v === "referencement" ? "" : t.surDevisFormule}</li>)}
        </ul>
        <p className="tb-note">{t.insNote}</p>
      </div>
      <div className="pp-bloc">
        <h3>{t.insVotre}</h3>
        <Champ label={t.nomCommercial} k="nomCommercial" f={f} setF={setF} e={e} requis />
        <Champ label={t.prenom} k="prenom" f={f} setF={setF} e={e} requis />
        <Champ label={t.nom} k="nom" f={f} setF={setF} e={e} requis />
        <label className="champ">
          <span>{t.metier} *</span>
          <select value={f.categorie} onChange={(x) => setF({ ...f, categorie: x.target.value })}>
            <option value="">{t.choisir}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {nomMetier(c, langueVue)}</option>)}
          </select>
          {e.categorie && <span className="erreur" role="alert">{e.categorie}</span>}
        </label>
        <Champ label={t.specialite} k="metier" f={f} setF={setF} e={e} aide={t.exSpecialite} />
        <Champ label={t.presentation} k="description" f={f} setF={setF} e={e} multi requis />
        <Champ label={t.prestationsProposees} k="prestations" f={f} setF={setF} e={e} multi />
        <Champ label={t.tarifsIndicatifs} k="tarifs" f={f} setF={setF} e={e} aide={t.aideTarifs} />
        <Champ label={t.villes} k="villes" f={f} setF={setF} e={e} aide={t.aideVilles} requis />
        <Champ label={t.zone} k="zone" f={f} setF={setF} e={e} aide={t.aideZone} />
        <fieldset className="champ">
          <legend>{t.langues}</legend>
          {LANGUES.map((l) => (
            <label key={l} className="case">
              <input type="checkbox" checked={f.langues.includes(l)} onChange={() => setF({ ...f, langues: f.langues.includes(l) ? f.langues.filter((x) => x !== l) : [...f.langues, l] })} />
              <span>{(t.nomsLangues && t.nomsLangues[l]) || l}</span>
            </label>
          ))}
        </fieldset>
        <Champ label={t.horaires} k="horaires" f={f} setF={setF} e={e} />
        <Champ label={t.telephone} k="telephone" f={f} setF={setF} e={e} type="tel" />
        <Champ label={t.whatsapp} k="whatsapp" f={f} setF={setF} e={e} type="tel" />
        <label className="case"><input type="checkbox" checked={f.whatsappPublic} onChange={() => cocher("whatsappPublic")} /><span>{t.afficherNumero}</span></label>
        <Champ label={t.email} k="email" f={f} setF={setF} e={e} type="email" />
        <Champ label={t.osek} k="osek" f={f} setF={setF} e={e} requis />
        <fieldset className="champ">
          <legend>{t.formuleSouhaitee}</legend>
          {FORMULES_PRO.map((x) => (
            <label key={x.v} className="case"><input type="radio" checked={f.formule === x.v} onChange={() => setF({ ...f, formule: x.v })} /><span>{formule(x.v)[0]}</span></label>
          ))}
        </fieldset>
        <div className="champ">
          <span>{t.conditionsTitre}</span>
          <ul className="tb-note">{conditions.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <label className="case"><input type="checkbox" checked={f.independant} onChange={() => cocher("independant")} /><span>{t.jeSuisIndependant} *</span></label>
        {e.independant && <span className="erreur" role="alert">{e.independant}</span>}
        <label className="case"><input type="checkbox" checked={f.conditions} onChange={() => cocher("conditions")} /><span>{t.jAccepte} *</span></label>
        {e.conditions && <span className="erreur" role="alert">{e.conditions}</span>}
        {Object.keys(e).length > 0 && <p className="erreur" role="alert">{t.verifiez}</p>}
        <button type="button" className="pp-bouton" disabled={etat.enCours} onClick={envoyer}>{etat.enCours ? t.envoi : t.envoyerInscription}</button>
      </div>
    </section>
  );
}
