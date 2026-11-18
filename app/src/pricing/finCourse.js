// FIN D'UNE COURSE DEPUIS L'AGENDA (17 nov. 2026) - Rebecca Services
// Dans l'agenda, chaque course acceptee a :
//   « ✓ Fait »     : la course (ou le trajet aller d'un aller-retour) est faite ;
//   « 💰 Encaissé » : saisie directe du paiement (montant, moyen, pourboire a part) ;
//   puis le message de remerciement WhatsApp, deja ecrit selon le cas :
//     - aller simple                      : « Merci de m'avoir fait confiance. Au plaisir de vous revoir. »
//     - aller d'un aller-retour, tout paye : bon vol, on se revoit au retour (date, heure), rappel la veille
//     - aller d'un aller-retour, en partie : pareil + ce qui restera a regler au retour
//     - retour d'un aller-retour          : bon retour, au plaisir de vous revoir
// Aller-retour = UNE demande : l'aller fait est note dans « allerFaitA » ; la demande passe « terminee »
// seulement quand le retour est fait. Aller simple : « terminee » tout de suite.

import { SITE, CODE_BIENVENUE } from "./ajoutManuel.js";
import { TARIFS } from "./config.js";
import { partAller } from "./parts.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^\d{2}:\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const nombre = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export const estAllerRetour = (d) => !!(d && d.details && d.details.typeTrajet === "ar");
// Quel trajet represente cette ligne de l'agenda : "aller", "retour" ou "simple"
export const trajetDe = (d) => (!estAllerRetour(d) ? "simple" : d.estRetour ? "retour" : "aller");

export const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);

// Montant deja encaisse sur la course (paiements + corrections)
export function encaisseDe(mouvements, resId) {
  return cents(
    (mouvements || [])
      .filter((m) => m && m.resId === resId && (m.kind === "paiement" || m.kind === "correction"))
      .reduce((s, m) => s + nombre(m.montant), 0)
  );
}
// 17 nov. 2026, 14h29 : le du compte l'ajout / deduction saisi par Rebecca (d.ajustement)
export const duDe = (d) => cents(prixDe(d) + nombre(d.ajustement));
// 18 nov. 2026 : course payée en espèces au coursier partenaire -> rien à encaisser pour Rebecca
export const resteDe = (d, mouvements) => (d && d.payeAuCoursier ? 0 : cents(Math.max(0, duDe(d) - encaisseDe(mouvements, d.id))));

// Ce trajet est-il deja fait ? Renvoie l'heure ("14:05"), "oui" si fait sans heure connue, ou ""
export function faitDe(d) {
  const t = trajetDe(d);
  if (t === "aller") return d.allerFaitA || (d.statut === "terminee" ? "oui" : "");
  if (d.statut === "terminee") return (t === "retour" ? d.retourFaitA : d.faitA) || "oui";
  return "";
}

// On peut cocher « ✓ Fait » : course acceptee (ou deja faite, pour annuler), jour du trajet atteint
export function peutCocher(d, aujourdhui) {
  if (!d || !DATE_OK.test(d.date || "") || !DATE_OK.test(aujourdhui || "")) return false;
  if (d.statut !== "acceptee" && d.statut !== "terminee") return false;
  return d.date <= aujourdhui;
}

// Champs a enregistrer dans la demande quand on coche « ✓ Fait »
export function champsFait(d, heure, quiFait = "rebecca") {
  const h = HEURE_OK.test(heure || "") ? heure : "";
  const fin = { statut: "terminee", realisePar: d.attribueA || quiFait || "rebecca" };
  const t = trajetDe(d);
  if (t === "aller") return { allerFaitA: h || "oui" };
  if (t === "retour") return { ...fin, retourFaitA: h || "oui", ...(d.allerFaitA ? {} : { allerFaitA: "oui" }) };
  return { ...fin, faitA: h || "oui" };
}

// Champs a enregistrer quand on decoche (erreur de manipulation)
export function champsPasFait(d) {
  const t = trajetDe(d);
  if (t === "aller") return d.statut === "terminee" ? { statut: "acceptee", allerFaitA: "", retourFaitA: "" } : { allerFaitA: "" };
  if (t === "retour") return { statut: "acceptee", retourFaitA: "" };
  return { statut: "acceptee", faitA: "" };
}

// Paiement saisi depuis l'agenda : { recu (pour la course), pourboire } -> ligne de paiement + pourboire
export function preparerEncaissement(d, { recu, pourboire, moyen, ajout }, date) {
  const lire = (x) => {
    const t = String(x == null ? "" : x).trim().replace(",", ".");
    if (t === "") return 0;
    const n = Number(t);
    return Number.isFinite(n) ? cents(n) : NaN;
  };
  const montant = lire(recu);
  const tip = lire(pourboire);
  const plus = lire(String(ajout == null ? "" : ajout).replace("−", "-"));
  if (!Number.isFinite(plus) || Math.abs(plus) > 5000) return { erreur: "Ajout / déduction invalide (ex. 20 ou -20)." };
  if (!Number.isFinite(montant) || montant < 0 || montant > 100000) return { erreur: "Montant reçu invalide." };
  if (!Number.isFinite(tip) || tip < 0 || tip > 5000) return { erreur: "Pourboire invalide." };
  if (montant === 0 && tip === 0 && plus === 0) return { erreur: "Indique ce que tu as reçu." };
  if (montant > 0 && !moyen) return { erreur: "Choisis le moyen de paiement." };
  if (!DATE_OK.test(date || "")) return { erreur: "Date invalide." };
  const paiement = montant > 0 ? { kind: "paiement", resId: d.id, date, montant, moyen } : null;
  const champs = tip > 0 ? { pourboire: cents(nombre(d.pourboire) + tip) } : {};
  if (plus !== 0) Object.assign(champs, { ajustement: cents(nombre(d.ajustement) + plus), ajustementLe: date });
  return { erreur: "", paiement, champs, montant, pourboire: tip, ajout: plus };
}

const jourLong = (date) => {
  if (!DATE_OK.test(date || "")) return "";
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const heureFr = (h) => String(h || "").replace(":", "h");
const prenomDe = (nom) => String(nom || "").trim().split(/\s+/)[0] || "";
const bonjour = (d) => (prenomDe(d.nom) ? `Bonjour ${prenomDe(d.nom)},` : "Bonjour,");
// 18 nov. 2026 (suggestion validée) : lien « Laisser un avis Google » réglé par Rebecca (Réglages → Paiements)
let LIEN_AVIS_GOOGLE = "";
export const definirLienAvisGoogle = (l) => {
  LIEN_AVIS_GOOGLE = /^https:\/\/\S+$/.test(String(l || "").trim()) ? String(l).trim() : "";
};
export const ligneAvisGoogle = () => (LIEN_AVIS_GOOGLE ? [`⭐ Un petit avis Google m'aiderait beaucoup : ${LIEN_AVIS_GOOGLE}`] : []);
// 17 nov. 2026, 11h33 : le lien du site dans TOUS les messages ; sans compte, l'invitation a creer son compte
export function lignesSite(d, site = SITE) {
  if (d && d.uid) return [`Retrouvez-moi sur mon site : ${site}`];
  return [`N'hésitez pas à créer votre compte sur mon site avec ce numéro de téléphone : ${site}`, `Code ${CODE_BIENVENUE} : -10 ₪ sur votre prochaine réservation.`];
}
const heureMaintenant = () => new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
const versAeroport = (d) => d.service === "aeroport" && (d.details || {}).direction !== "depuis";

// Message de remerciement apres le paiement. reste = ce qui reste a payer sur toute la course.
export function messageMerci(d, reste = 0) {
  const t = trajetDe(d);
  const v = d.details || {};
  const lignes = [bonjour(d), "Merci de m'avoir fait confiance 🙏"];
  if (t === "aller") {
    lignes.push(versAeroport(d) ? "Bon vol et bon séjour ! ✈️" : "Bon séjour !");
    const quand = [jourLong(v.dateRetour || d.date), v.heureRetour ? `à ${heureFr(v.heureRetour)}` : ""].filter(Boolean).join(" ");
    lignes.push(`On se revoit à votre retour${quand ? `, le ${quand}` : ""}. Je vous enverrai un petit rappel la veille pour reconfirmer.`);
    if (reste > 0) lignes.push(`Il restera ${cents(reste)} ₪ à régler au retour.`);
  } else if (t === "retour") {
    lignes.push("Bon retour à la maison ! Au plaisir de vous revoir.");
  } else {
    lignes.push("Au plaisir de vous revoir.");
  }
  if (t !== "aller") lignes.push(...ligneAvisGoogle());
  lignes.push(...lignesSite(d), "Rebecca");
  return lignes.join("\n");
}

// Rappel de la veille pour le retour d'un aller-retour
export function messageRappelRetour(d, reste = 0) {
  const v = d.details || {};
  const date = d.estRetour ? d.date : v.dateRetour;
  const heure = d.estRetour ? d.heure : v.heureRetour;
  const lignes = [
    bonjour(d),
    `Petit rappel : je viens vous chercher ${date ? `le ${jourLong(date)}` : "à votre retour"}${heure ? ` à ${heureFr(heure)}` : ""}${v.numeroVolRetour ? ` (vol ${v.numeroVolRetour})` : ""}.`,
    "Vous me confirmez ? Prévenez-moi en cas de changement d'horaire.",
  ];
  if (reste > 0) lignes.push(`Reste à régler : ${cents(reste)} ₪.`);
  lignes.push(...lignesSite(d), "À demain, Rebecca");
  return lignes.join("\n");
}

/* ---------- Chrono du trajet (17 nov. 2026, 11h30) ----------
   Pour chaque trajet (aller, retour ou simple), trois boutons dans l'ordre, chacun note l'heure :
     « 📍 Récupérée »  (prise en charge, ex. a domicile)
     « ✓ Déposée »     (ex. a l'aeroport) = la course est faite (champsFait)
     « 🏠 Rentrée »     (retour a la maison)
   Rangement : demande.chrono = { aller: { prise, depose, maison }, retour: {...}, simple: {...} }
   But : voir le temps passe a chaque fois et la rentabilite (₪ par heure) — pour Rebecca seulement. */

export const ETAPES_CHRONO = [
  { id: "depart", bouton: "🚗 Partie", libelle: "Partie" }, // 17 nov. 2026, 11h35 : le trajet maison -> cliente compte aussi
  { id: "prise", bouton: "📍 Récupérée", libelle: "Récupérée" },
  { id: "depose", bouton: "✓ Déposée", libelle: "Déposée" },
  { id: "maison", bouton: "🏠 Rentrée", libelle: "Rentrée à la maison" },
];

export const chronoDe = (d) => ((d && d.chrono) || {})[trajetDe(d)] || {};

// Prochaine etape a cocher : "prise", "depose", "maison" ou "" (tout est fait)
export function prochaineEtape(d) {
  const c = chronoDe(d);
  const fait = faitDe(d);
  if (!c.depart && !c.prise && !fait) return "depart";
  if (!c.prise && !fait) return "prise";
  if (!c.depose && !fait) return "depose";
  if (!c.maison) return "maison";
  return "";
}

// Champs a enregistrer pour une etape (chemin « chrono.aller.prise »), + fin de course a « Déposée »
export function champsEtape(d, etape, heure, quiFait = "rebecca") {
  if (!ETAPES_CHRONO.some((e) => e.id === etape) || !HEURE_OK.test(heure || "")) return null;
  const champs = { [`chrono.${trajetDe(d)}.${etape}`]: heure };
  if (etape === "depose" || (etape === "maison" && !faitDe(d))) Object.assign(champs, champsFait(d, heure, quiFait));
  return champs;
}

// Annuler la derniere etape cochee (erreur de manipulation)
export function champsAnnulerEtape(d) {
  const c = chronoDe(d);
  const t = trajetDe(d);
  const derniere = [...ETAPES_CHRONO].reverse().find((e) => c[e.id]);
  if (!derniere) return faitDe(d) ? champsPasFait(d) : null;
  const champs = { [`chrono.${t}.${derniere.id}`]: "" };
  if (derniere.id === "depose" || (derniere.id === "maison" && !c.depose)) Object.assign(champs, champsPasFait(d));
  return champs;
}

const minutesDe = (h) => (HEURE_OK.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
const ecart = (a, b) => {
  const x = minutesDe(a);
  const y = minutesDe(b);
  if (x == null || y == null) return null;
  return y >= x ? y - x : y + 24 * 60 - x; // passe minuit
};
export const texteMinutes = (m) => (m == null ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);

// Prix de CE trajet : aller-retour = moitie du prix chacun
// 17 nov. 2026, 14h27 : aller et retour d'apres le detail du devis (ex. 250 / 260 avec un bagage au retour)
export const prixTrajet = (d) => (!estAllerRetour(d) ? cents(prixDe(d)) : d.estRetour ? cents(prixDe(d) - partAller(d)) : partAller(d));

// Temps passes et rentabilite du trajet
export function bilanTrajet(d, parKm = null) {
  const c = chronoDe(d);
  const approche = ecart(c.depart, c.prise);
  const course = ecart(c.prise, c.depose);
  const retourMaison = ecart(c.depose, c.maison);
  const total = ecart(c.depart || c.prise, c.maison);
  const prix = prixTrajet(d);
  const parHeure = total && total > 0 && prix > 0 ? Math.round((prix * 60) / total) : null;
  const ess = essenceTrajet(d, CARBURANT, parKm);
  const gainReel = prix > 0 ? cents(prix - ess.essence) : null;
  return { approche, course, retourMaison, total, prix, parHeure, km: ess.km, kmReel: ess.kmReel, essence: ess.essence, gainReel, gainReelParHeure: total && total > 0 && gainReel != null ? Math.round((gainReel * 60) / total) : null };
}

/* ---------- Essence et gain reel d'un trajet (17 nov. 2026, 11h35) ----------
   Estimation : km de la course (kmEstime) x 2 (on compte aussi le trajet a vide : aller chercher / rentrer),
   essence = km x consommation x prix du litre (Reglages carburant). Sans km connus : 0. */
export const CARBURANT = TARIFS.carburant;
// 17 nov. 2026, 11h38 : compteur kilometrique note dans la course (depart, depose, maison) -> km reels ;
// cout du km reel d'apres ses pleins (prix, litres, compteur) si on les a.
export function kmReelTrajet(d) {
  const c = chronoDe(d);
  const lus = ["kmDepart", "kmPrise", "kmDepose", "kmMaison"].map((k) => Number(c[k])).filter((n) => Number.isFinite(n) && n > 0);
  if (lus.length < 2) return null;
  const km = Math.max(...lus) - Math.min(...lus);
  return km > 0 && km < 2000 ? km : null;
}
// Cout d'un km : 2 pleins avec compteur -> litres du 2e / km entre les deux x prix du litre du 2e ;
// sinon prix du litre de son dernier plein x consommation des reglages ; sinon les reglages.
export function coutKm(pleins = [], carburant = CARBURANT) {
  const avecLitres = (pleins || []).filter((p) => p && p.montant > 0 && p.litres > 0).sort((a, b) => (a.compteur || 0) - (b.compteur || 0) || String(a.date).localeCompare(String(b.date)));
  const comptes = avecLitres.filter((p) => p.compteur > 0);
  if (comptes.length >= 2) {
    const [a, b] = comptes.slice(-2);
    const km = b.compteur - a.compteur;
    if (km > 20) return { parKm: Math.round(((b.litres * (b.montant / b.litres)) / km) * 1000) / 1000, source: "tes pleins (compteur)" };
  }
  const dernier = [...avecLitres].sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
  const prixLitre = dernier ? dernier.montant / dernier.litres : carburant.prixLitre;
  return { parKm: Math.round(((carburant.consommationLitres100km / 100) * prixLitre) * 1000) / 1000, source: dernier ? "prix du litre de ton dernier plein" : "réglages" };
}
export function essenceTrajet(d, carburant = CARBURANT, parKm = null) {
  const reel = kmReelTrajet(d);
  const km = reel != null ? reel : Number(d && d.kmEstime) > 0 ? cents(Number(d.kmEstime) * 2) : 0;
  const cout = parKm != null ? parKm : (carburant.consommationLitres100km / 100) * carburant.prixLitre;
  return { km, kmReel: reel != null, essence: cents(km * cout) };
}

/* ---------- Autres messages : en route, avis ---------- */
export function messageEnRoute(d, maintenant = heureMaintenant()) {
  const prevue = HEURE_OK.test(d.heure || "") && d.heure > maintenant ? d.heure : "";
  return [
    bonjour(d),
    `Je suis en route 🚗 ${prevue ? `J'arrive vers ${heureFr(prevue)}.` : "J'arrive dans quelques minutes."}`,
    ...lignesSite(d),
    "À tout de suite, Rebecca",
  ].join("\n");
}
export function messageAvis(d) {
  return [
    bonjour(d),
    "Merci encore de m'avoir fait confiance 🙏",
    d.uid
      ? "Si vous avez un instant, votre avis m'aiderait beaucoup : laissez-moi quelques étoiles dans votre espace, rubrique « Mon historique »."
      : "Si vous avez un instant, votre avis m'aiderait beaucoup : répondez simplement à ce message avec quelques mots.",
    ...ligneAvisGoogle(),
    ...lignesSite(d),
    "Au plaisir de vous revoir, Rebecca",
  ].join("\n");
}

/* ---------- Listes « à envoyer / à faire » pour l'onglet Aujourd'hui ---------- */
const plusJours = (date, n) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n, 12)).toISOString().slice(0, 10);
};
// Retours d'aller-retour prevus demain, rappel pas encore envoye
export function rappelsDemain(demandes, aujourdhui) {
  if (!DATE_OK.test(aujourdhui || "")) return [];
  const demain = plusJours(aujourdhui, 1);
  return (demandes || []).filter((d) => d.statut === "acceptee" && estAllerRetour(d) && (d.details || {}).dateRetour === demain && !d.rappelEnvoyeLe);
}
// Courses finies depuis 1 a 7 jours : demander un avis (une seule fois)
export function avisADemander(demandes, aujourdhui) {
  if (!DATE_OK.test(aujourdhui || "")) return [];
  const debut = plusJours(aujourdhui, -7);
  return (demandes || []).filter((d) => {
    if (d.statut !== "terminee" || d.avisDemandeLe || d.service === "ramassage" || d.service === "digital") return false; // 17 nov. : pas pour un paiement Digital
    const fin = estAllerRetour(d) && DATE_OK.test((d.details || {}).dateRetour || "") ? d.details.dateRetour : d.date;
    return DATE_OK.test(fin || "") && fin >= debut && fin < aujourdhui;
  });
}
// Paiements encaisses depuis l'agenda sans recu fait
export const recusAFaire = (demandes) => (demandes || []).filter((d) => d.recuAFaire && !d.recuFaitLe);

/* ---------- Gain par heure de chaque activite, sur un mois (« Mon mois ») ---------- */
// groupeDe : fonction service -> groupe (monMois.js). Compte seulement les trajets dont le temps est note.
export function rentabiliteDuMois(demandes, mois, groupeDe, parKm = null) {
  const res = {};
  for (const d of demandes || []) {
    const trajets = estAllerRetour(d) ? [d, { ...d, estRetour: true, date: (d.details || {}).dateRetour || d.date }] : [d];
    for (const t of trajets) {
      if (String(t.date || "").slice(0, 7) !== mois) continue;
      const b = bilanTrajet(t, parKm);
      if (!b.total) continue;
      const g = groupeDe(t.service);
      const r = (res[g] = res[g] || { trajets: 0, minutes: 0, prix: 0, gainReel: 0 });
      r.trajets++;
      r.minutes += b.total;
      r.prix = cents(r.prix + b.prix);
      r.gainReel = cents(r.gainReel + (b.gainReel || 0));
    }
  }
  for (const r of Object.values(res)) {
    r.parHeure = r.minutes ? Math.round((r.prix * 60) / r.minutes) : null;
    r.gainReelParHeure = r.minutes ? Math.round((r.gainReel * 60) / r.minutes) : null;
  }
  return res;
}

// Aller-retour paye d'avance : ce qui est deja encaisse pour le retour (compte quand le retour est fait)
export function avanceRetour(d, mouvements) {
  if (trajetDe(d) !== "aller") return 0;
  return cents(Math.max(0, encaisseDe(mouvements, d.id) - prixTrajet(d)));
}

/* ---------- Lot 3 (17 nov. 2026, 11h50) ---------- */
const estCoursier = (d) => ["livraison", "courses", "demenagement"].includes(d && d.service);

// Coursier : le merci dit que la livraison est faite (et l'heure de depose)
export function messageLivraisonFaite(d) {
  const h = chronoDe(d).depose || (HEURE_OK.test(d.faitA || "") ? d.faitA : "");
  const quoi = d.service === "courses" ? "Vos courses sont livrées" : d.service === "demenagement" ? "Votre petit déménagement est terminé" : "Votre livraison est faite";
  return [bonjour(d), `${quoi} ✅${h ? ` (à ${heureFr(h)})` : ""}`, "Merci de m'avoir fait confiance 🙏 Au plaisir de vous revoir.", ...ligneAvisGoogle(), ...lignesSite(d), "Rebecca"].join("\n");
}

// Relance d'une cliente 30 a 60 jours apres sa derniere course (une seule fois, et seulement sans course plus recente)
const finDe = (d) => (estAllerRetour(d) && DATE_OK.test((d.details || {}).dateRetour || "") ? d.details.dateRetour : d.date);
const telDe = (d) => String((d && d.telephone) || "").replace(/\D/g, "").slice(-9);
export function relancesClientes(demandes, aujourdhui) {
  if (!DATE_OK.test(aujourdhui || "")) return [];
  const debut = plusJours(aujourdhui, -60);
  const fin = plusJours(aujourdhui, -30);
  const toutes = demandes || [];
  const plusRecente = (d) => toutes.some((x) => x.id !== d.id && telDe(x) && telDe(x) === telDe(d) && String(x.date || "") > finDe(d) && x.statut !== "refusee" && x.statut !== "annulee");
  const vus = new Set();
  return toutes
    .filter((d) => d.statut === "terminee" && d.service !== "ramassage" && d.service !== "digital" && !d.relanceLe && DATE_OK.test(finDe(d) || "") && finDe(d) >= debut && finDe(d) <= fin && telDe(d) && !plusRecente(d))
    .sort((a, b) => finDe(b).localeCompare(finDe(a)))
    .filter((d) => (vus.has(telDe(d)) ? false : (vus.add(telDe(d)), true)));
}
export function messageRelance(d) {
  const texte = d.service === "aeroport"
    ? "J'espère que vous allez bien ! Vous avez un prochain voyage en vue ? Je peux vous emmener à l'aéroport et venir vous chercher au retour."
    : estCoursier(d)
      ? "J'espère que vous allez bien ! Besoin d'une livraison, de courses ou d'un petit transport ? Je suis disponible."
      : "J'espère que vous allez bien ! Besoin d'un transport ou d'un service ? Je suis disponible.";
  return [bonjour(d), texte, "Réservez sur mon site ou répondez simplement à ce message.", ...lignesSite(d), "À bientôt, Rebecca"].join("\n");
}

// Prix minimum : gain net par heure du devis sous le minimum de Rebecca -> alerte et prix conseille
export function alerteMinimum(renta, minParHeure, prix) {
  const min = Number(minParHeure);
  if (!renta || !(min > 0) || !(Number(renta.gainNetHeure) >= 0) || renta.gainNetHeure >= min) return null;
  const heures = Number(renta.gainNet) > 0 && Number(renta.gainNetHeure) > 0 ? renta.gainNet / renta.gainNetHeure : null;
  const conseille = heures && Number(prix) > 0 ? Math.ceil((Number(prix) + (min - renta.gainNetHeure) * heures) / 5) * 5 : null;
  return { min, conseille };
}

// Ramassage scolaire : parents a prevenir quand un enfant est pris ou depose (fiches du Repertoire)
export function parentsAPrevenir(familles, texte) {
  const res = [];
  for (const f of familles || []) {
    if (f.categorie === "moi" || !String(f.telephone || "").trim()) continue;
    const prenoms = (f.enfants || []).map((e) => String(e.prenom || "").trim()).filter((p) => p && new RegExp(`(^|[^\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(texte || ""));
    if (prenoms.length) res.push({ famille: f.id, nom: f.nom || "", telephone: f.telephone, prenoms });
  }
  return res;
}
export function messageEnfant(sorte, prenoms, heure, lieu) {
  const qui = prenoms.length > 1 ? `${prenoms.slice(0, -1).join(", ")} et ${prenoms[prenoms.length - 1]}` : prenoms[0] || "votre enfant";
  const pluriel = prenoms.length > 1;
  const h = heureFr(heure);
  const ligne = sorte === "prise"
    ? `J'ai bien récupéré ${qui}${h ? ` à ${h}` : ""} 🚗`
    : `${qui} ${pluriel ? "sont bien arrivés" : "est bien arrivé(e)"}${lieu ? ` (${lieu})` : ""}${h ? ` à ${h}` : ""} ✅`;
  return ["Bonjour,", ligne, ...lignesSite({ uid: "famille" }), "Rebecca"].join("\n");
}

// « Refaire la meme course » : la course d'avant, prete pour « + Ajouter une course » (sans date, sans paiement)
export function versRefaire(d) {
  const v = d.details || {};
  const adresses = {};
  for (const [k, x] of Object.entries(v)) if (x && typeof x === "object" && typeof x.label === "string") adresses[k] = x;
  const [prenom, ...reste] = String(d.nom || "").trim().split(/\s+/);
  return {
    prerempli: {
      service: d.service,
      heure: HEURE_OK.test(d.heure || "") ? d.heure : "",
      adresses,
      direction: v.direction === "depuis" ? "depuis" : "vers",
      magasin: v.magasin || "",
      typeTrajet: v.typeTrajet === "ar" ? "ar" : "simple",
      dateRetour: "",
      heureRetour: v.typeTrajet === "ar" ? v.heureRetour || "" : "",
      prix: prixDe(d) > 0 ? String(prixDe(d)) : "",
      etat: "afaire",
    },
    client: { prenom: prenom || "", nom: reste.join(" "), telephone: d.telephone || "" },
  };
}
// Message de fin selon le service : livraison faite (coursier) ou merci (transport, aeroport...)
export const messageFin = (d, reste = 0) => (estCoursier(d) && trajetDe(d) === "simple" ? messageLivraisonFaite(d) : messageMerci(d, reste));

// « ✏️ Heures et compteur » (17 nov. 2026, 12h03) : tout corriger apres coup (heures des 4 etapes + km du compteur).
// valeurs = { depart, prise, depose, maison, kmDepart, kmDepose, kmMaison } ; "" = efface.
export function champsModifChrono(d, valeurs, quiFait = "rebecca") {
  const t = trajetDe(d);
  const champs = {};
  for (const e of ETAPES_CHRONO) {
    const h = String((valeurs || {})[e.id] || "").trim();
    if (h && !HEURE_OK.test(h)) return { erreur: "Heure invalide (ex. 08:45)." };
    champs[`chrono.${t}.${e.id}`] = h;
  }
  for (const k of ["kmDepart", "kmDepose", "kmMaison"]) {
    const n = String((valeurs || {})[k] || "").replace(/\D/g, "");
    champs[`chrono.${t}.${k}`] = n ? Number(n) : "";
  }
  const depose = champs[`chrono.${t}.depose`] || champs[`chrono.${t}.maison`];
  if (depose && !faitDe(d)) Object.assign(champs, champsFait(d, depose, quiFait));
  else if (depose && t === "aller") champs.allerFaitA = champs[`chrono.${t}.depose`] || d.allerFaitA;
  else if (depose && t === "retour") champs.retourFaitA = champs[`chrono.${t}.depose`] || d.retourFaitA;
  else if (depose && t === "simple") champs.faitA = champs[`chrono.${t}.depose`] || d.faitA;
  return { erreur: "", champs };
}

// La demande telle qu'elle sera apres l'enregistrement (les cles « chrono.aller.prise » rangees dans chrono)
export function apresChamps(d, champs) {
  const res = { ...d, chrono: JSON.parse(JSON.stringify(d.chrono || {})) };
  for (const [k, v] of Object.entries(champs || {})) {
    const m = /^chrono\.(aller|retour|simple)\.(\w+)$/.exec(k);
    if (m) res.chrono[m[1]] = { ...(res.chrono[m[1]] || {}), [m[2]]: v };
    else res[k] = v;
  }
  return res;
}

// LISTE DES DEMANDES (18 nov. 2026, 12h49) : d'un coup d'œil, l'état réel et l'argent de chaque course.
// « En cours · retour à faire » quand l'aller d'un aller-retour est fait ; payé, pourboire, reste à encaisser.
export function etatDansListe(d) {
  if (d && d.statut === "acceptee" && estAllerRetour(d) && d.allerFaitA) return { label: "En cours · retour à faire", classe: "encours" };
  return null;
}
export function argentDansListe(d, mouvements) {
  if (!d || d.statut === "refusee" || d.statut === "en attente") return null;
  const du = duDe(d);
  const paye = encaisseDe(mouvements, d.id);
  const pourboire = cents(nombre(d.pourboire));
  if (d.statut === "annulee" && paye <= 0) return null;
  const reste = d.payeAuCoursier ? 0 : cents(Math.max(0, du - paye));
  return { du, paye, pourboire, reste, solde: reste <= 0 && du > 0, coursier: d.coursierPartenaire ? d.coursierPartenaire.prenom : "" };
}
