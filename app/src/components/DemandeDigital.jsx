import { useState } from "react";
import { useClient, compteOuvert } from "../client.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import {
  AVERTISSEMENT_PAYS, BUDGETS, CHOIX_MAINTENANCE, CONTACTS, DEMARRAGES, DOMAINES, FONCTIONS, FORMULES_ENVISAGEES, MAX, MENTION_ETUDE, PAYS, TYPES_PROJET,
  construireDemandeDigital, erreursEcran, formuleConseillee, lienProjet, messageConsultation, messageDemandeDigital, resumeDemandeDigital,
} from "../pricing/digital.js";
import "../digital.css";

// QUESTIONNAIRE DE DEVIS DIGITAL & APPLICATIONS (17 nov. 2026) - 3 ecrans courts pour l'iPhone, avec ou sans compte.
// Aucun prix : seulement la formule qui semble correspondre. La demande arrive dans « Projets Digital » (admin),
// un e-mail part chez Rebecca, et la cliente garde un lien de suivi personnel (#/projet/ID).
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore"), import("../demandes.js")]);

function Choix({ titre, options, valeur, onChange, erreur, requis }) {
  return (
    <fieldset className="champ">
      <legend>{titre}{requis && " *"}</legend>
      <div className="choix">
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.v;
          const l = typeof o === "string" ? o : o.l;
          return (
            <button key={v} type="button" className={valeur === v ? "actif" : ""} aria-pressed={valeur === v} onClick={() => onChange(v)}>{l}</button>
          );
        })}
      </div>
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </fieldset>
  );
}

function Texte({ titre, valeur, onChange, erreur, requis, type = "text", max = 200, long = false, placeholder = "" }) {
  return (
    <div className="champ">
      <label>{titre}{requis && " *"}
        {long ? (
          <textarea rows={5} value={valeur || ""} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erreur} />
        ) : (
          <input type={type} value={valeur || ""} maxLength={max} placeholder={placeholder} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erreur} />
        )}
      </label>
      {long && <span className="aide">{String(valeur || "").length} / {max}</span>}
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </div>
  );
}

export default function DemandeDigital({ onRetour, onLegal }) {
  const client = useClient();
  const ouvert = compteOuvert(client);
  const profil = (ouvert && client.profil) || {};
  const [ecran, setEcran] = useState(1);
  const [f, setF] = useState(() => ({
    nom: `${profil.prenom || ""} ${profil.nom || ""}`.trim(),
    email: (ouvert && client.user && client.user.email) || "",
    telephone: profil.telephone || "",
    contact: "whatsapp",
    pays: "israel",
    fonctions: [],
  }));
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: "", id: "", doc: null });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const basculer = (id) => set("fonctions", f.fonctions.includes(id) ? f.fonctions.filter((x) => x !== id) : [...f.fonctions, id]);
  const conseil = formuleConseillee(f.fonctions);

  const suivant = () => {
    const e = erreursEcran(ecran, f);
    setErreurs(e);
    if (Object.keys(e).length) return;
    window.scrollTo(0, 0);
    setEcran(ecran + 1);
  };

  const envoyer = async () => {
    const e = erreursEcran(3, f);
    setErreurs(e);
    if (Object.keys(e).length || envoi.enCours) return;
    setEnvoi({ enCours: true, erreur: "", id: "", doc: null });
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }, { envoyerEmail }] = await charger();
      const d = construireDemandeDigital(f, ouvert && client.user ? client.user.uid : null);
      const ref = await addDoc(collection(db, "projetsDigital"), { ...d, creeLe: serverTimestamp() });
      envoyerEmail({
        serviceTitre: "Digital & Applications – demande de devis",
        date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }),
        heure: "",
        nom: d.nom,
        telephone: d.telephone,
        moyenPaiement: "",
        surDevis: true,
        message: `Demande de devis\n${resumeDemandeDigital(d)}\nSuivi : ${lienProjet(ref.id)}`,
      }).catch(() => {});
      window.scrollTo(0, 0);
      setEnvoi({ enCours: false, erreur: "", id: ref.id, doc: d });
    } catch {
      setEnvoi({ enCours: false, erreur: "L'envoi n'a pas marché. Vérifiez la connexion puis réessayez, ou écrivez-moi sur WhatsApp.", id: "", doc: null });
    }
  };

  if (envoi.id) {
    return (
      <section className="catalogue-nails">
        <h2>Merci pour votre demande !</h2>
        <p>J'ai bien reçu les informations concernant votre projet. Je reviens généralement vers vous sous 48 heures ouvrées, hors Chabbat et fêtes, selon mes disponibilités, pour échanger sur les possibilités, les fonctionnalités et les prochaines étapes.</p>
        <p><strong>Votre lien de suivi personnel</strong> (statut, devis, paiements, cahier des charges) :</p>
        <p className="dg-lien"><a href={`#/projet/${envoi.id}`}>{lienProjet(envoi.id)}</a></p>
        <p className="aide">Gardez-le : ajoutez cette page à vos favoris ou à l'écran d'accueil.</p>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, messageDemandeDigital(envoi.doc, envoi.id))} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }}>
          Prévenir Rebecca sur WhatsApp
        </a>
        <a className="bouton bouton-secondaire" href={lienWhatsApp(WHATSAPP, messageConsultation(envoi.doc.nom))} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
          Réserver ma consultation gratuite (30 min)
        </a>
        <button type="button" className="lien" onClick={onRetour} style={{ marginTop: 12 }}>← Retour à Digital & Applications</button>
      </section>
    );
  }

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={ecran === 1 ? onRetour : () => setEcran(ecran - 1)}>← {ecran === 1 ? "Digital & Applications" : "Écran précédent"}</button>
      <h2>Parlons de votre projet</h2>
      {ecran === 1 && (
        <p className="aide">Vous avez une idée, un besoin ou un projet à développer ? Remplissez ce questionnaire : je comprendrai mieux vos attentes et je vous proposerai une solution adaptée. Les tarifs du site sont indicatifs ; un devis personnalisé est établi après analyse de vos besoins. Vous pouvez aussi commencer par une consultation gratuite de 30 minutes.</p>
      )}
      <p className="dg-etapes">Étape {ecran} sur 3 · {["Vous", "Votre projet", "Délai et budget"][ecran - 1]}</p>

      {ecran === 1 && (
        <>
          <Texte titre="Nom et prénom" requis valeur={f.nom} onChange={(v) => set("nom", v)} erreur={erreurs.nom} max={MAX.nom} />
          <Texte titre="Entreprise ou activité" valeur={f.entreprise} onChange={(v) => set("entreprise", v)} max={MAX.entreprise} />
          <Texte titre="E-mail" requis type="email" valeur={f.email} onChange={(v) => set("email", v)} erreur={erreurs.email} max={MAX.email} />
          <Texte titre="Téléphone / WhatsApp" requis type="tel" valeur={f.telephone} onChange={(v) => set("telephone", v)} erreur={erreurs.telephone} max={MAX.telephone} placeholder="05X XXX XXXX" />
          <Choix titre="Comment préférez-vous être contacté(e) ?" requis options={CONTACTS} valeur={f.contact} onChange={(v) => set("contact", v)} erreur={erreurs.contact} />
          <Choix titre="Pays" requis options={PAYS} valeur={f.pays} onChange={(v) => set("pays", v)} erreur={erreurs.pays} />
          {f.pays && f.pays !== "israel" && <p className="aide">{AVERTISSEMENT_PAYS}</p>}
        </>
      )}

      {ecran === 2 && (
        <>
          <Choix titre="Type de projet" requis options={TYPES_PROJET} valeur={f.typeProjet} onChange={(v) => set("typeProjet", v)} erreur={erreurs.typeProjet} />
          <Choix titre="Domaine d'activité" requis options={DOMAINES} valeur={f.domaine} onChange={(v) => set("domaine", v)} erreur={erreurs.domaine} />
          {f.domaine === "Autre" && <Texte titre="Précisez votre domaine" requis valeur={f.domaineAutre} onChange={(v) => set("domaineAutre", v)} erreur={erreurs.domaineAutre} max={MAX.precision} />}
          <Texte titre="Votre projet et votre objectif" requis long valeur={f.description} onChange={(v) => set("description", v)} erreur={erreurs.description} max={MAX.description} />
          <fieldset className="champ">
            <legend>Fonctions souhaitées (au moins une) *</legend>
            {FONCTIONS.map((x) => (
              <label key={x.id} className="case">
                <input type="checkbox" checked={f.fonctions.includes(x.id)} onChange={() => basculer(x.id)} />
                <span>{x.l}{x.etude && f.fonctions.includes(x.id) && <small className="aide" style={{ display: "block" }}>{MENTION_ETUDE}</small>}</span>
              </label>
            ))}
            {erreurs.fonctions && <span className="erreur" role="alert">{erreurs.fonctions}</span>}
          </fieldset>
          {f.fonctions.includes("autre") && <Texte titre="Précisez la fonction" requis valeur={f.fonctionAutre} onChange={(v) => set("fonctionAutre", v)} erreur={erreurs.fonctionAutre} max={MAX.precision} />}
          {conseil && <p className="dg-conseil">D'après vos réponses, la formule qui semble correspondre est : <strong>{conseil}</strong>. Elle sera confirmée après étude de votre projet.</p>}
          <Choix titre="Formule envisagée (facultatif)" options={FORMULES_ENVISAGEES} valeur={f.formuleEnvisagee} onChange={(v) => set("formuleEnvisagee", f.formuleEnvisagee === v ? "" : v)} />
        </>
      )}

      {ecran === 3 && (
        <>
          <Choix titre="Maintenance après livraison (facultatif)" options={CHOIX_MAINTENANCE} valeur={f.maintenance} onChange={(v) => set("maintenance", f.maintenance === v ? "" : v)} />
          <Choix titre="Quand souhaitez-vous démarrer ?" requis options={DEMARRAGES} valeur={f.demarrage} onChange={(v) => set("demarrage", v)} erreur={erreurs.demarrage} />
          <Choix titre="Budget envisagé" requis options={BUDGETS} valeur={f.budget} onChange={(v) => set("budget", v)} erreur={erreurs.budget} />
          <div className="champ">
            <label className="case">
              <input type="checkbox" checked={f.consentement === true} onChange={(e) => set("consentement", e.target.checked)} />
              <span>J'accepte que mes informations soient utilisées pour répondre à ma demande. *</span>
            </label>
            <button type="button" className="lien" onClick={onLegal}>Confidentialité et conditions</button>
            {erreurs.consentement && <span className="erreur" role="alert">{erreurs.consentement}</span>}
          </div>
        </>
      )}

      {Object.keys(erreurs).length > 0 && <p className="erreur" role="alert">Vérifiez les champs signalés.</p>}
      {envoi.erreur && <p className="erreur" role="alert">{envoi.erreur}</p>}
      {ecran < 3 ? (
        <button type="button" className="bouton" onClick={suivant}>Continuer</button>
      ) : (
        <button type="button" className="bouton" disabled={envoi.enCours} onClick={envoyer}>{envoi.enCours ? "Envoi…" : "Envoyer ma demande de devis"}</button>
      )}
    </section>
  );
}
