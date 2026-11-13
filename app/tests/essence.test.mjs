// TESTS « MON ESSENCE » (13 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as E from "../src/pricing/essence.js";
import { TARIFS, carburantParKm } from "../src/pricing/config.js";

section("Essence : travail Rebecca Services, Wolt, perso");
let e = E.lireEssence("{}");
e = E.ajouterPlein(e, { date: "2026-11-02", montant: 300, compteur: "10000" });
e = E.ajouterPlein(e, { date: "2026-11-20", montant: 300, compteur: "11000" });
e = { ...E.kmWolt(e, "w1", 200), tourneeKmJour: 0 };
const demandes = [{ statut: "terminee", date: "2026-11-05", kmEstime: 50 }, { statut: "terminee", date: "2026-11-06", kmEstime: 50, realisePar: "uidJeremy" }];
const wolt = [{ id: "w1", debut: "2026-11-10", livraisons: 30, revenu: 500 }];
test("compteur : 1000 km, RS 100 km, Wolt 200 km -> 10 % / 20 % / 70 %", () => {
  const s = E.essenceDuMois("2026-11", e, demandes, wolt);
  egal([s.total, s.kmTotal, s.kmRS, s.kmWolt, s.essenceRS, s.essenceWolt, s.essencePerso, s.kmPerso], [600, 1000, 100, 200, 60, 120, 420, 700]);
  egal([s.livraisonsWolt, s.gainsWolt, s.gainWoltNet], [30, 500, 380]);
});
test("sans compteur : km x consommation, jamais plus que les pleins", () => {
  const f = { ...E.lireEssence("{}"), pleins: [{ id: "a", date: "2026-11-02", montant: 50, litres: 0, compteur: 0 }], woltKm: { w1: 200 } };
  const s = E.essenceDuMois("2026-11", f, demandes, wolt);
  vrai(s.essenceRS + s.essenceWolt <= 50.01);
  egal(s.essencePerso, 0);
  const g = { ...f, pleins: [{ id: "a", date: "2026-11-02", montant: 1000, litres: 0, compteur: 0 }] };
  const t = E.essenceDuMois("2026-11", g, demandes, wolt);
  egal(t.essenceRS, Math.round(100 * carburantParKm(TARIFS) * 100) / 100);
});
test("tournée : km par jour x jours d'école", () => {
  const s = E.essenceDuMois("2026-11", { ...e, tourneeKmJour: 10 }, [], []);
  egal(s.kmTournee, 10 * s.joursEcole);
  vrai(s.joursEcole > 10 && s.joursEcole <= 23);
});
test("relecture : plein sans montant ignoré", () => egal(E.lireEssence(JSON.stringify({ pleins: [{ date: "2026-11-01", montant: 0 }] })).pleins.length, 0));

import { encaisseAnnee } from "../src/pricing/financesAnnee.js";
section("Finances : encaissé, reste à encaisser, total");
test("70 ₪ faits non payés : reste à encaisser, pas encaissé ; troc à part", () => {
  const demandes = [{ id: "a", statut: "terminee", date: "2026-11-13", prixFinal: 70 }, { id: "b", statut: "terminee", date: "2026-11-12", prixFinal: 100 }, { id: "c", statut: "terminee", date: "2026-11-11", prixFinal: 50 }];
  const mouvements = [{ kind: "paiement", resId: "b", date: "2026-11-12", montant: 100 }, { kind: "correction", resId: "c", date: "2026-11-11", montant: 50, motif: "Déduit : Mes ongles" }];
  const r = encaisseAnnee({ annee: 2026, demandes, mouvements, depenses: [{ date: "2026-11-01", montant: 20 }], autresRevenus: [{ debut: "2026-11-02", revenu: 300 }] });
  egal([r.totaux.encaisse, r.totaux.troc, r.totaux.reste, r.totaux.total, r.totaux.beneficeEncaisse], [100, 50, 70, 220, 380]);
});

import { monMois } from "../src/pricing/monMois.js";
section("Mon mois : ce que je gagne vraiment");
test("encaissé par activité + Wolt − essence de travail − dépenses", () => {
  const demandes = [
    { id: "r", service: "ramassage", statut: "terminee", date: "2026-11-13", prixFinal: 70 },
    { id: "l", service: "livraison", statut: "terminee", date: "2026-11-10", prixFinal: 60, kmEstime: 10 },
    { id: "n", service: "nails", statut: "terminee", date: "2026-11-11", prixFinal: 100 },
  ];
  const mouvements = [{ kind: "paiement", resId: "r", date: "2026-11-13", montant: 70 }, { kind: "paiement", resId: "l", date: "2026-11-10", montant: 60 }];
  const essence = { pleins: [{ id: "p", date: "2026-11-02", montant: 500, litres: 0, compteur: 0 }], woltKm: {}, tourneeKmJour: 0 };
  const r = monMois("2026-11", { demandes, mouvements, depenses: [{ date: "2026-11-05", categorie: "Péages", montant: 20 }], autresRevenus: [{ id: "w", debut: "2026-11-03", revenu: 400 }], essence });
  egal([r.gagne.ramassage, r.gagne.coursier, r.gagne.beaute, r.wolt, r.totalGagne, r.resteAEncaisser], [70, 60, 0, 400, 530, 100]);
  vrai(r.essenceTravail > 0 && r.essenceTravail < 500);
  egal(r.beneficeReel, Math.round((530 - 20 - r.essenceTravail) * 100) / 100);
});
