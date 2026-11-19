import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import RecuCourse from "./components/RecuCourse.jsx";
import { TARIFS } from "./pricing/config.js";
import { validerMouvement } from "./pricing/comptes.js";
import { champOperateur } from "./pricing/reverser.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import { synchroniserSuivi } from "./suiviClient.js";
import { heureArrivee } from "./arrivee.js";
import { getDocs } from "firebase/firestore";
import { normaliserCode, utiliserCarte } from "./pricing/cartesCadeaux.js";
import { comprendreEncaissement } from "./pricing/saisieVocale.js";
import Dicter from "./components/Dicter.jsx";
import { estLivraisonResto, messageAvisResto, messageEnRouteResto, messageMerciResto } from "./pricing/restos.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours } from "./pricing/calendrier.js";
import { SUJETS, envoyerMailClient } from "./mailClient.js";
import { useEssence } from "./EssenceVue.jsx";
import { estBeaute, messagePaiement, messageReprendreRdv } from "./pricing/suiteClient.js";
import {
  ETAPES_CHRONO, apresChamps, duDe, resteDe, avanceRetour, bilanTrajet, champsModifChrono, coutKm, champsAnnulerEtape, champsEtape, chronoDe, encaisseDe, faitDe, messageFin,
  messageAvis, messageEnRoute, messageRappelRetour, peutCocher, preparerEncaissement, prixDe, prochaineEtape, texteMinutes, trajetDe,
} from "./pricing/finCourse.js";
import { sansAttendre } from "./ecritureRapide.js";
const addDocVite = (...a) => sansAttendre(addDoc(...a));
const updateDocVite = (...a) => sansAttendre(updateDoc(...a));

// Fin d'une course directement depuis l'agenda (17 nov. 2026) :
// 📍 Récupérée → ✓ Déposée (= course faite) → 🏠 Rentrée, chacun avec l'heure ;
// 💰 Encaissé : saisie du paiement et du pourboire ; puis le merci WhatsApp deja ecrit selon le cas ;
// rappel de la veille pour le retour d'un aller-retour ; temps passe et ₪ par heure (Rebecca seulement).

const heureIsrael = () => new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
const NOM_TRAJET = { aller: "Aller", retour: "Retour", simple: "" };

// 18 nov. 2026 (suggestion validée) : SUIVI EN DIRECT. Au « 🚗 Partie », position de Rebecca + temps de route (trafic
// Google si possible) jusqu'a l'adresse de prise en charge -> heure d'arrivee prevue, montree a la cliente
// (Mon historique : « arrivée dans 8 min ») et ecrite dans le message « Je suis en route ».
const ORDRE_PRISE = ["depart", "recuperation", "domicile", "adresse", "arrivee", "livraison", "ecole"];
function adresseDePrise(d, trajet) {
  const det = d.details || {};
  const ordre = trajet === "retour" ? [...ORDRE_PRISE].reverse() : ORDRE_PRISE;
  for (const cle of ordre) {
    const a = det[cle];
    if (a && typeof a === "object" && typeof a.lat === "number" && typeof a.lon === "number") return a;
  }
  return null;
}
const calculerArrivee = (d, trajet) => heureArrivee(adresseDePrise(d, trajet));

export default function FinCourseAgenda({ d, aujourdhui }) {
  const { moi } = useEquipeContexte();
  const [mouvements, setMouvements] = useState([]);
  const [caisse, setCaisse] = useState(null); // formulaire « Encaissé » : { recu, pourboire, moyen }
  const [merci, setMerci] = useState(false); // propose le message apres le paiement
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [infoMail, setInfoMail] = useState("");
  const [versTip, setVersTip] = useState("");
  const [compteur, setCompteur] = useState(null); // 17 nov. 2026, 11h38 : kilometrage lu sur le compteur
  const essence = useEssence();
  // 17 nov. 2026, 12h03 : liens de paiement en ligne (Reglages → Paiement en ligne)
  const [liensPaiement, setLiensPaiement] = useState({});
  useEffect(() => onSnapshot(doc(db, "reglages", "paiement"), (x) => setLiensPaiement(x.exists() ? x.data() : {}), () => {}), []);
  const beaute = estBeaute(d);
  const resto = estLivraisonResto(d); // 19 nov. 2026 : livraison d'un restaurant : payée avec son relevé (pas de caisse, merci, avis, reçu)
  // 17 nov. 2026, 11h35 : chaque message part aussi par e-mail si la cliente en a donne un
  const mail = (sujet, texte) => envoyerMailClient(d, sujet, texte).then((x) => x && setInfoMail(x)).catch(() => {});
  const noter = (champs) => updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() }).catch(() => {});
  const envoyerRappel = () => {
    mail(SUJETS.rappel, messageRappelRetour(d, reste));
    noter({ rappelEnvoyeLe: aujourdhui });
  };
  const visible = peutCocher(d, aujourdhui);

  const ecoute = d.statut === "acceptee" || d.statut === "terminee"; // aussi pour le reste du rappel de la veille
  useEffect(() => {
    if (!ecoute) return undefined;
    return onSnapshot(query(collection(db, "mouvements"), where("resId", "==", d.id)), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {});
  }, [d.id, ecoute]);

  const trajet = trajetDe(d);
  const v = d.details || {};
  const reste = resteDe(d, mouvements);
  // Rappel de la veille : sur le retour d'un aller-retour, la veille ou le jour meme, tant qu'il n'est pas fait
  const rappel = !resto && trajet === "retour" && !faitDe(d) && (d.date === ajouterJours(aujourdhui, 1) || d.date === aujourdhui) ? lienWhatsApp(d.telephone, messageRappelRetour(d, reste)) : null;
  const boutonRappel = rappel && (
    <div className="tb-actions">
      <a className="tb-bouton tb-clair" href={rappel} target="_blank" rel="noopener noreferrer" onClick={envoyerRappel}>🔔 Rappel de la veille{d.rappelEnvoyeLe ? " (déjà envoyé)" : ""}</a>
      {infoMail && <small className="tb-note">{infoMail}</small>}
    </div>
  );
  if (!visible) return boutonRappel || null;

  const c = chronoDe(d);
  const suivante = beaute ? (faitDe(d) ? "" : "depose") : prochaineEtape(d); // beaute : un seul « ✓ Fait »
  const fait = faitDe(d);
  const cout = coutKm(essence ? essence.pleins : []);
  const bilan = bilanTrajet(d, cout.parKm);
  const avance = avanceRetour(d, mouvements);
  // 17 nov. 2026, 12h03 : corriger toutes les heures et le compteur apres coup
  const ouvrirCompteur = () => setCompteur(compteur ? null : { depart: c.depart || "", prise: c.prise || "", depose: c.depose || "", maison: c.maison || "", kmDepart: c.kmDepart || "", kmDepose: c.kmDepose || "", kmMaison: c.kmMaison || "" });
  const enregistrerCompteur = async () => {
    const r = champsModifChrono(d, compteur, moi);
    if (r.erreur) return setErreur(r.erreur);
    await enregistrer(r.champs);
    setCompteur(null);
  };
  const lienMerci = lienWhatsApp(d.telephone, resto ? messageMerciResto(d, c.depose || "") : messageFin(d, reste));

  const enregistrer = async (champs) => {
    if (!champs) return;
    setErreur("");
    setEnCours(true);
    try {
      await updateDocVite(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() });
      synchroniserSuivi(apresChamps(d, champs));
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  // Course déposée (ou RDV beauté fait) avec un reste à encaisser : la caisse s'ouvre toute seule, montant déjà rempli
  const cocher = async (etape) => {
    await enregistrer(champsEtape(d, etape, heureIsrael(), moi));
    if (etape === "depose" && reste > 0 && !resto) { setMerci(false); setCaisse(caisseVide()); }
    if (etape === "depart" && !beaute) {
      calculerArrivee(d, trajet)
        .then((h) => h && updateDoc(doc(db, "demandes", d.id), { [`arriveeEstimee.${trajet}`]: h, majLe: serverTimestamp() })
          .then(() => synchroniserSuivi({ ...d, chrono: { ...(d.chrono || {}), [trajet]: { ...((d.chrono || {})[trajet] || {}), depart: heureIsrael() } }, arriveeEstimee: { ...(d.arriveeEstimee || {}), [trajet]: h } })))
        .catch(() => {});
    }
  };
  const lienEnRoute = c.depart && !c.prise ? (resto ? lienWhatsApp(v.telDestinataire || "", messageEnRouteResto(d)) : lienWhatsApp(d.telephone, messageEnRoute(d))) : null;
  const finTrajet = fait && trajet !== "aller";
  const texteSms = messagePaiement(d, reste, liensPaiement);
  const lienPaiement = texteSms ? lienWhatsApp(d.telephone, texteSms) : null;
  const lienRdv = beaute ? lienWhatsApp(d.telephone, messageReprendreRdv(d)) : null;
  const lienAvis = finTrajet && !d.avisDemandeLe ? lienWhatsApp(d.telephone, resto ? messageAvisResto(d) : messageAvis(d)) : null;
  const annuler = () => enregistrer(champsAnnulerEtape(d));

  // 18 nov. 2026 (suggestion validée) : encaisser en un geste. Le moyen choisi par la cliente est proposé d'office.
  const moyenDefaut = TARIFS.moyensEncaissement.includes(d.moyenPaiement) ? d.moyenPaiement : TARIFS.moyensPaiement[0];
  const moyensRapides = [...new Set([moyenDefaut, "Espèces", "Bit"])].filter((m) => TARIFS.moyensEncaissement.includes(m)).slice(0, 3);
  const caisseVide = () => ({ recu: reste > 0 ? String(reste) : "", pourboire: "", ajout: "", moyen: moyenDefaut });
  const ouvrirCaisse = () => {
    setMerci(false);
    setErreur("");
    setCaisse(caisse ? null : caisseVide());
  };
  // 17 nov. 2026, 14h29 : une partie d'un paiement deja saisi etait un pourboire -> correction negative + pourboire
  const passerEnPourboire = async () => {
    const x = Math.round(Number(String(versTip).replace(",", ".")) * 100) / 100;
    if (!(x > 0) || x > encaisseDe(mouvements, d.id)) return setErreur("Montant invalide (pas plus que ce qui a été encaissé).");
    const correction = { kind: "correction", resId: d.id, date: aujourdhui, montant: -x, motif: "Passé en pourboire", ...champOperateur(moi) };
    const err = validerMouvement(correction);
    if (err) return setErreur(err);
    setEnCours(true);
    try {
      await addDocVite(collection(db, "mouvements"), { ...correction, creeLe: serverTimestamp() });
      await updateDocVite(doc(db, "demandes", d.id), { pourboire: Math.round(((Number(d.pourboire) || 0) + x) * 100) / 100, majLe: serverTimestamp() });
      setVersTip("");
      setErreur("");
    } catch {
      setErreur("Correction impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  const encaisser = async (saisie = caisse) => {
    // 19 nov. 2026 (test C6) : carte cadeau choisie sans montant = le reste de la course
    if (saisie && saisie.moyen === "Carte cadeau" && !String(saisie.recu || "").trim() && reste > 0) saisie = { ...saisie, recu: String(reste) };
    const r = preparerEncaissement(d, saisie, aujourdhui);
    // 19 nov. 2026 (test C6) : course déjà payée -> on demande avant d'encaisser une deuxième fois
    if (!r.erreur && r.paiement && reste <= 0 && !window.confirm(`Cette course est déjà entièrement payée. Enregistrer quand même ${r.paiement.montant} ₪ de plus ?`)) return undefined;
    if (r.erreur) return setErreur(r.erreur);
    const paiement = r.paiement ? { ...r.paiement, ...champOperateur(moi) } : null;
    const err = paiement ? validerMouvement(paiement) : "";
    if (err) return setErreur(err);
    setErreur("");
    setEnCours(true);
    try {
      // 18 nov. 2026 : payé avec une carte cadeau -> on retrouve la carte par son code et on baisse son solde
      if (paiement && saisie.moyen === "Carte cadeau") {
        const code = normaliserCode(saisie.code);
        const s = await getDocs(query(collection(db, "cartesCadeaux"), where("code", "==", code)));
        if (s.empty) { setErreur(`Aucune carte cadeau avec le code ${code}.`); setEnCours(false); return; }
        const carte = { id: s.docs[0].id, ...s.docs[0].data() };
        const u = utiliserCarte(carte, paiement.montant, aujourdhui, d.id);
        if (u.erreur) { setErreur(u.erreur); setEnCours(false); return; }
        await updateDocVite(doc(db, "cartesCadeaux", carte.id), { ...u, majLe: serverTimestamp() });
      }
      if (paiement) await addDocVite(collection(db, "mouvements"), { ...paiement, creeLe: serverTimestamp() });
      if (Object.keys(r.champs).length) await updateDocVite(doc(db, "demandes", d.id), { ...r.champs, majLe: serverTimestamp() });
      if (paiement) {
        synchroniserSuivi(d, [...mouvements, paiement]);
        await updateDocVite(doc(db, "demandes", d.id), { recuAFaire: true, recuFaitLe: "", majLe: serverTimestamp() }).catch(() => {});
      }
      setCaisse(null);
      setMerci(true);
      // Merci par e-mail, tout seul, avec le reste a jour
      const resteApres = Math.max(0, Math.round((reste + (r.ajout || 0) - (paiement ? paiement.montant : 0)) * 100) / 100);
      mail(SUJETS.merci, messageFin({ ...d, ...(r.champs || {}) }, resteApres));
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  return (
    <div className="ag-fin">
      <div className="ag-fin-chrono">
        {NOM_TRAJET[trajet] && <small className="ag-fin-trajet">{NOM_TRAJET[trajet]}</small>}
        {ETAPES_CHRONO.map((e) => c[e.id] ? <span key={e.id} className="ag-fin-etape oui">{e.libelle} {c[e.id].replace(":", "h")}</span> : null)}
        {fait && !c.depose && <span className="ag-fin-etape oui">Faite{fait !== "oui" ? " " + fait.replace(":", "h") : ""}</span>}
      </div>
      <div className="tb-actions">
        {suivante && <button type="button" className="tb-bouton" disabled={enCours} onClick={() => cocher(suivante)}>{beaute ? "✓ Fait" : ETAPES_CHRONO.find((e) => e.id === suivante).bouton}</button>}
        {suivante === "depart" && !beaute && <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => cocher("prise")}>📍 Récupérée</button>}
        {lienEnRoute && !beaute && <a className="tb-bouton tb-clair" href={lienEnRoute} target="_blank" rel="noopener noreferrer" onClick={() => !resto && mail(SUJETS.enRoute, messageEnRoute(d))}>💬 Je suis en route{resto ? " (au client)" : ""}</a>}
        {(c.prise || fait || beaute) && !resto && <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={ouvrirCaisse}>{caisse ? "Fermer" : reste > 0 ? `💰 Encaissé (reste ${reste} ₪)` : "💰 Encaissé ✓"}</button>}
        {(c.prise || fait) && <button type="button" className="ag-modifier" disabled={enCours} onClick={annuler}>Annuler la dernière étape</button>}
      </div>
      {trajet === "aller" && v.dateRetour && <p className="tb-note">Retour prévu le {v.dateRetour.split("-").reverse().join("/")}{v.heureRetour ? ` à ${v.heureRetour.replace(":", "h")}` : ""}.</p>}
      {caisse && (
        <div className="ag-etape-actions">
          {reste > 0 && (
            <div className="tb-actions">
              {moyensRapides.map((m) => (
                <button key={m} type="button" className="tb-bouton" disabled={enCours} onClick={() => encaisser({ recu: String(reste), pourboire: "", ajout: "", moyen: m })}>⚡ Payé {reste} ₪ · {m}</button>
              ))}
              {/* 19 nov. 2026 (test C6) : carte cadeau en un geste, il ne reste qu'a taper le code */}
              <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => setCaisse({ recu: String(reste), pourboire: "", ajout: "", moyen: "Carte cadeau", code: "" })}>🎁 Carte cadeau</button>
            </div>
          )}
          <p className="tb-note">Ou en détail (autre montant, pourboire, ajout) :</p>
          <Dicter exemple="Ex. : 85 en espèces, 5 de pourboire" comprendre={comprendreEncaissement} remplir={(r) => setCaisse((c) => ({ ...c, recu: r.recu || c.recu, pourboire: r.pourboire || c.pourboire, ajout: r.ajout || c.ajout, moyen: r.moyen || c.moyen }))} />
          <p className="tb-note">Prix {trajet === "simple" ? "de la course" : "de l'aller-retour"} : {prixDe(d)} ₪{Number(d.ajustement) ? ` (ajout / déduction ${d.ajustement > 0 ? "+" : ""}${d.ajustement} ₪ → ${duDe(d)} ₪)` : ""} · déjà encaissé : {encaisseDe(mouvements, d.id)} ₪ · reste : {reste} ₪</p>
          <label className="ag-champ">Reçu pour la course (₪)<input type="text" inputMode="decimal" value={caisse.recu} onChange={(x) => setCaisse({ ...caisse, recu: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="ag-champ">Ajout / déduction (₪) — supplément pas prévu (ex. 20) ou remise (ex. -20)<input type="text" inputMode="text" value={caisse.ajout} onChange={(x) => setCaisse({ ...caisse, ajout: x.target.value.replace(/[^0-9.,\-−]/g, "") })} placeholder="0" /></label>
          <label className="ag-champ">Pourboire (₪, à part)<input type="text" inputMode="decimal" value={caisse.pourboire} onChange={(x) => setCaisse({ ...caisse, pourboire: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="ag-champ">Moyen de paiement
            <select value={caisse.moyen} onChange={(x) => setCaisse({ ...caisse, moyen: x.target.value })}>
              {TARIFS.moyensEncaissement.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {caisse.moyen === "Carte cadeau" && <label className="ag-champ">Code de la carte cadeau (RS-XXXX-XXXX)<input type="text" autoCapitalize="characters" value={caisse.code || ""} onChange={(x) => setCaisse({ ...caisse, code: x.target.value })} /></label>}
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours} onClick={() => encaisser()}>{enCours ? "Enregistrement…" : "Valider le paiement"}</button>
          </div>
          {encaisseDe(mouvements, d.id) > 0 && (
            <>
              <p className="tb-note">Déjà saisi un pourboire avec le paiement ? Indique combien passer en pourboire{Number(d.pourboire) ? ` (pourboire actuel : ${d.pourboire} ₪)` : ""} :</p>
              <div className="tb-actions">
                <input className="ag-champ-court" type="text" inputMode="decimal" value={versTip} onChange={(x) => setVersTip(x.target.value.replace(/[^0-9.,]/g, ""))} placeholder="ex. 10" style={{ maxWidth: 90 }} />
                <button type="button" className="tb-bouton tb-clair" disabled={enCours || !versTip} onClick={passerEnPourboire}>Passer en pourboire</button>
              </div>
            </>
          )}
        </div>
      )}
      {resto && <p className="tb-note">📋 Livraison de {d.nom} : payée avec son relevé de la semaine (le dimanche).</p>}
      {(resto ? fait : merci || (fait && reste === 0 && !caisse)) && lienMerci && (
        <div className="tb-actions">
          <a className="tb-bouton" href={lienMerci} target="_blank" rel="noopener noreferrer" onClick={() => setMerci(false)}>💬 Envoyer le merci{resto ? " au restaurant" : ""} (WhatsApp)</a>
        </div>
      )}
      {boutonRappel}
      {!resto && reste > 0 && lienPaiement && (
        <div className="tb-actions">
          <a className="tb-bouton tb-clair" href={lienPaiement} target="_blank" rel="noopener noreferrer" onClick={() => mail(SUJETS.paiement, messagePaiement(d, reste, liensPaiement))}>💳 Envoyer le lien de paiement ({reste} ₪)</a>
        </div>
      )}
      {beaute && fait && !d.prochainRdvProposeLe && lienRdv && (
        <div className="tb-actions">
          <a className="tb-bouton tb-clair" href={lienRdv} target="_blank" rel="noopener noreferrer" onClick={() => { mail(SUJETS.rdv, messageReprendreRdv(d)); noter({ prochainRdvProposeLe: aujourdhui }); }}>📅 Proposer le prochain rendez-vous</a>
        </div>
      )}
      {lienAvis && (
        <div className="tb-actions">
          <a className="tb-bouton tb-clair" href={lienAvis} target="_blank" rel="noopener noreferrer" onClick={() => { if (!resto) mail(SUJETS.avis, messageAvis(d)); noter({ avisDemandeLe: aujourdhui }); }}>⭐ Demander un avis{resto ? " au restaurant" : ""}</a>
        </div>
      )}
      {/* 19 nov. 2026, 15h42 : le reçu PDF reste disponible dès qu'un paiement est noté (pas seulement « à faire ») */}
      {!resto && (encaisseDe(mouvements, d.id) > 0 || (d.recuAFaire && !d.recuFaitLe)) && (
        <div className="tb-actions">
          <RecuCourse d={d} />
          {d.recuAFaire && !d.recuFaitLe && <button type="button" className="ag-modifier" onClick={() => noter({ recuFaitLe: aujourdhui })}>🧾 Reçu à faire → c'est fait</button>}
        </div>
      )}
      {infoMail && !boutonRappel && <p className="tb-note">{infoMail}</p>}
      <div className="tb-actions">
        <button type="button" className="ag-modifier" onClick={ouvrirCompteur}>{compteur ? "Fermer" : "✏️ Heures et compteur"}</button>
      </div>
      {compteur && (
        <div className="ag-etape-actions">
          <p className="tb-note">Corrige ou remplis les heures après coup (vide = pas noté).</p>
          {ETAPES_CHRONO.map((e) => (
            <label key={e.id} className="ag-champ">{e.libelle}<input type="time" value={compteur[e.id]} onChange={(x) => setCompteur({ ...compteur, [e.id]: x.target.value })} /></label>
          ))}
          {moi === ADMIN_ID && <p className="tb-note">Compteur km (tes photos ; deux chiffres suffisent) :</p>}
          {moi === ADMIN_ID && [["kmDepart", "Au départ de la maison"], ["kmDepose", "À la dépose (ex. aéroport)"], ["kmMaison", "En rentrant à la maison"]].map(([k, l]) => (
            <label key={k} className="ag-champ">{l}<input type="text" inputMode="numeric" value={compteur[k]} onChange={(x) => setCompteur({ ...compteur, [k]: x.target.value.replace(/\D/g, "") })} placeholder="ex. 45210" /></label>
          ))}
          <div className="tb-actions"><button type="button" className="tb-bouton" disabled={enCours} onClick={enregistrerCompteur}>Enregistrer</button></div>
        </div>
      )}
      {moi === ADMIN_ID && avance > 0 && <p className="tb-note">💼 Déjà payé pour le retour : {avance} ₪ (avance, compté au retour).</p>}
      {moi === ADMIN_ID && (bilan.total != null || bilan.kmReel) && (
        <p className="ag-fin-bilan">
          {bilan.total != null ? "⏱ " : ""}{[bilan.approche != null && `aller chez elle ${texteMinutes(bilan.approche)}`, bilan.course != null && `course ${texteMinutes(bilan.course)}`, bilan.retourMaison != null && `retour maison ${texteMinutes(bilan.retourMaison)}`].filter(Boolean).join(" · ")} {bilan.total != null ? `· total ${texteMinutes(bilan.total)}` : ""}
          {bilan.parHeure ? <><br />💶 {bilan.prix} ₪ → ≈ {bilan.parHeure} ₪/h</> : null}
          {bilan.km > 0 && bilan.gainReel != null ? <><br />⛽ essence ≈ {bilan.essence} ₪ ({bilan.km} km {bilan.kmReel ? "au compteur" : "estimés"}, {cout.parKm} ₪/km d'après {cout.source}) → gain réel {bilan.gainReel} ₪ sur ce trajet{bilan.gainReelParHeure ? ` · ≈ ${bilan.gainReelParHeure} ₪/h` : ""}</> : null}
        </p>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}
