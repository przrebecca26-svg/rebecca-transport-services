// NOTIFICATIONS DE MA JOURNEE + TOUT CE QUI SE PASSE SUR LE SITE (18 nov. 2026, soir) - Rebecca Services
// Rebecca : « chaque soir à 19h un rappel pour demain, le matin à 7h la journée du jour avec chaque course,
// une notification 15 minutes avant chaque course de l'agenda (aéroport, livraison, ramassage, RDV beauté...),
// et dès qu'il y a un truc sur le site une alerte qui dit ce que c'est (devis, acompte payé, rendez-vous pris...). »
// Tout est calcule ici (sans Google) : le robot Netlify lit les donnees et envoie les notifications.
import { lireTournee, lireJours, appliquerJour, trajetsDuJourDate, tachesDuJour } from "./tournee.js";
import { lireFamilles, lireChoix, trajetsDesChoix } from "./familles.js";
import { famillesBrutes } from "./repertoire.js";
import { vacancesDuJour, ajouterJours } from "./calendrier.js";
import { estAllerRetour } from "./finCourse.js";
import { rappelsDemain } from "./finCourse.js";
import { rappelsRdvDemain } from "./suiteClient.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^\d{2}:\d{2}$/;
const BEAUTE = ["nails", "hair", "slim", "regenx"];
const ICONES = { transport: "🚗", aeroport: "✈️", livraison: "📦", courses: "🛍️", hatan_kala: "💍", demenagement: "📚", ramassage: "🎒", attente: "⏱️", nails: "💅", hair: "💇‍♀️", slim: "✨", regenx: "🌿", epoxy: "🎁", digital: "💻" };
const enMin = (h) => (HEURE_OK.test(h || "") ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
const hFr = (h) => String(h || "").replace(":", "h");
const jourDe = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const court = (t, n = 40) => String(t || "").trim().slice(0, n);

// Heure et date d'Israel pour un instant donne
export function maintenantIsrael(ms = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

/* ---------- Les courses d'une journee ---------- */
// demandes : documents « demandes » ; tourneeJson / joursJson / repertoireJson : documents prives (champ json)
export function evenementsDuJour(date, { demandes = [], tourneeJson = "", joursJson = "", repertoireJson = "" } = {}) {
  if (!DATE_OK.test(date || "")) return [];
  const liste = [];
  // 1. Courses et rendez-vous acceptes (aller et retour d'un aller-retour, chacun a sa date)
  for (const d of demandes) {
    if (!d || d.statut !== "acceptee" || d.service === "ramassage") continue;
    const icone = ICONES[d.service] || "📌";
    const titre = court(d.serviceTitre || d.service, 30);
    if (d.date === date && HEURE_OK.test(d.heure || "")) liste.push({ min: enMin(d.heure), heure: d.heure, sorte: BEAUTE.includes(d.service) ? "beaute" : "course", texte: `${icone} ${titre} · ${court(d.nom, 30)}`, id: `d-${d.id}` });
    const v = d.details || {};
    if (estAllerRetour(d) && v.dateRetour === date && HEURE_OK.test(v.heureRetour || "")) liste.push({ min: enMin(v.heureRetour), heure: v.heureRetour, sorte: "course", texte: `${icone} Retour ${titre} · ${court(d.nom, 30)}`, id: `r-${d.id}` });
  }
  // 2. Tournee scolaire de ce jour (avec les changements du jour), sauf vacances scolaires
  if (!vacancesDuJour(date)) {
    const t = lireTournee(tourneeJson || "");
    const familles = lireFamilles(famillesBrutes(repertoireJson || "") || []);
    const tous = [...trajetsDesChoix(familles, lireChoix(t.choix)), ...(t.trajets || [])];
    const jours = lireJours(joursJson || "{}");
    const w = jourDe(date);
    const groupes = new Map();
    for (const r of appliquerJour(trajetsDuJourDate(tous, date), date, jours)) {
      const h = (r.type === "matin" ? r.heurePrise : "") || ((r.jours || [])[w] || {}).heure || "";
      if (!HEURE_OK.test(h)) continue;
      const cle = `${h}|${r.type}`;
      const g = groupes.get(cle) || { heure: h, type: r.type, noms: [] };
      g.noms.push(court(String(r.nom || "Enfant").replace(/\s*\((aller|retour)\)\s*$/i, ""), 40));
      groupes.set(cle, g);
    }
    for (const g of groupes.values()) liste.push({ min: enMin(g.heure), heure: g.heure, sorte: "ramassage", texte: `🎒 ${g.type === "matin" ? "Déposer" : "Récupérer"} ${[...new Set(g.noms)].join(", ")}`, id: `t-${g.heure}-${g.type}` });
    // 3. Mes taches du jour
    for (const x of tachesDuJour(jours, date)) if (HEURE_OK.test(x.debut || "")) liste.push({ min: enMin(x.debut), heure: x.debut, sorte: "tache", texte: `📝 ${court(x.titre, 50)}`, id: `k-${x.id}` });
  }
  return liste.sort((a, b) => a.min - b.min);
}

function compter(liste) {
  const n = (s) => liste.filter((e) => e.sorte === s).length;
  const morceaux = [];
  const pl = (k, un, plusieurs) => (k ? `${k} ${k > 1 ? plusieurs : un}` : "");
  morceaux.push(pl(n("course"), "course", "courses"), pl(n("beaute"), "RDV beauté", "RDV beauté"), pl(n("ramassage"), "trajet scolaire", "trajets scolaires"), pl(n("tache"), "tâche", "tâches"));
  return morceaux.filter(Boolean).join(", ");
}

// 19h : résumé de demain
export function messageSoir(aujourdhui, donnees) {
  const demain = ajouterJours(aujourdhui, 1);
  const liste = evenementsDuJour(demain, donnees);
  const rappels = rappelsDemain(donnees.demandes || [], aujourdhui).length + rappelsRdvDemain(donnees.demandes || [], aujourdhui).length;
  const resume = compter(liste) || "rien de prévu";
  const premier = liste[0] ? ` · 1ʳᵉ à ${hFr(liste[0].heure)}` : "";
  return {
    titre: "📅 Demain",
    corps: `Demain : ${resume}${premier}${rappels ? ` · ${rappels} rappel${rappels > 1 ? "s" : ""} WhatsApp à envoyer` : ""}.`,
    tag: `soir-${aujourdhui}`,
    lien: "/admin#/admin",
  };
}

// 7h : la journée du jour, course par course
export function messageMatin(aujourdhui, donnees) {
  const liste = evenementsDuJour(aujourdhui, donnees);
  if (!liste.length) return { titre: "☀️ Aujourd'hui", corps: "Rien de prévu aujourd'hui. Bonne journée !", tag: `matin-${aujourdhui}`, lien: "/admin#/admin" };
  const lignes = liste.map((e) => `${hFr(e.heure)} ${e.texte}`);
  return { titre: `☀️ Aujourd'hui : ${compter(liste)}`, corps: lignes.join("\n").slice(0, 900), tag: `matin-${aujourdhui}`, lien: "/admin#/admin" };
}

// 15 minutes avant : les courses dont l'heure d'alerte tombe dans ce passage du robot (toutes les 2 minutes)
export function rappelsAvant(maintenantMs, donnees, minutes = 15, pas = 2) {
  const { date, min } = maintenantIsrael(maintenantMs);
  return evenementsDuJour(date, donnees)
    .filter((e) => e.min - minutes <= min && e.min - minutes > min - pas)
    .map((e) => ({ titre: `⏰ Dans ${minutes} min · ${hFr(e.heure)}`, corps: e.texte, tag: `avant-${date}-${e.id}`, lien: "/admin#/admin" }));
}

/* ---------- Tout ce qui se passe sur le site ---------- */
const prix = (n) => (typeof n === "number" ? ` · ${n} ₪` : "");
export const SOURCES_SITE = [
  { collection: "demandes", texte: (d) => (d.source === "manuel" ? null : {
      titre: BEAUTE.includes(d.service) ? `${ICONES[d.service] || "💅"} Nouveau rendez-vous` : `${ICONES[d.service] || "🔔"} Nouvelle demande`,
      corps: [court(d.serviceTitre || d.service, 40), court(d.nom, 30), [String(d.date || "").split("-").reverse().slice(0, 2).join("/"), hFr(d.heure)].filter(Boolean).join(" ")].filter(Boolean).join(" · ") + prix(d.prixEstime),
    }) },
  { collection: "commandes", texte: (d) => ({ titre: "🎁 Nouvelle commande Epoxy", corps: `${court(d.produit, 40)}${d.varianteNom ? ` (${court(d.varianteNom, 20)})` : ""} × ${d.quantite || 1} · ${court(d.nom, 30)}${prix(d.prixUnitaire)}` }) },
  { collection: "paiementsDeclares", texte: (d) => ({ titre: "💰 Paiement annoncé", corps: `${d.montant} ₪ par ${d.moyen} (${d.sorte === "acompte" ? "acompte" : "solde"}) · ${court(d.prenom, 30)} · à confirmer` }) },
  { collection: "projetsDigital", texte: (d) => ({ titre: "💻 Demande de devis Digital", corps: `${court(d.nom, 30)}${d.entreprise ? ` · ${court(d.entreprise, 30)}` : ""} · ${court(d.typeProjet, 30)}` }) },
  { collection: "candidaturesPartenaires", texte: (d) => ({ titre: "🛵 Nouvelle candidature coursier", corps: `${court(d.prenom, 30)} ${court(d.nom, 30)} · ${court(d.ville, 30)}` }) },
  { collection: "trajetsPartages", texte: (d) => ({ titre: "🎒 Demande de ramassage scolaire", corps: `${((d.familles || [])[0] || {}).nom || "Une famille"}${(d.familles || []).length > 1 ? ` + ${(d.familles || []).length - 1} famille(s)` : ""}` }) },
  { collection: "recharges", texte: (d) => ({ titre: "💳 Recharge de crédit annoncée", corps: `${d.montant} ₪ par ${d.moyen} · à confirmer` }) },
  { collection: "avis", texte: (d) => ({ titre: "⭐ Nouvel avis", corps: `${"★".repeat(Math.max(1, Math.min(5, d.etoiles || 5)))} ${court(d.commentaire, 120)}` }) },
];
export function messageSite(collection, d) {
  const s = SOURCES_SITE.find((x) => x.collection === collection);
  const m = s && s.texte(d || {});
  return m ? { ...m, corps: String(m.corps || "").slice(0, 300), tag: `${collection}-${(d || {}).id || ""}`, lien: "/admin#/admin" } : null;
}
