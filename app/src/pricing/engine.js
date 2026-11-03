// MOTEUR TARIFAIRE - Rebecca Transport & Services
// Fonctions pures : aucune dependance, testables sans interface.
// Toutes les valeurs viennent de config.js (jamais de prix ecrit ailleurs).

import { TARIFS, coutParKm, partRetourAVide } from "./config.js";
import { verifierDisponibilite, localVersUtc } from "./calendrier.js";

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
    const minSimple = scenario === "B" ? plancher.prixSimple : plancher.prix; // grille B validée
    const base = Math.min(Math.max(avecRetour, minSimple), plafond);
    details.formuleSansRetour = Math.round(A * 100) / 100;
    details.avecPartRetourAVide = avecRetour;
    lignes.push({ libelle: "Trajet aller simple", montant: base });
    supplementNuit(lignes, "Aller", base, d.heure, t);
  } else {
    // ALLER-RETOUR : deux trajets reellement calcules, chacun avec son minimum
    const retour = d.retour || d.aller;
    const A1 = prixFormule(d.aller.km, d.aller.minutes, t);
    const A2 = prixFormule(retour.km, retour.minutes, t);
    const base1 = Math.min(Math.max(arrondiSup(A1, t.arrondi), plancher.prixParTrajetAR), plafond);
    const base2 = Math.min(Math.max(arrondiSup(A2, t.arrondi), plancher.prixParTrajetAR), plafond);
    lignes.push({ libelle: "Trajet aller", montant: base1 });
    supplementNuit(lignes, "Aller", base1, d.heure, t);
    lignes.push({ libelle: "Trajet retour", montant: base2 });
    const debutRetour = d.heureRetour
      ? { date: d.dateRetour || d.date, heure: d.heureRetour }
      : ajouterMinutes(d.date, d.heure, d.aller.minutes + attente);
    supplementNuit(lignes, "Retour", base2, debutRetour.heure, t);
    details.debutRetour = debutRetour;
  }

  attenteEnLigne(lignes, attente, t);

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
  if (d.arrets > 0) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Plusieurs adresses sur un même parcours : sur devis."] });
  }
  if (!d.aller || !(d.aller.km > 0)) return erreur("Distance de la livraison manquante.");
  const minutes = d.aller.minutes || (d.aller.km / 40) * 60;
  const B = prixAllerSimple(d.aller.km, minutes, d.scenario, t);
  const base = Math.max(t.livraison.minimum, B);
  if (base > t.livraison.plafondAvantDevis) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Livraison longue distance : sur devis."], details: { estimation: base } });
  }
  const lignes = [{ libelle: "Livraison", montant: base }];
  supplementNuit(lignes, "Livraison", base, d.heure, t);
  if (d.urgent) lignes.push({ libelle: "Livraison urgente", montant: t.livraison.urgence });
  const aConfirmer = [];
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
  if (d.arrets > 1 || d.vehiculeReserve) {
    return construire({ lignes: [], devis: true, aConfirmer: ["Plusieurs arrêts ou véhicule réservé : devis personnalisé."] });
  }
  let base = t.hatanKala.base;
  const details = {};
  if (d.aller && d.aller.km > 0 && d.aller.minutes > 0) {
    const B = prixAllerSimple(d.aller.km, d.aller.minutes, d.scenario, t);
    details.formule = B;
    base = Math.max(base, B);
  }
  const lignes = [{ libelle: "Transport Hatan & Kala", montant: base }];
  supplementNuit(lignes, "Transport", base, d.heure, t);
  if (d.decoration) lignes.push({ libelle: "Décoration du véhicule", montant: t.hatanKala.decoration });
  return construire({ lignes, details });
}

/* ---------- Petit demenagement ---------- */

function calculerDemenagement(d, t) {
  if (d.categorie === "important") {
    return construire({ lignes: [], devis: true, aConfirmer: ["Volume important ou objets lourds : sur devis."] });
  }
  if (d.categorie !== "valises" && d.categorie !== "cartons") return erreur("Type de déménagement manquant.");
  let base = t.demenagement[d.categorie];
  if (d.aller && d.aller.km > 0 && d.aller.minutes > 0) {
    base = Math.max(base, prixAllerSimple(d.aller.km, d.aller.minutes, d.scenario, t));
  }
  const aConfirmer = [];
  if (d.manutention) aConfirmer.push("Manutention : sur devis.");
  if (d.trajets > 1) aConfirmer.push(`${d.trajets} trajets : prix ajusté sur devis.`);
  return construire({ lignes: [{ libelle: "Petit déménagement (à partir de)", montant: base }], aConfirmer });
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
    },
  ];
  const aConfirmer = [];
  if (d.arrets > 0) aConfirmer.push("Plusieurs arrêts ou retour tardif : prix convenu à l'avance.");
  return construire({ lignes, aConfirmer, details: { minutesFacturees: facturees } });
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
    const p = verifierDisponibilite(c.date, c.heure, c.minutes, t);
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

/* ---------- Point d'entree unique ---------- */

export function calculer(demande, t = TARIFS) {
  const d = demande;
  if (!d || !d.service) return erreur("Service manquant.");
  if (!d.date || !d.heure) return erreur("Date et heure manquantes.");

  const ferme = verifierFermetures(d, t);
  if (ferme) return ferme;

  switch (d.service) {
    case "transport":
    case "aeroport":
      return calculerTrajet(d, t);
    case "livraison":
      return calculerLivraison(d, t);
    case "courses":
      return calculerCourses(d, t);
    case "hatan_kala":
      return calculerHatanKala(d, t);
    case "demenagement":
      return calculerDemenagement(d, t);
    case "attente":
      return calculerMiseADisposition(d, t);
    default:
      return erreur(`Service inconnu : ${d.service}`);
  }
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
