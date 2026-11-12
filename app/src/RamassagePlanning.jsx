import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import Champ from "./components/Champ.jsx";
import Devis from "./components/Devis.jsx";
import IconeService from "./components/IconeService.jsx";
import AjoutManuel from "./AjoutManuel.jsx";
import { calculerTrajet } from "./routing.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { useFermetures } from "./fermetures.js";
import { JOURS, PERIODES, SENS, MAX_ENFANTS, planVide, reglerNombreEnfants, nomEnfant, heureDuJour, manquePlan, calculerPlan, ecolesDuPlan, cleEcole, messagePlan, libellePeriode, planVersAjoutManuel } from "./pricing/ramassagePlanning.js";
import JourneeTournee from "./components/JourneeTournee.jsx";
import { aujourdhui } from "./profil.js";
import { evaluerDevis, ajouterALaTournee } from "./pricing/tournee.js";
import { useTournee, useDurees, enregistrerTournee, PASTILLES } from "./tourneeBase.js";
import "./client-commun.css";
import "./devis-rapide.css";

// DEVIS RAPIDE - RAMASSAGE SCOLAIRE (12 nov. 2026) : 1 a 4 enfants, l'heure exacte de chaque jour pour chaque
// enfant, et un prix pour un jour, une semaine ou un mois. Meme prix par trajet que sur le site.

const CHAMP_DOMICILE = { name: "domicile", label: "Adresse du domicile", type: "adresse", required: true };
const CHAMP_ECOLE = { name: "ecole", label: "Adresse de l'école", type: "adresse", required: true };
const jourDeLaDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

function Enfant({ enfant, index, periode, jourUnique, changer }) {
  const set = (cle, valeur) => changer({ ...enfant, [cle]: valeur });
  const setJour = (w, cle, valeur) => changer({ ...enfant, jours: enfant.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const avecSortie = enfant.sens !== "matin";
  const avecMatin = enfant.sens !== "sortie";
  const jours = JOURS.map((nom, w) => ({ nom, w })).filter((j) => periode !== "jour" || j.w === jourUnique);
  return (
    <div className="bloc rp-enfant">
      <h3>{nomEnfant(enfant, index)}</h3>
      <div className="champ">
        <label htmlFor={`rp-prenom-${index}`}>Prénom (facultatif)</label>
        <input id={`rp-prenom-${index}`} type="text" maxLength={40} value={enfant.prenom} onChange={(e) => set("prenom", e.target.value)} />
      </div>
      <fieldset className="champ">
        <legend>Quels trajets ?</legend>
        <div className="choix">
          {SENS.map((o) => (
            <button key={o.v} type="button" className={enfant.sens === o.v ? "actif" : ""} aria-pressed={enfant.sens === o.v} onClick={() => set("sens", o.v)}>{o.l}</button>
          ))}
        </div>
      </fieldset>
      <div className="champ">
        <label className="case">
          <input type="checkbox" checked={!!enfant.autreEcole} onChange={(e) => set("autreEcole", e.target.checked)} />
          <span>Dans une autre école</span>
        </label>
      </div>
      {enfant.autreEcole && (
        <Champ champ={{ name: "ecole" + index, label: "Adresse de son école", type: "adresse", required: true }} valeurs={{ ["ecole" + index]: enfant.ecole }} onChange={(_, valeur) => set("ecole", valeur)} />
      )}
      {avecMatin && (
        <div className="champ">
          <label htmlFor={`rp-matin-${index}`}>Heure du matin (au domicile)</label>
          <input id={`rp-matin-${index}`} type="time" value={enfant.heureMatin} onChange={(e) => set("heureMatin", e.target.value)} />
        </div>
      )}
      {avecSortie && periode !== "jour" && (
        <div className="champ">
          <label htmlFor={`rp-sortie-${index}`}>Heure de sortie habituelle</label>
          <input id={`rp-sortie-${index}`} type="time" value={enfant.heureSortie} onChange={(e) => set("heureSortie", e.target.value)} />
          <span className="aide">Elle se met sur tous les jours. Change ensuite l'heure des jours différents.</span>
        </div>
      )}
      {periode === "jour" && jourUnique === null && <p className="aide">Choisis d'abord la date.</p>}
      {jours.length > 0 && (
        <div className="rp-jours" role="group" aria-label={`Jours de ${nomEnfant(enfant, index)}`}>
          {jours.map(({ nom, w }) => {
            const actif = periode === "jour" || enfant.jours[w].actif;
            return (
              <div className={"rp-jour" + (actif ? "" : " inactif")} key={w}>
                {periode === "jour" ? (
                  <span className="rp-nom">{avecSortie ? `Heure de sortie (${nom.toLowerCase()})` : nom}</span>
                ) : (
                  <label className="case">
                    <input type="checkbox" checked={enfant.jours[w].actif} onChange={(e) => setJour(w, "actif", e.target.checked)} />
                    <span>{nom}</span>
                  </label>
                )}
                {avecSortie && actif && (
                  <input type="time" aria-label={`Heure de sortie du ${nom.toLowerCase()}`} value={heureDuJour(enfant, w)} onChange={(e) => setJour(w, "heure", e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RamassagePlanning({ retour, aller }) {
  const [plan, setPlan] = useState(planVide);
  const [trajet, setTrajet] = useState(null);
  const [copie, setCopie] = useState("");
  const [tel, setTel] = useState("");
  const [ajout, setAjout] = useState(false);
  const [demandes, setDemandes] = useState([]);
  const reglages = useFermetures();
  const changer = (nom, valeur) => setPlan((o) => ({ ...o, [nom]: valeur }));
  const changerEnfant = (i, e) => setPlan((o) => ({ ...o, enfants: o.enfants.map((x, k) => (k === i ? e : x)) }));

  // Distance reelle domicile <-> chaque ecole (meme calcul que le site)
  const [routes, setRoutes] = useState({});
  const a = plan.domicile;
  const ecoles = ecolesDuPlan(plan);
  const cleDomicile = a && typeof a.lat === "number" ? `${a.lat},${a.lon}` : "";
  const cle = cleDomicile && ecoles.length ? cleDomicile + ">" + ecoles.map(cleEcole).join("|") : "";
  useEffect(() => {
    if (!cle) {
      setTrajet(null);
      setRoutes({});
      return undefined;
    }
    const ctrl = new AbortController();
    setTrajet({ statut: "chargement" });
    Promise.all(ecoles.map((e) => calculerTrajet(a, e, ctrl.signal)))
      .then((liste) => {
        setRoutes(Object.fromEntries(liste.map((r, k) => [cleEcole(ecoles[k]), { km: r.km, minutes: r.minutes }])));
        setTrajet({ statut: "ok", ...liste[0] });
      })
      .catch((e) => e.name !== "AbortError" && setTrajet({ statut: "erreur" }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  useEffect(() => {
    if (!ajout) return undefined;
    return onSnapshot(collection(db, "demandes"), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [ajout]);

  const manque = manquePlan(plan);
  const pret = !manque;
  const distanceOk = trajet && trajet.statut === "ok";
  const resultat = useMemo(() => {
    if (!pret || !distanceOk) return null;
    return calculerPlan(plan, routes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, trajet, routes, pret, distanceOk, reglages]);

  const calcule = !!(resultat && resultat.ok);
  const x = calcule ? resultat.details : null;
  const message = messagePlan(plan, resultat);
  const jourUnique = jourDeLaDate(plan.date);

  // Est-ce que je peux accepter ? Les trajets de la cliente sont inseres dans ma tournee, jour par jour.
  const base = useTournee();
  const [cliente, setCliente] = useState("");
  const [ajoutTournee, setAjoutTournee] = useState("");
  const tousTrajets = useMemo(() => (pret ? [...base.donnees.trajets, ...evaluerDevis([], plan, () => 0).nouveaux] : []), [pret, plan, base.donnees.trajets]);
  const durees = useDurees(tousTrajets, base.donnees.domicile);
  const faisable = useMemo(
    () => (pret && !base.refuse ? evaluerDevis(base.donnees.trajets, plan, durees.duree, undefined, base.donnees.domicile) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pret, plan, base, durees.statut, reglages]
  );
  const ajouterTournee = async () => {
    try {
      await enregistrerTournee(ajouterALaTournee(base.donnees, plan, routes, cliente, aujourdhui()));
      setAjoutTournee("C'est ajouté à ta tournée scolaire.");
    } catch {
      setAjoutTournee("Ajout impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };

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
        prerempli={planVersAjoutManuel(plan, resultat)}
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
        <IconeService id="ramassage" taille={40} />
        <h1>Ramassage scolaire</h1>
      </header>
      <p className="tdb-note">Même prix par trajet que sur le site. Deux enfants à la même heure = un seul trajet. Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer ».</p>
      <div className="formulaire dr-formulaire">
        <div className="bloc">
          <Champ champ={CHAMP_DOMICILE} valeurs={plan} onChange={changer} />
          <Champ champ={plan.enfants.some((e) => e.autreEcole) ? { ...CHAMP_ECOLE, label: "Adresse de l'école (enfants sans autre école)" } : CHAMP_ECOLE} valeurs={plan} onChange={changer} />
          <fieldset className="champ">
            <legend>Devis pour</legend>
            <div className="choix rp-trois">
              {PERIODES.map((o) => (
                <button key={o.v} type="button" className={plan.periode === o.v ? "actif" : ""} aria-pressed={plan.periode === o.v} onClick={() => changer("periode", o.v)}>{o.l}</button>
              ))}
            </div>
            {plan.periode === "semaine" && <span className="aide">Coche les jours de chaque enfant (1, 3, 5 jours…).</span>}
            {plan.periode === "mois" && plan.date && <span className="aide">Un mois à partir du premier jour. Chabbat et fêtes sont retirés automatiquement.</span>}
          </fieldset>
          <div className="champ">
            <label htmlFor="rp-date">{plan.periode === "jour" ? "Date *" : "Premier jour (facultatif)"}</label>
            <input id="rp-date" type="date" value={plan.date} onChange={(e) => changer("date", e.target.value)} />
            {plan.periode === "semaine" && !plan.date && <span className="aide">Sans date : prix d'une semaine complète.</span>}
            {plan.periode === "mois" && !plan.date && <span className="aide">Sans date : prix du mois le plus long, sans fête ni vacances. C'est le prix maximum d'un mois.</span>}
          </div>
          {plan.periode !== "jour" && plan.date && (
            <fieldset className="champ">
              <legend>Jours sans école dans la période (vacances), facultatif</legend>
              <div className="rp-vacances">
                <label>Du <input type="date" value={plan.sansEcoleDu} onChange={(e) => changer("sansEcoleDu", e.target.value)} /></label>
                <label>Au <input type="date" value={plan.sansEcoleAu} min={plan.sansEcoleDu || undefined} onChange={(e) => changer("sansEcoleAu", e.target.value)} /></label>
              </div>
            </fieldset>
          )}
          <fieldset className="champ">
            <legend>Nombre d'enfants</legend>
            <div className="choix rp-quatre">
              {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button" className={plan.enfants.length === n ? "actif" : ""} aria-pressed={plan.enfants.length === n} onClick={() => changer("enfants", reglerNombreEnfants(plan.enfants, n))}>{n}</button>
              ))}
            </div>
          </fieldset>
        </div>

        {plan.enfants.map((e, i) => (
          <Enfant key={i} enfant={e} index={i} periode={plan.periode} jourUnique={jourUnique} changer={(n) => changerEnfant(i, n)} />
        ))}

        <div className="bloc">
          <div className="champ">
            <label htmlFor="rp-reduction">Réduction (%)</label>
            <input id="rp-reduction" type="text" inputMode="decimal" maxLength={5} value={plan.reduction} placeholder={calcule ? `Proposée : ${String(x.reductionProposee).replace(".", ",")} %` : "Proposée automatiquement"} onChange={(e) => changer("reduction", e.target.value)} />
            <span className="aide">Laisse vide pour la réduction proposée (jour : prix normal ; semaine : selon les jours ; mois ; plusieurs enfants). Tape un autre chiffre pour la changer, 0 pour aucune.</span>
          </div>
        </div>

        <Devis resultat={resultat} trajet={ecoles.length > 1 ? null : trajet} pretPourCalcul={pret} manque={manque} />
      </div>

      {calcule && (
        <section className="tdb-bloc">
          <h2>Détail</h2>
          <ul className="rp-detail">
            <li><span>Période</span><b>{libellePeriode(plan, resultat)}</b></li>
            {plan.enfants.map((e, i) => (
              <li key={i}><span>{nomEnfant(e, i)}</span><b>{x.parEnfant[i]} trajet{x.parEnfant[i] > 1 ? "s" : ""}</b></li>
            ))}
            <li><span>Trajets à faire en tout</span><b>{x.nbTrajets}</b></li>
            {x.reduction > 0 && <li><span>Prix par trajet après réduction</span><b>{String(x.parTrajetNet).replace(".", ",")} ₪</b></li>}
            {x.retires.length > 0 && <li><span>Jours retirés</span><b>{x.retires.length} ({[...new Set(x.retires.map((r) => r.motif))].join(", ")})</b></li>}
          </ul>
          <p className="tdb-note">Pour toi seulement : gain net estimé {x.rentabilite.gainNetParTrajet} ₪ par trajet, {x.rentabilite.gainNet} ₪ en tout ({x.rentabilite.gainNetHeure} ₪ / heure, retour à vide compris).</p>
          {x.conflits.length > 0 && (
            <p className="tdb-note rp-alerte">Pour toi seulement, déjà pris dans ton agenda : {x.conflits.join(" ; ")}.</p>
          )}
        </section>
      )}

      {calcule && faisable && faisable.jours.length > 0 && (
        <section className="tdb-bloc">
          <h2>Est-ce que je peux accepter ?</h2>
          <p className="rp-reponse">{PASTILLES[faisable.statut].signe} {faisable.statut === "possible" ? "Oui, ça rentre dans ma tournée." : faisable.statut === "serre" ? "Oui, mais c'est serré certains jours." : faisable.statut === "impossible" ? "Non, pas tous les jours tel quel." : "Calcul des temps de route en cours…"}</p>
          {durees.statut === "erreur" && <p className="rp-alerte">Temps de route indisponibles pour l'instant. Réessaie dans un moment.</p>}
          {base.donnees.trajets.length === 0 && <p className="tdb-note">Ta tournée scolaire est vide : remplis-la dans la rubrique « Tournée scolaire » pour que la réponse en tienne compte.</p>}
          {faisable.jours.map((j) => (
            <JourneeTournee key={j.w} titre={j.jour} jour={j} nouveaux={faisable.nouveaux.map((r) => r.id)} />
          ))}
          <p className="tdb-note">Pour toi seulement. En rose : les enfants de ce devis. Rien n'est bloqué, c'est toi qui décides.</p>
          <div className="dr-actions">
            <input className="dr-tel" type="text" maxLength={60} placeholder="Nom de la cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <button className="dr-secondaire" onClick={ajouterTournee}>La cliente accepte : ajouter à ma tournée</button>
          </div>
          {ajoutTournee && <p className="tdb-note" role="status">{ajoutTournee}</p>}
        </section>
      )}

      {pret && resultat && (
        <section className="tdb-bloc">
          <h2>Message pour le client</h2>
          <textarea className="dr-message" readOnly value={message} rows={14} />
          <div className="dr-actions">
            <button className="tdb-bouton" onClick={copier}>Copier le message</button>
            <input className="dr-tel" type="tel" inputMode="tel" placeholder="Numéro WhatsApp du client" value={tel} onChange={(e) => setTel(e.target.value)} />
            <a className={"tdb-bouton dr-lien" + (tel.trim().length >= 9 ? "" : " inactif")} href={tel.trim().length >= 9 ? lienWhatsApp(tel, message) : undefined} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>
            {calcule && <button className="dr-secondaire" onClick={() => setAjout(true)}>Le client accepte : enregistrer le forfait</button>}
          </div>
          {copie && <p className="tdb-note" role="status">{copie}</p>}
        </section>
      )}
    </div>
  );
}
