import { abonnementsDus, courseAbonnement, messageAbonnement, nomMois } from "./pricing/abonnement.js";
import { useRepertoire } from "./repertoireBase.js";
import { lienPaye } from "./pricing/suiteClient.js";
import { exportARappeler } from "./pricing/statistiques.js";
import { retourAutreJour } from "./pricing/enchainement.js";
import { Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import { ADMIN_ID, attribueA } from "./pricing/equipe.js";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { avisADemander, messageAvis, messageRappelRetour, messageRelance, rappelsDemain, recusAFaire, relancesClientes, resteDe } from "./pricing/finCourse.js";
import { SUJETS, envoyerMailClient } from "./mailClient.js";
import { messageRappelRdv, messageRelanceEpoxy, rappelsRdvDemain, relancesEpoxy } from "./pricing/suiteClient.js";
import { addDoc, setDoc, where as ou } from "firebase/firestore";
import { champOperateur } from "./pricing/reverser.js";
import { synchroniserSuivi } from "./suiviClient.js";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { lienAppel, lienWaze, lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours } from "./pricing/calendrier.js";
import { situationCourse } from "./pricing/comptes.js";
import InfoVol from "./components/InfoVol.jsx";
import { texteDuree } from "./pricing/circulation.js";

// Onglet « Aujourd'hui » de l'espace prive : ce que Rebecca doit faire dans la journee.
// Lecture seule : rien n'est modifie ici. Un appui sur une ligne ouvre la demande.
// B7 : bouton « + Ajouter une course » ; une demande en attente dont la date est passee affiche « Date passée ».

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

const jourLong = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);
const shekels = (n) => Math.round(n).toLocaleString("fr-FR") + " ₪";
const textePrix = (d) => {
  const p = prixDe(d);
  if (p != null) return shekels(p);
  return d.surDevis ? "Sur devis" : "À fixer";
};

const recueIlYa = (d) => {
  const t = d.creeLe && d.creeLe.toDate ? d.creeLe.toDate().getTime() : null;
  if (!t) return "à l'instant";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? "s" : ""}`;
};

// Premiere adresse utile de la course (prise en charge), pour Waze
const ORDRE_DEPART = ["depart", "recuperation", "domicile", "adresse", "arrivee", "livraison", "ecole"];
function premiereAdresse(d) {
  const det = d.details || {};
  for (const cle of ORDRE_DEPART) {
    const a = det[cle];
    if (a && typeof a === "object" && a.label) return a;
  }
  return null;
}

const ETATS = {
  acompte_a_recevoir: { label: "Acompte à recevoir", classe: "attente" },
  confirmee: { label: "Confirmée", classe: "acceptee" },
  terminee: { label: "Terminée", classe: "terminee" },
  "en attente": { label: "En attente", classe: "attente" },
};

function Ligne({ d, sous, droite, badge, onOuvrir }) {
  return (
    <button className="tb-carte" onClick={() => onOuvrir(d.id)}>
      <span className="tb-ligne">
        <strong><Pastille d={d} /> {d.serviceTitre}</strong>
        {badge && <span className={"tb-badge tb-" + badge.classe}>{badge.label}</span>}
      </span>
      <span className="tb-quand">{sous}</span>
      <span className="tb-ligne">
        <span>{d.nom}</span>
        <strong>{droite}</strong>
      </span>
    </button>
  );
}

function CourseDuJour({ d, sit, onOuvrir }) {
  const a = premiereAdresse(d);
  const appel = lienAppel(d.telephone);
  const enRoute = lienWhatsApp(d.telephone, `Bonjour ${d.nom}, je suis en route pour votre rendez-vous de ${d.heure}. À tout de suite, Rebecca.`);
  const etat = ETATS[sit.etat] || { label: sit.etat, classe: "attente" };
  return (
    <div className="aj-course">
      <button className="aj-course-tete" onClick={() => onOuvrir(d.id)}>
        <span className="aj-heure">{d.heure}</span>
        <span className="aj-corps">
          <strong><Pastille d={d} /> {d.serviceTitre}</strong>
          <small>{d.nom} · {textePrix(d)}{sit.resteAPayer > 0 && d.statut !== "annulee" ? ` · reste ${shekels(sit.resteAPayer)}` : ""}</small>
          {a && <small dir="auto">{a.label}</small>}
          {typeof d.kmEstime === "number" && typeof d.minutesEstimees === "number" && <small>🚗 Trajet {texteDuree(d.minutesEstimees, d.date, d.heure)}</small>}
          <InfoVol d={d} compact />
        </span>
        <span className={"tb-badge tb-" + etat.classe}>{etat.label}</span>
      </button>
      {d.statut === "acceptee" && (
        <div className="aj-actions">
          {a && (
            <a className="tb-bouton tb-clair" href={lienWaze(typeof a.lat === "number" && typeof a.lon === "number" ? { lat: a.lat, lon: a.lon } : { adresse: a.label })} target="_blank" rel="noopener noreferrer">Waze</a>
          )}
          {enRoute && <a className="tb-bouton tb-clair" href={enRoute} target="_blank" rel="noopener noreferrer">En route</a>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
        </div>
      )}
    </div>
  );
}

// 17 nov. 2026, 11h35 : « À envoyer / à faire » — rappels des retours de demain, avis a demander, recus a faire.
// Un appui sur WhatsApp envoie aussi l'e-mail (si la cliente en a un) et note que c'est fait.
function AFaire({ demandes, mouvements, jour }) {
  const [info, setInfo] = useState("");
  const [commandes, setCommandes] = useState([]);
  useEffect(() => onSnapshot(collection(db, "commandes"), (x) => setCommandes(x.docs.map((y) => ({ id: y.id, ...y.data() }))), () => {}), []);
  // 17 nov. 2026, 16h31 : « J'ai paye » des clientes (PayPal, Bit, Revolut...) -> Rebecca confirme d'un appui
  const [declares, setDeclares] = useState([]);
  useEffect(() => onSnapshot(query(collection(db, "paiementsDeclares"), ou("statut", "==", "a confirmer")), (x) => setDeclares(x.docs.map((y) => ({ id: y.id, ...y.data() }))), () => setDeclares([])), []);
  // 18 nov. 2026 : une cliente peut toucher « J'ai payé » plusieurs fois (ou par plusieurs moyens).
  // Les annonces d'un même paiement (même course, même montant, même sorte) sont regroupées :
  // un seul « Reçu » note UN paiement et range toutes les annonces ; si le paiement est déjà noté, « doublon ».
  const confirmer = async (groupe, moyen) => {
    const p = groupe.annonces[0];
    try {
      if (moyen) {
        const m = { kind: "paiement", resId: p.resId, date: jour, montant: p.montant, moyen, ...champOperateur(ADMIN_ID), creeLe: serverTimestamp() };
        await addDoc(collection(db, "mouvements"), m);
        const d = demandes.find((x) => x.id === p.resId);
        if (d) synchroniserSuivi(d, [...mouvements, m]);
      }
      const statut = moyen ? "confirme" : groupe.dejaNote ? "doublon" : "pas recu";
      await Promise.all(groupe.annonces.map((a, i) => updateDoc(doc(db, "paiementsDeclares", a.id), { statut: moyen && i > 0 ? "doublon" : statut, traiteLe: serverTimestamp() })));
      setInfo(moyen ? `✅ ${p.montant} ₪ par ${moyen} noté dans la course.` : groupe.dejaNote ? "Doublon retiré." : "Marqué « pas reçu ».");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion (et les règles Firebase v18).");
    }
  };
  const groupes = Object.values(
    declares.reduce((acc, p) => {
      const cle = `${p.resId}|${p.montant}|${p.sorte}`;
      (acc[cle] = acc[cle] || { cle, annonces: [] }).annonces.push(p);
      return acc;
    }, {}),
  ).map((g) => {
    const p = g.annonces[0];
    const dejaNote = mouvements.some((m) => m.resId === p.resId && m.kind === "paiement" && Math.abs((Number(m.montant) || 0) - Number(p.montant)) < 0.01);
    return { ...g, dejaNote, moyens: [...new Set(g.annonces.map((a) => a.moyen))] };
  });
  const rdvs = rappelsRdvDemain(demandes, jour);
  const epoxy = relancesEpoxy(commandes, jour);
  const rappels = rappelsDemain(demandes, jour);
  const avis = avisADemander(demandes, jour);
  const recus = recusAFaire(demandes);
  const relances = relancesClientes(demandes, jour);
  if (!rappels.length && !avis.length && !recus.length && !relances.length && !rdvs.length && !epoxy.length && !declares.length) return null;
  const noter = (d, champs) => updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() }).catch(() => {});
  const envoyer = (d, sujet, texte, champs) => {
    noter(d, champs);
    // 17 nov. 2026 : rappel deja parti tout seul par e-mail la veille au soir -> pas de deuxieme e-mail
    if (d.rappelMailAutoLe && champs && champs.rappelEnvoyeLe) return setInfo("📧 L'e-mail de rappel est déjà parti tout seul (19h).");
    envoyerMailClient(d, sujet, texte).then((x) => x && setInfo(x)).catch(() => {});
  };
  return (
    <div className="tb-bloc">
      <h3>À envoyer / à faire</h3>
      {rappels.length > 0 && <p className="aj-sous-titre">🔔 Rappels pour les retours de demain</p>}
      {rappels.map((d) => {
        const texte = messageRappelRetour(d, resteDe(d, mouvements));
        const wa = lienWhatsApp(d.telephone, texte);
        return (
          <div key={"r" + d.id} className="tb-adresse">
            <div><p>{d.nom}</p><small>Retour {String(d.details.heureRetour || "").replace(":", "h")}{d.details.numeroVolRetour ? ` · vol ${d.details.numeroVolRetour}` : ""}</small></div>
            {wa ? <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => envoyer(d, SUJETS.rappel, texte, { rappelEnvoyeLe: jour })}>Envoyer</a> : <button className="tb-bouton tb-clair" onClick={() => envoyer(d, SUJETS.rappel, texte, { rappelEnvoyeLe: jour })}>Par e-mail</button>}
          </div>
        );
      })}
      {declares.length > 0 && <p className="aj-sous-titre">💳 Paiements annoncés par les clientes — à confirmer</p>}
      {groupes.map((g) => {
        const p = g.annonces[0];
        const d = demandes.find((x) => x.id === p.resId);
        const derniere = g.annonces.reduce((a, b) => ((b.creeLe && b.creeLe.toMillis ? b.creeLe.toMillis() : 0) > (a.creeLe && a.creeLe.toMillis ? a.creeLe.toMillis() : 0) ? b : a), p);
        const quand = derniere.creeLe && derniere.creeLe.toDate ? derniere.creeLe.toDate().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        return (
          <div key={"p" + g.cle} className="tb-adresse">
            <div>
              <p>{d ? d.nom : p.prenom || "Cliente"} · {p.montant} ₪ par {g.moyens.join(" ou ")}</p>
              <small>{p.sorte === "acompte" ? "Acompte" : "Paiement"} · {d ? `${d.serviceTitre} · ${jourCourt(d.date)}` : "course introuvable"}{quand ? ` · annoncé le ${quand}` : ""}{g.annonces.length > 1 ? ` · annoncé ${g.annonces.length} fois (un seul paiement)` : ""}</small>
              {g.dejaNote && <small><br />✓ Un paiement de {p.montant} ₪ est déjà noté dans cette course : c'est sûrement un doublon.</small>}
            </div>
            <div className="tb-actions">
              {g.dejaNote ? (
                <button className="tb-bouton" onClick={() => confirmer(g, "")}>Retirer le doublon</button>
              ) : (
                <>
                  {g.moyens.map((m) => (
                    <button key={m} className="tb-bouton" disabled={!d} onClick={() => confirmer(g, m)}>✓ Reçu{g.moyens.length > 1 ? ` par ${m}` : ""}</button>
                  ))}
                  <button className="tb-bouton tb-clair" onClick={() => confirmer(g, "")}>Pas reçu</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {rdvs.length > 0 && <p className="aj-sous-titre">💅 Rendez-vous de demain à rappeler</p>}
      {rdvs.map((d) => {
        const texte = messageRappelRdv(d);
        const wa = lienWhatsApp(d.telephone, texte);
        return (
          <div key={"b" + d.id} className="tb-adresse">
            <div><p>{d.nom}</p><small>{d.serviceTitre} · {String(d.heure || "").replace(":", "h")}</small></div>
            {wa ? <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => envoyer(d, SUJETS.rappelRdv, texte, { rappelEnvoyeLe: jour })}>Envoyer</a> : <button className="tb-bouton tb-clair" onClick={() => envoyer(d, SUJETS.rappelRdv, texte, { rappelEnvoyeLe: jour })}>Par e-mail</button>}
          </div>
        );
      })}
      {epoxy.length > 0 && <p className="aj-sous-titre">✨ Clientes Epoxy à relancer (commande il y a 2 à 3 mois)</p>}
      {epoxy.map((c) => {
        const texte = messageRelanceEpoxy(c);
        const wa = lienWhatsApp(c.telephone, texte);
        const noterC = () => updateDoc(doc(db, "commandes", c.id), { relanceLe: jour, majLe: serverTimestamp() }).catch(() => {});
        return (
          <div key={"e" + c.id} className="tb-adresse">
            <div><p>{c.nom}</p><small>{c.produit}</small></div>
            <div className="tb-actions">
              {wa && <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => { noterC(); envoyerMailClient(c, SUJETS.relance, texte).then((x) => x && setInfo(x)).catch(() => {}); }}>Envoyer</a>}
              <button className="tb-bouton tb-clair" onClick={noterC}>Pas pour elle</button>
            </div>
          </div>
        );
      })}
      {avis.length > 0 && <p className="aj-sous-titre">⭐ Demander un avis</p>}
      {avis.map((d) => {
        const texte = messageAvis(d);
        const wa = lienWhatsApp(d.telephone, texte);
        return (
          <div key={"a" + d.id} className="tb-adresse">
            <div><p>{d.nom}</p><small>{d.serviceTitre} · {jourCourt(d.date)}</small></div>
            <div className="tb-actions">
              {wa && <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => envoyer(d, SUJETS.avis, texte, { avisDemandeLe: jour })}>Envoyer</a>}
              <button className="tb-bouton tb-clair" onClick={() => noter(d, { avisDemandeLe: jour })}>Pas pour elle</button>
            </div>
          </div>
        );
      })}
      {relances.length > 0 && <p className="aj-sous-titre">💌 Clientes à relancer (dernière course il y a 1 à 2 mois)</p>}
      {relances.map((d) => {
        const texte = messageRelance(d);
        const wa = lienWhatsApp(d.telephone, texte);
        return (
          <div key={"l" + d.id} className="tb-adresse">
            <div><p>{d.nom}</p><small>{d.serviceTitre} · {jourCourt(d.date)}</small></div>
            <div className="tb-actions">
              {wa && <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => envoyer(d, SUJETS.relance, texte, { relanceLe: jour })}>Envoyer</a>}
              <button className="tb-bouton tb-clair" onClick={() => noter(d, { relanceLe: jour })}>Pas pour elle</button>
            </div>
          </div>
        );
      })}
      {recus.length > 0 && <p className="aj-sous-titre">🧾 Reçus à faire</p>}
      {recus.map((d) => (
        <div key={"q" + d.id} className="tb-adresse">
          <div><p>{d.nom}</p><small>{d.serviceTitre} · {jourCourt(d.date)} · payé {shekels(Math.max(0, prixDe(d) - resteDe(d, mouvements)))}</small></div>
          <button className="tb-bouton tb-clair" onClick={() => noter(d, { recuFaitLe: jour })}>C'est fait</button>
        </div>
      ))}
      {recus.length > 0 && <p className="tb-note">Fais le reçu dans ton application de reçus (osek patur), puis appuie sur « C'est fait ».</p>}
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

// 18 nov. 2026 (suggestion validée) : abonnement mensuel du ramassage dû ce mois-ci
function AbonnementsDuMois({ demandes, mouvements, jour }) {
  const { familles = [] } = useRepertoire();
  const [info, setInfo] = useState("");
  const dus = abonnementsDus(familles, jour)
    .map((a) => ({ ...a, d: demandes.find((x) => x.id === a.id) }))
    .filter((a) => !a.d || resteDe(a.d, mouvements) > 0);
  if (!dus.length) return null;
  const preparer = async (a) => {
    const c = courseAbonnement(a.famille, a.mois);
    if (!c) return setInfo(`Ajoute le téléphone de ${a.famille.nom || "la famille"} dans sa fiche (Répertoire).`);
    try {
      await setDoc(doc(db, "demandes", a.id), { ...c, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      setInfo(`Abonnement de ${a.famille.nom} : ${a.montant} ₪ à encaisser ✓`);
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
  };
  return (
    <section className="tdb-bloc">
      <p className="aj-sous-titre">🚸 Abonnements du ramassage à encaisser</p>
      {dus.map((a) => {
        const reste = a.d ? resteDe(a.d, mouvements) : a.montant;
        const lien = a.d ? lienWhatsApp(a.famille.telephone || a.famille.telephone2, messageAbonnement(a.famille, a.mois, reste, lienPaye(a.d, reste, "solde"))) : null;
        return (
          <div key={a.id} className="tb-adresse">
            <div><p>{a.famille.nom} · {nomMois(a.mois)}</p><small>{reste} ₪{a.d ? " · à encaisser" : " · pas encore préparé"}</small></div>
            <div className="tb-actions">
              {!a.d && <button className="tb-bouton" onClick={() => preparer(a)}>Préparer le mois</button>}
              {lien && <a className="tb-bouton" href={lien} target="_blank" rel="noopener noreferrer">Envoyer le rappel</a>}
            </div>
          </div>
        );
      })}
      {info && <p className="tb-note" role="status">{info}</p>}
    </section>
  );
}

// 18 nov. 2026 (suggestion validée) : du 1er au 5 du mois, rappel d'envoyer l'export du mois précédent au comptable
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function RappelComptable({ jour, aller }) {
  const r = exportARappeler(jour);
  const cle = r ? `rs-export-comptable-${r.mois}` : "";
  const [fait, setFait] = useState(() => {
    try {
      return !!(cle && localStorage.getItem(cle));
    } catch {
      return false;
    }
  });
  if (!r || fait) return null;
  const marquer = () => {
    try {
      localStorage.setItem(cle, "1");
    } catch {
      /* sans importance */
    }
    setFait(true);
  };
  return (
    <section className="tdb-bloc">
      <p className="aj-sous-titre">📦 Export de {MOIS_FR[Number(r.mois.slice(5, 7)) - 1]} pour le comptable</p>
      <p className="tb-note">Rapports et exports → choisis « Mois », un jour de {MOIS_FR[Number(r.mois.slice(5, 7)) - 1]}, puis « 📦 Tout pour le comptable ».</p>
      <div className="tb-actions">
        {aller && <button className="tb-bouton" onClick={() => aller("rapports")}>Ouvrir les rapports</button>}
        <button className="tb-bouton tb-clair" onClick={marquer}>C'est envoyé</button>
      </div>
    </section>
  );
}

export default function Aujourdhui({ aller }) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [jour, setJour] = useState(aujourdhui());

  useEffect(() => {
    const echec = () => setLectureImpossible(true);
    const arrets = [
      onSnapshot(refDemandes(orderBy("creeLe", "desc")), (s) => setDemandes(trierDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() })))), echec),
      onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec),
    ];
    return () => arrets.forEach((a) => a());
  }, []);

  // Changement de jour a minuit (heure d'Israel) si l'ecran reste ouvert
  useEffect(() => {
    const id = setInterval(() => setJour(aujourdhui()), 60000);
    return () => clearInterval(id);
  }, []);

  const ouvrir = (id) => aller("demandes", id);
  const demain = ajouterJours(jour, 1);

  // 12 nov. 2026 : un coequipier ne voit que SES courses (et les nouvelles demandes a prendre, et ses propositions)
  const { moi } = useEquipeContexte();
  const equipier = !!moi && moi !== ADMIN_ID;
  const vue = useMemo(() => {
    if (!demandes || !mouvements) return null;
    const visibles = equipier ? demandes.filter((d) => attribueA(d) === moi || d.proposeA === moi || (d.statut === "en attente" && !d.attribueA)) : demandes;
    const avecSit = visibles.map((d) => ({
      d,
      sit: situationCourse({ id: d.id, date: d.date, prixConvenu: prixDe(d), statut: d.statut }, mouvements),
    }));
    const parHeure = (a, b) => String(a.d.heure || "").localeCompare(String(b.d.heure || ""));
    const parDate = (a, b) => (String(a.d.date) + String(a.d.heure || "")).localeCompare(String(b.d.date) + String(b.d.heure || ""));

    // Aller-retour : le retour un autre jour compte aussi ce jour-la (16 nov. 2026)
    const avecRetours = avecSit.flatMap((x) => {
      const r = retourAutreJour(x.d);
      return r ? [x, { d: r, sit: x.sit }] : [x];
    });
    const duJour = avecRetours.filter((x) => x.d.date === jour && (x.d.statut === "acceptee" || x.d.statut === "terminee")).sort(parHeure);
    const deDemain = avecRetours.filter((x) => x.d.date === demain && x.d.statut === "acceptee").sort(parHeure);
    const enAttente = avecSit.filter((x) => x.d.statut === "en attente").sort(parDate);
    const aCloturer = avecSit.filter((x) => x.d.statut === "acceptee" && String(x.d.date) < jour).sort(parDate);
    const aEncaisser = avecSit.filter((x) => x.d.statut === "terminee" && x.sit.resteAPayer > 0).sort(parDate);
    const acomptes = avecSit.filter((x) => x.d.statut === "acceptee" && String(x.d.date) >= jour && x.sit.acompte != null && !x.sit.acompteRecu).sort(parDate);
    const totalAEncaisser = aEncaisser.reduce((s, x) => s + x.sit.resteAPayer, 0);
    return { duJour, deDemain, enAttente, aCloturer, aEncaisser, acomptes, totalAEncaisser };
  }, [demandes, mouvements, jour, demain]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (!vue) return <p className="admin-texte tb-pad">Chargement de ta journée…</p>;

  // Badge d'une demande en attente : date passee, ou course dans les 2 jours
  const badgeAttente = (d) => {
    const date = String(d.date);
    if (date < jour) return { label: "Date passée", classe: "annulee" };
    if (date <= ajouterJours(jour, 2)) return { label: "Bientôt", classe: "refusee" };
    return null;
  };

  return (
    <section className="aj">
      <h2 className="aj-date">{jourLong(jour)}</h2>
      <button className="tb-bouton am-ajouter" onClick={() => aller("demandes", "nouvelle")}>+ Ajouter une course</button>

      <div className="aj-resume">
        <button className="aj-chiffre" onClick={() => document.getElementById("aj-jour")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{vue.duJour.length}</strong>
          <small>course{vue.duJour.length > 1 ? "s" : ""} aujourd'hui</small>
        </button>
        <button className={"aj-chiffre" + (vue.enAttente.length ? " alerte" : "")} onClick={() => document.getElementById("aj-attente")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{vue.enAttente.length}</strong>
          <small>demande{vue.enAttente.length > 1 ? "s" : ""} en attente</small>
        </button>
        <button className="aj-chiffre" onClick={() => document.getElementById("aj-argent")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{shekels(vue.totalAEncaisser)}</strong>
          <small>à encaisser</small>
        </button>
      </div>

      <div className="tb-bloc" id="aj-jour">
        <h3>Mes courses du jour</h3>
        {vue.duJour.length === 0 && <p className="tb-note">Aucune course prévue aujourd'hui.</p>}
        {vue.duJour.map((x) => <CourseDuJour key={x.d.id} d={x.d} sit={x.sit} onOuvrir={ouvrir} />)}
        <button className="tb-retour aj-lien" onClick={() => aller("agenda")}>Voir l'agenda →</button>
      </div>

      {vue.deDemain.length > 0 && (
        <div className="tb-bloc">
          <h3>Demain · {jourCourt(demain)}</h3>
          {vue.deDemain.map((x) => (
            <button key={x.d.id} className="aj-mini" onClick={() => ouvrir(x.d.id)}>
              <strong>{x.d.heure}</strong> {x.d.serviceTitre} · {x.d.nom}
              {x.d.service === "aeroport" && <span style={{ display: "block" }}><InfoVol d={x.d} compact /></span>}
            </button>
          ))}
        </div>
      )}

      {!equipier && <RappelComptable jour={jour} aller={aller} />}
      {!equipier && demandes && mouvements && <AbonnementsDuMois demandes={demandes} mouvements={mouvements} jour={jour} />}
      {!equipier && <AFaire demandes={demandes} mouvements={mouvements} jour={jour} />}

      {vue.aCloturer.length > 0 && (
        <div className="tb-bloc aj-alerte">
          <h3>À clôturer ({vue.aCloturer.length})</h3>
          <p className="tb-note">Courses passées encore « acceptées » : ouvre-les pour les marquer terminées et noter le paiement.</p>
          {vue.aCloturer.map((x) => (
            <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={textePrix(x.d)} onOuvrir={ouvrir} />
          ))}
        </div>
      )}

      <div className="tb-bloc" id="aj-attente">
        <h3>Demandes en attente</h3>
        {vue.enAttente.length === 0 && <p className="tb-note">Aucune demande à traiter.</p>}
        {vue.enAttente.map((x) => (
          <Ligne
            key={x.d.id}
            d={x.d}
            sous={`Pour ${jourCourt(x.d.date)} · ${x.d.heure} — reçue ${recueIlYa(x.d)}`}
            droite={textePrix(x.d)}
            badge={badgeAttente(x.d)}
            onOuvrir={ouvrir}
          />
        ))}
      </div>

      <div className="tb-bloc" id="aj-argent">
        <h3>Paiements restants</h3>
        {vue.aEncaisser.length === 0 && vue.acomptes.length === 0 && <p className="tb-note">Tout est encaissé.</p>}
        {vue.aEncaisser.length > 0 && <p className="aj-sous-titre">Courses terminées à encaisser · {shekels(vue.totalAEncaisser)}</p>}
        {vue.aEncaisser.map((x) => (
          <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={"reste " + shekels(x.sit.resteAPayer)} onOuvrir={ouvrir} />
        ))}
        {vue.acomptes.length > 0 && <p className="aj-sous-titre">Acomptes à recevoir</p>}
        {vue.acomptes.map((x) => (
          <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={"acompte " + shekels(x.sit.acompte)} onOuvrir={ouvrir} />
        ))}
      </div>
    </section>
  );
}
