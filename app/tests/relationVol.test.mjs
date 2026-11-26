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
import { avisADemander } from "../src/pricing/finCourse.js";
test("pas de demande d'avis pour une course Famille", () => {
  const d = { statut: "terminee", service: "aeroport", date: "2026-11-25" };
  egal([avisADemander([d], "2026-11-26").length, avisADemander([{ ...d, prixFamille: true }], "2026-11-26").length], [1, 0]);
});
import { planTacheVol } from "../src/pricing/planVol.js";
import { etapesVol, lireVolTache } from "../src/pricing/tournee.js";
section("Calendrier : tâche Transport / aéroport avec un vol (26 nov. 2026, 18h27)");
const routes = { maisonAdresse: 10, adresseAeroport: 45, maisonAeroport: 45 };
test("je l'amène : prise 5h00, 10 min jusqu'à chez elle, 45 min jusqu'à l'aéroport, vol 8h30 : partir 4h50, aéroport 5h45, retour 6h30", () => {
  const p = planTacheVol({ sens: "vers", date: "2026-11-29", heure: "05:00", heureVol: "08:30" }, routes, t0);
  egal([p.partir, p.prise, p.depose, p.retour, p.avance, p.alerte, p.conseil], ["04:50", "05:00", "05:45", "06:30", 165, "court", "04:45"]);
});
test("je la récupère : atterrissage 15h00, là à 15h30 : partir 14h45, déposée 16h30 (15 min bagages + 45), retour 16h40", () => {
  const p = planTacheVol({ sens: "depuis", date: "2026-12-01", heure: "15:30", heureVol: "15:00" }, routes, t0);
  egal([p.partir, p.prise, p.depose, p.retour, p.ecart, p.alerte], ["14:45", "15:30", "16:30", "16:40", 30, ""]);
});
test("je la récupère avant l'atterrissage : alerte et heure conseillée", () => {
  const p = planTacheVol({ sens: "depuis", date: "2026-12-01", heure: "14:50", heureVol: "15:00" }, routes, t0);
  egal([p.alerte, p.conseil], ["avant", "15:30"]);
});
test("elle habite chez moi (0 min) : je pars à l'heure où je la prends", () => {
  const p = planTacheVol({ sens: "vers", date: "2026-11-29", heure: "05:00", heureVol: "" }, { ...routes, maisonAdresse: 0 }, t0);
  egal([p.partir, p.avance, p.alerte], ["05:00", null, ""]);
});
test("sans heure ou sans temps de route : pas de plan", () => {
  egal([planTacheVol({ sens: "vers", heure: "" }, routes, t0), planTacheVol({ sens: "vers", heure: "05:00" }, null, t0)], [null, null]);
});
test("4 étapes dans ma journée : partir, prendre, déposer à l'aéroport, de retour", () => {
  const x = { id: "a1", type: "transport", pour: "Maman", lieu: { label: "Chez Maman", lat: 32.3, lon: 34.86 }, vol: { sens: "depuis", numero: "ly316", heureVol: "15:00", terminal: "3", partir: "14:45", prise: "15:30", depose: "16:30", retour: "16:40" } };
  const e = etapesVol(x);
  egal(e.map((y) => y.heure), ["14h45", "15h30", "16h30", "16h40"]);
  vrai(e[1].texte.includes("Récupérer Maman à l'aéroport") && e[1].texte.includes("LY316") && e[1].texte.includes("T3"));
  egal(e.map((y) => y.cle), ["partir@a1", "prise@a1", "depose@a1", "retour@a1"]);
});
test("fiche du vol incomplète ou mauvais sens : ignorée", () => {
  egal([lireVolTache({ sens: "vers", partir: "05:00" }), lireVolTache({ sens: "x", partir: "05:00", prise: "05:10", depose: "06:00", retour: "07:00" }), etapesVol({ type: "transport" }).length], [null, null, 0]);
});
