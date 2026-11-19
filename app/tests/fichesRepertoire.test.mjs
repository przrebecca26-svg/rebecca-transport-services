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

import { ageDe, enfantSansPlanning } from "../src/pricing/familles.js";
section("Âge des enfants");
test("date de naissance : âge exact", () => {
  egal(ageDe({ naissance: "2018-12-01" }, "2026-11-13"), 7);
  egal(ageDe({ naissance: "2018-11-01" }, "2026-11-13"), 8);
});
test("âge donné en 2026 : il monte tout seul", () => {
  egal(ageDe({ ageAnnees: 6, ageNote: 2026 }, "2026-11-13"), 6);
  egal(ageDe({ ageAnnees: 6, ageNote: 2026 }, "2028-01-02"), 8);
  egal(ageDe({}, "2026-11-13"), null);
});
test("enfant sans planning : relu sans école ni trajet", () => {
  const f = lireFamilles([{ id: "f", nom: "A", enfants: [{ ...enfantSansPlanning(), prenom: "Noa", ageAnnees: 4, ageNote: 2026 }] }]);
  egal([f[0].enfants[0].rdv.length, f[0].enfants[0].ageAnnees], [0, 4]);
});

import { reglesAcompte } from "../src/pricing/acomptes.js";
section("Acompte de chaque demande");
test("mariée jour J et essai : 40 % ; diagnostic RegenX : 30 ₪ ; Nails : 20 % ; activité réglée à 30 %", () => {
  egal(reglesAcompte({ service: "hair", details: { prestation: "Coiffure mariée, jour J" } }).acomptePourcent, 40);
  egal(reglesAcompte({ service: "hair", details: { prestation: "Essai coiffure mariée (facultatif)" } }).acomptePourcent, 40);
  egal(reglesAcompte({ service: "regenx", details: { prestation: "Diagnostic (obligatoire)" } }).libelle, "30 ₪");
  egal(reglesAcompte({ service: "nails", details: { prestation: "Semi-permanent (VSP)" } }).acomptePourcent, 20);
  egal(reglesAcompte({ service: "livraison" }, { activites: [{ id: "coursier", acomptePourcent: 30, acompteMin: 10 }] }).acomptePourcent, 30);
});

section("Clientes avec ou sans compte, et ce que voit Jérémy");
test("rangées toutes seules : avec compte / sans compte", () => {
  const f = lireFamilles([{ id: "fz", nom: "Zoé", telephone: "0500000001" }]);
  const e = R.entreesRepertoire(f, [{ cle: "uidB", nom: "Bella", telephone: "0501111111", avecCompte: true }, { cle: "tel_0502222222", nom: "Sans", telephone: "0502222222", avecCompte: false }]);
  egal(e.map((x) => [x.nom, x.rang]), [["Bella", "avecCompte"], ["Sans", "sansCompte"], ["Zoé", "sansCompte"]]);
  egal(R.filtrerEntrees(e, "avecCompte").length, 1);
});
test("Jérémy ne voit que ses courses ; Rebecca voit tout", () => {
  const l = [{ id: "a" }, { id: "b", realisePar: "uidJ" }, { id: "c", attribueA: "uidJ" }];
  egal(R.pourQui(l, "uidJ", false).map((d) => d.id), ["b", "c"]);
  egal(R.pourQui(l, "rebecca", true).length, 3);
});

import * as S from "../src/pricing/suiviBeaute.js";
section("Suivi beauté de la cliente");
test("séance : date, prestation, payé ou non, produits, prochain rendez-vous", () => {
  let s = S.lireSuivi("{}");
  s = S.ajouterSeance(s, { activite: "regenx", date: "2026-11-13", prestation: "Sourcils", prix: 1000, paye: 600, moyen: "Bit", produits: "Sérum 10 ml", prixProduits: 120, prochainRdv: "2026-11-27", commentaire: "RAS" });
  const r = S.resumeActivite(s, "regenx", "2026-11-13");
  egal([r.nb, r.impaye, r.prochain], [1, 520, "2026-11-27"]);
});
test("cure Slim 8 séances : acompte puis 4 versements, séances faites et reste", () => {
  let s = S.ajouterCure(S.lireSuivi("{}"), { activite: "slim", nom: "Anti-cellulite, cure 8 séances", prix: 2700, seances: 8, debut: "2026-11-13" });
  const c = s.cures[0];
  s = S.ajouterVersement(s, c.id, { date: "2026-11-10", montant: 540, moyen: "Bit", note: "Acompte 20 %" });
  s = S.ajouterVersement(s, c.id, { date: "2026-11-13", montant: 540, moyen: "Chèque" });
  s = S.ajouterSeance(s, { activite: "slim", date: "2026-11-13", prestation: "Séance 1", cure: c.id });
  const e = S.etatCure(s, s.cures[0]);
  egal([e.faites, e.restantes, e.paye, e.reste, e.versementsRestants], [1, 7, 1080, 1620, 3]);
});

// 19 nov. 2026 : résumé de la fiche (fidèles, inactives, panier moyen, cartes cadeaux)
import { resumeFiche as _resume, suiviDeLEntree as _suivi } from "../src/pricing/fichesRepertoire.js";
section("Fiches : résumé intelligent");
const _d = (id, date, prix, statut = "terminee") => ({ id, date, prixFinal: prix, statut, telephone: "0541112222" });
test("fidèle : 3 prestations sur 6 mois ; fréquence et panier moyen", () => {
  const r = _resume([_d("a", "2026-09-01", 60), _d("b", "2026-10-01", 80), _d("c", "2026-11-01", 100), _d("x", "2026-11-20", 50, "acceptee")], [], "2026-11-19");
  egal([r.nbPrestations, r.premiere, r.derniere, r.frequenceJours, r.panierMoyen, r.fidele, r.inactive], [3, "2026-09-01", "2026-11-01", 31, 80, true, false]);
});
test("inactive : dernière prestation il y a plus de 2 mois", () => {
  const r = _resume([_d("a", "2026-08-01", 60)], [], "2026-11-19");
  egal([r.fidele, r.inactive, r.depuisJours, r.frequenceJours], [false, true, 110, null]);
});
test("cartes cadeaux offertes et reçues (même téléphone)", () => {
  const r = _resume([], [], "2026-11-19", [{ acheteurTel: "054-111-2222", pourTel: "", statut: "active", solde: 100 }, { acheteurTel: "052", pourTel: "0541112222", statut: "a_payer" }, { acheteurTel: "050-999-0000" }], ["054-111-2222"]);
  egal([r.cartesOffertes, r.cartesRecues, r.cartes.length], [1, 1, 2]);
});
test("Moi et Famille et amis ne sont jamais rangés fidèles ou inactives", () => {
  egal(_suivi({ rang: "proches", clients: [], telephone: "0541112222" }, [_d("a", "2026-01-01", 60)], [], "2026-11-19"), { fidele: false, inactive: false });
});
