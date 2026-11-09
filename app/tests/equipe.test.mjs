// TESTS DE L'EQUIPE ET DES VEHICULES (Lot J, seance J1) - Rebecca Services
// Droits, vehicules, conseil, disponibilites, "l'un de nous est libre", transferts, finances par personne.

import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A } from "./donnees.mjs";
import * as Q from "../src/pricing/equipe.js";

const REBECCA = { id: "rebecca", nom: "Rebecca", modes: ["voiture"] };
const JEREMY = { id: "jeremy", nom: "Jérémy", actif: true, modes: ["scooter", "velo"], services: ["transport", "aeroport", "livraison", "courses", "demenagement", "hatan_kala", "attente"] };
const JEREMY_VOITURE = { ...JEREMY, modes: ["scooter", "velo", "voiture"] };
const VOITURE = { id: "v1", nom: "Voiture de Rebecca", type: "voiture", proprietaire: "rebecca", partageAvec: ["jeremy"], consommationL100: 9, prixLitre: 8.03, usureParKm: 1.1 };
const SCOOTER = { id: "v2", nom: "Scooter de Jérémy", type: "scooter", proprietaire: "jeremy", consommationL100: 3, prixLitre: 8.03, usureParKm: 0.3 };
const VELO = { id: "v3", nom: "Vélo de Jérémy", type: "velo", proprietaire: "jeremy" };
const VEHICULES = [VOITURE, SCOOTER, VELO];
const MEMBRES = [REBECCA, JEREMY];

const mission = (id, service, heure, km, extra = {}) => ({
  id, service, serviceTitre: service, nom: "Client Test", telephone: "0500000000", date: "2026-11-10", heure,
  kmEstime: km, minutesEstimees: Math.round(km * 1.5), prixFinal: 100, statut: "acceptee",
  details: { depart: A.netanya, arrivee: A.tel_aviv, recuperation: A.netanya, livraison: A.netanya2, telDestinataire: "0501234567" }, ...extra,
});
const CTX = (demandes = [], dispos = {}) => ({ membres: MEMBRES, vehicules: VEHICULES, demandes, dispos, vehiculeParDefaut: "v1" });

section("Equipe : droits");
test("Rebecca peut tout faire", () => vrai(["ramassage", "transport", "livraison"].every((s) => Q.peutFaire(REBECCA, s))));
test("Jeremy : livraison oui", () => egal(Q.peutFaire(JEREMY, "livraison"), true));
test("Jeremy : ramassage scolaire non", () => egal(Q.peutFaire(JEREMY, "ramassage"), false));
test("Jeremy desactive : rien", () => egal(Q.peutFaire({ ...JEREMY, actif: false }, "livraison"), false));
test("demande sans attribution = Rebecca", () => egal(Q.attribueA({ id: "x" }), "rebecca"));
test("Jeremy encaisse seulement ses missions", () => {
  egal(Q.peutEncaisser(JEREMY, { attribueA: "jeremy" }), true);
  egal(Q.peutEncaisser(JEREMY, {}), false);
  egal(Q.peutEncaisser(REBECCA, { attribueA: "jeremy" }), true);
});
test("vue mission sans telephone par defaut", () => {
  const v = Q.vueMission({ ...mission("a", "livraison", "10:00", 4), email: "x@test.invalid", uid: "u1", codePromo: "BIENVENUE10" });
  egal([v.telephone, v.email, v.uid, v.codePromo, v.details.telDestinataire], [undefined, undefined, undefined, undefined, undefined]);
  egal(v.prenom, "Client");
});
test("vue mission avec telephone si Rebecca le decide", () => egal(Q.vueMission(mission("a", "livraison", "10:00", 4), true).telephone, "0500000000"));

section("Vehicules");
test("cout au km voiture = 9 L x 8,03 / 100 + 1,1", () => egal(Q.coutParKmVehicule(VOITURE), 1.823));
test("velo sans frais", () => egal(Q.coutParKmVehicule(VELO), 0));
test("km mission = aller + retour", () => egal(Q.kmMission({ kmEstime: 6 }), 12));
test("velo : 8 km aller ok sans autonomie (16 km)", () => egal(Q.autonomieSuffisante(VELO, 8), true));
test("velo : 9 km aller refuse (8 km maximum)", () => egal(Q.autonomieSuffisante(VELO, 9), false));
test("velo autonomie 15 km : 7 km aller refuse (14 > 12)", () => egal(Q.autonomieSuffisante({ ...VELO, autonomieKm: 15 }, 7), false));
test("velo autonomie 40 km : 8 km aller ok", () => egal(Q.autonomieSuffisante({ ...VELO, autonomieKm: 40 }, 8), true));
test("voiture : pas de limite d'autonomie", () => egal(Q.autonomieSuffisante(VOITURE, 200), true));
test("vehicules de Jeremy sans voiture cochee", () => egal(Q.vehiculesDuMembre(JEREMY, VEHICULES).map((v) => v.id), ["v2", "v3"]));
test("Jeremy avec voiture cochee : voiture partagee de Rebecca", () => egal(Q.vehiculesDuMembre(JEREMY_VOITURE, VEHICULES).map((v) => v.id), ["v1", "v2", "v3"]));
test("voiture non partagee : pas pour Jeremy", () => egal(Q.vehiculesDuMembre(JEREMY_VOITURE, [{ ...VOITURE, partageAvec: [] }]).length, 0));
test("vehicule inactif ignore", () => egal(Q.vehiculesDuMembre(JEREMY, [{ ...VELO, actif: false }]).length, 0));
test("Rebecca : sa voiture", () => egal(Q.vehiculesDuMembre(REBECCA, VEHICULES).map((v) => v.id), ["v1"]));

section("Conseil du vehicule");
test("livraison courte : velo conseille en premier", () => egal(Q.conseillerVehicule(JEREMY, mission("m", "livraison", "10:00", 4), CTX())[0].vehicule.id, "v3"));
test("livraison 12 km : velo impossible, scooter conseille", () => {
  const c = Q.conseillerVehicule(JEREMY, mission("m", "livraison", "10:00", 12), CTX());
  egal(c[0].vehicule.id, "v2");
  vrai(c.find((x) => x.vehicule.id === "v3").raison.includes("batterie"));
});
test("transport : voiture obligatoire (Jeremy sans voiture = aucun choix possible)", () => egal(Q.conseillerVehicule(JEREMY, mission("m", "transport", "10:00", 33), CTX()).some((c) => c.possible), false));
test("transport : Jeremy avec voiture partagee libre = voiture", () => egal(Q.conseillerVehicule(JEREMY_VOITURE, mission("m", "transport", "10:00", 33), CTX())[0].vehicule.id, "v1"));
test("voiture deja prise par Rebecca a cette heure", () => {
  const prise = mission("r1", "transport", "10:00", 33);
  const c = Q.conseillerVehicule(JEREMY_VOITURE, mission("m", "transport", "10:30", 33), CTX([prise]));
  const voiture = c.find((x) => x.vehicule.id === "v1");
  egal(voiture.possible, false);
  vrai(voiture.raison.includes("Déjà utilisé"));
});
test("voiture libre quand Rebecca fait des ongles (pas de mission voiture)", () => egal(Q.conseillerVehicule(JEREMY_VOITURE, mission("m", "transport", "10:30", 33), CTX([]))[0].possible, true));
test("voiture imposee par Rebecca", () => egal(Q.conseillerVehicule(JEREMY_VOITURE, mission("m", "livraison", "10:00", 4, { voitureObligatoire: true }), CTX())[0].vehicule.id, "v1"));
test("benefice plus grand a velo qu'en voiture", () => {
  const c = Q.conseillerVehicule(JEREMY_VOITURE, mission("m", "livraison", "10:00", 4), CTX());
  vrai(c.find((x) => x.vehicule.id === "v3").beneficeEstime > c.find((x) => x.vehicule.id === "v1").beneficeEstime);
});
test("velo : benefice = prix", () => egal(Q.beneficeMission(mission("m", "livraison", "10:00", 4), VELO), { prix: 100, coutVehicule: 0, benefice: 100 }));
test("voiture : cout de 8 km", () => egal(Q.beneficeMission(mission("m", "livraison", "10:00", 4), VOITURE).coutVehicule, 15));

section("Disponibilites et l'un de nous");
test("indisponibilite sur la journee", () => egal(Q.blocsIndispo({ periodes: [{ debut: "2026-11-10T09:00", fin: "2026-11-10T12:00" }] }, "2026-11-10"), [{ debut: 540, fin: 720 }]));
test("indisponibilite sur plusieurs jours", () => egal(Q.blocsIndispo({ periodes: [{ debut: "2026-11-09T18:00", fin: "2026-11-11T08:00" }] }, "2026-11-10"), [{ debut: 0, fin: 1440 }]));
test("creneau fixe du mardi", () => egal(Q.blocsIndispo({ creneaux: [{ jours: [2], debut: "13:00", fin: "14:00" }] }, "2026-11-10").length, 1));
test("creneau fixe d'un autre jour ignore", () => egal(Q.blocsIndispo({ creneaux: [{ jours: [3], debut: "13:00", fin: "14:00" }] }, "2026-11-10").length, 0));
test("Jeremy indisponible", () => egal(Q.membreLibre(JEREMY, mission("m", "livraison", "10:00", 4), { dispos: { jeremy: { periodes: [{ debut: "2026-11-10T09:00", fin: "2026-11-10T12:00" }] } } }), false));
test("Jeremy libre", () => egal(Q.membreLibre(JEREMY, mission("m", "livraison", "15:00", 4), { dispos: { jeremy: { periodes: [{ debut: "2026-11-10T09:00", fin: "2026-11-10T12:00" }] } } }), true));
test("autre mission de Jeremy trop proche", () => egal(Q.membreLibre(JEREMY, mission("m", "livraison", "10:30", 4), { demandes: [mission("j1", "livraison", "10:00", 4, { attribueA: "jeremy" })] }), false));
test("mission de Rebecca ne bloque pas Jeremy", () => egal(Q.membreLibre(JEREMY, mission("m", "livraison", "10:30", 4), { demandes: [mission("r1", "livraison", "10:00", 4)] }), true));
test("Rebecca libre : elle d'abord", () => egal(Q.quiPeutFaire(mission("m", "livraison", "10:00", 4), CTX())[0].membre.id, "rebecca"));
test("Rebecca occupee : Jeremy a velo", () => {
  const r = Q.quiPeutFaire(mission("m", "livraison", "10:00", 4), CTX([], { rebecca: { periodes: [{ debut: "2026-11-10T08:00", fin: "2026-11-10T13:00" }] } }));
  egal([r.length, r[0].membre.id, r[0].vehicule.id], [1, "jeremy", "v3"]);
});
test("ramassage : Rebecca seulement", () => egal(Q.quiPeutFaire(mission("m", "ramassage", "10:00", 4, { details: { domicile: A.netanya, ecole: A.netanya2 } }), CTX()).map((x) => x.membre.id), ["rebecca"]));
test("transport, Rebecca occupee, une seule voiture prise par elle : personne", () => {
  const prise = mission("r1", "transport", "10:00", 33);
  egal(Q.equipeDisponible(mission("m", "transport", "10:30", 33), { ...CTX([prise]), membres: [REBECCA, JEREMY_VOITURE] }), false);
});
test("transport, Rebecca occupee sans voiture (ongles) : Jeremy avec la voiture", () => {
  const r = Q.quiPeutFaire(mission("m", "transport", "10:30", 33), { ...CTX([], { rebecca: { periodes: [{ debut: "2026-11-10T09:00", fin: "2026-11-10T13:00" }] } }), membres: [REBECCA, JEREMY_VOITURE] });
  egal([r[0].membre.id, r[0].vehicule.id], ["jeremy", "v1"]);
});
test("deuxieme voiture : deux transports en meme temps", () => {
  const prise = mission("r1", "transport", "10:00", 33);
  const v4 = { id: "v4", type: "voiture", proprietaire: "jeremy" };
  const r = Q.quiPeutFaire(mission("m", "transport", "10:30", 33), { ...CTX([prise]), membres: [REBECCA, JEREMY_VOITURE], vehicules: [...VEHICULES, v4] });
  egal(r.map((x) => [x.membre.id, x.vehicule.id]), [["jeremy", "v4"]]);
});

section("Transferts");
test("transfert vers Jeremy libre = ok, velo conseille", () => {
  const v = Q.verifierTransfert(mission("m", "livraison", "10:00", 4), JEREMY, CTX());
  egal([v.ok, v.vehiculeConseille.id], [true, "v3"]);
});
test("transfert d'un ramassage : avertissement de droits", () => egal(Q.verifierTransfert(mission("m", "ramassage", "10:00", 4), JEREMY, CTX()).ok, false));
test("transfert sans vehicule possible : avertissement", () => vrai(Q.verifierTransfert(mission("m", "transport", "10:00", 33), JEREMY, CTX()).avertissements.some((a) => a.includes("véhicule"))));
test("transfert deja attribue : avertissement", () => vrai(Q.verifierTransfert(mission("m", "livraison", "10:00", 4, { attribueA: "jeremy" }), JEREMY, CTX()).avertissements.some((a) => a.includes("déjà"))));
test("creation : de Rebecca vers Jeremy, propose", () => egal(Q.creerTransfert(mission("m", "livraison", "10:00", 4), JEREMY, "v3", "t0"), { demande: "m", de: "rebecca", vers: "jeremy", vehicule: "v3", statut: "propose", creeLe: "t0" }));
test("acceptation : attribution et vehicule mis a jour", () => {
  const r = Q.repondreTransfert(Q.creerTransfert(mission("m", "livraison", "10:00", 4), JEREMY, "v3", "t0"), true, "t1");
  egal([r.transfert.statut, r.demande], ["accepte", { attribueA: "jeremy", vehicule: "v3" }]);
});
test("refus : la mission ne bouge pas", () => egal(Q.repondreTransfert(Q.creerTransfert(mission("m", "livraison", "10:00", 4), JEREMY, "v3", "t0"), false, "t1").demande, null));
test("double reponse refusee", () => vrai(!!Q.repondreTransfert({ statut: "accepte" }, true, "t2").erreur));

section("Finances par personne");
const DEM = [
  { id: "d1", service: "livraison", date: "2026-11-02", statut: "terminee", prixFinal: 60 },
  { id: "d2", service: "livraison", date: "2026-11-03", statut: "terminee", prixFinal: 80, attribueA: "jeremy", realisePar: "jeremy" },
  { id: "d3", service: "transport", date: "2026-11-04", statut: "terminee", prixFinal: 235, attribueA: "jeremy", realisePar: "rebecca" },
];
const WOLT = [
  { id: "w1", source: "Wolt", periode: "semaine", debut: "2026-11-01", fin: "2026-11-07", livraisons: 10, revenu: 500, pourboire: 20 },
  { id: "w2", source: "Wolt", periode: "semaine", debut: "2026-11-01", fin: "2026-11-07", livraisons: 8, revenu: 300, pourboire: 10, operateur: "jeremy" },
];
const DEP = [{ date: "2026-11-02", categorie: "Carburant", montant: 50 }, { date: "2026-11-02", categorie: "Carburant", montant: 20, operateur: "jeremy" }];
test("courses de Rebecca : d1 + d3 (realisee par elle)", () => egal(Q.coursesDe(DEM, "rebecca").map((d) => d.id), ["d1", "d3"]));
test("courses de Jeremy : d2", () => egal(Q.coursesDe(DEM, "jeremy").map((d) => d.id), ["d2"]));
test("Wolt de Jeremy separe", () => egal(Q.lignesDe(WOLT, "jeremy").map((w) => w.id), ["w2"]));
test("plafond de Rebecca sans les recettes de Jeremy", () => egal(Q.syntheseMembre("rebecca", { annee: 2026, demandes: DEM, autresRevenus: WOLT, depenses: DEP }).cumulPlafond, 60 + 235 + 500));
test("plafond de Jeremy : ses courses + son Wolt", () => egal(Q.syntheseMembre("jeremy", { annee: 2026, demandes: DEM, autresRevenus: WOLT, depenses: DEP }).cumulPlafond, 80 + 300));
test("depenses de Jeremy seulement", () => egal(Q.syntheseMembre("jeremy", { annee: 2026, demandes: DEM, autresRevenus: WOLT, depenses: DEP }).totaux.depenses, 20));
test("plafond propre a chacun", () => egal(Q.syntheseMembre("jeremy", { annee: 2026, demandes: DEM, plafond: 120000 }).plafond.plafond, 120000));
