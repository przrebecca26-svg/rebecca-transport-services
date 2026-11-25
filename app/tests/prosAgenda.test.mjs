// TESTS DE L'AGENDA DES PROFESSIONNELS ET DU TABLEAU DU RESEAU (25 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import * as A from "../src/pricing/prosAgenda.js";
import * as P from "../src/pricing/pros.js";
import { localVersUtc } from "../src/pricing/calendrier.js";

section("Agenda des professionnels");
const MERCREDI = "2026-12-02";
const VENDREDI = "2026-12-04";
const agenda = A.lireAgenda({ actif: true, enLigne: true, horaires: { 3: [{ debut: "09:00", fin: "12:00" }], 5: [{ debut: "09:00", fin: "18:00" }] }, prestations: [{ nom: "Manucure", duree: 60 }], delaiHeures: 0 });
const AVANT = localVersUtc("2026-11-30", "09:00");

test("lecture : horaires propres, plages invalides retirées, prestations arrondies à 5 min", () => {
  const a = A.lireAgenda({ horaires: { 1: [{ debut: "10:00", fin: "09:00" }, { debut: "08:00", fin: "09:00" }] }, prestations: [{ nom: "X", duree: 47 }, { nom: "", duree: 30 }] });
  egal(a.horaires[1], [{ debut: "08:00", fin: "09:00" }]);
  egal(a.prestations.map((p) => p.duree), [45]);
  egal(A.lireAgenda("cassé").actif, false);
  vrai(A.erreursAgenda(A.lireAgenda({ horaires: {}, prestations: [] })).length === 2);
});

test("créneaux libres : horaires, durée, rendez-vous déjà pris, pause", () => {
  egal(A.creneauxLibres(agenda, MERCREDI, 60, { maintenantMs: AVANT, enLigne: true }), ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00"]);
  const rdvs = [{ date: MERCREDI, heure: "10:00", duree: 60, statut: "confirme" }];
  egal(A.creneauxLibres(agenda, MERCREDI, 60, { rdvs, maintenantMs: AVANT, enLigne: true }), ["09:00", "11:00"]);
  // un rendez-vous annulé libère son créneau
  egal(A.creneauxLibres(agenda, MERCREDI, 60, { rdvs: [{ ...rdvs[0], statut: "annule" }], maintenantMs: AVANT, enLigne: true }).length, 9);
  // jour fermé
  egal(A.creneauxLibres(agenda, "2026-12-03", 60, { maintenantMs: AVANT }), []);
});

test("congés et absences partielles", () => {
  const a = { ...agenda, conges: [{ du: MERCREDI, au: MERCREDI, debut: "09:00", fin: "10:00", motif: "médecin" }] };
  egal(A.creneauxLibres(a, MERCREDI, 60, { maintenantMs: AVANT, enLigne: true })[0], "10:00");
  egal(A.creneauxLibres({ ...agenda, conges: [{ du: "2026-12-01", au: "2026-12-05" }] }, MERCREDI, 60, { maintenantMs: AVANT }), []);
});

test("Chabbat : pas bloqué pour un pro (sauf s'il le choisit) ; délai minimum, horizon", () => {
  vrai(A.creneauxLibres(agenda, VENDREDI, 60, { maintenantMs: AVANT, enLigne: true }).includes("17:00"));
  const vendredi = A.creneauxLibres({ ...agenda, fermeChabbat: true }, VENDREDI, 60, { maintenantMs: AVANT, enLigne: true });
  vrai(vendredi.includes("09:00") && !vendredi.includes("17:00"), vendredi.join(" "));
  // le pro lui-même (hors ligne) n'est pas bloqué : il est indépendant
  vrai(A.creneauxLibres(agenda, VENDREDI, 60, { maintenantMs: AVANT }).includes("17:00"));
  egal(A.creneauxLibres({ ...agenda, delaiHeures: 48 }, "2026-11-30", 60, { maintenantMs: AVANT, enLigne: true }), []);
  egal(A.creneauxLibres({ ...agenda, joursMax: 1 }, MERCREDI, 60, { maintenantMs: AVANT, enLigne: true }), []);
});

test("aucune double réservation : quarts d'heure, conflits", () => {
  egal(A.quartsDe("10:10", 30), ["1000", "1015", "1030"]);
  const rdvs = [{ id: "a", date: MERCREDI, heure: "10:00", duree: 45, statut: "confirme" }];
  vrai(A.conflitRdv({ id: "b", date: MERCREDI, heure: "10:30", duree: 30 }, rdvs, agenda).includes("déjà pris"));
  egal(A.conflitRdv({ id: "b", date: MERCREDI, heure: "10:45", duree: 30 }, rdvs, agenda), "");
  // se déplacer soi-même n'est pas un conflit
  egal(A.conflitRdv({ id: "a", date: MERCREDI, heure: "10:15", duree: 45 }, rdvs, agenda), "");
});

test("statuts, messages et rappels", () => {
  const r = A.normaliserRdv({ id: "x", date: MERCREDI, heure: "10:00", duree: 60, prestation: "Manucure", client: { nom: "Léa", telephone: "0541112233" }, statut: "demande", source: "client" });
  vrai(A.changerStatutRdv(r, "termine").erreur.length > 0);
  egal(A.changerStatutRdv(r, "confirme").rdv.statut, "confirme");
  vrai(A.messageRdv("confirmation", r, "Ongles de Lou").includes("mercredi 2 décembre à 10h00"));
  vrai(A.lienWhatsAppClient("0541112233", "x").startsWith("https://wa.me/972541112233"));
  egal(A.rappelsDeDemain([{ ...r, statut: "confirme" }, { ...r, id: "y" }], "2026-12-01").map((x) => x.id), ["x"]);
  egal(Object.keys(A.erreursDemandeClient({})).length, 4);
  egal(A.statsRdv([r, { ...r, statut: "termine" }], "2026-12-01", "2026-12-31").termines, 1);
});

section("Tableau du réseau");
test("abonnement : mois dus, payés, retard, prochaine échéance (montant saisi par Rebecca, aucun tarif ici)", () => {
  const ab = { actif: true, mensuel: 59, debut: "2026-10-05", paiements: [{ date: "2026-10-05", montant: 59 }] };
  const e = P.etatAbonnement(ab, "2026-12-01");
  egal([e.dus, e.payes, e.retard, e.prochaine], [3, 1, 2, "2026-11-05"]);
  egal(P.etatAbonnement({ actif: false }, "2026-12-01").retard, 0);
});

test("revenus séparés : Digital, abonnements, livraisons partenaires", () => {
  const dossiers = [P.normaliserDossier({ id: "p1", nomCommercial: "Lou", statut: "accepte", actif: true, formule: "vitrine", projetDigital: "dg1", abonnement: { actif: true, mensuel: 59, debut: "2026-11-01", paiements: [{ date: "2026-11-02", montant: 59 }] } })];
  const demandes = [{ id: "d1", date: "2026-11-10", proPartenaire: "p1" }, { id: "d2", date: "2026-11-11" }];
  const mouvements = [{ resId: "d1", kind: "paiement", montant: 40 }, { resId: "d2", kind: "paiement", montant: 100 }];
  const t = P.tableauReseau({ dossiers, demandes, mouvements, recuProjet: (id) => (id === "dg1" ? 196 : 0), aujourdhui: "2026-11-25" });
  egal([t.actifs, t.revenusDigital, t.revenusAbonnements, t.revenusLivraisons, t.total], [1, 196, 59, 40, 295]);
  egal(t.formules.vitrine, 1);
});
