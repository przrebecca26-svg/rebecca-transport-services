// TESTS DU TRAJET PARTAGE SUR LE SITE (15 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A } from "./donnees.mjs";
import { TARIFS } from "../src/pricing/config.js";
import * as P from "../src/pricing/ramassagePlanning.js";
import * as R from "../src/pricing/partageRamassage.js";

const ROUTE = { km: 2, minutes: 5 };
const T = JSON.parse(JSON.stringify(TARIFS));
T.calendrier.creneauxPersonnels = [];
T.calendrier.fermeturesExceptionnelles = [];
T.calendrier.vacancesScolaires = [];
const enfant = (plus = {}) => ({ ...P.enfantVide(), ...plus });
const commun = { domicile: A.netanya, ecole: A.netanya2, periode: "mois", date: "" };

section("Trajet partage sur le site");

const creation = (connais = false) =>
  R.nouveauPartage(commun, [
    { nom: "Cliente", telephone: "0501111111", rempli: true, enfants: [enfant({ prenom: "Léa", heureSortie: "12:00" }), enfant({ prenom: "Tom", heureSortie: "15:30" })] },
    { nom: "Voisine", telephone: "0502222222", rempli: false, enfants: connais ? [enfant({ prenom: "Mia", heureSortie: "12:00" })] : [] },
  ], "enfant");

test("creation : la 1re maman, une famille en attente = prix provisoire pour elle seule", () => {
  const d = creation();
  const c = R.calculerPartage(d, ROUTE, T);
  vrai(c.resultat.ok, c.manque);
  egal(c.parFamille.map((p) => p.montant == null), [false, true]);
  egal(c.complet, false);
  egal(c.parFamille[0].montant, c.resultat.total);
});

test("elle connait les enfants de la voisine : prix partage tout de suite", () => {
  const c = R.calculerPartage(creation(true), ROUTE, T);
  egal(c.parFamille.every((p) => p.montant != null), true);
  egal(Math.round((c.parFamille[0].montant + c.parFamille[1].montant) * 100) / 100, c.resultat.total);
});

test("la voisine complete sa partie : seule SA ligne change, le devis est recalcule", () => {
  const d = creation();
  const maj = R.remplirFamille(d, 1, { enfants: [enfant({ prenom: "Mia", heureSortie: "12:00" }), enfant({ prenom: "Sam", heureSortie: "15:30" }), enfant({ prenom: "Noé", heureSortie: "15:30" })].map(R.enfantPropre) });
  egal(maj.familles[0], d.familles[0]);
  egal([maj.familles[1].rempli, maj.familles[1].enfants.length, maj.familles[1].nom], [true, 3, "Voisine"]);
  const c = R.calculerPartage({ ...d, ...maj }, ROUTE, T);
  egal(c.complet, true);
  egal(c.resultat.details.familles.map((f) => f.enfants), [2, 3]);
  vrai(Math.abs(c.parFamille[1].montant / c.parFamille[0].montant - 1.5) < 0.05, JSON.stringify(c.parFamille));
});

test("lien personnel de chaque famille", () => {
  egal(R.lienPartage("https://site.app/", "AbCdEfGhIjKlMnOpQrSt", 1), "https://site.app/#/partage/AbCdEfGhIjKlMnOpQrSt/1");
  egal(R.lireLienPartage("#/partage/AbCdEfGhIjKlMnOpQrSt/1"), { id: "AbCdEfGhIjKlMnOpQrSt", famille: 1 });
  egal(R.lireLienPartage("#/admin"), null);
  egal(R.lireLienPartage("#/partage/court/1"), null);
});

test("messages : invitation de la voisine et demande pour Rebecca", () => {
  const d = creation();
  const c = R.calculerPartage(d, ROUTE, T);
  const m = R.messagePartage(d, 1, "https://x/#/partage/abc/1", c, "Cliente");
  vrai(m.includes("Cliente vous propose de partager"), m);
  vrai(m.includes("Enfants : à compléter"), m);
  vrai(m.includes("https://x/#/partage/abc/1"), m);
  const r = R.messageRebecca(d, c, ["https://x/#/partage/abc/0"]);
  vrai(r.includes("Ramassage scolaire partagé (2 familles)") && r.includes("Voisine : en attente"), r);
});

test("document propre : pas plus de 3 familles ni 4 enfants, heures et dates verifiees", () => {
  const d = R.nouveauPartage({ ...commun, date: "pas une date" }, [1, 2, 3, 4].map(() => ({ nom: "x".repeat(80), telephone: "1", enfants: [1, 2, 3, 4, 5].map(() => enfant({ heureSortie: "25:00" })) })));
  egal([d.familles.length, d.familles[0].enfants.length, d.familles[0].nom.length, d.familles[0].enfants[0].heureSortie, d.commun.date], [3, 4, 60, "", ""]);
});

test("ouverture dans le devis rapide : familles, noms et telephones", () => {
  const d = creation(true);
  const { plan } = R.planDuPartage(d);
  egal([plan.nbFamilles, plan.enfants.map((e) => e.famille), plan.autresFamilles[0]], [2, [0, 0, 1], { nom: "Voisine", telephone: "0502222222" }]);
});

test("Rebecca modifie la demande dans son devis : aller-retour devis <-> demande sans perte", () => {
  const d = creation(true);
  const { plan } = R.planDuPartage(d);
  plan.enfants[0].heureSortie = "12:50"; // la maman demande un changement
  const n = R.partageDepuisPlan(plan, "Cliente", "0501111111", d);
  egal([n.familles.length, n.familles[0].nom, n.familles[1].nom, n.familles[1].telephone], [2, "Cliente", "Voisine", "0502222222"]);
  egal([n.familles[0].enfants.length, n.familles[1].enfants.length, n.familles[0].enfants[0].heureSortie], [2, 1, "12:50"]);
  egal([n.familles[0].rempli, n.familles[1].rempli], [true, true]);
  egal(n.commun.domicile, d.commun.domicile);
});
