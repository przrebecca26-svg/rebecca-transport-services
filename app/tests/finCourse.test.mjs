// TESTS « FIN DE COURSE DEPUIS L'AGENDA » (17 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as F from "../src/pricing/finCourse.js";

section("Fin de course : fait, encaissé, merci, chrono");
const ar = (o = {}) => ({ id: "r1", nom: "Naomie Cohen", service: "aeroport", statut: "acceptee", date: "2026-11-17", heure: "09:30", prixFinal: 300, details: { typeTrajet: "ar", direction: "vers", dateRetour: "2026-11-24", heureRetour: "18:00" }, ...o });
const retour = (o = {}) => ({ ...ar(o), date: "2026-11-24", heure: "18:00", estRetour: true });
const simple = (o = {}) => ({ id: "s1", nom: "Léa", service: "aeroport", statut: "acceptee", date: "2026-11-17", heure: "09:30", prixFinal: 150, details: { direction: "vers" }, ...o });

test("aller d'un aller-retour : la demande reste acceptée, l'aller est noté", () => {
  egal(F.champsFait(ar(), "10:20"), { allerFaitA: "10:20" });
  egal(F.faitDe(ar({ allerFaitA: "10:20" })), "10:20");
  egal(F.faitDe(retour({ allerFaitA: "10:20" })), "");
});
test("retour fait ou aller simple fait : terminée", () => {
  egal(F.champsFait(retour({ allerFaitA: "10:20" }), "19:00").statut, "terminee");
  egal(F.champsFait(simple(), "10:00").statut, "terminee");
  egal(F.champsPasFait(simple({ statut: "terminee" })).statut, "acceptee");
});
test("encaissement : course et pourboire séparés", () => {
  const r = F.preparerEncaissement(ar(), { recu: "300", pourboire: "10", moyen: "Espèces" }, "2026-11-17");
  egal(r.erreur, "");
  egal(r.paiement.montant, 300);
  egal(r.champs.pourboire, 10);
  vrai(!!F.preparerEncaissement(ar(), { recu: "", pourboire: "", moyen: "Espèces" }, "2026-11-17").erreur);
});
test("merci : aller-retour tout payé, en partie, aller simple", () => {
  const tout = F.messageMerci(ar(), 0);
  vrai(tout.includes("Bon vol et bon séjour") && tout.includes("rappel la veille") && !tout.includes("restera"));
  vrai(F.messageMerci(ar(), 150).includes("Il restera 150 ₪ à régler au retour"));
  const s = F.messageMerci(simple(), 0);
  vrai(s.includes("Merci de m'avoir fait confiance") && s.includes("Au plaisir de vous revoir") && !s.includes("retour"));
  vrai(F.messageMerci(retour(), 0).includes("Bon retour"));
  egal(F.resteDe(ar(), [{ resId: "r1", kind: "paiement", montant: 150 }]), 150);
});
test("chrono : récupérée → déposée (= fait) → rentrée, temps et ₪ par heure", () => {
  egal(F.prochaineEtape(ar()), "depart");
  egal(F.champsEtape(ar(), "prise", "08:50"), { "chrono.aller.prise": "08:50" });
  egal(F.champsEtape(ar(), "depose", "09:35"), { "chrono.aller.depose": "09:35", allerFaitA: "09:35" });
  const d = ar({ chrono: { aller: { prise: "08:50", depose: "09:35", maison: "10:20" } }, allerFaitA: "09:35" });
  const b = F.bilanTrajet(d);
  egal([b.course, b.retourMaison, b.total, b.prix, b.parHeure], [45, 45, 90, 150, 100]);
  egal(F.prochaineEtape(d), "");
  egal(F.champsAnnulerEtape(d), { "chrono.aller.maison": "" });
  egal(F.texteMinutes(90), "1 h 30");
});

test("lien du site partout ; sans compte : créer son compte", () => {
  for (const m of [F.messageMerci(simple(), 0), F.messageMerci(ar(), 150), F.messageRappelRetour(retour(), 0)]) {
    vrai(m.includes("rebecca-services-netanya.netlify.app"));
    vrai(m.includes("créer votre compte"));
  }
  const avecCompte = F.messageRappelRetour(retour({ uid: "u1" }), 0);
  vrai(avecCompte.includes("netlify.app") && !avecCompte.includes("créer votre compte"));
});

test("partie → récupérée : approche comptée, essence et gain réel", () => {
  egal(F.prochaineEtape(ar()), "depart");
  egal(F.prochaineEtape(ar({ chrono: { aller: { depart: "08:30" } } })), "prise");
  const d = ar({ kmEstime: 25, chrono: { aller: { depart: "08:30", prise: "08:50", depose: "09:35", maison: "10:20" } }, allerFaitA: "09:35" });
  const b = F.bilanTrajet(d);
  egal([b.approche, b.course, b.retourMaison, b.total, b.parHeure], [20, 45, 45, 110, 82]);
  egal(b.km, 50);
  egal(b.essence, 36.14);
  egal(b.gainReel, 113.86);
});
test("en route, avis : site toujours là", () => {
  vrai(F.messageEnRoute(simple(), "09:00").includes("J'arrive vers 09h30"));
  vrai(F.messageEnRoute(simple(), "10:00").includes("quelques minutes"));
  vrai(F.messageAvis(simple()).includes("netlify.app"));
  vrai(F.messageAvis(simple({ uid: "u" })).includes("Mon historique"));
});
test("listes : rappels de demain, avis à demander, reçus à faire", () => {
  egal(F.rappelsDemain([ar(), ar({ id: "x", rappelEnvoyeLe: "2026-11-23" })], "2026-11-23").length, 1);
  egal(F.rappelsDemain([ar()], "2026-11-20").length, 0);
  const fini = simple({ statut: "terminee", date: "2026-11-15" });
  egal(F.avisADemander([fini, { ...fini, id: "y", avisDemandeLe: "x" }], "2026-11-17").length, 1);
  egal(F.avisADemander([ar({ statut: "terminee" })], "2026-11-18").length, 0); // retour pas encore passé
  egal(F.recusAFaire([{ recuAFaire: true }, { recuAFaire: true, recuFaitLe: "x" }]).length, 1);
});
test("gain par heure par activité", () => {
  const d = simple({ date: "2026-11-17", prixFinal: 120, chrono: { simple: { depart: "08:00", maison: "09:00" } } });
  const r = F.rentabiliteDuMois([d], "2026-11", () => "transport");
  egal([r.transport.trajets, r.transport.minutes, r.transport.parHeure], [1, 60, 120]);
});

test("compteur réel et coût du km d'après les pleins ; avance du retour", () => {
  const d = ar({ kmEstime: 25, chrono: { aller: { depart: "08:30", maison: "10:20", kmDepart: "45210", kmDepose: "45238", kmMaison: "45266" } } });
  egal(F.kmReelTrajet(d), 56);
  const k = F.coutKm([{ date: "2026-11-01", montant: 380, litres: 47.3, compteur: 44700 }, { date: "2026-11-16", montant: 384, litres: 47.8, compteur: 45190 }]);
  egal(k.source, "tes pleins (compteur)");
  egal(k.parKm, 0.784);
  const b = F.bilanTrajet(d, k.parKm);
  egal([b.km, b.kmReel, b.essence], [56, true, 43.9]);
  egal(F.coutKm([{ date: "2026-11-16", montant: 384, litres: 47.8 }]).source, "prix du litre de ton dernier plein");
  egal(F.avanceRetour(ar(), [{ resId: "r1", kind: "paiement", montant: 300 }]), 150);
  egal(F.avanceRetour(retour(), [{ resId: "r1", kind: "paiement", montant: 300 }]), 0);
});

test("lot 3 : livraison faite, relances, minimum, parents, refaire", () => {
  vrai(F.messageLivraisonFaite({ nom: "Dan", service: "livraison", chrono: { simple: { depose: "15:10" } } }).includes("Votre livraison est faite ✅ (à 15h10)"));
  const vieille = simple({ statut: "terminee", date: "2026-10-10", telephone: "050-1234567" });
  egal(F.relancesClientes([vieille], "2026-11-17").length, 1);
  egal(F.relancesClientes([vieille, simple({ id: "n", date: "2026-11-20", telephone: "0501234567" })], "2026-11-17").length, 0);
  vrai(F.messageRelance(vieille).includes("prochain voyage"));
  egal(F.alerteMinimum({ gainNet: 100, gainNetHeure: 50 }, 80, 200), { min: 80, conseille: 260 });
  egal(F.alerteMinimum({ gainNet: 100, gainNetHeure: 90 }, 80, 200), null);
  const fam = [{ id: "a", nom: "Alexia", telephone: "0521", enfants: [{ prenom: "Léa" }, { prenom: "Noa" }] }, { id: "m", categorie: "moi", telephone: "1", enfants: [{ prenom: "Shyrel" }] }];
  const p = F.parentsAPrevenir(fam, "Déposer Léa, Noa et Shyrel");
  egal(p.length, 1);
  egal(p[0].prenoms, ["Léa", "Noa"]);
  vrai(F.messageEnfant("depose", ["Léa", "Noa"], "08:25", "Gan").includes("Léa et Noa sont bien arrivés (Gan) à 08h25"));
  const r = F.versRefaire(ar({ details: { typeTrajet: "ar", direction: "vers", depart: { label: "Rue X" }, heureRetour: "18:00", dateRetour: "2026-11-24" } }));
  egal([r.prerempli.adresses.depart.label, r.prerempli.typeTrajet, r.prerempli.dateRetour, r.client.prenom, r.prerempli.prix], ["Rue X", "ar", "", "Naomie", "300"]);
});

test("modifier les heures et le compteur après coup", () => {
  const r = F.champsModifChrono(ar(), { depart: "07:40", prise: "08:00", depose: "08:45", maison: "09:30", kmDepart: "45210", kmMaison: "45266" });
  egal(r.erreur, "");
  egal(r.champs["chrono.aller.depose"], "08:45");
  egal(r.champs.allerFaitA, "08:45");
  egal(r.champs["chrono.aller.kmMaison"], 45266);
  egal(r.champs["chrono.aller.kmDepose"], "");
  vrai(!!F.champsModifChrono(ar(), { depart: "8h" }).erreur);
});

section("Liste des demandes : état et argent d'un coup d'œil");
test("aller fait, retour à faire", () => {
  const d = { statut: "acceptee", details: { typeTrajet: "ar" }, allerFaitA: "10:40" };
  egal(F.etatDansListe(d).label, "En cours · retour à faire");
  egal(F.etatDansListe({ ...d, allerFaitA: "" }), null);
  egal(F.etatDansListe({ statut: "acceptee" }), null);
});
test("payé, pourboire, reste", () => {
  const mv = [{ resId: "a", kind: "paiement", montant: 120 }, { resId: "b", kind: "paiement", montant: 510 }];
  egal(F.argentDansListe({ id: "a", statut: "acceptee", prixFinal: 600 }, mv), { du: 600, paye: 120, pourboire: 0, reste: 480, solde: false });
  egal(F.argentDansListe({ id: "b", statut: "acceptee", prixFinal: 510, pourboire: 10 }, mv), { du: 510, paye: 510, pourboire: 10, reste: 0, solde: true });
  egal(F.argentDansListe({ id: "c", statut: "en attente", prixFinal: 100 }, mv), null);
});
