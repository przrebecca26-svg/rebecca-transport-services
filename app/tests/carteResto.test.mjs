// MENU ET PANIER EN LIGNE DES RESTAURANTS (26 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { erreursPanier, lireCarte, messagePanier, totalPanier } from "../src/pricing/carteResto.js";
section("Restaurants : menu et panier en ligne");
const texte = "# Sushis\nCalifornia saumon ; 42 ; 8 pièces\nPoké thon ; 58,50\nEdamame ; 18 ; épuisé\nligne sans prix\n# Boissons\nCoca ; 10 ₪";
test("la carte se lit : catégories, prix (virgule, ₪), épuisé, lignes illisibles ignorées", () => {
  const c = lireCarte(texte);
  egal(c.map((x) => [x.nom, x.plats.length]), [["Sushis", 3], ["Boissons", 1]]);
  egal([c[0].plats[1].prix, c[0].plats[2].epuise, c[1].plats[0].prix], [58.5, true, 10]);
});
test("panier : total, plat épuisé jamais compté, message au restaurant complet", () => {
  const c = lireCarte(texte);
  const t = totalPanier(c, { p1: 2, p2: 1, p3: 5, p4: 3 });
  egal([t.articles, t.total], [6, 172.5]);
  const m = messagePanier({ nom: "Ohi Sushi" }, t, { nom: "Kelly", telephone: "0501234567", adresse: "Herzl 10, Netanya" });
  vrai(/2 × California saumon — 84 ₪/.test(m) && /Total des plats : 172,5 ₪ \(payé au restaurant\)/.test(m) && /Rebecca Services/.test(m));
  egal(Object.keys(erreursPanier(totalPanier(c, {}), {})).sort(), ["adresse", "nom", "panier", "telephone"]);
});
import { ecrireCarte, importerCarte } from "../src/pricing/carteResto.js";
test("carte modifiée plat par plat : réécrite au même format, relue à l'identique", () => {
  const c = lireCarte(texte);
  egal(lireCarte(ecrireCarte(c)).map((x) => x.plats.map((p) => [p.nom, p.prix, p.epuise])), c.map((x) => x.plats.map((p) => [p.nom, p.prix, p.epuise])));
});
test("import d'une liste collée : tableur (tabulations), « Nom - 42 ₪ », titres de catégorie", () => {
  const c = importerCarte("Sushis\nCalifornia\t42\t8 pièces\nMaki concombre - 24 ₪\nBoissons\nCoca : 10");
  egal(c.map((x) => [x.nom, x.plats.map((p) => [p.nom, p.prix])]), [["Sushis", [["California", 42], ["Maki concombre", 24]]], ["Boissons", [["Coca", 10]]]]);
});
