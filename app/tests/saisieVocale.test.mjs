// TESTS SAISIE VOCALE (19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { comprendreEncaissement, comprendrePlein, comprendreDepense, comprendreDateHeure, normaliser } from "../src/pricing/saisieVocale.js";

section("Saisie vocale : encaissement");
const enc = (t) => { const r = comprendreEncaissement(t); return [r.recu, r.pourboire, r.ajout, r.moyen]; };
test("exemples de Rebecca", () => {
  egal(enc("J'ai encaissé 85 ₪ en espèces."), ["85", "", "", "Espèces"]);
  egal(enc("Course terminée, 85 shekels encaissés en espèces, 5 shekels de pourboire"), ["85", "5", "", "Espèces"]);
  egal(enc("Ajoute 5 ₪ de pourboire à cette course."), ["", "5", "", ""]);
});
test("ordre et formes différentes", () => {
  egal(enc("pourboire de 10 et 120 par Bit"), ["120", "10", "", "Bit"]);
  egal(enc("60,50 shekels Revolut"), ["60.5", "", "", "Revolut"]);
  egal(enc("cent par PayPal"), ["100", "", "", "PayPal"]);
  egal(enc("80 en cash avec un pourboire de cinq"), ["80", "5", "", "Espèces"]);
  egal(enc("150 par carte, 20 de supplément"), ["150", "", "20", "Carte bancaire"]);
  egal(enc("100 espèces remise de 10"), ["100", "", "-10", "Espèces"]);
});
test("rien compris : message", () => { vrai(comprendreEncaissement("merci beaucoup").erreur); vrai(comprendreEncaissement("").erreur); });
test("résumé lisible", () => egal(comprendreEncaissement("85 espèces 5 de pourboire").resume, "Reçu 85 ₪ · Espèces · Pourboire 5 ₪"));

section("Saisie vocale : plein, dépense, date");
test("plein", () => {
  const r = comprendrePlein("Note un plein d'essence de 240 ₪, 31 litres, compteur 85 661");
  egal([r.montant, r.litres, r.compteur], ["240", "31", "85661"]);
  egal(comprendrePlein("plein 200").montant, "200");
  vrai(comprendrePlein("plein").erreur);
});
test("dépense : catégorie devinée", () => {
  egal(comprendreDepense("péage route 6 25 shekels").categorie, "Péages");
  egal(comprendreDepense("parking Pango 12").montant, "12");
  egal(comprendreDepense("parking Pango 12").categorie, "Stationnement");
  egal(comprendreDepense("lavage voiture 40").categorie, "Entretien du véhicule");
  egal(comprendreDepense("cadeau 30").categorie, "Autres frais");
});
test("date et heure", () => {
  egal(comprendreDateHeure("Ajoute un rendez-vous personnel demain à 10 heures", "2026-11-19"), { date: "2026-11-20", heure: "10:00" });
  egal(comprendreDateHeure("dimanche 14h30", "2026-11-19"), { date: "2026-11-22", heure: "14:30" });
  egal(comprendreDateHeure("jeudi à 9h", "2026-11-19"), { date: "2026-11-26", heure: "09:00" });
  egal(comprendreDateHeure("ce soir 8 heures", "2026-11-19"), { date: "2026-11-19", heure: "20:00" });
  egal(comprendreDateHeure("le 3 à 11h", "2026-11-19"), { date: "2026-12-03", heure: "11:00" });
});
test("normaliser", () => egal(normaliser("1 200,50 ₪"), "1200.50 shekels"));
