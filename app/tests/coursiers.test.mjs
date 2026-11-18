// TESTS COURSIERS PARTENAIRES (18 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import {
  commissionCourse, reglagesCommission, ligneCourse, compteCoursier, bornesMois, bornesSemaine, bilanFinDeMois, estBloque,
  documentsRequis, decision, peutPasser, erreursCandidature, peutRecevoir, accepter, terminer, messageReleve,
} from "../src/pricing/coursiers.js";

section("Coursiers : commission");
test("15 % minimum 3 ₪", () => {
  egal(commissionCourse(60).montant, 9);
  egal(commissionCourse(15).montant, 3);
  egal(commissionCourse(2).montant, 2);
  egal(commissionCourse(0).montant, 0);
});
test("commerçant apporté : 8 % minimum 2 ₪", () => {
  egal(commissionCourse(100, { commercantValide: true }).montant, 8);
  egal(commissionCourse(20, { commercantValide: true }).montant, 2);
});
test("réglages modifiables, valeurs folles ignorées", () => {
  egal(commissionCourse(100, { reglages: { normale: { taux: 20, minimum: 3 } } }).montant, 20);
  egal(reglagesCommission({ normale: { taux: 90 } }).normale.taux, 15);
  egal(reglagesCommission({}).plafondDette, 150);
});

section("Coursiers : compte du mois");
const courses = [
  { id: "a", date: "2026-11-02", statut: "terminee", prix: 60, pourboire: 10, moyen: "bit", commission: { montant: 9 } },
  { id: "b", date: "2026-11-05", statut: "terminee", prix: 40, pourboire: 0, moyen: "especes", commission: { montant: 6 } },
  { id: "c", date: "2026-11-09", statut: "annulee", prix: 80, moyen: "bit", commission: { montant: 12 } },
  { id: "d", date: "2026-12-01", statut: "terminee", prix: 50, moyen: "bit", commission: { montant: 7.5 } },
];
test("électronique reversé, espèces gardées, commission sur tout", () => {
  const c = compteCoursier({ courses, ...bornesMois("2026-11") });
  egal(c.nombre, 2);
  egal(c.encaisseParRebecca, 70);
  egal(c.gardeEnMain, 40);
  egal(c.commissions, 15);
  egal(c.solde, 55);
  egal(c.gainNet, 95);
  egal(bilanFinDeMois(c).sens, "vers_coursier");
});
test("commission figée : on garde celle de la course", () => {
  egal(ligneCourse({ prix: 100, moyen: "bit", commission: { montant: 8 } }).commission, 8);
});
test("que des espèces : le coursier doit", () => {
  const c = compteCoursier({ courses: [{ date: "2026-11-03", statut: "terminee", prix: 100, moyen: "especes", commission: { montant: 15 } }], ...bornesMois("2026-11") });
  egal(c.solde, -15);
  egal(bilanFinDeMois(c), { sens: "vers_rebecca", montant: 15, texte: "Tu dois 15 ₪ à Rebecca Services (commissions sur tes courses payées en espèces)." });
});
test("versements déjà faits", () => {
  const c = compteCoursier({ courses, reglements: [{ date: "2026-11-20", sens: "vers_coursier", montant: 55 }], ...bornesMois("2026-11") });
  egal(c.solde, 0);
  egal(bilanFinDeMois(c).sens, "aucun");
});
test("blocage au-delà de 150 ₪ de dette", () => {
  egal(estBloque(-150), false);
  egal(estBloque(-151), true);
  egal(estBloque(-60, { plafondDette: 50 }), true);
});
test("périodes", () => {
  egal(bornesMois("2026-02"), { debut: "2026-02-01", fin: "2026-02-28" });
  egal(bornesSemaine("2026-11-18"), { debut: "2026-11-15", fin: "2026-11-21" });
  vrai(messageReleve({ nom: "Dan", periode: "novembre", compte: compteCoursier({ courses, ...bornesMois("2026-11") }) }).includes("55 ₪"));
});

section("Coursiers : candidature");
test("documents selon le véhicule", () => {
  vrai(!documentsRequis("voiture").some((d) => d.id === "topcase"));
  vrai(documentsRequis("scooter").some((d) => d.id === "topcase"));
  vrai(!documentsRequis("velo").some((d) => d.id === "permis"));
});
const cand = { nom: "Dan Cohen", telephone: "054 123 4567", osek: "patour", vehicule: "velo", paiement: "Bit 0541234567", documents: { identite: "x", osek: "x", photoVelo: "x" }, engagement: true };
test("candidature complète", () => {
  egal(erreursCandidature(cand), {});
  vrai(erreursCandidature({ ...cand, documents: {} }).documents);
  vrai(erreursCandidature({ ...cand, engagement: false }).engagement);
});
test("statuts et décisions datées", () => {
  vrai(peutPasser("en_verification", "approuve"));
  vrai(!peutPasser("brouillon", "approuve"));
  vrai(decision({ statut: "en_verification" }, "complement_demande").erreur);
  const d = decision({ statut: "en_verification" }, "complement_demande", "Photo du permis floue");
  egal(d.statut, "complement_demande");
  egal(d.historique.length, 1);
  vrai(decision({ statut: "refuse" }, "approuve").erreur);
});

section("Coursiers : missions");
const fiche = { statut: "approuve", disponible: true };
test("seulement livraisons et courses", () => {
  vrai(peutRecevoir({ fiche, mission: { service: "livraison" } }).ok);
  vrai(peutRecevoir({ fiche, mission: { service: "courses" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "transport" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "aeroport" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "livraison" }, soldeCumule: -200 }).ok);
  vrai(!peutRecevoir({ fiche: { ...fiche, statut: "suspendu" }, mission: { service: "livraison" } }).ok);
});
test("le premier qui accepte, commission figée", () => {
  const m = { statut: "proposee", proposeeA: ["u1", "u2"], prix: 60 };
  const r = accepter(m, "u1");
  egal(r.maj.commission.montant, 9);
  vrai(accepter({ ...m, statut: "acceptee" }, "u2").erreur);
  vrai(accepter(m, "u3").erreur);
});
test("photo de preuve obligatoire", () => {
  const m = { statut: "acceptee" };
  vrai(terminer(m, { moyen: "bit" }).erreur);
  vrai(terminer(m, { photo: "data:image/jpeg;base64,AAA" }).erreur);
  egal(terminer(m, { photo: "data:image/jpeg;base64,AAA", moyen: "especes", pourboire: "5" }).maj.pourboire, 5);
});
