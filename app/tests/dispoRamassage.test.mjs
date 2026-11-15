// TESTS : TRAJETS DEJA PRIS PAR LA TOURNEE (devis du site, 15 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A } from "./donnees.mjs";
import * as P from "../src/pricing/ramassagePlanning.js";
import * as D from "../src/pricing/dispoRamassage.js";
import { trajetVide } from "../src/pricing/tournee.js";

const ROUTE = { km: 2, minutes: 5 };
const enfant = (plus = {}) => ({ ...P.enfantVide(), ...plus });
const plan = (enfants) => ({ ...P.planVide(), domicile: A.netanya, ecole: A.netanya2, periode: "mois", enfants });
// Rebecca est prise du dimanche au jeudi de 7h40 a 8h35 (sa tournee du matin) et de 13h20 a 14h10
const CRENEAUX = [{ jours: [0, 1, 2, 3, 4], debut: "07:40", fin: "08:35" }, { jours: [0, 1, 2, 3, 4], debut: "13:20", fin: "14:10" }];

section("Trajets deja pris (devis du site)");

test("matin deja pris : impossible ; sortie libre a 16h : possible", () => {
  const l = D.trajetsIndisponibles(plan([enfant({ prenom: "Tom", sens: "deux", heureMatin: "07:45", heureSortie: "16:00" })]), ROUTE, CRENEAUX, []);
  egal(l.map((x) => [x.sens, x.w]), [["matin", 0], ["matin", 1], ["matin", 2], ["matin", 3], ["matin", 4]]);
  egal(D.texteIndisponibles(l), ["Tom : dimanche, lundi, mardi, mercredi, jeudi matin (07h45)"]);
});

test("seulement la sortie libre : rien ne bloque", () => {
  egal(D.trajetsIndisponibles(plan([enfant({ sens: "sortie", heureSortie: "16:00" })]), ROUTE, CRENEAUX, []), []);
});

test("sortie dans la meme ecole a quelques minutes d'un ramassage prevu, avec des places : pris au passage", () => {
  const tournee = [trajetVide({ type: "sortie", de: A.netanya2, a: A.netanya, heure: "13:30", places: 2 })];
  const arrets = D.lireArrets(JSON.stringify(D.arretsGroupables(tournee)));
  egal(D.trajetsIndisponibles(plan([enfant({ sens: "sortie", heureSortie: "13:35" })]), ROUTE, CRENEAUX, arrets), []);
  // plus assez de places (2 deja + 3 = 5 > 4) : bloque
  const trois = [1, 2, 3].map(() => enfant({ sens: "sortie", heureSortie: "13:30" }));
  egal(D.trajetsIndisponibles(plan(trois), ROUTE, CRENEAUX, arrets).length, 15);
  // autre ecole a la meme heure : bloque
  const ailleurs = { ...plan([enfant({ sens: "sortie", heureSortie: "13:30" })]), ecole: A.tel_aviv };
  egal(D.trajetsIndisponibles(ailleurs, ROUTE, CRENEAUX, arrets).length, 5);
});

test("arrets publics : lieu arrondi (ecole), heure, places, sans nom", () => {
  const a = D.arretsGroupables([trajetVide({ nom: "Ma fille", type: "sortie", de: A.netanya2, heure: "13:30", places: 1 })]);
  vrai(!JSON.stringify(a).includes("Ma fille"), JSON.stringify(a));
  egal(a[0].jours, [0, 1, 2, 3, 4]);
});
