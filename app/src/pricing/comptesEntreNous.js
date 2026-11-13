// COMPTES ENTRE NOUS (13 nov. 2026, 08h43) - regles pures (aucun acces internet ni base de donnees)
// Rebecca : « avec Alexia et son mari c'est un peu du milk-shake » : des courses qu'on me doit, des paiements du
// jour meme ou plus tard (parfois plus que le prix : c'est une avance), du troc (Alexia me fait les ongles : on
// deduit des courses des enfants) et d'anciennes dettes sans date (gg me doit 450 ₪).
// Un compte par personne (Alexia, gg Dahan a part), dans le document PRIVE admin/comptes.
// - ses courses terminees (meme telephone, ou rattachees au compte) : « me doit » le prix ;
// - mes lignes : dette (ancienne dette, il me doit), paye (il m'a paye), jedois (je lui dois : troc, ongles),
//   jepaie (je lui ai paye) ;
// - ce qu'il m'a paye et ce que je lui dois sont automatiquement places sur ses courses encore dues (paiement ou
//   deduction dans Finances) ; le reste attend (avance) et se place sur ses prochaines courses.
// - solde > 0 : il me doit ; solde < 0 : je lui dois.

import { encaisseBrut } from "./comptes.js";

export const TYPES_LIGNE = [
  { v: "dette", signe: 1, l: "Course faite (me doit)", aide: "Une course faite, même ancienne, ou une dette sans date" },
  { v: "paye", signe: -1, l: "Il/elle m'a payé", aide: "Le jour même ou plus tard, même plus que le prix" },
  { v: "jedois", signe: -1, l: "Je lui dois", aide: "Troc : ses ongles, un service rendu…" },
  { v: "jepaie", signe: 1, l: "Je lui ai payé", aide: "Je règle ce que je lui devais" },
];
const TYPES = TYPES_LIGNE.map((t) => t.v);
// 13 nov. 2026, 08h46 : « rentrer tout ce que j'ai fait avec eux, avec la date, pour que ca compte dans Finances »
// -> dans l'ecran seulement : « Course passee deja payee » = la course (a sa date) + le paiement (meme date).
export const CHOIX_SAISIE = [{ v: "passee", signe: 1, l: "Course passée déjà payée", aide: "Oubliée dans les finances : la course et son paiement à leur date" }, ...TYPES_LIGNE];

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const montantOk = (x) => {
  const n = cents(Number(x));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? n : 0;
};
export const chiffres = (t) => String(t || "").replace(/\D/g, "").replace(/^972/, "0");
let compteur = 0;
export const nouvelIdCompte = () => `c${Date.now().toString(36)}${(compteur++).toString(36)}`;

export function lireComptes(json) {
  let o;
  try {
    o = typeof json === "string" ? JSON.parse(json || "[]") : json;
  } catch {
    o = [];
  }
  if (!Array.isArray(o)) return [];
  return o
    .filter((c) => c && typeof c === "object")
    .slice(0, 200)
    .map((c) => ({
      id: String(c.id || nouvelIdCompte()).slice(0, 40),
      nom: String(c.nom || "").slice(0, 60) || "Sans nom",
      telephone: String(c.telephone || "").slice(0, 20),
      famille: String(c.famille || "").slice(0, 40),
      note: String(c.note || "").slice(0, 300),
      lignes: (Array.isArray(c.lignes) ? c.lignes : [])
        .filter((l) => l && TYPES.includes(l.type) && montantOk(l.montant) && DATE_OK.test(l.date || ""))
        .slice(0, 500)
        .map((l) => {
          const montant = montantOk(l.montant);
          return {
            id: String(l.id || nouvelIdCompte()).slice(0, 40),
            date: l.date,
            type: l.type,
            montant,
            libelle: String(l.libelle || "").slice(0, 120),
            moyen: String(l.moyen || "").slice(0, 30),
            affecte: Math.min(montant, Math.max(0, cents(Number(l.affecte) || 0))),
          };
        }),
    }));
}

// Les courses terminees de ce compte (rattachees au compte, ou meme numero de telephone)
export function coursesDuCompte(c, demandes) {
  const tel = chiffres(c.telephone);
  return (demandes || [])
    .filter((d) => d && d.statut === "terminee" && typeof d.prixFinal === "number")
    .filter((d) => (d.details && d.details.compte === c.id) || (tel.length >= 6 && chiffres(d.telephone) === tel))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.heure).localeCompare(String(b.heure)));
}

const resteCourse = (d, mouvements) => Math.max(0, cents(d.prixFinal - encaisseBrut(mouvements, d.id)));
const dispo = (l) => cents(l.montant - l.affecte);
const credit = (l) => l.type === "paye" || l.type === "jedois";

// Solde : > 0 il/elle me doit, < 0 je lui dois
export function soldeCompte(c, demandes, mouvements) {
  let s = 0;
  for (const d of coursesDuCompte(c, demandes)) s += resteCourse(d, mouvements);
  for (const l of c.lignes) {
    if (l.type === "dette" || l.type === "jepaie") s += l.montant;
    else s -= dispo(l); // la partie deja placee sur une course est deja dans le « reste » de la course
  }
  return cents(s);
}

export function phraseSolde(nom, solde) {
  if (Math.abs(solde) < 0.01) return `Vous êtes à jour avec ${nom}`;
  const m = `${Math.abs(solde).toLocaleString("fr-FR")} ₪`;
  return solde > 0 ? `${nom} te doit ${m}` : `Tu dois ${m} à ${nom}`;
}

// Ce qui est paye ou deduit se place sur les courses encore dues, les plus anciennes d'abord.
// Renvoie { mouvements: [a enregistrer], comptes: [mis a jour] } ; mouvements vide = rien a faire.
// paye -> paiement (moyen de la ligne) ; jedois -> correction « Deduit : ... » (troc : pas d'argent recu).
export function planAllocation(comptes, demandes, mouvements, moyens = []) {
  const sortie = [];
  const deja = [...(mouvements || [])];
  const suite = comptes.map((c) => {
    const lignes = c.lignes.map((l) => ({ ...l }));
    const courses = coursesDuCompte(c, demandes);
    for (const l of lignes.filter(credit).sort((a, b) => a.date.localeCompare(b.date))) {
      for (const d of courses) {
        if (dispo(l) <= 0) break;
        const reste = resteCourse(d, deja);
        if (reste <= 0) continue;
        const montant = Math.min(reste, dispo(l));
        const m =
          l.type === "paye"
            ? { kind: "paiement", resId: d.id, date: l.date, montant, moyen: moyens.includes(l.moyen) ? l.moyen : moyens[0] || "Espèces" }
            : { kind: "correction", resId: d.id, date: l.date, montant, motif: `Déduit : ${l.libelle || "troc"}`.slice(0, 200) };
        sortie.push(m);
        deja.push(m);
        l.affecte = cents(l.affecte + montant);
      }
    }
    return { ...c, lignes };
  });
  return { mouvements: sortie, comptes: suite };
}

// Historique d'un compte : courses et lignes, les plus recentes d'abord
export function historique(c, demandes, mouvements) {
  const courses = coursesDuCompte(c, demandes).map((d) => ({
    cle: "d" + d.id,
    date: d.date,
    texte: `${d.serviceTitre || "Course"}${d.details && d.details.enfants ? " · " + d.details.enfants : ""}`,
    montant: d.prixFinal,
    signe: 1,
    reste: resteCourse(d, mouvements),
    course: true,
  }));
  const lignes = c.lignes.map((l) => {
    const t = TYPES_LIGNE.find((x) => x.v === l.type);
    return { cle: "l" + l.id, id: l.id, date: l.date, texte: `${t.l}${l.libelle ? " · " + l.libelle : ""}${l.moyen ? " · " + l.moyen : ""}`, montant: l.montant, signe: t.signe, affecte: l.affecte, ligne: true };
  });
  return [...courses, ...lignes].sort((a, b) => b.date.localeCompare(a.date));
}

// Une ligne ne se supprime que si rien n'a encore ete place sur une course (sinon Finances deviendrait faux)
export const ligneSupprimable = (l) => !(l.affecte > 0);
export const ajouterLigne = (comptes, id, l) =>
  comptes.map((c) => (c.id === id ? { ...c, lignes: [...c.lignes, { id: nouvelIdCompte(), date: l.date, type: l.type, montant: montantOk(l.montant), libelle: String(l.libelle || "").trim().slice(0, 120), moyen: String(l.moyen || ""), affecte: 0 }] } : c));
export const retirerLigne = (comptes, id, ligneId) => comptes.map((c) => (c.id === id ? { ...c, lignes: c.lignes.filter((l) => l.id !== ligneId || !ligneSupprimable(l)) } : c));

// Course faite pour un compte (depuis « ✓ Fait » d'une tache Course / Livraison) : prix note a la fin
export function courseDuCompte(c, { date, heure, titre, prix, de, a }) {
  const p = montantOk(prix);
  if (!c || !p || !DATE_OK.test(date || "")) return null;
  const lieu = (x) => (x && x.label ? String(x.label).split(",")[0] : "");
  return {
    service: "livraison",
    serviceTitre: "Course / Livraison",
    date,
    heure: /^\d{2}:\d{2}$/.test(heure || "") ? heure : "12:00",
    nom: c.nom.slice(0, 100),
    telephone: (c.telephone.trim().length >= 3 ? c.telephone.trim() : "Sans numéro").slice(0, 30),
    moyenPaiement: "Espèces",
    prixEstime: null,
    prixFinal: p,
    surDevis: false,
    kmEstime: null,
    minutesEstimees: null,
    details: { compte: c.id, quoi: String(titre || "").slice(0, 80), recuperation: lieu(de), livraison: lieu(a) },
    message: `${String(titre || "Course").slice(0, 80)}${lieu(de) ? " · de " + lieu(de) : ""}${lieu(a) ? " à " + lieu(a) : ""} · ${p} ₪`,
    statut: "terminee",
    source: "manuel",
  };
}
