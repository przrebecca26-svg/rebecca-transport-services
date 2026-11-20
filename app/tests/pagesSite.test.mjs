// TESTS PAGES DU SITE (20 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { empreinte, etatPage, lienDirectOuvert, reglagePage, resumePage, telPourEmpreinte } from "../src/pricing/pagesSite.js";

section("Pages du site");
test("sans réglage : comme aujourd'hui", () => {
  egal(etatPage(null, "coursier", {}), "ouverte");
  egal(etatPage(null, "nails", {}), "ouverte");
  egal(etatPage(null, "transport", {}), "cachee", "transport sur autorisation");
  egal(etatPage(null, "transport", { autorise: true }), "ouverte");
  egal(etatPage(null, "restoPartenaire", {}), "cachee");
  vrai(lienDirectOuvert(null, "restoPartenaire", {}), "le lien direct marche même page cachée");
  egal(reglagePage(null, "restoPartenaire").ou, "pied");
});
test("affichée, pour qui, bientôt, ouverture programmée, lien direct", () => {
  const r = { pages: {
    restoPartenaire: { visible: true, ou: "accueil" },
    transport: { visible: true, pour: "tous" },
    hair: { visible: true, pour: "comptes" },
    epoxy: { visible: true, bientot: true },
    digital: { visible: true, ouvertureLe: "2026-12-01" },
    slim: { visible: false, lienDirect: false },
  } };
  egal(etatPage(r, "restoPartenaire", {}), "ouverte");
  egal(etatPage(r, "transport", {}), "ouverte");
  egal(etatPage(r, "hair", {}), "cachee");
  egal(etatPage(r, "hair", { connecte: true }), "ouverte");
  egal(etatPage(r, "epoxy", {}), "bientot");
  egal(etatPage(r, "digital", { jour: "2026-11-20" }), "bientot");
  egal(etatPage(r, "digital", { jour: "2026-12-01" }), "ouverte");
  egal(etatPage(r, "slim", {}), "cachee");
  vrai(!lienDirectOuvert(r, "slim", {}));
  vrai(resumePage(r, "digital").includes("ouvre le 01/12/2026"));
  egal(resumePage(r, "slim"), "cachée");
});
const e = await empreinte("0547380193");
const e2 = await empreinte("0547380193");
test("personnes bloquées (empreinte du téléphone)", () => {
  egal(telPourEmpreinte("+972 54-738-0193"), "0547380193");
  egal(telPourEmpreinte("12"), "");
  egal(e.length, 64);
  egal(e2, e);
  const r = { pages: { restoPartenaire: { visible: true, bloques: [{ e, nom: "X" }, { e: "pas-bon" }] } } };
  egal(reglagePage(r, "restoPartenaire").bloques.length, 1);
  egal(etatPage(r, "restoPartenaire", { empreintes: [e] }), "bloquee");
  vrai(!lienDirectOuvert(r, "restoPartenaire", { empreintes: [e] }));
  egal(etatPage(r, "restoPartenaire", { empreintes: ["autre"] }), "ouverte");
});
