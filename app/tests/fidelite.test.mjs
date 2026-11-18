// TESTS FIDÉLITÉ (18 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { rangFidelite, etatFidelite, champsOffrir } from "../src/pricing/fidelite.js";

section("Fidélité : 10e course offerte");
const base = (i, extra = {}) => ({ id: "c" + i, service: "livraison", statut: "terminee", telephone: "054-111-2222", date: `2026-10-${String(i).padStart(2, "0")}`, heure: "10:00", prixFinal: 60, ...extra });
const neuf = Array.from({ length: 9 }, (_, i) => base(i + 1));
test("rang et 10e offerte", () => {
  const d = base(20, { statut: "acceptee" });
  egal(rangFidelite(d, [...neuf, d]), 10);
  egal(etatFidelite(d, [...neuf, d]).offerte, true);
  egal(etatFidelite(neuf[2], neuf).encore, 7);
});
test("ne comptent pas", () => {
  egal(rangFidelite(base(5, { service: "ramassage" }), neuf), null);
  egal(rangFidelite(base(21, { statut: "annulee" }), neuf), null);
  const autre = base(22, { telephone: "052-999-8888", statut: "acceptee" });
  egal(rangFidelite(autre, [...neuf, autre]), 1);
});
test("offrir = prix entier déduit", () => {
  egal(champsOffrir({ prixFinal: 60, ajustement: 10 }), { ajustement: -50, fideliteOfferte: true });
});
