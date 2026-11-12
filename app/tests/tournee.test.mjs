// TESTS DE « MA TOURNEE SCOLAIRE » (12 nov. 2026) - Rebecca Services
// Cas reel de Rebecca : sa fille a l'ecole pour 8h00, les deux filles de son amie prises a 8h15 et deposees au Gan
// avant 8h30 ; a 14h00 elle recupere les petites au Gan, les depose chez leur mere et y recupere sa fille.
// Adresses inventees pour les tests (aucune vraie adresse dans le programme).

import { test, egal, vrai, section } from "./outils.mjs";
import { TARIFS } from "../src/pricing/config.js";
import * as P from "../src/pricing/ramassagePlanning.js";
import * as To from "../src/pricing/tournee.js";

const lieu = (label, n) => ({ label, lat: 32.3 + n / 100, lon: 34.85 });
const MAISON = lieu("Maison, Netanya", 0);
const ECOLE = lieu("École A, Netanya", 1);
const AMIE = lieu("Chez l'amie, Netanya", 2);
const GAN = lieu("Gan, Netanya", 3);
const ECOLE_B = lieu("École B, Netanya", 4);
const CLIENTE = lieu("Chez la cliente, Netanya", 5);
const LOIN = lieu("École loin, Hadera", 30);

// Temps de route des tests : 2 min entre l'ecole A et l'amie, 4 min ailleurs, 25 min vers « loin »
const duree = (a, b) => {
  const loin = To.cleLieu(LOIN);
  if (a === loin || b === loin) return 25;
  const paire = [To.cleLieu(ECOLE), To.cleLieu(AMIE)];
  return paire.includes(a) && paire.includes(b) ? 2 : 4;
};
const T = JSON.parse(JSON.stringify(TARIFS));

const tous = () => To.JOURS.map(() => ({ actif: true, heure: "" }));
const TOURNEE = [
  To.trajetVide({ id: "f1", nom: "Ma fille (matin)", type: "matin", de: MAISON, a: ECOLE, heure: "08:00", jours: tous() }),
  To.trajetVide({ id: "f2", nom: "Les 2 filles (matin)", type: "matin", places: 2, de: AMIE, a: GAN, heurePrise: "08:15", heure: "08:30", jours: tous() }),
  To.trajetVide({ id: "f3", nom: "Les 2 filles (sortie)", type: "sortie", places: 2, de: GAN, a: AMIE, heure: "14:00", jours: tous() }),
  To.trajetVide({ id: "f4", nom: "Ma fille (chez l'amie)", type: "sortie", de: AMIE, a: MAISON, heure: "13:45", peutAttendre: true, jours: tous() }),
];
const heures = (r) => r.arrets.filter((x) => x.trajet).map((x) => `${To.texteArret(x).heure} ${x.sorte} ${x.trajet.id}`);

section("Ma tournee scolaire");

test("la tournee de Rebecca tient : ecole pour 8h00, prise a 8h15, Gan avant 8h30", () => {
  const r = To.evaluerJour(TOURNEE, 0, duree, T);
  egal(r.statut, "possible");
  egal(heures(r).slice(0, 4), ["07h46 prise f1", "08h00 depose f1", "08h15 prise f2", "08h29 depose f2"]);
});

test("sortie : les petites au Gan a 14h00, deposees chez leur mere, ou la fille de Rebecca attend", () => {
  const r = To.evaluerJour(TOURNEE, 0, duree, T);
  egal(heures(r).slice(4).sort(), ["14h00 prise f3", "14h14 depose f3", "14h14 prise f4", "14h28 depose f4"]);
});

test("tournee de depart : 4 trajets, sans nom ni adresse d'enfant dans le programme", () => {
  const d = To.tourneeDepart();
  egal([d.length, d[0].heure, d[1].heurePrise, d[1].heure, d[2].heure, d[2].places], [4, "08:00", "08:15", "08:30", "14:00", 2]);
  vrai(d.every((r) => r.de === null && r.a === null && /adresse/.test(To.manqueTrajet(r))));
  egal(To.evaluerJour(d, 0, duree, T).statut, "vide");
  egal(To.evaluerJour(d, 0, duree, T).incomplets.length, 4);
});

test("heure differente un jour (vendredi 12h00)", () => {
  const t = TOURNEE.map((r) => (r.id === "f3" ? { ...r, jours: r.jours.map((j, w) => (w === 5 ? { ...j, heure: "12:00" } : j)) } : r.id === "f4" ? { ...r, jours: r.jours.map((j, w) => (w === 5 ? { ...j, heure: "11:45" } : j)) } : r));
  vrai(heures(To.evaluerJour(t, 5, duree, T)).includes("12h00 prise f3"));
});

const enfant = (plus = {}) => ({ ...P.enfantVide(), ...plus });
const devis = (plus = {}) => ({ ...P.planVide(), domicile: CLIENTE, ecole: ECOLE_B, date: "", ...plus });

section("Tournee : est-ce que je peux accepter ?");

test("deux enfants d'une cliente a 14h15 : possible, avec les petites deja dans la voiture", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: [enfant({ prenom: "Noa", heureSortie: "14:15" }), enfant({ prenom: "Liel", heureSortie: "14:15" })] }), duree, T);
  egal(r.statut, "possible");
  egal(r.jours.length, 6);
  const j = r.jours[0].arrets.filter((x) => x.trajet);
  vrai(j.findIndex((x) => x.trajet.id === "devis-s0" && x.sorte === "prise") < j.findIndex((x) => x.trajet.id === "f3" && x.sorte === "depose"), heures(r.jours[0]).join(" / "));
});

test("sortie a 14h10 : serre, quelques minutes de retard", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: [enfant({ heureSortie: "14:10" })] }), duree, T);
  egal(r.statut, "serre");
  vrai(r.jours[0].retard > 0 && r.jours[0].retard <= 10);
});

test("ecole trop loin a la meme heure : impossible, avec l'arret qui coince", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ ecole: LOIN, enfants: [enfant({ prenom: "Noa", heureSortie: "14:00" })] }), duree, T);
  egal(r.statut, "impossible");
  vrai(/min après la sortie/.test(r.jours[0].probleme), r.jours[0].probleme);
});

test("trop d'enfants en meme temps : l'ordre change pour ne jamais depasser 4 places", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: [enfant({ heureSortie: "14:15" }), enfant({ heureSortie: "14:15" }), enfant({ heureSortie: "14:15" })] }), duree, T);
  let charge = 0;
  let max = 0;
  for (const x of r.jours[0].arrets.filter((a) => a.trajet && a.debut > 600)) {
    charge += x.sorte === "prise" ? x.trajet.places : -x.trajet.places;
    max = Math.max(max, charge);
  }
  vrai(max <= 4, "charge " + max);
});

test("4 enfants d'une cliente a la meme heure = un seul arret de 4 places, fait a part des autres enfants", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: [1, 2, 3, 4].map(() => enfant({ heureSortie: "15:00" })) }), duree, T);
  const prise = r.jours[0].arrets.find((x) => x.trajet && x.sorte === "prise" && x.trajet.places === 4);
  vrai(!!prise && r.statut === "possible", r.statut + " " + r.jours[0].probleme);
});

test("4 enfants a 4 heures differentes : reponse rapide", () => {
  const debut = Date.now();
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: ["13:30", "14:10", "14:40", "15:10"].map((h) => enfant({ heureSortie: h })) }), duree, T);
  vrai(["possible", "serre", "impossible"].includes(r.statut));
  vrai(Date.now() - debut < 4000, "trop lent : " + (Date.now() - debut) + " ms");
});

test("un trajet de 5 enfants : impossible (4 places)", () => {
  const r = To.evaluerJour([To.trajetVide({ nom: "Groupe", places: 5, de: GAN, a: AMIE, heure: "14:00", jours: tous() })], 0, duree, T);
  egal(r.statut, "impossible");
  vrai(/4 places/.test(r.probleme));
});

test("matin d'une cliente a 7h30 : possible avant la tournee", () => {
  const r = To.evaluerDevis(TOURNEE, devis({ enfants: [enfant({ sens: "matin", heureMatin: "07:15" })] }), duree, T);
  egal(r.statut, "possible");
});

test("devis d'un seul jour : seul ce jour est regarde ; trajets d'une autre periode ignores", () => {
  const vieux = To.trajetVide({ nom: "Ancien forfait", de: GAN, a: CLIENTE, heure: "14:00", jours: tous(), du: "2026-09-01", au: "2026-09-30" });
  const r = To.evaluerDevis([...TOURNEE, vieux], devis({ periode: "jour", date: "2026-11-16", enfants: [enfant({ heureSortie: "14:15" })] }), duree, T);
  egal(r.jours.map((j) => j.jour), ["Lundi"]);
  vrai(!r.jours[0].arrets.some((x) => x.trajet && x.trajet.nom === "Ancien forfait"));
});

test("temps de route inconnus : pas de reponse inventee", () => egal(To.evaluerJour(TOURNEE, 0, () => null, T).statut, "inconnu"));

test("reglages modifiables : marge de route de 15 min = la tournee ne tient plus", () => {
  const t = JSON.parse(JSON.stringify(T));
  t.tournee.margeRouteMinutes = 15;
  egal(To.evaluerJour(TOURNEE, 0, duree, t).statut, "impossible");
});

section("Tournee : enregistrement");

test("la cliente accepte : ses trajets s'ajoutent (une fois), le forfait au mois est garde", () => {
  const doc = { trajets: TOURNEE, forfaits: [], vacances: [] };
  const p = devis({ periode: "mois", enfants: [enfant({ prenom: "Noa", heureSortie: "14:15" }), enfant({ sens: "deux", heureMatin: "07:15", heureSortie: "16:00" })] });
  const d1 = To.ajouterALaTournee(doc, p, { km: 2, minutes: 5 }, "Mme Cohen", "2026-11-12");
  egal([d1.trajets.length, d1.forfaits.length, d1.forfaits[0].nom], [7, 1, "Mme Cohen"]);
  vrai(d1.trajets[4].nom === "Noa (sortie) - Mme Cohen" && d1.trajets[4].client === true);
  const d2 = To.ajouterALaTournee(d1, p, { km: 2, minutes: 5 }, "Mme Cohen", "2026-11-12");
  egal([d2.trajets.length, d2.forfaits.length], [7, 1]);
});

test("lecture de la base : ancienne liste, document complet, contenu abime", () => {
  egal(To.lireTournee("pas du json").trajets, []);
  egal(To.lireTournee("").existe, false);
  const doc = To.lireTournee(JSON.stringify({ trajets: TOURNEE, forfaits: [{ nom: "X", plan: devis(), routes: { km: 2, minutes: 5 } }, { nom: "abime" }], vacances: [{ nom: "Hanouka", du: "2026-12-06", au: "2026-12-11" }, { du: "n'importe quoi" }] }));
  egal([doc.trajets.length, doc.forfaits.length, doc.vacances.length, doc.existe], [4, 1, 1, true]);
  egal(To.lireTournee(JSON.stringify(TOURNEE)).trajets.length, 4);
  egal(To.lireTournee(JSON.stringify([{ places: 99, type: "x", heure: "25:00" }])).trajets[0].places, 8);
});

test("table des durees a partir de la matrice", () => {
  const lieux = To.lieuxDesTrajets(TOURNEE);
  egal(lieux.length, 4);
  const table = To.tableDurees(lieux, lieux.map((_, i) => lieux.map((__, j) => (i === j ? 0 : 3))));
  egal(table[`${To.cleLieu(MAISON)}>${To.cleLieu(ECOLE)}`], 3);
});

section("Tournee : depart et retour a la maison");

const AVEC = { domicile: MAISON };
const fil = (r) => r.arrets.map((x) => (x.maison ? `${To.enHeure(x.heure)} ${x.maison}` : x.pause ? `pause ${x.minutes}` : `${To.texteArret(x).heure} ${x.sorte} ${x.trajet.id}`));

test("matin : je pars de la maison, je rentre apres le Gan, libre a la maison jusqu'a la sortie", () => {
  const r = To.evaluerJour(TOURNEE, 0, duree, T, AVEC);
  egal(r.statut, "possible");
  egal(fil(r).slice(0, 7), ["07h46 depart", "07h46 prise f1", "08h00 depose f1", "08h15 prise f2", "08h29 depose f2", "08h43 retour", "pause 308"]);
  vrai(fil(r)[7] === "13h51 depart" && fil(r)[fil(r).length - 1] === "14h33 retour", fil(r).join(" / "));
});

test("moins de 30 min de libre entre deux moments : j'enchaine sans rentrer", () => {
  const t = [
    To.trajetVide({ id: "a", nom: "A", de: GAN, a: AMIE, heure: "12:00", jours: tous() }),
    To.trajetVide({ id: "b", nom: "B", de: ECOLE_B, a: CLIENTE, heure: "13:05", jours: tous() }),
  ];
  const f = fil(To.evaluerJour(t, 0, duree, T, AVEC));
  vrai(f.filter((x) => /depart/.test(x)).length === 1 && f.some((x) => /^pause/.test(x)), f.join(" / "));
  const t2 = t.map((r) => (r.id === "b" ? { ...r, heure: "14:30" } : r));
  egal(fil(To.evaluerJour(t2, 0, duree, T, AVEC)).filter((x) => /depart/.test(x)).length, 2);
});

test("marge affichee a chaque arret", () => {
  const r = To.evaluerJour(TOURNEE, 0, duree, T, AVEC);
  const m = r.arrets.filter((x) => x.trajet).map((x) => To.texteArret(x).marge);
  egal(m.slice(0, 4), ["", "juste à l'heure", "3 min d'avance", "1 min d'avance"]);
});

test("le domicile compte dans les lieux et se relit depuis la base", () => {
  egal(To.lieuxDesTrajets([], MAISON).length, 1);
  egal(To.lireTournee(JSON.stringify({ trajets: [], domicile: MAISON })).domicile, MAISON);
  egal(To.lireTournee(JSON.stringify({ trajets: [] })).domicile, null);
});
