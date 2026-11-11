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

// Identifiant de la galerie d'une activite dans la collection photosCatalogue (ex. « nails-galerie »)
export const idGalerie = (activite) => activite + "-galerie";

// Photos d'UNE activite seulement (ses prestations + sa galerie) : les identifiants commencent tous par « activite- ».
// surPhotos(parPrestation, galerie) : parPrestation = { idPrestation: [image, ...] } ; galerie = [{ donnees, legende }].
export function ecouterPhotos(activite, surPhotos) {
  return onSnapshot(
    query(collection(db, "photosCatalogue"), where("prestationId", ">=", activite + "-"), where("prestationId", "<=", activite + "-")),
    (s) => {
      const par = {};
      const galerie = [];
      s.docs
        .map((d) => d.data())
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        .forEach((x) => {
          if (!x.prestationId || !x.donnees) return;
          if (x.prestationId === idGalerie(activite)) return galerie.push({ donnees: x.donnees, legende: x.legende || "" });
          if (!par[x.prestationId]) par[x.prestationId] = [];
          par[x.prestationId].push(x.donnees);
        });
      surPhotos(par, galerie);
    },
    () => surPhotos({}, [])
  );
}
