// COURSE AJOUTÉE DEPUIS LE CALENDRIER (26 nov. 2026) : Cliente / Ami / Famille, et plan d'une course aéroport
import { test, egal, vrai, section } from "./outils.mjs";
import { champsRelation, prixAccepte, prixPropose } from "../src/pricing/relation.js";
import { planVol, volDuJour } from "../src/pricing/planVol.js";
section("Calendrier : Cliente, Ami, Famille");
test("prix proposé : cliente = devis, ami -20 % arrondi, famille 0", () => {
  egal([prixPropose(255, "cliente"), prixPropose(255, "ami", 20), prixPropose(255, "famille")], [255, 204, 0]);
});
test("prix accepté : 0 seulement pour la famille", () => {
  egal([prixAccepte(0, "famille"), prixAccepte(0, "ami"), prixAccepte(0, "cliente"), prixAccepte(30, "ami")], [true, false, false, true]);
});
test("champs écrits : rien pour une cliente, prixAmi pour ami et famille", () => {
  egal([champsRelation("cliente"), champsRelation("ami"), champsRelation("famille")], [{}, { relation: "ami", prixAmi: true }, { relation: "famille", prixAmi: true, prixFamille: true }]);
});
section("Calendrier : plan d'une course aéroport");
const t0 = { planVol: { avanceConseillee: 180, apresAtterrissage: 30 }, circulation: { plages: [] } };
test("départ dimanche 5h, 30 min de route, vol 8h30 : arrivée 5h30, 3 h d'avance, retour 6h00", () => {
  const p = planVol({ direction: "vers", date: "2026-11-29", heure: "05:00", heureVol: "08:30" }, 30, t0);
  egal([p.arrivee, p.avance, p.fin, p.alerte], ["05:30", 180, "06:00", ""]);
});
test("trop juste : vol 7h00 -> alerte « court », heure conseillée 3h30", () => {
  const p = planVol({ direction: "vers", date: "2026-11-29", heure: "05:00", heureVol: "07:00" }, 30, t0);
  egal([p.avance, p.alerte, p.conseil], [90, "court", "03:30"]);
});
test("arrivée : là 40 min après l'atterrissage, dépose après la route", () => {
  const p = planVol({ direction: "depuis", date: "2026-11-29", heure: "15:00", heureVol: "14:20" }, 45, t0);
  egal([p.ecart, p.alerte, p.depose], [40, "", "15:45"]);
  vrai(/40 min après/.test(p.texte));
});
test("tableau de l'aéroport : le bon vol, le bon jour, le bon sens", () => {
  const lignes = [
    { CHAORD: "D", CHFLTN: "3450", CHOPER: "TO", CHSTOL: "2026-11-29T08:30:00", CHTERM: 3, CHLOC1T: "PARIS" },
    { CHAORD: "D", CHFLTN: "3450", CHOPER: "TO", CHSTOL: "2026-11-30T08:30:00", CHTERM: 3 },
    { CHAORD: "A", CHFLTN: "3451", CHOPER: "TO", CHSTOL: "2026-11-29T14:20:00", CHTERM: 3 },
  ];
  egal(volDuJour(lignes, "TO3450", "2026-11-29", "vers"), { heure: "08:30", terminal: "3", ville: "PARIS" });
  egal(volDuJour(lignes, "TO3450", "2026-11-29", "depuis"), null);
});
