// TESTS « PARTS FAITES » : aller-retour compté trajet par trajet (17 nov. 2026)
import { test, egal, section } from "./outils.mjs";
import { partsFaites, montantFait, faitDansPeriode } from "../src/pricing/parts.js";
import { indicateurs } from "../src/pricing/tableauBord.js";

section("Aller-retour compté trajet par trajet");
const ar = (o = {}) => ({ id: "a", service: "aeroport", statut: "acceptee", date: "2026-11-17", prixFinal: 500, details: { typeTrajet: "ar", dateRetour: "2026-11-24" }, ...o });
const jour = { debut: "2026-11-17", fin: "2026-11-17" };
test("aller fait : moitié du prix le jour de l'aller", () => {
  egal(partsFaites(ar()), []);
  egal(partsFaites(ar({ allerFaitA: "09:35" }))[0].montant, 250);
  egal(montantFait(ar({ statut: "terminee" })), 500);
  egal(faitDansPeriode(ar({ statut: "terminee" }), { debut: "2026-11-24", fin: "2026-11-24" }), true);
});
test("tableau de bord : CA de l'aller aujourd'hui, payé d'avance dans l'argent reçu", () => {
  const i = indicateurs({ demandes: [ar({ allerFaitA: "09:35" })], mouvements: [{ resId: "a", kind: "paiement", montant: 500, date: "2026-11-17" }], periode: jour });
  egal([i.caRealise, i.prestationsTerminees, i.encaisse], [250, 1, 500]);
});

test("aller 250 / retour 260 d'après le détail du devis", () => {
  const detail = "• Trajet : Aller-retour\n\nDétail du tarif :\n• Trajet aller : 250 ₪\n• Trajet retour : 250 ₪\n• Bagages en soute au retour : 1 x 10 ₪ : 10 ₪\n• Supplément 2e passager : offert 🎁";
  const d = ar({ prixFinal: 510, allerFaitA: "09:35", details: { typeTrajet: "ar", dateRetour: "2026-11-24", detailDevis: detail } });
  egal([partsFaites(d).length, partsFaites(d)[0].montant, partsFaites(d)[0].date], [1, 250, "2026-11-17"]);
  egal(partsFaites({ ...d, statut: "terminee" })[1].montant, 260);
});

test("cases séparées : base par domaine, suppléments et ajouts, pourboires", () => {
  const detail = "Détail du tarif :\n• Trajet aller : 250 ₪\n• Trajet retour : 250 ₪\n• Bagages en soute au retour : 1 x 10 ₪ : 10 ₪";
  const d = ar({ prixFinal: 510, statut: "terminee", pourboire: 10, ajustement: -20, details: { typeTrajet: "ar", dateRetour: "2026-11-17", detailDevis: detail } });
  const i = indicateurs({ demandes: [d, { id: "n", service: "nails", statut: "terminee", date: "2026-11-17", prixFinal: 120 }], mouvements: [], periode: jour });
  egal([i.parDomaine.transport, i.parDomaine.beaute, i.supplements, i.pourboires, i.caRealise], [500, 120, -10, 10, 610]);
});
