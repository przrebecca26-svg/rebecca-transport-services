// TESTS « SUITE CLIENTES » (17 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as S from "../src/pricing/suiteClient.js";

section("Suite clientes : beauté, Epoxy, parrainage, relevé, paiement, suivi, Wolt, avis");
test("beauté : rappel de demain, prochain rendez-vous", () => {
  const rdv = { id: "b", service: "nails", serviceTitre: "Nails", nom: "Sarah", statut: "acceptee", date: "2026-11-18", heure: "10:00" };
  egal(S.rappelsRdvDemain([rdv, { ...rdv, id: "c", service: "aeroport" }], "2026-11-17").length, 1);
  vrai(S.messageRappelRdv(rdv).includes("demain") && S.messageRappelRdv(rdv).includes("rebeccaservices.com"));
  egal(S.dateProchainRdv(rdv), "2026-12-09");
  vrai(S.messageReprendreRdv(rdv).includes("prochain rendez-vous conseillé"));
});
test("Epoxy : messages et relance", () => {
  vrai(S.messageCommande({ nom: "Lia", produit: "Plateau" }, "prete").includes("Plateau est prête"));
  egal(S.relancesEpoxy([{ statut: "terminée", livreeLe: "2026-09-01" }, { statut: "terminée", livreeLe: "2026-11-01" }], "2026-11-17").length, 1);
});
test("parrainage", () => {
  egal(S.lireParrain("https://x/?parrain=abcDEF123"), "abcDEF123");
  vrai(S.lienParrainage("u12345").endsWith("/?parrain=u12345"));
  vrai(S.cadeauAOffrir({ statut: "terminee", details: { parrain: "p1" }, uid: "u2" }));
  vrai(!S.cadeauAOffrir({ statut: "terminee", details: { parrain: "p1" }, uid: "p1" }));
});
test("relevé du mois", () => {
  const c = [{ id: "1", date: "2026-11-03", statut: "terminee", prixFinal: 70, serviceTitre: "Ramassage" }, { id: "2", date: "2026-11-04", statut: "terminee", prixFinal: 70, serviceTitre: "Ramassage" }, { id: "3", date: "2026-10-30", statut: "terminee", prixFinal: 70 }];
  const r = S.releveDuMois("Alexia Dahan", c, [{ resId: "1", kind: "paiement", montant: 70 }], "2026-11", 0);
  egal([r.nb, r.total, r.regle, r.reste], [2, 140, 70, 70]);
  vrai(r.texte.includes("Reste à régler : 70 ₪"));
});
test("paiement en ligne, suivi, Wolt, avis", () => {
  egal(S.messagePaiement({ nom: "A" }, 100, {}), "");
  vrai(S.messagePaiement({ nom: "A" }, 100, { bit: "0501234567", paypal: "https://paypal.me/rebecca" }).includes("paypal.me/rebecca/100ILS"));
  vrai(S.messagePaiement({ nom: "A" }, 50, { revolut: "https://revolut.me/rebecca" }).includes("Revolut : https://revolut.me/rebecca"));
  egal(S.normaliserRevolut("@rebecc2kl2"), "https://revolut.me/rebecc2kl2");
  egal(S.normaliserRevolut("rebecc2kl2"), "https://revolut.me/rebecc2kl2");
  egal(S.normaliserRevolut("n importe quoi !"), "");
  egal(S.avancementDe({ chrono: { simple: { depart: "08:00", prise: "08:20" } } }), "Prise en charge à 08h20");
  egal(S.woltParHeure([{ id: "w", debut: "2026-11-02", revenu: 300 }], { w: 5 }, "2026-11"), { lignes: 1, heures: 5, revenu: 300, parHeure: 60 });
  egal(S.avisPublic({ id: "a", etoiles: 5, commentaire: " Top " }, "Naomie Cohen").prenom, "Naomie");
  egal(S.lireAvisPublics("oops"), []);
});

test("message d'acompte avec le lien PayPal", () => {
  const m = S.messageAcompte({ nom: "Naomie Cohen", date: "2026-11-24", heure: "18:00" }, 102, { paypal: "https://www.paypal.com/ncp/payment/WKZKM3DG5B6PS" }, 48);
  vrai(m.includes("Pour bloquer votre créneau du mardi 24 novembre à 18h00, merci de régler l'acompte de 102 ₪ dans les 48 h."));
  vrai(m.includes("PayPal : https://www.paypal.com/ncp/payment/WKZKM3DG5B6PS"));
  vrai(S.messageAcompte({ nom: "A" }, 20, {}).includes("Répondez-moi"));
});

test("« J'ai payé » : lien de la page et déclaration", () => {
  const l = S.lienPaye({ id: "abc123", nom: "Naomie Cohen" }, 102, "acompte");
  vrai(l.endsWith("/#/paye/abc123/102/acompte/Naomie"));
  egal(S.lireLienPaye(l.slice(l.indexOf("#"))), { resId: "abc123", montant: 102, sorte: "acompte", prenom: "Naomie" });
  egal(S.lireLienPaye("#/paye/x/0/acompte"), null);
  vrai(S.messageAcompte({ id: "abc123", nom: "Naomie" }, 102, {}).includes("Payer et me prévenir en un clic"));
  vrai(S.declarationValide({ resId: "abc123", montant: 102, moyen: "Bit", sorte: "acompte", prenom: "Naomie" }));
  vrai(!S.declarationValide({ resId: "abc123", montant: 102, moyen: "Carte", sorte: "acompte", prenom: "" }));
});
