// PRIORITE DES DEMANDES DE RAMASSAGE SCOLAIRE - regles pures (aucun acces internet ni base de donnees)
// Regle de Rebecca (15 nov. 2026) :
// - la premiere demande arrivee est prioritaire sur le creneau pendant 1 semaine ;
// - passe 1 semaine, la demande suivante devient prioritaire, meme si la premiere est encore en attente ;
// - une demande reste en attente jusqu'a ce que Rebecca la refuse ou l'annule ; au bout de 2 semaines elle est
//   annulee automatiquement : si la cliente la veut encore, elle refait le devis et la demande.
// Rien n'est refuse tout seul : les demandes prioritaires sont seulement comptees comme « deja prises » quand
// Rebecca verifie si une autre demande rentre dans sa tournee.

export const JOURS_PRIORITE = 7;
export const JOURS_ANNULATION = 14;
const JOUR_MS = 86400000;

// Moment d'arrivee en millisecondes : Timestamp Firestore, { seconds }, date ISO, ou « AAAA-MM-JJ » (minuit, heure d'Israel ~)
export function arriveeMs(x) {
  if (!x) return null;
  if (typeof x.toMillis === "function") return x.toMillis();
  if (typeof x.seconds === "number") return x.seconds * 1000;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T00:00:00+02:00` : x);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

// Etat d'une demande encore en attente selon son age : prioritaire (< 1 semaine), attente (1 a 2 semaines), expiree
export function etatAge(arrivee, maintenant = Date.now()) {
  const t = arriveeMs(arrivee);
  if (t == null) return { etat: "prioritaire", jours: 0, finPriorite: null, annulationLe: null };
  const jours = (maintenant - t) / JOUR_MS;
  const etat = jours >= JOURS_ANNULATION ? "expiree" : jours >= JOURS_PRIORITE ? "attente" : "prioritaire";
  return { etat, jours: Math.floor(jours), finPriorite: t + JOURS_PRIORITE * JOUR_MS, annulationLe: t + JOURS_ANNULATION * JOUR_MS };
}

// demandes = [{ cle, nom, arrivee, enAttente: bool, plan }]. Renvoie la liste classee (les seules en attente non expirees) :
// d'abord celles de moins d'1 semaine (ordre d'arrivee), puis celles d'1 a 2 semaines (ordre d'arrivee).
export function classerDemandes(demandes, maintenant = Date.now()) {
  const liste = demandes
    .filter((d) => d.enAttente)
    .map((d) => ({ ...d, ...etatAge(d.arrivee, maintenant), ms: arriveeMs(d.arrivee) ?? maintenant }))
    .filter((d) => d.etat !== "expiree");
  const groupe = (d) => (d.etat === "prioritaire" ? 0 : 1);
  liste.sort((a, b) => groupe(a) - groupe(b) || a.ms - b.ms);
  return liste.map((d, i) => ({ ...d, rang: i + 1 }));
}

// Demandes passees avant celle-ci (cle) ; pour un devis nouveau (cle absente), seulement celles de moins d'1 semaine
export function demandesAvant(classees, cle, maintenant = Date.now()) {
  const k = cle ? classees.findIndex((d) => d.cle === cle) : -1;
  if (k >= 0) return classees.slice(0, k);
  void maintenant;
  return classees.filter((d) => d.etat === "prioritaire");
}

// Demandes a annuler automatiquement (en attente depuis 2 semaines ou plus)
export const demandesExpirees = (demandes, maintenant = Date.now()) => demandes.filter((d) => d.enAttente && etatAge(d.arrivee, maintenant).etat === "expiree");

// Texte court pour la liste de Rebecca
export function textePriorite(d, classees, maintenant = Date.now()) {
  if (!d.enAttente) return "";
  const age = etatAge(d.arrivee, maintenant);
  if (age.etat === "expiree") return "Annulée automatiquement (2 semaines sans réponse)";
  const c = classees.find((x) => x.cle === d.cle);
  const fin = (ms) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
  if (age.etat === "prioritaire") return `Prioritaire n°${c ? c.rang : "?"} jusqu'au ${fin(age.finPriorite)} · annulée le ${fin(age.annulationLe)} sans réponse`;
  return `Plus prioritaire (plus d'1 semaine) · rang ${c ? c.rang : "?"} · annulée le ${fin(age.annulationLe)} sans réponse`;
}

// Heure d'arrivee lisible : « 15/11 à 11h52 »
export function arriveeFr(x) {
  const t = arriveeMs(x);
  if (t == null) return "";
  const d = new Date(t);
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Asia/Jerusalem" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).replace(":", "h");
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? jour : `${jour} à ${heure}`;
}
