// MOTEUR TARIFAIRE - Rebecca Transport & Services
// Fonctions pures : aucune dependance, testables sans interface.
// Toutes les valeurs viennent de config.js (jamais de prix ecrit ailleurs).

import { TARIFS, coutParKm, partRetourAVide } from "./config.js";
import { verifierDisponibilite, localVersUtc, ajouterJours as ajouterJoursLocal } from "./calendrier.js";
import { aujourdhui, calculerRemise, etatCode, libelleActivitePromo, libelleRemise, normaliserCode, promoSapplique } from "./promos.js";

/* ---------- Outils ---------- */

const enMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const arrondiSup = (valeur, pas = TARIFS.arrondi) => Math.ceil(valeur / pas - 1e-9) * pas;

// Ajoute des minutes a une date + heure locales et renvoie la nouvelle date/heure
export function ajouterMinutes(date, heure, minutes) {
  const [a, mo, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j, h, mi + Math.round(minutes)));
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    heure: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

export function pourcentageNuit(heure, t = TARIFS) {
  const m = enMinutes(heure);
  for (const p of t.nuit) {
    if (m >= enMinutes(p.de) && m < enMinutes(p.a)) return p.pourcentage;
  }
  return 0;
}

// Reconnait la zone de la grille a partir d'un texte d'adresse
const normaliser = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’\-.,"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detecterZone(adresse, t = TARIFS) {
  const texte = " " + normaliser(adresse || "") + " ";
  // L'aeroport est teste en premier ("Boulevard Ben Gourion" n'est PAS l'aeroport)
  const ordre = ["ben_gurion", ...Object.keys(t.zones).filter((z) => z !== "ben_gurion")];
  for (const cle of ordre) {
    for (const alias of t.zones[cle].alias) {
      if (texte.includes(" " + normaliser(alias) + " ") || (/[\u0590-\u05ff]/.test(alias) && texte.includes(alias))) {
        return cle;
      }
    }
  }
  return null;
}

/* ---------- Formule de base ---------- */

// Prix "plein" d'UN trajet (sans retour a vide) : (km x cout/km + heures x tarif horaire) x marge
export function prixFormule(km, minutes, t = TARIFS) {
  return (km * coutParKm(t) + (minutes / 60) * t.tempsParHeure) * t.marge;
}

// Prix d'un aller simple selon le scenario : formule x (1 + part du retour a vide)
function prixAllerSimple(km, minutes, scenario, t) {
  return arrondiSup(prixFormule(km, minutes, t) * (1 + partRetourAVide(scenario, t)), t.arrondi);
}

// Plancher de la grille : s'applique aux trajets depuis ou vers Netanya
function plancherGrille(zoneDepart, zoneArrivee, t = TARIFS) {
  let zone = null;
  if (zoneDepart === "netanya" && zoneArrivee === "netanya") zone = "netanya";
  else if (zoneDepart === "netanya" && zoneArrivee) zone = zoneArrivee;
  else if (zoneArrivee === "netanya" && zoneDepart) zone = zoneDepart;
  if (!zone) return { prix: 0, prixSimple: 0, prixParTrajetAR: 0, zone: null };
  const z = t.zones[zone];
  const g = z.grilleB || {};
  return { prix: z.minimum, prixSimple: g.simple || z.minimum, prixParTrajetAR: g.parTrajetAR || z.minimum, zone };
}

// Trajet local : Netanya vers Netanya, ou court trajet sans ville reconnue de la grille
export function estLocal(d, plancher, t = TARIFS) {
  if (d.zoneDepart === "netanya" && d.zoneArrivee === "netanya") return true;
  return !plancher.zone && !!d.aller && d.aller.km > 0 && d.aller.km <= t.netanyaPlafond.kmMax;
}

// Minimum d'un aller simple : grille B validee si le scenario actif est B
const minimumSimple = (plancher, scenario) => (scenario === "B" ? plancher.prixSimple : plancher.prix);

// Arrets supplementaires (livraison, Hatan & Kala, mise a disposition).
// L'ORDRE DES ARRETS NE COMPTE PAS : on facture le point le plus loin dans chaque direction
// (nord / sud) au prix de la grille B, et chaque autre arret = forfait (Netanya ou sur la route).
// basePrix = prix deja facture pour le trajet principal (il est deduit du complement).
function lignesArrets(lignes, aConfirmer, d, t, libelle, basePrix = 0) {
  const grille = (z) => (t.zones[z].grilleB || {}).simple || t.zones[z].minimum;
  const axeDe = (z) => (z && t.zones[z] ? t.zones[z].axe : null);
  const arrets = d.arretsZones || [];

  // Ce que le trajet principal atteint deja, par direction
  const portee = {};
  const porteeZone = {};
  [d.zoneDepart, d.zoneArrivee].forEach((z) => {
    const a = axeDe(z);
    if (a && a.sens !== "centre" && (portee[a.sens] || 0) < a.rang) {
      portee[a.sens] = a.rang;
      porteeZone[a.sens] = z;
    }
  });

  // Arret le plus loin par direction
  const loin = {};
  arrets.forEach((z, i) => {
    const a = axeDe(z);
    if (a && a.sens !== "centre" && a.rang > ((loin[a.sens] && loin[a.sens].rang) || 0)) loin[a.sens] = { rang: a.rang, zone: z, indice: i };
  });

  // Complement de trajet quand un arret depasse ce que le trajet principal atteint
  const principaux = {};
  Object.keys(loin).forEach((sens) => {
    if (loin[sens].rang > (portee[sens] || 0)) {
      principaux[sens] = loin[sens].indice;
      const deja = portee[sens] ? basePrix : 0;
      lignes.push({ libelle: `Trajet jusqu'à ${t.zones[loin[sens].zone].nom}`, montant: Math.max(0, grille(loin[sens].zone) - deja) });
      // la destination principale devient une etape sur la route
      if (porteeZone[sens] && porteeZone[sens] !== "netanya") {
        lignes.push({ libelle: `Étape principale : ${t.zones[porteeZone[sens]].nom} (sur la route)`, montant: t.arretsSupplementaires.surLaRoute });
      }
    }
  });
  const principalIndices = Object.keys(principaux).map((k) => principaux[k]);

  arrets.forEach((zone, i) => {
    if (principalIndices.includes(i)) return; // deja facture dans le complement de trajet
    const nom = `${libelle} ${i + 1}`;
    const a = axeDe(zone);
    if (zone === "netanya") {
      lignes.push({ libelle: `${nom} (Netanya)`, montant: t.arretsSupplementaires.netanya });
    } else if (a && a.sens !== "centre") {
      lignes.push({ libelle: `${nom} : ${t.zones[zone].nom} (sur la route)`, montant: t.arretsSupplementaires.surLaRoute });
    } else if (zone && t.zones[zone]) {
      lignes.push({ libelle: `${nom} : ${t.zones[zone].nom}`, montant: grille(zone) });
    } else aConfirmer.push(`${nom} : adresse hors grille, prix à confirmer par Rebecca.`);
  });
}

/* ---------- Resultat ---------- */

function construire({ lignes, aConfirmer = [], devis = false, separe = [], details = {} }) {
  const total = devis ? null : lignes.reduce((s, l) => s + (l.montant || 0), 0);
  return { ok: true, bloque: false, devis, total, lignes, aConfirmer, separe, details };
}

const erreur = (message) => ({ ok: false, erreur: message });

/* ---------- Supplements communs ---------- */

function supplementNuit(lignes, libelle, prixBase, heure, t) {
  const pct = pourcentageNuit(heure, t);
  if (!pct) return prixBase;
  const avecNuit = arrondiSup(prixBase * (1 + pct), t.arrondi);
  lignes.push({ libelle: `${libelle} : supplément de nuit ${Math.round(pct * 100)} %`, montant: avecNuit - prixBase });
  return avecNuit;
}

function attenteEnLigne(lignes, minutes, t) {
  if (!minutes || minutes <= 0) return 0;
  const facturables = Math.max(0, minutes - t.attente.toleranceMinutes);
  if (facturables === 0) return 0;
  const pas = t.attente.pasMinutes;
  const tranches = Math.ceil(facturables / pas);
  const montant = (tranches * pas * t.attente.tarifHeure) / 60;
  lignes.push({
    libelle: `Attente : ${minutes} min (dont ${t.attente.toleranceMinutes} min offertes)`,
    montant,
  });
  return montant;
}

/* ---------- Rentabilite reelle (retours a vide inclus) ---------- */

// Gain net = prix - cout reel du vehicule sur TOUS les kilometres, retour a vide compris.
export function analyserRentabilite(d, total, t = TARIFS) {
  const retour = d.allerRetour ? d.retour || d.aller : d.aller; // aller simple : retour a vide
  const km = d.aller.km + retour.km;
  const minutes = d.aller.minutes + retour.minutes + (d.attenteMinutes || 0);
  const cout = km * coutParKm(t);
  const encaisse = total - (d.fraisAnnonces || 0);
  const gainNet = encaisse - cout;
  const heures = minutes / 60;
  const gainNetHeure = gainNet / heures;
  return {
    kmTotal: km,
    heuresTotal: Math.round(heures * 100) / 100,
    retourAVide: !d.allerRetour,
    coutVehicule: Math.round(cout),
    gainNet: Math.round(gainNet),
    gainNetHeure: Math.round(gainNetHeure),
    alerte: gainNetHeure < t.rentabilite.seuilAlerteGainNetHeure,
  };
}

/* ---------- Transport prive et aeroport ---------- */

function calculerTrajet(d, t) {
  if (!d.aller || !(d.aller.km > 0) || !(d.aller.minutes > 0)) return erreur("Distance et durée du trajet manquantes.");

  const lignes = [];
  const aConfirmer = [];
  const attente = d.attenteMinutes || 0;
  const plancher = plancherGrille(d.zoneDepart, d.zoneArrivee, t);
  if (!plancher.zone) aConfirmer.push("Trajet hors axe Netanya : prix à confirmer par Rebecca.");

  const intraNetanya = d.zoneDepart === "netanya" && d.zoneArrivee === "netanya" && d.aller.km <= t.netanyaPlafond.kmMax;
  const plafond = intraNetanya ? t.netanyaPlafond.prix : Infinity;

  const scenario = d.scenario || t.scenarioActif;
  const details = { scenario, plancher: plancher.prix, zonePlancher: plancher.zone };

  if (!d.allerRetour) {
    // ALLER SIMPLE : formule + part du retour a vide (selon le scenario)
    const A = prixFormule(d.aller.km, d.aller.minutes, t);
    const avecRetour = prixAllerSimple(d.aller.km, d.aller.minutes, scenario, t);
    const minSimple = minimumSimple(plancher, scenario); // grille B validée
    const base = Math.min(Math.max(avecRetour, minSimple), plafond);
    details.formuleSansRetour = Math.round(A * 100) / 100;
    details.avecPartRetourAVide = avecRetour;
    lignes.push({ libelle: "Trajet aller simple", montant: base, base: true });
    supplementNuit(lignes, "Aller", base, d.heure, t);
  } else {
    // ALLER-RETOUR : deux trajets reellement calcules, chacun avec son minimum
    const retour = d.retour || d.aller;
    const A1 = prixFormule(d.aller.km, d.aller.minutes, t);
    const A2 = prixFormule(retour.km, retour.minutes, t);
    const base1 = Math.min(Math.max(arrondiSup(A1, t.arrondi), plancher.prixParTrajetAR), plafond);
    const base2 = Math.min(Math.max(arrondiSup(A2, t.arrondi), plancher.prixParTrajetAR), plafond);
    lignes.push({ libelle: "Trajet aller", montant: base1, base: true });
    supplementNuit(lignes, "Aller", base1, d.heure, t);
    lignes.push({ libelle: "Trajet retour", montant: base2, base: true });
    const debutRetour = d.heureRetour
      ? { date: d.dateRetour || d.date, heure: d.heureRetour }
      : ajouterMinutes(d.date, d.heure, d.aller.minutes + attente);
    supplementNuit(lignes, "Retour", base2, debutRetour.heure, t);
    details.debutRetour = debutRetour;
  }

  attenteEnLigne(lignes, attente, t);

  if (d.bagagesSoute > 0) {
    lignes.push({
      libelle: `Bagages en soute : ${d.bagagesSoute} x ${t.bagages.supplementParSoute} ₪`,
      montant: d.bagagesSoute * t.bagages.supplementParSoute,
    });
  }

  if (d.urgent) {
    const immediate = typeof d.minutesAvantDepart === "number" && d.minutesAvantDepart <= t.urgence.seuilImmediatMinutes;
    lignes.push({
      libelle: immediate ? "Urgence (départ dans l'heure)" : "Urgence",
      montant: immediate ? t.urgence.immediate : t.urgence.standard,
    });
  }

  if (d.arrets > 0) aConfirmer.push(`${d.arrets} arrêt(s) supplémentaire(s) : tarif communiqué avant validation.`);
  if (d.fraisAnnonces > 0) lignes.push({ libelle: "Péages / stationnement (annoncés)", montant: d.fraisAnnonces });

  const resultat = construire({ lignes, aConfirmer, details });
  resultat.details.rentabilite = analyserRentabilite(d, resultat.total, t);
  if (resultat.details.rentabilite.alerte) {
    resultat.aConfirmer.push("Rentabilité faible (retour à vide) : vérifier le prix avant de confirmer.");
  }
  return resultat;
}

/* ---------- Livraison ---------- */

function calculerLivraison(d, t) {
  // 0 km est normal (recuperation et livraison a la meme adresse) : seule l'absence de distance est une erreur
  if (!d.aller || !(d.aller.km >= 0)) return erreur("Distance de la livraison manquante.");
  const minutes = d.aller.minutes || (d.aller.km / 40) * 60;
  const B = prixAllerSimple(d.aller.km, minutes, d.scenario, t);
  const grille = (z) => (z && t.zones[z] ? (t.zones[z].grilleB || {}).simple || t.zones[z].minimum : 0);
  const axeDe = (z) => (z && t.zones[z] ? t.zones[z].axe : null);
  const nomZone = (z) => t.zones[z].nom;

  // RESULTAT INDEPENDANT DE L'ORDRE DES ADRESSES : toutes les livraisons forment une tournee.
  // Le point le plus loin (au tarif de la grille) porte le prix de base ; chaque autre livraison = forfait.
  const drops = [d.zoneArrivee, ...(d.arretsZones || [])];
  const loin = {};
  drops.forEach((z, i) => {
    const a = axeDe(z);
    if (a && a.sens !== "centre" && (!loin[a.sens] || a.rang > loin[a.sens].rang)) loin[a.sens] = { rang: a.rang, zone: z, i };
  });
  const directions = Object.values(loin).sort((x, y) => grille(y.zone) - grille(x.zone));
  const couverts = new Set();
  let base = Math.max(t.livraison.minimum, B);
  if (directions.length) {
    base = Math.max(base, grille(directions[0].zone));
    couverts.add(directions[0].i);
  } else couverts.add(0);
  if (base > t.livraison.plafondAvantDevis) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Livraison longue distance : sur devis."], details: { estimation: base } });
  }

  const lignes = [{ libelle: directions.length ? `Livraison jusqu'à ${nomZone(directions[0].zone)}` : "Livraison", montant: base, base: true }];
  supplementNuit(lignes, "Livraison", base, d.heure, t);
  const aConfirmer = [];
  // Une autre direction (ex : nord et sud) = un trajet complet en plus
  directions.slice(1).forEach((x) => {
    lignes.push({ libelle: `Trajet jusqu'à ${nomZone(x.zone)}`, montant: grille(x.zone) });
    couverts.add(x.i);
  });
  drops.forEach((z, i) => {
    if (couverts.has(i)) return;
    const nom = i === 0 ? "Livraison principale" : `Livraison supplémentaire ${i}`;
    const a = axeDe(z);
    if (z === "netanya") lignes.push({ libelle: `${nom} (Netanya)`, montant: t.arretsSupplementaires.netanya });
    else if (a && a.sens !== "centre") lignes.push({ libelle: `${nom} : ${nomZone(z)} (sur la route)`, montant: t.arretsSupplementaires.surLaRoute });
    else aConfirmer.push(`${nom} : adresse hors grille, prix à confirmer par Rebecca.`);
  });
  if (d.urgent) lignes.push({ libelle: "Livraison urgente", montant: t.livraison.urgence });
  if (d.zoneArrivee && d.zoneArrivee !== "netanya") aConfirmer.push("Livraison hors secteur Netanya : supplément annoncé avant validation.");
  return construire({ lignes, aConfirmer });
}

/* ---------- Courses et achats ---------- */

function calculerCourses(d, t) {
  if (!(d.articles > 0)) return erreur("Nombre d'articles manquant.");
  const grille = d.courseFaiteParRebecca ? t.courses.courseFaiteParRebecca : t.courses.achatsDejaPayes;
  const palier = grille.find((p) => d.articles <= p.max);
  if (!palier) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Plus de 10 articles : sur devis."] });
  }
  const lignes = [
    {
      libelle: d.courseFaiteParRebecca
        ? `Courses réalisées par Rebecca (jusqu'à ${palier.max} articles)`
        : `Récupération d'achats déjà payés (jusqu'à ${palier.max} articles)`,
      montant: palier.prix,
      base: true,
    },
  ];
  const separe = [];
  const aConfirmer = [];
  if (d.courseFaiteParRebecca && d.rebeccaAvanceArgent) {
    if (d.montantTicket > 0) {
      lignes.push({ libelle: "Frais de gestion (10 % du ticket)", montant: Math.ceil(d.montantTicket * t.courses.fraisAvanceAchats) });
      separe.push({ libelle: "Achats avancés par Rebecca (à rembourser)", montant: d.montantTicket });
    } else {
      aConfirmer.push("Montant du ticket inconnu : 10 % de frais de gestion ajoutés sur le ticket réel.");
    }
  } else if (d.montantTicket > 0) {
    separe.push({ libelle: "Achats payés séparément par le client", montant: d.montantTicket });
  }
  if (d.zoneArrivee && d.zoneArrivee !== "netanya") aConfirmer.push("Déplacement hors secteur : supplément annoncé à l'avance.");
  return construire({ lignes, aConfirmer, separe });
}

/* ---------- Hatan & Kala ---------- */

function calculerHatanKala(d, t) {
  if (d.vehiculeReserve) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Véhicule réservé sur la durée : devis personnalisé."] });
  }
  const scenario = d.scenario || t.scenarioActif;
  const plancher = plancherGrille(d.zoneDepart, d.zoneArrivee, t);
  let base = t.hatanKala.base;
  const details = {};
  if (!estLocal(d, plancher, t)) {
    const B = d.aller && d.aller.km > 0 && d.aller.minutes > 0 ? prixAllerSimple(d.aller.km, d.aller.minutes, scenario, t) : 0;
    const trajet = Math.max(minimumSimple(plancher, scenario), B);
    details.trajet = trajet;
    base = Math.max(base, arrondiSup(trajet + t.hatanKala.prestationHorsNetanya, t.arrondi));
  }
  const lignes = [{ libelle: "Transport Hatan & Kala", montant: base, base: true }];
  supplementNuit(lignes, "Transport", base, d.heure, t);
  const aConfirmer = [];
  lignesArrets(lignes, aConfirmer, d, t, "Arrêt supplémentaire", base);
  if (d.decoration) lignes.push({ libelle: "Décoration du véhicule", montant: t.hatanKala.decoration });
  return construire({ lignes, aConfirmer, details });
}

/* ---------- Petit demenagement ---------- */

function calculerDemenagement(d, t) {
  if (d.categorie === "important") {
    return construire({ lignes: [], devis: true, aConfirmer: ["Volume important ou objets lourds : sur devis."] });
  }
  if (d.categorie !== "valises" && d.categorie !== "cartons") return erreur("Type de déménagement manquant.");
  const scenario = d.scenario || t.scenarioActif;
  const lignes = [{ libelle: "Petit déménagement (prestation de base)", montant: t.demenagement[d.categorie], base: true }];
  const aConfirmer = [];
  const plancher = plancherGrille(d.zoneDepart, d.zoneArrivee, t);
  if (!estLocal(d, plancher, t)) {
    const B = d.aller && d.aller.km > 0 && d.aller.minutes > 0 ? prixAllerSimple(d.aller.km, d.aller.minutes, scenario, t) : 0;
    const trajet = Math.max(minimumSimple(plancher, scenario), B);
    if (trajet > 0) lignes.push({ libelle: "Trajet hors Netanya", montant: trajet, base: true });
    else if (d.zoneDepart || d.zoneArrivee || d.aller) aConfirmer.push("Trajet hors Netanya : prix à confirmer par Rebecca.");
  }
  const etages = (etage, ascenseur) => (ascenseur === "oui" || !(etage >= 2) ? 0 : (etage - 1) * t.demenagement.parEtageSansAscenseur);
  const eDep = etages(d.etageDepart, d.ascenseurDepart);
  const eArr = etages(d.etageArrivee, d.ascenseurArrivee);
  if (eDep > 0) lignes.push({ libelle: `Étages au départ sans ascenseur (${d.etageDepart})`, montant: eDep });
  if (eArr > 0) lignes.push({ libelle: `Étages à l'arrivée sans ascenseur (${d.etageArrivee})`, montant: eArr });
  if (d.manutention) aConfirmer.push("Manutention : sur devis.");
  if (d.trajets > 1) aConfirmer.push(`${d.trajets} trajets : prix ajusté sur devis.`);
  return construire({ lignes, aConfirmer });
}

/* ---------- Mise a disposition / attente / evenements ---------- */

function calculerMiseADisposition(d, t) {
  if (!(d.dureeMinutes > 0)) return erreur("Durée manquante.");
  const pas = t.attente.pasMinutes;
  const minMin = t.attente.miseADispositionMinHeures * 60;
  const facturees = Math.max(minMin, Math.ceil(d.dureeMinutes / pas) * pas);
  const lignes = [
    {
      libelle: `Mise à disposition : ${facturees / 60} h facturée(s) (minimum ${t.attente.miseADispositionMinHeures} h)`,
      montant: (facturees * t.attente.tarifHeure) / 60,
      base: true,
    },
  ];
  const aConfirmer = [];
  let prixUnTrajet = 0;
  const plancher = plancherGrille(d.zoneDepart, d.zoneArrivee, t);
  if (d.zoneDepart || d.zoneArrivee || d.aller) {
    if (!estLocal(d, plancher, t)) {
      const formule = d.aller && d.aller.km > 0 && d.aller.minutes > 0 ? arrondiSup(prixFormule(d.aller.km, d.aller.minutes, t), t.arrondi) : 0;
      const parTrajet = Math.max(plancher.prixParTrajetAR, formule);
      prixUnTrajet = parTrajet;
      if (parTrajet > 0) lignes.push({ libelle: `Trajet aller-retour (2 x ${parTrajet} ₪)`, montant: parTrajet * 2, base: true });
      else aConfirmer.push("Déplacement hors Netanya : prix à confirmer par Rebecca.");
    }
  }
  lignesArrets(lignes, aConfirmer, d, t, "Arrêt supplémentaire", prixUnTrajet);
  return construire({ lignes, aConfirmer, details: { minutesFacturees: facturees } });
}

/* ---------- Ramassage scolaire ---------- */

// Prix d'UN trajet domicile <-> ecole (meme regle pour le site et pour le devis a plusieurs enfants)
export function prixTrajetRamassage(d, t = TARIFS) {
  const plancher = plancherGrille(d.zoneDepart, d.zoneArrivee, t);
  const horsAxe = !plancher.zone && !estLocal(d, plancher, t);
  const intraNetanya = d.zoneDepart === "netanya" && d.zoneArrivee === "netanya" && d.aller.km <= t.netanyaPlafond.kmMax;
  const plafond = intraNetanya ? t.netanyaPlafond.prix : Infinity;
  const formule = arrondiSup(prixFormule(d.aller.km, d.aller.minutes, t), t.arrondi);
  return { parTrajet: Math.min(Math.max(formule, plancher.prixParTrajetAR), plafond), horsAxe };
}

function calculerRamassage(d, t) {
  if (!d.aller || !(d.aller.km > 0) || !(d.aller.minutes > 0)) return erreur("Distance du trajet manquante.");
  const lignes = [];
  const aConfirmer = [];
  const { parTrajet, horsAxe } = prixTrajetRamassage(d, t);
  if (horsAxe) aConfirmer.push("Trajet hors axe Netanya : prix à confirmer par Rebecca.");
  const trajets = d.trajets === 2 ? 2 : 1;
  const hebdo = d.frequence === "semaine";
  const jours = hebdo ? (d.joursSemaine || []).length : 1;
  if (hebdo && jours === 0) return erreur("Choisissez au moins un jour.");
  const details = { parTrajet, trajets, jours, hebdo };

  if (!hebdo) {
    lignes.push({ libelle: trajets === 2 ? `Ramassage : 2 trajets x ${parTrajet} ₪` : "Ramassage : 1 trajet", montant: parTrajet * trajets, base: true });
    supplementNuit(lignes, "Trajet 1", parTrajet, d.heure, t);
    if (trajets === 2) supplementNuit(lignes, "Trajet 2", parTrajet, d.heure2 || d.heure, t);
  } else {
    const brut = parTrajet * trajets * jours;
    const palier = [...t.ramassage.reductions].sort((a, b) => b.minJours - a.minJours).find((r) => jours >= r.minJours);
    lignes.push({ libelle: `Forfait semaine : ${jours} jour(s) x ${trajets} trajet(s) x ${parTrajet} ₪`, montant: brut, base: true });
    if (palier) {
      const apres = arrondiSup(brut * (1 - palier.pourcentage), t.arrondi);
      if (apres < brut) lignes.push({ libelle: `Réduction forfait ${Math.round(palier.pourcentage * 100)} %`, montant: apres - brut, base: true });
      details.reduction = Math.round(palier.pourcentage * 100);
    }
    aConfirmer.push("Forfait par semaine : Rebecca confirme les jours et les horaires avec vous.");
  }
  const r = construire({ lignes, aConfirmer, details });
  // Rentabilite sur une journee type (retour a vide pris en compte si un seul trajet)
  const totalJour = r.total / jours;
  r.details.rentabilite = analyserRentabilite({ ...d, allerRetour: trajets === 2, retour: d.aller }, totalJour, t);
  if (r.details.rentabilite.alerte) r.aConfirmer.push("Rentabilité faible (retour à vide) : vérifier le prix avant de confirmer.");
  return r;
}

/* ---------- Disponibilite : Chabbat, fetes, fermetures exceptionnelles ---------- */

// Liste des creneaux occupes par la prestation (fermetures ET agenda).
// Un aller simple occupe aussi le retour a vide vers Netanya : Rebecca ne peut pas etre ailleurs.
export function creneauxOccupes(d, t = TARIFS) {
  const defaut = t.dureeParDefautMinutes;
  const att = d.attenteMinutes || 0;
  switch (d.service) {
    case "transport":
    case "aeroport": {
      if (!d.aller || !(d.aller.minutes > 0)) return [{ date: d.date, heure: d.heure, minutes: 0 }];
      if (!d.allerRetour) return [{ date: d.date, heure: d.heure, minutes: d.aller.minutes * 2 + att }];
      const retour = d.retour || d.aller;
      if (d.heureRetour) {
        return [
          { date: d.date, heure: d.heure, minutes: d.aller.minutes },
          { date: d.dateRetour || d.date, heure: d.heureRetour, minutes: retour.minutes },
        ];
      }
      return [{ date: d.date, heure: d.heure, minutes: d.aller.minutes + att + retour.minutes }];
    }
    case "livraison":
      return [{ date: d.date, heure: d.heure, minutes: d.aller && d.aller.minutes ? d.aller.minutes * 2 : defaut.livraison }];
    case "attente":
      return [{ date: d.date, heure: d.heure, minutes: d.dureeMinutes || 60 }];
    case "ramassage": {
      const minutes = d.aller && d.aller.minutes ? d.aller.minutes * 2 : 60;
      const heures = [d.heure, ...(d.trajets === 2 && d.heure2 ? [d.heure2] : [])];
      const dates = [];
      if (d.frequence === "semaine") {
        for (let k = 0; k < 7; k++) {
          const jour = ajouterJoursLocal(d.date, k);
          const [a, m, j] = jour.split("-").map(Number);
          if ((d.joursSemaine || []).includes(new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay())) dates.push(jour);
        }
      } else dates.push(d.date);
      return dates.flatMap((date) => heures.map((heure) => ({ date, heure, minutes })));
    }
    default:
      return [{ date: d.date, heure: d.heure, minutes: d.dureeEstimeeMinutes || defaut[d.service] || 60 }];
  }
}

// Conflits d'agenda : une demande ne peut pas chevaucher une course DEJA CONFIRMEE
// (tampon reserve apres chaque mission). Les demandes non confirmees ne bloquent rien.
const intervallesAgenda = (d, t) =>
  creneauxOccupes(d, t).map((c) => {
    const debut = localVersUtc(c.date, c.heure);
    return { debut, fin: debut + (c.minutes + t.agenda.tamponMinutes) * 60000 };
  });

export function trouverConflits(demande, reservations = [], t = TARIFS) {
  const miens = intervallesAgenda(demande, t);
  const conflits = [];
  for (const r of reservations) {
    if (r.statut !== "confirmee" || !r.demande) continue;
    if (demande.id && r.id === demande.id) continue;
    const autres = intervallesAgenda(r.demande, t);
    if (miens.some((a) => autres.some((b) => a.debut < b.fin && a.fin > b.debut))) {
      conflits.push({ id: r.id, date: r.demande.date, heure: r.demande.heure, service: r.demande.service });
    }
  }
  return conflits;
}

function verifierFermetures(d, t) {
  for (const c of creneauxOccupes(d, t)) {
    const p = verifierDisponibilite(c.date, c.heure, c.minutes, t, d.service); // J4b : « si l'un de nous est libre »
    if (p) {
      return {
        ok: true,
        bloque: true,
        raison: `Indisponible : ${p.label}.`,
        periode: { label: p.label, debut: p.debut, fin: p.fin, type: p.type },
        disponibleA: p.fin,
        total: null,
        lignes: [],
        aConfirmer: [],
        separe: [],
        details: {},
      };
    }
  }
  return null;
}

/* ---------- Code promo ---------- */

// Remise sur le TARIF DE BASE seulement (lignes marquees base: true).
// Jamais sur : nuit, urgence, bagages, arrets, etages, colis, attente, peages, frais de gestion.
// Les codes viennent de t.codesPromo (lus dans Firestore par le formulaire) : aucun code n'est ecrit dans le programme.
// Le prix final est arrondi au shekel superieur.
function appliquerPromo(r, d, t) {
  const code = normaliserCode(d.codePromo);
  if (!code || !r || !r.ok || r.bloque || r.total == null) return r;
  const promo = t.codesPromo && t.codesPromo[code];
  const refuse = (statut, message) => ({ ...r, aConfirmer: [...r.aConfirmer, message], details: { ...r.details, promo: { statut, code } } });
  if (!promo) return refuse("inconnu", `Code promo « ${code} » non reconnu : aucune réduction appliquée.`);
  const etat = etatCode(promo, aujourdhui());
  if (etat === "expire") return refuse("expire", `Code promo « ${code} » expiré : aucune réduction appliquée.`);
  if (etat !== "actif") return refuse("inactif", `Code promo « ${code} » non valable : aucune réduction appliquée.`);
  // Lot C : un code cree pour une autre activite (ou pour des articles precis) ne s'applique pas ici
  if (!promoSapplique(promo, { service: d.service })) return refuse("autre_activite", `Code promo « ${code} » réservé à : ${libelleActivitePromo(promo)}. Aucune réduction appliquée.`);
  const eligible = r.lignes.filter((l) => l.base).reduce((s, l) => s + (l.montant || 0), 0);
  const reduction = calculerRemise(eligible, promo);
  if (reduction <= 0) return r;
  const lignes = [...r.lignes, { libelle: `Code promo ${code} (${libelleRemise(promo)})`, montant: -reduction }];
  const total = Math.ceil(r.total - reduction - 1e-9);
  const details = { ...r.details, promo: { statut: "applique", code, reduction } };
  if (details.rentabilite) details.rentabilite = analyserRentabilite(d, total, t); // gain reel apres reduction
  return { ...r, lignes, total, details };
}

/* ---------- Point d'entree unique ---------- */

export function calculer(demande, t = TARIFS) {
  const d = demande;
  if (!d || !d.service) return erreur("Service manquant.");
  if (!d.date || !d.heure) return erreur("Date et heure manquantes.");

  const ferme = verifierFermetures(d, t);
  if (ferme) return ferme;

  let r;
  switch (d.service) {
    case "transport":
    case "aeroport":
      r = calculerTrajet(d, t);
      break;
    case "livraison":
      r = calculerLivraison(d, t);
      break;
    case "courses":
      r = calculerCourses(d, t);
      break;
    case "hatan_kala":
      r = calculerHatanKala(d, t);
      break;
    case "demenagement":
      r = calculerDemenagement(d, t);
      break;
    case "attente":
      r = calculerMiseADisposition(d, t);
      break;
    case "ramassage":
      r = calculerRamassage(d, t);
      break;
    default:
      return erreur(`Service inconnu : ${d.service}`);
  }
  return appliquerPromo(r, d, t);
}

// Compare les trois scenarios A, B et C pour une meme demande
export function comparerScenarios(demande, t = TARIFS) {
  const sortie = {};
  for (const cle of Object.keys(t.scenarios)) {
    const r = calculer({ ...demande, scenario: cle }, t);
    sortie[cle] = {
      nom: t.scenarios[cle].nom,
      total: r.total,
      devis: !!r.devis,
      bloque: !!r.bloque,
      gainNet: r.details && r.details.rentabilite ? r.details.rentabilite.gainNet : null,
      gainNetHeure: r.details && r.details.rentabilite ? r.details.rentabilite.gainNetHeure : null,
      alerte: r.details && r.details.rentabilite ? r.details.rentabilite.alerte : null,
    };
  }
  return sortie;
}
