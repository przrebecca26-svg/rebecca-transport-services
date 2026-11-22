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
  egal(derniereEtapeTournee(t2), { ids: ["a", "b"], etape: "prise" });
});
test("trafic : une récupération au resto puis les livraisons dans l'ordre", () => {
  const e = etapesTournee([cmd("b", "10:15", PRES_MAISON), cmd("a", "10:05", SUR_LA_ROUTE)], MAISON);
  egal(e.map((x) => x.sorte), ["prise", "depose", "depose"]);
  egal(e[0].min, 10 * 60 + 15);
  egal(e[1].demandeId, "a");
  vrai(e[2].min > e[1].min);
});
