import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import Champ from "./components/Champ.jsx";
import Devis from "./components/Devis.jsx";
import IconeService from "./components/IconeService.jsx";
import AjoutManuel from "./AjoutManuel.jsx";
import RamassagePlanning from "./RamassagePlanning.jsx";
import { SERVICES, FORMULAIRES, CHAMPS_CLIENT, valeursInitiales, champsVisibles, trajetACalculer, besoinDistance, versDemande } from "./services.js";
import { calculerTrajet } from "./routing.js";
import { calculer } from "./pricing/engine.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { useFermetures } from "./fermetures.js";
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
function Formulaire({ service, retour, aller, course = null, onEnregistrer = null, enCours = false }) {
  const infos = SERVICES.find((s) => s.id === service);
  const [v, setV] = useState(() => (course ? valeursDepuisDemande(course) : valeursInitiales(service)));
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
  const changer = (nom, valeur) => setV((o) => ({ ...o, [nom]: valeur }));

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
  const resultat = useMemo(() => {
    if (!pret) return null;
    if (besoinDistance(service, v) && service !== "hatan_kala" && service !== "demenagement" && !distanceOk) return null;
    return calculer(versDemande(service, v, distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, v, trajet, pret, distanceOk, reglages]);

  const calcule = resultat && resultat.ok && !resultat.bloque;
  const prixNombre = Number(String(prixConvenu).replace(",", "."));
  const prixOk = String(prixConvenu).trim() !== "" && Number.isFinite(prixNombre) && prixNombre > 0 && prixNombre <= 20000;
  const maj = course && pret && prixOk ? majDepuisDevis(course, v, resultat, Math.round(prixNombre * 100) / 100, distanceOk ? trajet : null) : null;
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
        clientPrerempli={{ prenom: cli.prenom.trim(), nom: cli.nom.trim(), telephone: tel.trim(), email: cli.email.trim() }}
        onFermer={() => setAjout(false)}
        onOuvrirDemande={(id) => aller("demandes", id)}
        onOuvrirFiche={(id) => aller("clients", id)}
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

      {calcule && renta && (
        <p className="tdb-note">Pour toi seulement : gain net estimé {renta.gainNet} ₪ ({renta.gainNetHeure} ₪ / heure, retour à vide compris).</p>
      )}

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
