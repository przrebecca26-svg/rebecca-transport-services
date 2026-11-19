// TESTS DES REGLES METIER - Rebecca Services
// Chaque test verifie une regle validee par Rebecca (prix, aller-retour, Chabbat, acomptes...).
// Ces tests protegent l'existant : ils doivent rester verts apres chaque lot.

import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A, TRAJETS as T, MARDI, VENDREDI, SAMEDI, MAINTENANT } from "./donnees.mjs";
import * as S from "../src/services.js";
import { calculer, comparerScenarios, detecterZone, pourcentageNuit, arrondiSup } from "../src/pricing/engine.js";
import { TARIFS } from "../src/pricing/config.js";
import * as Cal from "../src/pricing/calendrier.js";
import * as K from "../src/pricing/comptes.js";
import * as Cr from "../src/pricing/credit.js";
import * as P from "../src/pricing/promos.js";
import * as M from "../src/pricing/ajoutManuel.js";
import * as F from "../src/pricing/financesAnnee.js";
import * as Cl from "../src/pricing/clients.js";
import * as E from "../src/pricing/enchainement.js";
import * as D from "../src/pricing/depenses.js";

const ZONES = ["netanya", "hadera", "herzliya_raanana", "tel_aviv", "haifa", "jerusalem", "hors_grille"];
const SERVICES_ID = ["transport", "aeroport", "livraison", "courses", "hatan_kala", "demenagement", "ramassage", "attente"];

// Construit la demande exactement comme le site (formulaire -> versDemande -> calculer)
export function devis(service, champs, route, scenario) {
  const v = { ...S.valeursInitiales(service), ...champs };
  const d = S.versDemande(service, v, route, MAINTENANT);
  if (scenario) d.scenario = scenario;
  return calculer(d);
}

const transport = (zone, extra = {}, scenario) =>
  devis("transport", { depart: A.netanya2, arrivee: A[zone], date: MARDI, heure: "10:00", ...extra }, T[zone], scenario);
const ar = (h = "16:00") => ({ typeTrajet: "ar", dateRetour: MARDI, heureRetour: h });

/* ---------- Grille officielle (scenario B actif) ---------- */
section("Grille B");
const GRILLE_SIMPLE = { netanya: 75, hadera: 160, herzliya_raanana: 150, tel_aviv: 235, haifa: 465, jerusalem: 570, hors_grille: 320 };
const GRILLE_AR = { netanya: 110, hadera: 240, herzliya_raanana: 260, tel_aviv: 350, haifa: 690, jerusalem: 850, hors_grille: 470 };
for (const z of ZONES) {
  test(`aller simple ${z}`, () => egal(transport(z).total, GRILLE_SIMPLE[z]));
  test(`aller-retour ${z}`, () => egal(transport(z, ar()).total, GRILLE_AR[z]));
}
test("aeroport depuis Netanya", () => egal(devis("aeroport", { direction: "vers", adresse: A.netanya, date: MARDI, heure: "10:00" }, T.ben_gurion).total, 290));
test("scenario actif = B", () => egal(TARIFS.scenarioActif, "B"));

/* ---------- Aller-retour : deux trajets reellement calcules ---------- */
section("Aller-retour");
for (const z of ZONES) {
  for (const sc of ["A", "B", "C"]) {
    test(`${z} ${sc} : aller-retour different de l'aller simple`, () => {
      const s = transport(z, {}, sc).total;
      const r = transport(z, ar(), sc).total;
      vrai(r !== s, `AR ${r} = simple ${s}`);
      vrai(r > s, `AR ${r} <= simple ${s}`);
    });
    test(`${z} ${sc} : deux lignes de trajet en aller-retour`, () => {
      const l = transport(z, ar(), sc).lignes.filter((x) => x.base);
      egal(l.length, 2);
    });
  }
  test(`${z} : minimum par trajet en aller-retour`, () => {
    const l = transport(z, ar()).lignes.filter((x) => x.base);
    const zone = detecterZone(A[z].label);
    if (zone) l.forEach((x) => vrai(x.montant >= TARIFS.zones[zone].grilleB.parTrajetAR, x.montant + " sous le minimum"));
  });
}

/* ---------- Scenarios A, B, C et retour a vide ---------- */
section("Scenarios et retour a vide");
for (const z of ZONES) {
  test(`${z} : A <= B <= C`, () => {
    const c = comparerScenarios(S.versDemande("transport", { ...S.valeursInitiales("transport"), depart: A.netanya2, arrivee: A[z], date: MARDI, heure: "10:00" }, T[z], MAINTENANT));
    vrai(c.A.total <= c.B.total && c.B.total <= c.C.total, JSON.stringify(c));
  });
  test(`${z} : retour a vide compte dans la rentabilite (aller simple)`, () => {
    const r = transport(z).details.rentabilite;
    egal(r.retourAVide, true);
    egal(r.kmTotal, T[z].km * 2);
  });
  test(`${z} : pas de retour a vide en aller-retour`, () => egal(transport(z, ar()).details.rentabilite.retourAVide, false));
}
test("trois scenarios conserves", () => egal(Object.keys(TARIFS.scenarios), ["A", "B", "C"]));
test("part du retour a vide A = 0", () => egal(TARIFS.scenarios.A.partRetourAVide, 0));
test("part du retour a vide C = 0,5", () => egal(TARIFS.scenarios.C.partRetourAVide, 0.5));

/* ---------- Supplements ---------- */
section("Supplements");
for (const z of ZONES) {
  test(`${z} : nuit 23h plus cher que 10h`, () => vrai(transport(z, { heure: "23:00" }).total > transport(z).total));
  test(`${z} : nuit 02h (20 %) >= nuit 23h (15 %)`, () => vrai(transport(z, { heure: "02:00" }).total >= transport(z, { heure: "23:00" }).total));
  test(`${z} : urgence + 30`, () => egal(transport(z, { urgent: true, date: "2026-11-11" }).total - transport(z, { date: "2026-11-11" }).total, 30));
}
test("nuit 22h-24h = 15 %", () => egal(pourcentageNuit("22:30"), 0.15));
test("nuit 0h-6h = 20 %", () => egal(pourcentageNuit("03:00"), 0.2));
test("pas de nuit a 21h59", () => egal(pourcentageNuit("21:59"), 0));
test("pas de nuit a 06h00", () => egal(pourcentageNuit("06:00"), 0));
test("urgence dans l'heure = + 50", () => {
  const base = devis("transport", { depart: A.netanya2, arrivee: A.tel_aviv, date: "2026-11-09", heure: "10:30" }, T.tel_aviv);
  const urg = devis("transport", { depart: A.netanya2, arrivee: A.tel_aviv, date: "2026-11-09", heure: "10:30", urgent: true }, T.tel_aviv);
  egal(urg.total - base.total, 50);
});
test("bagages en soute payants", () => vrai(transport("tel_aviv", { bagages: "2" }).total > transport("tel_aviv").total));
test("arrets supplementaires annonces avant validation", () => vrai(transport("tel_aviv", { arrets: "1" }).aConfirmer.some((a) => /arrêt/.test(a))));
test("attente 10 min offertes", () => egal(transport("tel_aviv", ar()).total, transport("tel_aviv", { ...ar(), attenteMinutes: "0" }).total));
test("arrondi au multiple de 5", () => egal(arrondiSup(151), 155));
for (const z of ZONES) test(`${z} : tous les totaux multiples de 5`, () => egal(transport(z).total % 5, 0));

/* ---------- Chabbat, fetes, creneaux ---------- */
section("Chabbat et fetes");
const CHAMPS_JOUR = {
  transport: { depart: A.netanya2, arrivee: A.tel_aviv },
  aeroport: { direction: "vers", adresse: A.netanya },
  livraison: { recuperation: A.netanya, livraison: A.netanya2 },
  courses: { typePrestation: "recuperer", articles: "3", livraison: A.netanya },
  hatan_kala: { depart: A.netanya, arrivee: A.netanya2 },
  demenagement: { typeDemenagement: "valises", depart: A.netanya, arrivee: A.netanya2 },
  ramassage: { domicile: A.netanya, ecole: A.netanya2 },
  attente: { dureeHeures: "1" },
};
const ROUTE = { transport: T.tel_aviv, aeroport: T.ben_gurion, livraison: T.netanya2, courses: null, hatan_kala: T.netanya2, demenagement: T.netanya2, ramassage: T.netanya2, attente: null };
for (const s of SERVICES_ID) {
  test(`${s} : samedi 10h bloque`, () => egal(devis(s, { ...CHAMPS_JOUR[s], date: SAMEDI, heure: "10:00" }, ROUTE[s]).bloque, true));
  test(`${s} : vendredi 15h bloque (avant Chabbat)`, () => egal(devis(s, { ...CHAMPS_JOUR[s], date: VENDREDI, heure: "15:00" }, ROUTE[s]).bloque, true));
  test(`${s} : mardi 10h possible`, () => {
    const r = devis(s, { ...CHAMPS_JOUR[s], date: MARDI, heure: "10:00" }, ROUTE[s]);
    vrai(r.ok && !r.bloque, JSON.stringify(r).slice(0, 200));
  });
  test(`${s} : Yom Kippour bloque`, () => egal(devis(s, { ...CHAMPS_JOUR[s], date: "2027-10-11", heure: "11:00" }, ROUTE[s]).bloque, true));
  test(`${s} : Pessah 1er jour bloque`, () => egal(devis(s, { ...CHAMPS_JOUR[s], date: "2027-04-22", heure: "11:00" }, ROUTE[s]).bloque, true));
}
test("creneau d'ecole 8h bloque", () => egal(transport("tel_aviv", { heure: "08:00" }).bloque, true));
test("samedi soir apres la sortie possible", () => vrai(!transport("netanya", { date: SAMEDI, heure: "20:00" }).bloque));
const FETES = [
  ["2027-04-22", "Pessah (1er jour)"],
  ["2027-04-28", "Pessah (dernier jour)"],
  ["2027-06-11", "Chavouot"],
  ["2027-10-02", "Roch Hachana"],
  ["2027-10-03", "Roch Hachana"],
  ["2027-10-11", "Yom Kippour"],
  ["2027-10-16", "Souccot"],
  ["2027-10-23", "Shemini Atzeret / Sim'hat Torah"],
];
for (const [date, nom] of FETES) test(`${date} = ${nom}`, () => vrai(Cal.nomsJourSacre(date).includes(nom), JSON.stringify(Cal.nomsJourSacre(date))));
test("jour ordinaire sans fete", () => egal(Cal.nomsJourSacre("2026-11-11"), []));
test("date hebraique 22 avril 2027 = 15 Nisan 5787", () => egal(Cal.dateHebraique("2027-04-22"), { jour: 15, mois: "Nisan", annee: 5787 }));
test("date hebraique 2 oct. 2027 = 1 Tishri 5788", () => egal(Cal.dateHebraique("2027-10-02"), { jour: 1, mois: "Tishri", annee: 5788 }));
test("prochaines fermetures : Chabbat du 13 nov.", () => egal(Cal.prochainesFermetures("2026-11-09", 1)[0].debut.date, "2026-11-13"));
test("disponible mardi 10h pendant 1 h", () => egal(Cal.verifierDisponibilite(MARDI, "10:00", 60), null));

/* ---------- Services : un formulaire par service ---------- */
section("Formulaires");
test("8 services", () => egal(S.SERVICES.map((s) => s.id).sort(), [...SERVICES_ID].sort()));
for (const s of SERVICES_ID) {
  test(`${s} : formulaire propre`, () => vrai(Array.isArray(S.FORMULAIRES[s]) && S.FORMULAIRES[s].length >= 3));
  test(`${s} : rattache a un espace`, () => vrai(["coursier", "transport"].includes(S.activiteDe(s))));
}
test("formulaires tous differents", () => {
  const sig = SERVICES_ID.map((s) => S.FORMULAIRES[s].map((c) => c.name).join(","));
  egal(new Set(sig).size, SERVICES_ID.length);
});
test("transport : date de retour visible seulement en aller-retour", () => {
  const v = S.valeursInitiales("transport");
  vrai(!S.champsVisibles("transport", v).some((c) => c.name === "dateRetour"));
  vrai(S.champsVisibles("transport", { ...v, typeTrajet: "ar" }).some((c) => c.name === "dateRetour"));
});
test("aeroport : numero de vol et terminal", () => vrai(["numeroVol", "terminal", "heureVol"].every((n) => S.FORMULAIRES.aeroport.some((c) => c.name === n))));
test("livraison : destinataire et telephone", () => vrai(["destinataire", "telDestinataire", "typeColis"].every((n) => S.FORMULAIRES.livraison.some((c) => c.name === n))));
test("courses : magasin, liste, avance", () => vrai(["magasin", "liste", "avanceArgent", "montantTicket"].every((n) => S.FORMULAIRES.courses.some((c) => c.name === n))));
test("demenagement : etages et ascenseur", () => vrai(["etageDepart", "ascenseurDepart", "etageArrivee", "ascenseurArrivee"].every((n) => S.FORMULAIRES.demenagement.some((c) => c.name === n))));
test("ramassage : telephone d'urgence et personnes autorisees", () => vrai(["telUrgence", "personnesAutorisees", "classe"].every((n) => S.FORMULAIRES.ramassage.some((c) => c.name === n))));
test("services coursier publics", () => egal(S.servicesDe("coursier").map((s) => s.id).sort(), ["courses", "demenagement", "livraison"]));
test("transport prive cache par defaut", () => vrai(!S.activitesVisibles({}).some((a) => (a.id || a) === "transport")));

/* ---------- Prix des services coursier et autres ---------- */
section("Prix des services");
const courses = (tp, n, extra = {}) => devis("courses", { typePrestation: tp, articles: String(n), livraison: A.netanya, date: MARDI, heure: "10:00", ...extra }, null);
test("recuperation 5 articles = 60", () => egal(courses("recuperer", 5).total, 60));
test("recuperation 1 article = 60", () => egal(courses("recuperer", 1).total, 60));
test("recuperation 6 articles = 80", () => egal(courses("recuperer", 6).total, 80));
test("recuperation 10 articles = 80", () => egal(courses("recuperer", 10).total, 80));
test("recuperation 11 articles = devis", () => egal(courses("recuperer", 11).devis, true));
test("courses faites 5 articles = 100", () => egal(courses("courses", 5).total, 100));
test("courses faites 10 articles = 120", () => egal(courses("courses", 10).total, 120));
test("courses faites 12 articles = devis", () => egal(courses("courses", 12).devis, true));
test("avance d'argent : 10 % du ticket", () => egal(courses("courses", 5, { avanceArgent: true, montantTicket: "200" }).total, 120));
test("avance d'argent 350 : + 35", () => egal(courses("courses", 5, { avanceArgent: true, montantTicket: "350" }).total - 100, 35));
test("sans avance : pas de frais de gestion", () => egal(courses("courses", 5, { montantTicket: "200" }).total, 100));
test("livraison Netanya = 60", () => egal(devis("livraison", { recuperation: A.netanya, livraison: A.netanya2, date: MARDI, heure: "10:00" }, T.netanya2).total, 60));
test("livraison 3 adresses plus chere", () =>
  vrai(devis("livraison", { recuperation: A.netanya, livraison: A.netanya2, nbLivraisons: "3", arretL2: A.netanya, arretL3: A.netanya2, date: MARDI, heure: "10:00" }, T.netanya2).total > 60));
test("Hatan & Kala = 220", () => egal(devis("hatan_kala", { depart: A.netanya, arrivee: A.netanya2, date: MARDI, heure: "10:00" }, T.netanya2).total, 220));
test("Hatan & Kala decoration + 150", () => egal(devis("hatan_kala", { depart: A.netanya, arrivee: A.netanya2, date: MARDI, heure: "10:00", decoration: true }, T.netanya2).total, 370));
const dem = (c, extra = {}) => devis("demenagement", { typeDemenagement: c, depart: A.netanya, arrivee: A.netanya2, date: MARDI, heure: "10:00", ...extra }, T.netanya2);
test("demenagement valises = 130", () => egal(dem("valises").total, 130));
test("demenagement cartons = 180", () => egal(dem("cartons").total, 180));
test("demenagement important = devis", () => egal(dem("important").devis, true));
test("demenagement 3e etage sans ascenseur plus cher", () => vrai(dem("cartons", { etageDepart: "3" }).total > 180));
test("demenagement 3e etage avec ascenseur = prix de base", () => egal(dem("cartons", { etageDepart: "3", ascenseurDepart: "oui" }).total, 180));
test("demenagement vers Tel-Aviv plus cher", () => vrai(devis("demenagement", { typeDemenagement: "cartons", depart: A.netanya, arrivee: A.tel_aviv, date: MARDI, heure: "10:00" }, T.tel_aviv).total > 180));
const att = (h, s = "0") => devis("attente", { dureeHeures: String(h), dureeSupp: s, date: MARDI, heure: "10:00" }, null);
test("mise a disposition 1 h = 100", () => egal(att(1).total, 100));
test("mise a disposition 2 h 30 = 250", () => egal(att(2, "30").total, 250));
test("mise a disposition 1 h 15 = 125", () => egal(att(1, "15").total, 125));
test("ramassage Netanya 1 trajet = 55", () => egal(devis("ramassage", { domicile: A.netanya, ecole: A.netanya2, date: MARDI, heure: "10:00" }, T.netanya2).total, 55));
test("ramassage 2 trajets = 2 x 55", () => egal(devis("ramassage", { domicile: A.netanya, ecole: A.netanya2, date: MARDI, heure: "10:00", trajetsRamassage: "deux", heure2: "15:30" }, T.netanya2).total, 110));

/* ---------- Zones ---------- */
section("Zones");
const ZONES_ATTENDUES = { netanya: "netanya", hadera: "hadera", herzliya_raanana: "herzliya_raanana", tel_aviv: "tel_aviv", haifa: "haifa", jerusalem: "jerusalem", hors_grille: null };
for (const z of ZONES) test(`zone de ${A[z].label}`, () => egal(detecterZone(A[z].label), ZONES_ATTENDUES[z]));
test("Boulevard Ben Gourion n'est pas l'aeroport", () => vrai(detecterZone("Boulevard Ben Gourion, Netanya") !== "ben_gurion"));
test("aeroport Ben Gourion reconnu", () => egal(detecterZone("Aéroport Ben Gourion (TLV)"), "ben_gurion"));
test("hebreu : Tel-Aviv", () => egal(detecterZone("רוטשילד, תל אביב"), "tel_aviv"));

/* ---------- Acomptes et annulations ---------- */
section("Acomptes et annulations");
const ACOMPTES = [[20, 10], [50, 10], [60, 12], [100, 20], [235, 47], [1000, 200]];
for (const [p, a] of ACOMPTES) test(`acompte de ${p} = ${a}`, () => egal(K.calculerAcompte(p), a));
test("acompte 20 %", () => egal(K.REGLAGES_PAR_DEFAUT.acomptePourcent, 20));
test("acompte minimum 10", () => egal(K.REGLAGES_PAR_DEFAUT.acompteMinimum, 10));
test("annulation 48 h avant = client", () => egal(K.casSuggere(48), "client"));
test("annulation 10 h avant = tardive", () => egal(K.casSuggere(10), "tardive"));
for (const c of ["client", "tardive", "absence"]) test(`annulation ${c} : acompte conserve`, () => egal(K.calculerAnnulation({ cas: c, prixConvenu: 200, encaisse: 40 }).fraisRetenus, 40));
test("annulation par Rebecca : remboursement integral", () => egal(K.calculerAnnulation({ cas: "rebecca", prixConvenu: 200, encaisse: 40 }).remboursement, 40));
test("paiement valide", () => egal(K.validerMouvement({ kind: "paiement", montant: 50, moyen: "Bit", resId: "x", date: MARDI }), null));
test("moyens de paiement", () => vrai(["Espèces", "Bit", "Revolut"].every((m) => TARIFS.moyensPaiement.includes(m))));

/* ---------- Credit, promos ---------- */
section("Credit et promos");
for (const [m, b] of [[50, 0], [200, 0], [300, 15], [500, 25], [1000, 50]]) test(`bonus de recharge ${m} = ${b}`, () => egal(Cr.bonusRecharge(m), b));
test("credit utilise en partie", () => egal(Cr.utiliserCredit(100, 30), { utilise: 30, reste: 70 }));
test("credit superieur au prix", () => egal(Cr.utiliserCredit(100, 300), { utilise: 100, reste: 0 }));
test("solde de credit", () => egal(Cr.soldeCredit([{ montant: 100 }, { montant: -30 }, { montant: 15 }]), 85));
test("remise 10 %", () => egal(P.calculerRemise(200, { type: "pourcentage", valeur: 10 }), 20));
test("remise en montant plafonnee au prix", () => egal(P.calculerRemise(30, { type: "montant", valeur: 50 }), 30));
test("code expire", () => egal(P.etatCode({ code: "XX1", actif: true, finLe: "2026-11-01", type: "montant", valeur: 5 }, "2026-11-09"), "expire"));
test("code normalise en majuscules", () => egal(P.normaliserCode(" bienvenue 10 "), "BIENVENUE10"));
test("code BIENVENUE10 de depart", () => vrai(P.CODES_DE_DEPART.some((c) => c.code === "BIENVENUE10")));
test("pourcentage plafonne a 50", () => egal(P.POURCENT_MAX, 50));

/* ---------- Courses ajoutees a la main, clients ---------- */
section("Ajout manuel et clients");
test("recu > prix = pourboire", () => egal(M.repartirPaiement(60, 65), { paiement: 60, pourboire: 5 }));
test("recu < prix = pas de pourboire", () => egal(M.repartirPaiement(60, 50), { paiement: 50, pourboire: 0 }));
test("montant avec virgule", () => egal(M.lireMontant("12,5"), 12.5));
test("cle client par telephone", () => egal(M.cleTel("054-738-0193"), "tel_0547380193"));
test("telephone +972 normalise", () => egal(Cl.telNormalise("+972 54-738-0193"), "0547380193"));
test("telephone deja normalise", () => egal(Cl.telNormalise("0547380193"), "0547380193"));
test("prenom extrait", () => egal(M.prenomDe("Naomie Cohen"), "Naomie"));
test("message de remerciement avec BIENVENUE10", () => vrai(M.messageRemerciement("Naomie").includes("BIENVENUE10")));

/* ---------- Finances, plafond osek patur ---------- */
section("Finances et plafond");
test("plafond par defaut 100 000", () => egal(F.PLAFOND_DEFAUT, 100000));
test("plafond 50 % ok", () => egal(F.etatPlafond(50000, 100000).niveau, "ok"));
test("plafond 85 % attention", () => egal(F.etatPlafond(85000, 100000).niveau, "attention"));
test("plafond depasse", () => egal(F.etatPlafond(101000, 100000).niveau, "depasse"));
test("annee bissextile 2028", () => egal(F.joursAnnee(2028), 366));
test("annee 2027 = 365 jours", () => egal(F.joursAnnee(2027), 365));
test("categories de depenses", () => vrai(["Carburant", "Péages", "Stationnement"].every((c) => D.CATEGORIES.includes(c))));

/* ---------- Enchainement des courses ---------- */
section("Enchainement");
const course = (id, heure, minutes, depart, arrivee) => ({ id, service: "transport", serviceTitre: "Transport", nom: id, date: MARDI, heure, minutesEstimees: minutes, statut: "acceptee", details: { depart, arrivee } });
test("marge par defaut 30 min", () => egal(E.MARGE_DEFAUT, 30));
test("courses trop proches = probleme", () => {
  const a = course("a", "10:00", 40, A.netanya, A.tel_aviv);
  const b = course("b", "11:00", 40, A.netanya, A.haifa);
  const liste = E.voisins(b, [a], E.datesDe(b));
  const r = E.verifier(liste, { [E.clePaire(A.tel_aviv, A.netanya)]: 40 });
  egal(r.ok, false);
});
test("courses bien espacees = ok", () => {
  const a = course("a", "10:00", 40, A.netanya, A.tel_aviv);
  const b = course("b", "14:00", 40, A.netanya, A.haifa);
  const liste = E.voisins(b, [a], E.datesDe(b));
  egal(E.verifier(liste, { [E.clePaire(A.tel_aviv, A.netanya)]: 40 }).ok, true);
});
test("retour a vide non bloque (course suivante dans la ville d'arrivee)", () => {
  const a = course("a", "10:00", 40, A.netanya, A.tel_aviv);
  const b = course("b", "11:40", 20, A.tel_aviv, A.netanya);
  const liste = E.voisins(b, [a], E.datesDe(b));
  egal(E.verifier(liste, { [E.clePaire(A.tel_aviv, A.tel_aviv)]: 0 }).ok, true);
});
test("chevauchement detecte", () => {
  const a = course("a", "10:00", 60, A.netanya, A.tel_aviv);
  const b = course("b", "10:30", 20, A.netanya, A.netanya2);
  egal(E.verifier(E.voisins(b, [a], E.datesDe(b)), {}).ok, false);
});
test("duree livraison 3 adresses", () => egal(E.dureeCourse({ service: "livraison", minutesEstimees: 20, details: { nbLivraisons: 3 } }).minutes, 50));
test("courses faites par Rebecca : 45 min sur place", () => egal(E.dureeCourse({ service: "courses", minutesEstimees: 10, details: { typePrestation: "courses" } }).minutes, 55));
test("trajet inconnu = 45 min", () => egal(E.DUREE_TRAJET_INCONNUE, 45));
test("heure lisible", () => egal(E.versHeure(615), "10h15"));
