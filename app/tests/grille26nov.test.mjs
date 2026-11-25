// GRILLE DU 26 NOV. 2026 (validée par Rebecca à 00h35 puis 00h50, après l'audit ChatGPT)
import { test, egal, vrai, section } from "./outils.mjs";
import { GRILLE_26NOV as T } from "./ancienneGrille.mjs";
import { calculer, prixTransportKm } from "../src/pricing/engine.js";
section("Grille du 26 nov. 2026");
const d = (km, min, z, x = {}) => ({ service: "transport", date: "2026-12-01", heure: "11:00", aller: { km, minutes: min }, zoneDepart: "netanya", zoneArrivee: z, passagers: 1, ...x });
test("transport local : 2 km 30 ₪, 5 km 45 ₪, 10 km 65 ₪", () => egal([2, 5, 10].map((k) => calculer(d(k, 10, "netanya"), T).total), [30, 45, 65]));
test("pas de saut de prix : 10,1 km = 70 ₪, 15 km = 85 ₪", () => egal([prixTransportKm(10.1, T), prixTransportKm(15, T)], [70, 85]));
test("aéroport : 250 ₪ aller simple, 2 x 220 = 440 ₪ aller-retour", () => egal([calculer(d(48.3, 50, "ben_gurion"), T).total, calculer(d(48.3, 50, "ben_gurion", { allerRetour: true }), T).total], [250, 440]));
test("transport par véhicule : 4 personnes = même prix", () => egal(calculer(d(48.3, 50, "ben_gurion", { passagers: 4, enfants: 2 }), T).total, 250));
test("villes : Hadera 110, Tel-Aviv 150, Jérusalem 350", () => egal([calculer(d(25, 25, "hadera"), T).total, calculer(d(32, 35, "tel_aviv"), T).total, calculer(d(90, 75, "jerusalem", { heure: "10:00" }), T).total], [110, 150, 350]));
test("jamais plus cher qu'un taxi au compteur (jour, réservation)", () => {
  const taxi = (km, min) => 12.46 + 5.78 + Math.min(km, 10) * 1.95 + Math.max(0, km - 10) * 3.79 + min * 1.95;
  [[2, 7], [5, 12], [10, 20], [20, 30], [30, 35], [40, 40], [50, 45]].forEach(([k, m]) => vrai(prixTransportKm(k, T) <= taxi(k, m), `${k} km`));
});
test("courses : retrait 25/30/40, faites par Rebecca 40/55/70/85, aucun % sur les achats avancés", () => {
  const c = (a, rb, x = {}) => calculer({ service: "courses", date: "2026-12-01", heure: "11:00", articles: a, courseFaiteParRebecca: rb, ...x }, T).total;
  egal([c(5, false), c(10, false), c(20, false), c(5, true), c(10, true), c(20, true), c(30, true)], [25, 30, 40, 40, 55, 70, 85]);
  egal(c(5, true, { rebeccaAvanceArgent: true, montantTicket: 800 }), 40);
});
test("livraison (paliers ChatGPT, progressifs) : 2 km 25 ₪, 3 km 30 ₪, 20 km 95 ₪", () => egal([2, 3, 20].map((k) => calculer({ ...d(k, 10, null), service: "livraison" }, T).total), [25, 30, 95]));
import { reductionRamassage, apresReduction } from "../src/pricing/engine.js";
test("ramassage au mois (22 jours) : 1 enfant matin 550 ₪, matin et retour 990 ₪, 2 enfants matin et retour 1 210 ₪", () => {
  egal([apresReduction(35 * 22, reductionRamassage(true, 1, 1, T), T), apresReduction(35 * 44, reductionRamassage(true, 1, 2, T), T), apresReduction(35 * 44, reductionRamassage(true, 2, 2, T), T)], [550, 990, 1210]);
});
test("ramassage sur le site : 1 trajet 35 ₪, aller-retour occasionnel 60 ₪, semaine de 5 jours aller-retour 225 ₪", () => {
  const r = (x) => calculer({ service: "ramassage", date: "2026-12-01", heure: "16:00", heure2: "17:00", aller: { km: 2, minutes: 6 }, zoneDepart: "netanya", zoneArrivee: "netanya", nbEnfants: 1, ...x }, T).total;
  egal([r({ trajets: 1 }), r({ trajets: 2 }), r({ trajets: 2, frequence: "semaine", joursSemaine: [0, 1, 2, 3, 4] })], [35, 60, 225]);
});
test("attente : 10 min offertes puis 1 ₪ par minute réelle (17 min = 7 ₪)", () => egal(calculer(d(48.3, 50, "ben_gurion", { attenteMinutes: 17 }), T).total, 257));
