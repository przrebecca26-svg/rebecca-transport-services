import { useEffect, useMemo, useRef, useState } from "react";
import Champ from "./Champ.jsx";
import Devis from "./Devis.jsx";
import HoraireRapide from "./HoraireRapide.jsx";
import PromoBloc from "./PromoBloc.jsx";
import FavoriBouton from "./FavoriBouton.jsx";
import Pourboire from "../Pourboire.jsx";
import {
  SERVICES,
  FORMULAIRES,
  CHAMPS_CLIENT,
  valeursInitiales,
  valeursDepuisProfil,
  valeursDepuisDetails,
  remplirDepuisEnfant,
  horaireRapidePossible,
  champsVisibles,
  valider,
  trajetACalculer,
  besoinDistance,
  versDemande,
  messageWhatsApp,
} from "../services.js";
import { calculerTrajet } from "../routing.js";
import { calculer } from "../pricing/engine.js";
import { TARIFS } from "../pricing/config.js";
import { soldeCredit, utiliserCredit } from "../pricing/credit.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { useFermetures } from "../fermetures.js";
import { construireDemande, enregistrerDemande, messageEchec } from "../demandes.js";
import { aujourdhui, lirePourboire } from "../profil.js";
import { compteOuvert, useClient } from "../client.js";
import "../client-commun.css";
import IconeService from "./IconeService.jsx";

const adresseSaisie = (a) => !!(a && a.label && a.label.trim());

// Limite douce : quelques demandes par jour et par appareil (la vraie protection reste cote Rebecca)
const CLE_JOUR = "rts_demandes_";
const demandesDuJour = () => {
  try {
    return Number(window.localStorage.getItem(CLE_JOUR + aujourdhui())) || 0;
  } catch {
    return 0;
  }
};
const compterDemande = () => {
  try {
    window.localStorage.setItem(CLE_JOUR + aujourdhui(), String(demandesDuJour() + 1));
  } catch {
    /* navigation privee : sans importance */
  }
};

// depart = { details, remplace } pour "Refaire ce trajet", un favori ou "Modifier" (remplace = id de l'ancienne demande)
export default function ServiceForm({ service, depart, onRetour, onEnvoye, onCompte }) {
  const infos = SERVICES.find((s) => s.id === service);
  const client = useClient();
  const ouvert = compteOuvert(client);
  const profil = ouvert ? client.profil : null;
  const remplace = depart && depart.remplace ? depart.remplace : "";

  const [v, setV] = useState(() => {
    const base = depart && depart.details ? valeursDepuisDetails(service, depart.details, !!remplace) : valeursInitiales(service);
    return { ...base, ...valeursDepuisProfil(profil), pourboire: "" };
  });
  const [erreurs, setErreurs] = useState({});
  const [trajet, setTrajet] = useState(null); // { statut: chargement | ok | erreur, km, minutes }
  const [promo, setPromo] = useState({ code: "", promo: null });
  const [solde, setSolde] = useState(0);
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: "", url: "" });
  const envoiRef = useRef(false); // protection contre le double appui
  const formRef = useRef(null);
  const reglages = useFermetures(); // change quand les fermetures de Rebecca sont chargees : le prix se recalcule

  const changer = (nom, valeur) => {
    setV((o) => ({ ...o, [nom]: valeur }));
    setErreurs((e) => (e[nom] ? { ...e, [nom]: undefined } : e));
  };

  // Compte ouvert apres l'arrivee sur le formulaire : on complete nom, telephone et paiement s'ils sont vides
  useEffect(() => {
    if (!profil) return;
    const p = valeursDepuisProfil(profil);
    setV((o) => ({ ...o, nom: o.nom || p.nom || "", telephone: o.telephone || p.telephone || "", moyenPaiement: p.moyenPaiement && !o._paiementChoisi ? p.moyenPaiement : o.moyenPaiement }));
  }, [profil]);

  // Credit prepaye du client (lecture seule : la deduction est faite par Rebecca a la validation)
  useEffect(() => {
    if (!ouvert) return;
    let actif = true;
    Promise.all([import("../firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { collection, getDocs, query, where }]) => getDocs(query(collection(db, "creditMouvements"), where("uid", "==", client.user.uid))))
      .then((s) => actif && setSolde(soldeCredit(s.docs.map((x) => x.data()))))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [ouvert, client.user && client.user.uid]);

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
  const visibles = champsVisibles(service, v);
  const adressesRequises = FORMULAIRES[service].filter((c) => c.type === "adresse" && visibles.includes(c));
  const adressesRemplies = adressesRequises.every((c) => adresseSaisie(v[c.name]));
  let manque = "";
  if (!v.date || !v.heure) manque = "Choisissez la date et l'heure pour voir le prix.";
  else if (!adressesRemplies) manque = "Indiquez les adresses pour voir le prix.";
  const pretPourCalcul = !manque;

  // Base tarifaire + le code promo verifie (le moteur ne connait que les codes qu'on lui donne)
  const tarifs = useMemo(() => (promo.promo ? { ...TARIFS, codesPromo: { [promo.code]: promo.promo } } : TARIFS), [promo]);

  const distanceOk = trajet && trajet.statut === "ok";
  const resultat = useMemo(() => {
    if (!pretPourCalcul) return null;
    if (besoinDistance(service, v) && service !== "hatan_kala" && service !== "demenagement" && !distanceOk) return null;
    const route = distanceOk ? { km: trajet.km, minutes: trajet.minutes } : null;
    return calculer(versDemande(service, v, route), tarifs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, v, trajet, pretPourCalcul, distanceOk, reglages, tarifs]);

  const bloque = !!(resultat && resultat.bloque);
  const prixConnu = resultat && resultat.ok && !resultat.devis && resultat.total != null;
  const credit = ouvert && solde > 0 && prixConnu ? utiliserCredit(resultat.total, solde) : null;

  const allerAuPremier = (err) => {
    const premier = Object.keys(err).find((k) => err[k]);
    const el = premier && formRef.current && formRef.current.querySelector("#f-" + premier);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus && el.focus({ preventScroll: true });
    }
  };

  const envoyer = async (e) => {
    e.preventDefault();
    if (envoiRef.current) return; // double appui : la premiere demande est deja en cours
    const err = valider(service, v);
    const tip = lirePourboire(v.pourboire, TARIFS.pourboire.max);
    if (tip.erreur) err.pourboire = tip.erreur;
    setErreurs(err);
    if (Object.keys(err).some((k) => err[k])) return allerAuPremier(err);
    if (bloque) return;
    if (demandesDuJour() >= TARIFS.clients.demandesParJour) {
      setEnvoi({ enCours: false, erreur: "Vous avez déjà envoyé plusieurs demandes aujourd'hui. Écrivez directement à Rebecca sur WhatsApp.", url: lienWhatsApp(WHATSAPP, "Bonjour Rebecca,") });
      return;
    }

    let message = messageWhatsApp(service, v, resultat && resultat.ok ? resultat : null);
    if (tip.montant > 0) message = message.replace("\n\nMerci de me confirmer", `\nPourboire prévu : ${tip.montant} ₪\n\nMerci de me confirmer`);
    if (credit) message = message.replace("\n\nMerci de me confirmer", `\nCrédit disponible sur mon compte : ${solde} ₪\n\nMerci de me confirmer`);
    if (remplace) message = message.replace("nouvelle demande :", "demande modifiée :");
    const url = lienWhatsApp(WHATSAPP, message);
    const demande = construireDemande(service, v, resultat && resultat.ok ? resultat : null, distanceOk ? trajet : null, message, ouvert ? { uid: client.user.uid, remplace } : null);

    // Sans compte : WhatsApp s'ouvre tout de suite (le telephone l'exige au moment de l'appui), la base suit en arriere-plan
    if (!ouvert) {
      window.open(url, "_blank", "noopener");
      enregistrerDemande(demande).catch(() => {});
      compterDemande();
      onEnvoye({ url, message, service: infos.titre, serviceId: service, valeurs: v, enregistree: false });
      return;
    }

    // Avec un compte : la demande est d'abord enregistree (historique, code promo), puis le client ouvre WhatsApp
    envoiRef.current = true;
    setEnvoi({ enCours: true, erreur: "", url: "" });
    try {
      await enregistrerDemande(demande);
      compterDemande();
      onEnvoye({ url, message, service: infos.titre, serviceId: service, valeurs: v, enregistree: true });
    } catch (ex) {
      envoiRef.current = false;
      // Jamais bloque : en cas de souci, la demande peut toujours partir par WhatsApp (sauf code promo refuse)
      setEnvoi({ enCours: false, erreur: messageEchec(ex, demande), url: demande.codePromo ? "" : url });
    }
  };

  const enfants = profil && Array.isArray(profil.enfants) ? profil.enfants : [];

  return (
    <form className="formulaire" onSubmit={envoyer} ref={formRef} noValidate>
      <button type="button" className="retour" onClick={onRetour}>← Tous les services</button>
      <header className="titre-service">
        <span aria-hidden="true"><IconeService id={service} taille={40} /></span>
        <h2>{remplace ? "Modifier ma demande" : infos.titre}</h2>
      </header>
      {remplace && <p className="note">Votre nouvelle demande remplacera la précédente, qui sera marquée « remplacée ».</p>}

      <div className="bloc">
        {service === "demenagement" && (
          <p className="note">
            Je travaille avec un SUV, pas un camion : pas de meubles. Le volume est limité aux valises, cartons et petits objets qui tiennent dans le véhicule.
          </p>
        )}
        {service === "ramassage" && enfants.length > 0 && (
          <div className="champ">
            <span className="horaires-titre">Choisir un enfant enregistré</span>
            <div className="adresse-raccourcis">
              {enfants.map((en, i) => (
                <button key={i} type="button" onClick={() => setV((o) => ({ ...o, ...remplirDepuisEnfant(en) }))}>
                  {en.prenom}
                </button>
              ))}
            </div>
          </div>
        )}
        {horaireRapidePossible(service) && (
          <HoraireRapide
            date={v.date}
            heure={v.heure}
            onChoisir={(date, heure) => {
              changer("date", date);
              changer("heure", heure);
            }}
          />
        )}
        {visibles.map((c) => (
          <Champ key={c.name} champ={c} valeurs={v} erreur={erreurs[c.name]} onChange={changer} />
        ))}
      </div>

      <div className="bloc">
        <h3>Vos coordonnées</h3>
        {ouvert && <p className="note">Remplies depuis votre compte : vous pouvez les modifier pour cette demande.</p>}
        {CHAMPS_CLIENT.map((c) => (
          <Champ
            key={c.name}
            champ={c}
            valeurs={v}
            erreur={erreurs[c.name]}
            onChange={(nom, valeur) => {
              changer(nom, valeur);
              if (nom === "moyenPaiement") changer("_paiementChoisi", true);
            }}
          />
        ))}
        <Pourboire id="f-pourboire" valeur={v.pourboire} onChange={(x) => changer("pourboire", x)} erreur={erreurs.pourboire} />
      </div>

      <div className="bloc promo">
        <PromoBloc
          code={promo.code}
          promo={promo.promo}
          onCompte={onCompte}
          onChange={(code, p) => {
            setPromo({ code, promo: p });
            setV((o) => ({ ...o, promoActif: !!code, codePromo: code }));
          }}
        />
      </div>

      <Devis resultat={resultat} trajet={trajet} pretPourCalcul={pretPourCalcul} manque={manque} />

      {credit && (
        <section className="devis attente" aria-live="polite">
          <p className="note">
            Crédit disponible : <strong>{solde} ₪</strong>. Il sera déduit quand Rebecca validera la course : {credit.utilise} ₪ de crédit utilisé,{" "}
            <strong>reste à payer {credit.reste} ₪</strong> (hors pourboire).
          </p>
        </section>
      )}

      <FavoriBouton service={service} valeurs={v} />

      {envoi.erreur && (
        <div className="champ" role="alert">
          <span className="erreur">{envoi.erreur}</span>
          {envoi.url && (
            <a className="lien" href={envoi.url} target="_blank" rel="noopener noreferrer">
              Envoyer quand même par WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="barre-envoi">
        <div className="barre-prix">
          {bloque ? <strong>Indisponible</strong> : prixConnu ? <strong>{resultat.total} ₪</strong> : <span>Devis</span>}
        </div>
        <button type="submit" className="bouton" disabled={bloque || envoi.enCours}>
          {envoi.enCours ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </div>
      <p className="mention">Votre demande n'est pas une réservation : Rebecca la valide selon ses disponibilités et vous répond sur WhatsApp.</p>
      <p className="mention">Vos informations sont enregistrées pour traiter votre demande.</p>
    </form>
  );
}
