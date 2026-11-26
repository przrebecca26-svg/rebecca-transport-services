import RentabiliteDetail from "./components/RentabiliteDetail.jsx";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { alerteMinimum, minimumDuReglage } from "./pricing/finCourse.js";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import Champ from "./components/Champ.jsx";
import Devis from "./components/Devis.jsx";
import IconeService from "./components/IconeService.jsx";
import AjoutManuel from "./AjoutManuel.jsx";
import RamassagePlanning from "./RamassagePlanning.jsx";
import PlanVol from "./components/PlanVol.jsx";
import { AvisJournee } from "./components/InsertionJournee.jsx";
import { SERVICES, FORMULAIRES, CHAMPS_CLIENT, valeursInitiales, champsVisibles, trajetACalculer, besoinDistance, versDemande } from "./services.js";
import { calculerTrajet } from "./routing.js";
import { calculer } from "./pricing/engine.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { useFermetures } from "./fermetures.js";
import { appliquerLivraisonPartenaire, champsCourse } from "./pricing/livraisonPartenaire.js";
import { aujourdhuiIsrael, useDossiersPros, useParamsLivraisonPartenaire } from "./prosBase.js";
import { libelleFormule } from "./pricing/pros.js";
import { majDepuisDevis, messageDevis, messageDevisDemande, valeursDepuisDemande, versAjoutManuel } from "./pricing/devisRapide.js";
import "./client-commun.css";
import "./devis-rapide.css";

// DEVIS RAPIDE (D2a, 9 nov. 2026) : Rebecca simule le prix pour un client qui demande hors du site
// (Instagram, WhatsApp...). Meme formulaire et meme calculateur que le site : le prix annonce est toujours le bon.
// Puis : copier le message, l'envoyer sur WhatsApp, ou enregistrer la course si le client accepte.

const CHAMPS_EXCLUS = new Set(CHAMPS_CLIENT.map((c) => c.name).concat(["promoActif", "codePromo"]));
const adresseSaisie = (a) => !!(a && typeof a === "object" && String(a.label || "").trim());

// course (16 nov. 2026) : « Modifier le devis » d'une course deja enregistree -> formulaire pre-rempli,
// prix convenu modifiable, et « Enregistrer les modifications » met la course a jour (agenda, devis, suivi).
// 26 nov. 2026 : depuisCalendrier = course ajoutée depuis le Calendrier (date du jour choisi, bouton direct « Ajouter »)
function Formulaire({ service, retour, aller, course = null, onEnregistrer = null, enCours = false, dateInitiale = "", depuisCalendrier = false }) {
  const infos = SERVICES.find((s) => s.id === service);
  const [v, setV] = useState(() => (course ? valeursDepuisDemande(course) : { ...valeursInitiales(service), ...(dateInitiale ? { date: dateInitiale } : {}) }));
  const [trajet, setTrajet] = useState(null);
  const [copie, setCopie] = useState("");
  const [tel, setTel] = useState(course ? course.telephone || "" : "");
  // Client du devis (16 nov. 2026) : prenom, nom, e-mail -> message personnalise et fiche pre-remplie
  const [cli, setCli] = useState({ prenom: "", nom: "", email: "" });
  const prixCourse = course ? (typeof course.prixFinal === "number" ? course.prixFinal : typeof course.prixEstime === "number" ? course.prixEstime : null) : null;
  const [prixConvenu, setPrixConvenu] = useState(prixCourse != null ? String(prixCourse) : "");
  const [msgModif, setMsgModif] = useState("");
  const [ajout, setAjout] = useState(false);
  const [demandes, setDemandes] = useState([]);
  const reglages = useFermetures();
  // 17 nov. 2026 : mon minimum de gain par heure (Reglages) -> alerte et prix conseille
  const [minParHeure, setMinParHeure] = useState(0);
  useEffect(() => onSnapshot(doc(db, "reglages", "rentabilite"), (x) => setMinParHeure(minimumDuReglage(x.exists() ? x.data() : null).min), () => {}), []);
  const changer = (nom, valeur) => setV((o) => ({ ...o, [nom]: valeur }));
  // 25 nov. 2026 (21h42) : livraison pour un professionnel partenaire (Business, Pack Pro) -> avantage partenaire
  const dejaPart = course && course.livraisonPartenaire ? course.livraisonPartenaire : null;
  const [proId, setProId] = useState(() => (course ? course.proPartenaire || (dejaPart && dejaPart.proId) || "" : ""));
  const [exception, setException] = useState(() => !!(dejaPart && dejaPart.exception));
  const dossiersPros = useDossiersPros();
  const paramsPart = useParamsLivraisonPartenaire();
  const prosChoix = (dossiersPros || []).filter((x) => x.statut === "accepte" || x.id === proId);

  // Distance reelle (meme calcul que le site)
  const t = trajetACalculer(service, v);
  const cle = t ? `${t.depart.lat},${t.depart.lon}>${t.arrivee.lat},${t.arrivee.lon}` : "";
  useEffect(() => {
    if (!cle) {
      setTrajet(null);
      return;
    }
    const ctrl = new AbortController();
    setTrajet({ statut: "chargement" });
    calculerTrajet(t.depart, t.arrivee, ctrl.signal)
      .then((r) => setTrajet({ statut: "ok", ...r }))
      .catch((e) => e.name !== "AbortError" && setTrajet({ statut: "erreur" }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  // Demandes existantes : pour retrouver un client deja connu au moment d'enregistrer la course
  useEffect(() => {
    if (!ajout) return undefined;
    return onSnapshot(refDemandes(), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [ajout]);

  const visibles = champsVisibles(service, v, true).filter((c) => !CHAMPS_EXCLUS.has(c.name));
  const adresses = FORMULAIRES[service].filter((c) => c.type === "adresse" && visibles.includes(c));
  let manque = "";
  if (!v.date || !v.heure) manque = "Choisis la date et l'heure pour voir le prix.";
  else if (!adresses.every((c) => adresseSaisie(v[c.name]))) manque = "Indique les adresses pour voir le prix.";
  const pret = !manque;
  const distanceOk = trajet && trajet.statut === "ok";
  const brut = useMemo(() => {
    if (!pret) return null;
    if (besoinDistance(service, v) && service !== "hatan_kala" && service !== "demenagement" && !distanceOk) return null;
    const dem = versDemande(service, v, distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null);
    return { dem, r: calculer(dem) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, v, trajet, pret, distanceOk, reglages]);
  const dossierPro = proId ? (dossiersPros || []).find((x) => x.id === proId) || null : null;
  const part = useMemo(() => {
    if (!brut) return { resultat: null, info: null };
    if (!dossierPro) return { resultat: brut.r, info: null };
    return appliquerLivraisonPartenaire(brut.r, brut.dem, { dossier: dossierPro, params: paramsPart, aujourdhui: aujourdhuiIsrael(), exception, prixAmi: !!(course && course.prixAmi) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brut, dossierPro, paramsPart, exception]);
  const resultat = part.resultat;
  const infoPart = part.info;

  const calcule = resultat && resultat.ok && !resultat.bloque;
  const prixNombre = Number(String(prixConvenu).replace(",", "."));
  const prixOk = String(prixConvenu).trim() !== "" && Number.isFinite(prixNombre) && prixNombre > 0 && prixNombre <= 20000;
  const champsPart = champsCourse(infoPart, aujourdhuiIsrael());
  const majBase = course && pret && prixOk ? majDepuisDevis(course, v, resultat, Math.round(prixNombre * 100) / 100, distanceOk ? trajet : null) : null;
  // Livraison partenaire : rattachee au pro et avantage note sur la course ; « Aucun » detache la course
  const maj = majBase ? { ...majBase, ...(champsPart || (course && (course.proPartenaire || course.livraisonPartenaire) && !proId ? { proPartenaire: null, livraisonPartenaire: null } : {})) } : null;
  const message = course ? (maj ? messageDevisDemande({ ...course, ...maj }) || "" : "") : messageDevis(service, v, resultat, cli.prenom);
  const enregistrerModif = async () => {
    setMsgModif("");
    if (!pret) return setMsgModif(manque || "Complète le formulaire.");
    if (!prixOk) return setMsgModif("Indique le prix convenu, en shekels.");
    if (await onEnregistrer(maj)) setMsgModif("Course mise à jour ✅ (agenda, devis et fiche client).");
  };
  const renta = resultat && resultat.details && resultat.details.rentabilite;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopie("Message copié : colle-le dans Instagram ou WhatsApp.");
    } catch {
      setCopie("Copie impossible ici : sélectionne le texte ci-dessous et copie-le.");
    }
  };

  if (ajout) {
    return (
      <AjoutManuel
        mode="course"
        demandes={demandes}
        prerempli={versAjoutManuel(service, v, resultat)}
        extraDemande={champsPart}
        clientPrerempli={{ prenom: cli.prenom.trim(), nom: cli.nom.trim(), telephone: tel.trim(), email: cli.email.trim() }}
        onFermer={() => setAjout(false)}
        onOuvrirDemande={aller ? (id) => aller("demandes", id) : null}
        onOuvrirFiche={aller ? (id) => aller("clients", id) : null}
      />
    );
  }

  return (
    <div className="tdb devis-rapide">
      <button className="tdb-retour" onClick={retour}>{course ? "← Retour à la course" : "← Tous les services"}</button>
      <header className="dr-titre">
        <IconeService id={service} taille={40} />
        <h1>{course ? `Modifier le devis · ${course.nom}` : infos.titre}</h1>
      </header>
      <p className="tdb-note">{course ? "Corrige tout ce qu'il faut (vol, retour, bagages, adresses, prix…). Rien ne change tant que tu ne cliques pas sur « Enregistrer les modifications »." : "Même calcul que sur le site. Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer la course »."}</p>
      <div className="formulaire dr-formulaire">
        <div className="bloc">
          {visibles.map((c) => (
            <Champ key={c.name} champ={c} valeurs={v} onChange={changer} />
          ))}
        </div>
        <Devis resultat={resultat} trajet={trajet} pretPourCalcul={pret} manque={manque} quand={{ date: v.date, heure: v.heure }} />
      </div>

      {service === "aeroport" && <PlanVol v={v} trajet={trajet} onChange={changer} />}
      {depuisCalendrier && calcule && (
        <section className="tdb-bloc">
          <h2>🗓️ Dans ma journée</h2>
          <AvisJournee d={versDemande(service, v, distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null)} />
          <button className="tdb-bouton" onClick={() => setAjout(true)}>➕ Ajouter à mon calendrier (Cliente, Ami ou Famille)</button>
        </section>
      )}

      {service === "livraison" && prosChoix.length > 0 && (
        <section className="tdb-bloc">
          <h2>🤝 Livraison partenaire</h2>
          <select value={proId} onChange={(e) => { setProId(e.target.value); setException(false); }} aria-label="Professionnel partenaire">
            <option value="">Aucun : cliente habituelle</option>
            {prosChoix.map((x) => <option key={x.id} value={x.id}>{x.nomCommercial} · {libelleFormule(x.formule)}</option>)}
          </select>
          {infoPart && (
            <p className={"tdb-note" + (infoPart.statut === "rentabilite" ? " dr-alerte-min" : "")} role={infoPart.statut === "rentabilite" ? "alert" : "status"}>
              {infoPart.statut === "applique" ? "✅ " : infoPart.statut === "exception" ? "⚠️ " : infoPart.statut === "rentabilite" ? "⚠️ " : "ℹ️ "}{infoPart.raison}
              {typeof infoPart.gainHeure === "number" && infoPart.statut !== "rentabilite" ? ` Rentabilité prévue : ${infoPart.gainHeure} ₪/h.` : ""}
            </p>
          )}
          {infoPart && (infoPart.statut === "rentabilite" || infoPart.statut === "exception") && (
            <label className="tdb-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} style={{ width: "auto" }} /> J'autorise exceptionnellement la réduction ({infoPart.prixPublic} ₪ → {infoPart.prixPartenaire} ₪)
            </label>
          )}
          <p className="tdb-note">La course est rattachée à ce pro : ses livraisons restent comptées à part de son abonnement et du Digital.</p>
        </section>
      )}

      {calcule && renta && (() => {
        const a = alerteMinimum(renta, minParHeure, resultat.total);
        return a ? <p className="tdb-note dr-alerte-min" role="alert">⚠️ Sous ton minimum de {a.min} ₪/h.{a.conseille ? ` Prix conseillé : ${a.conseille} ₪.` : ""} (Réglages → Mon minimum)</p> : null;
      })()}
      {calcule && renta && <RentabiliteDetail d={{ ...versDemande(service, v, null), details: v }} aller={distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null} prix={resultat.total} r={renta} />}

      {course && (
        <section className="tdb-bloc">
          <h2>Prix convenu</h2>
          <div className="dr-actions">
            <input className="dr-tel" inputMode="decimal" value={prixConvenu} onChange={(e) => setPrixConvenu(e.target.value)} placeholder="Prix en ₪" aria-label="Prix convenu en shekels" />
            {calcule && resultat.total != null && String(resultat.total) !== String(prixConvenu).trim() && (
              <button className="dr-secondaire" onClick={() => setPrixConvenu(String(resultat.total))}>Prendre le prix calculé ({resultat.total} ₪)</button>
            )}
          </div>
          <div className="dr-actions">
            <button className="tdb-bouton" disabled={enCours} onClick={enregistrerModif}>Enregistrer les modifications</button>
            <button className="dr-secondaire" onClick={retour}>Annuler</button>
          </div>
          {msgModif && <p className="tdb-note" role="status">{msgModif}</p>}
        </section>
      )}

      {pret && resultat && message && (
        <section className="tdb-bloc">
          <h2>{course ? "Devis à renvoyer" : "Message pour le client"}</h2>
          {!course && (
            <div className="dr-client">
              <p className="tdb-note">Client (facultatif) : son prénom s'affiche dans le message, et tout est repris dans sa fiche quand tu enregistres la course.</p>
              <input className="dr-tel" placeholder="Prénom" autoComplete="off" value={cli.prenom} onChange={(e) => setCli({ ...cli, prenom: e.target.value })} aria-label="Prénom du client" />
              <input className="dr-tel" placeholder="Nom" autoComplete="off" value={cli.nom} onChange={(e) => setCli({ ...cli, nom: e.target.value })} aria-label="Nom du client" />
              <input className="dr-tel" type="email" placeholder="E-mail" autoComplete="off" value={cli.email} onChange={(e) => setCli({ ...cli, email: e.target.value })} aria-label="E-mail du client" />
            </div>
          )}
          <textarea className="dr-message" readOnly value={message} rows={9} />
          <div className="dr-actions">
            <button className="tdb-bouton" onClick={copier}>Copier le message</button>
            <input className="dr-tel" type="tel" inputMode="tel" placeholder="Téléphone du client (WhatsApp)" value={tel} onChange={(e) => setTel(e.target.value)} />
            <a className={"tdb-bouton dr-lien" + (tel.trim().length >= 9 ? "" : " inactif")} href={tel.trim().length >= 9 ? lienWhatsApp(tel, message) : undefined} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>
            {calcule && !course && <button className="dr-secondaire" onClick={() => setAjout(true)}>Le client accepte : enregistrer la course</button>}
          </div>
          {copie && <p className="tdb-note" role="status">{copie}</p>}
        </section>
      )}
    </div>
  );
}

// « Modifier le devis » depuis la page d'une course (16 nov. 2026)
export function ModifierDevis({ d, onEnregistrer, onFermer, enCours, aller }) {
  return <Formulaire service={d.service} course={d} retour={onFermer} aller={aller} onEnregistrer={onEnregistrer} enCours={enCours} />;
}

// 26 nov. 2026 (9h53, Rebecca) : « je veux pouvoir ajouter n'importe quelle course depuis le Calendrier, que tout se calcule »
export function CourseAvecPrix({ date, onFin }) {
  const [service, setService] = useState(null);
  if (service) return <Formulaire key={service} service={service} retour={() => setService(null)} dateInitiale={date} depuisCalendrier />;
  return (
    <div className="tdb">
      <div className="tdb-tete">
        <h2>Ajouter une course avec prix</h2>
        <p className="tdb-sous">Le prix, les horaires et ta journée se calculent ; tu choisis ensuite Cliente, Ami ou Famille.</p>
      </div>
      <div className="dr-services">
        {SERVICES.filter((s) => s.id !== "ramassage").map((s) => (
          <button key={s.id} className="tdb-tuile" onClick={() => setService(s.id)}>
            <span className="tdb-icone"><IconeService id={s.id} taille={40} /></span>
            <span className="tdb-tuile-texte"><b>{s.titre}</b></span>
          </button>
        ))}
      </div>
      <button className="dr-secondaire" onClick={onFin}>Fermer</button>
    </div>
  );
}

export default function SimulateurDevis({ aller }) {
  const [service, setService] = useState(null);
  // Ramassage scolaire : devis a plusieurs enfants, horaires par jour, semaine ou mois (12 nov. 2026)
  if (service === "ramassage") return <RamassagePlanning retour={() => setService(null)} aller={aller} />;
  if (service) return <Formulaire key={service} service={service} retour={() => setService(null)} aller={aller} />;
  return (
    <div className="tdb">
      <div className="tdb-tete">
        <h1>Devis rapide</h1>
        <p className="tdb-sous">Pour un client qui te demande un prix sur Instagram, WhatsApp ou par téléphone</p>
      </div>
      <div className="dr-services">
        {SERVICES.map((s) => (
          <button key={s.id} className="tdb-tuile" onClick={() => setService(s.id)}>
            <span className="tdb-icone"><IconeService id={s.id} taille={40} /></span>
            <span className="tdb-tuile-texte"><b>{s.titre}</b></span>
          </button>
        ))}
      </div>
    </div>
  );
}
