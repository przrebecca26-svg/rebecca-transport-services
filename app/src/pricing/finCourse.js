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
export const resteDe = (d, mouvements) => cents(Math.max(0, prixDe(d) - encaisseDe(mouvements, d.id)));

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
export function preparerEncaissement(d, { recu, pourboire, moyen }, date) {
  const lire = (x) => {
    const t = String(x == null ? "" : x).trim().replace(",", ".");
    if (t === "") return 0;
    const n = Number(t);
    return Number.isFinite(n) ? cents(n) : NaN;
  };
  const montant = lire(recu);
  const tip = lire(pourboire);
  if (!Number.isFinite(montant) || montant < 0 || montant > 100000) return { erreur: "Montant reçu invalide." };
  if (!Number.isFinite(tip) || tip < 0 || tip > 5000) return { erreur: "Pourboire invalide." };
  if (montant === 0 && tip === 0) return { erreur: "Indique ce que tu as reçu." };
  if (!moyen) return { erreur: "Choisis le moyen de paiement." };
  if (!DATE_OK.test(date || "")) return { erreur: "Date invalide." };
  const paiement = montant > 0 ? { kind: "paiement", resId: d.id, date, montant, moyen } : null;
  const champs = tip > 0 ? { pourboire: cents(nombre(d.pourboire) + tip) } : {};
  return { erreur: "", paiement, champs, montant, pourboire: tip };
}

const jourLong = (date) => {
  if (!DATE_OK.test(date || "")) return "";
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const heureFr = (h) => String(h || "").replace(":", "h");
const prenomDe = (nom) => String(nom || "").trim().split(/\s+/)[0] || "";
const bonjour = (d) => (prenomDe(d.nom) ? `Bonjour ${prenomDe(d.nom)},` : "Bonjour,");
// 17 nov. 2026, 11h33 : le lien du site dans TOUS les messages ; sans compte, l'invitation a creer son compte
export function lignesSite(d, site = SITE) {
  if (d && d.uid) return [`Retrouvez-moi sur mon site : ${site}`];
  return [`N'hésitez pas à créer votre compte sur mon site avec ce numéro de téléphone : ${site}`, `Code ${CODE_BIENVENUE} : -10 ₪ sur votre prochaine réservation.`];
}
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
  { id: "prise", bouton: "📍 Récupérée", libelle: "Récupérée" },
  { id: "depose", bouton: "✓ Déposée", libelle: "Déposée" },
  { id: "maison", bouton: "🏠 Rentrée", libelle: "Rentrée à la maison" },
];

export const chronoDe = (d) => ((d && d.chrono) || {})[trajetDe(d)] || {};

// Prochaine etape a cocher : "prise", "depose", "maison" ou "" (tout est fait)
export function prochaineEtape(d) {
  const c = chronoDe(d);
  const fait = faitDe(d);
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
export const prixTrajet = (d) => cents(estAllerRetour(d) ? prixDe(d) / 2 : prixDe(d));

// Temps passes et rentabilite du trajet
export function bilanTrajet(d) {
  const c = chronoDe(d);
  const course = ecart(c.prise, c.depose);
  const retourMaison = ecart(c.depose, c.maison);
  const total = course != null && retourMaison != null ? course + retourMaison : ecart(c.prise, c.maison);
  const prix = prixTrajet(d);
  const parHeure = total && total > 0 && prix > 0 ? Math.round((prix * 60) / total) : null;
  return { course, retourMaison, total, prix, parHeure };
}
