// TESTS CARTES CADEAUX (19 nov. 2026) : validité 1 an, toutes les activités, non remboursable
import { test, egal, vrai, section } from "./outils.mjs";
import { champsActivation, dateExpiration, estExpiree, finValidite, statutAffiche, utiliserCarte, messageOffrir } from "../src/pricing/cartesCadeaux.js";

section("Cartes cadeaux : validité 1 an");
test("date d'expiration = un an plus tard", () => {
  egal(dateExpiration("2026-11-19"), "2027-11-19");
  egal(dateExpiration("2028-02-29"), "2029-02-28");
  egal(dateExpiration("pas une date"), "");
});
test("activation : statut, date de paiement et fin de validité", () => {
  egal(champsActivation("2026-11-19"), { statut: "active", payeeLe: "2026-11-19", expireLe: "2027-11-19" });
});
test("ancienne carte sans expireLe : calculée depuis payeeLe", () => {
  egal(finValidite({ payeeLe: "2026-11-18" }), "2027-11-18");
  egal(finValidite({ statut: "a_payer" }), "");
});
test("expirée seulement après le dernier jour", () => {
  const c = { statut: "active", solde: 100, ...champsActivation("2026-11-19") };
  egal(estExpiree(c, "2027-11-19"), false);
  egal(estExpiree(c, "2027-11-20"), true);
  egal(statutAffiche(c, "2027-11-20"), "expiree");
  egal(statutAffiche(c, "2027-01-01"), "active");
});
test("utilisation refusée après expiration, acceptée avant", () => {
  const c = { statut: "active", solde: 200, montant: 200, ...champsActivation("2026-11-19") };
  vrai(utiliserCarte(c, 50, "2027-11-20").erreur.includes("expiré"));
  const u = utiliserCarte(c, 50, "2027-11-19", "r1");
  egal([u.solde, u.statut], [150, "active"]);
});
test("utilisation partielle puis totale", () => {
  const c = { statut: "active", solde: 100, ...champsActivation("2026-11-19") };
  const u1 = utiliserCarte(c, 60, "2026-12-01", "a");
  const u2 = utiliserCarte({ ...c, ...u1 }, 40, "2026-12-02", "b");
  egal([u2.solde, u2.statut, u2.utilisations.length], [0, "utilisee", 2]);
  vrai(utiliserCarte({ ...c, ...u2 }, 1, "2026-12-03").erreur);
});
test("message à offrir : date de validité", () => {
  const m = messageOffrir({ pourNom: "Léa", acheteurNom: "Rebecca", montant: 100, code: "RS-AAAA-BBBB", ...champsActivation("2026-11-19") }, "ID");
  vrai(m.includes("19/11/2027"));
});
