// ARGENT ENTRE COEQUIPIERS (Lot J, seance J4a, 9 nov. 2026) - regles pures - Rebecca Services
// Decisions de Rebecca (9 nov. 2026) :
//  - chaque paiement note QUI a recu l'argent (champ "operateur" ; absent = Rebecca) ;
//  - le chiffre d'affaires et le plafond comptent pour CELUI QUI A FAIT LA COURSE ;
//  - argent recu par l'un pour une course faite par l'autre = « a reverser », dans les deux sens ;
//  - l'argent du credit prepaye est TOUJOURS garde par Rebecca (20h30) :
//      course de Jeremy payee avec le credit -> Rebecca lui reverse ;
//      recharge de credit encaissee par Jeremy -> il la reverse a Rebecca ;
//  - « C'est reverse » = une nouvelle ligne (collection "reversements"), jamais modifiee ni supprimee.

import { ADMIN_ID, attribueA, coutParKmVehicule, kmMission } from "./equipe.js";

export const MOYEN_CREDIT = "Crédit du client";

const cents = (x) => Math.round(x * 100) / 100;
const nb = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

// Qui a fait (ou fera) la course
export const faitPar = (d) => (d && d.realisePar) || attribueA(d);

// Qui a recu l'argent d'un mouvement. Credit du client : toujours la caisse de Rebecca.
export const recuPar = (m) => (m && m.moyen === MOYEN_CREDIT ? ADMIN_ID : (m && m.operateur) || ADMIN_ID);

// Champ a ecrire sur une ligne d'argent : rien pour Rebecca (compatible avec les anciennes lignes)
export const champOperateur = (id) => (id && id !== ADMIN_ID ? { operateur: id } : {});

// Montant d'un mouvement pour la caisse de celui qui l'a recu (remboursement = argent rendu)
function montantCaisse(m) {
  if (m.kind === "paiement" || m.kind === "correction") return nb(m.montant);
  if (m.kind === "remboursement_effectue") return -nb(m.montant);
  return 0;
}

// Toutes les sommes a reverser, ligne par ligne : { id, de, vers, montant, date, resId?, rechargeId?, cause }
//  cause : "credit" (course payee avec le credit), "encaisse" (l'un a encaisse la course de l'autre), "recharge"
export function lignesAReverser({ demandes = [], mouvements = [], recharges = [] } = {}) {
  const parId = new Map(demandes.map((d) => [d.id, d]));
  const lignes = [];
  for (const m of mouvements) {
    const montant = montantCaisse(m);
    if (!montant) continue;
    const d = parId.get(m.resId);
    if (!d) continue;
    const de = recuPar(m);
    const vers = faitPar(d);
    if (de === vers) continue;
    lignes.push({ id: "m-" + (m.id || lignes.length), de, vers, montant: cents(montant), date: m.date || "", resId: d.id, cause: m.moyen === MOYEN_CREDIT ? "credit" : "encaisse", demande: d });
  }
  for (const r of recharges) {
    if (r.statut !== "confirmée" || !r.operateur || r.operateur === ADMIN_ID) continue;
    const montant = nb(r.montant);
    if (!montant) continue;
    lignes.push({ id: "r-" + (r.id || lignes.length), de: r.operateur, vers: ADMIN_ID, montant: cents(montant), date: r.date || "", rechargeId: r.id, cause: "recharge" });
  }
  return lignes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Solde entre deux personnes, apres les reversements deja faits.
// Renvoie { de, vers, montant } : « de » doit encore « montant » a « vers » (montant 0 = a jour).
export function soldeEntre(a, b, { lignes = [], reversements = [] } = {}) {
  let aDoitAB = 0; // positif : a doit a b
  for (const l of lignes) {
    if (l.de === a && l.vers === b) aDoitAB += l.montant;
    else if (l.de === b && l.vers === a) aDoitAB -= l.montant;
  }
  for (const r of reversements) {
    if (r.de === a && r.vers === b) aDoitAB -= nb(r.montant);
    else if (r.de === b && r.vers === a) aDoitAB += nb(r.montant);
  }
  aDoitAB = cents(aDoitAB);
  if (aDoitAB >= 0) return { de: a, vers: b, montant: aDoitAB };
  return { de: b, vers: a, montant: cents(-aDoitAB) };
}

// Tous les soldes de « moi » avec chacun des autres membres
export function soldesDe(moi, membres = [], donnees = {}) {
  return membres.filter((m) => m.id !== moi).map((m) => ({ membre: m, ...soldeEntre(moi, m.id, donnees) }));
}

// Verifie un reversement avant enregistrement
export function validerReversement(r, soldeActuel) {
  const montant = cents(nb(r && r.montant));
  if (!r || !r.de || !r.vers || r.de === r.vers) return { erreur: "Reversement invalide." };
  if (!DATE_OK.test(r.date || "")) return { erreur: "Indique la date." };
  if (!(montant > 0) || montant > 100000) return { erreur: "Montant invalide." };
  if (soldeActuel && (soldeActuel.de !== r.de || montant > soldeActuel.montant + 0.001)) return { erreur: "Ce montant dépasse ce qui reste à reverser." };
  const ligne = { de: r.de, vers: r.vers, montant, date: r.date };
  const note = String(r.note || "").trim();
  if (note) ligne.note = note.slice(0, 200);
  return { erreur: "", ligne };
}

// L'argent d'une personne : ce qu'elle a encaisse, ce qu'elle doit reverser, ce qu'on lui doit
export function argentDe(moi, { demandes = [], mouvements = [], recharges = [], reversements = [] } = {}) {
  const lignes = lignesAReverser({ demandes, mouvements, recharges });
  const encaisse = cents(mouvements.filter((m) => recuPar(m) === moi && m.moyen !== MOYEN_CREDIT).reduce((s, m) => s + montantCaisse(m), 0));
  const somme = (f) => cents(lignes.filter(f).reduce((s, l) => s + l.montant, 0));
  const pourLesAutres = somme((l) => l.de === moi && l.cause === "encaisse");
  const recuParLesAutres = somme((l) => l.vers === moi && l.cause === "encaisse");
  // recharges encaissees par un coequipier : il les tient (hors courses) et les reverse a Rebecca
  const rechargesADonner = somme((l) => l.de === moi && l.cause === "recharge");
  const rechargesARecevoir = somme((l) => l.vers === moi && l.cause === "recharge");
  const creditADonner = somme((l) => l.de === moi && l.cause === "credit");
  const creditARecevoir = somme((l) => l.vers === moi && l.cause === "credit");
  const reverseDonne = cents(reversements.filter((r) => r.de === moi).reduce((s, r) => s + nb(r.montant), 0));
  const reverseRecu = cents(reversements.filter((r) => r.vers === moi).reduce((s, r) => s + nb(r.montant), 0));
  return {
    encaisse, // argent recu de la main du client (sans le credit)
    pourLesAutres, // dont argent des courses des autres
    recuParLesAutres, // argent de mes courses encaisse par un autre
    creditADonner, // courses des autres payees avec le credit (caisse du credit = moi)
    creditARecevoir, // mes courses payees avec le credit
    rechargesADonner,
    rechargesARecevoir,
    reverseDonne,
    reverseRecu,
    // ce que j'aurai en main une fois tout reverse (une recharge tenue puis reversee s'annule)
    aMoiAuFinal: cents(encaisse - pourLesAutres + recuParLesAutres - creditADonner + creditARecevoir + rechargesARecevoir),
  };
}

/* ---------- Benefice par vehicule ---------- */

// Vehicule d'une course : le sien ; sinon la voiture de Rebecca pour une course de Rebecca ; sinon inconnu
export function vehiculeDeCourse(d, vehicules = []) {
  if (d.vehicule) return vehicules.find((v) => v.id === d.vehicule) || null;
  if (faitPar(d) === ADMIN_ID) return vehicules.find((v) => v.proprietaire === ADMIN_ID && v.type === "voiture") || null;
  return null;
}

// Par vehicule, pour une annee : courses terminees, km estimes, frais estimes, chiffre d'affaires, depenses rattachees
export function parVehicule({ annee, demandes = [], depenses = [], vehicules = [] }) {
  const lignes = new Map();
  const ligne = (v) => {
    const cle = v ? v.id : "_inconnu";
    if (!lignes.has(cle)) lignes.set(cle, { id: cle, nom: v ? v.nom : "Véhicule non indiqué", type: v ? v.type : null, courses: 0, km: 0, fraisEstimes: 0, ca: 0, depenses: 0 });
    return lignes.get(cle);
  };
  for (const d of demandes) {
    if (d.statut !== "terminee" || String(d.date || "").slice(0, 4) !== String(annee)) continue;
    const v = vehiculeDeCourse(d, vehicules);
    const l = ligne(v);
    const km = kmMission(d);
    l.courses += 1;
    l.km += km;
    l.fraisEstimes += v ? km * coutParKmVehicule(v) : 0;
    l.ca += typeof d.prixFinal === "number" ? d.prixFinal : nb(d.prixEstime);
  }
  for (const x of depenses) {
    if (!x.vehicule || String(x.date || "").slice(0, 4) !== String(annee)) continue;
    ligne(vehicules.find((v) => v.id === x.vehicule) || { id: x.vehicule, nom: "Véhicule supprimé", type: null }).depenses += nb(x.montant);
  }
  return [...lignes.values()].map((l) => ({
    ...l,
    km: Math.round(l.km),
    fraisEstimes: Math.round(l.fraisEstimes),
    ca: cents(l.ca),
    depenses: cents(l.depenses),
    beneficeEstime: Math.round(l.ca - l.fraisEstimes),
  }));
}
