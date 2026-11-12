// REPERTOIRE D'ADRESSES - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// 12 nov. 2026, demande de Rebecca : un repertoire de toutes ses adresses habituelles, chacune avec un nom
// (Maison, Maman, Ecole, Basket, Chez Alexia, Carrefour...), et les adresses des clientes (domicile, favorites,
// enfants) lues dans leurs comptes. Ensuite, partout ou elle tape une adresse, elle ecrit le NOM et c'est rempli.
// Prive : enregistre dans la base (document clientsAdmin/_repertoire), lisible par Rebecca et son equipe seulement,
// jamais par les clientes. Aucun nom ni adresse n'est ecrit dans le programme.

export const TYPES_LIEU = [
  { v: "maison", l: "Maison" },
  { v: "famille", l: "Famille et amis" },
  { v: "ecole", l: "Écoles et activités" },
  { v: "magasin", l: "Magasins" },
  { v: "autre", l: "Autres" },
];
export const DOC_REPERTOIRE = "_repertoire";

const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const aCoord = (a) => !!a && typeof a.lat === "number" && typeof a.lon === "number";
export const cleAdresse = (a) => (aCoord(a) ? `${a.lat.toFixed(5)},${a.lon.toFixed(5)}` : "");
const adresseLue = (x) => (x && typeof x === "object" && typeof x.label === "string" && x.label.trim() ? { label: x.label.slice(0, 300), ...(aCoord(x) ? { lat: x.lat, lon: x.lon } : {}) } : null);

let compteur = 0;
export const nouvelIdLieu = () => `l${Date.now().toString(36)}${(compteur++).toString(36)}`;
export const lieuVide = () => ({ id: nouvelIdLieu(), nom: "", type: "autre", adresse: null, note: "" });

// Nettoie ce qui vient de la base (champ json)
export function lireRepertoire(json) {
  let liste;
  try {
    liste = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((l) => l && typeof l === "object")
    .slice(0, 300)
    .map((l) => ({
      id: String(l.id || nouvelIdLieu()).slice(0, 40),
      nom: String(l.nom || "").slice(0, 40),
      type: TYPES_LIEU.some((t) => t.v === l.type) ? l.type : "autre",
      adresse: adresseLue(l.adresse),
      note: String(l.note || "").slice(0, 200),
    }))
    .filter((l) => l.nom.trim() && l.adresse);
}

// Un lieu pret a enregistrer ? ("" = oui)
export function manqueLieu(l) {
  if (!String(l.nom || "").trim()) return "Donne un nom à ce lieu.";
  if (!l.adresse || !String(l.adresse.label || "").trim()) return "Indique l'adresse.";
  return "";
}

// Lieux nommes dans la tournee scolaire ([{ nom, adresse }]) ajoutes au repertoire ; a la meme adresse, le nom
// de la tournee (le plus recent) remplace celui du repertoire.
export function fusionnerLieux(repertoire, lieuxTournee = []) {
  const liste = repertoire.map((l) => ({ ...l }));
  for (const t of lieuxTournee) {
    const cle = cleAdresse(t.adresse);
    if (!cle || !String(t.nom || "").trim()) continue;
    const deja = liste.find((l) => cleAdresse(l.adresse) === cle);
    if (deja) deja.nom = t.nom;
    else liste.push({ id: nouvelIdLieu(), nom: t.nom, type: "ecole", adresse: t.adresse, note: "" });
  }
  return liste;
}

// Clientes avec leurs adresses, a partir de leurs comptes (collection clients) :
// domicile, adresses favorites, et pour chaque enfant son domicile et le nom de son ecole.
export function adressesClients(clients = []) {
  return clients
    .map((c) => {
      const adresses = [];
      const ajouter = (nom, adresse) => {
        const a = typeof adresse === "string" ? (adresse.trim() ? { label: adresse.trim() } : null) : adresseLue(adresse);
        if (a && !adresses.some((x) => x.adresse.label === a.label)) adresses.push({ nom, adresse: a });
      };
      ajouter("Domicile", c.adresse);
      for (const a of Array.isArray(c.adresses) ? c.adresses : []) ajouter(String((a && a.nom) || "Adresse").slice(0, 30), a);
      for (const e of Array.isArray(c.enfants) ? c.enfants : []) {
        if (!e) continue;
        ajouter(`Domicile de ${e.prenom || "l'enfant"}`, e.adresse);
        if (e.ecole) ajouter(`École de ${e.prenom || "l'enfant"}`, e.ecole);
      }
      return { cle: c.id, nom: [c.prenom, c.nom].filter(Boolean).join(" ").trim() || "Cliente", telephone: c.telephone || "", adresses };
    })
    .filter((c) => c.adresses.length > 0)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/* ---------- Le repertoire en memoire (rempli par l'espace prive seulement ; vide sur le site des clientes) ---------- */

let courant = { lieux: [], clients: [] };
let version = 0;
const abonnes = new Set();

export function definirRepertoire({ lieux, clients }) {
  courant = { lieux: lieux || courant.lieux, clients: clients || courant.clients };
  version++;
  abonnes.forEach((f) => f(version));
}
export const repertoireCourant = () => courant;
export const versionRepertoire = () => version;
export function abonnerRepertoire(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

// Ma maison (lieu de type « Maison » avec une adresse reconnue) : sert a dire a quelle distance est une suggestion
export function maisonDuRepertoire(source = courant) {
  const m = source.lieux.find((l) => l.type === "maison" && cleAdresse(l.adresse));
  return m ? m.adresse : null;
}

// « à 400 m de la maison », « à 2,5 km de la maison »
export function texteDistance(km) {
  if (!(km >= 0)) return "";
  if (km < 1) return `à ${Math.max(50, Math.round(km * 20) * 50)} m de la maison`;
  return `à ${km < 10 ? String(Math.round(km * 10) / 10).replace(".", ",") : Math.round(km)} km de la maison`;
}

// Recherche par nom : « alex » -> Chez Alexia ; « carr » -> Carrefour ; nom d'une cliente -> ses adresses.
// Renvoie [{ titre, sous, adresse }], les lieux de Rebecca d'abord.
export function chercherRepertoire(texte, max = 5, source = courant) {
  const q = sansAccent(texte);
  if (q.length < 2) return [];
  const trouves = [];
  for (const l of source.lieux) {
    if (sansAccent(l.nom).includes(q) || sansAccent(l.note).includes(q)) trouves.push({ titre: l.nom, sous: l.adresse.label, adresse: l.adresse });
  }
  for (const c of source.clients) {
    const nomOk = sansAccent(c.nom).includes(q);
    for (const a of c.adresses) {
      if (nomOk || sansAccent(a.nom).includes(q)) trouves.push({ titre: `${c.nom} · ${a.nom}`, sous: a.adresse.label, adresse: a.adresse });
    }
  }
  return trouves.slice(0, max);
}
