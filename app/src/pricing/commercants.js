// RESTAURANTS ET COMMERCANTS PARTENAIRES, version simple (19 nov. 2026) - regles pures - Rebecca Services
// Sans nouvelle regle Firebase : le commercant est une fiche du Repertoire (categorie « Commerçants partenaires »),
// avec son contrat (formule, tarifs pro, moyen de paiement) ; ses livraisons sont les courses ajoutees par Rebecca
// avec son telephone (+ Ajouter une course). Releve de la semaine du dimanche au samedi, arret samedi a minuit,
// paiement le lendemain (dimanche). Rebecca envoie le releve par WhatsApp et note « Semaine payee ».
import { duDe, encaisseDe } from "./finCourse.js";

const cents = (x) => Math.round(x * 100) / 100;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export const CONTRAT_DEFAUT = { formule: "A", jusqua3: 35, de3a6: 45, enPlus: 20, minimumCreneau: 5, parHeure: 75, tresLourd: 5, moyen: "Bit", creneaux: "" };
export const FORMULES = [
  { v: "A", l: "A. À la demande" },
  { v: "B", l: "B. Créneaux réservés" },
  { v: "AB", l: "A + B. Créneaux réservés et à la demande" },
];
// 20 nov. 2026 (Rebecca) : B ou A + B = il a des créneaux réservés. Dans un créneau : prix B (et minimum) ;
// en dehors : prix A, tout seul. Le prix A d'un contrat B / A + B est dans « prixA ».
export const avecCreneaux = (formule) => formule === "B" || formule === "AB";
export const PRIX_A_DEFAUT = { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 };
export const libelleFormule = (formule) => (FORMULES.find((x) => x.v === formule) || FORMULES[0]).l;
// Grille A d'un contrat (lui-même s'il est en A)
export function grilleA(c) {
  if (!avecCreneaux(c.formule)) return { jusqua3: c.jusqua3, de3a6: c.de3a6, enPlus: c.enPlus, tresLourd: c.tresLourd ?? 5 };
  const a = c.prixA && typeof c.prixA === "object" ? c.prixA : {};
  const n = (k) => (Number.isFinite(Number(a[k])) && a[k] !== "" && a[k] != null ? Number(a[k]) : PRIX_A_DEFAUT[k]);
  return { jusqua3: n("jusqua3"), de3a6: n("de3a6"), enPlus: n("enPlus"), tresLourd: n("tresLourd") };
}
export const contratDe = (f) => ({ ...CONTRAT_DEFAUT, ...((f && f.contratPro) || {}) });

const plusJours = (jour, n) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Semaine (dimanche -> samedi) qui contient ce jour
export function semaineDe(jour) {
  if (!DATE_OK.test(jour || "")) return null;
  const debut = plusJours(jour, -new Date(jour + "T12:00:00Z").getUTCDay());
  return { debut, fin: plusJours(debut, 6), paiementLe: plusJours(debut, 7) };
}
export const semaineDecalee = (s, n) => semaineDe(plusJours(s.debut, 7 * n));

// 20 nov. 2026, 9h43 (Rebecca) : au-delà de 6 km, +le même écart par tranche de 3 km (35/45 -> 55 jusqu'à 9 km,
// 65 jusqu'à 12 km) ; au-delà de 12 km : sur devis. L'écart suit tout seul les deux premiers prix.
export const KM_MAX_GRILLE = 12;
export const pasDe = (c) => {
  const p = Math.round((Number(c.de3a6) || 0) - (Number(c.jusqua3) || 0));
  return p > 0 ? p : 10;
};
export function grilleKm(c) {
  const pas = pasDe(c);
  return [
    { de: 0, a: 3, prix: Number(c.jusqua3) || 0 },
    { de: 3, a: 6, prix: Number(c.de3a6) || 0 },
    { de: 6, a: 9, prix: (Number(c.de3a6) || 0) + pas },
    { de: 9, a: 12, prix: (Number(c.de3a6) || 0) + 2 * pas },
  ];
}
// Prix pro d'une livraison (km de la course) ; null au-delà de 12 km (sur devis)
export function prixPro(contrat, km, enPlus = false) {
  if (enPlus) return contrat.enPlus;
  const k = Number(km);
  if (!(k > 0)) return null;
  const t = grilleKm(contrat).find((x) => k <= x.a);
  return t ? t.prix : null;
}

// Releve d'une semaine : livraisons terminees du commercant (liste = ses demandes) et argent
export function releveSemaine(liste = [], mouvements = [], semaine) {
  if (!semaine) return null;
  const lignes = liste
    .filter((d) => d.statut === "terminee" && DATE_OK.test(d.date || "") && d.date >= semaine.debut && d.date <= semaine.fin)
    .sort((a, b) => (a.date + (a.heure || "")).localeCompare(b.date + (b.heure || "")))
    .map((d) => {
      const du = duDe(d);
      const paye = cents(Math.min(du, encaisseDe(mouvements, d.id)));
      return { d, du, paye, reste: cents(Math.max(0, du - paye)) };
    });
  const du = cents(lignes.reduce((s, l) => s + l.du, 0));
  const paye = cents(lignes.reduce((s, l) => s + l.paye, 0));
  return { ...semaine, lignes, nb: lignes.length, du, paye, reste: cents(du - paye) };
}

const fr = (d) => (DATE_OK.test(d || "") ? d.split("-").reverse().join("/") : "");
const adresseDe = (d) => {
  const v = d.details || {};
  const a = v.livraison || v.arrivee || v.adresse || null;
  return (a && a.label) || "";
};
// Message WhatsApp du releve, pour le commercant
export function messageReleve(nom, r, contrat) {
  const lignes = r.lignes.map((l) => `• ${fr(l.d.date)}${l.d.heure ? " " + l.d.heure.replace(":", "h") : ""} · ${adresseDe(l.d) || l.d.nom || "livraison"} · ${l.du} ₪${l.reste === 0 ? " (payé)" : ""}`);
  return [
    `Bonjour ${nom},`,
    `Voici le relevé de vos livraisons Rebecca Services du ${fr(r.debut)} au ${fr(r.fin)} :`,
    ...lignes,
    `Total : ${r.nb} livraison${r.nb > 1 ? "s" : ""}, ${r.du} ₪.`,
    r.paye > 0 ? `Déjà payé : ${r.paye} ₪.` : "",
    r.reste > 0 ? `Reste à payer : ${r.reste} ₪, le ${fr(r.paiementLe)}${contrat && contrat.moyen ? ` par ${contrat.moyen}` : ""}.` : "Tout est réglé, merci !",
    "Merci pour votre confiance, Rebecca",
  ].filter(Boolean).join("\n");
}

// Paiements a noter quand le commercant paie la semaine : un paiement par livraison qui a un reste
export function paiementsSemaine(r, moyen, date) {
  return r.lignes.filter((l) => l.reste > 0).map((l) => ({ kind: "paiement", resId: l.d.id, date, montant: l.reste, moyen }));
}

// CLIENTS D'UN RESTAURANT PARTENAIRE (19 nov. 2026, Rebecca) : les clients des restaurants ne se mélangent pas avec
// mes clientes. Ils sont listés dans la fiche du restaurant (onglet « Ses clients »), à partir de ses livraisons.
// Une case « Aussi dans mes clientes » crée leur fiche chez moi quand elles me demandent un autre service.
const telCourt = (t) => String(t || "").replace(/\D/g, "").replace(/^972/, "0");
export function clientsDuResto(livraisons = []) {
  const parTel = new Map();
  for (const d of livraisons) {
    const x = d && d.details;
    if (!x || !x.commandeResto) continue;
    const tel = telCourt(x.telDestinataire);
    const nom = String(x.destinataire || "").trim();
    const cle = tel.length >= 9 ? tel : nom.toLowerCase();
    if (!cle) continue;
    const c = parTel.get(cle) || { cle, nom, telephone: tel, nb: 0, derniere: "", adresse: null, livraisons: [] };
    c.nb += d.statut === "annulee" || d.statut === "refusee" ? 0 : 1;
    // Historique : chaque livraison (date, heure, adresse, note du restaurant = ce qu'elle a commandé, prix, statut)
    c.livraisons.push({ id: d.id, date: String(d.date || ""), heure: String(d.heure || ""), adresse: x.livraison ? x.livraison.label : "", note: String(x.instructions || ""), prix: typeof d.prixFinal === "number" ? d.prixFinal : null, statut: d.statut || "" });
    if (String(d.date || "") >= c.derniere) {
      c.derniere = String(d.date || "");
      if (nom) c.nom = nom;
      if (x.livraison) c.adresse = x.livraison;
    }
    parTel.set(cle, c);
  }
  for (const c of parTel.values()) c.livraisons.sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
  return [...parTel.values()].sort((a, b) => b.derniere.localeCompare(a.derniere));
}
// La cliente du restaurant est-elle aussi « ma » cliente ? (une fiche du Répertoire, hors restaurants, au même numéro)
export const ficheMaCliente = (client, familles = []) =>
  client.telephone.length >= 9 ? familles.find((f) => f.categorie !== "commercants" && [f.telephone, f.telephone2].some((t) => telCourt(t) === client.telephone)) || null : null;

// 19 nov. 2026 (Rebecca) : « savoir si elle commande chez le Sushi une fois et chez une pizzeria une autre fois ».
// Pour un client (par numéro), chez quels restaurants partenaires il commande, avec le nombre de livraisons.
export function restosDuClient(telephone, demandes = []) {
  const tel = telCourt(telephone);
  if (tel.length < 9) return [];
  const parResto = new Map();
  for (const d of demandes) {
    const x = d && d.details;
    if (!x || !x.commandeResto || telCourt(x.telDestinataire) !== tel || d.statut === "annulee" || d.statut === "refusee") continue;
    const cle = x.commandeResto.cle || d.nom;
    const r = parResto.get(cle) || { nom: String(d.nom || "Restaurant"), nb: 0, derniere: "" };
    r.nb += 1;
    if (String(d.date || "") > r.derniere) r.derniere = String(d.date || "");
    parResto.set(cle, r);
  }
  return [...parResto.values()].sort((a, b) => b.nb - a.nb || b.derniere.localeCompare(a.derniere));
}
