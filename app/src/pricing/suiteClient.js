// SUITE CLIENTES (17 nov. 2026, 12h03) - Rebecca Services
// Messages et petites regles pour : beaute (rappel de la veille, reprendre rendez-vous), Boutique Epoxy
// (prete, en livraison, livree, relance), parrainage, retard du ramassage, releve du mois d'une famille,
// lien de paiement en ligne, suivi de la course pour la cliente, heures Wolt, avis publies sur le site.
// Toujours le lien du site ; sans compte, l'invitation a creer son compte.
import { lignesSite } from "./finCourse.js";
import { groupeDe } from "./monMois.js";
import { SITE } from "./ajoutManuel.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const prenomDe = (nom) => String(nom || "").trim().split(/\s+/)[0] || "";
const bonjour = (d) => (prenomDe(d && d.nom) ? `Bonjour ${prenomDe(d.nom)},` : "Bonjour,");
const heureFr = (h) => String(h || "").replace(":", "h");
const plusJours = (date, n) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n, 12)).toISOString().slice(0, 10);
};
const jourLong = (date) => {
  if (!DATE_OK.test(date || "")) return "";
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

/* ---------- 1. Beaute ---------- */
export const estBeaute = (d) => !!d && groupeDe(d.service) === "beaute";
export function rappelsRdvDemain(demandes, aujourdhui) {
  if (!DATE_OK.test(aujourdhui || "")) return [];
  const demain = plusJours(aujourdhui, 1);
  return (demandes || []).filter((d) => d.statut === "acceptee" && estBeaute(d) && d.date === demain && !d.rappelEnvoyeLe);
}
export function messageRappelRdv(d) {
  return [bonjour(d), `Petit rappel : votre rendez-vous ${d.serviceTitre || ""} demain, ${jourLong(d.date)} à ${heureFr(d.heure)}.`.replace("  ", " "), "Vous me confirmez ? Prévenez-moi en cas d'empêchement.", ...lignesSite(d), "À demain, Rebecca"].join("\n");
}
export const SEMAINES_PROCHAIN_RDV = 3;
export function dateProchainRdv(d, semaines = SEMAINES_PROCHAIN_RDV) {
  return DATE_OK.test(d.date || "") ? plusJours(d.date, semaines * 7) : "";
}
export function messageReprendreRdv(d, semaines = SEMAINES_PROCHAIN_RDV) {
  const date = dateProchainRdv(d, semaines);
  return [
    bonjour(d),
    "Merci pour votre visite 💅",
    date ? `Votre prochain rendez-vous conseillé : vers le ${jourLong(date)}.` : `Votre prochain rendez-vous conseillé : dans ${semaines} semaines.`,
    "Réservez directement sur mon site ou répondez à ce message, je vous trouve un créneau.",
    ...lignesSite(d),
    "À bientôt, Rebecca",
  ].join("\n");
}

/* ---------- 2. Boutique Epoxy ---------- */
export const ETAPES_COMMANDE = [
  { id: "prete", bouton: "✅ Prête", titre: "prête" },
  { id: "livraison", bouton: "🚗 En livraison", titre: "en livraison" },
  { id: "livree", bouton: "📦 Livrée", titre: "livrée" },
];
export function messageCommande(c, etape) {
  const quoi = `${c.produit || "votre commande"}${c.varianteNom ? ` (${c.varianteNom})` : ""}`;
  const ligne = etape === "prete"
    ? `Bonne nouvelle : ${quoi} est prête ✨ On convient ensemble de la livraison ou du retrait ?`
    : etape === "livraison"
      ? `Je suis en route pour vous livrer ${quoi} 🚗`
      : `${quoi} vous a été livrée 📦 Merci pour votre confiance 🙏 J'espère qu'elle vous plaît !`;
  return [bonjour(c), ligne, ...lignesSite(c), "Rebecca"].join("\n");
}
// Relance 2 a 3 mois apres une commande terminee (une seule fois)
export function relancesEpoxy(commandes, aujourdhui) {
  if (!DATE_OK.test(aujourdhui || "")) return [];
  const debut = plusJours(aujourdhui, -90);
  const fin = plusJours(aujourdhui, -60);
  return (commandes || []).filter((c) => {
    const jour = c.livreeLe || (c.creeLe && c.creeLe.toDate ? c.creeLe.toDate().toISOString().slice(0, 10) : "");
    return c.statut === "terminée" && !c.relanceLe && DATE_OK.test(jour || "") && jour >= debut && jour <= fin;
  });
}
export function messageRelanceEpoxy(c) {
  return [bonjour(c), "J'espère que votre création Epoxy vous plaît toujours ✨", "Une envie de nouvelle pièce, un cadeau à offrir ? Découvrez les nouveautés de la boutique sur mon site.", ...lignesSite(c), "À bientôt, Rebecca"].join("\n");
}

/* ---------- 3. Parrainage ---------- */
export const CADEAU_PARRAINAGE = 10;
export const lienParrainage = (uid, site = SITE) => (uid ? `${site}/?parrain=${encodeURIComponent(uid)}` : "");
export function lireParrain(url) {
  const m = /[?&]parrain=([A-Za-z0-9_-]{6,128})/.exec(String(url || ""));
  return m ? m[1] : "";
}
export function messageParrainage(uid, prenom = "") {
  return [`${prenom ? prenom + " te" : "Je te"} conseille Rebecca Services (transport, aéroport, livraisons, beauté…) à Netanya 😊`, `Réserve avec ce lien : ${lienParrainage(uid)}`].join("\n");
}
// La demande doit-elle donner un cadeau a sa marraine ? (pas a soi-meme, une seule fois, course terminee)
export const cadeauAOffrir = (d) => !!(d && d.details && d.details.parrain && d.details.parrain !== d.uid && d.statut === "terminee" && !d.parrainageOffertLe);

/* ---------- 4. Ramassage : retard ---------- */
export function messageRetard(prenoms, minutes = 10) {
  const qui = prenoms.length > 1 ? `${prenoms.slice(0, -1).join(", ")} et ${prenoms[prenoms.length - 1]}` : prenoms[0] || "votre enfant";
  return ["Bonjour,", `Petit retard sur la route : j'arrive pour ${qui} avec environ ${minutes} minutes de retard. Désolée et merci de votre patience 🙏`, ...lignesSite({ uid: "famille" }), "Rebecca"].join("\n");
}

/* ---------- 5. Releve du mois d'une famille / cliente ---------- */
// courses : demandes de la fiche ; mouvements : paiements ; mois "AAAA-MM" ; soldeComptes : ce qu'elle doit en plus (comptes entre nous)
export function releveDuMois(nom, courses, mouvements, mois, soldeComptes = 0) {
  const prix = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
  const paye = (d) => cents((mouvements || []).filter((m) => m.resId === d.id && (m.kind === "paiement" || m.kind === "correction")).reduce((s, m) => s + (Number(m.montant) || 0), 0));
  const du = (courses || []).filter((d) => String(d.date || "").slice(0, 7) === mois && d.statut === "terminee").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const total = cents(du.reduce((s, d) => s + prix(d), 0));
  const regle = cents(du.reduce((s, d) => s + Math.min(prix(d), paye(d)), 0));
  const reste = cents(Math.max(0, total - regle) + Math.max(0, Number(soldeComptes) || 0));
  const nomMois = new Date(`${mois}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const lignes = [`Bonjour ${prenomDe(nom)},`.replace("Bonjour ,", "Bonjour,"), `Voici votre relevé de ${nomMois} :`];
  for (const d of du) lignes.push(`• ${d.date.split("-").reverse().slice(0, 2).join("/")} ${d.serviceTitre || ""} : ${prix(d)} ₪${paye(d) >= prix(d) ? " (réglé)" : ""}`);
  if (!du.length) lignes.push("• Aucune course terminée ce mois-ci.");
  lignes.push(`Total : ${total} ₪ · déjà réglé : ${regle} ₪`);
  if (Number(soldeComptes) > 0) lignes.push(`Autres sommes dues : ${cents(soldeComptes)} ₪`);
  lignes.push(reste > 0 ? `Reste à régler : ${reste} ₪. Merci 🙏` : "Tout est réglé, merci 🙏");
  lignes.push(...lignesSite({ uid: "famille" }), "Rebecca");
  return { texte: lignes.join("\n"), total, regle, reste, nb: du.length };
}

/* ---------- 8. Paiement en ligne ---------- */
// liens = { bit: "05x...", paybox: "https://...", paypal: "https://paypal.me/..." } (Reglages → Paiement en ligne)
export function lignesPaiement(liens, montant) {
  const l = liens || {};
  const res = [];
  if (String(l.bit || "").replace(/\D/g, "").length >= 9) res.push(`• Bit : au ${String(l.bit).trim()}`);
  if (/^https:\/\//.test(l.paybox || "")) res.push(`• PayBox : ${l.paybox.trim()}`);
  if (/^https:\/\//.test(l.paypal || "")) res.push(`• PayPal : ${l.paypal.trim().replace(/\/$/, "")}${/paypal\.me\//.test(l.paypal) && montant > 0 ? `/${cents(montant)}ILS` : ""}`);
  return res;
}
export function messagePaiement(d, montant, liens) {
  const moyens = lignesPaiement(liens, montant);
  if (!moyens.length) return "";
  return [bonjour(d), `Pour régler ${montant > 0 ? `${cents(montant)} ₪` : "votre course"} :`, ...moyens, "Merci 🙏", ...lignesSite(d), "Rebecca"].join("\n");
}

/* ---------- 7. Suivi de la course pour la cliente ---------- */
const TEXTES_AVANCEMENT = { depart: "Rebecca est en route", prise: "Prise en charge", depose: "Déposée ✅", maison: "Course terminée ✅" };
export function avancementDe(d) {
  const c = d && d.chrono ? d.chrono : {};
  const t = d && d.details && d.details.typeTrajet === "ar" ? (c.retour && Object.values(c.retour).some(Boolean) ? "retour" : "aller") : "simple";
  const x = c[t] || {};
  for (const id of ["maison", "depose", "prise", "depart"]) {
    if (/^\d{2}:\d{2}$/.test(x[id] || "")) return `${t === "simple" ? "" : t === "aller" ? "Aller : " : "Retour : "}${TEXTES_AVANCEMENT[id]} à ${heureFr(x[id])}`;
  }
  return "";
}

/* ---------- 6. Wolt : gain par heure ---------- */
// lignes Wolt (autresRevenus) du mois + heures notees par ligne (essence.woltHeures[id])
export function woltParHeure(lignes, heures, mois) {
  let revenu = 0;
  let h = 0;
  let n = 0;
  for (const l of lignes || []) {
    if (String(l.debut || "").slice(0, 7) !== mois) continue;
    const x = Number((heures || {})[l.id]);
    if (!(x > 0)) continue;
    revenu += Number(l.revenu) || 0;
    h += x;
    n++;
  }
  return n ? { lignes: n, heures: cents(h), revenu: cents(revenu), parHeure: Math.round(revenu / h) } : null;
}

/* ---------- 9. Avis publies sur le site ---------- */
export const MAX_AVIS_PUBLICS = 30;
export function avisPublic(a, prenom) {
  const etoiles = Math.max(1, Math.min(5, Math.round(Number(a.etoiles) || 0)));
  return { id: String(a.id || "").slice(0, 60), prenom: String(prenom || "Cliente").trim().split(/\s+/)[0].slice(0, 30) || "Cliente", etoiles, texte: String(a.commentaire || "").trim().slice(0, 400) };
}
export function lireAvisPublics(json) {
  try {
    const l = JSON.parse(json || "[]");
    return Array.isArray(l) ? l.filter((x) => x && x.id && x.etoiles >= 1).slice(0, MAX_AVIS_PUBLICS) : [];
  } catch {
    return [];
  }
}
