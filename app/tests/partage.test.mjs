// TESTS DU TRAJET PARTAGE (15 nov. 2026) - Rebecca Services
// Cas reel : une cliente (1 fille a midi, 1 garcon a 15h30) partage les trajets avec sa voisine
// (1 fille a midi, 2 garcons a 15h30). Chaque famille paie pour ses enfants, ou parts egales.

import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A, TRAJETS as TR, MAINTENANT } from "./donnees.mjs";
import * as S from "../src/services.js";
import { calculer } from "../src/pricing/engine.js";
import { TARIFS } from "../src/pricing/config.js";
import * as P from "../src/pricing/ramassagePlanning.js";
import { partagerNote, facteurPersonnes, prixFr } from "../src/pricing/partage.js";

const ROUTE = { km: 2, minutes: 5 };
const T = JSON.parse(JSON.stringify(TARIFS));
T.calendrier.creneauxPersonnels = [];
T.calendrier.fermeturesExceptionnelles = [];
T.calendrier.vacancesScolaires = [];
const enfant = (plus = {}) => ({ ...P.enfantVide(), ...plus });
const base = (plus = {}) => ({ ...P.planVide(), domicile: A.netanya, ecole: A.netanya2, periode: "mois", ...plus });

section("Trajet partage");

test("regle : 2 personnes = 1 trajet, chaque personne en plus = supplement", () => {
  egal([1, 2, 3, 4].map((n) => facteurPersonnes(n, "ramassage", T)), [1, 1, 1.5, 2]);
  egal([1, 2, 3, 4].map((n) => facteurPersonnes(n, "transport", T)), [1, 1, 1.25, 1.5]);
});

test("partage de la note : par enfant (montants de chaque famille) et parts egales", () => {
  const f = [{ nom: "A", personnes: 2, montant: 1190 }, { nom: "B", personnes: 3, montant: 1785 }];
  egal(partagerNote(2975, f, "enfant").parts.map((p) => p.montant), [1190, 1785]);
  egal(partagerNote(2975, f, "egal").parts.map((p) => p.montant), [1487.5, 1487.5]);
  egal(partagerNote(3570, [...f, { nom: "C", personnes: 1, montant: 595 }], "egal").parts.map((p) => p.montant), [1190, 1190, 1190]);
  egal(partagerNote(100, [{ nom: "A", personnes: 1 }, { nom: "B", personnes: 1 }, { nom: "C", personnes: 1 }], "egal").parts.map((p) => p.montant), [33.34, 33.33, 33.33]);
  egal(partagerNote(500, [{ nom: "A", personnes: 2 }]), null);
  egal(prixFr(1487.5), "1 487,50");
});

// Les 5 enfants : famille 0 = la cliente, famille 1 = sa voisine
const casReel = (mode = "enfant") => {
  const p = P.reglerNombreFamilles(base({ modePartage: mode }), 2);
  p.enfants = [
    enfant({ prenom: "Fille", heureSortie: "12:00", famille: 0 }),
    enfant({ prenom: "Garçon", heureSortie: "15:30", famille: 0 }),
    enfant({ prenom: "Fille voisine", heureSortie: "12:00", famille: 1 }),
    enfant({ prenom: "Garçon voisin 1", heureSortie: "15:30", famille: 1 }),
    enfant({ prenom: "Garçon voisin 2", heureSortie: "15:30", famille: 1 }),
  ];
  p.autresFamilles[0].nom = "Voisine";
  return p;
};

test("cas reel : 2 trajets par jour, 3 garcons = 1 enfant en plus sur le trajet de 15h30", () => {
  const r = P.calculerPlan(casReel(), ROUTE, T, { nomCliente: "Cliente" });
  const x = r.details;
  egal(x.nbTrajets, 54); // mois le plus long : 27 jours x 2 trajets
  egal(x.enPlus, [{ prix: 28, nombre: 27 }]);
  egal(x.familles.map((f) => [f.nom, f.enfants]), [["Cliente", 2], ["Voisine", 3]]);
  egal(x.familles.map((f) => f.pourcentage), [0.2, 0.2]); // forfait mois + plusieurs enfants
  egal(r.total, x.familles[0].total + x.familles[1].total);
  egal(x.partage.parts.map((p) => p.montant), x.familles.map((f) => f.total));
  // la voisine (3 enfants) paie environ 1,5 fois la part de la cliente (2 enfants)
  vrai(Math.abs(x.familles[1].total / x.familles[0].total - 1.5) < 0.02, "rapport des parts");
});

test("cas reel : la cliente seule avec ses 2 enfants paie plus que sa part partagee", () => {
  const seule = P.calculerPlan(base({ enfants: [enfant({ heureSortie: "12:00" }), enfant({ heureSortie: "15:30" })] }), ROUTE, T);
  const partage = P.calculerPlan(casReel(), ROUTE, T, { nomCliente: "Cliente" });
  vrai(partage.details.familles[0].total < seule.total, "partager coute moins cher");
  vrai(partage.total > seule.total, "Rebecca gagne plus pour les enfants en plus");
});

test("parts egales : le total divise par 2, total identique pour Rebecca", () => {
  const a = P.calculerPlan(casReel("enfant"), ROUTE, T);
  const b = P.calculerPlan(casReel("egal"), ROUTE, T);
  egal(a.total, b.total);
  egal(b.details.partage.parts.map((p) => p.montant), [a.total / 2, a.total / 2]);
});

test("message pour la cliente : enfants par famille et partage de la note", () => {
  const p = casReel();
  const r = P.calculerPlan(p, ROUTE, T, { nomCliente: "Cliente" });
  const m = P.messagePlan(p, r);
  vrai(m.includes("2 familles"), m);
  vrai(m.includes("Garçon voisin 2 (Voisine)"), m);
  vrai(m.includes("Partage de la note"), m);
  vrai(m.includes(`• Voisine (3 enfants) : ${prixFr(r.details.familles[1].total)} ₪`), m);
});

test("familles : changer le nombre d'enfants d'une famille ne touche pas l'autre", () => {
  let p = P.reglerNombreFamilles(base(), 3);
  egal(p.enfants.map((e) => e.famille), [0, 1, 2]);
  p = { ...p, enfants: P.reglerEnfantsFamille(p, 1, 2) };
  egal(p.enfants.map((e) => e.famille), [0, 1, 1, 2]);
  p = P.reglerNombreFamilles(p, 2);
  egal(p.enfants.map((e) => e.famille), [0, 1, 1]);
  egal(P.sousPlanFamille(p, 1).enfants.length, 2);
});

test("une seule famille : prix inchange (2 enfants a la meme heure = 1 trajet)", () => {
  const r = P.calculerPlan({ ...P.planVide(), domicile: A.netanya, ecole: A.netanya2, date: "2026-11-15", enfants: [enfant({ heureSortie: "16:00" }), enfant({ heureSortie: "16:00" })] }, ROUTE, T);
  egal([r.details.nbTrajets, r.total], [6, 285]);
});

test("une famille, 3 enfants a la meme heure : supplement pour le 3e", () => {
  const p = { ...P.planVide(), domicile: A.netanya, ecole: A.netanya2, periode: "jour", date: "2026-11-15", enfants: [1, 2, 3].map(() => enfant({ heureSortie: "16:00" })) };
  const r = P.calculerPlan(p, ROUTE, T);
  egal(r.total, 55 + 28);
});

test("plus de 4 enfants sur un trajet : Rebecca est prevenue", () => {
  const p = P.reglerNombreFamilles(base({ periode: "jour", date: "2026-11-15" }), 2);
  p.enfants = [0, 0, 0, 1, 1].map((f) => enfant({ heureSortie: "16:00", famille: f }));
  const r = P.calculerPlan(p, ROUTE, T);
  vrai(r.aConfirmer.some((a) => a.includes("deux voyages")), JSON.stringify(r.aConfirmer));
});

section("Trajet partage sur le site");

const site = (service, champs, route) => calculer(S.versDemande(service, { ...S.valeursInitiales(service), date: "2026-11-15", heure: "16:30", nom: "Cliente", ...champs }, route, MAINTENANT), T);

test("ramassage sur le site : 2 familles, 1 + 2 enfants, par enfant", () => {
  const r = site("ramassage", { domicile: A.netanya, ecole: A.netanya2, trajetsRamassage: "apres", nbFamilles: "2", personnesF1: "1", nomF2: "Voisine", personnesF2: "2" }, ROUTE);
  egal(r.total, 55 + 28);
  egal(r.details.partage.parts.map((p) => [p.nom, p.personnes, p.montant]), [["Cliente", 1, 27.67], ["Voisine", 2, 55.33]]);
});

test("ramassage sur le site : parts egales entre 3 familles", () => {
  const r = site("ramassage", { domicile: A.netanya, ecole: A.netanya2, trajetsRamassage: "apres", nbFamilles: "3", personnesF1: "1", nomF2: "B", personnesF2: "1", nomF3: "C", personnesF3: "1", modePartage: "egal" }, ROUTE);
  egal(r.total, 83);
  egal(r.details.partage.parts.map((p) => p.montant), [27.68, 27.66, 27.66]);
});

test("ramassage sur le site : 1 famille, 1 enfant = prix inchange", () => {
  const r = site("ramassage", { domicile: A.netanya, ecole: A.netanya2, trajetsRamassage: "apres" }, ROUTE);
  egal([r.total, r.details.partage], [55, undefined]);
});

test("aeroport : 3 passagers = +25 % du trajet, partage par personne", () => {
  const seul = site("aeroport", { direction: "vers", adresse: A.netanya, personnesF1: "2" }, TR.ben_gurion);
  const r = site("aeroport", { direction: "vers", adresse: A.netanya, nbFamilles: "2", personnesF1: "1", nomF2: "Amis", personnesF2: "2" }, TR.ben_gurion);
  const trajet = seul.lignes.filter((l) => l.base).reduce((n, l) => n + l.montant, 0);
  vrai(r.lignes.some((l) => l.libelle.startsWith("Passager en plus : 1 x " + Math.ceil(trajet * 0.25))), JSON.stringify(r.lignes));
  egal(r.total, seul.total + Math.ceil(trajet * 0.25));
  egal(r.details.partage.parts.map((p) => p.personnes), [1, 2]);
  egal(Math.round(r.details.partage.parts.reduce((n, p) => n + p.montant, 0) * 100) / 100, r.total);
});

test("message WhatsApp du site : partage de la note", () => {
  const v = { ...S.valeursInitiales("transport"), depart: A.netanya2, arrivee: A.tel_aviv, date: "2026-11-15", heure: "10:00", nom: "Cliente", telephone: "0500000000", nbFamilles: "2", personnesF1: "2", nomF2: "Amis", personnesF2: "2", modePartage: "egal" };
  const r = calculer(S.versDemande("transport", v, TR.tel_aviv, MAINTENANT), T);
  const m = S.messageWhatsApp("transport", v, r);
  vrai(m.includes("Partage de la note en parts égales (2 familles)"), m);
});
