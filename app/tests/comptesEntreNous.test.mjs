// TESTS « COMPTES ENTRE NOUS » (13 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as C from "../src/pricing/comptesEntreNous.js";

section("Comptes entre nous");
const MOYENS = ["Espèces", "Carte bancaire", "Revolut", "Bit", "Virement"];
const base = C.lireComptes([{ id: "ca", nom: "Alexia", telephone: "050-000-0000", lignes: [] }, { id: "cg", nom: "gg Dahan", telephone: "", lignes: [] }]);
const journee = (id, date) => ({ id, statut: "terminee", prixFinal: 70, telephone: "0500000000", date, heure: "14:00", serviceTitre: "Ramassage scolaire" });

test("à jour : solde 0", () => egal(C.phraseSolde("Alexia", C.soldeCompte(base[0], [], [])), "Vous êtes à jour avec Alexia"));
test("la journée de 14h (même téléphone) : elle me doit 70", () => egal(C.soldeCompte(base[0], [journee("j1", "2026-11-13")], []), 70));
test("elle paie 100 pour 70 : 70 placés sur la course (Finances), 30 d'avance", () => {
  const comptes = C.ajouterLigne(base, "ca", { type: "paye", date: "2026-11-13", montant: 100, moyen: "Bit" });
  const plan = C.planAllocation(comptes, [journee("j1", "2026-11-13")], [], MOYENS);
  egal(plan.mouvements, [{ kind: "paiement", resId: "j1", date: "2026-11-13", montant: 70, moyen: "Bit" }]);
  egal(plan.comptes[0].lignes[0].affecte, 70);
  egal(C.soldeCompte(plan.comptes[0], [journee("j1", "2026-11-13")], plan.mouvements), -30);
  egal(C.phraseSolde("Alexia", -30), "Tu dois 30 ₪ à Alexia");
});
test("l'avance se place sur la journée suivante", () => {
  let comptes = C.ajouterLigne(base, "ca", { type: "paye", date: "2026-11-13", montant: 100, moyen: "Espèces" });
  const p1 = C.planAllocation(comptes, [journee("j1", "2026-11-13")], [], MOYENS);
  const p2 = C.planAllocation(p1.comptes, [journee("j1", "2026-11-13"), journee("j2", "2026-11-15")], p1.mouvements, MOYENS);
  egal(p2.mouvements.map((m) => [m.resId, m.montant]), [["j2", 30]]);
  egal(C.soldeCompte(p2.comptes[0], [journee("j1", "2026-11-13"), journee("j2", "2026-11-15")], [...p1.mouvements, ...p2.mouvements]), 40);
});
test("troc (ses ongles) : déduit de la course, sans argent reçu", () => {
  const comptes = C.ajouterLigne(base, "ca", { type: "jedois", date: "2026-11-13", montant: 50, libelle: "Mes ongles" });
  const plan = C.planAllocation(comptes, [journee("j1", "2026-11-13")], [], MOYENS);
  egal(plan.mouvements[0].kind, "correction");
  egal(plan.mouvements[0].motif, "Déduit : Mes ongles");
  egal(C.soldeCompte(plan.comptes[0], [journee("j1", "2026-11-13")], plan.mouvements), 20);
});
test("rien à placer : aucun mouvement (pas de boucle)", () => {
  const comptes = C.ajouterLigne(base, "ca", { type: "paye", date: "2026-11-13", montant: 70, moyen: "Bit" });
  const p1 = C.planAllocation(comptes, [journee("j1", "2026-11-13")], [], MOYENS);
  egal(C.planAllocation(p1.comptes, [journee("j1", "2026-11-13")], p1.mouvements, MOYENS).mouvements, []);
});
test("je lui ai payé : le solde remonte", () => egal(C.soldeCompte(C.ajouterLigne(base, "ca", { type: "jepaie", date: "2026-11-13", montant: 20 })[0], [], []), 20));
test("ancienne dette de gg (course sans numéro, rattachée au compte) : 450", () => {
  const d = C.courseDuCompte(base[1], { date: "2026-11-13", titre: "Anciennes courses", prix: 450 });
  egal([d.statut, d.source, d.prixFinal, d.telephone, d.details.compte], ["terminee", "manuel", 450, "Sans numéro", "cg"]);
  egal(C.soldeCompte(base[1], [{ ...d, id: "x" }], []), 450);
  egal(C.soldeCompte(base[0], [{ ...d, id: "x" }], []), 0);
});
test("ligne déjà placée : pas supprimable", () => {
  vrai(!C.ligneSupprimable({ affecte: 10 }));
  vrai(C.ligneSupprimable({ affecte: 0 }));
});
test("relecture : type inconnu ou montant nul ignorés", () => {
  const l = C.lireComptes(JSON.stringify([{ id: "a", nom: "X", lignes: [{ type: "?", montant: 5, date: "2026-11-13" }, { type: "paye", montant: 0, date: "2026-11-13" }, { type: "paye", montant: 5, date: "2026-11-13", affecte: 9 }] }]));
  egal(l[0].lignes.length, 1);
  egal(l[0].lignes[0].affecte, 5);
});
