// QUI FAIT LA COURSE ET AVEC QUOI (Lot J, seance J3, 9 nov. 2026) - regles pures - Rebecca Services
// Decisions de Rebecca (9 nov. 2026, 20h08-20h12) :
//  - chaque course a « qui la fait » (Rebecca ou Jeremy) ; anciennes courses = Rebecca ;
//  - en acceptant une demande, c'est la personne qui accepte qui la fait (modifiable) ;
//  - transfert DIRECT entre eux deux : la course passe tout de suite chez l'autre, message WhatsApp pret ;
//  - chacun remplit ses vehicules (Rebecca sa voiture et si elle la prete ; Jeremy son scooter et son velo) ;
//  - prix client identique quel que soit le vehicule (seul le benefice change).

import { ADMIN_ID, TYPES_VEHICULE, attribueA, conseillerVehicule } from "./equipe.js";

export { attribueA };

// Valeurs de depart des vehicules (modifiables par leur proprietaire). Scooter et moto : provisoires.
export const MODELES_VEHICULE = {
  voiture: { consommationL100: 9, prixLitre: 8.03, usureParKm: 1.1 },
  moto: { consommationL100: 4.5, prixLitre: 8.03, usureParKm: 0.5 },
  scooter: { consommationL100: 3, prixLitre: 8.03, usureParKm: 0.3 },
  velo: { consommationL100: 0, prixLitre: 0, usureParKm: 0 },
};
export const ID_VOITURE_REBECCA = "voiture-rebecca";

// Toute l'equipe : Rebecca d'abord (fiche equipe/rebecca facultative), puis les membres actifs
export function membresDe({ ficheRebecca = null, fiches = [] } = {}) {
  const rebecca = { id: ADMIN_ID, nom: "Rebecca", telephone: "", actif: true, services: null, ...(ficheRebecca || {}) };
  rebecca.id = ADMIN_ID;
  rebecca.modes = (ficheRebecca && ficheRebecca.modes && ficheRebecca.modes.length ? ficheRebecca.modes : ["voiture"]);
  return [rebecca, ...fiches.filter((f) => f.id !== ADMIN_ID && f.actif === true)];
}
export const nomDe = (membres, id) => ((membres || []).find((m) => m.id === id) || { nom: id === ADMIN_ID ? "Rebecca" : "?" }).nom || "?";
export const initiale = (membres, id) => String(nomDe(membres, id)).trim().charAt(0).toUpperCase() || "?";

// Vehicules effectifs : ceux enregistres, plus la voiture de Rebecca par defaut tant qu'elle n'a rien rempli
export function vehiculesEffectifs(vehicules = []) {
  const liste = vehicules.filter((v) => v && v.id);
  if (!liste.some((v) => v.proprietaire === ADMIN_ID && v.type === "voiture")) {
    liste.unshift({ id: ID_VOITURE_REBECCA, nom: "Voiture de Rebecca", type: "voiture", proprietaire: ADMIN_ID, partageAvec: [], actif: true, ...MODELES_VEHICULE.voiture });
  }
  return liste;
}

// Vehicule utilise par chaque course : le sien, sinon la voiture de Rebecca pour ses courses a elle
// (les courses d'un coequipier sans vehicule choisi ne bloquent aucun vehicule)
export function avecVehicule(demandes = [], vehicules = []) {
  const voiture = vehiculesEffectifs(vehicules).find((v) => v.proprietaire === ADMIN_ID && v.type === "voiture");
  return demandes.map((d) => (d.vehicule || attribueA(d) !== ADMIN_ID ? d : { ...d, vehicule: voiture ? voiture.id : undefined }));
}

// Conseil « avec quoi y aller » pour la personne qui fait la course
export function conseilPour(membre, mission, { vehicules = [], demandes = [], marge } = {}) {
  if (!membre) return [];
  return conseillerVehicule(membre, mission, { vehicules: vehiculesEffectifs(vehicules), demandes: avecVehicule(demandes, vehicules), marge });
}

// Filtre « Moi / Rebecca / Jeremy / Tous »
export function filtrerPersonne(demandes = [], filtre = "tous", moi = ADMIN_ID) {
  if (!filtre || filtre === "tous") return demandes;
  const id = filtre === "moi" ? moi : filtre;
  return demandes.filter((d) => attribueA(d) === id);
}

// Courses d'une personne, pour verifier l'enchainement (30 min) sur SON agenda
export const coursesDeLaPersonne = (demandes = [], id) => demandes.filter((d) => attribueA(d) === id);

// Changement de la personne qui fait la course (acceptation, transfert direct)
export function attribution(d, versId, deId, quandMs) {
  if (!d) return { erreur: "Course introuvable." };
  if (!versId) return { erreur: "Choisis qui fait la course." };
  if (d.statut === "terminee") return { erreur: "Course déjà terminée : elle ne change plus de main." };
  if (attribueA(d) === versId) return { erreur: "", maj: null };
  return {
    erreur: "",
    maj: { attribueA: versId, vehicule: null },
    trace: { de: deId || attribueA(d), vers: versId, leMs: quandMs || 0 },
  };
}

// Message WhatsApp pour prevenir l'autre (pas de notification automatique sur l'offre gratuite)
export function messageTransfert(d, deNom, versNom) {
  const jour = String(d.date || "").split("-").reverse().join("/");
  const lieux = [d.details && d.details.depart, d.details && d.details.recuperation, d.details && d.details.adresse].find((a) => a && a.label);
  return [
    `Bonjour ${versNom}, je te passe une course 🚗`,
    `${d.serviceTitre || d.service} · ${jour} à ${d.heure || ""}`,
    `Client : ${d.nom || ""}${d.telephone ? " · " + d.telephone : ""}`,
    lieux ? `Départ : ${lieux.label}` : "",
    typeof d.prixFinal === "number" ? `Prix : ${d.prixFinal} ₪` : typeof d.prixEstime === "number" ? `Prix estimé : ${d.prixEstime} ₪` : "",
    "Tout est dans l'espace Rebecca Services, rubrique Demandes.",
    deNom ? `— ${deNom}` : "",
  ].filter(Boolean).join("\n");
}

/* ---------- Mes vehicules ---------- */

export const TYPES = TYPES_VEHICULE;
export const libelleType = (t) => (TYPES_VEHICULE.find((x) => x.id === t) || { label: t }).label;

// Nouveau vehicule d'un proprietaire, pre-rempli avec les valeurs de depart
export function vehiculeNeuf(type, proprietaire, nomProprietaire) {
  const m = MODELES_VEHICULE[type] || MODELES_VEHICULE.voiture;
  return { nom: `${libelleType(type)} de ${nomProprietaire || "?"}`, type, proprietaire, partageAvec: [], actif: true, autonomieKm: null, ...m };
}

const nombre = (x, min, max) => {
  const t = String(x == null ? "" : x).trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
};

// Nettoie une fiche vehicule avant enregistrement (le proprietaire ne change jamais ici)
export function validerVehicule(f) {
  const nom = String(f.nom || "").trim();
  if (nom.length < 2 || nom.length > 60) return { erreur: "Donne un nom au véhicule (2 à 60 caractères)." };
  if (!MODELES_VEHICULE[f.type]) return { erreur: "Type de véhicule inconnu." };
  const conso = nombre(f.consommationL100, 0, 40);
  const litre = nombre(f.prixLitre, 0, 30);
  const usure = nombre(f.usureParKm, 0, 10);
  if ([conso, litre, usure].some((n) => Number.isNaN(n))) return { erreur: "Vérifie la consommation, le prix du litre et l'usure." };
  const autonomie = f.type === "velo" ? nombre(f.autonomieKm, 5, 300) : null;
  if (Number.isNaN(autonomie)) return { erreur: "Autonomie de la batterie entre 5 et 300 km (ou vide)." };
  return {
    erreur: "",
    vehicule: {
      nom,
      type: f.type,
      actif: f.actif !== false,
      consommationL100: conso || 0,
      prixLitre: litre || 0,
      usureParKm: usure || 0,
      autonomieKm: autonomie,
      partageAvec: [...new Set((f.partageAvec || []).filter((x) => typeof x === "string" && x && x !== f.proprietaire))],
    },
  };
}

/* ---------- Transfert AVEC ACCEPTATION (12 nov. 2026, 18h40, Rebecca) ----------
   « Quand on se transfere une course, une notification pour qu'il accepte ou que je l'accepte. »
   « Tant qu'il n'a pas accepte, la course reste chez moi. » Notification = message WhatsApp + rubrique
   « A accepter » avec compteur dans l'appli (pas de notification telephone : offre Firebase payante).
   Champs sur la demande : proposeA, proposePar, proposeLeMs ; dernierRefus = { par, leMs } pour prevenir l'envoyeur. */
const ouverte = (d) => d && !["terminee", "annulee", "refusee"].includes(d.statut);

// Proposer SA course a l'autre (elle reste chez soi jusqu'a la reponse)
export function proposer(d, versId, deId, quandMs) {
  if (!d) return { erreur: "Course introuvable." };
  if (!ouverte(d)) return { erreur: "Course terminée ou fermée : elle ne change plus de main." };
  if (!versId || versId === attribueA(d)) return { erreur: "", maj: null };
  if (deId !== attribueA(d) && deId !== ADMIN_ID) return { erreur: "Seule la personne qui a la course peut la proposer." };
  return { erreur: "", maj: { proposeA: versId, proposePar: deId, proposeLeMs: quandMs || 0, dernierRefus: null } };
}

// Accepter : la course passe chez moi (planning, finances), vehicule a rechoisir
export function accepterProposition(d, moi, quandMs) {
  if (!d || d.proposeA !== moi) return { erreur: "Cette course ne t'est pas proposée." };
  if (!ouverte(d)) return { erreur: "Course terminée ou fermée.", maj: { proposeA: null, proposePar: null, proposeLeMs: null } };
  return {
    erreur: "",
    maj: { attribueA: moi, vehicule: null, proposeA: null, proposePar: null, proposeLeMs: null, dernierRefus: null },
    trace: { de: attribueA(d), vers: moi, leMs: quandMs || 0 },
  };
}

// Refuser : la course reste chez celui qui l'a proposee, il le voit dans « A accepter »
export function refuserProposition(d, moi, quandMs) {
  if (!d || d.proposeA !== moi) return { erreur: "Cette course ne t'est pas proposée." };
  return { erreur: "", maj: { proposeA: null, proposePar: null, proposeLeMs: null, dernierRefus: { par: moi, pour: d.proposePar || attribueA(d), leMs: quandMs || 0 } } };
}

// L'envoyeur reprend sa proposition, ou efface l'avis de refus
export const annulerProposition = () => ({ proposeA: null, proposePar: null, proposeLeMs: null });
export const effacerRefus = () => ({ dernierRefus: null });

// Ce que je dois traiter : courses qu'on me propose, refus de mes propositions, mes propositions en attente
export function transfertsPour(demandes = [], moi) {
  const ouvertes = demandes.filter(ouverte);
  return {
    aAccepter: ouvertes.filter((d) => d.proposeA === moi),
    refus: demandes.filter((d) => d.dernierRefus && d.dernierRefus.pour === moi),
    enAttente: ouvertes.filter((d) => d.proposeA && d.proposePar === moi),
  };
}
export const nombreATraiter = (demandes = [], moi) => {
  const t = transfertsPour(demandes, moi);
  return t.aAccepter.length + t.refus.length;
};

export function messageProposition(d, deNom, versNom) {
  return messageTransfert(d, deNom, versNom)
    .replace("je te passe une course 🚗", "je te propose une course 🚗")
    .replace("Tout est dans l'espace Rebecca Services, rubrique Demandes.", "Accepte-la ou refuse-la dans l'espace Rebecca Services, rubrique « À accepter ».");
}
