// TESTS COURSIERS PARTENAIRES (18 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import {
  commissionCourse, reglagesCommission, ligneCourse, compteCoursier, bornesMois, bornesSemaine, bilanFinDeMois, estBloque,
  documentsRequis, decision, tableauCoursier, peutPasser, erreursCandidature, peutRecevoir, accepter, terminer, messageReleve,
} from "../src/pricing/coursiers.js";

section("Coursiers : commission");
test("15 % minimum 3 ₪", () => {
  egal(commissionCourse(60).montant, 9);
  egal(commissionCourse(15).montant, 3);
  egal(commissionCourse(2).montant, 2);
  egal(commissionCourse(0).montant, 0);
});
test("commerçant apporté : 8 % minimum 2 ₪", () => {
  egal(commissionCourse(100, { commercantValide: true }).montant, 8);
  egal(commissionCourse(20, { commercantValide: true }).montant, 2);
});
test("réglages modifiables, valeurs folles ignorées", () => {
  egal(commissionCourse(100, { reglages: { normale: { taux: 20, minimum: 3 } } }).montant, 20);
  egal(reglagesCommission({ normale: { taux: 90 } }).normale.taux, 15);
  egal(reglagesCommission({}).plafondDette, 150);
});

section("Coursiers : compte du mois");
const courses = [
  { id: "a", date: "2026-11-02", statut: "terminee", prix: 60, pourboire: 10, moyen: "bit", commission: { montant: 9 } },
  { id: "b", date: "2026-11-05", statut: "terminee", prix: 40, pourboire: 0, moyen: "especes", commission: { montant: 6 } },
  { id: "c", date: "2026-11-09", statut: "annulee", prix: 80, moyen: "bit", commission: { montant: 12 } },
  { id: "d", date: "2026-12-01", statut: "terminee", prix: 50, moyen: "bit", commission: { montant: 7.5 } },
];
test("électronique reversé, espèces gardées, commission sur tout", () => {
  const c = compteCoursier({ courses, ...bornesMois("2026-11") });
  egal(c.nombre, 2);
  egal(c.encaisseParRebecca, 70);
  egal(c.gardeEnMain, 40);
  egal(c.commissions, 15);
  egal(c.solde, 55);
  egal(c.gainNet, 95);
  egal(bilanFinDeMois(c).sens, "vers_coursier");
});
test("commission figée : on garde celle de la course", () => {
  egal(ligneCourse({ prix: 100, moyen: "bit", commission: { montant: 8 } }).commission, 8);
});
test("que des espèces : le coursier doit", () => {
  const c = compteCoursier({ courses: [{ date: "2026-11-03", statut: "terminee", prix: 100, moyen: "especes", commission: { montant: 15 } }], ...bornesMois("2026-11") });
  egal(c.solde, -15);
  egal(bilanFinDeMois(c), { sens: "vers_rebecca", montant: 15, texte: "Tu dois 15 ₪ à Rebecca Services (commissions sur tes courses payées en espèces)." });
});
test("versements déjà faits", () => {
  const c = compteCoursier({ courses, reglements: [{ date: "2026-11-20", sens: "vers_coursier", montant: 55 }], ...bornesMois("2026-11") });
  egal(c.solde, 0);
  egal(bilanFinDeMois(c).sens, "aucun");
});
test("blocage au-delà de 150 ₪ de dette", () => {
  egal(estBloque(-150), false);
  egal(estBloque(-151), true);
  egal(estBloque(-60, { plafondDette: 50 }), true);
});
test("périodes", () => {
  egal(bornesMois("2026-02"), { debut: "2026-02-01", fin: "2026-02-28" });
  egal(bornesSemaine("2026-11-18"), { debut: "2026-11-15", fin: "2026-11-21" });
  vrai(messageReleve({ nom: "Dan", periode: "novembre", compte: compteCoursier({ courses, ...bornesMois("2026-11") }) }).includes("55 ₪"));
});

section("Coursiers : candidature");
test("documents selon le véhicule", () => {
  vrai(!documentsRequis("voiture").some((d) => d.id === "topcase"));
  vrai(documentsRequis("scooter").some((d) => d.id === "topcase"));
  vrai(!documentsRequis("velo").some((d) => d.id === "permis"));
});
const cand = { nom: "Dan Cohen", telephone: "054 123 4567", osek: "patour", vehicule: "velo", paiement: "Bit 0541234567", documents: { identite: "x", osek: "x", photoVelo: "x", sac: "x" }, engagement: true };
test("candidature complète", () => {
  egal(erreursCandidature(cand), {});
  vrai(erreursCandidature({ ...cand, documents: {} }).documents);
  vrai(erreursCandidature({ ...cand, engagement: false }).engagement);
});
test("statuts et décisions datées", () => {
  vrai(peutPasser("en_verification", "approuve"));
  vrai(!peutPasser("brouillon", "approuve"));
  vrai(decision({ statut: "en_verification" }, "complement_demande").erreur);
  const d = decision({ statut: "en_verification" }, "complement_demande", "Photo du permis floue");
  egal(d.statut, "complement_demande");
  egal(d.historique.length, 1);
  vrai(decision({ statut: "refuse" }, "approuve").erreur);
});

section("Coursiers : missions");
const fiche = { statut: "approuve", disponible: true };
test("seulement livraisons et courses", () => {
  vrai(peutRecevoir({ fiche, mission: { service: "livraison" } }).ok);
  vrai(peutRecevoir({ fiche, mission: { service: "courses" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "transport" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "aeroport" } }).ok);
  vrai(!peutRecevoir({ fiche, mission: { service: "livraison" }, soldeCumule: -200 }).ok);
  vrai(!peutRecevoir({ fiche: { ...fiche, statut: "suspendu" }, mission: { service: "livraison" } }).ok);
});
test("le premier qui accepte, commission figée", () => {
  const m = { statut: "proposee", proposeeA: ["u1", "u2"], prix: 60 };
  const r = accepter(m, "u1");
  egal(r.maj.commission.montant, 9);
  vrai(accepter({ ...m, statut: "acceptee" }, "u2").erreur);
  vrai(accepter(m, "u3").erreur);
});
test("photo de preuve obligatoire", () => {
  const m = { statut: "acceptee" };
  vrai(terminer(m, { moyen: "bit" }).erreur);
  vrai(terminer(m, { photo: "data:image/jpeg;base64,AAA" }).erreur);
  egal(terminer(m, { photo: "data:image/jpeg;base64,AAA", moyen: "especes", pourboire: "5" }).maj.pourboire, 5);
});

section("Coursiers : tableau de bord");
test("parts, pourcentages et moyens de paiement", () => {
  const t = tableauCoursier({ courses, ...bornesMois("2026-11") });
  egal(t.totalBrut, 110);
  egal(t.partCoursier, 95);
  egal(t.partRebecca, 15);
  egal(t.pctRebecca, 15);
  egal(t.pctCoursier, 85);
  egal(t.partCoursierCourses, 85);
  egal(t.parMoyen.map((m) => [m.label, m.nombre, m.montant]), [["Espèces", 1, 40], ["Bit", 1, 70]]);
  egal(t.lignes[0].id, "b");
  egal(t.lignes[0].argent, "Gardé en espèces");
  egal(t.lignes[1].partCoursier, 61);
  egal(t.resteAPayer, 55);
});

section("Coursiers : inscription complète (étape 2)");
import { erreursInscription, construireInscription, lireLienPartenaire, statutDe, libelleCandidature, messageDecision, SERVICES_PARTENAIRE as SP } from "../src/pricing/partenaires.js";
const insc = { prenom: "Dan", nom: "Cohen", telephone: "054 123 4567", email: "dan@exemple.com", ville: "Netanya", vehicule: "scooter", services: ["livraison"], jours: ["Lundi"], osek: "patour", paiement: "Bit 0541234567", documents: { identite: "x", osek: "x", permis: "x", rishayon: "x", assurance: "x", topcase: "x", sac: "x" }, reglement: true, majeur: true, consentement: true };
test("formulaire complet", () => {
  egal(erreursInscription(insc), {});
  vrai(erreursInscription({ ...insc, documents: { identite: "x" } }).documents.includes("top-case"));
  vrai(erreursInscription({ ...insc, osek: "" }).osek);
  vrai(erreursInscription({ ...insc, reglement: false }).reglement);
  egal(erreursInscription({ ...insc, vehicule: "pied", documents: { identite: "x", osek: "x", sac: "x" } }), {});
});
test("seulement livraisons et courses", () => {
  egal(SP.map((s) => s.v), ["livraison", "courses"]);
  egal(construireInscription({ ...insc, services: ["livraison", "transport"] }).services, ["livraison"]);
  egal(construireInscription(insc).documentsEnvoyes, ["identite", "osek", "sac", "permis", "rishayon", "assurance", "topcase"]);
  egal(construireInscription(insc).statut, "soumis");
});
test("lien de suivi et anciens statuts", () => {
  egal(lireLienPartenaire("#/partenaire/AbCdEf1234567890"), "AbCdEf1234567890");
  egal(lireLienPartenaire("#/partenaire"), "");
  egal(statutDe({ statut: "nouvelle" }), "soumis");
  egal(libelleCandidature("acceptee"), "Approuvé");
  vrai(messageDecision({ id: "AbCdEf1234567890", prenom: "Dan" }, "complement_demande", "permis flou", "https://x.app").includes("https://x.app/#/partenaire/AbCdEf1234567890"));
});

section("Coursiers : missions (étape 3)");
import { missionDepuisDemande, soldeCumule, moyenMouvement, etapeSuivante, lireAccesCoursier } from "../src/pricing/coursiers.js";
test("mission depuis une livraison, sans e-mail ni notes", () => {
  const d = { id: "d1", service: "livraison", serviceTitre: "Livraison", nom: "Dana Levi", email: "dana@x.com", telephone: "0541112222", date: "2026-11-20", heure: "10:00", prixFinal: 60, notePrivee: "secret", details: { recuperation: { label: "Herzl 1, Netanya", lat: 32.3, lon: 34.8 }, livraison: { label: "Weizmann 5" }, destinataire: "Avi", telDestinataire: "0523334444", typeColis: "Clés" } };
  const r = missionDepuisDemande(d, { coursiers: ["u1", "u2", "u1"] });
  egal(r.erreur, "");
  egal(r.mission.proposeeA, ["u1", "u2"]);
  egal(r.mission.commission.montant, 9);
  egal(r.mission.client, "Dana");
  vrai(!JSON.stringify(r.mission).includes("dana@x.com"));
  vrai(!JSON.stringify(r.mission).includes("secret"));
  vrai(missionDepuisDemande({ ...d, service: "transport" }, { coursiers: ["u1"] }).erreur);
  vrai(missionDepuisDemande({ ...d, prixFinal: undefined }, { coursiers: ["u1"] }).erreur);
  vrai(missionDepuisDemande(d, { coursiers: [] }).erreur);
  egal(missionDepuisDemande(d, { coursiers: ["u1"], commercantValide: true }).mission.commission.montant, 4.8);
});
test("solde cumulé, moyens, étapes, lien d'accès", () => {
  const ms = [{ id: "a", date: "2026-11-02", statut: "terminee", prix: 60, moyen: "bit", commission: { montant: 9 } }, { id: "b", date: "2026-10-02", statut: "terminee", prix: 100, moyen: "especes", commission: { montant: 15 } }];
  egal(soldeCumule(ms, []), 36);
  egal(soldeCumule(ms, [{ date: "2026-11-30", sens: "vers_coursier", montant: 36 }]), 0);
  egal(moyenMouvement("carte"), "Carte bancaire");
  egal(etapeSuivante({ statut: "acceptee" }), "partie");
  egal(etapeSuivante({ statut: "acceptee", partieLe: 1, recupereeLe: 1 }), "livree");
  egal(lireAccesCoursier("#/admin?coursier=AbCdEf1234567890"), "AbCdEf1234567890");
});

// ---------- 19 nov. 2026 : modèle Wolt (sac personnel, retenue à la source, relevé de la semaine) ----------
import { retenueCoursier, infosAvantAccepter, DOCUMENTS_FACULTATIFS } from "../src/pricing/coursiers.js";
import { docsPour } from "../src/pricing/partenaires.js";
section("Coursiers : sac personnel, retenue, relevé de la semaine (19 nov.)");
test("photo du sac obligatoire, exonération de retenue facultative", () => {
  vrai(documentsRequis("pied").some((d) => d.id === "sac"));
  egal(erreursInscription({ ...insc, documents: { ...insc.documents, sac: undefined } }).documents.includes("sac isotherme"), true);
  vrai(docsPour("scooter").some((d) => d.id === "retenue" && d.facultatif));
  egal(erreursInscription(insc), {});
  egal(construireInscription({ ...insc, documents: { ...insc.documents, retenue: "x" } }).documentsEnvoyes.slice(-1), ["retenue"]);
  egal(DOCUMENTS_FACULTATIFS.length, 1);
});
test("retenue à la source : 0 % par défaut, sinon sur ce que Rebecca verse", () => {
  const courses = [
    { id: "a", date: "2026-11-16", heure: "12:00", lieu: "McDo", statut: "terminee", prix: 100, moyen: "bit", commission: { montant: 15 } },
    { id: "b", date: "2026-11-17", statut: "terminee", prix: 40, moyen: "especes", commission: { montant: 6 } },
  ];
  const sans = tableauCoursier({ courses, ...bornesSemaine("2026-11-18") });
  egal([sans.retenue, sans.resteAPayer], [0, 79]);
  const avec = tableauCoursier({ courses, ...bornesSemaine("2026-11-18"), tauxRetenue: 30 });
  egal([avec.retenue, avec.resteAPayer], [23.7, 55.3]);
  egal(avec.lignes.find((l) => l.id === "a").lieu, "McDo");
  vrai(messageReleve({ nom: "Dan", periode: "du 15/11 au 21/11", compte: avec }).includes("Retenue à la source (30 %) : 23.7 ₪"));
  egal(retenueCoursier({ encaisseParRebecca: 10, commissions: 20 }, 30).montant, 0);
});
test("trajet et gain affichés avant d'accepter", () => {
  const t = infosAvantAccepter({ depart: { lat: 32.3045, lon: 34.8735 }, arrivee: { lat: 32.315, lon: 34.87 }, prix: 30, commission: { montant: 4.5 } });
  vrai(t.includes("km") && t.includes("₪/km"));
  egal(infosAvantAccepter({ prix: 30 }), "");
});
