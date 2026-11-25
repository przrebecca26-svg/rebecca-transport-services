import { calculer } from "../src/pricing/engine.js";
import { NOUVELLE_GRILLE as T, NOUVEAUX_RESTOS as R } from "./ancienneGrille.mjs";
import { egal, section, test } from "./outils.mjs";
const base = { date: "2026-12-01", heure: "12:00", zoneDepart: "netanya", zoneArrivee: "netanya" };
const prix = (service, km, minutes, extra = {}) => calculer({ ...base, service, aller: { km, minutes }, ...extra }, T).total;
section("Grille du 25 nov. 2026 (refonte des prix)");
test("livraison 2,2 km = 35 ₪ (avant 60)", () => egal(prix("livraison", 2.2, 5), 35));
test("livraison 5 km = 40 ₪", () => egal(prix("livraison", 5, 10), 40));
test("livraison 9 km = 60 ₪", () => egal(prix("livraison", 9, 15), 60));
test("livraison Hadera 30 km = 140 ₪", () => egal(prix("livraison", 30, 30, { zoneArrivee: "hadera" }), 140));
test("livraison 60 km = sur devis", () => egal(calculer({ ...base, service: "livraison", aller: { km: 60, minutes: 50 } }, T).total, null));
test("livraison urgente = +15 ₪", () => egal(prix("livraison", 2.2, 5, { urgent: true }), 50));
test("transport 2 km dans Netanya = 35 ₪ (avant 75)", () => egal(prix("transport", 2, 5), 35));
test("restaurants A 30/40, B 25/35, en plus 15", () => egal([R.A.jusqua3, R.A.de3a6, R.B.jusqua3, R.B.de3a6, R.A.enPlus], [30, 40, 25, 35, 15]));

import { analyserRentabilite as _ar } from "../src/pricing/engine.js";
section("Rentabilité : temps jamais NaN (bug 25 nov., livraison 5,6 km)");
{
  const r = _ar({ service: "livraison", date: "2026-11-26", heure: "11:00", aller: { km: 5.6, minutes: 10 }, approche: { km: 2, minutes: 5 } }, 50);
  test("minutesTotal est un nombre", () => egal(Number.isFinite(r.minutesTotal) && r.minutesTotal >= 35, true));
}

import { prixCommandeResto, rangDansCreneau } from "../src/pricing/restos.js";
import { articlesContrat } from "../src/pricing/contratResto.js";
section("Palier volume formule B (validé 25 nov.)");
{
  const resto = { cle: "R1", formule: "B", creneaux: "jeudi 19h-22h", tarifs: { jusqua3: 25, de3a6: 35, enPlus: 15, tresLourd: 5 }, tarifsA: { jusqua3: 30, de3a6: 40, enPlus: 15, tresLourd: 5 } };
  const jeudi = "2026-11-26";
  const cmds = (n) => Array.from({ length: n }, (_, i) => ({ id: "c" + i, cle: "R1", jour: jeudi, statut: "acceptee", pretA: "19:30" }));
  test("9e livraison : prix normal 25 ₪", () => egal(prixCommandeResto(resto, jeudi, "20:00", 2, 0, cmds(8)), 25));
  test("10e livraison ≤ 3 km : 20 ₪", () => egal(prixCommandeResto(resto, jeudi, "20:00", 2, 0, cmds(9)), 20));
  test("10e livraison 3-6 km : 30 ₪", () => egal(prixCommandeResto(resto, jeudi, "20:00", 5, 0, cmds(9)), 30));
  test("10e livraison > 6 km : prix normal", () => egal(prixCommandeResto(resto, jeudi, "20:00", 8, 0, cmds(9)) > 30, true));
  test("hors créneau : prix A, pas de palier", () => egal(prixCommandeResto(resto, jeudi, "23:00", 2, 0, cmds(12)), 30));
  test("commandes refusées non comptées", () => egal(rangDansCreneau(resto, cmds(9).map((c) => ({ ...c, statut: "refusee" })), jeudi, "20:00"), 1));
  test("formule A : jamais de palier", () => egal(prixCommandeResto({ ...resto, formule: "A", tarifs: resto.tarifsA }, jeudi, "20:00", 2, 0, cmds(15)), 30));
  const art = (v) => JSON.stringify(articlesContrat({ formule: "B", version: v, tarifs: { jusqua3: 25, de3a6: 35, enPlus: 15, minimumCreneau: 5, parHeure: 75, tresLourd: 5 }, creneaux: "jeudi 19h-22h", moyen: "Bit", adresse: { label: "x" } }));
  test("contrat 25 nov. : clause palier", () => egal(/Palier volume/.test(art("2026-11-25-1")), true));
  test("ancien contrat 20 nov. : pas de clause (pas rétroactif)", () => egal(/Palier volume/.test(art("2026-11-20-3")), false));
}
