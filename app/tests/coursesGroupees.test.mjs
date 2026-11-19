// TESTS COURSES GROUPEES V1 (19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { meilleurOrdre, surMaRoute, coursesEnCours, arretsRestants, kmEntre } from "../src/pricing/coursesGroupees.js";

section("Courses groupées (mode Wolt)");
// Netanya : Ir Yamin (McDo), Pizza Centrale à côté, livraisons vers le nord (proche) et vers le sud (loin)
const IR_YAMIN = { label: "Ir Yamin", lat: 32.3045, lon: 34.8735 };
const PIZZA = { label: "Pizza Centrale", lat: 32.3050, lon: 34.8740 };
const PROCHE = { label: "Rue proche", lat: 32.3150, lon: 34.8700 };
const LOIN = { label: "Rue loin", lat: 32.2750, lon: 34.8600 };
const HERZLIYA = { label: "Herzliya", lat: 32.1650, lon: 34.8450 };
const liv = (id, de, vers, extra = {}) => ({ id, service: "livraison", statut: "acceptee", date: "2026-11-19", details: { recuperation: de, livraison: vers }, ...extra });

test("on récupère toujours avant de déposer", () => {
  const arrets = [{ id: "a:deposer", demande: "a", sorte: "deposer", lieu: PROCHE }, { id: "a:prendre", demande: "a", sorte: "prendre", lieu: IR_YAMIN }];
  egal(meilleurOrdre(arrets, IR_YAMIN).ordre.map((x) => x.id), ["a:prendre", "a:deposer"]);
});
test("deux commandes du même endroit : deux récupérations, puis la plus proche d'abord", () => {
  const a = liv("a", IR_YAMIN, LOIN, { chrono: { simple: { depart: "12:00" } } });
  const b = liv("b", PIZZA, PROCHE, { chrono: { simple: { depart: "12:00" } } });
  const o = meilleurOrdre(arretsRestants([a, b]), IR_YAMIN).ordre.map((x) => x.id);
  egal(o.slice(0, 2).sort(), ["a:prendre", "b:prendre"]);
  egal(o.slice(2), ["b:deposer", "a:deposer"]);
});
test("course déjà récupérée : il ne reste que la livraison", () => {
  const a = liv("a", IR_YAMIN, LOIN, { chrono: { simple: { depart: "12:00", prise: "12:10" } } });
  egal(arretsRestants([a]).map((x) => x.sorte), ["deposer"]);
});
test("en cours = acceptée du jour, partie ou récupérée, pas encore déposée", () => {
  const l = [liv("a", IR_YAMIN, LOIN, { chrono: { simple: { prise: "12:10" } } }), liv("b", IR_YAMIN, LOIN), liv("c", IR_YAMIN, LOIN, { chrono: { simple: { prise: "12:10", depose: "12:30" } } }), liv("d", IR_YAMIN, LOIN, { date: "2026-11-20", chrono: { simple: { prise: "1" } } })];
  egal(coursesEnCours(l, "2026-11-19").map((x) => x.id), ["a"]);
});
test("sur ma route : Pizza Centrale vers une rue proche oui, Herzliya non", () => {
  const enCours = [liv("a", IR_YAMIN, LOIN, { chrono: { simple: { depart: "12:00" } } })];
  const attente = [liv("p", PIZZA, PROCHE, { statut: "en attente", prixEstime: 45 }), liv("h", PIZZA, HERZLIYA, { statut: "en attente" }), liv("x", HERZLIYA, PROCHE, { statut: "en attente" })];
  const s = surMaRoute(attente, enCours, "2026-11-19", IR_YAMIN);
  egal(s.map((x) => x.demande.id), ["p"]);
  egal(s[0].prix, 45);
  vrai(s[0].detourKm <= 4);
});
test("distance réaliste (vol d'oiseau × 1,3)", () => { const k = kmEntre(IR_YAMIN, HERZLIYA); vrai(k > 18 && k < 22, String(k)); });
