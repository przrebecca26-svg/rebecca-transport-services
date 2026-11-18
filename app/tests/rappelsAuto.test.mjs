// TESTS ALERTE « NOUVELLE DEMANDE » (18 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { demandesASignaler, texteAlerte, SUJET_ALERTE } from "../src/pricing/rappelsAuto.js";

section("Alerte nouvelle demande");
const maintenant = Date.parse("2026-11-18T12:00:00Z");
test("seulement les nouvelles du site, pas encore signalées, moins de 24 h", () => {
  const l = [
    { id: "a", statut: "en attente", creeLe: "2026-11-18T11:58:00Z" },
    { id: "b", statut: "en attente", creeLe: "2026-11-18T11:00:00Z", alerteRebeccaLe: "x" },
    { id: "c", statut: "acceptee", creeLe: "2026-11-18T11:58:00Z" },
    { id: "d", statut: "en attente", creeLe: "2026-11-16T11:58:00Z" },
    { id: "e", statut: "en attente", source: "manuel", creeLe: "2026-11-18T11:58:00Z" },
  ];
  egal(demandesASignaler(l, maintenant).map((x) => x.id), ["a"]);
});
test("texte et sujet", () => {
  vrai(texteAlerte([{ serviceTitre: "Livraison", nom: "Dana", date: "2026-11-20", heure: "10:00", prixEstime: 60 }], "https://x.app").includes("https://x.app/#/admin"));
  vrai(SUJET_ALERTE(2).includes("2 nouvelles"));
});
