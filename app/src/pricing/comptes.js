// COMPTES : acomptes, paiements, annulations, remboursements, indicateurs - Rebecca Transport & Services
// Logique pure (aucun acces internet ni base de donnees) : elle se teste seule.
//
// PRINCIPES
//  - Un mouvement d'argent n'est JAMAIS modifie ni supprime : on ajoute une nouvelle ligne
//    (une erreur se corrige par une "correction" avec motif).
//  - Aucune penalite ni aucun frais d'annulation n'est applique sans validation de Rebecca.
//  - Regle choisie par Rebecca : annulation client / tardive / absence = l'acompte reste acquis.
//    A faire confirmer par un juriste ou comptable (plafonds legaux possibles en Israel) : tout est modifiable ici.
//  - Un remboursement n'est "effectue" que lorsque Rebecca enregistre le virement reel.
//
// MOUVEMENTS (liste ajoutee au fil du temps) :
//  { kind:"paiement",  id, resId, montant, moyen, date }
//  { kind:"correction", id, resId, montant (+ ou -), motif, date }
//  { kind:"annulation", id, resId, cas, date, motif, frais, fraisRetenus, remboursementValide, validePar }
//  { kind:"remboursement_effectue", id, resId, annulationId, montant, moyen, date, ref? }
// Reservation : { id, date:"AAAA-MM-JJ", prixConvenu, statut:"acceptee"|"terminee"|"annulee" }
// Depense : { id, date, categorie, montant, resId? }

import { TARIFS } from "./config.js";

/* ---------- Reglages (modifiables par Rebecca, rien de fige dans le code) ---------- */

export const REGLAGES_PAR_DEFAUT = {
  acomptePourcent: 20,
  acompteMinimum: 10, // en shekels
  annulation: {
    // actif:true = l'acompte est conserve (choix de Rebecca) ; actif:false = remboursement complet
    // mode : "aucun" | "acompte" | "pourcentage" | "montant" | "plafond_legal"
    //   pourcentage : valeur = % du prix        montant : valeur = somme fixe
    //   plafond_legal : le plus bas de (valeur % du prix) et plafond (ex. 5 % ou 100 shekels)
    // plafond (facultatif) : les frais ne depassent jamais cette somme
    client: { actif: true, mode: "acompte", valeur: 0, plafond: null },
    tardive: { actif: true, mode: "acompte", valeur: 0, plafond: null, heuresAvant: 24 },
    absence: { actif: true, mode: "acompte", valeur: 0, plafond: null },
  },
};

const MODES = ["aucun", "acompte", "pourcentage", "montant", "plafond_legal"];
const CAS = ["client", "tardive", "absence", "rebecca"];

const nombre = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const arrondiSup = (x) => Math.ceil(+x.toFixed(6));
const arrondiInf = (x) => Math.floor(+x.toFixed(6));
const cents = (x) => Math.round(x * 100) / 100;

/* ---------- Acompte ---------- */

// Acompte = pourcentage du prix, arrondi au shekel superieur, minimum fixe (jamais plus que le prix).
// Course sur devis ou prix pas encore valide : pas d'acompte avant la validation du prix definitif.
export function calculerAcompte(prixConvenu, reglages = REGLAGES_PAR_DEFAUT) {
  const prix = Number(prixConvenu);
  if (!Number.isFinite(prix) || prix <= 0) return null;
  const brut = arrondiSup((prix * reglages.acomptePourcent) / 100);
  return Math.min(prix, Math.max(reglages.acompteMinimum, brut));
}

/* ---------- Paiements ---------- */

export function validerMouvement(m, t = TARIFS) {
  if (!m || typeof m !== "object") return "Mouvement invalide.";
  if (typeof m.resId !== "string" || !m.resId) return "Course manquante.";
  if (typeof m.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return "Date invalide.";
  const montant = Number(m.montant);
  if (!Number.isFinite(montant) || montant === 0 || Math.abs(montant) > 100000) return "Montant invalide.";
  if (m.kind === "paiement" || m.kind === "remboursement_effectue") {
    if (montant < 0) return "Le montant doit être positif.";
    if (!t.moyensPaiement.includes(m.moyen)) return "Moyen de paiement inconnu.";
  } else if (m.kind === "correction") {
    if (typeof m.motif !== "string" || m.motif.trim().length < 3) return "Un motif est obligatoire pour une correction.";
  } else {
    return "Type de mouvement inconnu.";
  }
  return null;
}

const duResa = (mouvements, resId) => mouvements.filter((m) => m.resId === resId);

// Argent recu pour une course (paiements + corrections), avant tout remboursement
export function encaisseBrut(mouvements, resId) {
  return cents(
    duResa(mouvements, resId)
      .filter((m) => m.kind === "paiement" || m.kind === "correction")
      .reduce((s, m) => s + nombre(Number(m.montant)), 0)
  );
}

export function annulationDe(mouvements, resId) {
  const liste = duResa(mouvements, resId).filter((m) => m.kind === "annulation");
  return liste.length ? liste[liste.length - 1] : null;
}

/* ---------- Etat d'une reservation ---------- */
// "acompte_a_recevoir" : acceptee, creneau bloque, acompte pas encore recu
// "confirmee"          : acceptee et acompte effectivement encaisse
export function etatReservation(res, mouvements, reglages = REGLAGES_PAR_DEFAUT) {
  if (res.statut === "terminee") return "terminee";
  if (res.statut === "annulee") return "annulee";
  if (res.statut !== "acceptee") return res.statut || "en attente";
  const acompte = calculerAcompte(res.prixConvenu, reglages);
  if (acompte == null) return "acompte_a_recevoir";
  return encaisseBrut(mouvements, res.id) >= acompte ? "confirmee" : "acompte_a_recevoir";
}

/* ---------- Annulations ---------- */

// Cas propose selon le delai : annulation client faite trop tard => "tardive"
export function casSuggere(heuresAvantCourse, reglages = REGLAGES_PAR_DEFAUT) {
  const seuil = nombre(reglages.annulation.tardive.heuresAvant);
  return heuresAvantCourse != null && heuresAvantCourse < seuil ? "tardive" : "client";
}

function fraisSelonRegle(regle, prix, acompte) {
  let frais = 0;
  if (regle.mode === "acompte") frais = acompte || 0;
  else if (regle.mode === "pourcentage") frais = arrondiInf((prix * nombre(regle.valeur)) / 100);
  else if (regle.mode === "montant") frais = nombre(regle.valeur);
  else if (regle.mode === "plafond_legal") frais = Math.min(arrondiInf((prix * nombre(regle.valeur)) / 100), nombre(regle.plafond));
  if (regle.plafond != null && regle.mode !== "plafond_legal") frais = Math.min(frais, nombre(regle.plafond));
  return Math.max(0, Math.min(frais, prix));
}

// CALCUL (proposition) : rien n'est enregistre. Rebecca valide ensuite.
// entree : { cas, prixConvenu, encaisse }  ->  frais autorises, frais retenus, remboursement a proposer
export function calculerAnnulation({ cas, prixConvenu, encaisse }, reglages = REGLAGES_PAR_DEFAUT) {
  if (!CAS.includes(cas)) throw new Error("Cas d'annulation inconnu : " + cas);
  const prix = nombre(Number(prixConvenu));
  const recu = Math.max(0, nombre(Number(encaisse)));
  const acompte = calculerAcompte(prix, reglages);
  const notes = [];

  let frais = 0;
  let regleActive = false;
  if (cas === "rebecca") {
    notes.push("Annulation de ton côté : remboursement intégral, aucun frais.");
  } else {
    const regle = reglages.annulation[cas];
    if (!regle || !regle.actif || !MODES.includes(regle.mode) || regle.mode === "aucun") {
      notes.push("Aucune pénalité activée pour ce cas : remboursement complet proposé.");
    } else {
      regleActive = true;
      frais = fraisSelonRegle(regle, prix, acompte);
      notes.push("Frais calculés selon la règle activée : " + frais + " ₪.");
    }
  }

  const fraisRetenus = Math.min(frais, recu); // on ne retient que l'argent reellement recu
  const fraisNonEncaisses = cents(frais - fraisRetenus);
  if (fraisNonEncaisses > 0) notes.push("Frais non encaissés (rien reçu à retenir) : " + fraisNonEncaisses + " ₪.");
  return {
    cas,
    frais, // frais autorises par la regle
    fraisRetenus, // argent qui reste acquis a l'activite
    fraisNonEncaisses,
    remboursement: cents(recu - fraisRetenus), // a rembourser au client
    regleActive,
    notes,
  };
}

// Construit la ligne "annulation" a enregistrer APRES validation de Rebecca (montants verifies).
export function creerAnnulationValidee({ id, resId, cas, date, motif, calcul, validePar }) {
  if (!calcul || calcul.cas !== cas) throw new Error("Calcul d'annulation incoherent.");
  if (typeof validePar !== "string" || !validePar) throw new Error("Validation manquante.");
  return {
    kind: "annulation",
    id,
    resId,
    cas,
    date,
    motif: String(motif || "").slice(0, 200),
    frais: calcul.frais,
    fraisRetenus: calcul.fraisRetenus,
    remboursementValide: calcul.remboursement,
    validePar,
  };
}

/* ---------- Remboursements : calcule -> valide -> effectue ---------- */

export function etatRemboursement(annulation, mouvements) {
  if (!annulation) return { valide: 0, effectue: 0, reste: 0, etat: "aucun" };
  const effectue = cents(
    mouvements
      .filter((m) => m.kind === "remboursement_effectue" && m.annulationId === annulation.id)
      .reduce((s, m) => s + nombre(Number(m.montant)), 0)
  );
  const valide = nombre(annulation.remboursementValide);
  const reste = cents(Math.max(0, valide - effectue));
  let etat = "a_effectuer";
  if (valide === 0) etat = "aucun";
  else if (effectue >= valide) etat = "effectue";
  else if (effectue > 0) etat = "partiel";
  return { valide, effectue, reste, etat };
}

// Refus si le virement depasse ce qui reste a rembourser (jamais plus que le montant valide)
export function verifierRemboursementEffectue(montant, annulation, mouvements) {
  const e = etatRemboursement(annulation, mouvements);
  const m = Number(montant);
  if (!annulation) return "Aucune annulation validée pour cette course.";
  if (!Number.isFinite(m) || m <= 0) return "Montant invalide.";
  if (m > e.reste + 0.001) return "Maximum à rembourser : " + e.reste + " ₪.";
  return null;
}

/* ---------- Situation d'une course ---------- */

export function situationCourse(res, mouvements, reglages = REGLAGES_PAR_DEFAUT) {
  const prix = nombre(Number(res.prixConvenu));
  const brut = encaisseBrut(mouvements, res.id);
  const annulation = annulationDe(mouvements, res.id);
  const remb = etatRemboursement(annulation, mouvements);
  const acompte = calculerAcompte(prix, reglages);
  return {
    etat: etatReservation(res, mouvements, reglages),
    prix,
    acompte,
    acompteRecu: acompte != null && brut >= acompte,
    encaisse: brut,
    resteAPayer: res.statut === "annulee" ? 0 : cents(Math.max(0, prix - brut)),
    surplus: res.statut === "annulee" ? 0 : cents(Math.max(0, brut - prix)),
    remboursement: remb,
  };
}

/* ---------- Indicateurs du tableau de bord ---------- */
// periode : { debut:"AAAA-MM-JJ", fin:"AAAA-MM-JJ" } (inclus). Sans periode : tout.
export function indicateurs(reservations, mouvements, depenses = [], periode = null) {
  const dans = (d) => !periode || (d >= periode.debut && d <= periode.fin);

  const recus = mouvements.filter((m) => (m.kind === "paiement" || m.kind === "correction") && dans(m.date));
  const argentEncaisse = cents(recus.reduce((s, m) => s + nombre(Number(m.montant)), 0));
  const rembourse = cents(
    mouvements.filter((m) => m.kind === "remboursement_effectue" && dans(m.date)).reduce((s, m) => s + nombre(Number(m.montant)), 0)
  );

  // Avances clients : argent recu pour des courses acceptees pas encore terminees (situation actuelle)
  const avancesClients = cents(
    reservations.filter((r) => r.statut === "acceptee").reduce((s, r) => s + encaisseBrut(mouvements, r.id), 0)
  );

  // CA realise : courses terminees (a la date de la course) + argent conserve apres annulation (a la date d'annulation)
  const terminees = reservations.filter((r) => r.statut === "terminee" && dans(r.date));
  const caCourses = cents(terminees.reduce((s, r) => s + nombre(Number(r.prixConvenu)), 0));
  const caAnnulations = cents(
    mouvements.filter((m) => m.kind === "annulation" && dans(m.date)).reduce((s, m) => s + nombre(Number(m.fraisRetenus)), 0)
  );
  const caRealise = cents(caCourses + caAnnulations);

  const depensesPeriode = depenses.filter((d) => dans(d.date));
  const totalDepenses = cents(depensesPeriode.reduce((s, d) => s + nombre(Number(d.montant)), 0));
  const depensesParCategorie = {};
  for (const d of depensesPeriode) depensesParCategorie[d.categorie] = cents((depensesParCategorie[d.categorie] || 0) + nombre(Number(d.montant)));

  // Dettes et creances (situation actuelle)
  const remboursementsAEffectuer = cents(
    mouvements
      .filter((m) => m.kind === "annulation")
      .reduce((s, a) => s + etatRemboursement(a, mouvements).reste, 0)
  );
  const resteAEncaisser = cents(
    reservations.filter((r) => r.statut === "terminee").reduce((s, r) => s + Math.max(0, nombre(Number(r.prixConvenu)) - encaisseBrut(mouvements, r.id)), 0)
  );

  return {
    argentEncaisse, // tout l'argent recu, meme avant la course
    rembourse, // remboursements reellement effectues
    encaisseNet: cents(argentEncaisse - rembourse),
    avancesClients, // recu pour des courses pas encore faites
    caCourses,
    caAnnulations, // argent conserve apres annulation
    caRealise,
    depenses: totalDepenses,
    depensesParCategorie,
    beneficeOperationnel: cents(caRealise - totalDepenses),
    remboursementsAEffectuer,
    resteAEncaisser,
    nbCoursesTerminees: terminees.length,
    prixMoyen: terminees.length ? cents(caCourses / terminees.length) : 0,
  };
}
