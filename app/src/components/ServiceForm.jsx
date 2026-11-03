import { useEffect, useMemo, useRef, useState } from "react";
import Champ from "./Champ.jsx";
import Devis from "./Devis.jsx";
import { SERVICES, FORMULAIRES, CHAMPS_CLIENT, PROMO_CHAMPS, valeursInitiales, champsVisibles, valider, trajetACalculer, besoinDistance, versDemande, messageWhatsApp } from "../services.js";
import { calculerTrajet } from "../routing.js";
import { calculer } from "../pricing/engine.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { useFermetures } from "../fermetures.js";
import { construireDemande, enregistrerDemande } from "../demandes.js";

const adresseSaisie = (a) => !!(a && a.label && a.label.trim());

export default function ServiceForm({ service, onRetour, onEnvoye }) {
  const infos = SERVICES.find((s) => s.id === service);
  const [v, setV] = useState(() => valeursInitiales(service));
  const [erreurs, setErreurs] = useState({});
  const [trajet, setTrajet] = useState(null); // { statut: chargement | ok | erreur, km, minutes }
  const formRef = useRef(null);
  const reglages = useFermetures(); // change quand les fermetures de Rebecca sont chargees : le prix se recalcule

  const changer = (nom, valeur) => {
    setV((o) => ({ ...o, [nom]: valeur }));
    setErreurs((e) => (e[nom] ? { ...e, [nom]: undefined } : e));
  };

  /* Distance reelle : recalculee quand les deux adresses (avec coordonnees) changent */
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

  /* Quelles informations manquent pour afficher un prix ? */
  const adressesRequises = FORMULAIRES[service].filter((c) => c.type === "adresse" && champsVisibles(service, v).includes(c));
  const adressesRemplies = adressesRequises.every((c) => adresseSaisie(v[c.name]));
  let manque = "";
  if (!v.date || !v.heure) manque = "Choisissez la date et l'heure pour voir le prix.";
  else if (!adressesRemplies) manque = "Indiquez les adresses pour voir le prix.";
  const pretPourCalcul = !manque;

  const distanceOk = trajet && trajet.statut === "ok";
  const resultat = useMemo(() => {
    if (!pretPourCalcul) return null;
    if (besoinDistance(service, v) && service !== "hatan_kala" && service !== "demenagement" && !distanceOk) return null;
    const route = distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null;
    const r = calculer(versDemande(service, v, route));
    return r;
  }, [service, v, trajet, pretPourCalcul, distanceOk, reglages]);

  const bloque = !!(resultat && resultat.bloque);

  const envoyer = (e) => {
    e.preventDefault();
    const err = valider(service, v);
    setErreurs(err);
    const premier = Object.keys(err)[0];
    if (premier) {
      const el = formRef.current && formRef.current.querySelector("#f-" + premier);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus && el.focus({ preventScroll: true });
      }
      return;
    }
    if (bloque) return;
    const message = messageWhatsApp(service, v, resultat && resultat.ok ? resultat : null);
    const url = lienWhatsApp(WHATSAPP, message);
    // WhatsApp d'abord (le navigateur exige l'ouverture au moment du clic)
    window.open(url, "_blank", "noopener");
    // Puis enregistrement dans la base : si cela echoue, le client n'est jamais bloque
    try {
      const demande = construireDemande(service, v, resultat && resultat.ok ? resultat : null, distanceOk ? trajet : null, message);
      enregistrerDemande(demande).catch(() => {});
    } catch {
      /* WhatsApp est deja parti : on continue */
    }
    onEnvoye({ url, message, service: infos.titre });
  };

  return (
    <form className="formulaire" onSubmit={envoyer} ref={formRef} noValidate>
      <button type="button" className="retour" onClick={onRetour}>← Tous les services</button>
      <header className="titre-service">
        <span aria-hidden="true">{infos.icone}</span>
        <h2>{infos.titre}</h2>
      </header>

      <div className="bloc">
        {champsVisibles(service, v).map((c) => (
          <Champ key={c.name} champ={c} valeurs={v} erreur={erreurs[c.name]} onChange={changer} />
        ))}
      </div>

      <div className="bloc">
        <h3>Vos coordonnées</h3>
        {CHAMPS_CLIENT.map((c) => (
          <Champ key={c.name} champ={c} valeurs={v} erreur={erreurs[c.name]} onChange={changer} />
        ))}
      </div>

      <div className="bloc promo">
        {PROMO_CHAMPS.filter((c) => !c.si || c.si(v)).map((c) => (
          <Champ key={c.name} champ={c} valeurs={v} erreur={erreurs[c.name]} onChange={changer} />
        ))}
      </div>

      <Devis resultat={resultat} trajet={trajet} pretPourCalcul={pretPourCalcul} manque={manque} />

      <div className="barre-envoi">
        <div className="barre-prix">
          {bloque ? <strong>Indisponible</strong> : resultat && resultat.ok && !resultat.devis && resultat.total != null ? <strong>{resultat.total} ₪</strong> : <span>Devis</span>}
        </div>
        <button type="submit" className="bouton" disabled={bloque}>
          Envoyer ma demande
        </button>
      </div>
      <p className="mention">Votre demande n'est pas une réservation : Rebecca la valide selon ses disponibilités et vous répond sur WhatsApp.</p>
      <p className="mention">Vos informations sont enregistrées pour traiter votre demande.</p>
    </form>
  );
}
