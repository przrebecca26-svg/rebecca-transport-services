// TESTS ABONNEMENT MENSUEL DU RAMASSAGE (18 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { abonnementsDus, courseAbonnement, idAbonnement, messageAbonnement } from "../src/pricing/abonnement.js";

section("Abonnement mensuel du ramassage");
const f = { id: "fam1", nom: "Alexia Dahan", telephone: "054-111-2222", abonnementMois: 1200, jourPaiement: 5, enfants: [{ prenom: "Joy" }, { prenom: "Liel" }] };
test("dû à partir du jour de paiement", () => {
  egal(abonnementsDus([f], "2026-11-04"), []);
  egal(abonnementsDus([f], "2026-11-05")[0].id, "abo-fam1-2026-11");
  egal(abonnementsDus([{ ...f, abonnementMois: 0 }], "2026-11-20"), []);
  egal(abonnementsDus([{ ...f, au: "2026-10-31" }], "2026-11-20"), []);
});
test("ligne à encaisser et message", () => {
  const c = courseAbonnement(f, "2026-11");
  egal(c.prixFinal, 1200);
  egal(c.date, "2026-11-05");
  egal(c.statut, "terminee");
  egal(courseAbonnement({ ...f, telephone: "" }, "2026-11"), null);
  vrai(messageAbonnement(f, "2026-11", 1200, "https://x/#/paye/abo").includes("novembre"));
  egal(idAbonnement("fam 1", "2026-11"), "abo-fam1-2026-11");
});
