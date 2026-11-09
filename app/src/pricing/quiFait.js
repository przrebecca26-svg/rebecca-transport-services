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
