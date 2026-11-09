// TESTS STATISTIQUES COMPAREES ET RAPPORTS (Lot C, C4 et C5) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as St from "../src/pricing/statistiques.js";

const J = "uid-j";
const c = (id, date, prix, extra = {}) => ({ id, service: "livraison", serviceTitre: "Livraison", date, heure: "10:00", statut: "terminee", prixFinal: prix, nom: "Client " + id, ...extra });
const D = {
  demandes: [c("a", "2026-11-03", 60, { pourboire: 5 }), c("b", "2026-11-05", 100, { attribueA: J }), c("c", "2026-10-10", 80), c("d", "2026-11-06", 170, { service: "transport", serviceTitre: "Transport privé" }), c("e", "2026-11-07", 50, { statut: "annulee" }), c("f", "2025-11-12", 40)],
  mouvements: [
    { kind: "paiement", resId: "a", date: "2026-11-03", montant: 65, moyen: "Bit" },
    { kind: "paiement", resId: "b", date: "2026-11-05", montant: 100, moyen: "Espèces", operateur: J },
    { kind: "annulation", resId: "e", date: "2026-11-07", fraisRetenus: 10 },
    { kind: "remboursement_effectue", resId: "e", date: "2026-11-08", montant: 5, moyen: "Bit" },
  ],
  depenses: [{ date: "2026-11-04", categorie: "Carburant", montant: 100 }, { date: "2026-11-04", categorie: "Carburant", montant: 20, operateur: J }],
  autresRevenus: [{ source: "Wolt", debut: "2026-11-01", fin: "2026-11-07", revenu: 300, operateur: J }],
};
const NOV = { debut: "2026-11-01", fin: "2026-11-30" };

section("Statistiques : periodes");
test("annee", () => egal(St.periode("annee", "2026-11-09"), { debut: "2026-01-01", fin: "2026-12-31" }));
test("mois precedent", () => egal(St.periode("mois", St.referenceComparee("mois", "2026-11-09", "precedente")), { debut: "2026-10-01", fin: "2026-10-31" }));
test("meme mois l'an dernier", () => egal(St.periode("mois", St.referenceComparee("mois", "2026-11-09", "anneeDerniere")), { debut: "2025-11-01", fin: "2025-11-30" }));
test("29 fevrier -> 28 fevrier", () => egal(St.referenceComparee("mois", "2028-02-29", "anneeDerniere"), "2027-02-28"));

section("Statistiques : indicateurs");
const tous = St.indicateursPeriode(NOV, { ...D });
test("global novembre : CA 60+100+170+10 (annulation), 3 courses", () => egal([tous.chiffreAffaires, tous.courses], [340, 3]));
test("global : encaisse 65+100-5, depenses 120, Wolt 300, benefice 520", () => egal([tous.encaisse, tous.depenses, tous.wolt, tous.benefice], [160, 120, 300, 520]));
const reb = St.indicateursPeriode(NOV, { ...D, personne: "rebecca" });
test("Rebecca : ses courses, ses depenses, pas le Wolt de Jeremy", () => egal([reb.chiffreAffaires, reb.depenses, reb.wolt, reb.pourboires], [240, 100, 0, 5]));
const jer = St.indicateursPeriode(NOV, { ...D, personne: J });
test("Jeremy : 100 de CA, 20 de depenses, 300 de Wolt", () => egal([jer.chiffreAffaires, jer.depenses, jer.wolt, jer.benefice], [100, 20, 300, 380]));
test("activite transport seule : 170, sans depenses ni Wolt", () => egal([St.indicateursPeriode(NOV, { ...D, activite: "transport" }).chiffreAffaires, St.indicateursPeriode(NOV, { ...D, activite: "transport" }).depenses], [170, 0]));
const cmp = St.comparer({ type: "mois", ref: "2026-11-09", ...D });
test("comparaison avec octobre : 340 contre 80 (+325 %)", () => {
  const l = cmp.lignes.find((x) => x.id === "chiffreAffaires");
  egal([l.a, l.b, l.variation], [340, 80, 325]);
});
test("variation sans base = rien", () => egal(St.variation(10, 0), null));
test("par activite : pas de ligne benefice", () => vrai(!St.comparer({ type: "mois", ref: "2026-11-09", activite: "coursier", ...D }).lignes.some((l) => l.id === "benefice")));

section("Rapports CSV");
const csv = St.csvCourses(NOV, { ...D, noms: { rebecca: "Rebecca", [J]: "Jérémy" } });
test("courses : en-tete, BOM, point-virgule, virgule decimale", () => {
  vrai(csv.charCodeAt(0) === 0xfeff, "BOM");
  const l = csv.slice(1).split("\r\n");
  egal([l.length, l[0].split(";")[0], l[1]], [5, "Date", "2026-11-03;10:00;Livraison;coursier;Client a;Terminée;60;5;Rebecca"]);
});
test("annulee : argent garde", () => vrai(csv.includes("Annulée;10;0;Rebecca")));
test("encaissements de Jeremy seulement", () => {
  const l = St.csvEncaissements(NOV, { ...D, personne: J, noms: { [J]: "Jérémy" } }).slice(1).split("\r\n");
  egal(l.slice(1), ["2026-11-05;Paiement;Espèces;100;Livraison;2026-11-05;Client b;Jérémy;"]);
});
test("remboursement negatif", () => vrai(St.csvEncaissements(NOV, D).includes("Remboursement;Bit;-5")));
test("guillemets proteges", () => egal(St.versCsv(["a"], [['x;"y"']]).slice(1), 'a\r\n"x;""y"""'));
test("nom de fichier", () => egal(St.nomRapport("courses", NOV), "rebecca-services-courses-2026-11-01_2026-11-30.csv"));
