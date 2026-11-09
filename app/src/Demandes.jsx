import { useEffect, useMemo, useState } from "react";
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienAppel, lienWaze, lienWhatsApp } from "./pricing/navigation.js";
import { calculerTrajet } from "./routing.js";
import { SERVICES } from "./services.js";
import { cleClient } from "./pricing/clients.js";
import { MARGE_DEFAUT, clePaire, datesDe, messageAutreHoraire, phrase, trajetsACalculer, verifier, versHeure, voisins } from "./pricing/enchainement.js";
import { rattraperTousLesSuivis, synchroniserSuivi } from "./suiviClient.js";
import PaiementsCourse from "./PaiementsCourse.jsx";
import AjoutManuel, { Remerciement } from "./AjoutManuel.jsx";
import { LIBELLE_ORIGINE, prenomDe } from "./pricing/ajoutManuel.js";
import QuiFait from "./components/QuiFait.jsx";
import { FiltrePersonne, Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import { attribueA, coursesDeLaPersonne, filtrerPersonne } from "./pricing/quiFait.js";
import { servicesDuMembre } from "./pricing/espaceEquipe.js";
import "./demandes.css";

// Liste et traitement des demandes (espace prive de Rebecca) - Lot B, seance B3 :
// ouverture directe depuis « Aujourd'hui » ou une fiche client, filtre par activite, lien vers la fiche client,
// suivi client mis a jour a chaque changement, supplement (retard, attente...), verification d'enchainement.
// B7 : « + Ajouter une course » (course hors du site, faite ou a faire), origine du client, pourboire, remerciement.

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  refusee: { label: "Refusée", classe: "refusee" },
  terminee: { label: "Terminée", classe: "terminee" },
  annulee: { label: "Annulée", classe: "annulee" },
};

const ACTIVITES = [
  { id: "toutes", label: "Toutes activités" },
  { id: "coursier", label: "Services coursier" },
  { id: "transport", label: "Transport privé" },
];
const ACTIVITE_DE = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));

const ORDRE_ADRESSES = ["depart", "recuperation", "domicile", "adresse", "arretH1", "arretH2", "arretH3", "arretL2", "arretL3", "arretL4", "arretL5", "arrivee", "livraison", "ecole"];
const NOMS_ADRESSES = { depart: "Départ", recuperation: "Récupération", domicile: "Domicile", adresse: "Adresse", arrivee: "Arrivée", livraison: "Livraison", ecole: "École" };

const nomAdresse = (cle) => {
  if (NOMS_ADRESSES[cle]) return NOMS_ADRESSES[cle];
  const h = /^arretH(\d)$/.exec(cle);
  if (h) return "Arrêt " + h[1];
  const l = /^arretL(\d)$/.exec(cle);
  if (l) return "Livraison " + l[1];
  return cle;
};

const jour = (d, long) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });
};

const recueLe = (d) => {
  const t = d.creeLe && d.creeLe.toDate ? d.creeLe.toDate() : null;
  return t ? t.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "à l'instant";
};

const prixActuel = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime);
const textePrix = (d) => {
  const p = prixActuel(d);
  if (typeof p === "number") return p + " ₪";
  return d.surDevis ? "Sur devis" : "À fixer";
};
const lireMontant = (s) => {
  const t = String(s == null ? "" : s).trim().replace(",", ".");
  const n = Number(t);
  return t !== "" && isFinite(n) ? Math.round(n * 100) / 100 : null;
};

function messageClient(d) {
  const quand = `${jour(d.date, true)} à ${d.heure}`;
  const p = prixActuel(d);
  const prix = typeof p === "number" ? ` Prix convenu : ${p} ₪.` : "";
  if (d.statut === "acceptee") return `Bonjour ${d.nom}, votre réservation (${d.serviceTitre}) est confirmée pour ${quand}.${prix} À bientôt, Rebecca.`;
  if (d.statut === "refusee") return `Bonjour ${d.nom}, merci pour votre demande (${d.serviceTitre}, ${quand}). Malheureusement je ne suis pas disponible à ce moment-là. Souhaitez-vous proposer un autre horaire ? Rebecca.`;
  return `Bonjour ${d.nom}, j'ai bien reçu votre demande (${d.serviceTitre}, ${quand}). Je vérifie mes disponibilités et je reviens vers vous très vite. Rebecca.`;
}

function adressesDe(d) {
  const det = d.details || {};
  const cles = Object.keys(det).filter((k) => det[k] && typeof det[k] === "object" && det[k].label);
  const rang = (k) => (ORDRE_ADRESSES.includes(k) ? ORDRE_ADRESSES.indexOf(k) : 99);
  return cles.sort((a, b) => rang(a) - rang(b)).map((k) => ({ cle: k, nom: nomAdresse(k), ...det[k] }));
}

// Duree d'un trajet avec OSRM, abandonnee apres 8 secondes (meme position = 0 min)
async function minutesTrajet(de, vers) {
  if (de.lat === vers.lat && de.lon === vers.lon) return 0;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 8000);
  try {
    return (await calculerTrajet(de, vers, ctrl.signal)).minutes;
  } finally {
    clearTimeout(minuteur);
  }
}

// Resultat de la verification d'enchainement
function Verification({ verif, d, enCours, onForcer, onFermer }) {
  if (!verif) return null;
  if (verif.etat === "calcul") return <p className="dm-verif dm-calcul">Je vérifie que ta journée s'enchaîne…</p>;
  const { res, marge } = verif;
  const estimees = [...new Set(res.details.flatMap((x) => [x.premier, x.second]).filter((b) => b.estimee).map((b) => b.titre))];
  if (verif.etat === "ok") {
    return (
      <div className="dm-verif dm-ok" role="status">
        <p><strong>Course acceptée.</strong> {res.details.length === 0 ? "Aucune autre course acceptée ce jour-là." : "Ta journée s'enchaîne bien :"}</p>
        {res.details.map((x, i) => (
          <p key={i} className="tb-note">
            {x.sens === "avant" ? "Avant" : "Après"} : {Math.max(0, Math.round(x.libre))} min libres entre {versHeure(x.premier.fin)} et {versHeure(x.second.debut)}
            {x.trajetInconnu ? " (trajet inconnu : vérifie toi-même)" : ` (trajet ${x.trajet} min + marge ${marge} min)`}
          </p>
        ))}
        {estimees.length > 0 && <p className="tb-note">Durée estimée à 45 min pour : {estimees.join(", ")}.</p>}
        <button className="tb-retour aj-lien" onClick={onFermer}>Fermer</button>
      </div>
    );
  }
  const whatsapp = lienWhatsApp(d.telephone, messageAutreHoraire(d));
  return (
    <div className="dm-verif dm-alerte" role="alert" ref={(el) => el && el.scrollIntoView({ behavior: "smooth", block: "center" })}>
      <p><strong>Attention à l'enchaînement</strong></p>
      {res.problemes.map((x, i) => (
        <p key={i}>{x.date !== d.date ? `Le ${jour(x.date)} (retour) : ` : ""}{phrase(x)}</p>
      ))}
      {estimees.length > 0 && <p className="tb-note">Durée estimée à 45 min pour : {estimees.join(", ")}.</p>}
      <p className="tb-note">Calcul sans circulation en temps réel.</p>
      <div className="tb-actions">
        <button className="tb-bouton" disabled={enCours} onClick={onForcer}>Accepter quand même</button>
        {whatsapp && <a className="tb-bouton tb-clair" href={whatsapp} target="_blank" rel="noopener noreferrer">Proposer un autre horaire</a>}
        <button className="tb-bouton tb-clair" onClick={onFermer}>Annuler</button>
      </div>
    </div>
  );
}

function Detail({ d, toutes, marge, aller, onFermer }) {
  const { moi } = useEquipeContexte();
  const [prix, setPrix] = useState(typeof prixActuel(d) === "number" ? String(prixActuel(d)) : "");
  const [supp, setSupp] = useState({ ouvert: false, montant: "", motif: "Retard du client" });
  const [verif, setVerif] = useState(null);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [enCours, setEnCours] = useState(false);
  const ref = doc(db, "demandes", d.id);

  // Enregistre la demande, puis met a jour l'historique du client (si la demande vient d'un compte)
  const executer = async (champs) => {
    setErreur("");
    setAvertissement("");
    setEnCours(true);
    let ok = false;
    try {
      await updateDoc(ref, { ...champs, majLe: serverTimestamp() });
      ok = true;
      const suiviOk = await synchroniserSuivi({ ...d, ...champs });
      if (!suiviOk) setAvertissement("Enregistré, mais l'historique du client n'a pas pu être mis à jour. Utilise « Mettre à jour l'historique des clients » en bas de la liste.");
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
    return ok;
  };

  // J5 : a la fin de la course, on fige qui l'a faite (son chiffre d'affaires et son plafond)
  const changerStatut = (s) => executer({ statut: s, ...(s === "terminee" ? { realisePar: d.attribueA || "rebecca" } : {}) });
  // J3 : la personne qui accepte fait la course (sauf si elle est deja attribuee) ; modifiable ensuite
  const quiAccepte = d.attribueA || moi;
  const accepterChamps = () => executer({ statut: "acceptee", ...(d.attribueA ? {} : { attribueA: moi }) });

  // Accepter : on verifie d'abord l'enchainement avec les autres courses acceptees du meme jour
  const accepter = async () => {
    setVerif({ etat: "calcul" });
    try {
      // enchainement verifie sur l'agenda de la personne qui fera la course
      const liste = voisins(d, coursesDeLaPersonne(toutes, quiAccepte).filter((x) => x.statut === "acceptee"), datesDe(d));
      const trajets = {};
      await Promise.all(
        trajetsACalculer(liste).map(async (p) => {
          const k = clePaire(p.de, p.vers);
          if (!k || k in trajets) return;
          trajets[k] = null;
          try {
            trajets[k] = await minutesTrajet(p.de, p.vers);
          } catch {
            trajets[k] = null;
          }
        })
      );
      for (const k of Object.keys(trajets)) if (trajets[k] == null) delete trajets[k];
      const res = verifier(liste, trajets, marge);
      if (!res.ok) {
        setVerif({ etat: "alerte", res, marge });
        return;
      }
      if (await accepterChamps()) setVerif({ etat: "ok", res, marge });
      else setVerif(null);
    } catch {
      setVerif(null);
      setErreur("La vérification de l'enchaînement a échoué. Réessaie, ou accepte en vérifiant ton agenda.");
    }
  };
  const forcer = async () => {
    if (await accepterChamps()) setVerif(null);
  };

  const enregistrerPrix = () => {
    const n = lireMontant(prix);
    if (n == null || n < 0 || n > 20000) {
      setErreur("Entrez un prix valide, en shekels.");
      return;
    }
    if (n === prixActuel(d)) return;
    const ancien = typeof prixActuel(d) === "number" ? prixActuel(d) : null;
    executer({ prixFinal: n, historiquePrix: arrayUnion({ de: ancien, vers: n, leMs: Date.now() }) });
  };

  // Supplement : retard, attente, peage, arret en plus... ajoute au prix, avec un motif garde dans l'historique
  const ajouterSupplement = async () => {
    const n = lireMontant(supp.montant);
    const motif = supp.motif.trim().slice(0, 80);
    if (n == null || n <= 0 || n > 5000) {
      setErreur("Indique le montant du supplément, en shekels.");
      return;
    }
    if (motif.length < 3) {
      setErreur("Indique le motif du supplément.");
      return;
    }
    const ancien = typeof prixActuel(d) === "number" ? prixActuel(d) : 0;
    const nouveau = Math.round((ancien + n) * 100) / 100;
    if (await executer({ prixFinal: nouveau, historiquePrix: arrayUnion({ de: ancien, vers: nouveau, leMs: Date.now(), motif }) })) {
      setPrix(String(nouveau));
      setSupp({ ouvert: false, montant: "", motif: "Retard du client" });
    }
  };

  const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
  const whatsapp = lienWhatsApp(d.telephone, messageClient(d));
  const appel = lienAppel(d.telephone);
  const historique = Array.isArray(d.historiquePrix) ? d.historiquePrix : [];
  const cle = cleClient(d);

  return (
    <section className="tb-detail">
      <button className="tb-retour" onClick={onFermer}>← Toutes les demandes</button>
      <div className="tb-ligne">
        <h2>{d.serviceTitre}</h2>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </div>
      <p className="tb-quand">{jour(d.date, true)} à {d.heure}</p>
      {d.source === "manuel" && <p className="tb-note">Ajoutée à la main{d.origine ? ` · origine : ${LIBELLE_ORIGINE[d.origine] || d.origine}` : ""}</p>}

      <div className="tb-bloc">
        <h3>Client</h3>
        <p><strong>{d.nom}</strong>{d.uid ? " · avec compte" : ""}</p>
        <p>{d.telephone} · Paiement prévu : {d.moyenPaiement}</p>
        {d.passager && <p>Passager : {d.passager.nom} · {d.passager.telephone}</p>}
        <div className="tb-actions">
          {whatsapp ? <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <span className="tb-note">Numéro non reconnu pour WhatsApp</span>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
          {cle && <button className="tb-bouton tb-clair" onClick={() => aller("clients", cle)}>Fiche client</button>}
        </div>
      </div>

      <div className="tb-bloc">
        <h3>Statut</h3>
        <div className="tb-actions">
          {d.statut === "en attente" && (
            <>
              <button className="tb-bouton" disabled={enCours || (verif && verif.etat === "calcul")} onClick={accepter}>Accepter</button>
              <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => changerStatut("refusee")}>Refuser</button>
            </>
          )}
          {d.statut === "acceptee" && (
            <button className="tb-bouton" disabled={enCours} onClick={() => changerStatut("terminee")}>Course terminée</button>
          )}
          {d.statut !== "en attente" && d.statut !== "annulee" && (
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => changerStatut("en attente")}>Remettre en attente</button>
          )}
        </div>
        <Verification verif={verif} d={d} enCours={enCours} onForcer={forcer} onFermer={() => setVerif(null)} />
        <p className="tb-note">Après avoir accepté ou refusé, utilisez le bouton WhatsApp : le message est prêt.{d.uid ? " L'historique du client se met à jour tout seul." : ""}</p>
        {d.statut === "acceptee" && <p className="tb-note">Pour annuler (client absent, annulation tardive : l'acompte est conservé), utilisez le bloc « Paiements » plus bas.</p>}
      </div>

      <QuiFait d={d} toutes={toutes} marge={marge} executer={executer} enCours={enCours} />

      <div className="tb-bloc">
        <h3>Prix</h3>
        <p>{d.source === "manuel" ? "Prix convenu" : `Estimation du site : ${typeof d.prixEstime === "number" ? d.prixEstime + " ₪" : d.surDevis ? "sur devis" : "aucune"}`}{typeof d.prixFinal === "number" && <> · <strong>{d.source === "manuel" ? "" : "Prix retenu : "}{d.prixFinal} ₪</strong></>}</p>
        {d.pourboire > 0 && <p className="tb-note">Pourboire{d.statut === "terminee" ? "" : " prévu"} : {d.pourboire} ₪ (à part, hors chiffre d'affaires)</p>}
        <div className="tb-prix">
          <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix en ₪" aria-label="Prix en shekels" />
          <button className="tb-bouton" disabled={enCours} onClick={enregistrerPrix}>Enregistrer le prix</button>
        </div>
        {d.statut !== "refusee" && d.statut !== "annulee" && (
          !supp.ouvert ? (
            <button className="tb-retour aj-lien" onClick={() => setSupp({ ...supp, ouvert: true })}>+ Ajouter un supplément (retard, attente, péage…)</button>
          ) : (
            <div className="dm-supp">
              <div className="dm-motifs">
                {["Retard du client", "Attente", "Arrêt en plus", "Péage / parking"].map((m) => (
                  <button key={m} className={"tb-filtre" + (supp.motif === m ? " actif" : "")} onClick={() => setSupp({ ...supp, motif: m })}>{m}</button>
                ))}
              </div>
              <input maxLength={80} value={supp.motif} onChange={(e) => setSupp({ ...supp, motif: e.target.value })} aria-label="Motif du supplément" placeholder="Motif" />
              <input inputMode="decimal" value={supp.montant} onChange={(e) => setSupp({ ...supp, montant: e.target.value })} aria-label="Montant du supplément" placeholder="Montant en ₪" />
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={ajouterSupplement}>Ajouter au prix</button>
                <button className="tb-bouton tb-clair" onClick={() => setSupp({ ...supp, ouvert: false })}>Annuler</button>
              </div>
              <p className="tb-note">Le supplément s'ajoute au prix retenu et reste noté dans l'historique du prix. Préviens le client avant (aucun supplément surprise).</p>
            </div>
          )
        )}
        {historique.length > 0 && (
          <ul className="tb-histo">
            {historique.map((h, i) => (
              <li key={i}>{h.de == null ? "—" : h.de + " ₪"} → {h.vers} ₪{h.motif ? ` · ${h.motif}` : ""} <small>({new Date(h.leMs).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })})</small></li>
            ))}
          </ul>
        )}
      </div>

      <PaiementsCourse d={d} />

      {d.statut === "terminee" && !d.uid && <Remerciement prenom={prenomDe(d.nom)} telephone={d.telephone} email="" />}

      <div className="tb-bloc">
        <h3>Itinéraires</h3>
        {adressesDe(d).length === 0 && <p className="tb-note">Aucune adresse enregistrée.</p>}
        {adressesDe(d).map((a) => (
          <div className="tb-adresse" key={a.cle}>
            <div>
              <small>{a.nom}</small>
              <p dir="auto">{a.label}</p>
            </div>
            <a className="tb-bouton tb-clair" href={lienWaze(typeof a.lat === "number" && typeof a.lon === "number" ? { lat: a.lat, lon: a.lon } : { adresse: a.label })} target="_blank" rel="noopener noreferrer">Waze</a>
          </div>
        ))}
        {typeof d.kmEstime === "number" && <p className="tb-note">Distance estimée : {Math.round(d.kmEstime * 10) / 10} km{typeof d.minutesEstimees === "number" ? ` · ${Math.round(d.minutesEstimees)} min` : ""}</p>}
      </div>

      <div className="tb-bloc">
        <h3>Demande complète</h3>
        <pre className="tb-message" dir="auto">{d.message}</pre>
        <p className="tb-note">Reçue le {recueLe(d)}</p>
      </div>

      {avertissement && <p className="dm-verif dm-alerte" role="alert">{avertissement}</p>}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
    </section>
  );
}

export default function Demandes({ aller, cible, membre = null }) {
  const { moi } = useEquipeContexte();
  const [personne, setPersonne] = useState("tous");
  const [items, setItems] = useState(null); // null = chargement
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("en attente");
  const [activite, setActivite] = useState("toutes");
  // cible « nouvelle » ou « nouvelle:cleClient » : ouvre directement l'ajout d'une course
  const nouvelle = typeof cible === "string" && cible.startsWith("nouvelle");
  const [ouvert, setOuvert] = useState(nouvelle ? null : cible || null);
  const [ajout, setAjout] = useState(nouvelle ? { cle: cible.split(":")[1] || null } : null);
  const [marge, setMarge] = useState(MARGE_DEFAUT);
  const [rattrapage, setRattrapage] = useState({ enCours: false, message: "" });

  useEffect(() => {
    const q = query(collection(db, "demandes"), orderBy("creeLe", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setErreur("Impossible de lire les demandes. Vérifiez la connexion et les règles Firebase.")
    );
  }, []);

  // Marge entre deux courses : reglage modifiable (onglet Reglages), 30 min par defaut
  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "enchainement"),
        (s) => {
          const m = s.exists() ? Number(s.data().margeMinutes) : NaN;
          setMarge(Number.isFinite(m) && m >= 0 && m <= 180 ? m : MARGE_DEFAUT);
        },
        () => setMarge(MARGE_DEFAUT)
      ),
    []
  );

  // Un coequipier ne voit que les services de ses activites (J2/J3) ; Rebecca voit tout
  const sesServices = membre ? servicesDuMembre(membre) : null;
  const dansActivite = (d) => (!sesServices || sesServices.includes(d.service)) && (activite === "toutes" || ACTIVITE_DE[d.service] === activite) && filtrerPersonne([d], personne, moi).length === 1;

  const compte = useMemo(() => {
    const c = { tout: 0 };
    for (const d of items || []) {
      if (!dansActivite(d)) continue;
      c.tout += 1;
      c[d.statut] = (c[d.statut] || 0) + 1;
    }
    return c;
  }, [items, activite, personne]); // eslint-disable-line react-hooks/exhaustive-deps

  const rattraper = async () => {
    setRattrapage({ enCours: true, message: "" });
    try {
      const n = await rattraperTousLesSuivis(items || []);
      setRattrapage({ enCours: false, message: n === 0 ? "Tout est déjà à jour." : `${n} historique${n > 1 ? "s" : ""} client mis à jour.` });
    } catch {
      setRattrapage({ enCours: false, message: "Mise à jour impossible. Vérifie la connexion puis réessaie." });
    }
  };

  if (erreur) return <p className="admin-erreur tb-pad" role="alert">{erreur}</p>;
  if (items === null) return <p className="admin-texte tb-pad">Chargement des demandes…</p>;

  if (ajout) {
    return (
      <AjoutManuel
        mode="course"
        demandes={items}
        marge={marge}
        cleInitiale={ajout.cle}
        onFermer={() => setAjout(null)}
        onOuvrirDemande={(id) => {
          setAjout(null);
          setOuvert(id);
        }}
        onOuvrirFiche={(cle) => aller("clients", cle)}
      />
    );
  }

  const courante = ouvert && items.find((d) => d.id === ouvert);
  if (courante) return <Detail key={courante.id} d={courante} toutes={items} marge={marge} aller={aller} onFermer={() => setOuvert(null)} />;

  const visibles = items.filter((d) => dansActivite(d) && (filtre === "tout" || d.statut === filtre));

  return (
    <section className="tb-liste">
      {ouvert && <p className="tb-note">Cette demande est introuvable.</p>}
      <button className="tb-bouton am-ajouter" onClick={() => setAjout({ cle: null })}>+ Ajouter une course</button>
      <div className="tb-filtres" role="tablist" aria-label="Filtrer par activité">
        {ACTIVITES.map((a) => (
          <button key={a.id} role="tab" aria-selected={activite === a.id} className={"tb-filtre dm-activite" + (activite === a.id ? " actif" : "")} onClick={() => setActivite(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <FiltrePersonne valeur={personne} changer={setPersonne} />
      <div className="tb-filtres" role="tablist" aria-label="Filtrer les demandes">
        {Object.entries(STATUTS).map(([id, s]) => (
          <button key={id} role="tab" aria-selected={filtre === id} className={"tb-filtre" + (filtre === id ? " actif" : "")} onClick={() => setFiltre(id)}>
            {s.label} <span>{compte[id] || 0}</span>
          </button>
        ))}
        <button role="tab" aria-selected={filtre === "tout"} className={"tb-filtre" + (filtre === "tout" ? " actif" : "")} onClick={() => setFiltre("tout")}>
          Toutes <span>{compte.tout}</span>
        </button>
      </div>

      {visibles.length === 0 && <p className="admin-texte tb-pad">Aucune demande dans cette catégorie.</p>}

      {visibles.map((d) => {
        const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
        return (
          <button key={d.id} className="tb-carte" onClick={() => setOuvert(d.id)}>
            <span className="tb-ligne">
              <strong><Pastille d={d} /> {d.serviceTitre}</strong>
              <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
            </span>
            <span className="tb-quand">{jour(d.date)} · {d.heure}{d.source === "manuel" ? " · ajoutée à la main" : ""}</span>
            <span className="tb-ligne">
              <span>{d.nom}</span>
              <strong>{textePrix(d)}</strong>
            </span>
          </button>
        );
      })}

      <div className="dm-rattrapage">
        <button className="tb-bouton tb-clair" disabled={rattrapage.enCours} onClick={rattraper}>
          {rattrapage.enCours ? "Mise à jour…" : "Mettre à jour l'historique des clients"}
        </button>
        <p className="tb-note">{rattrapage.message || "Remet à jour ce que les clients voient dans leur historique (statut et prix), pour les anciennes demandes."}</p>
      </div>
    </section>
  );
}
