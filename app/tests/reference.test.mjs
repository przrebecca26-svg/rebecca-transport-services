// TESTS DE NON-REGRESSION PAR EMPREINTE - Rebecca Services
// Des centaines de calculs reels (prix de tous les services, calendrier sur 2 ans, finances, formulaires...)
// sont resumes en une "empreinte" par groupe. Si un seul resultat change, l'empreinte change et le test echoue.
// Les empreintes de reference sont dans empreintes.json (version du 9 nov. 2026, avant le Lot J).
// Pour les recalculer apres un changement VOULU (et valide par Rebecca) : node tests/reference.test.mjs --enregistrer

import { readFileSync, writeFileSync } from "node:fs";
import { test, egal, section, empreinte, bilan } from "./outils.mjs";
import { ADRESSES as A, TRAJETS as T, MAINTENANT } from "./donnees.mjs";
import * as S from "../src/services.js";
import { calculer, comparerScenarios, creneauxOccupes } from "../src/pricing/engine.js";
import * as Cal from "../src/pricing/calendrier.js";
import * as Disp from "../src/pricing/disponibilite.js";
import * as K from "../src/pricing/comptes.js";
import * as Fi from "../src/pricing/finances.js";
import * as FA from "../src/pricing/financesAnnee.js";
import * as Cl from "../src/pricing/clients.js";
import * as E from "../src/pricing/enchainement.js";
import * as Sv from "../src/pricing/sauvegarde.js";
import * as Su from "../src/pricing/suivi.js";
import * as Bi from "../src/pricing/bilan.js";
import * as M from "../src/pricing/ajoutManuel.js";
import * as N from "../src/pricing/navigation.js";

const FICHIER = new URL("./empreintes.json", import.meta.url);
const enregistrer = process.argv.includes("--enregistrer");

const DATES = ["2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14", "2026-12-07", "2027-04-22", "2027-10-11"];
const HEURES = ["02:00", "07:30", "10:00", "14:00", "18:00", "22:30"];
const DEST = Object.keys(A).filter((z) => z !== "netanya2");

const essai = (f) => {
  try {
    return f();
  } catch (e) {
    return { exception: String(e && e.message) };
  }
};
const demande = (service, champs, route) => S.versDemande(service, { ...S.valeursInitiales(service), ...champs }, route, MAINTENANT);

/* ---------- Generation des groupes de resultats ---------- */
const groupes = {};

// 1. Transport et aeroport : destinations x dates x heures x simple / aller-retour x scenarios
groupes.transport = [];
groupes.aeroport = [];
for (const z of DEST)
  for (const date of DATES)
    for (const heure of HEURES)
      for (const typeTrajet of ["simple", "ar"])
        for (const sc of ["A", "B", "C"]) {
          const d = demande("transport", { depart: A.netanya2, arrivee: A[z], date, heure, typeTrajet, dateRetour: date, heureRetour: "20:00" }, T[z]);
          d.scenario = sc;
          groupes.transport.push(essai(() => calculer(d)));
        }
for (const direction of ["vers", "depuis"])
  for (const date of DATES)
    for (const heure of HEURES)
      for (const valises of ["0", "3"]) groupes.aeroport.push(essai(() => calculer(demande("aeroport", { direction, adresse: A.netanya, date, heure, valises }, T.ben_gurion))));

// 2. Services coursier et autres
groupes.livraison = [];
for (const z of DEST)
  for (const n of ["1", "3"])
    for (const heure of HEURES)
      groupes.livraison.push(essai(() => calculer(demande("livraison", { recuperation: A.netanya, livraison: A[z], nbLivraisons: n, arretL2: A.hadera, arretL3: A.netanya2, date: "2026-11-10", heure, urgent: heure === "14:00" }, T[z]))));
groupes.courses = [];
for (const tp of ["recuperer", "courses"])
  for (const n of [1, 5, 6, 10, 11])
    for (const avance of [false, true]) groupes.courses.push(essai(() => calculer(demande("courses", { typePrestation: tp, articles: String(n), avanceArgent: avance, montantTicket: "237", livraison: A.netanya, date: "2026-11-10", heure: "10:00" }, null))));
groupes.hatanKala = [];
for (const z of DEST)
  for (const nb of ["0", "2"])
    for (const deco of [false, true])
      groupes.hatanKala.push(essai(() => calculer(demande("hatan_kala", { depart: A.netanya, arrivee: A[z], nbArrets: nb, arretH1: A.tel_aviv, arretH2: A.hadera, decoration: deco, date: "2026-11-10", heure: "18:00" }, T[z]))));
groupes.demenagement = [];
for (const c of ["valises", "cartons", "important"])
  for (const z of DEST)
    for (const etage of ["0", "4"])
      groupes.demenagement.push(essai(() => calculer(demande("demenagement", { typeDemenagement: c, depart: A.netanya, arrivee: A[z], etageDepart: etage, etageArrivee: "2", ascenseurArrivee: "oui", trajets: "2", date: "2026-11-10", heure: "10:00" }, T[z]))));
groupes.attente = [];
for (const h of ["1", "3", "8"])
  for (const s of ["0", "15", "45"])
    for (const z of ["netanya", "tel_aviv", "jerusalem"])
      groupes.attente.push(essai(() => calculer(demande("attente", { dureeHeures: h, dureeSupp: s, depart: A.netanya, arrivee: A[z], date: "2026-11-10", heure: "10:00" }, T[z]))));
groupes.ramassage = [];
for (const frequence of ["unique", "semaine"])
  for (const tr of ["matin", "apres", "deux"])
    for (const z of ["netanya2", "hadera", "herzliya_raanana"])
      groupes.ramassage.push(essai(() => calculer(demande("ramassage", { frequence, trajetsRamassage: tr, domicile: A.netanya, ecole: A[z], date: "2026-11-10", heure: "10:00", heure2: "15:00", jour0: true, jour2: true, jour4: true }, T[z]))));

// 3. Scenarios compares et creneaux occupes
groupes.scenarios = DEST.map((z) => comparerScenarios(demande("transport", { depart: A.netanya2, arrivee: A[z], date: "2026-11-10", heure: "10:00" }, T[z])));
groupes.creneaux = DEST.map((z) => essai(() => creneauxOccupes(demande("transport", { depart: A.netanya2, arrivee: A[z], date: "2026-11-10", heure: "10:00", typeTrajet: "ar", dateRetour: "2026-11-10", heureRetour: "17:00" }, T[z]))));

// 4. Calendrier juif sur deux ans (Chabbat, fetes, dates hebraiques, coucher du soleil)
groupes.calendrier = [];
for (let i = 0; i < 730; i++) {
  const date = Cal.ajouterJours("2026-11-01", i);
  groupes.calendrier.push([date, Cal.nomsJourSacre(date), Cal.dateHebraique(date), Math.round(Cal.coucherSoleilUtc(date) / 60000)]);
}
groupes.fermetures = [Cal.periodesFermees("2026-11-01", 730).map((p) => [p.debut, p.fin, p.label, p.type]), Cal.joursADecider("2026-11-01", 730)];
groupes.disponibilite = [];
for (let h = 0; h < 24 * 14; h += 3) {
  const ms = Date.UTC(2026, 10, 9, h);
  groupes.disponibilite.push([essai(() => Disp.etatDisponibilite(ms)), essai(() => Disp.horairesRapides(ms))]);
}
groupes.verifierDispo = [];
for (const date of DATES) for (const heure of HEURES) for (const duree of [30, 180]) groupes.verifierDispo.push(Cal.verifierDisponibilite(date, heure, duree));

// 5. Formulaires (champs, options, libelles) et messages WhatsApp
const champ = (c, v) => ({ name: c.name, type: c.type, label: S.libelle(c, v), options: c.options, requis: c.requis, si: !!c.si });
groupes.formulaires = S.SERVICES.map((s) => {
  const v = S.valeursInitiales(s.id);
  return { id: s.id, titre: s.titre, activite: s.activite, valeurs: v, champs: S.FORMULAIRES[s.id].map((c) => champ(c, v)) };
});
const EXEMPLES = {
  transport: { depart: A.netanya2, arrivee: A.tel_aviv, typeTrajet: "ar", dateRetour: "2026-11-10", heureRetour: "17:00" },
  aeroport: { direction: "depuis", adresse: A.netanya, numeroVol: "LY318", terminal: "3", heureVol: "09:10" },
  livraison: { recuperation: A.netanya, livraison: A.tel_aviv, destinataire: "Test Adulte", telDestinataire: "0500000000" },
  courses: { typePrestation: "courses", articles: "4", magasin: "Magasin test", liste: "pain, lait", avanceArgent: true, montantTicket: "80", livraison: A.netanya },
  hatan_kala: { depart: A.netanya, arrivee: A.hadera, decoration: true, programme: "Photos puis salle" },
  demenagement: { typeDemenagement: "cartons", depart: A.netanya, arrivee: A.netanya2, cartons: "6", etageDepart: "3" },
  ramassage: { frequence: "semaine", trajetsRamassage: "deux", enfant: "Enfant test", classe: "CE1", telUrgence: "0500000000", personnesAutorisees: "Parent test", domicile: A.netanya, ecole: A.netanya2, heure2: "13:30", jour0: true, jour3: true },
  attente: { dureeHeures: "2", dureeSupp: "15", depart: A.netanya, arrivee: A.tel_aviv, programme: "Rendez-vous" },
};
groupes.whatsapp = [];
groupes.validation = [];
groupes.versDemande = [];
for (const s of S.SERVICES) {
  const v = { ...S.valeursInitiales(s.id), ...EXEMPLES[s.id], date: "2026-11-10", heure: "10:00", nom: "Client Test", telephone: "0500000000" };
  const route = S.trajetACalculer(s.id, v) ? T.tel_aviv : null;
  const d = S.versDemande(s.id, v, route, MAINTENANT);
  const r = essai(() => calculer(d));
  groupes.versDemande.push(d);
  groupes.validation.push([essai(() => S.valider(s.id, v)), essai(() => S.valider(s.id, S.valeursInitiales(s.id)))]);
  groupes.whatsapp.push(essai(() => S.messageWhatsApp(s.id, v, r)));
}

// 6. Comptes : acomptes, annulations, remboursements, situation d'une course
groupes.comptes = [];
for (const prix of [0, 20, 49, 50, 60, 99, 100, 235, 590, 1000])
  for (const cas of ["client", "tardive", "absence", "rebecca"])
    for (const encaisse of [0, 10, 40, 1000]) groupes.comptes.push([K.calculerAcompte(prix), essai(() => K.calculerAnnulation({ cas, prixConvenu: prix, encaisse }))]);
for (let h = -5; h <= 100; h += 5) groupes.comptes.push(K.casSuggere(h));
const MOUVEMENTS = [
  { id: "m1", kind: "paiement", resId: "r1", date: "2026-11-10", montant: 50, moyen: "Bit" },
  { id: "m2", kind: "paiement", resId: "r1", date: "2026-11-11", montant: 185, moyen: "Espèces" },
  { id: "m3", kind: "paiement", resId: "r2", date: "2026-11-12", montant: 20, moyen: "Revolut" },
  { id: "m4", kind: "annulation", resId: "r2", date: "2026-11-13", cas: "tardive", frais: 20, fraisRetenus: 20, remboursementValide: 0, validePar: "x" },
  { id: "m5", kind: "correction", resId: "r3", date: "2026-11-14", montant: -10, motif: "erreur de saisie" },
  { id: "m6", kind: "paiement", resId: "r3", date: "2026-11-14", montant: 60, moyen: "Carte bancaire" },
];
const RESERVATIONS = [
  { id: "r1", service: "transport", date: "2026-11-11", heure: "10:00", statut: "terminee", prixFinal: 235, prixEstime: 235, nom: "A", telephone: "0501111111" },
  { id: "r2", service: "livraison", date: "2026-11-14", heure: "10:00", statut: "annulee", prixFinal: 100, prixEstime: 100, nom: "B", telephone: "0502222222" },
  { id: "r3", service: "courses", date: "2026-11-15", heure: "11:00", statut: "acceptee", prixFinal: 60, prixEstime: 60, nom: "C", telephone: "0503333333", pourboire: 5 },
  { id: "r4", service: "transport", date: "2026-12-02", heure: "09:00", statut: "terminee", prixFinal: 350, prixEstime: 350, nom: "A", telephone: "+972 50-111-1111", source: "manuel" },
];
const DEPENSES = [
  { id: "d1", date: "2026-11-10", categorie: "Carburant", montant: 120 },
  { id: "d2", date: "2026-11-11", categorie: "Péages", montant: 18, resId: "r1" },
  { id: "d3", date: "2026-12-01", categorie: "Carburant", montant: -20, motif: "correction" },
];
groupes.situations = RESERVATIONS.map((r) => [essai(() => K.etatReservation(r, MOUVEMENTS)), essai(() => K.situationCourse(r, MOUVEMENTS)), K.encaisseBrut(MOUVEMENTS, r.id), K.annulationDe(MOUVEMENTS, r.id) || null, essai(() => Su.statutSuiviAttendu(r, MOUVEMENTS))]);
groupes.indicateurs = [essai(() => K.indicateurs(RESERVATIONS, MOUVEMENTS, DEPENSES)), essai(() => K.indicateurs(RESERVATIONS, MOUVEMENTS, DEPENSES, { debut: "2026-11-01", fin: "2026-11-30" }))];

// 7. Finances : bilan d'une course, d'une periode, synthese annuelle et plafond
const RES_FIN = [
  { statut: "terminee", prixConvenu: 235, demande: demande("transport", { depart: A.netanya2, arrivee: A.tel_aviv, date: "2026-11-10", heure: "10:00" }, T.tel_aviv), paiements: [{ montant: 235 }], depenses: [{ categorie: "Péages", montant: 15 }] },
  { statut: "terminee", prixConvenu: 120, kmParcourus: 12, paiements: [{ montant: 100 }, { montant: 200, nature: "remboursement_achats" }], depenses: [{ categorie: "Carburant", montant: 9 }] },
  { statut: "acceptee", prixConvenu: 60, paiements: [] },
];
groupes.finances = [RES_FIN.map((r) => essai(() => Fi.bilanReservation(r))), essai(() => Fi.bilanPeriode(RES_FIN, [{ categorie: "Autres frais", montant: 30 }])), essai(() => Fi.totauxFinances(RES_FIN)), essai(() => Fi.resumePaiement(235, [{ montant: 50 }, { montant: 100 }]))];
const AUTRES = [
  { id: "w1", source: "Wolt", periode: "semaine", debut: "2026-11-01", fin: "2026-11-07", livraisons: 40, revenu: 1200, pourboire: 80 },
  { id: "w2", source: "Wolt", periode: "mois", debut: "2026-12-01", fin: "2026-12-31", livraisons: 150, revenu: 4300, pourboire: 210 },
];
groupes.financesAnnee = [
  essai(() => FA.syntheseAnnee({ annee: 2026, demandes: RESERVATIONS, mouvements: MOUVEMENTS, depenses: DEPENSES, autresRevenus: AUTRES, avis: [{ id: "r1", pourboire: 10, creeLe: null }] })),
  [0, 50000, 79999, 80000, 99999, 100000, 150000].map((c) => FA.etatPlafond(c, 100000, 200, 365)),
  ["jour", "semaine", "mois"].map((p) => FA.finProposee(p, "2026-11-10")),
  [{}, AUTRES[0], { ...AUTRES[0], revenu: -50 }, { ...AUTRES[0], revenu: -50, detail: "correction" }].map((f) => essai(() => FA.validerAutreRevenu(f))),
  ["2026-01-01", "2026-12-31", "2028-02-29"].map(FA.jourDansAnnee),
];
groupes.bilanPeriodes = ["jour", "semaine", "mois", "annee"].flatMap((type) => [essai(() => Bi.periodeDe(type, "2026-11-10")), essai(() => Bi.decaler(type, "2026-11-10", -1)), essai(() => Bi.libelle(type, "2026-11-10")), essai(() => Bi.suivantPossible(type, "2026-11-10", "2026-11-10"))]);

// 8. Clients, sauvegarde, ajout manuel, enchainement, navigation
const CLIENTS = [{ id: "u1", prenom: "Adulte", nom: "Test", telephone: "050-111-1111", email: "a@test.invalid", moyensPreferes: ["Bit"] }];
groupes.clients = [
  essai(() => {
    const f = Cl.construireFiches({ clients: CLIENTS, demandes: RESERVATIONS, mouvements: MOUVEMENTS, admins: { tel_0502222222: { origine: "facebook" } } });
    return Array.isArray(f) ? f : [...(f.values ? f.values() : [])];
  }),
  essai(() => Cl.statistiques(RESERVATIONS, MOUVEMENTS)),
  ["+972 54-738-0193", "054 738 0193", "547380193", "", null].map((t) => Cl.telNormalise(t)),
  ["Élodie", "Noémie Ça"].map(Cl.sansAccents),
  ["0", "abc", "-5", "12"].map((m) => essai(() => Cl.validerCorrectionCredit(m, "motif ok"))),
];
groupes.sauvegarde = [essai(() => Sv.journalCsv({ demandes: RESERVATIONS, mouvements: MOUVEMENTS, depenses: DEPENSES })), essai(() => Sv.sauvegardeJson({ demandes: RESERVATIONS, mouvements: MOUVEMENTS, depenses: DEPENSES }, new Date(MAINTENANT))), Sv.nomFichier("journal", "2026-11-09", "csv"), Sv.joursEntre("2026-11-01", "2026-11-09")];
const FORM_MANUEL = { service: "livraison", date: "2026-11-08", heure: "12:00", prix: "60", recu: "65", moyen: "Bit", depart: "Netanya", arrivee: "Netanya", details: "" };
groupes.ajoutManuel = [
  ["", "60", "60,5", "-3", "abc"].map(M.lireMontant),
  S.SERVICES.map((s) => M.champsAdresses(s.id)),
  [[60, 65], [60, 60], [60, 40], [0, 10]].map(([p, r]) => M.repartirPaiement(p, r)),
  ["2026-11-08", "2026-11-09", "2026-11-12"].map((d) => M.etatPropose(d, "2026-11-09", "")),
  essai(() => M.validerClient({ nom: "Client Test", telephone: "0500000000" })),
  essai(() => M.validerCourse(FORM_MANUEL, "2026-11-09")),
  essai(() => M.detailsCourse(FORM_MANUEL)),
  essai(() => M.paiementCourse(FORM_MANUEL, "r9", "2026-11-09")),
  M.messageRemerciement("Client"),
  M.lienEmail("a@test.invalid", "Client"),
];
const C1 = { id: "e1", service: "transport", serviceTitre: "Transport", nom: "Un", date: "2026-11-10", heure: "09:00", minutesEstimees: 40, details: { depart: A.netanya, arrivee: A.tel_aviv } };
const C2 = { id: "e2", service: "livraison", serviceTitre: "Livraison", nom: "Deux", date: "2026-11-10", heure: "10:20", minutesEstimees: 15, details: { recuperation: A.tel_aviv, livraison: A.herzliya_raanana, nbLivraisons: 2 } };
const C3 = { id: "e3", service: "aeroport", serviceTitre: "Aéroport", nom: "Trois", date: "2026-11-10", heure: "12:00", minutesEstimees: 45, details: { direction: "vers", adresse: A.netanya, typeTrajet: "ar", dateRetour: "2026-11-10", heureRetour: "18:00" } };
const C4 = { id: "e4", service: "ramassage", serviceTitre: "Ramassage", nom: "Quatre", date: "2026-11-09", heure: "07:30", minutesEstimees: 10, details: { frequence: "semaine", trajetsRamassage: "deux", heure2: "13:30", domicile: A.netanya, ecole: A.netanya2, jour2: true } };
groupes.enchainement = [C1, C2, C3, C4].map((c) => {
  const autres = [C1, C2, C3, C4].filter((x) => x !== c);
  const liste = E.voisins(c, autres, E.datesDe(c));
  const trajets = Object.fromEntries(E.trajetsACalculer(liste).map((p) => [E.clePaire(p.de, p.vers), 25]));
  const r = E.verifier(liste, trajets);
  return [E.extremites(c), E.dureeCourse(c), E.blocsPourDate(c, "2026-11-10"), E.datesDe(c), r, r.problemes.map(E.phrase), E.messageAutreHoraire(c)];
});
groupes.navigation = [A.tel_aviv, A.netanya, { label: "Sans position" }].map((a) => [essai(() => N.lienWaze(a)), essai(() => N.lienGoogleMaps(a)), essai(() => N.lienApplePlans(a))]).concat([["0547380193", "+972547380193", "054-738-0193"].map((t) => [N.numeroInternational(t), N.lienWhatsApp(t, "Bonjour"), N.lienAppel(t)])]);

/* ---------- Comparaison avec les empreintes de reference ---------- */
// Diagnostic : node tests/reference.test.mjs --exceptions affiche les calculs qui ont plante
if (process.argv.includes("--exceptions")) {
  for (const [k, v] of Object.entries(groupes)) {
    const erreurs = JSON.stringify(v).match(/"exception":"[^"]*"/g) || [];
    if (erreurs.length) console.log("exceptions", k, erreurs.length, erreurs.slice(0, 3));
  }
}
const calculees = Object.fromEntries(Object.entries(groupes).map(([k, v]) => [k, { nombre: Array.isArray(v) ? v.length : 1, empreinte: empreinte(v) }]));

if (enregistrer) {
  writeFileSync(FICHIER, JSON.stringify(calculees, null, 2) + "\n");
  const total = Object.values(calculees).reduce((s, g) => s + g.nombre, 0);
  console.log(`Empreintes enregistrees : ${Object.keys(calculees).length} groupes, ${total} resultats.`);
} else {
  section("Non-regression");
  const reference = JSON.parse(readFileSync(FICHIER, "utf8"));
  for (const [nom, g] of Object.entries(calculees)) {
    test(`${nom} (${g.nombre} resultats)`, () => egal(g, reference[nom], "resultat different de la version de reference"));
  }
  test("aucun groupe manquant", () => egal(Object.keys(reference).sort(), Object.keys(calculees).sort()));
}

if (process.argv[1] && process.argv[1].endsWith("reference.test.mjs") && !enregistrer) {
  const r = bilan();
  console.log(`Tests reussis : ${r.ok} / ${r.ok + r.echecs.length}`);
  r.echecs.forEach((e) => console.log("ECHEC  " + e));
}
