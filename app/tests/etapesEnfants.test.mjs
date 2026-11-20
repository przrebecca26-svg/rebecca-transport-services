// TESTS ÉTAPES D'UN ARRÊT (arrivée, récupérés, départ, déposés) - 20 nov. 2026
import { test, egal, vrai, section } from "./outils.mjs";
import { boutonsEtape, boutonSuivant, messageEtape } from "../src/pricing/etapesEnfants.js";

section("Étapes d'un arrêt de la tournée");
test("prise : 3 boutons, validée au départ", () => {
  const b = boutonsEtape("prise");
  egal(b.map((x) => x.id).join(), "arrivee,avecMoi,depart");
  vrai(b[2].valide && !b[0].valide);
});
test("dépose : 2 boutons", () => egal(boutonsEtape("depose").length, 2));
test("bouton suivant", () => {
  egal(boutonSuivant("prise", {}).id, "arrivee");
  egal(boutonSuivant("prise", { arrivee: "12h48" }).id, "avecMoi");
  egal(boutonSuivant("prise", { arrivee: 1, avecMoi: 1, depart: 1 }), null);
});
test("messages", () => {
  const m = messageEtape("depart", ["Joy", "Liel"], "Gan", "12h53", "13h00");
  vrai(/Joy et Liel/.test(m) && /13h00/.test(m));
  vrai(/sont bien arrivés/.test(messageEtape("depose", ["Joy", "Liel"])));
  vrai(/est avec moi/.test(messageEtape("avecMoi", ["Joy"])));
});
