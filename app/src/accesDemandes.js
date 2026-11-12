import { collection, query, where } from "firebase/firestore";
import { db } from "./firebase.js";

// LECTURE DES DEMANDES SELON LA PERSONNE CONNECTEE (12 nov. 2026, regles v15)
// Rebecca lit toutes les demandes. Un coequipier (Jeremy) ne lit que le coursier et le transport :
// jamais les rendez-vous beaute (Nails, Hair, Slim & Lift, RegenX), ni Epoxy, ni Digital.
// Firestore refuse une lecture « de tout » a un coequipier : chaque lecture des demandes passe donc par ici.
export const SERVICES_EQUIPE = ["livraison", "courses", "demenagement", "transport", "aeroport", "hatan_kala", "ramassage", "attente"];

let equipier = false;
// Appele par l'admin a chaque affichage : true quand la personne connectee est un coequipier
export const definirEquipier = (b) => {
  equipier = !!b;
};
export const estEquipier = () => equipier;

// Reference a lire. Rebecca : la collection (ou la requete demandee). Coequipier : seulement ses services,
// sans tri cote base (le tri par date se fait avec trierDemandes, pour ne pas exiger d'index en plus).
export function refDemandes(...contraintes) {
  const c = collection(db, "demandes");
  if (equipier) return query(c, where("service", "in", SERVICES_EQUIPE));
  return contraintes.length ? query(c, ...contraintes) : c;
}

const ms = (x) => (x && typeof x.toMillis === "function" ? x.toMillis() : 0);
// Plus recentes d'abord (comme orderBy("creeLe", "desc"))
export const trierDemandes = (liste) => (equipier ? [...liste].sort((a, b) => ms(b.creeLe) - ms(a.creeLe)) : liste);
