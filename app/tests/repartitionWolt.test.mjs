// TESTS « RÉPARTIR LES STATISTIQUES WOLT » (16 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import { partager, repartirStatsWolt } from "../src/pricing/repartitionWolt.js";

section("Wolt : répartir livraisons, pourboires et km sur les paiements saisis");
const somme = (t, k) => Math.round(t.reduce((s, x) => s + x[k], 0) * 100) / 100;
const L = [
  { id: "a", source: "Wolt", debut: "2026-06-21", fin: "2026-06-27", livraisons: 0, revenu: 1000, pourboire: 0 },
  { id: "b", source: "Wolt", debut: "2026-07-05", fin: "2026-07-11", livraisons: 0, revenu: 3000.5, pourboire: 0 },
  { id: "c", source: "Wolt", debut: "2026-11-08", fin: "2026-11-14", livraisons: 0, revenu: 7379.09, pourboire: 0 },
  { id: "d", source: "Wolt", debut: "2026-11-16", fin: "2026-11-22", livraisons: 12, revenu: 300, pourboire: 20 }, // apres la periode
  { id: "e", source: "Cours de sport", debut: "2026-07-01", fin: "2026-07-01", livraisons: 0, revenu: 200, pourboire: 0 }, // pas Wolt
  { id: "f", source: "Wolt", debut: "2026-08-01", fin: "2026-08-01", livraisons: 0, revenu: -50, pourboire: 0, detail: "correction" },
];
const PHOTO = { debut: "2026-06-15", fin: "2026-11-15", livraisons: "447", pourboires: "533,66", km: "3180.5" };

test("partage entier : rien ne se perd", () => {
  egal(partager(10, [1, 1, 1]), [4, 3, 3]);
  egal(partager(447, [1000, 3000.5, 7379.09].map((x) => x * 100)).reduce((s, x) => s + x, 0), 447);
  egal(partager(5, [0, 0]), [0, 0]);
});
test("photo du 15 juin au 15 nov. : totaux exacts, montant reçu inchangé", () => {
  const r = repartirStatsWolt(L, PHOTO);
  egal(r.erreur, "");
  egal(r.lignes.map((x) => x.id), ["a", "b", "c"]);
  egal([somme(r.lignes, "livraisons"), somme(r.lignes, "pourboire"), somme(r.lignes, "km")], [447, 533.66, 3180.5]);
  egal(r.totalRecu, 11379.59);
  for (const x of r.lignes) egal(Math.round((x.revenu + x.pourboire) * 100) / 100, x.total);
  egal(somme(r.lignes, "revenu"), 10845.93);
  vrai(r.lignes[2].livraisons > r.lignes[1].livraisons && r.lignes[1].livraisons > r.lignes[0].livraisons);
});
test("refaire le calcul donne le même résultat", () => {
  const r1 = repartirStatsWolt(L, PHOTO);
  const apres = L.map((l) => ({ ...l, ...(r1.lignes.find((x) => x.id === l.id) || {}) }));
  egal(repartirStatsWolt(apres, PHOTO).lignes, r1.lignes);
});
test("un seul chiffre : le reste n'est pas touché", () => {
  const r = repartirStatsWolt(L, { debut: "2026-06-15", fin: "2026-11-15", livraisons: "447" });
  egal([somme(r.lignes, "livraisons"), somme(r.lignes, "pourboire"), r.lignes[0].revenu, r.lignes[0].km], [447, 0, 1000, null]);
});
test("refus : aucune ligne, pourboires trop grands, rien de saisi", () => {
  vrai(!!repartirStatsWolt(L, { ...PHOTO, debut: "2025-01-01", fin: "2025-02-01" }).erreur);
  vrai(!!repartirStatsWolt(L, { ...PHOTO, pourboires: "20000" }).erreur);
  vrai(!!repartirStatsWolt(L, { debut: "2026-06-15", fin: "2026-11-15" }).erreur);
  vrai(!!repartirStatsWolt(L, { ...PHOTO, fin: "2026-01-01" }).erreur);
});
