import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import Champ from "./components/Champ.jsx";
import Devis from "./components/Devis.jsx";
import IconeService from "./components/IconeService.jsx";
import AjoutManuel from "./AjoutManuel.jsx";
import { calculerTrajet } from "./routing.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { useFermetures } from "./fermetures.js";
import { JOURS, PERIODES, SENS, MAX_ENFANTS, MODES_PARTAGE, planVide, enfantVide, reglerNombreEnfants, nomEnfant, heureDuJour, manquePlan, calculerPlan, ecolesDuPlan, cleEcole, messagePlan, libellePeriode, planVersAjoutManuel, nbFamillesDe, familleDe, nomsFamilles, enfantsDeLaFamille, reglerEnfantsFamille, reglerNombreFamilles, sousPlanFamille } from "./pricing/ramassagePlanning.js";
import { prixFr } from "./pricing/partage.js";
import { planDuPartage, partageDepuisPlan } from "./pricing/partageRamassage.js";
import { doc as refDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useDemandesRamassage } from "./prioriteBase.js";
import { demandesAvant, arriveeFr, textePriorite } from "./pricing/prioriteRamassage.js";
import { changerStatutPartage } from "./partageBase.js";
import JourneeTournee from "./components/JourneeTournee.jsx";
import Enfant from "./components/EnfantRamassage.jsx";
import { aujourdhui } from "./profil.js";
import ChoixLieu from "./components/MesLieux.jsx";
import { evaluerDevis, ajouterALaTournee, adressesConnues, nomDuLieu, garderDevis, retirerDevis, statutDevis, trajetsDuDevis } from "./pricing/tournee.js";
import { useTournee, useDurees, enregistrerTournee, PASTILLES } from "./tourneeBase.js";
import { fusionnerLieux } from "./pricing/repertoire.js";
import { trajetsDesChoix, lireChoix, choixDeLaFamille, familleDuDevis } from "./pricing/familles.js";
import { useRepertoire, enregistrerRepertoire } from "./repertoireBase.js";
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

export default function RamassagePlanning({ retour, aller, ouvrirPartage }) {
  const [plan, setPlan] = useState(planVide);
  const [trajet, setTrajet] = useState(null);
  const [copie, setCopie] = useState("");
  const [tel, setTel] = useState("");
  const [ajout, setAjout] = useState(false);
  const [demandes, setDemandes] = useState([]);
  const reglages = useFermetures();
  const [cliente, setCliente] = useState("");
  const changer = (nom, valeur) => setPlan((o) => ({ ...o, [nom]: valeur }));
  const changerFamille = (k, cle, valeur) => setPlan((o) => ({ ...o, autresFamilles: (o.autresFamilles || []).map((f, j) => (j === k ? { ...f, [cle]: valeur } : f)) }));
  const nbFam = nbFamillesDe(plan);
  const noms = nomsFamilles(plan, cliente);
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
    return onSnapshot(refDemandes(), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [ajout]);

  const ecolesDifferentes = plan.enfants.some((e) => e.autreEcole);
  const manque = manquePlan(plan);
  const pret = !manque;
  const distanceOk = trajet && trajet.statut === "ok";
  const resultat = useMemo(() => {
    if (!pret || !distanceOk) return null;
    return calculerPlan(plan, routes, undefined, { nomCliente: cliente });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, trajet, routes, pret, distanceOk, reglages, cliente]);

  const calcule = !!(resultat && resultat.ok);
  const x = calcule ? resultat.details : null;
  const message = messagePlan(plan, resultat);
  const jourUnique = jourDeLaDate(plan.date);

  // Est-ce que je peux accepter ? Les trajets de la cliente sont inseres dans ma tournee, jour par jour.
  const base = useTournee();
  const [ajoutTournee, setAjoutTournee] = useState("");
  const repertoire = useRepertoire();
  // Ma tournee = trajets des fiches enfants (Repertoire) + trajets saisis a la main
  const [devisOuvert, setDevisOuvert] = useState(""); // identifiant du devis en attente qu'on a rouvert
  const [partageId, setPartageId] = useState(""); // trajet partage du site ouvert dans ce devis
  // Priorite (15 nov. 2026) : les demandes arrivees avant (moins d'1 semaine, ou avant celle-ci) comptent comme deja prises
  const { classees } = useDemandesRamassage();
  const cleCourante = devisOuvert ? "r" + devisOuvert : partageId ? "p" + partageId : "";
  const avant = useMemo(() => demandesAvant(classees, cleCourante).filter((d) => d.plan && d.plan.enfants && d.plan.enfants.length), [classees, cleCourante]);
  const trajetsAvant = useMemo(
    () => avant.flatMap((d) => trajetsDuDevis(d.plan).map((r) => ({ ...r, id: `prio-${d.cle}-${r.id}`.slice(0, 40), nom: `⏳ ${d.nom} · ${r.nom}`.slice(0, 60), client: false }))),
    [avant]
  );
  const maTournee = useMemo(() => [...trajetsDesChoix(repertoire.familles, lireChoix(base.donnees.choix)), ...base.donnees.trajets, ...trajetsAvant], [repertoire.familles, base.donnees.choix, base.donnees.trajets, trajetsAvant]);
  const tousTrajets = useMemo(() => (pret ? [...maTournee, ...evaluerDevis([], plan, () => 0).nouveaux] : []), [pret, plan, maTournee]);
  const durees = useDurees(tousTrajets, base.donnees.domicile);
  const faisable = useMemo(
    () => (pret && !base.refuse ? evaluerDevis(maTournee, plan, durees.duree, undefined, base.donnees.domicile) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pret, plan, maTournee, base, durees.statut, reglages]
  );
  // La cliente accepte : sa famille et ses enfants deviennent des fiches du Repertoire (la tournee suit toute seule) ;
  // un forfait au mois est aussi garde pour comparer chaque mois le prix reel au prix complet.
  // Devis accepte (celui de l'ecran, ou un devis en attente de la liste) : fiche de la famille + trajets + forfait
  const accepter = async ({ plan: p, routes: r, nom, telephone, id }) => {
    try {
      // Trajets partages : une fiche par famille, chacune avec ses enfants (15 nov. 2026)
      const autres = (p.autresFamilles || []).slice(0, nbFamillesDe(p) - 1);
      const fiches = nbFamillesDe(p) > 1
        ? [familleDuDevis(sousPlanFamille(p, 0), nom, telephone), ...autres.map((f, k) => familleDuDevis(sousPlanFamille(p, k + 1), f.nom || `Famille ${k + 2}`, f.telephone))]
        : [familleDuDevis(p, nom, telephone)];
      await enregistrerRepertoire(repertoire.lieux, repertoire.corrections, [...repertoire.familles, ...fiches]);
      // Ses trajets sont choisis d'office dans ma tournee (elle les a demandes) ; le forfait au mois est garde
      const suite = retirerDevis(ajouterALaTournee(base.donnees, p, r, nom, aujourdhui(), { sansTrajets: true }), id || ""); // accepte : il n'est plus « en attente »
      await enregistrerTournee({ ...suite, choix: [...lireChoix(base.donnees.choix), ...fiches.flatMap((f) => choixDeLaFamille(f))] });
      if (id && id === devisOuvert) setDevisOuvert("");
      if (partageId && !id) {
        await changerStatutPartage(partageId, "acceptee").catch(() => {});
        setPartageId("");
      }
      return `Devis de ${String(nom || "").trim() || "la cliente"} accepté : sa fiche est dans ton Répertoire et ses trajets dans ta tournée.`;
    } catch {
      return "Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.";
    }
  };
  const ajouterTournee = async () => setAjoutTournee(await accepter({ plan, routes, nom: cliente, telephone: tel, id: devisOuvert }));

  // Mes lieux deja nommes dans la tournee (ecoles, Gan...) : proposes pour l'ecole, sans retaper l'adresse
  const lieux = fusionnerLieux(repertoire.lieux, base.donnees.lieux);
  const connues = adressesConnues(null, [], lieux);
  const nomLieu = (adresse) => nomDuLieu(adresse, base.donnees.domicile, lieux);

  // Devis en attente : garde, rouvert, supprime (rien d'autre n'est enregistre tant que la cliente n'a pas accepte)
  const [infoDevis, setInfoDevis] = useState("");
  const garder = async () => {
    try {
      const r = garderDevis(base.donnees, { id: devisOuvert, nom: cliente, telephone: tel, plan, routes, total: calcule ? resultat.total : null, creeLe: aujourdhui(), message });
      await enregistrerTournee(r.doc);
      setDevisOuvert(r.id);
      setInfoDevis("Devis gardé : tu le retrouves en haut de cette page, dans « Mes devis en attente ».");
    } catch {
      setInfoDevis("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };
  const rouvrir = (d) => {
    setPlan({ ...planVide(), ...d.plan, enfants: d.plan.enfants.map((e) => ({ ...enfantVide(), ...e })) });
    setCliente(d.nom);
    setTel(d.telephone || "");
    setDevisOuvert(d.id);
    setInfoDevis("");
    setAjoutTournee("");
  };
  // Trajet partage du site (15 nov. 2026) : toutes les familles et leurs enfants arrivent dans ce devis
  useEffect(() => {
    if (!ouvrirPartage || !ouvrirPartage.doc) return;
    const { plan: p } = planDuPartage(ouvrirPartage.doc);
    const premiere = ouvrirPartage.doc.familles.find((f) => f.enfants && f.enfants.length) || ouvrirPartage.doc.familles[0];
    setPlan({ ...planVide(), ...p, enfants: p.enfants.length ? p.enfants : [enfantVide()] });
    setCliente(premiere.nom || "");
    setTel(premiere.telephone || "");
    setDevisOuvert("");
    setPartageId(ouvrirPartage.id);
    setInfoDevis(ouvrirPartage.doc.familles.some((f) => !f.enfants.length) ? "Trajet partagé ouvert. Attention : une famille n'a pas encore rempli ses enfants." : "Trajet partagé ouvert : toutes les familles ont rempli leurs enfants.");
    setAjoutTournee("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirPartage && ouvrirPartage.cle]);
  const [infoListe, setInfoListe] = useState("");
  // Enregistrer mes changements dans la demande du site (meme document : les familles voient la mise a jour)
  const [infoPartage, setInfoPartage] = useState("");
  const enregistrerPartage = async () => {
    if (!partageId) return;
    try {
      const nouveau = partageDepuisPlan(plan, cliente, tel, ouvrirPartage && ouvrirPartage.doc);
      await updateDoc(refDoc(db, "trajetsPartages", partageId), { commun: nouveau.commun, modePartage: nouveau.modePartage, familles: nouveau.familles, majLe: serverTimestamp() });
      setInfoPartage(`Demande mise à jour${calcule ? ` : nouveau devis ${resultat.total} ₪` : ""}. Envoie le message ci-dessous à la cliente pour la prévenir.`);
    } catch {
      setInfoPartage("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };
  const changerStatut = async (id, statut) => {
    try {
      await enregistrerTournee(statutDevis(base.donnees, id, statut));
    } catch {
      setInfoListe("Enregistrement impossible pour l'instant.");
    }
  };
  const supprimerDevis = async (id) => {
    try {
      await enregistrerTournee(retirerDevis(base.donnees, id));
      if (devisOuvert === id) setDevisOuvert("");
    } catch {
      setInfoDevis("Suppression impossible pour l'instant.");
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
      {retour && <button className="tdb-retour" onClick={retour}>← Tous les services</button>}
      <header className="dr-titre">
        <IconeService id="ramassage" taille={40} />
        <h1>Ramassage scolaire</h1>
      </header>
      <p className="tdb-note">Même prix par trajet que sur le site. Deux enfants à la même heure = un seul trajet. Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer ».</p>
      {base.donnees.devis.length > 0 && (
        <section className="tdb-bloc">
          <h2>Mes devis en attente de réponse</h2>
          {base.donnees.devis.filter((d) => d.statut === "attente").map((d) => (
            <div className="rp-forfait" key={d.id}>
              <span><b>{d.nom}</b>{d.telephone ? ` · ${d.telephone}` : ""} · {d.plan.enfants.length} enfant{d.plan.enfants.length > 1 ? "s" : ""}{d.total != null ? ` · ${d.total} ₪` : ""}{d.creeLe ? ` · fait le ${d.creeLe.split("-").reverse().join("/")}` : ""}{devisOuvert === d.id ? " · ouvert ci-dessous" : ""}</span>
              <div className="rp-boutons">
                {d.telephone && d.message && <a className="rp-waze" href={lienWhatsApp(d.telephone, d.message)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                <button type="button" className="rp-waze" onClick={() => rouvrir(d)}>Rouvrir</button>
                <button type="button" className="rp-waze" onClick={async () => setInfoListe(await accepter(d))}>Acceptée ✅</button>
                <button type="button" className="rp-waze" onClick={() => changerStatut(d.id, "refuse")}>Refusée ❌</button>
              </div>
            </div>
          ))}
          {base.donnees.devis.some((d) => d.statut !== "attente") && (
            <details className="rp-journee">
              <summary><span>Devis refusés ou annulés</span><b>{base.donnees.devis.filter((d) => d.statut !== "attente").length}</b></summary>
              {base.donnees.devis.filter((d) => d.statut !== "attente").map((d) => (
                <div className="rp-forfait" key={d.id}>
                  <span><b>{d.nom}</b>{d.total != null ? ` · ${d.total} ₪` : ""}{d.statut === "annule" ? " · annulé (2 semaines sans réponse)" : ""}</span>
                  <div className="rp-boutons">
                    <button type="button" className="rp-waze" onClick={() => changerStatut(d.id, "attente")}>Remettre en attente</button>
                    <button type="button" className="rp-waze" onClick={() => supprimerDevis(d.id)}>Supprimer</button>
                  </div>
                </div>
              ))}
            </details>
          )}
          {infoListe && <p className="tdb-note" role="status">{infoListe}</p>}
        </section>
      )}
      <div className="formulaire dr-formulaire">
        <div className="bloc rp-cliente">
          <p className="rp-type">La cliente</p>
          <div className="champ">
            <label htmlFor="rp-cliente">Nom de la cliente</label>
            <input id="rp-cliente" type="text" maxLength={60} value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="rp-tel">Son téléphone (WhatsApp)</label>
            <input id="rp-tel" type="tel" inputMode="tel" maxLength={20} placeholder="05X XXX XXXX" value={tel} onChange={(e) => setTel(e.target.value)} />
          </div>
        </div>
        <div className="bloc">
          <Champ champ={CHAMP_DOMICILE} valeurs={plan} onChange={changer} />
          {plan.enfants.length > 1 && (
            <fieldset className="champ">
              <legend>École des enfants</legend>
              <div className="choix">
                <button type="button" className={ecolesDifferentes ? "" : "actif"} aria-pressed={!ecolesDifferentes} onClick={() => changer("enfants", plan.enfants.map((e) => ({ ...e, autreEcole: false })))}>Même école pour tous</button>
                <button type="button" className={ecolesDifferentes ? "actif" : ""} aria-pressed={ecolesDifferentes} onClick={() => changer("enfants", plan.enfants.map((e, i) => ({ ...e, autreEcole: true, ecole: e.ecole || (i === 0 ? plan.ecole : null) })))}>Écoles différentes</button>
              </div>
              {ecolesDifferentes && <span className="aide">Indique l'adresse de l'école dans la fiche de chaque enfant, plus bas.</span>}
            </fieldset>
          )}
          {!plan.enfants.every((e) => e.autreEcole) && (
            <>
              <ChoixLieu id="le-haut" connues={connues} valeur={plan.ecole} choisir={(x) => changer("ecole", x)} />
              <Champ champ={plan.enfants.some((e) => e.autreEcole) ? { ...CHAMP_ECOLE, label: "Adresse de l'école (enfants sans autre école)" } : CHAMP_ECOLE} valeurs={plan} onChange={changer} />
            </>
          )}
          <fieldset className="champ">
            <legend>Devis pour</legend>
            <div className="choix rp-trois">
              {PERIODES.map((o) => (
                <button key={o.v} type="button" className={plan.periode === o.v ? "actif" : ""} aria-pressed={plan.periode === o.v} onClick={() => changer("periode", o.v)}>{o.l}</button>
              ))}
            </div>
            {plan.periode === "semaine" && <span className="aide">Coche les jours de chaque enfant (1, 3, 5 jours…).</span>}
            {plan.periode === "mois" && plan.date && <span className="aide">Un mois à partir du premier jour. Chabbat, fêtes et vacances scolaires sont retirés automatiquement.</span>}
          </fieldset>
          <div className="champ">
            <label htmlFor="rp-date">{plan.periode === "jour" ? "Date *" : "Premier jour (facultatif)"}</label>
            <input id="rp-date" type="date" value={plan.date} onChange={(e) => changer("date", e.target.value)} />
            {plan.periode === "semaine" && !plan.date && <span className="aide">Sans date : prix d'une semaine complète.</span>}
            {plan.periode === "mois" && !plan.date && <span className="aide">Sans date : prix du mois le plus long, sans fête ni vacances. C'est le prix maximum d'un mois.</span>}
          </div>
          {plan.periode !== "jour" && plan.date && (
            <fieldset className="champ">
              <legend>Autres jours sans école dans la période, facultatif</legend>
              <div className="rp-vacances">
                <label>Du <input type="date" value={plan.sansEcoleDu} onChange={(e) => changer("sansEcoleDu", e.target.value)} /></label>
                <label>Au <input type="date" value={plan.sansEcoleAu} min={plan.sansEcoleDu || undefined} onChange={(e) => changer("sansEcoleAu", e.target.value)} /></label>
              </div>
            </fieldset>
          )}
          <fieldset className="champ">
            <legend>Combien de familles partagent les trajets ?</legend>
            <div className="choix rp-trois">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" className={nbFam === n ? "actif" : ""} aria-pressed={nbFam === n} onClick={() => setPlan((o) => reglerNombreFamilles(o, n))}>{n === 1 ? "1 famille" : `${n} familles`}</button>
              ))}
            </div>
            {nbFam > 1 && <span className="aide">Jusqu'à 2 enfants sur un trajet : prix normal. Chaque enfant en plus : un supplément. Chaque famille paie pour ses enfants (avec sa réduction), ou parts égales.</span>}
          </fieldset>
          {nbFam === 1 && (
            <fieldset className="champ">
              <legend>Nombre d'enfants</legend>
              <div className="choix rp-quatre">
                {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => (
                  <button key={n} type="button" className={plan.enfants.length === n ? "actif" : ""} aria-pressed={plan.enfants.length === n} onClick={() => changer("enfants", reglerNombreEnfants(plan.enfants, n))}>{n}</button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {nbFam > 1 && (
          <div className="bloc rp-familles">
            {Array.from({ length: nbFam }, (_, f) => (
              <fieldset className="champ" key={f}>
                <legend>Famille {f + 1}{f === 0 ? ` : ${String(cliente || "").trim() || "la cliente (nom en haut)"}` : ""}</legend>
                {f > 0 && (
                  <>
                    <label htmlFor={`rp-fam-nom-${f}`}>Nom</label>
                    <input id={`rp-fam-nom-${f}`} type="text" maxLength={60} value={(plan.autresFamilles[f - 1] || {}).nom || ""} onChange={(e) => changerFamille(f - 1, "nom", e.target.value)} />
                    <label htmlFor={`rp-fam-tel-${f}`}>Téléphone (WhatsApp, facultatif)</label>
                    <input id={`rp-fam-tel-${f}`} type="tel" inputMode="tel" maxLength={20} placeholder="05X XXX XXXX" value={(plan.autresFamilles[f - 1] || {}).telephone || ""} onChange={(e) => changerFamille(f - 1, "telephone", e.target.value)} />
                  </>
                )}
                <span className="aide">Nombre d'enfants</span>
                <div className="choix rp-quatre">
                  {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => {
                    const nb = enfantsDeLaFamille(plan, f).length;
                    return <button key={n} type="button" className={nb === n ? "actif" : ""} aria-pressed={nb === n} onClick={() => setPlan((o) => ({ ...o, enfants: reglerEnfantsFamille(o, f, n) }))}>{n}</button>;
                  })}
                </div>
              </fieldset>
            ))}
            <fieldset className="champ">
              <legend>Partager la note</legend>
              <div className="choix rp-deux">
                {MODES_PARTAGE.map((o) => (
                  <button key={o.v} type="button" className={(plan.modePartage || "enfant") === o.v ? "actif" : ""} aria-pressed={(plan.modePartage || "enfant") === o.v} onClick={() => changer("modePartage", o.v)}>{o.v === "egal" ? "Parts égales" : "Par enfant"}</button>
                ))}
              </div>
              <span className="aide">{(plan.modePartage || "enfant") === "egal" ? "Le total divisé par le nombre de familles." : "Chaque famille paie pour ses enfants."} Pour toi, le total ne change pas.</span>
            </fieldset>
          </div>
        )}

        {plan.enfants.map((e, i) => (
          <Enfant key={i} enfant={e} index={i} periode={plan.periode} jourUnique={jourUnique} changer={(n) => changerEnfant(i, n)} connues={connues} famille={nbFam > 1 ? noms[familleDe(plan, i)] : ""} />
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
            {x.familles && x.familles.length > 1 && x.familles.map((f, k) => (
              <li key={"f" + k}><span>{f.nom} ({f.enfants} enfant{f.enfants > 1 ? "s" : ""}{f.pourcentage > 0 ? `, -${String(Math.round(f.pourcentage * 1000) / 10).replace(".", ",")} %` : ""})</span><b>{prixFr(f.total)} ₪</b></li>
            ))}
            {x.partage && x.partage.mode === "egal" && <li><span>Parts égales ({x.partage.parts.length} familles)</span><b>{prixFr(x.partage.parts[x.partage.parts.length - 1].montant)} ₪ chacune</b></li>}
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
          {avant.length > 0 && (
            <p className="tdb-note rp-alerte">⏳ Comptées comme déjà prises (demandes prioritaires arrivées avant) : {avant.map((d) => `${d.nom} (arrivée le ${arriveeFr(d.arrivee)})`).join(" ; ")}. Si une journée est rouge à cause d'elles, cette demande passe après.</p>
          )}
          {maTournee.length === 0 && <p className="tdb-note">Ta tournée scolaire est vide : ajoute tes trajets dans « Tournée scolaire » pour que la réponse en tienne compte.</p>}
          {faisable.jours.map((j) => (
            <JourneeTournee key={j.w} titre={j.jour} jour={j} nouveaux={faisable.nouveaux.map((r) => r.id)} nomLieu={nomLieu} />
          ))}
          <p className="tdb-note">Pour toi seulement. En rose : les enfants de ce devis. Rien n'est bloqué, c'est toi qui décides.</p>
          <div className="dr-actions">
            <button className="dr-secondaire" onClick={ajouterTournee}>La cliente accepte : ajouter à ma tournée</button>
          </div>
          {ajoutTournee && <p className="tdb-note" role="status">{ajoutTournee}</p>}
        </section>
      )}

      {pret && (
        <section className="tdb-bloc">
          {partageId && ouvrirPartage && ouvrirPartage.id === partageId && (
            <>
              <h2>Demande de la cliente (site)</h2>
              <p className="tdb-note">Tu as ouvert la demande faite sur le site. Si la maman te demande un changement (horaire, enfant, adresse, période, partage), fais-le ici puis enregistre : sa demande est mise à jour, elle garde sa place, et chaque famille voit le nouveau devis avec son lien.</p>
              <div className="dr-actions">
                <button type="button" className="tdb-bouton" onClick={enregistrerPartage}>Enregistrer les changements dans sa demande</button>
              </div>
              {infoPartage && <p className="tdb-note" role="status">{infoPartage}</p>}
            </>
          )}
          <h2>Garder ce devis</h2>
          <p className="tdb-note">Tant que tu ne le gardes pas, le devis disparaît quand tu quittes cette page. Gardé, il reste dans « Mes devis en attente de réponse » avec le nom, le téléphone et le message envoyé.</p>
          <div className="dr-actions">
            <button type="button" className="tdb-bouton" onClick={garder}>{devisOuvert ? "Enregistrer les changements du devis" : "Garder ce devis (en attente)"}</button>
          </div>
          {infoDevis && <p className="tdb-note" role="status">{infoDevis}</p>}
        </section>
      )}

      {pret && resultat && (
        <section className="tdb-bloc">
          <h2>Message pour le client</h2>
          <textarea className="dr-message" readOnly value={message} rows={14} />
          <div className="dr-actions">
            <button className="tdb-bouton" onClick={copier}>Copier le message</button>
            <a className={"tdb-bouton dr-lien" + (tel.trim().length >= 9 ? "" : " inactif")} href={tel.trim().length >= 9 ? lienWhatsApp(tel, message) : undefined} target="_blank" rel="noopener noreferrer" onClick={() => { if (tel.trim().length >= 9) garder(); }}>{tel.trim().length >= 9 ? "Envoyer sur WhatsApp (et garder le devis)" : "Envoyer sur WhatsApp : mets son téléphone en haut"}</a>
            {calcule && <button className="dr-secondaire" onClick={() => setAjout(true)}>Le client accepte : enregistrer le forfait</button>}
          </div>
          {copie && <p className="tdb-note" role="status">{copie}</p>}
        </section>
      )}
    </div>
  );
}
