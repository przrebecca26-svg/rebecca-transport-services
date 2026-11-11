// TESTS DU TABLEAU DE BORD (D2a) - Rebecca Services
// Indicateurs G3 : demandes recues, prestations terminees, chiffre d'affaires realise, encaisse.

import { test, egal, vrai, section } from "./outils.mjs";
import * as T from "../src/pricing/tableauBord.js";

const NOV = { debut: "2026-11-01", fin: "2026-11-30" };
const DEM = [
  { id: "a", service: "livraison", date: "2026-11-08", statut: "terminee", prixFinal: 60, pourboire: 5, kmEstime: 4, creeLe: "2026-11-07" },
  { id: "b", service: "courses", date: "2026-11-12", statut: "acceptee", prixFinal: 100, creeLe: "2026-11-09" },
  { id: "c", service: "transport", date: "2026-11-10", statut: "terminee", prixFinal: 235, kmEstime: 33, creeLe: { toDate: () => new Date(Date.UTC(2026, 9, 31, 23, 30)) } },
  { id: "d", service: "livraison", date: "2026-11-09", statut: "annulee", prixEstime: 155, creeLe: "2026-11-05" },
  { id: "e", service: "demenagement", date: "2026-10-20", statut: "terminee", prixFinal: 130, creeLe: "2026-10-18" },
];
const MOUV = [
  { kind: "paiement", resId: "a", date: "2026-11-08", montant: 65 },
  { kind: "paiement", resId: "c", date: "2026-11-10", montant: 200 },
  { kind: "correction", resId: "c", date: "2026-11-11", montant: -10 },
  { kind: "paiement", resId: "d", date: "2026-11-06", montant: 31 },
  { kind: "annulation", resId: "d", date: "2026-11-08", fraisRetenus: 31 },
  { kind: "remboursement_effectue", resId: "c", date: "2026-11-12", montant: 5 },
];

section("Tableau de bord");
test("8 activites, toutes actives (10 nov.)", () => egal([T.ACTIVITES_TB.length, T.ACTIVITES_TB.filter((a) => a.etat === "active").length], [8, 8]));
test("date de creation texte", () => egal(T.dateCreation({ creeLe: "2026-11-07" }), "2026-11-07"));
test("date de creation Timestamp : heure d'Israel (31 oct. 23h30 UTC = 1er nov.)", () => egal(T.dateCreation(DEM[2]), "2026-11-01"));
test("sans date de creation", () => egal(T.dateCreation({}), null));
const coursierNov = T.indicateurs({ activite: "coursier", demandes: DEM, mouvements: MOUV, periode: NOV });
test("coursier : demandes recues en novembre = 3", () => egal(coursierNov.demandesRecues, 3));
test("coursier : prestations terminees = 1", () => egal(coursierNov.prestationsTerminees, 1));
test("coursier : CA realise = 60 + 31 de frais gardes", () => egal(coursierNov.caRealise, 91));
test("coursier : encaisse = 65 + 31", () => egal(coursierNov.encaisse, 96));
test("coursier : pourboire a part", () => egal(coursierNov.pourboires, 5));
test("coursier : km estimes", () => egal(coursierNov.kmEstimes, 4));
const transportNov = T.indicateurs({ activite: "transport", demandes: DEM, mouvements: MOUV, periode: NOV });
test("transport : CA realise = 235", () => egal(transportNov.caRealise, 235));
test("transport : encaisse = 200 - 10 - 5 (correction et remboursement)", () => egal(transportNov.encaisse, 185));
test("transport : demande creee le 1er nov. comptee", () => egal(transportNov.demandesRecues, 1));
test("course acceptee non terminee : pas de CA", () => vrai(T.indicateurs({ demandes: [DEM[1]], periode: NOV }).caRealise === 0));
test("octobre exclu de novembre", () => egal(T.indicateurs({ activite: "coursier", demandes: DEM, mouvements: MOUV, periode: { debut: "2026-10-01", fin: "2026-10-31" } }).caRealise, 130));
test("toutes activites = coursier + transport", () => egal(T.indicateurs({ demandes: DEM, mouvements: MOUV, periode: NOV }).caRealise, 91 + 235));
test("sans periode = depuis le debut", () => egal(T.indicateurs({ activite: "coursier", demandes: DEM, mouvements: MOUV }).caRealise, 221));
test("prix moyen", () => egal(T.indicateurs({ activite: "coursier", demandes: DEM }).prixMoyen, 95));
test("repartition coursier depuis le debut", () => egal(T.repartitionServices({ activite: "coursier", demandes: DEM }).map((x) => [x.service, x.nombre]), [["livraison", 1], ["demenagement", 1]]));
test("serie jour par jour", () => {
  const s = T.serieCA({ activite: "coursier", demandes: DEM, mouvements: MOUV, periode: { debut: "2026-11-07", fin: "2026-11-09" } });
  egal(s, [{ date: "2026-11-07", ca: 0 }, { date: "2026-11-08", ca: 91 }, { date: "2026-11-09", ca: 0 }]);
});
test("serie sans periode = vide", () => egal(T.serieCA({ demandes: DEM }), []));
test("tuiles : aucune donnee pour les activites Bientot", () => vrai(T.tuiles({ demandes: DEM, mouvements: MOUV, periode: NOV }).filter((t) => t.etat === "bientot").every((t) => t.chiffres === null)));
test("tuiles : chiffres reels pour coursier", () => egal(T.tuiles({ demandes: DEM, mouvements: MOUV, periode: NOV })[0].chiffres.caRealise, 91));
test("logos officiels des 6 activites a venir", () => egal(T.ACTIVITES_TB.filter((a) => a.logo).map((a) => a.logo.replace("/brand/", "")), ["logo-nails-prestige.png", "logo-regenx.png", "logo-epoxy.png", "logo-digital-applications.png", "logo-prestige-slim-lift.png", "logo-prestige-hair.png"]));
