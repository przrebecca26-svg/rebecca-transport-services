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

// 22 nov. 2026 : menu par sections
import { parSections, deplacerDans } from "../src/pricing/menuOrdre.js";
section("Menu par sections");
const SEC = [{ id: "jour" }, { id: "rs" }, { id: "restos" }];
const RB = [{ id: "d", section: "rs" }, { id: "c", section: "restos" }, { id: "a", section: "jour" }, { id: "t", section: "rs" }];
test("les rubriques se rangent par section, l'ordre choisi gardé dedans", () => egal(parSections(RB, SEC).map((r) => r.id), ["a", "d", "t", "c"]));
test("monter / descendre reste dans sa section", () => {
  const l = parSections(RB, SEC);
  egal(deplacerDans(l, "t", -1), ["a", "t", "d", "c"]);
  egal(deplacerDans(l, "d", -1), ["a", "d", "t", "c"]);
});
