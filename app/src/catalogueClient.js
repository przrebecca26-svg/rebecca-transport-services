// CATALOGUE COTE CLIENT (correction du 11 nov. 2026) - Rebecca Services
// Une seule facon de lire le catalogue pour toutes les pages client (Nails, Hair, Slim & Lift, RegenX, Epoxy).
// La BASE fait foi : des qu'une activite a des prestations publiees dans la base, le site n'affiche qu'elles
// (prix, noms et durees modifies dans l'admin compris). Tant que la base est vide pour cette activite,
// le site affiche la liste de depart du code. Un prix prive (seances RegenX) n'est jamais affiche.
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { CATALOGUE_DEPART } from "./pricing/catalogue.js";

const trier = (liste) => [...liste].sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999) || String(a.nom).localeCompare(String(b.nom)));

export function catalogueDepart(activite) {
  return trier(CATALOGUE_DEPART.filter((p) => p.activite === activite && p.publiee === true && p.typePrix !== "prive"));
}

// surListe(liste, enBase) : enBase = true quand la liste vient de la base.
export function ecouterCatalogue(activite, surListe) {
  return onSnapshot(
    query(collection(db, "catalogue"), where("activite", "==", activite), where("publiee", "==", true)),
    (s) => {
      const enBase = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.typePrix !== "prive");
      if (enBase.length > 0) surListe(trier(enBase), true);
      else surListe(catalogueDepart(activite), false);
    },
    () => surListe(catalogueDepart(activite), false)
  );
}
