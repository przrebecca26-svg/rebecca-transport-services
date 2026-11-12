// TESTS DU DEVIS RAMASSAGE SCOLAIRE A PLUSIEURS ENFANTS (12 nov. 2026) - Rebecca Services
// Cas reel : deux enfants, meme ecole, sorties a des heures differentes, devis au mois.

import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A, MAINTENANT } from "./donnees.mjs";
import * as S from "../src/services.js";
import { calculer } from "../src/pricing/engine.js";
import { TARIFS } from "../src/pricing/config.js";
import * as P from "../src/pricing/ramassagePlanning.js";

const ROUTE = { km: 2, minutes: 5 };
const enfant = (plus = {}) => ({ ...P.enfantVide(), ...plus });
const plan = (plus = {}) => ({ ...P.planVide(), domicile: A.netanya, ecole: A.netanya2, date: "2026-11-15", ...plus });
const T = JSON.parse(JSON.stringify(TARIFS));
T.calendrier.creneauxPersonnels = [];
T.calendrier.fermeturesExceptionnelles = [];
const VACANCES = T.calendrier.vacancesScolaires;
T.calendrier.vacancesScolaires = []; // les tests ci-dessous choisissent eux-memes leurs vacances
const calc = (p) => P.calculerPlan(p, ROUTE, T);

section("Ramassage a plusieurs enfants");

test("meme prix par trajet que le site (55 ₪ dans Netanya)", () => {
  const v = { ...S.valeursInitiales("ramassage"), domicile: A.netanya, ecole: A.netanya2, date: "2026-11-15", heure: "16:30", trajetsRamassage: "apres" };
  const site = calculer(S.versDemande("ramassage", v, ROUTE, MAINTENANT), T);
  const r = calc(plan({ periode: "jour", enfants: [enfant({ heureSortie: "16:30" })] }));
  egal(site.details.parTrajet, 55);
  egal(r.details.parTrajet, 55);
  egal(r.total, site.total);
});

test("une semaine, 1 enfant, 6 jours = le forfait du site (285 ₪)", () => {
  const r = calc(plan({ enfants: [enfant({ heureSortie: "16:30" })] }));
  egal([r.details.nbTrajets, r.details.reduction, r.total], [6, 15, 285]);
});

test("2 enfants a des heures differentes = 2 trajets par jour", () => {
  const r = calc(plan({ enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] }));
  egal([r.details.nbTrajets, r.details.brut, r.details.reduction, r.total], [12, 660, 20, 530]);
  egal(r.details.parEnfant, [6, 6]);
});

test("2 enfants a la meme heure = 1 seul trajet", () => {
  const r = calc(plan({ enfants: [enfant({ heureSortie: "16:00" }), enfant({ heureSortie: "16:00" })] }));
  egal([r.details.nbTrajets, r.total], [6, 265]);
});

test("heure differente selon le jour : meme heure que l'autre enfant ce jour-la = trajet commun", () => {
  const e1 = enfant({ heureSortie: "12:00" });
  e1.jours[1] = { actif: true, heure: "16:00" }; // lundi : sort a 16h comme l'autre
  const r = calc(plan({ enfants: [e1, enfant({ heureSortie: "16:00" })] }));
  egal(r.details.nbTrajets, 11);
});

test("3 jours dans la semaine = -10 %", () => {
  const e = enfant({ heureSortie: "13:00" });
  [3, 4, 5].forEach((w) => (e.jours[w].actif = false));
  const r = calc(plan({ enfants: [e] }));
  egal([r.details.jours, r.details.reduction, r.total], [3, 10, 150]);
});

test("un seul jour : pas de reduction, seul le jour de la date compte", () => {
  const r = calc(plan({ periode: "jour", date: "2026-11-16", enfants: [enfant({ heureSortie: "11:00" }), enfant({ heureSortie: "15:00" })] }));
  egal([r.details.nbTrajets, r.details.reduction, r.total], [2, 0, 110]);
});

test("matin + sortie = 2 trajets par jour pour un enfant", () => {
  const r = calc(plan({ periode: "jour", enfants: [enfant({ sens: "deux", heureMatin: "07:30", heureSortie: "13:00" })] }));
  egal(r.total, 110);
});

test("mois, 1 enfant : -15 %", () => {
  const r = calc(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" })] }));
  egal([r.details.nbTrajets, r.details.reduction, r.total], [26, 15, 1220]);
});

test("reduction tapee par Rebecca dans le devis (remplace la proposee), 0 = aucune", () => {
  const p = plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" })] });
  egal(calc({ ...p, reduction: "10" }).total, 1290);
  egal(calc({ ...p, reduction: "0" }).total, 1430);
  egal(calc({ ...p, reduction: "12,5" }).details.reduction, 12.5);
  egal(calc({ ...p, reduction: "abc" }).details.reduction, 15);
  egal(calc({ ...p, periode: "jour", reduction: "10" }).total, 50);
});

test("enfants dans deux ecoles differentes : un prix par ecole, jamais de trajet commun", () => {
  const p = plan({ enfants: [enfant({ heureSortie: "16:00" }), enfant({ heureSortie: "16:00", autreEcole: true, ecole: A.hadera })] });
  egal(P.ecolesDuPlan(p).length, 2);
  const r = P.calculerPlan(p, { [P.cleEcole(A.netanya2)]: ROUTE, [P.cleEcole(A.hadera)]: { km: 16, minutes: 22 } }, T);
  egal(r.details.nbTrajets, 12);
  egal(r.details.groupes.length, 2);
  egal(r.lignes.length, 3);
  vrai(r.details.groupes[1].prix > 55, JSON.stringify(r.details.groupes));
  egal(P.manquePlan(plan({ enfants: [enfant({ heureSortie: "16:00", autreEcole: true })] })), "Enfant 1 : indique l'adresse de son école.");
  egal(P.calculerPlan(p, { [P.cleEcole(A.netanya2)]: ROUTE }, T).ok, false);
});

test("mois : du 15 nov. au 14 dec. 2026 = 26 jours d'ecole, 2 enfants = 52 trajets, -20 %", () => {
  egal(P.finDuMois("2026-11-15"), "2026-12-14");
  const r = calc(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] }));
  egal([r.details.jours, r.details.nbTrajets, r.details.brut, r.details.reduction, r.total], [26, 52, 2860, 20, 2290]);
  egal(r.details.parTrajetNet, 44.04);
});

test("mois : fin de mois (31 janv. -> 27 fev.)", () => egal(P.finDuMois("2027-01-31"), "2027-02-27"));

test("mois : jours sans ecole retires", () => {
  const r = calc(plan({ periode: "mois", sansEcoleDu: "2026-12-06", sansEcoleAu: "2026-12-11", enfants: [enfant({ heureSortie: "12:00" })] }));
  egal([r.details.nbTrajets, r.details.retires.length], [20, 6]);
});

test("Chabbat jamais compte, fete retiree", () => {
  const r = calc(plan({ periode: "mois", date: "2027-04-18", enfants: [enfant({ heureSortie: "12:00" })] }));
  vrai(r.details.retires.some((x) => /Pessah/.test(x.motif)), JSON.stringify(r.details.retires));
});

test("reduction du mois modifiable dans les tarifs", () => {
  const t = JSON.parse(JSON.stringify(T));
  t.ramassage.reductionMois = 0.1;
  t.ramassage.reductionPlusieursEnfants = 0.25;
  egal(P.calculerPlan(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" })] }), ROUTE, t).total, 1290);
  egal(P.calculerPlan(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] }), ROUTE, t).details.reduction, 25);
});

test("ce qui manque : adresse, date, heure d'un jour", () => {
  vrai(/domicile/.test(P.manquePlan(P.planVide())));
  vrai(/école/.test(P.manquePlan(plan({ ecole: null }))));
  egal(P.manquePlan(plan({ date: "", enfants: [enfant({ heureSortie: "12:00" })] })), "");
  vrai(/date/.test(P.manquePlan(plan({ periode: "jour", date: "", enfants: [enfant({ heureSortie: "12:00" })] }))));
  egal(P.manquePlan(plan({ enfants: [enfant()] })), "Enfant 1 : indique l'heure de sortie du dimanche.");
  egal(P.manquePlan(plan({ enfants: [enfant({ prenom: "Noa", sens: "deux", heureSortie: "12:00" })] })), "Noa : indique l'heure du matin.");
  egal(P.manquePlan(plan({ periode: "jour", date: "2026-11-14", enfants: [enfant({ heureSortie: "12:00" })] })), "Ce jour est un samedi : choisis un autre jour.");
});

test("nombre d'enfants : 1 a 4 (4 places), sans perdre la saisie", () => {
  const l = P.reglerNombreEnfants([enfant({ prenom: "Noa" })], 3);
  egal([l.length, l[0].prenom], [3, "Noa"]);
  egal(P.reglerNombreEnfants(l, 9).length, 4);
  egal(P.reglerNombreEnfants(l, 1).length, 1);
});

test("creneau deja pris dans l'agenda de Rebecca : signale pour elle, pas dans le message", () => {
  const t = JSON.parse(JSON.stringify(T));
  t.calendrier.fermeturesExceptionnelles = [{ debut: "2026-11-16T11:00", fin: "2026-11-16T13:00", motif: "Rendez-vous" }];
  const p = plan({ enfants: [enfant({ heureSortie: "12:00" })] });
  const r = P.calculerPlan(p, ROUTE, t);
  egal(r.details.conflits.length, 1);
  vrai(!P.messagePlan(p, r).includes("Rendez-vous"));
});

test("message pour la cliente", () => {
  const e1 = enfant({ prenom: "Noa", heureSortie: "12:00" });
  e1.jours[1].heure = "11:00";
  const p = plan({ periode: "mois", enfants: [e1, enfant({ heureSortie: "16:00" })] });
  const m = P.messagePlan(p, calc(p));
  vrai(m.includes("de vos 2 enfants, du 15 novembre au 14 décembre (26 jours d'école)"), m);
  vrai(m.includes("• Noa : sortie lundi à 11h00 ; dimanche, mardi, mercredi, jeudi, vendredi à 12h00"), m);
  vrai(m.includes("52 trajets x 55 ₪ = 2 860 ₪") && m.includes("Réduction forfait 20 % : -570 ₪") && m.includes("Total : 2 290 ₪"), m);
  vrai(!m.includes("Rentabilité") && m.includes("Rebecca Services"), m);
});

test("pre-remplissage de l'ajout manuel : forfait entier au premier trajet", () => {
  const p = plan({ enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] });
  egal(P.planVersAjoutManuel(p, calc(p)), { service: "ramassage", date: "2026-11-15", heure: "12:00", adresses: { domicile: A.netanya, ecole: A.netanya2 }, direction: "vers", magasin: "", prix: "530" });
});

section("Ramassage : devis sans date et forfait au mois");

test("semaine sans date = semaine complete (meme prix qu'une semaine sans fete)", () => {
  const p = plan({ date: "", enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] });
  const r = calc(p);
  egal([r.details.nbTrajets, r.details.sansDate, r.total], [12, true, 530]);
  vrai(P.messagePlan(p, r).includes("pour une semaine complète (6 jours d'école)"));
});

test("mois sans date = le mois le plus long : 4 semaines + 3 jours = 27 jours, prix maximum", () => {
  const p = plan({ periode: "mois", date: "", enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] });
  const r = calc(p);
  egal([r.details.jours, r.details.nbTrajets, r.details.brut, r.total], [27, 54, 2970, 2380]);
  const m = P.messagePlan(p, r);
  vrai(m.includes("pour un mois complet (jusqu'à 27 jours d'école)") && !m.includes("Chabbat"), m);
});

test("mois sans date : les 3 jours en plus sont les plus charges", () => {
  const e = enfant({ heureSortie: "12:00" });
  [0, 1, 4, 5].forEach((w) => (e.jours[w].actif = false)); // seulement mardi et mercredi
  egal(calc(plan({ periode: "mois", date: "", enfants: [e] })).details.nbTrajets, 10);
});

test("un seul jour : la date reste obligatoire", () => egal(calc(plan({ periode: "jour", date: "", enfants: [enfant({ heureSortie: "12:00" })] })).ok, false));

const FORFAIT = { plan: plan({ periode: "mois", date: "", enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "16:00" })] }), routes: ROUTE };

test("forfait accepte : mois sans vacances", () => {
  const b = P.bilanMois(FORFAIT, 2026, 11, [], T); // novembre 2026 : 30 jours, 4 samedis
  egal([b.complet, b.jours, b.reel], [2380, 26, 2290]);
});

test("forfait accepte : vacances retirees = ce que je dois encaisser a la place du prix complet", () => {
  const b = P.bilanMois(FORFAIT, 2026, 12, [{ nom: "Hanouka", du: "2026-12-06", au: "2026-12-11" }], T);
  egal([b.complet, b.jours, b.retires.length, b.reel, b.difference], [2380, 21, 6, 1850, 530]);
});

test("forfait accepte : fete du calendrier retiree toute seule (Pessah, avril 2027)", () => {
  const b = P.bilanMois(FORFAIT, 2027, 4, [], T);
  vrai(b.retires.some((x) => /Pessah/.test(x.motif)) && b.reel < b.complet, JSON.stringify(b));
});

section("Ramassage : calendrier des vacances scolaires 2026-2027");

const AVEC_VACANCES = JSON.parse(JSON.stringify(T));
AVEC_VACANCES.calendrier.vacancesScolaires = VACANCES;

test("une seule liste de vacances, celle du calendrier (Hanoucca du 6 au 12 decembre 2026)", () => {
  egal(VACANCES.length, 6);
  egal(VACANCES.find((v) => /Hanoucca/.test(v.motif)), { debut: "2026-12-06", fin: "2026-12-12", motif: "Vacances de Hanoucca", actif: true });
});

test("devis au mois avec date : Hanoucca retiree toute seule, avec son nom", () => {
  const r = P.calculerPlan(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" })] }), ROUTE, AVEC_VACANCES);
  egal([r.details.nbTrajets, r.details.retires.length, r.details.retires[0].motif], [20, 6, "Vacances de Hanoucca"]);
});

test("forfait accepte : decembre 2026 et avril 2027 (Pessah) plus bas que le mois complet", () => {
  const dec = P.bilanMois(FORFAIT, 2026, 12, [], AVEC_VACANCES);
  const avr = P.bilanMois(FORFAIT, 2027, 4, [], AVEC_VACANCES);
  egal([dec.jours, dec.retires.length], [21, 6]);
  egal(avr.jours, 12);
  vrai(avr.reel < dec.reel && dec.reel < dec.complet);
});

test("aout 2027 : vacances d'ete, rien a encaisser", () => egal(P.bilanMois(FORFAIT, 2027, 8, [], AVEC_VACANCES).reel, 0));

test("devis sans date : toujours le mois complet, sans vacances", () => {
  egal(P.calculerPlan(plan({ periode: "mois", date: "", enfants: [enfant({ heureSortie: "12:00" })] }), ROUTE, AVEC_VACANCES).details.jours, 27);
});

test("jours sans ecole ajoutes par Rebecca : retires aussi des devis et du calendrier", () => {
  const t = JSON.parse(JSON.stringify(AVEC_VACANCES));
  t.calendrier.vacancesAjoutees = [{ debut: "2026-11-16", fin: "2026-11-16", motif: "Grève" }];
  const r = P.calculerPlan(plan({ periode: "mois", enfants: [enfant({ heureSortie: "12:00" })] }), ROUTE, t);
  vrai(r.details.retires.some((x) => x.date === "2026-11-16" && x.motif === "Grève"), JSON.stringify(r.details.retires));
});
