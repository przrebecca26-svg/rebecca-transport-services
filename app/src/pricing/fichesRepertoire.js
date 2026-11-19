// FICHES DU REPERTOIRE (13 nov. 2026, 09h13) - regles pures (aucun acces internet ni base de donnees)
// Rebecca : « le Repertoire c'est pour tout le monde pareil : nom, prenom, telephone, et un bouton Fiche. Dans la fiche :
// les membres de la famille, un onglet enfants (calendrier, ecoles), un onglet historique (tout ce que j'ai fait, dates,
// montants), un onglet finances (paye, a payer, credit, dette). Categories : moi, famille et amis, clientes ; une
// cliente du site ou que je rentre est « cliente » par defaut, je peux la changer. »
// Une fiche = une famille du Repertoire (avec ses membres et ses enfants), ou une cliente du site sans famille.
// Une cliente du site dont le telephone est celui d'un membre d'une famille est dans la fiche de cette famille.

import { statistiques, telNormalise } from "./clients.js";

// Categorie choisie (enregistree) : moi, proches, ou clientes (par defaut)
export const CATEGORIES = [
  { v: "moi", l: "Moi" },
  { v: "proches", l: "Famille et amis" },
  { v: "clientes", l: "Cliente (avec ou sans compte : automatique)" },
];
// 13 nov. 2026, 09h39 : a l'affichage, les clientes se rangent toutes seules : avec compte sur le site, ou sans compte
export const AFFICHAGE = [
  { v: "moi", l: "Moi" },
  { v: "proches", l: "Famille et amis" },
  { v: "avecCompte", l: "Clientes avec compte" },
  { v: "sansCompte", l: "Clientes sans compte" },
];
export const rangDe = (e) => (e.categorie === "moi" || e.categorie === "proches" ? e.categorie : e.clients.some((c) => c.avecCompte) ? "avecCompte" : "sansCompte");
export const libelleCategorie = (v) => (AFFICHAGE.find((c) => c.v === v) || AFFICHAGE[3]).l;

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
  const ordre = { moi: 0, proches: 1, avecCompte: 2, sansCompte: 3 };
  for (const e of entrees) e.rang = rangDe(e);
  return entrees.sort((a, b) => ordre[a.rang] - ordre[b.rang] || a.nom.localeCompare(b.nom, "fr"));
}

const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function filtrerEntrees(entrees, categorie = "tous", texte = "") {
  const q = sansAccent(texte.trim());
  return entrees.filter((e) => {
    if (categorie !== "tous" && (e.rang || rangDe(e)) !== categorie) return false;
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

// Qui a fait la course (Rebecca ou un coequipier) ; Jeremy ne voit que les siennes, Rebecca voit tout avec le nom
export const faiteParDe = (d, admin = "rebecca") => (d && (d.realisePar || d.attribueA)) || admin;
export const pourQui = (liste, moi, estAdmin, admin = "rebecca") => (estAdmin ? liste : liste.filter((d) => faiteParDe(d, admin) === moi));

// RÉSUMÉ DE LA FICHE (19 nov. 2026, V2 « fiches clientes intelligentes ») : calculé avec ce qui est déjà enregistré.
// Fidèle = au moins 3 prestations terminées sur les 6 derniers mois ; inactive = dernière prestation il y a plus de
// 2 mois (comme les relances). « Moi » et « Famille et amis » ne sont jamais rangés fidèles ou inactives.
export const FIDELE_MIN = 3;
export const FIDELE_JOURS = 183;
export const INACTIVE_JOURS = 60;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const joursEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
export function resumeFiche(liste = [], mouvements = [], aujourdhui = "", cartes = [], tels = []) {
  const faites = liste.filter((d) => d.statut === "terminee" && DATE_OK.test(d.date || "")).map((d) => d.date).sort();
  const st = statistiques(liste, mouvements);
  const premiere = faites[0] || "";
  const derniere = faites[faites.length - 1] || "";
  const frequenceJours = faites.length >= 2 ? Math.max(1, Math.round(joursEntre(premiere, derniere) / (faites.length - 1))) : null;
  const depuis = derniere && DATE_OK.test(aujourdhui) ? joursEntre(derniere, aujourdhui) : null;
  const recentes = DATE_OK.test(aujourdhui) ? faites.filter((j) => joursEntre(j, aujourdhui) <= FIDELE_JOURS).length : 0;
  const t = new Set(tels.map(telNormalise).filter((x) => x.length >= 6));
  const sesCartes = cartes.filter((c) => t.has(telNormalise(c.acheteurTel)) || t.has(telNormalise(c.pourTel)));
  return {
    nbPrestations: faites.length,
    premiere,
    derniere,
    depuisJours: depuis,
    frequenceJours,
    panierMoyen: st.prixMoyen,
    depenses: st.encaisse,
    chiffreAffaires: st.chiffreAffaires,
    resteAPayer: st.resteAPayer,
    fidele: recentes >= FIDELE_MIN,
    inactive: depuis !== null && depuis > INACTIVE_JOURS,
    cartesOffertes: sesCartes.filter((c) => t.has(telNormalise(c.acheteurTel))).length,
    cartesRecues: sesCartes.filter((c) => t.has(telNormalise(c.pourTel))).length,
    cartes: sesCartes,
  };
}
// Téléphones d'une entrée du Répertoire
export const telsEntree = (e) => (e.famille ? telsFamille(e.famille) : [telNormalise(e.telephone)].filter((x) => x.length >= 6));
// Filtres du Répertoire : fidèles, inactives (jamais Moi ni Famille et amis)
export const FILTRES_SUIVI = [
  { v: "fideles", l: "⭐ Fidèles" },
  { v: "inactives", l: "💤 Inactives (+2 mois)" },
];
export function suiviDeLEntree(e, demandes = [], mouvements = [], aujourdhui = "") {
  if ((e.rang || rangDe(e)) === "moi" || (e.rang || rangDe(e)) === "proches") return { fidele: false, inactive: false };
  const r = resumeFiche(demandesDeLEntree(e, demandes, []), mouvements, aujourdhui);
  // Une cliente qui a dit « non » aux relances n'apparaît jamais dans la liste à relancer
  return e.famille && e.famille.relances === "non" ? { ...r, inactive: false } : r;
}
