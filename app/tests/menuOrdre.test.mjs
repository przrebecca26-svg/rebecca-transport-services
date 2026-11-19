// TESTS ORDRE DU MENU (19 nov. 2026)
import { test, egal, section } from "./outils.mjs";
import { ordonner, deplacer } from "../src/pricing/menuOrdre.js";

section("Ordre du menu");
const R = ["tableau", "devis", "demandes", "commandes-resto", "finances"].map((id) => ({ id }));
test("ordre choisi d'abord, le reste à sa place", () => {
  egal(ordonner(R, ["tableau", "commandes-resto"]).map((r) => r.id), ["tableau", "commandes-resto", "devis", "demandes", "finances"]);
  egal(ordonner(R, ["inconnue", 3]).map((r) => r.id), R.map((r) => r.id));
});
test("monter les commandes juste sous le tableau de bord", () => {
  let o = deplacer(R, [], "commandes-resto", -1);
  o = deplacer(R, o, "commandes-resto", -1);
  egal(o, ["tableau", "commandes-resto", "devis", "demandes", "finances"]);
  egal(deplacer(R, o, "tableau", -1), o);
});
