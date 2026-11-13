// TESTS « FICHES DU REPERTOIRE » (13 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/fichesRepertoire.js";
import { lireFamilles } from "../src/pricing/familles.js";

section("Répertoire : une fiche par famille ou cliente, avec catégories");
const familles = lireFamilles([
  { id: "f1", nom: "Rebecca Perez moi", telephone: "054-738-0193", enfants: [{ prenom: "Shyrel" }] },
  { id: "f2", nom: "Dahan · Alexia", telephone: "050-111-2222", membres: [{ nom: "gg Dahan", lien: "Mari", telephone: "052-333-4444" }], enfants: [{ prenom: "Joy" }, { prenom: "Liel" }] },
]);
const fiches = [
  { cle: "uidA", nom: "Alexia Dahan", telephone: "+972501112222", avecCompte: true },
  { cle: "uidN", nom: "Naomie", telephone: "0549998888", avecCompte: true },
  { cle: "tel_", nom: "X", telephone: "Sans numéro" },
];
test("« moi » reconnu, membres relus, cliente par défaut", () => {
  egal(familles[0].categorie, "moi");
  egal(familles[1].categorie, "clientes");
  egal(familles[1].membres[0].lien, "Mari");
});
test("la cliente du site au même numéro est dans la fiche de sa famille", () => {
  const e = R.entreesRepertoire(familles, fiches, { uidN: "proches" });
  egal(e.map((x) => [x.nom, x.categorie]), [["Rebecca Perez moi", "moi"], ["Naomie", "proches"], ["Dahan · Alexia", "clientes"]]);
  egal(e[2].clients.map((c) => c.cle), ["uidA"]);
});
test("recherche par membre ou enfant, et par catégorie", () => {
  const e = R.entreesRepertoire(familles, fiches);
  egal(R.filtrerEntrees(e, "tous", "gg").map((x) => x.nom), ["Dahan · Alexia"]);
  egal(R.filtrerEntrees(e, "tous", "liel").map((x) => x.nom), ["Dahan · Alexia"]);
  egal(R.filtrerEntrees(e, "moi").length, 1);
});
test("historique : numéros de la famille et de ses membres, forfait, comptes", () => {
  const e = R.entreesRepertoire(familles, fiches).find((x) => x.famille && x.famille.id === "f2");
  const demandes = [
    { id: "a", date: "2026-11-01", telephone: "0501112222" },
    { id: "b", date: "2026-11-02", telephone: "052 333 4444" },
    { id: "c", date: "2026-11-03", telephone: "x", details: { famille: "f2" } },
    { id: "d", date: "2026-11-04", telephone: "Sans numéro", details: { compte: "cg" } },
    { id: "e", date: "2026-11-05", telephone: "0549998888" },
  ];
  const comptes = [{ id: "cg", nom: "gg Dahan", telephone: "", famille: "f2" }];
  egal(R.demandesDeLEntree(e, demandes, comptes).map((d) => d.id), ["d", "c", "b", "a"]);
  egal(R.comptesDeLEntree(e, comptes).length, 1);
});
