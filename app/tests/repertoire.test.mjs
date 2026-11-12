// TESTS DU REPERTOIRE D'ADRESSES (12 nov. 2026) - Rebecca Services
// Adresses inventees pour les tests (aucune vraie adresse dans le programme).

import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/repertoire.js";

const A = (label, n) => ({ label, lat: 32.3 + n / 100, lon: 34.85 });
const LIEUX = [
  { id: "1", nom: "Maman", type: "famille", adresse: A("Rue des Fleurs 3, Netanya", 1), note: "code 1234" },
  { id: "2", nom: "Carrefour", type: "magasin", adresse: A("Zone commerciale, Netanya", 2), note: "" },
  { id: "3", nom: "École de ma fille", type: "ecole", adresse: A("Rue de l'École 1, Netanya", 3), note: "" },
];
const CLIENTS = R.adressesClients([
  { id: "u1", prenom: "Dana", nom: "Levi", telephone: "0541112233", adresse: "Rue Herzl 10, Netanya", adresses: [{ nom: "Travail", label: "Poleg 5, Netanya", lat: 32.27, lon: 34.84 }], enfants: [{ prenom: "Noa", adresse: "Rue Herzl 10, Netanya", ecole: "École Bialik" }] },
  { id: "u2", prenom: "Sans", nom: "Adresse" },
]);

section("Repertoire d'adresses");

test("lecture de la base : lieux propres, contenu abime ignore", () => {
  egal(R.lireRepertoire(JSON.stringify(LIEUX)), LIEUX);
  egal(R.lireRepertoire("pas du json"), []);
  egal(R.lireRepertoire(JSON.stringify([{ nom: "", adresse: A("x", 1) }, { nom: "Sans adresse" }, { nom: "Bizarre", type: "inconnu", adresse: { label: "Rue tapée à la main" } }])).map((l) => [l.nom, l.type]), [["Bizarre", "autre"]]);
});

test("un lieu a besoin d'un nom et d'une adresse", () => {
  vrai(/nom/.test(R.manqueLieu(R.lieuVide())));
  vrai(/adresse/.test(R.manqueLieu({ ...R.lieuVide(), nom: "Basket" })));
  egal(R.manqueLieu(LIEUX[0]), "");
});

test("clientes : domicile, adresses favorites, enfants ; sans doublon ; sans adresse = pas dans la liste", () => {
  egal(CLIENTS.length, 1);
  egal([CLIENTS[0].nom, CLIENTS[0].telephone], ["Dana Levi", "0541112233"]);
  egal(CLIENTS[0].adresses.map((a) => a.nom), ["Domicile", "Travail", "École de Noa"]);
  egal(CLIENTS[0].adresses[1].adresse, { label: "Poleg 5, Netanya", lat: 32.27, lon: 34.84 });
});

const SOURCE = { lieux: LIEUX, clients: CLIENTS };

test("recherche par nom : sans accent, sans majuscule, mes lieux d'abord", () => {
  egal(R.chercherRepertoire("carr", 5, SOURCE).map((x) => x.titre), ["Carrefour"]);
  egal(R.chercherRepertoire("ecole", 5, SOURCE).map((x) => x.titre), ["École de ma fille", "Dana Levi · École de Noa"]);
  egal(R.chercherRepertoire("1234", 5, SOURCE)[0].titre, "Maman");
  egal(R.chercherRepertoire("c", 5, SOURCE), []);
});

test("recherche par nom d'une cliente : toutes ses adresses", () => {
  const r = R.chercherRepertoire("dana", 5, SOURCE);
  egal(r.map((x) => x.titre), ["Dana Levi · Domicile", "Dana Levi · Travail", "Dana Levi · École de Noa"]);
  egal(r[0].adresse, { label: "Rue Herzl 10, Netanya" });
});

test("sur le site des clientes le repertoire est vide : aucune suggestion", () => egal(R.chercherRepertoire("carrefour"), []));

test("repertoire en memoire : rempli par l'espace prive, les ecrans sont prevenus", () => {
  let vu = 0;
  const stop = R.abonnerRepertoire(() => vu++);
  R.definirRepertoire({ lieux: LIEUX });
  R.definirRepertoire({ clients: CLIENTS });
  egal([vu, R.repertoireCourant().lieux.length, R.repertoireCourant().clients.length], [2, 3, 1]);
  egal(R.chercherRepertoire("maman")[0].titre, "Maman");
  stop();
  R.definirRepertoire({ lieux: [], clients: [] });
  egal(vu, 2);
});

test("lieux nommes dans la tournee : ajoutes au repertoire, le nom le plus recent gagne", () => {
  const f = R.fusionnerLieux(LIEUX, [{ nom: "École Ouziel", adresse: LIEUX[2].adresse }, { nom: "Basket", adresse: A("Gymnase, Netanya", 9) }, { nom: "", adresse: A("x", 8) }]);
  egal(f.map((l) => [l.nom, l.type]), [["Maman", "famille"], ["Carrefour", "magasin"], ["École Ouziel", "ecole"], ["Basket", "ecole"]]);
  egal(LIEUX[2].nom, "École de ma fille");
});

test("distance a la maison affichee dans les suggestions (espace prive)", () => {
  egal(R.maisonDuRepertoire({ lieux: LIEUX, clients: [] }), null);
  const maison = { id: "m", nom: "Maison", type: "maison", adresse: A("Chez moi", 0), note: "" };
  egal(R.maisonDuRepertoire({ lieux: [...LIEUX, maison], clients: [] }), maison.adresse);
  egal([R.texteDistance(0.02), R.texteDistance(0.42), R.texteDistance(2.46), R.texteDistance(27.3)], ["à 50 m de la maison", "à 400 m de la maison", "à 2,5 km de la maison", "à 27 km de la maison"]);
});
