import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
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
import { messageDevis, versAjoutManuel } from "./pricing/devisRapide.js";
import "./client-commun.css";
import "./devis-rapide.css";

// DEVIS RAPIDE (D2a, 9 nov. 2026) : Rebecca simule le prix pour un client qui demande hors du site
// (Instagram, WhatsApp...). Meme formulaire et meme calculateur que le site : le prix annonce est toujours le bon.
// Puis : copier le message, l'envoyer sur WhatsApp, ou enregistrer la course si le client accepte.

const CHAMPS_EXCLUS = new Set(CHAMPS_CLIENT.map((c) => c.name).concat(["promoActif", "codePromo"]));
const adresseSaisie = (a) => !!(a && typeof a === "object" && String(a.label || "").trim());

function Formulaire({ service, retour, aller }) {
  const infos = SERVICES.find((s) => s.id === service);
  const [v, setV] = useState(() => valeursInitiales(service));
  const [trajet, setTrajet] = useState(null);
  const [copie, setCopie] = useState("");
  const [tel, setTel] = useState("");
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
    return onSnapshot(collection(db, "demandes"), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [ajout]);

  const visibles = champsVisibles(service, v).filter((c) => !CHAMPS_EXCLUS.has(c.name));
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
  const message = messageDevis(service, v, resultat);
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
        onFermer={() => setAjout(false)}
        onOuvrirDemande={(id) => aller("demandes", id)}
        onOuvrirFiche={(id) => aller("clients", id)}
      />
    );
  }

  return (
    <div className="tdb devis-rapide">
      <button className="tdb-retour" onClick={retour}>← Tous les services</button>
      <header className="dr-titre">
        <IconeService id={service} taille={40} />
        <h1>{infos.titre}</h1>
      </header>
      <p className="tdb-note">Même calcul que sur le site. Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer la course ».</p>
      <div className="formulaire dr-formulaire">
        <div className="bloc">
          {visibles.map((c) => (
            <Champ key={c.name} champ={c} valeurs={v} onChange={changer} />
          ))}
        </div>
        <Devis resultat={resultat} trajet={trajet} pretPourCalcul={pret} manque={manque} />
      </div>

      {calcule && renta && (
        <p className="tdb-note">Pour toi seulement : gain net estimé {renta.gainNet} ₪ ({renta.gainNetHeure} ₪ / heure, retour à vide compris).</p>
      )}

      {pret && resultat && (
        <section className="tdb-bloc">
          <h2>Message pour le client</h2>
          <textarea className="dr-message" readOnly value={message} rows={9} />
          <div className="dr-actions">
            <button className="tdb-bouton" onClick={copier}>Copier le message</button>
            <input className="dr-tel" type="tel" inputMode="tel" placeholder="Numéro WhatsApp du client" value={tel} onChange={(e) => setTel(e.target.value)} />
            <a className={"tdb-bouton dr-lien" + (tel.trim().length >= 9 ? "" : " inactif")} href={tel.trim().length >= 9 ? lienWhatsApp(tel, message) : undefined} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>
            {calcule && <button className="dr-secondaire" onClick={() => setAjout(true)}>Le client accepte : enregistrer la course</button>}
          </div>
          {copie && <p className="tdb-note" role="status">{copie}</p>}
        </section>
      )}
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
