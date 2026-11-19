// TESTS RENTABILITE AVANCEE (19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { trajetsTermines, regrouper, aVide, sousLeMinimum, evolutionMois, previsionMois, trancheDe, moisDecale } from "../src/pricing/rentabilite.js";

section("Rentabilité avancée");
const course = (id, extra = {}) => ({ id, service: "livraison", statut: "terminee", date: "2026-11-10", prixFinal: 60, kmEstime: 5, chrono: { simple: { depart: "10:00", prise: "10:15", depose: "10:35", maison: "10:50", kmDepart: 1000, kmPrise: 1003, kmDepose: 1008, kmMaison: 1011 } }, ...extra });
test("trajet : km à vide et temps à vide d'après les étapes", () => {
  const [t] = trajetsTermines([course("a")], "2026-11-01", "2026-11-30", 0.6);
  egal([t.total, t.minutesVide, t.km, t.kmVide, t.prix], [50, 30, 11, 6, 60]);
});
test("aller-retour : deux trajets, période respectée, non terminée exclue", () => {
  const ar = course("b", { service: "transport", prixFinal: 200, details: { typeTrajet: "ar", dateRetour: "2026-12-02" } });
  const l = trajetsTermines([ar, course("c", { statut: "acceptee" })], "2026-11-01", "2026-11-30");
  egal(l.length, 1);
  egal(trajetsTermines([ar], "", "").length, 2);
});
test("regroupement par type, ₪/h et prix moyen", () => {
  const l = trajetsTermines([course("a"), course("b", { service: "transport", prixFinal: 120 })], "", "", 0.5);
  const r = regrouper(l, (t) => t.service);
  egal([r.livraison.trajets, r.livraison.parHeure, r.transport.prixMoyen], [1, 72, 120]);
});
test("tranches de distance", () => { egal(trancheDe(3).id, "t1"); egal(trancheDe(15).id, "t3"); egal(trancheDe(0), null); });
test("à vide sur la période", () => {
  const v = aVide(trajetsTermines([course("a"), course("b")], "", "", 0.5));
  egal([v.minutes, v.partTemps, v.km], [60, 60, 12]);
});
test("sous le minimum", () => {
  const l = trajetsTermines([course("a", { prixFinal: 30 }), course("b", { prixFinal: 300 })], "", "", 0.5);
  const s = sousLeMinimum(l, 60);
  egal(s.map((t) => t.id), ["a"]);
  egal(sousLeMinimum(l, 0), []);
});
test("évolution des 6 derniers mois", () => {
  const e = evolutionMois([course("a"), course("b", { date: "2026-09-05" })], "2026-11", 6, 0.5);
  egal(e.map((x) => x.mois), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  egal([e[3].trajets, e[5].trajets, e[0].trajets], [1, 1, 0]);
  vrai(e[5].marge > 0 && e[5].marge <= 100);
  egal(moisDecale("2026-01", -1), "2025-12");
});
test("prévision séparée de l'encaissé", () => {
  const dem = [course("a", { statut: "acceptee", date: "2026-11-25", prixFinal: 100 }), course("b", { prixFinal: 60 }), course("c", { statut: "acceptee", date: "2026-12-01" })];
  const mv = [{ kind: "paiement", resId: "b", date: "2026-11-10", montant: 40 }];
  egal(previsionMois("2026-11", dem, mv), { encaisse: 40, resteConfirmees: 100, resteFaites: 20, nbConfirmees: 1, finDeMoisPrevue: 160 });
});
