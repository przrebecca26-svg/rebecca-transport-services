// TESTS RESTAURANTS ET COMMERCANTS PARTENAIRES, version simple (19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { semaineDe, semaineDecalee, prixPro, releveSemaine, messageReleve, paiementsSemaine, contratDe } from "../src/pricing/commercants.js";

section("Commerçants partenaires");
test("semaine du dimanche au samedi, paiement le dimanche", () => {
  egal(semaineDe("2026-11-19"), { debut: "2026-11-15", fin: "2026-11-21", paiementLe: "2026-11-22" });
  egal(semaineDe("2026-11-15").debut, "2026-11-15");
  egal(semaineDecalee(semaineDe("2026-11-19"), -1).debut, "2026-11-08");
});
test("prix pro par distance", () => {
  const c = contratDe({});
  egal([prixPro(c, 2), prixPro(c, 5), prixPro(c, 8), prixPro(c, 0), prixPro(c, 2, true)], [35, 45, null, null, 20]);
  egal(contratDe({ contratPro: { jusqua3: 30 } }).jusqua3, 30);
});
const liv = (id, date, prix, extra = {}) => ({ id, service: "livraison", statut: "terminee", date, heure: "19:30", prixFinal: prix, nom: "Client", details: { livraison: { label: "Rue Herzl 10, Netanya" } }, ...extra });
test("relevé : livraisons terminées de la semaine, dû, payé, reste", () => {
  const liste = [liv("a", "2026-11-16", 35), liv("b", "2026-11-18", 45), liv("c", "2026-11-23", 35), liv("d", "2026-11-17", 35, { statut: "annulee" })];
  const mv = [{ kind: "paiement", resId: "a", date: "2026-11-16", montant: 35 }];
  const r = releveSemaine(liste, mv, semaineDe("2026-11-19"));
  egal([r.nb, r.du, r.paye, r.reste], [2, 80, 35, 45]);
  egal(paiementsSemaine(r, "Bit", "2026-11-22"), [{ kind: "paiement", resId: "b", date: "2026-11-22", montant: 45, moyen: "Bit" }]);
  const m = messageReleve("Pizza Centrale", r, { moyen: "Bit" });
  vrai(m.includes("Reste à payer : 45 ₪, le 22/11/2026 par Bit"));
  vrai(m.includes("Rue Herzl 10"));
});
