// TESTS : REGROUPER DEUX DEMANDES DE TRANSPORT / AEROPORT (15 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A } from "./donnees.mjs";
import * as G from "../src/pricing/regroupement.js";

const dem = (id, heure, plus = {}) => ({ id, nom: id, service: "aeroport", statut: "en attente", date: "2026-11-20", heure, prixEstime: 300, details: { direction: "vers", adresse: A.netanya, nbFamilles: "1", personnesF1: "2" }, ...plus });

section("Regrouper deux demandes");

test("meme jour, 10 min d'ecart, meme quartier, meme aeroport : regroupables", () => {
  const a = dem("A", "05:00");
  const l = G.regroupementsPossibles(a, [a, dem("B", "05:08"), dem("C", "05:30"), dem("D", "05:05", { date: "2026-11-21" })]);
  egal(l.map((x) => [x.d.id, x.ecart]), [["B", 8]]);
});

test("prix conseille : le trajet + 25 % par passager au-dela de 2, parts au prorata", () => {
  const p = G.prixRegroupe(dem("A", "05:00"), dem("B", "05:08"));
  egal([p.passagers, p.total, p.parts.map((x) => x.montant), p.separes], [4, 450, [225, 225], 600]);
});

test("departs eloignes : pas de regroupement", () => {
  const a = dem("A", "05:00");
  const loin = dem("B", "05:05", { details: { direction: "vers", adresse: A.tel_aviv, nbFamilles: "1", personnesF1: "1" } });
  egal(G.regroupementsPossibles(a, [a, loin]), []);
});
