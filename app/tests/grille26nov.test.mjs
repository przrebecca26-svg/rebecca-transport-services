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
test("livraison : 30 ₪ jusqu'à 3 km, 20 km 100 ₪", () => egal([2.2, 20].map((k) => calculer({ ...d(k, 10, null), service: "livraison" }, T).total), [30, 100]));
