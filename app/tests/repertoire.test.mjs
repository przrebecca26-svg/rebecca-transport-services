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

section("Repertoire : corriger ou masquer une adresse venue d'un compte");

const COMPTES = [{ id: "u1", prenom: "Dana", nom: "Levi", telephone: "0541112233", adresse: "Rue Herzl 10, Netanya", enfants: [{ prenom: "Noa", adresse: "Rue Herzl 10, Netanya", ecole: "Uziel" }] }];
const BONNE = A("École Uziel, rue de l'École 1, Netanya", 7);

test("l'ecole n'est qu'un nom (« Uziel ») : je mets la bonne adresse, le compte n'est pas touche", () => {
  const corrections = R.corriger([], "u1", "École de Noa", { adresse: BONNE });
  const c = R.adressesClients(COMPTES, corrections)[0];
  egal(c.adresses.map((a) => [a.nom, a.adresse.label, !!a.corrigee]), [["Domicile", "Rue Herzl 10, Netanya", false], ["École de Noa", BONNE.label, true]]);
  egal(c.adresses[1].origine, { label: "Uziel" });
  egal(COMPTES[0].enfants[0].ecole, "Uziel");
  egal(R.adressesClients(COMPTES, R.corriger(corrections, "u1", "École de Noa"))[0].adresses[1].adresse, { label: "Uziel" });
});

test("masquer une adresse, puis la reafficher", () => {
  const corrections = R.corriger([], "u1", "École de Noa", { masquee: true });
  const c = R.adressesClients(COMPTES, corrections)[0];
  egal([c.adresses.length, c.masquees.map((m) => m.nom)], [1, ["École de Noa"]]);
  egal(R.corriger(corrections, "u1", "École de Noa"), []);
});

test("corrections enregistrees avec les lieux ; ancienne forme (liste seule) toujours lue", () => {
  const corrections = [...R.corriger([], "u1", "École de Noa", { adresse: BONNE }), ...R.corriger([], "u1", "Domicile", { masquee: true })];
  const json = JSON.stringify({ lieux: LIEUX, corrections: [...corrections, { cle: "", nom: "abime" }, { cle: "u9", nom: "sans adresse" }] });
  egal(R.lireRepertoire(json), LIEUX);
  egal(R.lireCorrections(json), corrections);
  egal(R.lireRepertoire(JSON.stringify(LIEUX)), LIEUX);
  egal(R.lireCorrections(JSON.stringify(LIEUX)), []);
});

test("la recherche par nom utilise l'adresse corrigee", () => {
  R.definirRepertoire({ lieux: [], bruts: COMPTES, corrections: R.corriger([], "u1", "École de Noa", { adresse: BONNE }) });
  egal(R.chercherRepertoire("noa").map((x) => x.sous), [BONNE.label]);
  R.definirRepertoire({ lieux: [], bruts: [], corrections: [] });
});

section("Recherche d'adresses Google (facultative)");
{
  const G = await import("../src/routing.js");
  test("sans cle : Google n'est pas utilise ; une cle mal formee est refusee", () => {
    egal(G.googleActif(), false);
    G.definirCleGoogle("trop court");
    egal(G.googleActif(), false);
    G.definirCleGoogle("AIzaSyD-exemple_de_cle_0123456789abcdef");
    egal(G.googleActif(), true);
    G.definirCleGoogle("");
    egal(G.googleActif(), false);
  });
  test("suggestions de Google : nom et adresse, sans le pays, 6 au maximum", () => {
    const data = { suggestions: [{ placePrediction: { placeId: "abc", text: { text: "École Uziel, Rue Exemple, Netanya, Israël" } } }, { queryPrediction: { text: { text: "ecole" } } }, { placePrediction: { placeId: "", text: { text: "x" } } }] };
    egal(G.lireSuggestionsGoogle(data, "s1"), [{ label: "École Uziel, Rue Exemple, Netanya", placeId: "abc", session: "s1" }]);
    egal(G.lireSuggestionsGoogle({}, "s1"), []);
  });
  test("lieu choisi : point exact, et le nom de l'ecole garde devant l'adresse", () => {
    const s1 = { label: "École Uziel, Rue Exemple, Netanya", placeId: "abc" };
    egal(G.lireDetailGoogle({ location: { latitude: 32.31, longitude: 34.86 }, formattedAddress: "Rue Exemple 12, Netanya, Israël" }, s1), { label: "École Uziel, Rue Exemple 12, Netanya", lat: 32.31, lon: 34.86 });
    const s2 = { label: "Rue Exemple 12, Netanya", placeId: "def" };
    egal(G.lireDetailGoogle({ location: { latitude: 1, longitude: 2 }, formattedAddress: "Rue Exemple 12, Netanya, Israël" }, s2).label, "Rue Exemple 12, Netanya");
    egal(G.lireDetailGoogle({ formattedAddress: "sans point" }, s2), null);
  });
}
