// TESTS « QUI FAIT LA COURSE » ET VEHICULES (Lot J, seance J3) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A } from "./donnees.mjs";
import * as Q from "../src/pricing/quiFait.js";

const J = "uid-jeremy";
const JEREMY = { id: J, nom: "Jérémy", actif: true, modes: ["scooter", "velo"], services: ["livraison", "transport"], telephone: "0500000001" };
const MEMBRES = Q.membresDe({ fiches: [JEREMY, { id: "uid-x", nom: "Ancien", actif: false }] });
const mission = (id, extra = {}) => ({ id, service: "livraison", serviceTitre: "Livraison", date: "2026-11-10", heure: "10:00", statut: "acceptee", kmEstime: 4, prixFinal: 60, nom: "Client Test", telephone: "0500000000", details: { recuperation: A.netanya, livraison: A.netanya2 }, ...extra });

section("Qui fait : equipe");
test("Rebecca d'abord, membres actifs seulement", () => egal(MEMBRES.map((m) => m.id), ["rebecca", J]));
test("Rebecca : voiture par defaut", () => egal(MEMBRES[0].modes, ["voiture"]));
test("Rebecca : ses modes coches", () => egal(Q.membresDe({ ficheRebecca: { id: "rebecca", modes: ["voiture", "scooter"] } })[0].modes, ["voiture", "scooter"]));
test("initiales", () => egal([Q.initiale(MEMBRES, "rebecca"), Q.initiale(MEMBRES, J)], ["R", "J"]));
test("ancienne course sans attribution = Rebecca", () => egal(Q.attribueA({ id: "a" }), "rebecca"));

section("Qui fait : filtre et transfert");
const DEM = [mission("a"), mission("b", { attribueA: J }), mission("c", { attribueA: "rebecca" })];
test("filtre Moi (Rebecca)", () => egal(Q.filtrerPersonne(DEM, "moi", "rebecca").map((d) => d.id), ["a", "c"]));
test("filtre Moi (Jeremy)", () => egal(Q.filtrerPersonne(DEM, "moi", J).map((d) => d.id), ["b"]));
test("filtre Tous", () => egal(Q.filtrerPersonne(DEM, "tous", J).length, 3));
test("enchainement sur l'agenda de la personne", () => egal(Q.coursesDeLaPersonne(DEM, J).map((d) => d.id), ["b"]));
test("transfert direct vers Jeremy : vehicule remis a zero", () => egal(Q.attribution(DEM[0], J, "rebecca", 5).maj, { attribueA: J, vehicule: null }));
test("transfert garde une trace", () => egal(Q.attribution(DEM[0], J, "rebecca", 5).trace, { de: "rebecca", vers: J, leMs: 5 }));
test("deja a cette personne : rien a changer", () => egal(Q.attribution(DEM[1], J, J).maj, null));
test("course terminee : ne change plus de main", () => vrai(!!Q.attribution(mission("t", { statut: "terminee" }), J, "rebecca").erreur));
test("message de transfert", () => {
  const m = Q.messageTransfert(DEM[0], "Rebecca", "Jérémy");
  vrai(m.includes("Bonjour Jérémy") && m.includes("10/11/2026 à 10:00") && m.includes("Prix : 60 ₪") && m.includes("— Rebecca"), m);
});

section("Qui fait : vehicules");
test("voiture de Rebecca par defaut tant qu'elle n'a rien rempli", () => egal(Q.vehiculesEffectifs([]).map((v) => [v.id, v.type, v.consommationL100]), [["voiture-rebecca", "voiture", 9]]));
test("sa voiture enregistree remplace celle par defaut", () => egal(Q.vehiculesEffectifs([{ id: "v1", type: "voiture", proprietaire: "rebecca" }]).map((v) => v.id), ["v1"]));
test("courses de Rebecca sans vehicule = sa voiture ; celles de Jeremy = aucun", () => egal(Q.avecVehicule(DEM, []).map((d) => d.vehicule), ["voiture-rebecca", undefined, "voiture-rebecca"]));
const VEH = [
  { id: "scoot", nom: "Scooter de Jérémy", type: "scooter", proprietaire: J, actif: true, ...Q.MODELES_VEHICULE.scooter },
  { id: "velo", nom: "Vélo de Jérémy", type: "velo", proprietaire: J, actif: true, ...Q.MODELES_VEHICULE.velo },
];
test("conseil pour Jeremy : velo d'abord sur 4 km", () => egal(Q.conseilPour(JEREMY, mission("m", { attribueA: J }), { vehicules: VEH, demandes: DEM })[0].vehicule.id, "velo"));
test("conseil : voiture de Rebecca non pretee = pas proposee", () => vrai(!Q.conseilPour({ ...JEREMY, modes: ["voiture"] }, mission("m", { attribueA: J, service: "transport" }), { vehicules: VEH, demandes: DEM }).length));
test("conseil : voiture pretee mais prise par Rebecca a 10h", () => {
  const voiture = { id: "v1", nom: "Voiture de Rebecca", type: "voiture", proprietaire: "rebecca", partageAvec: [J], actif: true, ...Q.MODELES_VEHICULE.voiture };
  const c = Q.conseilPour({ ...JEREMY, modes: ["voiture"] }, mission("m", { attribueA: J, service: "transport", heure: "10:30" }), { vehicules: [voiture], demandes: DEM });
  egal([c.length, c[0].possible], [1, false]);
});
test("Rebecca : sa voiture conseillee", () => egal(Q.conseilPour(MEMBRES[0], mission("m"), { vehicules: [], demandes: [] })[0].vehicule.id, "voiture-rebecca"));

section("Qui fait : fiches vehicules");
test("vehicule neuf pre-rempli", () => egal(Q.vehiculeNeuf("scooter", J, "Jérémy").consommationL100, 3));
test("validation : nom obligatoire", () => vrai(!!Q.validerVehicule({ ...Q.vehiculeNeuf("velo", J, "J"), nom: "" }).erreur));
test("validation : autonomie du velo", () => egal(Q.validerVehicule({ ...Q.vehiculeNeuf("velo", J, "Jérémy"), autonomieKm: "40" }).vehicule.autonomieKm, 40));
test("validation : autonomie vide = prudence", () => egal(Q.validerVehicule({ ...Q.vehiculeNeuf("velo", J, "Jérémy"), autonomieKm: "" }).vehicule.autonomieKm, null));
test("validation : consommation absurde", () => vrai(!!Q.validerVehicule({ ...Q.vehiculeNeuf("voiture", "rebecca", "Rebecca"), consommationL100: "99" }).erreur));
test("validation : pret a soi-meme ignore", () => egal(Q.validerVehicule({ ...Q.vehiculeNeuf("voiture", "rebecca", "Rebecca"), proprietaire: "rebecca", partageAvec: ["rebecca", J] }).vehicule.partageAvec, [J]));
