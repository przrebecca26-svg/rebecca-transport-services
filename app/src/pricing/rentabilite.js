// RENTABILITE AVANCEE (19 nov. 2026, V2) - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// Reprend les calculs existants (bilanTrajet : temps de chaque etape, essence d'apres le compteur et les pleins,
// gain reel) sans les refaire, et ajoute : par type de prestation, par distance, temps et km a vide, evolution
// des 6 derniers mois, trajets sous le minimum en ₪/h, et prevision du mois (reservations confirmees).
// Les prevision sont TOUJOURS separees de l'encaisse. Rien n'est ecrit dans la base.
import { bilanTrajet, estAllerRetour, prixTrajet, resteDe } from "./finCourse.js";

const cents = (x) => Math.round(x * 100) / 100;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export const TRANCHES = [
  { id: "t1", l: "Moins de 5 km", max: 5 },
  { id: "t2", l: "5 à 15 km", max: 15 },
  { id: "t3", l: "15 à 40 km", max: 40 },
  { id: "t4", l: "Plus de 40 km", max: Infinity },
];
export const trancheDe = (km) => (Number(km) > 0 ? TRANCHES.find((t) => Number(km) < t.max) || TRANCHES[3] : null);

// Chaque trajet termine (aller et retour separes) avec son bilan ; dans la periode [debut, fin]
export function trajetsTermines(demandes = [], debut = "", fin = "", parKm = null) {
  const res = [];
  for (const d of demandes) {
    if (d.statut !== "terminee") continue;
    const liste = estAllerRetour(d) ? [d, { ...d, estRetour: true, date: (d.details || {}).dateRetour || d.date }] : [d];
    for (const t of liste) {
      if (!DATE_OK.test(t.date || "")) continue;
      if ((debut && t.date < debut) || (fin && t.date > fin)) continue;
      const b = bilanTrajet(t, parKm);
      const kmCourse = Number(t.kmEstime) > 0 ? Number(t.kmEstime) : 0;
      // A vide : aller chercher + rentrer. Km : total compte (compteur ou estimation x 2) - la course elle-meme
      const kmVide = b.km > kmCourse && kmCourse > 0 ? cents(b.km - kmCourse) : 0;
      const minutesVide = (b.approche || 0) + (b.retourMaison || 0);
      res.push({ id: t.id + (t.estRetour ? ":retour" : ""), demande: d, date: t.date, service: t.service, nom: t.nom || "", ...b, prix: prixTrajet(t), kmCourse, kmVide, minutesVide });
    }
  }
  return res;
}

const vide = () => ({ trajets: 0, avecTemps: 0, minutes: 0, prix: 0, prixAvecTemps: 0, gain: 0, gainAvecTemps: 0, km: 0, essence: 0 });
function ajouter(r, t) {
  r.trajets++;
  r.prix = cents(r.prix + t.prix);
  r.gain = cents(r.gain + (t.gainReel != null ? t.gainReel : t.prix));
  r.km = cents(r.km + (t.km || 0));
  r.essence = cents(r.essence + (t.essence || 0));
  if (t.total > 0) {
    r.avecTemps++;
    r.minutes += t.total;
    r.prixAvecTemps = cents(r.prixAvecTemps + t.prix);
    r.gainAvecTemps = cents(r.gainAvecTemps + (t.gainReel != null ? t.gainReel : t.prix));
  }
}
const finir = (r) => ({ ...r, parHeure: r.minutes ? Math.round((r.prixAvecTemps * 60) / r.minutes) : null, gainParHeure: r.minutes ? Math.round((r.gainAvecTemps * 60) / r.minutes) : null, prixMoyen: r.trajets ? Math.round(r.prix / r.trajets) : 0 });

// Regroupe les trajets par une cle (type de prestation, groupe d'activite, tranche de distance)
export function regrouper(trajets, cle) {
  const m = {};
  for (const t of trajets) {
    const k = cle(t);
    if (!k) continue;
    ajouter((m[k] = m[k] || vide()), t);
  }
  return Object.fromEntries(Object.entries(m).map(([k, r]) => [k, finir(r)]));
}

// 26 nov. 2026 (cahier, reste à faire 6) : les courses 💛 Prix ami (faveurs, ex. Kelly 40 ₪) sont mises à part
// des chiffres de rentabilité (₪/h par activité, distance, sous le minimum) : ce ne sont pas des courses mal tarifées.
// L'argent reste compté partout ailleurs (Finances, 6 derniers mois, prévision).
export function separerPrixAmi(trajets = []) {
  const amis = trajets.filter((t) => t.demande && t.demande.prixAmi === true);
  const normaux = trajets.filter((t) => !(t.demande && t.demande.prixAmi === true));
  const r = vide();
  for (const t of amis) ajouter(r, t);
  return { normaux, amis, resume: finir(r) };
}

// Temps et km a vide sur la periode
export function aVide(trajets) {
  const avec = trajets.filter((t) => t.total > 0);
  const minutes = avec.reduce((s, t) => s + t.minutesVide, 0);
  const total = avec.reduce((s, t) => s + t.total, 0);
  const km = cents(trajets.reduce((s, t) => s + t.kmVide, 0));
  const kmTotal = cents(trajets.reduce((s, t) => s + (t.km || 0), 0));
  return { minutes, partTemps: total ? Math.round((minutes * 100) / total) : null, km, partKm: kmTotal ? Math.round((km * 100) / kmTotal) : null };
}

// Trajets dont le gain reel par heure est sous le minimum (du moins rentable au plus rentable)
export function sousLeMinimum(trajets, minParHeure, max = 10) {
  const min = Number(minParHeure);
  if (!(min > 0)) return [];
  return trajets.filter((t) => t.gainReelParHeure != null && t.gainReelParHeure < min).sort((a, b) => a.gainReelParHeure - b.gainReelParHeure).slice(0, max);
}

// Mois AAAA-MM decale de n
export function moisDecale(mois, n) {
  const [a, m] = mois.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const finDuMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  return `${mois}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

// Evolution : les n derniers mois (le plus ancien d'abord), prix, gain reel et ₪/h
export function evolutionMois(demandes, moisFin, n = 6, parKm = null) {
  const res = [];
  for (let i = n - 1; i >= 0; i--) {
    const mois = moisDecale(moisFin, -i);
    const r = finir(regrouper(trajetsTermines(demandes, `${mois}-01`, finDuMois(mois), parKm), () => "tout").tout || vide());
    res.push({ mois, ...r, marge: r.prix ? Math.round((r.gain * 100) / r.prix) : null });
  }
  return res;
}

// Prevision du mois : deja encaisse ce mois-ci (paiements) + reste a encaisser des courses confirmees ou deja
// faites du mois. Les deux sont separes : la prevision n'est jamais comptee comme gagnee.
export function previsionMois(mois, demandes = [], mouvements = []) {
  const encaisse = cents(mouvements.filter((m) => m.kind === "paiement" && String(m.date || "").startsWith(mois)).reduce((s, m) => s + (Number(m.montant) || 0), 0));
  const concernees = demandes.filter((d) => String(d.date || "").startsWith(mois) && (d.statut === "acceptee" || d.statut === "terminee"));
  const confirmees = concernees.filter((d) => d.statut === "acceptee");
  const resteConfirmees = cents(confirmees.reduce((s, d) => s + resteDe(d, mouvements), 0));
  const resteFaites = cents(concernees.filter((d) => d.statut === "terminee").reduce((s, d) => s + resteDe(d, mouvements), 0));
  return { encaisse, resteConfirmees, resteFaites, nbConfirmees: confirmees.length, finDeMoisPrevue: cents(encaisse + resteConfirmees + resteFaites) };
}
