// ESPACE EQUIPE (coequipiers dans /#/admin) - regles pures, sans acces internet ni base de donnees - Rebecca Services
// Lot J, seance J2 (9 nov. 2026). Pour Jeremy aujourd'hui, pour tout autre coursier demain (une fiche de plus).
//
// Donnees (rien n'est supprime, tout est ajoute) :
//  - equipe/{uid}          fiche du membre, creee et activee par Rebecca (services, modes, voitTelephone, plafond)
//  - demandesEquipe/{uid}  demande d'acces creee a la premiere connexion (nom, e-mail) ; Rebecca l'active
//  - transferts/{demande__uid}  mission proposee par Rebecca, avec une copie limitee de la mission
//  - demandes : attribueA (uid), vehicule, realisePar, pourboire (les anciennes courses restent a Rebecca)
//  - mouvements, depenses, autresRevenus : champ "operateur" = uid du membre
//
// Decisions de Rebecca (9 nov. 2026) : Jeremy voit le telephone des clients (case cochee dans sa fiche) ;
// il encaisse lui-meme ses missions ; recu a son nom ; son Wolt et son plafond sont a lui.

import { repartirPaiement } from "./ajoutManuel.js";
import { vueMission } from "./equipe.js";
import { PLAFOND_DEFAUT } from "./financesAnnee.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (n) => Math.round(n * 100) / 100;
const lireMontant = (x) => {
  const t = String(x == null ? "" : x).trim().replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/* ---------- Roles et acces (J2, valide le 9 nov. 2026, 16h35) ---------- */
// Jeremy co-gere le coursier et le transport comme Rebecca (clients, demandes, prix), sans voir la beaute,
// Epoxy, le Digital ni les finances de Rebecca. Chaque activite s'ouvre ou non, case par case, dans sa fiche.

export const ACTIVITES_ACCES = [
  { id: "coursier", label: "Services coursier", services: ["livraison", "courses", "demenagement"] },
  { id: "transport", label: "Transport privé", services: ["transport", "aeroport", "hatan_kala", "attente", "ramassage"] },
  { id: "beaute", label: "Beauté & bien-être", services: [] },
  { id: "epoxy", label: "Boutique Epoxy", services: [] },
  { id: "digital", label: "Digital & Applications", services: [] },
];
const ACTIVITES_OK = ACTIVITES_ACCES.map((a) => a.id);
const SERVICES_OK = ACTIVITES_ACCES.flatMap((a) => a.services);

// Fiche d'un nouveau membre active par Rebecca (tout reste modifiable ensuite)
export function ficheParDefaut(demande = {}) {
  return {
    nom: String(demande.nom || "").slice(0, 80),
    email: String(demande.email || "").slice(0, 120),
    telephone: "",
    role: "operateur",
    actif: true,
    activites: ["coursier", "transport"],
    services: ACTIVITES_ACCES.filter((a) => a.id === "coursier" || a.id === "transport").flatMap((a) => a.services),
    modes: [],
    voitTelephone: true,
    plafond: PLAFOND_DEFAUT,
  };
}

// Nettoie une fiche modifiee par Rebecca (aucune valeur inconnue n'est enregistree)
export function validerFiche(f) {
  const nom = String(f.nom || "").trim();
  if (nom.length < 2 || nom.length > 80) return { erreur: "Indique le nom (2 à 80 caractères)." };
  const activites = [...new Set((f.activites || []).filter((a) => ACTIVITES_OK.includes(a)))];
  const services = [...new Set((f.services || []).filter((s) => SERVICES_OK.includes(s)))].filter((s) => activites.some((a) => ACTIVITES_ACCES.find((x) => x.id === a).services.includes(s)));
  const plafond = Number(String(f.plafond == null ? "" : f.plafond).replace(",", "."));
  if (!Number.isFinite(plafond) || plafond < 1000 || plafond > 10000000) return { erreur: "Plafond invalide." };
  const telephone = String(f.telephone || "").trim().slice(0, 20);
  return {
    erreur: "",
    fiche: { nom, telephone, activites, services, voitTelephone: f.voitTelephone !== false, actif: f.actif !== false, plafond: Math.round(plafond), modes: validerModes(f.modes).modes || [] },
  };
}

// Role de la personne connectee : admin (Rebecca), equipe (membre actif), attente, desactive, aucun
export function roleDe({ estAdmin, fiche, demande }) {
  if (estAdmin) return "admin";
  const e = etatAcces(fiche, demande);
  return e === "actif" ? "equipe" : e === "en_attente" ? "attente" : e;
}

// Rubriques du menu selon le role. Le membre ne voit jamais les finances de Rebecca ni la rubrique Equipe ;
// il a « Mes finances » a la place, et ses Reglages a lui (modes de transport, telephone, son plafond).
// Rebecca, 9 nov. 2026 (16h42) : il a tout le menu sauf « Equipe » et « Finances », chaque rubrique selon SON compte.
// 12 nov. 2026 : il a aussi tout le « Repertoire » (decision de Rebecca).
const RUBRIQUES_EQUIPE = ["tableau", "devis", "activites", "demandes", "transferts", "agenda", "repertoire", "clients", "mesfinances", "statistiques", "rapports", "reglages"];
export function rubriquesPour(role) {
  if (role === "admin") return null; // toutes
  if (role === "equipe") return RUBRIQUES_EQUIPE;
  return [];
}

// Services qu'un membre peut voir et traiter (activites ouvertes ET services coches)
export function servicesDuMembre(fiche) {
  if (!fiche || fiche.actif !== true) return [];
  const ouverts = ACTIVITES_ACCES.filter((a) => (fiche.activites || []).includes(a.id)).flatMap((a) => a.services);
  return ouverts.filter((s) => (fiche.services || []).includes(s));
}

// Chiffres d'un membre (tableau de bord, activites) : seulement SES courses et SES encaissements,
// et les demandes recues des services qu'il gere. Jamais le chiffre d'affaires de Rebecca.
export function chiffresDuMembre({ uid, fiche, demandes = [], mouvements = [] }) {
  const services = servicesDuMembre(fiche);
  const visibles = demandes.filter((d) => services.includes(d.service));
  const siennes = visibles.filter((d) => (d.realisePar || d.attribueA) === uid);
  return { visibles, siennes, mouvements: mouvements.filter((m) => m.operateur === uid) };
}
export const activitesDuMembre = (fiche) => (fiche && fiche.actif === true ? (fiche.activites || []).filter((a) => ACTIVITES_OK.includes(a)) : []);
// Tuiles du tableau de bord visibles par le membre (les 4 marques beaute dependent de l'activite « beaute »)
const TUILE_ACTIVITE = { coursier: "coursier", transport: "transport", nails: "beaute", regenx: "beaute", slim: "beaute", hair: "beaute", epoxy: "epoxy", digital: "digital" };
export const tuileVisible = (fiche, tuileId) => activitesDuMembre(fiche).includes(TUILE_ACTIVITE[tuileId] || tuileId);

// Ce qu'un membre peut changer lui-meme dans ses Reglages (jamais ses droits ni ses activites)
export function validerMesReglages(f) {
  const telephone = String(f.telephone || "").trim().slice(0, 20);
  const plafond = Number(String(f.plafond == null ? "" : f.plafond).replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(plafond) || plafond < 1000 || plafond > 10000000) return { erreur: "Plafond invalide." };
  const m = validerModes(f.modes);
  if (m.erreur) return { erreur: m.erreur };
  return { erreur: "", maj: { telephone, plafond: Math.round(plafond), modes: m.modes } };
}

// Identifiant d'un transfert : une seule proposition par mission et par membre
export const idTransfert = (demandeId, uid) => `${demandeId}__${uid}`;

// Etat de l'acces d'un compte Google a l'espace equipe
// fiche = equipe/{uid} (ou null) ; demande = demandesEquipe/{uid} (ou null)
export function etatAcces(fiche, demande) {
  if (fiche && fiche.actif === true) return "actif";
  if (fiche && fiche.actif === false) return "desactive";
  if (demande && demande.statut === "refusee") return "refuse";
  if (demande) return "en_attente";
  return "aucun";
}

// Demande d'acces creee a la premiere connexion (jamais de droits : Rebecca decide)
export function demandeAcces(user) {
  return {
    email: String((user && user.email) || "").slice(0, 120),
    nom: String((user && user.displayName) || "").slice(0, 80),
    statut: "en_attente",
  };
}

const trier = (a, b) => `${a.date || ""} ${a.heure || ""}`.localeCompare(`${b.date || ""} ${b.heure || ""}`);

// Repartition des missions d'un membre pour son ecran « Mes missions »
// demandes = celles attribuees a ce membre ; transferts = ceux adresses a ce membre
export function missionsDuMembre({ uid, demandes = [], transferts = [], jour, voitTelephone = false }) {
  const miennes = demandes.filter((d) => d.attribueA === uid);
  const proposees = transferts
    .filter((t) => t.vers === uid && t.statut === "propose" && t.mission)
    .map((t) => ({ ...vueMission({ ...t.mission, id: t.demande }, voitTelephone), transfert: t.id || idTransfert(t.demande, uid), vehiculeConseille: t.vehicule || "" }))
    .sort(trier);
  const vue = (d) => vueMission(d, voitTelephone);
  const actives = miennes.filter((d) => d.statut === "acceptee" || d.statut === "confirmee" || d.statut === "en cours");
  return {
    proposees,
    aujourdhui: actives.filter((d) => d.date === jour).sort(trier).map(vue),
    aVenir: actives.filter((d) => !jour || d.date > jour).sort(trier).map(vue),
    enRetard: actives.filter((d) => jour && d.date < jour).sort(trier).map(vue),
    terminees: miennes.filter((d) => d.statut === "terminee").sort(trier).reverse().map(vue),
  };
}

// Reponse a une mission proposee : ce qui change dans le transfert et dans la demande
export function reponseProposition(transfert, accepte, uid, vehiculeId) {
  if (!transfert || transfert.statut !== "propose") return { erreur: "Cette proposition n'est plus valable." };
  if (transfert.vers !== uid) return { erreur: "Cette proposition ne t'est pas adressée." };
  if (!accepte) return { transfert: { statut: "refuse" }, demande: null };
  const vehicule = vehiculeId || transfert.vehicule || "";
  return { transfert: { statut: "accepte", vehicule }, demande: { attribueA: uid, ...(vehicule ? { vehicule } : {}) } };
}

// Fin de mission par le membre : argent recu, moyen de paiement, pourboire (a part, hors chiffre d'affaires)
// Renvoie la mise a jour de la demande et la ligne de paiement (jamais modifiee ensuite)
export function terminerMission(mission, { recu, moyen, pourboireConfirme = true }, uid, jour) {
  if (!mission || mission.attribueA !== uid) return { erreur: "Cette mission n'est pas la tienne." };
  if (mission.statut === "terminee") return { erreur: "Mission déjà terminée." };
  const montant = lireMontant(recu);
  if (!Number.isFinite(montant) || montant < 0 || montant > 100000) return { erreur: "Montant invalide." };
  if (montant > 0 && !moyen) return { erreur: "Choisis le moyen de paiement." };
  if (!DATE_OK.test(jour || "")) return { erreur: "Date invalide." };
  const prix = typeof mission.prixFinal === "number" ? mission.prixFinal : Number(mission.prixEstime) || 0;
  const r = repartirPaiement(prix, montant, pourboireConfirme);
  const demande = { statut: "terminee", realisePar: uid };
  if (r.pourboire > 0) demande.pourboire = r.pourboire;
  const paiement = r.paiement > 0 ? { kind: "paiement", resId: mission.id, date: jour, montant: r.paiement, moyen, operateur: uid } : null;
  const reste = prix > 0 && montant < prix ? cents(prix - montant) : 0;
  return { erreur: "", demande, paiement, pourboire: r.pourboire, reste };
}

// Message WhatsApp pour prevenir Rebecca (pas de notification automatique sur l'offre gratuite)
export function messagePourRebecca(type, mission, nom) {
  const quoi = `${mission.serviceTitre || mission.service || "Mission"} du ${String(mission.date || "").split("-").reverse().join("/")} à ${mission.heure || ""}`;
  const qui = nom ? ` (${nom})` : "";
  if (type === "accepte") return `Bonjour Rebecca, j'accepte la mission : ${quoi}.${qui}`;
  if (type === "refuse") return `Bonjour Rebecca, je ne peux pas faire la mission : ${quoi}.${qui}`;
  if (type === "terminee") return `Bonjour Rebecca, mission terminée : ${quoi}.${qui}`;
  return `Bonjour Rebecca, au sujet de la mission : ${quoi}.${qui}`;
}

// Modes de transport que le membre peut cocher lui-meme (ses droits, eux, ne changent jamais ici)
export const MODES = [
  { id: "voiture", label: "Voiture" },
  { id: "scooter", label: "Scooter" },
  { id: "moto", label: "Moto" },
  { id: "velo", label: "Vélo électrique" },
];
export function validerModes(modes) {
  const ok = MODES.map((m) => m.id);
  const liste = [...new Set((modes || []).filter((m) => ok.includes(m)))];
  return liste.length ? { erreur: "", modes: liste } : { erreur: "Coche au moins un mode de transport." };
}

// Autonomie du velo electrique, renseignee par son proprietaire (vide = prudence par defaut)
export function validerAutonomie(x) {
  const t = String(x == null ? "" : x).trim().replace(",", ".");
  if (!t) return { erreur: "", autonomieKm: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 5 || n > 300) return { erreur: "Autonomie entre 5 et 300 km." };
  return { erreur: "", autonomieKm: Math.round(n) };
}
