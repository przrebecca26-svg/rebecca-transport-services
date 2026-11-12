// CATALOGUE COTE CLIENT (correction du 11 nov. 2026) - Rebecca Services
// Une seule facon de lire le catalogue pour toutes les pages client (Nails, Hair, Slim & Lift, RegenX, Epoxy).
// La BASE fait foi : des qu'une activite a des prestations publiees dans la base, le site n'affiche qu'elles
// (prix, noms et durees modifies dans l'admin compris). Tant que la base est vide pour cette activite,
// le site affiche la liste de depart du code. Un prix prive (seances RegenX) n'est jamais affiche.
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { CATALOGUE_DEPART, GALERIE_ARTICLE } from "./pricing/catalogue.js";

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
      const suite = {};
      const galerie = [];
      s.docs
        .map((d) => d.data())
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        .forEach((x) => {
          if (!x.prestationId || !x.donnees) return;
          if (x.prestationId === idGalerie(activite)) return galerie.push({ donnees: x.donnees, legende: x.legende || "" });
          if (x.prestationId.endsWith(GALERIE_ARTICLE)) {
            const id = x.prestationId.slice(0, -GALERIE_ARTICLE.length);
            (suite[id] = suite[id] || []).push(x.donnees);
            return;
          }
          if (!par[x.prestationId]) par[x.prestationId] = [];
          par[x.prestationId].push(x.donnees);
        });
      // Photo principale d'abord, puis la galerie de l'article
      Object.entries(suite).forEach(([id, liste]) => (par[id] = [...(par[id] || []), ...liste]));
      surPhotos(par, galerie);
    },
    () => surPhotos({}, [])
  );
}

// ---------- Photos legeres (12 nov. 2026, Boutique Epoxy : jusqu'a 30 photos par article) ----------
// Photos principales seulement (une par article), par paquets de 30 identifiants : la page s'ouvre vite
// meme avec beaucoup de photos. surPrincipales({ idArticle: { image, autres: [image...] } }).
export function ecouterPrincipales(ids, surPrincipales) {
  const liste = [...new Set((ids || []).filter(Boolean))];
  if (!liste.length) {
    surPrincipales({});
    return () => {};
  }
  const paquets = [];
  for (let i = 0; i < liste.length; i += 30) paquets.push(liste.slice(i, i + 30));
  const parPaquet = paquets.map(() => ({}));
  const publier = () => surPrincipales(Object.assign({}, ...parPaquet));
  const arrets = paquets.map((ids30, k) =>
    onSnapshot(
      query(collection(db, "photosCatalogue"), where("prestationId", "in", ids30)),
      (s) => {
        const par = {};
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
          .forEach((x) => {
            if (!x.donnees) return;
            if (!par[x.prestationId]) par[x.prestationId] = { image: x.donnees, photoId: x.id, autres: [] };
            else par[x.prestationId].autres.push(x.donnees);
          });
        parPaquet[k] = par;
        publier();
      },
      () => {
        parPaquet[k] = {};
        publier();
      }
    )
  );
  return () => arrets.forEach((a) => a());
}

// Galerie d'UN article (chargee a l'ouverture de l'article) : surGalerie([{ id, donnees, legende, ordre }])
export function ecouterGalerieArticle(idArticle, surGalerie) {
  return onSnapshot(
    query(collection(db, "photosCatalogue"), where("prestationId", "==", idArticle + GALERIE_ARTICLE)),
    (s) => surGalerie(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordre || 0) - (b.ordre || 0))),
    () => surGalerie([])
  );
}

// Galerie d'une activite seule (ex. « epoxy-galerie »)
export function ecouterGalerieActivite(activite, surGalerie) {
  return onSnapshot(
    query(collection(db, "photosCatalogue"), where("prestationId", "==", idGalerie(activite))),
    (s) => surGalerie(s.docs.map((d) => d.data()).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((x) => ({ donnees: x.donnees, legende: x.legende || "" }))),
    () => surGalerie([])
  );
}
