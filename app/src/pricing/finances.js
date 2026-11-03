// SUIVI DES PAIEMENTS - Rebecca Transport & Services
// Pas de paiement en ligne au lancement : Rebecca enregistre le moyen de paiement
// (espèces, carte bancaire, Revolut, Bit) et les sommes encaissées.

import { TARIFS } from "./config.js";

// paiements : [{ montant, moyen, date }]  -  prixConvenu : le prix final fixe par Rebecca
export function resumePaiement(prixConvenu, paiements = [], t = TARIFS) {
  const encaisse = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const restant = Math.max(0, prixConvenu - encaisse);
  const parMoyen = {};
  for (const moyen of t.moyensPaiement) parMoyen[moyen] = 0;
  const inconnus = [];
  for (const p of paiements) {
    if (p.moyen in parMoyen) parMoyen[p.moyen] += Number(p.montant) || 0;
    else inconnus.push(p);
  }
  let statut = "non payé";
  if (encaisse > 0 && restant > 0) statut = "partiellement payé";
  if (prixConvenu > 0 && restant === 0) statut = "payé";
  return {
    prixConvenu,
    encaisse,
    restant,
    surplus: Math.max(0, encaisse - prixConvenu),
    statut,
    parMoyen,
    moyensInconnus: inconnus,
  };
}

// Totaux pour le tableau de bord : facture, encaisse, restant a encaisser
export function totauxFinances(reservations, t = TARIFS) {
  let facture = 0;
  let encaisse = 0;
  const parMoyen = Object.fromEntries(t.moyensPaiement.map((m) => [m, 0]));
  for (const r of reservations) {
    const s = resumePaiement(r.prixConvenu || 0, r.paiements || [], t);
    facture += s.prixConvenu;
    encaisse += s.encaisse;
    for (const m of Object.keys(parMoyen)) parMoyen[m] += s.parMoyen[m];
  }
  return { facture, encaisse, restant: Math.max(0, facture - encaisse), parMoyen };
}

/* ---------- Bilan par reservation : gain reel, essence, a declarer ---------- */

// reservation = {
//   prixConvenu, paiements: [{ montant, moyen, nature? }]   (nature "remboursement_achats" = pas un revenu)
//   depenses: [{ categorie, montant }]                       (carburant, peages, stationnement...)
//   kmParcourus? (sinon calcule depuis la demande, retour a vide compris), demande?, statut?
// }
import { carburantParKm } from "./config.js";
import { analyserRentabilite } from "./engine.js";

const somme = (liste, f) => liste.reduce((s, x) => s + (f(x) || 0), 0);
const r0 = (x) => Math.round(x);

export function bilanReservation(res, t = TARIFS) {
  const prix = res.prixConvenu || 0;
  const paiements = res.paiements || [];
  const depenses = res.depenses || [];

  let km = res.kmParcourus;
  if (km == null && res.demande && res.demande.aller) km = analyserRentabilite(res.demande, prix, t).kmTotal;
  const kmConnus = km != null;
  km = km || 0;

  const prestations = somme(paiements.filter((p) => p.nature !== "remboursement_achats"), (p) => Number(p.montant));
  const remboursements = somme(paiements.filter((p) => p.nature === "remboursement_achats"), (p) => Number(p.montant));

  const carburantReel = somme(depenses.filter((d) => d.categorie === "Carburant"), (d) => Number(d.montant));
  const carburantEstime = km * carburantParKm(t);
  const carburant = carburantReel > 0 ? carburantReel : carburantEstime;
  const autresFrais = somme(depenses.filter((d) => d.categorie !== "Carburant"), (d) => Number(d.montant));
  const usure = km * t.carburant.usureVehiculeParKm; // cout d'usage estime, pas une depense en caisse

  const gainEncaisse = prestations - carburant - autresFrais;
  const gainNet = gainEncaisse - usure;
  const gainPrevu = prix - carburant - autresFrais - usure;

  return {
    km,
    kmManquants: !kmConnus,
    chiffreAffairesFacture: prix,
    chiffreAffairesEncaisse: prestations,
    remboursementsAchats: remboursements,
    carburant: r0(carburant),
    carburantEstime: carburantReel === 0,
    autresFrais: r0(autresFrais),
    usureVehicule: r0(usure),
    gainEncaisse: r0(gainEncaisse),
    gainNet: r0(gainNet),
    gainPrevuSiToutPaye: r0(gainPrevu),
  };
}

/* ---------- Bilan d'une periode (jour, semaine, mois) + recapitulatif comptable ---------- */

export function bilanPeriode(reservations, depensesGenerales = [], t = TARIFS) {
  const terminees = reservations.filter((r) => r.statut === "terminee");
  const bilans = terminees.map((r) => bilanReservation(r, t));
  const paiementsTous = terminees.flatMap((r) => r.paiements || []);

  const facture = somme(bilans, (b) => b.chiffreAffairesFacture);
  const encaisse = somme(bilans, (b) => b.chiffreAffairesEncaisse);
  const carburant = somme(bilans, (b) => b.carburant);
  const carburantEstimeNonJustifie = somme(bilans.filter((b) => b.carburantEstime), (b) => b.carburant);
  const autresFrais = somme(bilans, (b) => b.autresFrais);
  const usure = somme(bilans, (b) => b.usureVehicule);
  const fraisGeneraux = somme(depensesGenerales, (d) => Number(d.montant));
  const km = somme(bilans, (b) => b.km);

  const parMoyen = Object.fromEntries(t.moyensPaiement.map((m) => [m, 0]));
  for (const p of paiementsTous) {
    if (p.nature !== "remboursement_achats" && p.moyen in parMoyen) parMoyen[p.moyen] += Number(p.montant) || 0;
  }

  const depensesParCategorie = {};
  for (const r of terminees) for (const d of r.depenses || []) depensesParCategorie[d.categorie] = (depensesParCategorie[d.categorie] || 0) + Number(d.montant);
  for (const d of depensesGenerales) depensesParCategorie[d.categorie] = (depensesParCategorie[d.categorie] || 0) + Number(d.montant);

  const beneficeEnCaisse = encaisse - carburant - autresFrais - fraisGeneraux;
  return {
    nbPrestations: terminees.length,
    kmTotal: km,
    chiffreAffairesFacture: facture,
    chiffreAffairesEncaisse: encaisse,
    restantAEncaisser: Math.max(0, facture - encaisse),
    remboursementsAchats: somme(bilans, (b) => b.remboursementsAchats),
    carburant: r0(carburant),
    autresFrais: r0(autresFrais),
    fraisGeneraux: r0(fraisGeneraux),
    usureVehicule: r0(usure),
    beneficeEnCaisse: r0(beneficeEnCaisse),
    beneficeNet: r0(beneficeEnCaisse - usure),
    prixMoyen: terminees.length ? r0(facture / terminees.length) : 0,
    parMoyen,
    // A remettre a un comptable : chiffre d'affaires encaisse + depenses enregistrees + kilometres.
    // Les regles de deduction dependent du statut fiscal de Rebecca : a confirmer avec un comptable.
    recapComptable: {
      chiffreAffairesEncaisse: encaisse,
      depensesEnregistreesParCategorie: depensesParCategorie,
      carburantEstimeNonJustifie: r0(carburantEstimeNonJustifie),
      kmTotal: km,
      nbPrestations: terminees.length,
    },
  };
}
