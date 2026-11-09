// TESTS ARGENT ENTRE COEQUIPIERS ET « SI L'UN DE NOUS EST LIBRE » (Lot J, seance J4) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/reverser.js";
import { syntheseMembre } from "../src/pricing/equipe.js";
import { validerMouvement } from "../src/pricing/comptes.js";
import { verifierDisponibilite, autreMembreLibre, prochainesFermetures } from "../src/pricing/calendrier.js";
import { TARIFS } from "../src/pricing/config.js";

const J = "uid-jeremy";
const MEMBRES = [{ id: "rebecca", nom: "Rebecca" }, { id: J, nom: "Jérémy" }];
const course = (id, extra = {}) => ({ id, service: "livraison", serviceTitre: "Livraison", date: "2026-11-12", heure: "10:00", statut: "terminee", prixFinal: 60, kmEstime: 4, ...extra });
const DEMANDES = [course("r1"), course("j1", { attribueA: J }), course("j2", { attribueA: J, prixFinal: 100 }), course("j3", { realisePar: J, attribueA: "rebecca", prixFinal: 40 })];
const MVTS = [
  { id: "a", kind: "paiement", resId: "r1", date: "2026-11-12", montant: 60, moyen: "Bit" }, // Rebecca encaisse sa course
  { id: "b", kind: "paiement", resId: "j1", date: "2026-11-12", montant: 60, moyen: R.MOYEN_CREDIT }, // course de Jeremy payee avec le credit
  { id: "c", kind: "paiement", resId: "j2", date: "2026-11-12", montant: 100, moyen: "Espèces" }, // Rebecca encaisse la course de Jeremy
  { id: "d", kind: "paiement", resId: "r1", date: "2026-11-13", montant: 10, moyen: "Bit", operateur: J }, // Jeremy encaisse pour Rebecca
  { id: "e", kind: "paiement", resId: "j3", date: "2026-11-13", montant: 40, moyen: "Espèces", operateur: J }, // Jeremy encaisse sa course
];
const RECH = [{ id: "rc1", statut: "confirmée", montant: 200, date: "2026-11-11", operateur: J }, { id: "rc2", statut: "confirmée", montant: 300, date: "2026-11-11" }, { id: "rc3", statut: "en attente", montant: 50, operateur: J }];

section("Reverser : qui a recu, qui a fait");
test("sans operateur = Rebecca", () => egal(R.recuPar({ moyen: "Bit" }), "rebecca"));
test("credit du client = toujours Rebecca", () => egal(R.recuPar({ moyen: R.MOYEN_CREDIT, operateur: J }), "rebecca"));
test("realisePar prime sur attribueA", () => egal(R.faitPar(DEMANDES[3]), J));
test("champ operateur absent pour Rebecca (compatible v8)", () => egal([R.champOperateur("rebecca"), R.champOperateur(J)], [{}, { operateur: J }]));
test("paiement avec le credit accepte", () => egal(validerMouvement({ kind: "paiement", resId: "x", date: "2026-11-12", montant: 10, moyen: R.MOYEN_CREDIT }), null));
test("credit refuse pour un remboursement", () => vrai(!!validerMouvement({ kind: "remboursement_effectue", resId: "x", date: "2026-11-12", montant: 10, moyen: R.MOYEN_CREDIT })));

section("Reverser : lignes et solde");
const LIGNES = R.lignesAReverser({ demandes: DEMANDES, mouvements: MVTS, recharges: RECH });
test("4 lignes (credit, encaisse x2, recharge)", () => egal(LIGNES.map((l) => [l.de, l.vers, l.montant, l.cause]).sort(), [
  ["rebecca", J, 100, "encaisse"],
  ["rebecca", J, 60, "credit"],
  [J, "rebecca", 10, "encaisse"],
  [J, "rebecca", 200, "recharge"],
].sort()));
test("solde net : Rebecca doit 160, Jeremy doit 210 -> Jeremy doit 50", () => egal(R.soldeEntre("rebecca", J, { lignes: LIGNES }), { de: J, vers: "rebecca", montant: 50 }));
test("meme solde vu de Jeremy", () => egal(R.soldeEntre(J, "rebecca", { lignes: LIGNES }), { de: J, vers: "rebecca", montant: 50 }));
test("apres reversement de 50 : a jour", () => egal(R.soldeEntre("rebecca", J, { lignes: LIGNES, reversements: [{ de: J, vers: "rebecca", montant: 50 }] }).montant, 0));
test("reversement partiel", () => egal(R.soldeEntre("rebecca", J, { lignes: LIGNES, reversements: [{ de: J, vers: "rebecca", montant: 20 }] }), { de: J, vers: "rebecca", montant: 30 }));
test("soldesDe : un solde par autre membre", () => egal(R.soldesDe("rebecca", MEMBRES, { lignes: LIGNES }).map((s) => [s.membre.id, s.montant]), [[J, 50]]));
test("remboursement rendu par l'autre = ligne negative", () => {
  const l = R.lignesAReverser({ demandes: [course("x", { attribueA: J })], mouvements: [{ kind: "remboursement_effectue", resId: "x", montant: 20, moyen: "Bit" }] });
  egal(l.map((x) => [x.de, x.vers, x.montant]), [["rebecca", J, -20]]);
});

section("Reverser : validation");
const SOLDE = { de: J, vers: "rebecca", montant: 50 };
test("reversement correct", () => egal(R.validerReversement({ de: J, vers: "rebecca", montant: 50, date: "2026-11-14", note: " Bit " }, SOLDE), { erreur: "", ligne: { de: J, vers: "rebecca", montant: 50, date: "2026-11-14", note: "Bit" } }));
test("pas plus que le solde", () => vrai(!!R.validerReversement({ de: J, vers: "rebecca", montant: 60, date: "2026-11-14" }, SOLDE).erreur));
test("pas dans le mauvais sens", () => vrai(!!R.validerReversement({ de: "rebecca", vers: J, montant: 10, date: "2026-11-14" }, SOLDE).erreur));
test("montant nul refuse", () => vrai(!!R.validerReversement({ de: J, vers: "rebecca", montant: 0, date: "2026-11-14" }, SOLDE).erreur));

section("Reverser : argent de chacun");
const D = { demandes: DEMANDES, mouvements: MVTS, recharges: RECH };
test("Rebecca : 160 encaisses, 100 pour Jeremy, 10 encaisses par lui, 60 de credit a lui donner, 200 de recharge a recevoir", () => {
  const a = R.argentDe("rebecca", D);
  egal([a.encaisse, a.pourLesAutres, a.recuParLesAutres, a.creditADonner, a.rechargesARecevoir, a.aMoiAuFinal], [160, 100, 10, 60, 200, 210]);
});
test("Jeremy : 50 encaisses, 10 pour Rebecca, 100 a recevoir, 60 de credit a recevoir", () => {
  const a = R.argentDe(J, D);
  egal([a.encaisse, a.pourLesAutres, a.recuParLesAutres, a.creditARecevoir, a.rechargesADonner, a.aMoiAuFinal], [50, 10, 100, 60, 200, 200]);
});
test("total : rien ne se perd (210 encaisses + 200 de recharge)", () => egal(R.argentDe("rebecca", D).aMoiAuFinal + R.argentDe(J, D).aMoiAuFinal, 410));

section("Reverser : chiffre d'affaires et plafond par personne");
test("CA de Rebecca = ses courses seulement", () => egal(syntheseMembre("rebecca", { annee: 2026, demandes: DEMANDES, mouvements: MVTS }).totaux.caActivites, 60));
test("CA de Jeremy = ses 3 courses, quel que soit qui a encaisse", () => egal(syntheseMembre(J, { annee: 2026, demandes: DEMANDES, mouvements: MVTS }).totaux.caActivites, 200));
test("credit prepaye compte chez Rebecca seulement", () => {
  const rec = [{ statut: "confirmée", date: "2026-11-11", montant: 300 }];
  egal([syntheseMembre("rebecca", { annee: 2026, recharges: rec }).credit.rechargesRecues, syntheseMembre(J, { annee: 2026, recharges: rec }).credit.rechargesRecues], [300, 0]);
});
test("argent garde apres annulation : pour celui a qui etait la course", () => {
  const dem = [course("ann", { attribueA: J, statut: "annulee" })];
  const mv = [{ kind: "annulation", resId: "ann", date: "2026-11-12", fraisRetenus: 30 }];
  egal([syntheseMembre(J, { annee: 2026, demandes: dem, mouvements: mv }).totaux.annulations, syntheseMembre("rebecca", { annee: 2026, demandes: dem, mouvements: mv }).totaux.annulations], [30, 0]);
});

section("Reverser : par vehicule");
const VEH = [{ id: "voit", nom: "Voiture de Rebecca", type: "voiture", proprietaire: "rebecca", consommationL100: 9, prixLitre: 8.03, usureParKm: 1.1 }, { id: "velo", nom: "Vélo", type: "velo", proprietaire: J, consommationL100: 0, prixLitre: 0, usureParKm: 0 }];
const PV = R.parVehicule({ annee: 2026, demandes: [course("a"), course("b", { attribueA: J, vehicule: "velo" }), course("c", { attribueA: J })], depenses: [{ date: "2026-11-12", montant: 50, vehicule: "voit" }], vehicules: VEH });
test("course de Rebecca sans vehicule = sa voiture", () => egal(PV.find((l) => l.id === "voit").courses, 1));
test("voiture : 8 km, frais 15 ₪ (1,82 ₪/km), depense rattachee", () => egal(["km", "fraisEstimes", "beneficeEstime", "depenses"].map((k) => PV.find((l) => l.id === "voit")[k]), [8, 15, 45, 50]));
test("velo : sans frais, benefice = prix", () => egal(PV.find((l) => l.id === "velo").beneficeEstime, 60));
test("course de Jeremy sans vehicule : « non indique »", () => egal(PV.find((l) => l.id === "_inconnu").nom, "Véhicule non indiqué"));

section("Libre : l'un de nous");
const cal = TARIFS.calendrier;
const avant = { equipe: cal.equipe, ferm: [...cal.fermeturesExceptionnelles] };
const MARDI = "2026-11-10"; // creneau ecole 07:15-08:45 et 13:15-14:45
const avecEquipe = (equipe, ferm = []) => {
  cal.equipe = equipe;
  cal.fermeturesExceptionnelles.splice(0, cal.fermeturesExceptionnelles.length, ...ferm);
};
try {
  avecEquipe([]);
  test("Rebecca seule : creneau ecole bloque", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "livraison").type, "personnel"));
  avecEquipe([{ id: J, services: ["livraison", "transport"], indispos: [] }]);
  test("Jeremy libre : creneau ecole ouvert pour une livraison", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "livraison"), null));
  test("service que Jeremy ne fait pas : bloque", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "demenagement").type, "personnel"));
  test("ramassage non coche pour Jeremy : bloque", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "ramassage").type, "personnel"));
  avecEquipe([{ id: J, services: ["livraison", "ramassage"], indispos: [] }]);
  test("ramassage coche pour Jeremy : sur son planning, ouvert", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "ramassage"), null));
  test("sans service precise : ouvert si Jeremy est libre", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS), null));
  test("Chabbat : ferme pour tous", () => egal(verifierDisponibilite("2026-11-14", "12:00", 0, TARIFS, "livraison").type, "chabbat_fete"));
  avecEquipe([{ id: J, services: ["livraison"], indispos: [{ debut: MARDI + "T07:00", fin: MARDI + "T09:00" }] }]);
  test("Jeremy indisponible aussi : bloque", () => egal(verifierDisponibilite(MARDI, "08:00", 0, TARIFS, "livraison").type, "personnel"));
  test("Rebecca libre, Jeremy indisponible : ouvert", () => egal(verifierDisponibilite(MARDI, "10:00", 0, TARIFS, "livraison"), null));
  test("autreMembreLibre a 10h", () => vrai(autreMembreLibre("livraison", Date.parse(MARDI + "T08:00:00Z"), Date.parse(MARDI + "T08:30:00Z"))));
  avecEquipe([{ id: J, services: ["livraison"], indispos: [] }], [{ debut: MARDI + "T09:00", fin: MARDI + "T12:00", motif: "Repos", portee: "moi" }]);
  test("fermeture « seulement moi » : ouverte si Jeremy est libre", () => egal(verifierDisponibilite(MARDI, "10:00", 0, TARIFS, "livraison"), null));
  test("fermeture « seulement moi » : non annoncee aux clients", () => vrai(!prochainesFermetures(MARDI, 5).some((p) => p.label === "Repos")));
  avecEquipe([{ id: J, services: ["livraison"], indispos: [] }], [{ debut: MARDI + "T09:00", fin: MARDI + "T12:00", motif: "Vacances" }]);
  test("fermeture « toute l'equipe » (par defaut) : fermee", () => egal(verifierDisponibilite(MARDI, "10:00", 0, TARIFS, "livraison").label, "Vacances"));
  avecEquipe([], [{ debut: MARDI + "T09:00", fin: MARDI + "T12:00", motif: "Repos", portee: "moi" }]);
  test("« seulement moi » sans equipe : fermee comme avant", () => egal(verifierDisponibilite(MARDI, "10:00", 0, TARIFS, "livraison").label, "Repos"));
} finally {
  cal.equipe = avant.equipe;
  cal.fermeturesExceptionnelles.splice(0, cal.fermeturesExceptionnelles.length, ...avant.ferm);
}
