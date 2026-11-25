// AGENDA DES PROFESSIONNELS (formules Business avec module agenda, et Pack Pro) - 25 nov. 2026, demande de Rebecca :
// agenda individuel sur leur telephone ; horaires, disponibilites, conges et absences ; rendez-vous manuels et demandes
// des clients ; durees selon les prestations ; confirmations, modifications, annulations ; rappels ; aucune double
// reservation ; donnees strictement separees entre professionnels (regles v37 : chacun ne lit que son agenda).
// Logique pure, testee dans tests/prosAgenda.test.mjs. Heures locales d'Israel ("HH:MM"), dates "AAAA-MM-JJ".
import { TARIFS } from "./config.js";
import { localVersUtc, periodesFermees } from "./calendrier.js";

export const JOURS_SEMAINE = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
export const enMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const enHeure = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const jourDe = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const ajouterJoursDate = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ---------- Reglages de l'agenda ---------- */
export const agendaVide = () => ({
  actif: false,
  enLigne: false, // les clientes peuvent demander un rendez-vous depuis l'annuaire
  horaires: { 0: [{ debut: "09:00", fin: "18:00" }], 1: [{ debut: "09:00", fin: "18:00" }], 2: [{ debut: "09:00", fin: "18:00" }], 3: [{ debut: "09:00", fin: "18:00" }], 4: [{ debut: "09:00", fin: "18:00" }], 5: [], 6: [] },
  conges: [],
  prestations: [],
  pause: 0, // minutes entre deux rendez-vous
  delaiHeures: 12, // une cliente ne peut pas demander moins de X heures a l'avance
  joursMax: 60, // jusqu'a quand on peut reserver
  messageConfirmation: "",
  fermeChabbat: false, // le pro peut choisir de fermer sa reservation en ligne pendant Chabbat et les fetes
});
export function lireAgenda(json) {
  let a = null;
  try {
    a = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    a = null;
  }
  const v = { ...agendaVide(), ...(a && typeof a === "object" ? a : {}) };
  const horaires = {};
  for (let j = 0; j < 7; j++) {
    const l = Array.isArray(v.horaires && v.horaires[j]) ? v.horaires[j] : [];
    horaires[j] = l.filter((p) => p && HEURE.test(p.debut) && HEURE.test(p.fin) && enMin(p.fin) > enMin(p.debut)).slice(0, 4).sort((x, y) => enMin(x.debut) - enMin(y.debut));
  }
  return {
    actif: v.actif === true,
    enLigne: v.enLigne === true,
    horaires,
    conges: (Array.isArray(v.conges) ? v.conges : []).filter((c) => c && DATE.test(c.du) && DATE.test(c.au) && c.au >= c.du).slice(0, 60).map((c) => ({ du: c.du, au: c.au, motif: txt(c.motif, 80), debut: HEURE.test(c.debut || "") ? c.debut : "", fin: HEURE.test(c.fin || "") ? c.fin : "" })),
    prestations: (Array.isArray(v.prestations) ? v.prestations : []).filter((p) => p && p.nom && Number(p.duree) >= 5).slice(0, 40).map((p, i) => ({ id: txt(p.id, 20) || `s${i}`, nom: txt(p.nom, 80), duree: Math.min(600, Math.round(Number(p.duree) / 5) * 5), prix: txt(p.prix, 40), enLigne: p.enLigne !== false })),
    pause: Math.max(0, Math.min(120, Math.round(Number(v.pause) || 0))),
    delaiHeures: Math.max(0, Math.min(168, Math.round(Number(v.delaiHeures) || 0))),
    joursMax: Math.max(1, Math.min(180, Math.round(Number(v.joursMax) || 60))),
    messageConfirmation: txt(v.messageConfirmation, 300),
    fermeChabbat: v.fermeChabbat === true,
  };
}
export function erreursAgenda(a) {
  const e = [];
  if (!a.prestations.length) e.push("Ajoute au moins une prestation avec sa durée.");
  if (![0, 1, 2, 3, 4, 5, 6].some((j) => a.horaires[j].length)) e.push("Indique au moins un jour d'ouverture.");
  for (let j = 0; j < 7; j++) {
    const l = a.horaires[j];
    for (let i = 1; i < l.length; i++) if (enMin(l[i].debut) < enMin(l[i - 1].fin)) e.push(`${JOURS_SEMAINE[j]} : deux plages se chevauchent.`);
  }
  return e;
}

/* ---------- Rendez-vous ---------- */
export const STATUTS_RDV = [
  { v: "demande", l: "À confirmer" },
  { v: "confirme", l: "Confirmé" },
  { v: "refuse", l: "Refusé" },
  { v: "annule", l: "Annulé" },
  { v: "termine", l: "Terminé" },
  { v: "absent", l: "Absent(e)" },
];
export const libelleStatutRdv = (v) => (STATUTS_RDV.find((s) => s.v === v) || { l: v }).l;
// Un rendez-vous qui occupe son creneau (les refus et annulations le liberent)
export const occupe = (r) => ["demande", "confirme", "termine", "absent"].includes(r.statut);
const TRANSITIONS_RDV = { demande: ["confirme", "refuse"], confirme: ["annule", "termine", "absent"], refuse: [], annule: [], termine: [], absent: [] };
export const statutsRdvPossibles = (s) => TRANSITIONS_RDV[s] || [];
export function changerStatutRdv(r, nouveau, quandMs = Date.now()) {
  if (!statutsRdvPossibles(r.statut).includes(nouveau)) return { erreur: `Impossible : « ${libelleStatutRdv(r.statut)} » → « ${libelleStatutRdv(nouveau)} ».` };
  return { erreur: "", rdv: { ...r, statut: nouveau, majLeMs: quandMs } };
}

// Quarts d'heure occupes par un rendez-vous (cles "HHMM") : sert au verrou anti double reservation
export function quartsDe(heure, duree) {
  const d = enMin(heure);
  const f = d + duree;
  const l = [];
  for (let m = Math.floor(d / 15) * 15; m < f; m += 15) l.push(enHeure(m).replace(":", ""));
  return l;
}
export function quartsOccupes(rdvs, date, pause = 0) {
  const s = new Set();
  for (const r of rdvs || []) if (r.date === date && occupe(r)) for (const q of quartsDe(r.heure, r.duree + pause)) s.add(q);
  return s;
}

// Absences d'un jour (conges entiers ou partiels) -> plages [debutMin, finMin]
function absencesDuJour(a, date) {
  return a.conges.filter((c) => date >= c.du && date <= c.au).map((c) => (c.debut && c.fin ? [enMin(c.debut), enMin(c.fin)] : [0, 24 * 60]));
}

// Fermetures Chabbat et fetes (regle de Rebecca Services : 2 h avant l'entree, 1 h apres la sortie) en minutes locales du jour
function fermeturesDuJour(date, t) {
  const debutJour = localVersUtc(date, "00:00");
  const finJour = debutJour + 24 * 3600000;
  return periodesFermees(ajouterJoursDate(date, -1), 3, t)
    .filter((p) => p.type === "chabbat_fete" && p.debutUtc < finJour && p.finUtc > debutJour)
    .map((p) => [Math.max(0, Math.round((p.debutUtc - debutJour) / 60000)), Math.min(24 * 60, Math.round((p.finUtc - debutJour) / 60000))]);
}
const chevauche = (d, f, plages) => plages.some(([a, b]) => d < b && f > a);

// Creneaux libres d'un jour pour une duree. options.enLigne = demande d'une cliente sur le site : respecte le delai
// minimum et l'horizon. 25 nov. 2026, 20h23 (Rebecca) : Chabbat et fetes ne bloquent QUE l'agenda de Rebecca Services ;
// chaque professionnel independant fait comme il veut (ses horaires et ses conges decident). bloquerChabbat reste
// possible pour un pro qui le demanderait (reglage de son agenda).
export function creneauxLibres(agenda, date, duree, { rdvs = [], cellules = null, maintenantMs = Date.now(), enLigne = false, pas = 15, t = TARIFS } = {}) {
  const a = agenda;
  if (!a || !DATE.test(date) || !(duree > 0)) return [];
  const plages = a.horaires[jourDe(date)] || [];
  if (!plages.length) return [];
  const pris = cellules ? new Set(Object.keys(cellules).filter((k) => cellules[k] === true)) : quartsOccupes(rdvs, date, a.pause);
  const absences = absencesDuJour(a, date);
  const fermetures = enLigne && a.fermeChabbat ? fermeturesDuJour(date, t) : [];
  const sortie = [];
  for (const p of plages) {
    // en ligne : heures au quart d'heure (09:00, 09:15...) pour le verrou anti double reservation
    const depart = enLigne ? Math.ceil(enMin(p.debut) / 15) * 15 : enMin(p.debut);
    for (let m = depart; m + duree <= enMin(p.fin); m += pas) {
      if (chevauche(m, m + duree, absences)) continue;
      if (enLigne && chevauche(m, m + duree, fermetures)) continue;
      if (quartsDe(enHeure(m), duree + (enLigne ? a.pause : 0)).some((q) => pris.has(q))) continue;
      if (enLigne) {
        const debutUtc = localVersUtc(date, enHeure(m));
        if (debutUtc < maintenantMs + a.delaiHeures * 3600000) continue;
        if (debutUtc > maintenantMs + a.joursMax * 86400000) continue;
      }
      sortie.push(enHeure(m));
    }
  }
  return sortie;
}

// Un rendez-vous peut-il etre place ici ? (rdv manuel du pro : il peut sortir de ses horaires, jamais doubler)
export function conflitRdv(r, rdvs, agenda) {
  if (!DATE.test(r.date || "") || !HEURE.test(r.heure || "") || !(r.duree > 0)) return "Date, heure et durée obligatoires.";
  const autres = (rdvs || []).filter((x) => x.id !== r.id);
  const pris = quartsOccupes(autres, r.date, agenda ? agenda.pause : 0);
  if (quartsDe(r.heure, r.duree).some((q) => pris.has(q))) return "Ce créneau est déjà pris par un autre rendez-vous.";
  if (agenda && chevauche(enMin(r.heure), enMin(r.heure) + r.duree, absencesDuJour(agenda, r.date))) return "Tu es en congé ou absent(e) à ce moment-là.";
  return "";
}

export function rdvVide(date = "", heure = "") {
  return { id: "", proId: "", date, heure, duree: 60, prestation: "", client: { nom: "", telephone: "" }, note: "", statut: "confirme", source: "manuel" };
}
export function normaliserRdv(r) {
  const c = (r && r.client) || {};
  return {
    id: txt(r && r.id, 40),
    proId: txt(r && r.proId, 30),
    date: DATE.test((r && r.date) || "") ? r.date : "",
    heure: HEURE.test((r && r.heure) || "") ? r.heure : "",
    duree: Math.max(5, Math.min(600, Math.round(Number(r && r.duree) || 0))),
    prestation: txt(r && r.prestation, 80),
    client: { nom: txt(c.nom, 80), telephone: txt(c.telephone, 20) },
    note: txt(r && r.note, 500),
    statut: STATUTS_RDV.some((s) => s.v === (r && r.statut)) ? r.statut : "demande",
    source: r && r.source === "client" ? "client" : "manuel",
  };
}
export function erreursDemandeClient(f) {
  const e = {};
  if (!f.prestation) e.prestation = "Choisissez une prestation.";
  if (!f.date || !f.heure) e.heure = "Choisissez un jour et une heure.";
  if (String(f.nom || "").trim().length < 2) e.nom = "Votre nom.";
  if (String(f.telephone || "").replace(/\D/g, "").length < 9) e.telephone = "Votre téléphone (pour la confirmation).";
  return e;
}

/* ---------- Messages WhatsApp (le pro les envoie a sa cliente) ---------- */
const jourLong = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const h = (heure) => heure.replace(":", "h");
export function messageRdv(sorte, r, nomPro, extra = "") {
  const qui = r.client.nom ? `Bonjour ${r.client.nom}` : "Bonjour";
  const quand = `${jourLong(r.date)} à ${h(r.heure)}`;
  const quoi = r.prestation ? ` (${r.prestation})` : "";
  const lignes = {
    confirmation: `${qui}, votre rendez-vous${quoi} est confirmé pour le ${quand}.${extra ? `\n${extra}` : ""}\n— ${nomPro}`,
    modification: `${qui}, votre rendez-vous${quoi} est déplacé au ${quand}. Merci de me confirmer que cela vous convient.\n— ${nomPro}`,
    annulation: `${qui}, je suis désolé(e) : votre rendez-vous${quoi} du ${quand} est annulé. Je vous propose un autre créneau quand vous le souhaitez.\n— ${nomPro}`,
    refus: `${qui}, merci pour votre demande${quoi} pour le ${quand}. Ce créneau n'est malheureusement pas disponible. Je vous propose un autre moment ?\n— ${nomPro}`,
    rappel: `${qui}, petit rappel : votre rendez-vous${quoi} est prévu le ${quand}. À bientôt !\n— ${nomPro}`,
  };
  return lignes[sorte] || "";
}
export const lienWhatsAppClient = (telephone, message) => {
  const n = String(telephone || "").replace(/\D/g, "").replace(/^0/, "972");
  return n.length >= 11 ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : "";
};
// Rappels a envoyer : rendez-vous confirmes de demain
export const rappelsDeDemain = (rdvs, aujourdhui) => (rdvs || []).filter((r) => r.statut === "confirme" && r.date === ajouterJoursDate(aujourdhui, 1) && !r.rappelEnvoye).sort((a, b) => a.heure.localeCompare(b.heure));
// Rendez-vous d'un jour, dans l'ordre
export const rdvDuJour = (rdvs, date) => (rdvs || []).filter((r) => r.date === date && r.statut !== "refuse").sort((a, b) => a.heure.localeCompare(b.heure));
// Statistiques d'un pro sur une periode
export function statsRdv(rdvs, du, au) {
  const l = (rdvs || []).filter((r) => r.date >= du && r.date <= au);
  const n = (s) => l.filter((r) => r.statut === s).length;
  return { total: l.length, demandes: n("demande"), confirmes: n("confirme"), termines: n("termine"), annules: n("annule") + n("refuse"), absents: n("absent"), enLigne: l.filter((r) => r.source === "client").length };
}
