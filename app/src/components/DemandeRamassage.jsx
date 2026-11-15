import { useEffect, useMemo, useRef, useState } from "react";
import Champ from "./Champ.jsx";
import Devis from "./Devis.jsx";
import IconeService from "./IconeService.jsx";
import Enfant from "./EnfantRamassage.jsx";
import { CHAMPS_CLIENT, valeursDepuisProfil } from "../services.js";
import { calculerTrajet } from "../routing.js";
import { TARIFS } from "../pricing/config.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { useFermetures } from "../fermetures.js";
import { construireDemande, enregistrerDemande } from "../demandes.js";
import { compteOuvert, useClient } from "../client.js";
import { PERIODES, MAX_ENFANTS, enfantVide, manquePlan, ecolesDuPlan, cleEcole, planVide } from "../pricing/ramassagePlanning.js";
import { prixFr } from "../pricing/partage.js";
import { nouveauPartage, calculerPartage, lienPartage, messagePartage, messageRebecca, enfantPropre } from "../pricing/partageRamassage.js";
import "../client-commun.css";
import "../ramassage-site.css";

// RAMASSAGE SCOLAIRE SUR LE SITE (15 nov. 2026) : meme formulaire et meme calcul que le Devis rapide de Rebecca.
// Plusieurs enfants, l'heure de chaque jour pour chaque enfant, un jour / une semaine / un mois,
// et « Partager le trajet » avec 1 ou 2 autres familles (nom + telephone ; leurs enfants si on les connait).
// Chaque autre famille recoit son lien pour completer ses enfants : le devis se recalcule pour toutes.

const CHAMP_DOMICILE = { name: "domicile", label: "Adresse du domicile", type: "adresse", required: true };
const CHAMP_ECOLE = { name: "ecole", label: "Adresse de l'école", type: "adresse", required: true };
const telOk = (t) => String(t || "").replace(/\D/g, "").length >= 9;
const jourDeLaDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

// Distances domicile -> chaque ecole (meme calcul que le site)
export function useRoutes(plan) {
  const [routes, setRoutes] = useState({});
  const [statut, setStatut] = useState("");
  const a = plan.domicile;
  const ecoles = ecolesDuPlan(plan);
  const cle = a && typeof a.lat === "number" && ecoles.length ? `${a.lat},${a.lon}>` + ecoles.map(cleEcole).join("|") : "";
  useEffect(() => {
    if (!cle) {
      setRoutes({});
      setStatut("");
      return undefined;
    }
    const ctrl = new AbortController();
    setStatut("chargement");
    Promise.all(ecoles.map((e) => calculerTrajet(a, e, ctrl.signal)))
      .then((liste) => {
        setRoutes(Object.fromEntries(liste.map((r, k) => [cleEcole(ecoles[k]), { km: r.km, minutes: r.minutes }])));
        setStatut("ok");
      })
      .catch((e) => e.name !== "AbortError" && setStatut("erreur"));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return { routes, statut };
}

// Nombre d'enfants (1 a 4) sans perdre ce qui est saisi
const reglerListe = (liste, n) => {
  const l = liste.slice(0, n);
  while (l.length < n) l.push(enfantVide());
  return l;
};

function NombreEnfants({ valeur, changer, id }) {
  return (
    <div className="choix rs-quatre" role="group" aria-label="Nombre d'enfants" id={id}>
      {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => (
        <button key={n} type="button" className={valeur === n ? "actif" : ""} aria-pressed={valeur === n} onClick={() => changer(n)}>{n}</button>
      ))}
    </div>
  );
}

export default function DemandeRamassage({ onRetour }) {
  const client = useClient();
  const ouvert = compteOuvert(client);
  const profil = ouvert ? client.profil : null;
  const reglages = useFermetures();
  const [v, setV] = useState(() => ({ nom: "", telephone: "", moyenPaiement: TARIFS.moyensPaiement[0], ...valeursDepuisProfil(profil), telUrgence: "", personnesAutorisees: "", infos: "" }));
  const [commun, setCommun] = useState(() => ({ domicile: null, ecole: null, periode: "mois", date: "", sansEcoleDu: "", sansEcoleAu: "" }));
  const [mesEnfants, setMesEnfants] = useState([enfantVide()]);
  const [partage, setPartage] = useState(false);
  const [autres, setAutres] = useState([{ nom: "", telephone: "", connais: false, enfants: [enfantVide()] }]);
  const [mode, setMode] = useState("enfant");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState({ enCours: false, fini: null });
  const envoiRef = useRef(false);

  useEffect(() => {
    if (!profil) return;
    const p = valeursDepuisProfil(profil);
    setV((o) => ({ ...o, nom: o.nom || p.nom || "", telephone: o.telephone || p.telephone || "" }));
  }, [profil]);

  const changerV = (nom, valeur) => setV((o) => ({ ...o, [nom]: valeur }));
  const changerCommun = (nom, valeur) => setCommun((o) => ({ ...o, [nom]: valeur }));
  const changerAutre = (k, cle, valeur) => setAutres((l) => l.map((f, j) => (j === k ? { ...f, [cle]: valeur } : f)));

  // Le document partage tel qu'il serait enregistre (une seule famille = pas de partage)
  const doc = useMemo(() => {
    const moi = { nom: v.nom, telephone: v.telephone, rempli: true, enfants: mesEnfants };
    const eux = partage ? autres.map((f) => ({ nom: f.nom, telephone: f.telephone, rempli: false, enfants: f.connais ? f.enfants : [] })) : [];
    return nouveauPartage(commun, [moi, ...eux], mode);
  }, [v.nom, v.telephone, mesEnfants, partage, autres, commun, mode]);

  const planRoutes = useMemo(() => ({ ...planVide(), domicile: commun.domicile, ecole: commun.ecole, enfants: doc.familles.flatMap((f) => f.enfants) }), [commun, doc]);
  const { routes, statut } = useRoutes(planRoutes);
  const calcul = useMemo(() => (statut === "ok" ? calculerPartage(doc, routes, undefined) : null), [doc, routes, statut, reglages]);
  const monPlan = { ...planVide(), ...commun, enfants: mesEnfants };
  const manque = !commun.domicile ? "Indiquez l'adresse du domicile pour voir le prix." : !commun.ecole && !mesEnfants.every((e) => e.autreEcole) ? "Indiquez l'adresse de l'école pour voir le prix." : manquePlan(monPlan);
  const resultat = calcul && calcul.resultat;
  const jourUnique = jourDeLaDate(commun.date);
  const mesParts = calcul && calcul.parFamille;

  const envoyer = async (e) => {
    e.preventDefault();
    if (envoiRef.current) return;
    let err = "";
    if (!String(v.nom).trim()) err = "Indiquez votre nom.";
    else if (!telOk(v.telephone)) err = "Indiquez votre téléphone (au moins 9 chiffres).";
    else if (manque) err = manque;
    else if (!telOk(v.telUrgence)) err = "Indiquez un téléphone en cas d'urgence.";
    else if (!String(v.personnesAutorisees).trim()) err = "Indiquez les personnes autorisées à récupérer ou accueillir les enfants.";
    else if (partage) {
      const k = autres.findIndex((f) => !String(f.nom).trim() || !telOk(f.telephone));
      if (k >= 0) err = `Famille ${k + 2} : indiquez son nom et son téléphone pour lui envoyer son lien.`;
      const inc = autres.findIndex((f) => f.connais && manquePlan({ ...planVide(), ...commun, enfants: f.enfants }));
      if (!err && inc >= 0) err = `Famille ${inc + 2} : complétez ses enfants, ou décochez « Je connais leurs enfants » (elle les remplira elle-même).`;
    }
    setErreur(err);
    if (err) return;

    envoiRef.current = true;
    setEnvoi({ enCours: true, fini: null });
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
      let id = "";
      if (partage) {
        const ref = await addDoc(collection(db, "trajetsPartages"), { ...doc, familles: doc.familles.map((f) => ({ ...f, enfants: f.enfants.map(enfantPropre) })), creeLe: serverTimestamp(), majLe: serverTimestamp() });
        id = ref.id;
      }
      const origine = window.location.origin + window.location.pathname;
      const liens = partage ? doc.familles.map((_, f) => lienPartage(origine, id, f)) : [];
      let message = messageRebecca(doc, calcul, liens);
      message = message.replace("\n\nMerci de me confirmer", `\n\nTéléphone en cas d'urgence : ${v.telUrgence}\nPersonnes autorisées : ${v.personnesAutorisees}${v.infos ? `\nInformations : ${v.infos}` : ""}\nPaiement prévu : ${v.moyenPaiement}\n\nMerci de me confirmer`);
      if (!partage) message = message.replace("Ramassage scolaire partagé (1 familles)", "Ramassage scolaire");
      const premier = mesEnfants[0] || {};
      const heure = premier.heureMatin || premier.heureSortie || (premier.jours || []).map((j) => j.heure).find(Boolean) || "";
      const demande = construireDemande("ramassage", { ...v, date: commun.date, heure, frequence: commun.periode === "jour" ? "unique" : "semaine" }, resultat && resultat.ok ? resultat : null, null, message, ouvert ? { uid: client.user.uid, remplace: "" } : null);
      demande.details = {
        formule: "planning",
        periode: commun.periode,
        nbFamilles: doc.familles.length,
        partageId: id,
        enfants: mesEnfants.map((x) => String(x.prenom || "").slice(0, 40)).join(", "),
        telUrgence: String(v.telUrgence).slice(0, 30),
        personnesAutorisees: String(v.personnesAutorisees).slice(0, 500),
        infos: String(v.infos || "").slice(0, 1000),
      };
      const versRebecca = lienWhatsApp(WHATSAPP, message);
      if (!ouvert) window.open(versRebecca, "_blank", "noopener");
      await enregistrerDemande(demande).catch(() => {});
      setEnvoi({ enCours: false, fini: { id, liens, versRebecca, ouvertAvant: !ouvert } });
    } catch {
      envoiRef.current = false;
      setEnvoi({ enCours: false, fini: null });
      setErreur("Envoi impossible pour l'instant. Vérifiez votre connexion et réessayez, ou écrivez à Rebecca sur WhatsApp.");
    }
  };

  if (envoi.fini) {
    const { liens, versRebecca, ouvertAvant } = envoi.fini;
    return (
      <div className="formulaire">
        <header className="titre-service">
          <span aria-hidden="true"><IconeService id="ramassage" taille={40} /></span>
          <h2>Demande envoyée</h2>
        </header>
        <div className="bloc">
          <p>Merci ! Rebecca a reçu votre demande et vous répond sur WhatsApp.</p>
          {!ouvertAvant && <a className="bouton" href={versRebecca} target="_blank" rel="noopener noreferrer">Envoyer aussi à Rebecca sur WhatsApp</a>}
          {ouvertAvant && <a className="lien" href={versRebecca} target="_blank" rel="noopener noreferrer">WhatsApp ne s'est pas ouvert ? Envoyer à Rebecca</a>}
        </div>
        {liens.length > 1 && (
          <div className="bloc">
            <h3>Envoyez son lien à chaque famille</h3>
            <p className="note">Chaque famille complète ses enfants et leurs horaires avec son lien. Le devis se recalcule pour toutes.</p>
            {doc.familles.slice(1).map((f, k) => (
              <a key={k} className="bouton rs-whatsapp" href={lienWhatsApp(f.telephone, messagePartage(doc, k + 1, liens[k + 1], calcul, v.nom))} target="_blank" rel="noopener noreferrer">
                Envoyer à {f.nom || `la famille ${k + 2}`} sur WhatsApp
              </a>
            ))}
            <p className="note">Votre propre lien, pour suivre le devis ou changer vos horaires :</p>
            <a className="lien rs-lien" href={liens[0]}>{liens[0]}</a>
          </div>
        )}
        <button type="button" className="retour" onClick={onRetour}>← Retour à l'accueil</button>
      </div>
    );
  }

  const enfantsCompte = profil && Array.isArray(profil.enfants) ? profil.enfants : [];

  return (
    <form className="formulaire rs-form" onSubmit={envoyer} noValidate>
      <button type="button" className="retour" onClick={onRetour}>← Tous les services</button>
      <header className="titre-service">
        <span aria-hidden="true"><IconeService id="ramassage" taille={40} /></span>
        <h2>Ramassage scolaire</h2>
      </header>

      <div className="bloc">
        <Champ champ={CHAMP_DOMICILE} valeurs={commun} onChange={changerCommun} />
        <Champ champ={CHAMP_ECOLE} valeurs={commun} onChange={changerCommun} />
        <fieldset className="champ">
          <legend>Devis pour</legend>
          <div className="choix rs-trois">
            {PERIODES.map((o) => (
              <button key={o.v} type="button" className={commun.periode === o.v ? "actif" : ""} aria-pressed={commun.periode === o.v} onClick={() => changerCommun("periode", o.v)}>{o.l}</button>
            ))}
          </div>
        </fieldset>
        <div className="champ">
          <label htmlFor="rs-date">{commun.periode === "jour" ? "Date *" : "Premier jour (facultatif)"}</label>
          <input id="rs-date" type="date" value={commun.date} onChange={(e) => changerCommun("date", e.target.value)} />
          {commun.periode === "mois" && !commun.date && <span className="indice">Sans date : prix d'un mois complet (le maximum). Chabbat, fêtes et vacances scolaires ne sont pas comptés.</span>}
        </div>
      </div>

      <div className="bloc">
        <h3>Vos enfants</h3>
        {enfantsCompte.length > 0 && (
          <div className="adresse-raccourcis">
            {enfantsCompte.map((en, i) => (
              <button key={i} type="button" onClick={() => setMesEnfants((l) => {
                const libre = l.findIndex((x) => !String(x.prenom || "").trim());
                const n = { ...enfantVide(), prenom: en.prenom || "" };
                return libre >= 0 ? l.map((x, j) => (j === libre ? { ...x, prenom: n.prenom } : x)) : l.length < MAX_ENFANTS ? [...l, n] : l;
              })}>{en.prenom}</button>
            ))}
          </div>
        )}
        <span className="indice">Nombre d'enfants</span>
        <NombreEnfants valeur={mesEnfants.length} changer={(n) => setMesEnfants((l) => reglerListe(l, n))} />
      </div>
      {mesEnfants.map((e, i) => (
        <Enfant key={i} site enfant={e} index={i} periode={commun.periode} jourUnique={jourUnique} changer={(n) => setMesEnfants((l) => l.map((x, j) => (j === i ? n : x)))} />
      ))}

      <div className="bloc">
        <label className="case">
          <input type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} />
          <span>Partager le trajet avec une ou deux autres familles</span>
        </label>
        <span className="indice">Jusqu'à {TARIFS.partage.inclus} enfants sur un trajet : prix normal. Chaque enfant en plus : un petit supplément. Partager coûte moins cher à chaque famille.</span>
        {partage && (
          <>
            <fieldset className="champ">
              <legend>Combien de familles en tout ?</legend>
              <div className="choix rs-deux">
                {[2, 3].map((n) => (
                  <button key={n} type="button" className={autres.length + 1 === n ? "actif" : ""} aria-pressed={autres.length + 1 === n} onClick={() => setAutres((l) => (n === 2 ? l.slice(0, 1) : [...l.slice(0, 1), l[1] || { nom: "", telephone: "", connais: false, enfants: [enfantVide()] }]))}>{n} familles</button>
                ))}
              </div>
            </fieldset>
            {autres.map((f, k) => (
              <fieldset className="champ rs-famille" key={k}>
                <legend>Famille {k + 2}</legend>
                <label htmlFor={`rs-nom-${k}`}>Nom *</label>
                <input id={`rs-nom-${k}`} type="text" maxLength={60} value={f.nom} onChange={(e) => changerAutre(k, "nom", e.target.value)} />
                <label htmlFor={`rs-tel-${k}`}>Téléphone (WhatsApp) *</label>
                <input id={`rs-tel-${k}`} type="tel" inputMode="tel" maxLength={20} placeholder="05X XXX XXXX" value={f.telephone} onChange={(e) => changerAutre(k, "telephone", e.target.value)} />
                <span className="indice">Elle recevra son lien pour compléter ses enfants et leurs horaires.</span>
                <label className="case">
                  <input type="checkbox" checked={f.connais} onChange={(e) => changerAutre(k, "connais", e.target.checked)} />
                  <span>Je connais ses enfants et leurs horaires (pour voir mon prix tout de suite)</span>
                </label>
                {f.connais && (
                  <>
                    <span className="indice">Nombre d'enfants</span>
                    <NombreEnfants valeur={f.enfants.length} changer={(n) => changerAutre(k, "enfants", reglerListe(f.enfants, n))} />
                    {f.enfants.map((en, i) => (
                      <Enfant key={i} site enfant={en} index={i} periode={commun.periode} jourUnique={jourUnique} famille={f.nom || `Famille ${k + 2}`} changer={(n) => changerAutre(k, "enfants", f.enfants.map((x, j) => (j === i ? n : x)))} />
                    ))}
                  </>
                )}
              </fieldset>
            ))}
            <fieldset className="champ">
              <legend>Comment partager la note ?</legend>
              <div className="choix rs-deux">
                <button type="button" className={mode === "enfant" ? "actif" : ""} aria-pressed={mode === "enfant"} onClick={() => setMode("enfant")}>Par enfant</button>
                <button type="button" className={mode === "egal" ? "actif" : ""} aria-pressed={mode === "egal"} onClick={() => setMode("egal")}>Parts égales</button>
              </div>
              <span className="indice">{mode === "egal" ? "Le total divisé par le nombre de familles." : "Chaque famille paie pour ses enfants."}</span>
            </fieldset>
          </>
        )}
      </div>

      <div className="bloc">
        <h3>Vos coordonnées</h3>
        {CHAMPS_CLIENT.map((c) => (
          <Champ key={c.name} champ={c} valeurs={v} onChange={changerV} />
        ))}
        <Champ champ={{ name: "telUrgence", label: "Téléphone en cas d'urgence", type: "tel", required: true }} valeurs={v} onChange={changerV} />
        <Champ champ={{ name: "personnesAutorisees", label: "Personnes autorisées à récupérer ou accueillir les enfants", type: "texte-long", required: true, placeholder: "Nom, téléphone et lien avec l'enfant", indice: "Rebecca ne remet l'enfant qu'à ces personnes." }} valeurs={v} onChange={changerV} />
        <Champ champ={{ name: "infos", label: "Informations utiles (code du portail, allergies à connaître…)", type: "texte-long" }} valeurs={v} onChange={changerV} />
      </div>

      <Devis resultat={manque ? null : resultat && resultat.ok ? resultat : null} trajet={statut === "chargement" ? { statut: "chargement" } : null} pretPourCalcul={!manque} manque={manque} />
      {partage && mesParts && resultat && resultat.ok && (
        <section className="devis attente" aria-live="polite">
          <p className="note"><strong>Votre part : {mesParts[0].montant != null ? `${prixFr(mesParts[0].montant)} ₪` : "—"}</strong></p>
          {mesParts.slice(1).filter((p) => p.montant == null).map((p, i) => (
            <p className="note" key={i}>• {p.nom} : en attente de ses enfants. Votre prix sera recalculé quand elle les aura remplis.</p>
          ))}
        </section>
      )}

      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="barre-envoi">
        <div className="barre-prix">{resultat && resultat.ok && !manque ? <strong>{prixFr(partage && mesParts ? mesParts[0].montant ?? resultat.total : resultat.total)} ₪</strong> : <span>Devis</span>}</div>
        <button type="submit" className="bouton" disabled={envoi.enCours}>{envoi.enCours ? "Envoi…" : "Envoyer ma demande"}</button>
      </div>
      <p className="mention">Votre demande n'est pas une réservation : Rebecca la valide selon ses disponibilités et vous répond sur WhatsApp.</p>
    </form>
  );
}
