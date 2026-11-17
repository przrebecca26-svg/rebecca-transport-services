// TESTS « PARTS FAITES » : aller-retour compté trajet par trajet (17 nov. 2026)
import { test, egal, section } from "./outils.mjs";
import { partsFaites, montantFait, faitDansPeriode } from "../src/pricing/parts.js";
import { indicateurs } from "../src/pricing/tableauBord.js";

section("Aller-retour compté trajet par trajet");
const ar = (o = {}) => ({ id: "a", service: "aeroport", statut: "acceptee", date: "2026-11-17", prixFinal: 500, details: { typeTrajet: "ar", dateRetour: "2026-11-24" }, ...o });
const jour = { debut: "2026-11-17", fin: "2026-11-17" };
test("aller fait : moitié du prix le jour de l'aller", () => {
  egal(partsFaites(ar()), []);
  egal(partsFaites(ar({ allerFaitA: "09:35" })), [{ date: "2026-11-17", montant: 250, trajet: "aller" }]);
  egal(montantFait(ar({ statut: "terminee" })), 500);
  egal(faitDansPeriode(ar({ statut: "terminee" }), { debut: "2026-11-24", fin: "2026-11-24" }), true);
});
test("tableau de bord : CA de l'aller aujourd'hui, payé d'avance dans l'argent reçu", () => {
  const i = indicateurs({ demandes: [ar({ allerFaitA: "09:35" })], mouvements: [{ resId: "a", kind: "paiement", montant: 500, date: "2026-11-17" }], periode: jour });
  egal([i.caRealise, i.prestationsTerminees, i.encaisse], [250, 1, 500]);
});
