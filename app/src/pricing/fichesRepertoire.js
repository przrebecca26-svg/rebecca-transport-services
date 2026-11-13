// FICHES DU REPERTOIRE (13 nov. 2026, 09h13) - regles pures (aucun acces internet ni base de donnees)
// Rebecca : « le Repertoire c'est pour tout le monde pareil : nom, prenom, telephone, et un bouton Fiche. Dans la fiche :
// les membres de la famille, un onglet enfants (calendrier, ecoles), un onglet historique (tout ce que j'ai fait, dates,
// montants), un onglet finances (paye, a payer, credit, dette). Categories : moi, famille et amis, clientes ; une
// cliente du site ou que je rentre est « cliente » par defaut, je peux la changer. »
// Une fiche = une famille du Repertoire (avec ses membres et ses enfants), ou une cliente du site sans famille.
// Une cliente du site dont le telephone est celui d'un membre d'une famille est dans la fiche de cette famille.

import { telNormalise } from "./clients.js";

export const CATEGORIES = [
  { v: "moi", l: "Moi" },
  { v: "proches", l: "Famille et amis" },
  { v: "clientes", l: "Clientes" },
];
export const libelleCategorie = (v) => (CATEGORIES.find((c) => c.v === v) || CATEGORIES[2]).l;

// Tous les numeros d'une famille (parent, autre parent, membres)
export const telsFamille = (f) => [f.telephone, f.telephone2, ...(f.membres || []).map((m) => m.telephone)].map(telNormalise).filter((t) => t.length >= 6);

// fiches = fiches clientes (construireFiches) ; categories = { cle: categorie } pour les clientes sans famille
export function entreesRepertoire(familles = [], fiches = [], categories = {}) {
  const prises = new Set();
  const entrees = familles.map((f) => {
    const tels = telsFamille(f);
    const clients = fiches.filter((c) => tels.includes(telNormalise(c.telephone)));
    clients.forEach((c) => prises.add(c.cle));
    return { cle: "fam:" + f.id, type: "famille", nom: String(f.nom || "").trim() || "Sans nom", telephone: f.telephone || (clients[0] && clients[0].telephone) || "", categorie: f.categorie || "clientes", famille: f, clients };
  });
  for (const c of fiches) {
    if (prises.has(c.cle) || telNormalise(c.telephone).length < 6) continue;
    entrees.push({ cle: c.cle, type: "client", nom: c.nom, telephone: c.telephone, categorie: categories[c.cle] || "clientes", famille: null, clients: [c] });
  }
  const ordre = { moi: 0, proches: 1, clientes: 2 };
  return entrees.sort((a, b) => ordre[a.categorie] - ordre[b.categorie] || a.nom.localeCompare(b.nom, "fr"));
}

const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function filtrerEntrees(entrees, categorie = "tous", texte = "") {
  const q = sansAccent(texte.trim());
  return entrees.filter((e) => {
    if (categorie !== "tous" && e.categorie !== categorie) return false;
    if (!q) return true;
    const mots = [e.nom, e.telephone, telNormalise(e.telephone), ...(e.famille ? [e.famille.nom2, ...(e.famille.membres || []).map((m) => m.nom), ...(e.famille.enfants || []).map((x) => x.prenom)] : [])];
    return mots.some((m) => sansAccent(m).includes(q));
  });
}

// Tout ce que j'ai fait pour cette fiche : ses demandes (memes numeros), le forfait de la famille, ses comptes entre nous
export function demandesDeLEntree(e, demandes = [], comptes = []) {
  const tels = new Set(e.famille ? telsFamille(e.famille) : [telNormalise(e.telephone)].filter((t) => t.length >= 6));
  const cles = new Set(e.clients.map((c) => c.cle));
  const idsComptes = new Set(comptesDeLEntree(e, comptes).map((c) => c.id));
  const famId = e.famille ? e.famille.id : "";
  return demandes
    .filter((d) => (d.uid && cles.has(d.uid)) || tels.has(telNormalise(d.telephone)) || (famId && d.details && d.details.famille === famId) || (d.details && idsComptes.has(d.details.compte)))
    .sort((a, b) => (String(b.date) + String(b.heure || "")).localeCompare(String(a.date) + String(a.heure || "")));
}

export function comptesDeLEntree(e, comptes = []) {
  const tels = e.famille ? telsFamille(e.famille) : [telNormalise(e.telephone)];
  return comptes.filter((c) => (e.famille && c.famille === e.famille.id) || (telNormalise(c.telephone).length >= 6 && tels.includes(telNormalise(c.telephone))));
}

export const nouveauMembre = () => ({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nom: "", lien: "", telephone: "", age: "adulte" });
export const LIENS = ["Mari", "Femme", "Mère", "Père", "Fils", "Fille", "Sœur", "Frère", "Nièce", "Neveu", "Grand-mère", "Grand-père", "Amie", "Ami", "Autre"];
