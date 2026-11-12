// TESTS DE L'ESPACE EQUIPE (Lot J, seance J2) - Rebecca Services
// Acces d'un coequipier, menu limite, fiche, missions, encaissement par le membre.

import { test, egal, vrai, section } from "./outils.mjs";
import * as E from "../src/pricing/espaceEquipe.js";

const J = "uid-jeremy";
const FICHE = { ...E.ficheParDefaut({ nom: "Jérémy", email: "jeremy@exemple.invalid" }) };

section("Equipe : acces et role");
test("sans fiche ni demande : aucun acces", () => egal(E.roleDe({ estAdmin: false, fiche: null, demande: null }), "aucun"));
test("demande envoyee : en attente", () => egal(E.roleDe({ estAdmin: false, fiche: null, demande: { statut: "en_attente" } }), "attente"));
test("demande refusee", () => egal(E.roleDe({ estAdmin: false, fiche: null, demande: { statut: "refusee" } }), "refuse"));
test("fiche active : equipe", () => egal(E.roleDe({ estAdmin: false, fiche: FICHE, demande: null }), "equipe"));
test("fiche desactivee", () => egal(E.roleDe({ estAdmin: false, fiche: { ...FICHE, actif: false }, demande: null }), "desactive"));
test("Rebecca reste admin quoi qu'il arrive", () => egal(E.roleDe({ estAdmin: true, fiche: null, demande: null }), "admin"));
test("demande d'acces : aucun droit, seulement nom et e-mail", () => egal(E.demandeAcces({ email: "j@exemple.invalid", displayName: "Jérémy" }), { email: "j@exemple.invalid", nom: "Jérémy", statut: "en_attente" }));

section("Equipe : menu");
test("Rebecca : tout le menu", () => egal(E.rubriquesPour("admin"), null));
test("coequipier : tout le menu sauf Equipe et Finances (16h42)", () => egal(E.rubriquesPour("equipe"), ["tableau", "devis", "activites", "demandes", "transferts", "agenda", "repertoire", "clients", "mesfinances", "statistiques", "rapports", "reglages"]));
test("coequipier : jamais les finances de Rebecca ni la rubrique Equipe", () => vrai(["finances", "equipe"].every((r) => !E.rubriquesPour("equipe").includes(r))));
test("en attente : rien", () => egal(E.rubriquesPour("attente"), []));

section("Equipe : fiche par defaut et services");
test("par defaut : coursier + transport, pas beaute/epoxy/digital", () => egal(FICHE.activites, ["coursier", "transport"]));
test("par defaut : ramassage scolaire inclus (decision du 9 nov.)", () => vrai(FICHE.services.includes("ramassage")));
test("par defaut : il voit le telephone des clients", () => egal(FICHE.voitTelephone, true));
test("services du membre = activites ouvertes ET services coches", () => egal(E.servicesDuMembre({ ...FICHE, services: ["livraison", "transport"], activites: ["coursier"] }), ["livraison"]));
test("membre desactive : aucun service", () => egal(E.servicesDuMembre({ ...FICHE, actif: false }), []));
test("validation : un service d'une activite fermee est retire", () => egal(E.validerFiche({ ...FICHE, activites: ["coursier"], services: ["livraison", "aeroport"] }).fiche.services, ["livraison"]));
test("validation : activite inconnue ignoree", () => egal(E.validerFiche({ ...FICHE, activites: ["coursier", "pirate"] }).fiche.activites, ["coursier"]));
test("validation : nom obligatoire", () => vrai(!!E.validerFiche({ ...FICHE, nom: "" }).erreur));
test("validation : plafond invalide", () => vrai(!!E.validerFiche({ ...FICHE, plafond: "abc" }).erreur));
test("validation : plafond garde", () => egal(E.validerFiche({ ...FICHE, plafond: "120000" }).fiche.plafond, 120000));

section("Equipe : missions et encaissement");
const M = { id: "d1", service: "livraison", serviceTitre: "Livraison", date: "2026-11-10", heure: "10:00", statut: "acceptee", attribueA: J, prixFinal: 60, nom: "Client Test", telephone: "0500000000", email: "c@exemple.invalid" };
test("mission proposee visible avec le telephone si coche", () => {
  const r = E.missionsDuMembre({ uid: J, transferts: [{ id: "d2__" + J, demande: "d2", vers: J, statut: "propose", mission: { ...M, id: "d2", attribueA: undefined } }], voitTelephone: true, jour: "2026-11-09" });
  egal([r.proposees.length, r.proposees[0].telephone], [1, "0500000000"]);
});
test("mes missions a venir, sans e-mail du client", () => {
  const r = E.missionsDuMembre({ uid: J, demandes: [M], jour: "2026-11-09", voitTelephone: true });
  egal([r.aVenir.length, r.aVenir[0].email], [1, undefined]);
});
test("accepter : la mission lui est attribuee", () => egal(E.reponseProposition({ statut: "propose", vers: J, vehicule: "v3" }, true, J).demande, { attribueA: J, vehicule: "v3" }));
test("refuser : la mission ne bouge pas", () => egal(E.reponseProposition({ statut: "propose", vers: J }, false, J).demande, null));
test("proposition deja traitee refusee", () => vrai(!!E.reponseProposition({ statut: "accepte", vers: J }, true, J).erreur));
test("terminer : 65 recus pour 60 = 5 de pourboire a part", () => {
  const r = E.terminerMission(M, { recu: "65", moyen: "Bit" }, J, "2026-11-10");
  egal([r.paiement.montant, r.paiement.operateur, r.demande.pourboire, r.demande.realisePar], [60, J, 5, J]);
});
test("terminer : moyen de paiement obligatoire", () => vrai(!!E.terminerMission(M, { recu: "60" }, J, "2026-11-10").erreur));
test("terminer : pas la mission d'un autre", () => vrai(!!E.terminerMission({ ...M, attribueA: "autre" }, { recu: "60", moyen: "Bit" }, J, "2026-11-10").erreur));
test("terminer : reste a encaisser", () => egal(E.terminerMission(M, { recu: "40", moyen: "Espèces" }, J, "2026-11-10").reste, 20));
test("modes : au moins un", () => vrai(!!E.validerModes([]).erreur));
test("autonomie du velo : vide = prudence", () => egal(E.validerAutonomie("").autonomieKm, null));
test("autonomie du velo : 40 km", () => egal(E.validerAutonomie("40").autonomieKm, 40));

section("Equipe : chiffres et reglages du membre");
const DEM = [
  { id: "a", service: "livraison", statut: "terminee", prixFinal: 60, attribueA: J, realisePar: J },
  { id: "b", service: "livraison", statut: "terminee", prixFinal: 80 },
  { id: "c", service: "transport", statut: "en attente", prixEstime: 200 },
  { id: "d", service: "nails", statut: "terminee", prixFinal: 150 },
];
const MOUV = [{ kind: "paiement", resId: "a", montant: 60, operateur: J }, { kind: "paiement", resId: "b", montant: 80 }];
const CH = E.chiffresDuMembre({ uid: J, fiche: FICHE, demandes: DEM, mouvements: MOUV });
test("ses courses seulement (pas celles de Rebecca)", () => egal(CH.siennes.map((d) => d.id), ["a"]));
test("ses encaissements seulement", () => egal(CH.mouvements.length, 1));
test("demandes visibles : ses services, jamais la beaute", () => egal(CH.visibles.map((d) => d.id), ["a", "b", "c"]));
test("tuiles : coursier et transport oui, Nails non", () => egal(["coursier", "transport", "nails", "epoxy"].map((t) => E.tuileVisible(FICHE, t)), [true, true, false, false]));
test("tuiles : beaute cochee = les 4 marques", () => egal(["nails", "hair", "regenx", "slim"].every((t) => E.tuileVisible({ ...FICHE, activites: ["beaute"] }, t)), true));
test("mes reglages : modes coches", () => egal(E.validerMesReglages({ telephone: "050", plafond: "100000", modes: ["scooter", "velo"] }).maj.modes, ["scooter", "velo"]));
test("mes reglages : au moins un mode", () => vrai(!!E.validerMesReglages({ plafond: "100000", modes: [] }).erreur));
test("mes reglages : jamais ses droits (activites, services, actif)", () => egal(Object.keys(E.validerMesReglages({ plafond: "100000", modes: ["voiture"], activites: ["beaute"], actif: true }).maj).sort(), ["modes", "plafond", "telephone"]));
