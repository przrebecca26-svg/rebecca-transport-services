// TESTS TOURNEE RESTAURANT GROUPEE (22 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { tourneesResto, ordreLivraisons, etatTournee, derniereEtapeTournee, etapesTournee } from "../src/pricing/tourneeResto.js";

section("Tournée restaurant groupée");
const RESTO = { label: "Kikar HaAtsmaut 5, Netanya", lat: 32.3290, lon: 34.8560 };
const MAISON = { label: "David Reznik 9, Netanya", lat: 32.2960, lon: 34.8620 };
const PRES_MAISON = { label: "David Reznik St 11, Netanya", lat: 32.2965, lon: 34.8625 };
const SUR_LA_ROUTE = { label: "Uzi Hitman St 5, Netanya", lat: 32.3150, lon: 34.8600 };
const AILLEURS = { label: "Nord", lat: 32.3400, lon: 34.8650 };
const cmd = (id, heure, vers, extra = {}) => ({ id, service: "livraison", statut: "acceptee", date: "2026-11-22", heure, nom: "Test2", details: { recuperation: RESTO, livraison: vers, destinataire: id, commandeResto: { cle: "CLE1", id: "c" + id } }, ...extra });

test("deux commandes du même resto à 10 min : une seule tournée", () => {
  const r = tourneesResto([cmd("a", "10:05", SUR_LA_ROUTE), cmd("b", "10:15", PRES_MAISON)]);
  egal(r.tournees.length, 1);
  egal(r.tournees[0].map((d) => d.id), ["a", "b"]);
  egal(r.seules.length, 0);
});
test("plus de 10 min d'écart ou autre restaurant : séparées", () => {
  const r = tourneesResto([cmd("a", "10:05", SUR_LA_ROUTE), cmd("b", "10:30", PRES_MAISON), cmd("c", "10:31", AILLEURS, { details: { recuperation: RESTO, livraison: AILLEURS, commandeResto: { cle: "AUTRE", id: "x" } } })]);
  egal(r.tournees.length, 0);
  egal(r.seules.length, 3);
});
test("une course d'une cliente n'est jamais groupée avec le restaurant", () => {
  const r = tourneesResto([cmd("a", "10:05", SUR_LA_ROUTE), { id: "z", service: "livraison", statut: "acceptee", date: "2026-11-22", heure: "10:07", details: {} }]);
  egal(r.tournees.length, 0);
});
test("pas plus de 7 commandes par tournée", () => {
  const l = Array.from({ length: 9 }, (_, i) => cmd("x" + i, `10:0${i}`, SUR_LA_ROUTE));
  const r = tourneesResto(l);
  egal(r.tournees.map((t) => t.length), [7, 2]);
});
test("ordre : celle sur la route d'abord, on finit près de la maison", () => {
  const t = [cmd("b", "10:15", PRES_MAISON), cmd("a", "10:05", SUR_LA_ROUTE)];
  egal(ordreLivraisons(t, MAISON).map((d) => d.id), ["a", "b"]);
});
test("sans maison connue : le moins de km depuis le restaurant", () => {
  const t = [cmd("b", "10:15", PRES_MAISON), cmd("a", "10:05", SUR_LA_ROUTE)];
  egal(ordreLivraisons(t, null).map((d) => d.id), ["a", "b"]);
});
test("arrivée et récupération comptent pour toutes les commandes", () => {
  const t = [cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { depart: "09:45", arrivee: "09:55" } } }), cmd("b", "10:15", PRES_MAISON, { chrono: { simple: { depart: "09:45", arrivee: "09:55" } } })];
  const e = etatTournee(t);
  vrai(e.partie && e.arrivee && !e.prise);
  const t2 = t.map((d) => ({ ...d, chrono: { simple: { ...d.chrono.simple, prise: "10:15" } } }));
  vrai(etatTournee(t2).prise);
});
test("annuler : d'abord la dernière livraison déposée, puis l'étape commune", () => {
  const t = [cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { prise: "10:15", depose: "10:25" } } }), cmd("b", "10:15", PRES_MAISON, { chrono: { simple: { prise: "10:15" } } })];
  egal(derniereEtapeTournee(t), { ids: ["a"], etape: "depose" });
  const t2 = [cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { prise: "10:15" } } }), cmd("b", "10:15", PRES_MAISON, { chrono: { simple: { prise: "10:15" } } })];
  egal(derniereEtapeTournee(t2).etape, "prise");
  egal(derniereEtapeTournee(t2).ids.length, 1); // 22 nov. : une récupération à la fois
  const t3 = t2.map((d) => ({ ...d, chrono: { simple: { ...d.chrono.simple, departResto: "10:20" } } }));
  egal(derniereEtapeTournee(t3), { ids: ["a", "b"], etape: "departResto" });
});
test("trafic : une récupération au resto puis les livraisons dans l'ordre", () => {
  const e = etapesTournee([cmd("b", "10:15", PRES_MAISON), cmd("a", "10:05", SUR_LA_ROUTE)], MAISON);
  egal(e.map((x) => x.sorte), ["prise", "depose", "depose"]);
  egal(e[0].min, 10 * 60 + 15);
  egal(e[1].demandeId, "a");
  vrai(e[2].min > e[1].min);
});

test("une commande prioritaire passe en premier, même si elle est près de la maison", () => {
  const t = [cmd("a", "10:05", SUR_LA_ROUTE), cmd("b", "10:15", PRES_MAISON, { details: { recuperation: RESTO, livraison: PRES_MAISON, prioritaire: true, commandeResto: { cle: "CLE1", id: "cb" } } })];
  egal(ordreLivraisons(t, MAISON).map((d) => d.id), ["b", "a"]);
});
test("récupérées une par une, puis « Partir du restaurant »", () => {
  const t = [cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { arrivee: "10:00", prise: "10:06" } } }), cmd("b", "10:15", PRES_MAISON, { chrono: { simple: { arrivee: "10:00" } } })];
  let e = etatTournee(t);
  egal([e.recuperees, e.prise, e.departResto], [["a"], false, false]);
  const t2 = t.map((d) => ({ ...d, chrono: { simple: { ...d.chrono.simple, prise: d.chrono.simple.prise || "10:15", departResto: "10:16" } } }));
  e = etatTournee(t2);
  vrai(e.prise && e.departResto);
  const t3 = [{ ...t2[0], chrono: { simple: { ...t2[0].chrono.simple, arriveeClient: "10:25" } } }, t2[1]];
  egal(etatTournee(t3).arriveesClient, ["a"]);
});
test("arrivée au resto : une commande prête plus tard entre quand même dans la tournée (pas encore partie)", () => {
  const a = cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { arrivee: "10:00" } } });
  const z = cmd("z", "10:40", PRES_MAISON);
  egal(tourneesResto([a, z]).tournees.length, 1);
  const a2 = cmd("a", "10:05", SUR_LA_ROUTE, { chrono: { simple: { prise: "10:06", departResto: "10:07" } } });
  egal(tourneesResto([a2, z]).tournees.length, 0);
});
