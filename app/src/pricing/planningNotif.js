// NOTIFICATIONS DE MA JOURNEE + TOUT CE QUI SE PASSE SUR LE SITE (18 nov. 2026, soir) - Rebecca Services
// Rebecca : « chaque soir à 19h un rappel pour demain, le matin à 7h la journée du jour avec chaque course,
// une notification 15 minutes avant chaque course de l'agenda (aéroport, livraison, ramassage, RDV beauté...),
// et dès qu'il y a un truc sur le site une alerte qui dit ce que c'est (devis, acompte payé, rendez-vous pris...). »
// Tout est calcule ici (sans Google) : le robot Netlify lit les donnees et envoie les notifications.
import { lireTournee, lireJours, appliquerJour, trajetsDuJourDate, tachesDuJour, etapesPerso } from "./tournee.js";
import { extremites } from "./enchainement.js";
import { departsEstimes } from "./deplacementsJour.js";
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
    // 25 nov. 2026, 22h30 : l'adresse de prise en charge sert à calculer l'heure de départ (alerte « Pars maintenant »)
    let x = {};
    try { x = extremites(d) || {}; } catch { x = {}; }
    if (d.date === date && HEURE_OK.test(d.heure || "")) liste.push({ min: enMin(d.heure), heure: d.heure, sorte: BEAUTE.includes(d.service) ? "beaute" : "course", texte: `${icone} ${titre} · ${court(d.nom, 30)}`, id: `d-${d.id}`, adresse: x.debut || null });
    const v = d.details || {};
    if (estAllerRetour(d) && v.dateRetour === date && HEURE_OK.test(v.heureRetour || "")) liste.push({ min: enMin(v.heureRetour), heure: v.heureRetour, sorte: "course", texte: `${icone} Retour ${titre} · ${court(d.nom, 30)}`, id: `r-${d.id}`, adresse: x.fin || null });
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
    for (const x of tachesDuJour(jours, date)) {
      if (!HEURE_OK.test(x.debut || "")) continue;
      // 25 nov. 2026, 22h30 : trajet personnel -> chaque étape (prendre, arrêts, déposer) a sa notification
      if (x.type === "perso") {
        for (const e of etapesPerso(x)) liste.push({ min: e.min, heure: e.heure.replace("h", ":"), sorte: "tache", texte: `🚗 ${court(e.texte, 50)}`, id: `k-${x.id}-${e.cle.split("@")[0]}`, adresse: e.adresse, jusqua: e.jusqua });
        continue;
      }
      liste.push({ min: enMin(x.debut), heure: x.debut, sorte: "tache", texte: `📝 ${court(x.titre, 50)}`, id: `k-${x.id}`, adresse: x.prise || x.lieu || null, jusqua: x.fin ? x.fin.replace(":", "h") : "" });
    }
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
  const premier = liste[0] ? ` · première à ${hFr(liste[0].heure)}` : "";
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
// 25 nov. 2026, 22h30 (Rebecca : « des alertes de départ en fonction des temps de trajet ») : si la route depuis
// l'étape d'avant (ou la maison) demande de partir plus tôt, l'alerte arrive à l'heure de départ : « 🚗 Pars maintenant ».
export function rappelsAvant(maintenantMs, donnees, minutes = 15, pas = 2) {
  const { date, min } = maintenantIsrael(maintenantMs);
  const liste = evenementsDuJour(date, donnees);
  let domicile = null;
  try { domicile = lireTournee(donnees.tourneeJson || "").domicile; } catch { domicile = null; }
  const departs = new Map(departsEstimes(liste, domicile, date).map((x) => [x.id, x]));
  return liste
    .map((e) => {
      const d = departs.get(e.id);
      const alerte = d && d.partir < e.min - minutes ? d.partir : e.min - minutes;
      return { e, d: d && d.partir < e.min - minutes ? d : null, alerte };
    })
    .filter(({ alerte }) => alerte <= min && alerte > min - pas)
    .map(({ e, d }) => (d
      ? { titre: `🚗 Pars maintenant · ${hFr(e.heure)}`, corps: `${e.texte} · environ ${d.route} min de route`, tag: `avant-${date}-${e.id}`, lien: "/admin#/admin" }
      : { titre: `⏰ Dans ${minutes} min · ${hFr(e.heure)}`, corps: e.texte, tag: `avant-${date}-${e.id}`, lien: "/admin#/admin" }));
}

/* ---------- Tout ce qui se passe sur le site ---------- */
const prix = (n) => (typeof n === "number" ? ` · ${n} ₪` : "");
export const SOURCES_SITE = [
  { collection: "demandes", texte: (d) => (d.source === "manuel" ? null : {
      titre: BEAUTE.includes(d.service) ? `${ICONES[d.service] || "💅"} Nouveau rendez-vous` : `${ICONES[d.service] || "🔔"} Nouvelle demande`,
      corps: [court(d.serviceTitre || d.service, 40), court(d.nom, 30) + (((d.details || {}).nbFamilles || 1) > 1 ? ` + ${d.details.nbFamilles - 1} famille(s)` : ""), [String(d.date || "").split("-").reverse().slice(0, 2).join("/"), hFr(d.heure)].filter(Boolean).join(" ")].filter(Boolean).join(" · ") + prix(d.prixEstime),
    }) },
  { collection: "commandes", texte: (d) => ({ titre: "🎁 Nouvelle commande Epoxy", corps: `${court(d.produit, 40)}${d.varianteNom ? ` (${court(d.varianteNom, 20)})` : ""} × ${d.quantite || 1} · ${court(d.nom, 30)}${prix(d.prixUnitaire)}` }) },
  { collection: "paiementsDeclares", texte: (d) => ({ titre: "💰 Paiement annoncé", corps: `${d.montant} ₪ par ${d.moyen} (${d.sorte === "acompte" ? "acompte" : "solde"}) · ${court(d.prenom, 30)} · à confirmer` }) },
  { collection: "projetsDigital", texte: (d) => ({ titre: "💻 Demande de devis Digital", corps: `${court(d.nom, 30)}${d.entreprise ? ` · ${court(d.entreprise, 30)}` : ""} · ${court(d.typeProjet, 30)}` }) },
  { collection: "candidaturesPartenaires", texte: (d) => ({ titre: "🛵 Nouvelle candidature coursier", corps: `${court(d.prenom, 30)} ${court(d.nom, 30)} · ${court(d.ville, 30)}` }) },
  // 18 nov. 2026 (tests) : plus de notification « trajetsPartages » : chaque demande de ramassage cree aussi une
  // demande (notifiee ci-dessus, avec l'heure et le prix). Sinon Rebecca recevait deux notifications.
  { collection: "recharges", texte: (d) => ({ titre: "💳 Recharge de crédit annoncée", corps: `${d.montant} ₪ par ${d.moyen} · à confirmer` }) },
  { collection: "avis", texte: (d) => ({ titre: "⭐ Nouvel avis", corps: `${"★".repeat(Math.max(1, Math.min(5, d.etoiles || 5)))}${Number(d.pourboire) > 0 ? ` · 💝 pourboire ${d.pourboire} ₪` : ""} ${court(d.commentaire, 120)}` }) },
  // 25 nov. 2026 : une carte créée par Rebecca elle-même (offerte) n'est pas une commande
  { collection: "cartesCadeaux", texte: (d) => (d.offerte || d.moyen === "Offerte" || d.acheteurNom === "Rebecca Services" ? { titre: "🎁 Carte cadeau créée", corps: `${d.montant} ₪ offerte pour ${court(d.pourNom, 30)}` } : { titre: "🎁 Carte cadeau commandée", corps: `${d.montant} ₪ pour ${court(d.pourNom, 30)} · de ${court(d.acheteurNom, 30)} · paiement ${d.moyen}` }) },
  { collection: "cartesCadeaux", champ: "annonceLe", cle: "cartesCadeauxPaye", texte: (d) => ({ titre: "💰 Carte cadeau payée (à confirmer)", corps: `${d.montant} ₪ par ${d.moyen} · ${court(d.acheteurNom, 30)} pour ${court(d.pourNom, 30)}` }) },
];
export function messageSite(collection, d, cle = "") {
  const s = SOURCES_SITE.find((x) => (cle ? x.cle === cle : x.collection === collection && !x.cle));
  const m = s && s.texte(d || {});
  return m ? { ...m, corps: String(m.corps || "").slice(0, 300), tag: `${cle || collection}-${(d || {}).id || ""}`, lien: "/admin#/admin" } : null;
}

/* ---------- 18 nov. 2026 (22h25) : les 4 suggestions validées (« Toutes ») ---------- */
import { resteDe } from "./finCourse.js";
import { volDeLaCourse, choisirVol, etatDuVol, volConsultable, arriveeConseillee } from "./vols.js";
import { indicateursPeriode } from "./statistiques.js";

const jj = (date) => String(date || "").split("-").reverse().slice(0, 2).join("/");
const euros = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ")} ₪`;

// 1. Paiements en retard : course terminée depuis 3 jours ou plus, il reste à encaisser (une alerte par jour, à 10h)
export function paiementsEnRetard(demandes = [], mouvements = [], aujourdhui, jours = 3) {
  const limite = ajouterJours(aujourdhui, -jours);
  return demandes
    .filter((d) => d && d.statut === "terminee")
    .map((d) => {
      const fin = estAllerRetour(d) && DATE_OK.test((d.details || {}).dateRetour || "") ? d.details.dateRetour : d.date;
      return { d, fin, reste: resteDe(d, mouvements) };
    })
    .filter((x) => DATE_OK.test(x.fin || "") && x.fin <= limite && x.reste > 0)
    .sort((a, b) => (a.fin < b.fin ? -1 : 1));
}
export function messageRetards(liste, aujourdhui) {
  if (!liste.length) return null;
  const total = liste.reduce((s, x) => s + x.reste, 0);
  const lignes = liste.slice(0, 8).map((x) => `${court(x.d.nom, 25)} · ${euros(x.reste)} (course du ${jj(x.fin)})`);
  return { titre: `💸 ${liste.length} paiement${liste.length > 1 ? "s" : ""} en retard · ${euros(total)}`, corps: lignes.join("\n") + (liste.length > 8 ? `\n+ ${liste.length - 8} autre(s)` : ""), tag: `retards-${aujourdhui}`, lien: "/admin#/admin" };
}

// 2. Demande sans réponse depuis 2 heures (une seule fois par demande ; jamais entre 22h et 7h)
export function demandesSansReponse(demandes = [], maintenantMs, heures = 2, pas = 2) {
  const { min } = maintenantIsrael(maintenantMs);
  if (min < 7 * 60 || min >= 22 * 60) return [];
  const debut = maintenantMs - heures * 3600000 - pas * 60000;
  const fin = maintenantMs - heures * 3600000;
  return demandes
    .filter((d) => d && d.statut === "en attente" && d.source !== "manuel")
    .filter((d) => { const t = Date.parse(d.creeLe || ""); return Number.isFinite(t) && t > debut && t <= fin; })
    .map((d) => ({ titre: `⏳ Sans réponse depuis ${heures} h`, corps: `${court(d.serviceTitre || d.service, 30)} · ${court(d.nom, 30)}${d.date ? ` · ${jj(d.date)} ${hFr(d.heure)}` : ""} : la cliente attend ta réponse`, tag: `attente-${d.id}`, lien: "/admin#/admin" }));
}
export const nbEnAttente = (demandes = []) => demandes.filter((d) => d && d.statut === "en attente" && d.source !== "manuel").length;

// 3. Vols en retard : les courses aéroport d'aujourd'hui et demain (aller et retour)
export function volsASuivre(demandes = [], aujourdhui) {
  const liste = [];
  for (const d of demandes) {
    if (!d || d.statut !== "acceptee" || d.service !== "aeroport") continue;
    const v = d.details || {};
    const lignes = [{ ...d }];
    if (estAllerRetour(d) && DATE_OK.test(v.dateRetour || "")) lignes.push({ ...d, estRetour: true, date: v.dateRetour, heure: v.heureRetour || d.heure });
    for (const x of lignes) {
      const vol = volDeLaCourse(x);
      if (vol && volConsultable(vol, aujourdhui) && x.date >= aujourdhui) liste.push({ cle: `${d.id}${x.estRetour ? "-r" : ""}`, vol, d: x });
    }
  }
  return liste;
}
// Etat a signaler : null si a l'heure (moins de 15 min d'ecart). Sinon une cle courte (« r45 », « annule »)
export function signalVol(ligne, vol) {
  if (!ligne) return null;
  const e = etatDuVol(ligne, vol);
  if (/annul/i.test(e.etat)) return { cle: "annule", e };
  if (e.ecartMinutes >= 15) return { cle: `r${Math.round(e.ecartMinutes / 15) * 15}`, e };
  return null;
}
export function messageVol(x, s) {
  // Étape 3 (26 nov. 2026) : pour une arrivée, ma nouvelle heure conseillée (même écart qu'avec l'heure prévue)
  const a = s.cle === "annule" ? null : arriveeConseillee(x.d, s.e);
  const plus = a ? ` · 🕒 sois là vers ${a.conseillee.replace(":", "h")} au lieu de ${a.prevue.replace(":", "h")}` : "";
  return { titre: s.cle === "annule" ? "✈️ Vol annulé" : `✈️ Vol en retard · ${s.e.etat.replace("Retard de ", "+")}`, corps: `${court(x.d.nom, 30)} · ${x.vol.texte.toUpperCase()} · ${s.e.texte}${plus}`.slice(0, 300), tag: `vol-${x.cle}`, lien: "/admin#/admin" };
}
export { choisirVol };

// 4. Bilan de la semaine (dimanche soir) : la semaine de dimanche à samedi qui vient de finir
export function semainePassee(aujourdhui) {
  const w = jourDe(aujourdhui); // 0 = dimanche
  const fin = ajouterJours(aujourdhui, -(w + 1)); // samedi dernier
  return { debut: ajouterJours(fin, -6), fin };
}
export function messageSemaine(aujourdhui, { demandes = [], mouvements = [], depenses = [], autresRevenus = [] } = {}) {
  const p = semainePassee(aujourdhui);
  const r = indicateursPeriode(p, { demandes, mouvements, depenses, autresRevenus });
  return {
    titre: `📊 Ta semaine du ${jj(p.debut)} au ${jj(p.fin)}`,
    corps: [`Chiffre d'affaires ${euros(r.chiffreAffaires)} · ${r.courses} prestation${r.courses > 1 ? "s" : ""}`, `Encaissé ${euros(r.encaisse)} · Wolt ${euros(r.wolt)} · pourboires ${euros(r.pourboires)}`, `Dépenses ${euros(r.depenses)} · Bénéfice ${euros(r.benefice)}`].join("\n"),
    tag: `semaine-${p.fin}`,
    lien: "/admin#/admin",
  };
}
