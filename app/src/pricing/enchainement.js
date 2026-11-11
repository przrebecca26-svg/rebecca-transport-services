// ENCHAINEMENT DES COURSES - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// Quand Rebecca accepte une course, on verifie qu'elle a le temps de venir de la course d'avant
// et d'aller a la course d'apres, le meme jour, avec une marge de securite (30 min par defaut).
// Decision du 8 nov. 2026 : on bloque le trajet jusqu'a la course suivante + la marge ;
// le retour a vide n'est PAS bloque. Les durees de trajet viennent d'OSRM (sans circulation reelle).
// Jamais de blocage automatique : c'est un avertissement, Rebecca decide.

import { AEROPORT } from "../services.js";

export const MARGE_DEFAUT = 30; // minutes, modifiable dans Reglages (reglages/enchainement.margeMinutes)
export const DUREE_TRAJET_INCONNUE = 45; // minutes comptees quand la demande n'a pas de duree estimee

// Temps estime sur place (prise en charge, chargement, remise...) en minutes, par service
export const SUR_PLACE = { nails: 0, hair: 0, slim: 0, regenx: 0,
  transport: 15,
  aeroport: 20,
  livraison: 10, // par adresse de livraison
  courses: 20, // 45 si Rebecca fait les courses
  hatan_kala: 30,
  demenagement: 45,
  ramassage: 10,
  attente: 0, // la duree reservee compte deja tout
};

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export const versMinutes = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const versHeure = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + "h" + String(m % 60).padStart(2, "0");
};
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay(); // 0 = dimanche
};
const adr = (x) => (x && typeof x === "object" && x.label ? x : null);
const premiers = (...liste) => liste.map(adr).filter(Boolean);

// Adresses de debut et de fin d'une course (aller), selon le service
export function extremites(d) {
  const v = d.details || {};
  switch (d.service) {
    case "aeroport":
      return v.direction === "depuis" ? { debut: AEROPORT, fin: adr(v.adresse) } : { debut: adr(v.adresse), fin: AEROPORT };
    case "livraison": {
      const livraisons = premiers(v.livraison, v.arretL2, v.arretL3, v.arretL4, v.arretL5);
      return { debut: adr(v.recuperation), fin: livraisons[livraisons.length - 1] || null };
    }
    case "courses":
      return { debut: null, fin: adr(v.livraison) }; // le magasin n'a pas d'adresse precise
    case "ramassage":
      return { debut: adr(v.domicile), fin: adr(v.ecole) };
    default:
      return { debut: adr(v.depart), fin: adr(v.arrivee) };
  }
}

// Duree d'une course (trajet + temps sur place), en minutes
export function dureeCourse(d) {
  const v = d.details || {};
  const trajetConnu = typeof d.minutesEstimees === "number" && d.minutesEstimees > 0;
  const trajet = trajetConnu ? d.minutesEstimees : DUREE_TRAJET_INCONNUE;
  let surPlace = SUR_PLACE[d.service] != null ? SUR_PLACE[d.service] : 15;
  if (d.service === "livraison") surPlace *= Math.max(1, Number(v.nbLivraisons) || 1);
  if (d.service === "courses" && v.typePrestation === "courses") surPlace = 45;
  if (d.service === "attente") {
    const reserve = (Number(v.dureeHeures) || 1) * 60 + (Number(v.dureeSupp) || 0);
    return { minutes: Math.round(reserve + (trajetConnu ? d.minutesEstimees : 0)), estimee: false };
  }
  return { minutes: Math.round(trajet + surPlace), estimee: !trajetConnu };
}

// Blocs occupes par une demande a une date donnee (aller, retour le meme jour, ramassage hebdomadaire...)
// bloc = { id, titre, nom, debut, fin (minutes depuis minuit), depart, arrivee, estimee }
export function blocsPourDate(d, date) {
  if (!DATE_OK.test(date || "") || !DATE_OK.test(d.date || "")) return [];
  const v = d.details || {};
  const { debut, fin } = extremites(d);
  const duree = dureeCourse(d);
  const base = { id: d.id, titre: d.serviceTitre || d.service, nom: d.nom || "", estimee: duree.estimee };
  const blocs = [];
  const ajouter = (heure, depart, arrivee, partie) => {
    const h = versMinutes(heure);
    if (h == null) return;
    blocs.push({ ...base, partie, debut: h, fin: h + duree.minutes, depart, arrivee });
  };

  if (d.service === "ramassage") {
    const hebdo = v.frequence === "semaine";
    const jours = Array.isArray(d.joursSemaine) ? d.joursSemaine : [0, 1, 2, 3, 4, 5].filter((i) => v["jour" + i] === true || v["jour" + i] === "true");
    const ceJour = hebdo ? date >= d.date && jours.includes(jourSemaine(date)) : date === d.date;
    if (!ceJour) return [];
    if (v.trajetsRamassage === "apres") ajouter(d.heure, fin, debut, "après-midi");
    else ajouter(d.heure, debut, fin, "matin");
    if (v.trajetsRamassage === "deux") ajouter(v.heure2, fin, debut, "après-midi");
    return blocs;
  }

  if (date === d.date) ajouter(d.heure, debut, fin, "aller");
  if (v.typeTrajet === "ar" && v.dateRetour === date) ajouter(v.heureRetour, fin, debut, "retour");
  return blocs;
}

// Les voisins de chaque bloc de la course candidate, parmi les courses deja acceptees du meme jour
// Renvoie [{ date, bloc, avant: blocVoisin|null, apres: blocVoisin|null }]
export function voisins(candidate, acceptees, dates) {
  const res = [];
  for (const date of dates) {
    const autres = acceptees.filter((x) => x.id !== candidate.id).flatMap((x) => blocsPourDate(x, date));
    for (const bloc of blocsPourDate(candidate, date)) {
      const avant = autres.filter((b) => b.debut <= bloc.debut).sort((a, b) => b.debut - a.debut)[0] || null;
      const apres = autres.filter((b) => b.debut > bloc.debut).sort((a, b) => a.debut - b.debut)[0] || null;
      res.push({ date, bloc, avant, apres });
    }
  }
  return res;
}

// Dates concernees par une candidate (jour de la course, jour du retour)
export function datesDe(d) {
  const v = d.details || {};
  const dates = [d.date];
  if (v.typeTrajet === "ar" && DATE_OK.test(v.dateRetour || "") && v.dateRetour !== d.date) dates.push(v.dateRetour);
  return dates.filter((x) => DATE_OK.test(x || ""));
}

// Trajets a calculer : de la fin du bloc d'avant au debut du bloc, et de la fin du bloc au debut du bloc d'apres
export function trajetsACalculer(liste) {
  const paires = [];
  for (const v of liste) {
    if (v.avant) paires.push({ de: v.avant.arrivee, vers: v.bloc.depart });
    if (v.apres) paires.push({ de: v.bloc.arrivee, vers: v.apres.depart });
  }
  return paires;
}

export const clePaire = (de, vers) => (de && vers && typeof de.lat === "number" && typeof vers.lat === "number" ? `${de.lat},${de.lon}>${vers.lat},${vers.lon}` : "");

// Verification finale. trajets : { [clePaire]: minutes } (absent = trajet inconnu)
// Renvoie { ok, problemes: [...], details: [...] } ; un probleme = un trou trop court ou un chevauchement
export function verifier(liste, trajets, marge = MARGE_DEFAUT) {
  const details = [];
  const problemes = [];
  const examiner = (date, premier, second, sens) => {
    const cle = clePaire(premier.arrivee, second.depart);
    const trajet = cle && trajets[cle] != null ? trajets[cle] : null;
    const libre = second.debut - premier.fin;
    const besoin = (trajet || 0) + marge;
    const manque = besoin - libre;
    const item = { date, sens, premier, second, libre, trajet, marge, manque, trajetInconnu: trajet == null };
    details.push(item);
    if (manque > 0) problemes.push(item);
  };
  for (const v of liste) {
    if (v.avant) examiner(v.date, v.avant, v.bloc, "avant");
    if (v.apres) examiner(v.date, v.bloc, v.apres, "apres");
  }
  return { ok: problemes.length === 0, problemes, details };
}

const ville = (a) => {
  if (!a || !a.label) return "l'adresse suivante";
  const morceaux = String(a.label).split(",").map((s) => s.trim()).filter(Boolean);
  return morceaux[morceaux.length - 1]; // la ville est a la fin du libelle (rue, quartier, ville)
};

// Phrase claire pour Rebecca
export function phrase(item) {
  const { premier, second, trajet, marge, manque, libre } = item;
  const fin = versHeure(premier.fin);
  const debut = versHeure(second.debut);
  if (libre < 0) {
    return `Les deux courses se chevauchent : « ${premier.titre} » (${premier.nom}) finit vers ${fin}, alors que « ${second.titre} » (${second.nom}) commence à ${debut}.`;
  }
  const trajetTexte = trajet == null ? "durée du trajet inconnue (adresse sans position)" : `il faut environ ${trajet} min pour rejoindre ${ville(second.depart)}`;
  return `Tu finis « ${premier.titre} » (${premier.nom}) vers ${fin} à ${ville(premier.arrivee)}, ${trajetTexte}, et « ${second.titre} » (${second.nom}) commence à ${debut} : avec ta marge de ${marge} min, il te manque ${Math.ceil(manque)} min.`;
}

// Message WhatsApp pour proposer un autre horaire
export function messageAutreHoraire(d) {
  return `Bonjour ${d.nom}, merci pour votre demande (${d.serviceTitre}). À ${d.heure} je ne suis malheureusement pas disponible. Est-ce qu'un autre horaire vous conviendrait ? Rebecca.`;
}
