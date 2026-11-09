// EQUIPE ET VEHICULES - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// Lot J, seance J1 (9 nov. 2026). Rebecca + Jeremy aujourd'hui, d'autres membres plus tard : une fiche de plus, sans code.
//
// Decisions de Rebecca :
//  - Rebecca reste l'administratrice ; un membre "operateur" fait seulement les services coches pour lui.
//  - Une demande sans "attribueA" appartient a Rebecca (toutes les anciennes courses restent a elle).
//  - Le site accepte une demande si UNE personne autorisee est libre ET qu'un vehicule adapte est libre.
//  - Chabbat et fetes : bloques pour toute l'equipe (verifie ailleurs, par le calendrier, pour tout le monde).
//  - Chacun coche ses modes de transport ; la voiture de Rebecca peut etre partagee quand elle ne l'utilise pas.
//  - Conflit = meme vehicule a la meme heure (trajet + marge), quelle que soit la personne.
//  - Conseil "avec quoi y aller" : le vehicule le moins couteux d'abord (velo, scooter, voiture).
//  - Le prix client ne depend JAMAIS du vehicule : seul le benefice change.
//  - Chacun son osek patur : les recettes et le Wolt de Jeremy ne comptent jamais dans le plafond de Rebecca.

import { blocsPourDate, datesDe, MARGE_DEFAUT } from "./enchainement.js";
import { syntheseAnnee, etatPlafond, PLAFOND_DEFAUT } from "./financesAnnee.js";

export const ADMIN_ID = "rebecca"; // identifiant de Rebecca dans l'equipe (son compte admin ne change pas)

/* ---------- Vehicules ---------- */

export const TYPES_VEHICULE = [
  { id: "voiture", label: "Voiture", ordre: 3 },
  { id: "moto", label: "Moto", ordre: 2 },
  { id: "scooter", label: "Scooter", ordre: 2 },
  { id: "velo", label: "Vélo électrique", ordre: 1 },
];
const ORDRE_TYPE = Object.fromEntries(TYPES_VEHICULE.map((t) => [t.id, t.ordre]));

// Types de vehicule permis par service (reglage modifiable par Rebecca ; ceci = valeurs de depart)
export const TYPES_PAR_SERVICE = {
  transport: ["voiture"],
  aeroport: ["voiture"],
  hatan_kala: ["voiture"],
  attente: ["voiture"],
  demenagement: ["voiture"],
  ramassage: ["voiture"],
  livraison: ["voiture", "moto", "scooter", "velo"],
  courses: ["voiture", "moto", "scooter", "velo"],
};

// Velo electrique : limites par defaut tant que l'autonomie n'est pas renseignee
export const VELO = { kmMaxSansAutonomie: 25, margeAutonomie: 0.2, kmMaxAller: 8 };

// Cout d'un km pour un vehicule (carburant + usure). Velo : 0 par defaut.
export function coutParKmVehicule(v) {
  if (!v) return 0;
  const conso = Number(v.consommationL100) || 0;
  const litre = Number(v.prixLitre) || 0;
  const usure = Number(v.usureParKm) || 0;
  return Math.round(((conso / 100) * litre + usure) * 1000) / 1000;
}

// Km parcourus pour une mission : aller + retour (retour a vide si aller simple)
export function kmMission(d) {
  const aller = Number(d && d.kmEstime) || Number(d && d.aller && d.aller.km) || 0;
  return Math.round(aller * 2 * 10) / 10;
}

// Le velo peut-il faire cette mission ? (autonomie avec 20 % de marge, 8 km maximum a l'aller)
export function autonomieSuffisante(v, kmAller) {
  if (!v || v.type !== "velo") return true;
  const aller = Number(kmAller) || 0;
  if (aller > (Number(v.kmMaxAller) || VELO.kmMaxAller)) return false;
  const total = aller * 2;
  const autonomie = Number(v.autonomieKm);
  if (autonomie > 0) return total <= autonomie * (1 - VELO.margeAutonomie);
  return total <= VELO.kmMaxSansAutonomie;
}

// Vehicules qu'un membre peut utiliser : actifs, d'un type qu'il a coche, a lui ou partages avec lui
export function vehiculesDuMembre(membre, vehicules = []) {
  if (!membre) return [];
  const modes = membre.modes || [];
  return vehicules.filter(
    (v) => v.actif !== false && modes.includes(v.type) && (v.proprietaire === membre.id || (v.partageAvec || []).includes(membre.id))
  );
}

/* ---------- Droits ---------- */

export const estAdminId = (id) => id === ADMIN_ID;
export const attribueA = (d) => (d && d.attribueA) || ADMIN_ID;

// Un membre peut-il faire ce service ? Rebecca : tout. Operateur actif : seulement les services coches.
export function peutFaire(membre, service) {
  if (!membre) return false;
  if (estAdminId(membre.id)) return true;
  return membre.actif !== false && (membre.services || []).includes(service);
}

// Un membre peut-il enregistrer un paiement sur cette demande ? Seulement si elle lui est attribuee.
export const peutEncaisser = (membre, d) => !!membre && !!d && (estAdminId(membre.id) || attribueA(d) === membre.id);

// Ce qu'un operateur voit d'une demande : jamais e-mail, uid, code promo, remise, notes privees.
// voitTelephone : decision de Rebecca encore ouverte (par defaut : non, contact via Rebecca).
const CHAMPS_MISSION = ["id", "service", "serviceTitre", "date", "heure", "statut", "prixFinal", "prixEstime", "surDevis", "kmEstime", "minutesEstimees", "details", "message", "attribueA", "vehicule"];
const DETAILS_PRIVES = ["telDestinataire", "passagerTel", "telUrgence", "email"];
export function vueMission(d, voitTelephone = false) {
  const m = {};
  for (const k of CHAMPS_MISSION) if (d[k] !== undefined) m[k] = d[k];
  m.prenom = String(d.nom || "").trim().split(/\s+/)[0] || "";
  if (voitTelephone) m.telephone = d.telephone || "";
  if (m.details && typeof m.details === "object") {
    m.details = { ...m.details };
    if (!voitTelephone) for (const k of DETAILS_PRIVES) delete m.details[k];
  }
  return m;
}

/* ---------- Disponibilites ---------- */

const versMin = (h) => {
  const x = /^(\d{1,2}):(\d{2})$/.exec(String(h || ""));
  return x ? Number(x[1]) * 60 + Number(x[2]) : null;
};
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};
const chevauche = (a, b, marge) => a.debut < b.fin + marge && b.debut < a.fin + marge;

// Indisponibilites d'un membre ce jour-la, en blocs de minutes.
// dispos = { periodes: [{ debut: "AAAA-MM-JJTHH:MM", fin: "AAAA-MM-JJTHH:MM" }], creneaux: [{ jours: [0..6], debut: "HH:MM", fin: "HH:MM" }] }
export function blocsIndispo(dispos = {}, date) {
  const blocs = [];
  for (const p of dispos.periodes || []) {
    const [dd, hd] = String(p.debut || "").split("T");
    const [df, hf] = String(p.fin || "").split("T");
    if (!dd || !df || date < dd || date > df) continue;
    blocs.push({ debut: date === dd ? versMin(hd) || 0 : 0, fin: date === df ? versMin(hf) || 0 : 1440 });
  }
  for (const c of dispos.creneaux || []) {
    if ((c.jours || []).includes(jourSemaine(date))) blocs.push({ debut: versMin(c.debut), fin: versMin(c.fin) });
  }
  return blocs.filter((b) => b.debut != null && b.fin != null && b.fin > b.debut);
}

// Blocs occupes (minutes) par une liste de demandes ce jour-la
function blocsDemandes(liste, date) {
  return liste.flatMap((d) => blocsPourDate(d, date));
}

const ACTIVES = ["acceptee", "confirmee", "acceptée", "confirmée"];
const estActive = (d) => ACTIVES.includes(d.statut);

// Le membre est-il libre pour cette mission ? (ses indisponibilites + ses autres missions acceptees + marge)
export function membreLibre(membre, mission, { demandes = [], dispos = {}, marge = MARGE_DEFAUT } = {}) {
  const siennes = demandes.filter((d) => d.id !== mission.id && estActive(d) && attribueA(d) === membre.id);
  for (const date of datesDe(mission)) {
    const voulus = blocsPourDate(mission, date);
    const pris = [...blocsIndispo(dispos[membre.id], date).map((b) => ({ ...b, indispo: true })), ...blocsDemandes(siennes, date)];
    for (const v of voulus) {
      // indisponibilite : pas de marge ; autre mission : marge de securite
      if (pris.some((p) => chevauche(v, p, p.indispo ? 0 : marge))) return false;
    }
  }
  return true;
}

// Le vehicule est-il libre ? (missions acceptees faites avec CE vehicule, quelle que soit la personne)
// Une demande sans vehicule est faite avec le vehicule par defaut (la voiture de Rebecca).
export function vehiculeLibre(vehiculeId, mission, { demandes = [], marge = MARGE_DEFAUT, vehiculeParDefaut = null } = {}) {
  const avec = demandes.filter((d) => d.id !== mission.id && estActive(d) && (d.vehicule || vehiculeParDefaut) === vehiculeId);
  for (const date of datesDe(mission)) {
    const voulus = blocsPourDate(mission, date);
    const pris = blocsDemandes(avec, date);
    if (voulus.some((v) => pris.some((p) => chevauche(v, p, marge)))) return false;
  }
  return true;
}

/* ---------- Conseil du vehicule ---------- */

// Liste des vehicules possibles pour un membre et une mission, du plus interessant au moins interessant.
// Chaque choix : { vehicule, possible, raison, cout, beneficeEstime }
export function conseillerVehicule(membre, mission, { vehicules = [], demandes = [], marge = MARGE_DEFAUT, typesParService = TYPES_PAR_SERVICE, vehiculeParDefaut = null } = {}) {
  const permis = typesParService[mission.service] || ["voiture"];
  const km = kmMission(mission);
  const kmAller = km / 2;
  const prix = typeof mission.prixFinal === "number" ? mission.prixFinal : Number(mission.prixEstime) || 0;
  const choix = vehiculesDuMembre(membre, vehicules).map((v) => {
    const cout = Math.round(km * coutParKmVehicule(v));
    let raison = "";
    if (!permis.includes(v.type)) raison = "Ce service demande une voiture.";
    else if (mission.voitureObligatoire && v.type !== "voiture") raison = "Voiture demandée par Rebecca pour cette mission.";
    else if (!autonomieSuffisante(v, kmAller)) raison = "Trop loin pour la batterie du vélo.";
    else if (!vehiculeLibre(v.id, mission, { demandes, marge, vehiculeParDefaut })) raison = "Déjà utilisé à cette heure.";
    return { vehicule: v, possible: !raison, raison, cout, beneficeEstime: Math.round(prix - cout) };
  });
  return choix.sort((a, b) => Number(b.possible) - Number(a.possible) || a.cout - b.cout || (ORDRE_TYPE[a.vehicule.type] || 9) - (ORDRE_TYPE[b.vehicule.type] || 9));
}

/* ---------- "Si l'un de nous est libre" ---------- */

// Qui peut faire cette mission, et avec quel vehicule ? (membres autorises, libres, avec un vehicule possible)
// Ramassage scolaire : comme les autres services (case cochee dans la fiche du membre).
export function quiPeutFaire(mission, { membres = [], vehicules = [], demandes = [], dispos = {}, marge = MARGE_DEFAUT, typesParService = TYPES_PAR_SERVICE, vehiculeParDefaut = null } = {}) {
  const res = [];
  for (const m of membres) {
    if (!peutFaire(m, mission.service)) continue;
    if (!membreLibre(m, mission, { demandes, dispos, marge })) continue;
    const options = conseillerVehicule(m, mission, { vehicules, demandes, marge, typesParService, vehiculeParDefaut }).filter((c) => c.possible);
    if (options.length) res.push({ membre: m, vehicule: options[0].vehicule, beneficeEstime: options[0].beneficeEstime });
  }
  // Rebecca d'abord si elle est libre (les missions lui appartiennent par defaut)
  return res.sort((a, b) => Number(estAdminId(b.membre.id)) - Number(estAdminId(a.membre.id)));
}

export const equipeDisponible = (mission, contexte) => quiPeutFaire(mission, contexte).length > 0;

/* ---------- Transferts ---------- */

export const STATUTS_TRANSFERT = ["propose", "accepte", "refuse", "annule"];

// Verifications avant de proposer une mission a un membre. Jamais de blocage : des avertissements, Rebecca decide.
export function verifierTransfert(mission, vers, contexte = {}) {
  const avertissements = [];
  if (!vers) return { ok: false, avertissements: ["Membre introuvable."] };
  if (vers.actif === false) avertissements.push(`${vers.nom || "Ce membre"} est désactivé.`);
  if (!peutFaire(vers, mission.service)) avertissements.push(`${vers.nom || "Ce membre"} n'a pas ce service dans ses droits.`);
  if (attribueA(mission) === vers.id) avertissements.push("La mission lui est déjà attribuée.");
  if (!membreLibre(vers, mission, contexte)) avertissements.push(`${vers.nom || "Ce membre"} n'est pas libre à cette heure (indisponibilité ou autre mission trop proche).`);
  const options = conseillerVehicule(vers, mission, contexte);
  const possible = options.find((o) => o.possible);
  if (!possible) avertissements.push(options.length ? "Aucun de ses véhicules n'est possible : " + options.map((o) => `${o.vehicule.nom || o.vehicule.type} (${o.raison})`).join(", ") : "Aucun véhicule coché pour ce membre.");
  return { ok: avertissements.length === 0, avertissements, vehiculeConseille: possible ? possible.vehicule : null };
}

// Nouveau transfert (historique : jamais supprime)
export function creerTransfert(mission, vers, vehiculeId, quand) {
  return { demande: mission.id, de: attribueA(mission), vers: vers.id, vehicule: vehiculeId || null, statut: "propose", creeLe: quand };
}

// Reponse du membre : renvoie le transfert mis a jour et les champs a ecrire sur la demande (ou null si refus)
export function repondreTransfert(transfert, accepte, quand) {
  if (!transfert || transfert.statut !== "propose") return { erreur: "Ce transfert n'attend plus de réponse." };
  const t = { ...transfert, statut: accepte ? "accepte" : "refuse", reponduLe: quand };
  const demande = accepte ? { attribueA: transfert.vers, vehicule: transfert.vehicule || null } : null;
  return { transfert: t, demande };
}

/* ---------- Finances par personne ---------- */

// Les lignes d'argent d'un membre (mouvements, depenses, autres revenus). Sans "operateur" = Rebecca.
export const lignesDe = (liste = [], membreId) => liste.filter((x) => (x.operateur || ADMIN_ID) === membreId);

// Les courses d'un membre : realisee par lui (une fois terminee) ou attribuee a lui
export const coursesDe = (demandes = [], membreId) => demandes.filter((d) => (d.realisePar || attribueA(d)) === membreId);

// Synthese annuelle d'un membre, comparee a SON plafond (chacun son osek patur)
// J4a : l'argent garde apres annulation compte pour celui a qui la course etait attribuee (meme si l'autre l'a encaisse) ;
// le credit prepaye (recharges, bonus) reste dans les chiffres de Rebecca, qui garde l'argent du credit.
export function syntheseMembre(membreId, { annee, demandes = [], mouvements = [], depenses = [], autresRevenus = [], avis = [], recharges = [], creditMouvements = [], plafond = PLAFOND_DEFAUT, jourDeLAnnee = null }) {
  const courses = coursesDe(demandes, membreId);
  const ids = new Set(courses.map((d) => d.id));
  const s = syntheseAnnee({
    annee,
    demandes: courses,
    mouvements: mouvements.filter((m) => (m.resId ? ids.has(m.resId) : (m.operateur || ADMIN_ID) === membreId)),
    depenses: lignesDe(depenses, membreId),
    autresRevenus: lignesDe(autresRevenus, membreId),
    avis: avis.filter((a) => ids.has(a.id)),
    recharges: estAdminId(membreId) ? recharges : [],
    creditMouvements: estAdminId(membreId) ? creditMouvements : [],
  });
  return { ...s, plafond: etatPlafond(s.cumulPlafond, plafond, jourDeLAnnee) };
}

// Benefice d'une mission avec le vehicule reellement utilise (le prix client ne change pas)
export function beneficeMission(mission, vehicule) {
  const prix = typeof mission.prixFinal === "number" ? mission.prixFinal : Number(mission.prixEstime) || 0;
  const cout = Math.round(kmMission(mission) * coutParKmVehicule(vehicule));
  return { prix, coutVehicule: cout, benefice: Math.round(prix - cout) };
}
