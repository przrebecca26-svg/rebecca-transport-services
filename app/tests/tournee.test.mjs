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

section("Recherche d'adresse : Netanya d'abord");

{
  const { classerAdresses, distanceKm } = await import("../src/routing.js");
  const ramatGan = { label: "École Uziel, Ramat Gan", lat: 32.07, lon: 34.82 };
  const netanya = { label: "Uziel, Netanya", lat: 32.31, lon: 34.86 };
  test("classement", () => egal(classerAdresses([ramatGan, netanya, ramatGan]).map((a) => a.label), ["Uziel, Netanya", "École Uziel, Ramat Gan"]));
  test("distance Netanya - Ramat Gan autour de 27 km", () => vrai(Math.abs(distanceKm(ramatGan, netanya) - 27) < 3));
}

section("Tournee : ne rien retaper");

test("adresses deja saisies : la maison d'abord, chaque adresse une seule fois", () => {
  const c = To.adressesConnues(MAISON, TOURNEE);
  egal(c.map((x) => x.nom), ["Maison", "École A", "Chez l'amie", "Gan"]);
  egal(To.adressesConnues(null, To.tourneeDepart()), []);
});

test("trajet retour : adresses inversees, memes jours, heure a indiquer", () => {
  const r = To.trajetRetour(TOURNEE[1]);
  egal([r.nom, r.type, r.places, r.de, r.a, r.heure, r.jours[0].actif], ["Les 2 filles (retour)", "sortie", 2, GAN, AMIE, "", true]);
  vrai(/heure de sortie/.test(To.manqueTrajet(r)));
  egal(To.trajetRetour(r).type, "matin");
});

test("une activite le soir (basket) entre dans la journee comme un autre trajet", () => {
  const basket = [
    To.trajetVide({ id: "b1", nom: "Basket (aller)", type: "matin", de: MAISON, a: ECOLE_B, heure: "18:00", jours: tous() }),
    To.trajetVide({ id: "b2", nom: "Basket (retour)", type: "sortie", de: ECOLE_B, a: MAISON, heure: "19:30", jours: tous() }),
  ];
  const r = To.evaluerJour([...TOURNEE, ...basket], 0, duree, T, { domicile: MAISON });
  egal(r.statut, "possible");
  vrai(heures(r).includes("18h00 depose b1") && heures(r).includes("19h30 prise b2"), heures(r).join(" / "));
});

test("adresses differentes : un trajet par enfant, un seul arret s'ils partent du meme endroit", () => {
  const morceaux = To.separerTrajet(TOURNEE[1]);
  egal(morceaux.map((r) => [r.nom, r.places]), [["Les 2 filles (matin) - enfant 1", 1], ["Les 2 filles (matin) - enfant 2", 1]]);
  vrai(morceaux[0].id === "f2" && morceaux[1].id !== "f2");
  egal(To.separerTrajet(TOURNEE[0]).length, 1);
  const autre = [morceaux[0], { ...morceaux[1], a: ECOLE_B }];
  const r = To.evaluerJour([TOURNEE[0], ...autre], 0, duree, T);
  vrai(r.arrets.filter((x) => x.trajet && x.sorte === "depose").length === 3, heures(r).join(" / "));
});

test("devis : toutes les ecoles differentes, l'ecole du haut n'est plus demandee", () => {
  const p = devis({ ecole: null, enfants: [enfant({ heureSortie: "12:00", autreEcole: true, ecole: ECOLE_B }), enfant({ heureSortie: "12:00", autreEcole: true, ecole: GAN })] });
  egal(P.manquePlan(p), "");
  egal(P.ecolesDuPlan(p).length, 2);
});

section("Tournee : mes lieux par leur nom");

test("je nomme une adresse une fois, elle est proposee par son nom ensuite", () => {
  let lieux = To.nommerLieu([], ECOLE, "École Ouziel");
  lieux = To.nommerLieu(lieux, GAN, "Gan");
  egal(To.nomDuLieu(ECOLE, MAISON, lieux), "École Ouziel");
  egal(To.nomDuLieu(MAISON, MAISON, lieux), "Maison");
  egal(To.nomDuLieu(AMIE, MAISON, lieux), "");
  egal(To.adressesConnues(MAISON, TOURNEE, lieux).map((x) => [x.nom, !!x.sansNom]), [["Maison", false], ["École Ouziel", false], ["Gan", false], ["Chez l'amie", true]]);
});

test("changer ou retirer un nom", () => {
  let lieux = To.nommerLieu([], ECOLE, "Ecole");
  lieux = To.nommerLieu(lieux, ECOLE, "École Ouziel");
  egal(lieux.map((l) => l.nom), ["École Ouziel"]);
  egal(To.nommerLieu(lieux, ECOLE, " "), []);
  egal(To.nommerLieu(lieux, { label: "tapé sans choisir" }, "X"), lieux);
});

test("le deroule de la journee affiche le nom du lieu ; les lieux se relisent depuis la base", () => {
  const lieux = To.nommerLieu([], GAN, "Gan des petites");
  const r = To.evaluerJour(TOURNEE, 0, duree, T);
  const arret = r.arrets.find((x) => x.trajet && x.trajet.id === "f3" && x.sorte === "prise");
  egal(To.texteArret(arret, (a) => To.nomDuLieu(a, MAISON, lieux)).lieu, "Gan des petites");
  egal(To.texteArret(arret).lieu, "Gan");
  const doc = To.lireTournee(JSON.stringify({ trajets: [], lieux: [...lieux, { nom: "", adresse: ECOLE }, { nom: "Sans adresse" }] }));
  egal(doc.lieux, lieux);
});

section("Waze : le point exact");
{
  const { lienWazePoint } = await import("../src/pricing/navigation.js");
  test("avec des coordonnees : seulement les coordonnees (jamais le texte, qui envoyait vers un homonyme)", () => {
    egal(lienWazePoint({ label: "Uziel, Netanya", lat: 32.31, lon: 34.86 }), "https://waze.com/ul?ll=32.31%2C34.86&navigate=yes");
  });
  test("sans coordonnees : recherche par le texte", () => vrai(lienWazePoint({ label: "Rue Herzl, Netanya" }).includes("q=Rue%20Herzl%2C%20Netanya")));
  test("numero ajoute a une rue (point approximatif) : Waze recoit le texte avec le numero", () => {
    egal(lienWazePoint({ label: "Nahal Dolev 10, Neot Shaked, Netanya", lat: 32.28, lon: 34.86, approx: true }), "https://waze.com/ul?q=Nahal%20Dolev%2010%2C%20Neot%20Shaked%2C%20Netanya&navigate=yes");
  });
  test("adresse exacte avec numero (Google, suggestion complete) : le point exact", () => {
    egal(lienWazePoint({ label: "École Uziel, Rue Exemple 12, Netanya", lat: 32.3, lon: 34.85 }), "https://waze.com/ul?ll=32.3%2C34.85&navigate=yes");
  });
  const { avecNumero } = await import("../src/routing.js");
  test("le numero tape est garde quand la suggestion ne l'a pas", () => {
    const rue = { label: "Nahal Dolev, Neot Shaked, Netanya", lat: 32.28, lon: 34.86 };
    egal(avecNumero(rue, "nahal dolev 10 netanya"), { label: "Nahal Dolev 10, Neot Shaked, Netanya", lat: 32.28, lon: 34.86, approx: true });
    egal(To.lireTournee(JSON.stringify({ trajets: [], domicile: avecNumero(rue, "dolev 10") })).domicile.approx, true);
    egal(avecNumero(rue, "nahal dolev netanya"), rue);
    egal(avecNumero({ label: "10 Nahal Besor, Netanya", lat: 1, lon: 2 }, "nahal 10").label, "10 Nahal Besor, Netanya");
    egal(avecNumero({ label: "Herzl 100, Netanya", lat: 1, lon: 2 }, "herzl 10").label, "Herzl 100, Netanya");
    egal(avecNumero(rue, "דולב 12א").label, "Nahal Dolev 12א, Neot Shaked, Netanya");
  });
}

section("Devis en attente");

test("un devis garde se retrouve, se remplace quand on le modifie, se supprime", () => {
  const doc = To.lireTournee("");
  egal(doc.devis, []);
  const p1 = devis({ enfants: [enfant({ prenom: "Noa", heureSortie: "14:15" })] });
  const r1 = To.garderDevis(doc, { nom: " Mme Cohen ", plan: p1, routes: { km: 2, minutes: 5 }, total: 285, creeLe: "2026-11-12" });
  egal([r1.doc.devis.length, r1.doc.devis[0].nom, r1.doc.devis[0].total], [1, "Mme Cohen", 285]);
  const r2 = To.garderDevis(r1.doc, { id: r1.id, nom: "Mme Cohen", plan: { ...p1, periode: "mois" }, total: 1220, creeLe: "2026-11-13" });
  egal([r2.doc.devis.length, r2.doc.devis[0].plan.periode, r2.doc.devis[0].total], [1, "mois", 1220]);
  const r3 = To.garderDevis(r2.doc, { nom: "", plan: p1, total: null });
  egal(r3.doc.devis.map((d) => d.nom), ["Cliente", "Mme Cohen"]);
  egal(To.retirerDevis(r3.doc, r1.id).devis.map((d) => d.nom), ["Cliente"]);
});

test("les devis en attente se relisent depuis la base ; contenu abime ignore", () => {
  const p1 = devis({ enfants: [enfant({ heureSortie: "14:15" })] });
  const relu = To.lireTournee(JSON.stringify({ trajets: [], devis: [{ id: "d1", nom: "A", creeLe: "2026-11-12", total: 285, plan: p1, routes: {} }, { nom: "sans plan" }, null] }));
  egal(relu.devis.map((d) => [d.id, d.nom, d.total, d.plan.enfants.length]), [["d1", "A", 285, 1]]);
});

test("devis garde avec le telephone et le message ; refuse puis remis en attente", () => {
  const p1 = devis({ enfants: [enfant({ heureSortie: "14:15" })] });
  const r = To.garderDevis(To.lireTournee(""), { nom: "Mme Cohen", telephone: " 054 111 2233 ", plan: p1, total: 285, message: "Bonjour, voici mon devis" });
  const d = r.doc.devis[0];
  egal([d.telephone, d.message, d.statut], ["054 111 2233", "Bonjour, voici mon devis", "attente"]);
  const refuse = To.statutDevis(r.doc, r.id, "refuse");
  egal(refuse.devis[0].statut, "refuse");
  egal(To.statutDevis(refuse, r.id, "attente").devis[0].statut, "attente");
  egal(To.lireTournee(JSON.stringify(refuse)).devis[0].statut, "refuse");
});

section("Ma tournee dans mon calendrier");

test("chaque moment de la journee, du depart au retour a la maison, devient un creneau bloque", () => {
  const c = To.creneauxDeLaTournee(TOURNEE, duree, MAISON, T);
  egal(c, [
    { jours: [0, 1, 2, 3, 4, 5], debut: "07:45", fin: "08:45", actif: true },
    { jours: [0, 1, 2, 3, 4, 5], debut: "13:50", fin: "14:35", actif: true },
  ]);
});

test("sans domicile : du depart vers le premier arret au dernier arret ; un jour different a son propre creneau", () => {
  const t = TOURNEE.map((r) => (r.id === "f3" ? { ...r, jours: r.jours.map((j, w) => (w === 5 ? { ...j, heure: "12:00" } : j)) } : r.id === "f4" ? { ...r, jours: r.jours.map((j, w) => (w === 5 ? { ...j, heure: "11:45" } : j)) } : r));
  const c = To.creneauxDeLaTournee(t, duree, null, T);
  vrai(c.some((x) => x.jours.join() === "5" && x.debut === "11:55"), JSON.stringify(c));
  vrai(c.some((x) => x.jours.join() === "0,1,2,3,4" && x.debut === "13:55"), JSON.stringify(c));
});

test("temps de route inconnus : rien n'est propose ; tournee vide : un creneau inactif (jamais les anciens creneaux)", () => {
  egal(To.creneauxDeLaTournee(TOURNEE, () => null, MAISON, T), null);
  egal(To.creneauxDeLaTournee([], duree, MAISON, T), []);
  egal(To.creneauxAEnregistrer([]), [{ jours: [0], debut: "00:00", fin: "00:05", actif: false }]);
  vrai(To.memesCreneaux([], []));
  vrai(!To.memesCreneaux(To.creneauxDeLaTournee(TOURNEE, duree, MAISON, T), []));
});

{
  const { lireCreneaux } = await import("../src/fermetures.js").catch(() => ({}));
  if (lireCreneaux) {
    test("lus par le Calendrier sans perte", () => {
      const c = To.creneauxDeLaTournee(TOURNEE, duree, MAISON, T);
      egal(lireCreneaux(JSON.stringify(c)), c);
      egal(lireCreneaux(JSON.stringify(To.creneauxAEnregistrer([])))[0].actif, false);
    });
  }
}

section("Confier des trajets a Jeremy pour une date");

const LUNDI = "2026-11-16";

test("ce jour-la, les trajets confies sortent de ma journee ; mes creneaux ne gardent que le reste", () => {
  const sans = To.creneauxDeLaDate(TOURNEE, LUNDI, [], duree, MAISON, T);
  egal(sans, [{ debut: "07:45", fin: "08:45" }, { debut: "13:50", fin: "14:35" }]);
  const transferts = [{ id: "x", date: LUNDI, trajets: ["f3", "f4"], membre: "jeremy", nomMembre: "Jérémy" }];
  egal(To.creneauxDeLaDate(TOURNEE, LUNDI, transferts, duree, MAISON, T), [{ debut: "07:45", fin: "08:45" }]);
  egal(To.creneauxParDate(TOURNEE, transferts, duree, MAISON, T, "2026-11-12"), { [LUNDI]: [{ debut: "07:45", fin: "08:45" }] });
  egal(To.creneauxParDate(TOURNEE, transferts, duree, MAISON, T, "2026-11-20"), {});
  egal(To.creneauxParDate(TOURNEE, transferts, () => null, MAISON, T), null);
});

test("tout confie : rien ne me bloque ce jour-la (liste vide)", () => {
  const t = [{ id: "x", date: LUNDI, trajets: ["f1", "f2", "f3", "f4"], membre: "j" }];
  egal(To.creneauxDeLaDate(TOURNEE, LUNDI, t, duree, MAISON, T), []);
});

test("la mission du coequipier : etapes dans l'ordre, heures, debut et fin ; message WhatsApp", () => {
  const m = To.missionDuTransfert(TOURNEE, ["f3", "f4"], LUNDI, duree, T);
  egal(m.etapes.map((e) => `${e.heure} ${e.texte}`).sort(), ["14h00 Prendre Les 2 filles (sortie)", "14h14 Déposer Les 2 filles (sortie)", "14h14 Prendre Ma fille (chez l'amie)", "14h28 Déposer Ma fille (chez l'amie)"]);
  egal([m.debut, m.fin], ["13:45", "14:35"]);
  const msg = To.messageMission(m, "Jérémy");
  vrai(msg.startsWith("Bonjour Jérémy") && msg.includes("lundi 16 novembre") && msg.includes("14h00 : Prendre Les 2 filles (sortie) (Gan, Netanya)"), msg);
  egal(To.missionDuTransfert(TOURNEE, [], LUNDI, duree, T), null);
});

test("un trajet hors de ses dates ne compte pas ; lecture des transferts", () => {
  const borne = To.trajetVide({ id: "b", nom: "B", de: GAN, a: AMIE, heure: "16:00", jours: tous(), du: "2026-12-01" });
  egal(To.trajetsDuJourDate([borne], LUNDI), []);
  const relu = To.lireTournee(JSON.stringify({ trajets: [], transferts: [{ date: LUNDI, trajets: ["f3"], membre: "j", nomMembre: "Jérémy" }, { date: "x", trajets: ["a"], membre: "j" }, { date: LUNDI, trajets: [], membre: "j" }] }));
  egal(relu.transferts.map((x) => [x.date, x.trajets, x.membre]), [[LUNDI, ["f3"], "j"]]);
  egal(To.lireTournee("").transferts, []);
});

// ---- Temps libre pendant une activite (12 nov. 2026, 16h07) ----
section("Ma tournee : temps libre pendant une activite");
const BASKET = lieu("Basket, Netanya", 6);
const ACTIVITE = [
  To.trajetVide({ id: "b1", nom: "Ma fille (basket aller)", type: "matin", de: MAISON, a: BASKET, heure: "17:45", jours: tous() }),
  To.trajetVide({ id: "b2", nom: "Ma fille (basket retour)", type: "sortie", de: BASKET, a: MAISON, heure: "18:45", jours: tous() }),
];

test("basket d'une heure : seuls l'aller et le retour sont bloques, le milieu est libre", () => {
  const r = To.evaluerJour(ACTIVITE, 2, duree, T, { domicile: MAISON });
  egal(r.statut, "possible");
  const libre = r.arrets.find((x) => x.pause && x.libre);
  vrai(!!libre);
  egal([To.enHeure(libre.du), To.enHeure(libre.au)], ["17h50", "18h40"]);
  const moments = To.momentsDuJour(r).map((m) => `${To.enHeure(m.debut)}-${To.enHeure(m.fin)}`);
  egal(moments, ["17h31-17h50", "18h40-19h04"]);
});

test("basket : le calendrier public ne bloque que les deux trajets", () => {
  const c = To.creneauxDeLaTournee(ACTIVITE, duree, MAISON, T);
  egal(c.map((x) => `${x.debut}-${x.fin}`), ["17:30-17:50", "18:40-19:05"]);
});

test("attente courte (moins de 20 min) : on reste sur place, rien n'est libere", () => {
  const court = ACTIVITE.map((r) => (r.id === "b2" ? { ...r, heure: "18:00" } : r));
  const r = To.evaluerJour(court, 2, duree, T, { domicile: MAISON });
  egal(r.arrets.filter((x) => x.pause && x.libre).length, 0);
  egal(To.momentsDuJour(r).length, 1);
});

test("la tournee du matin de Rebecca reste d'un seul bloc", () => {
  const r = To.evaluerJour(TOURNEE, 0, duree, T, { domicile: MAISON });
  egal(r.arrets.filter((x) => x.pause && x.libre).length, 0);
});

section("Ma journee dans mon calendrier (fil des etapes)");
test("fil du basket : partir de la maison, deposer, libre, partir, recuperer, retour", () => {
  const j = To.journeeDeLaDate(ACTIVITE, "2026-11-11", [], duree, MAISON, T);
  const f = To.filTournee(j, null, MAISON);
  egal(f.map((e) => e.genre), ["maison", "arret", "libre", "partir", "arret", "maison"]);
  egal([f[0].texte, f[5].texte], ["Partir de la maison avec Ma fille", "De retour à la maison avec Ma fille"]);
  const libre = f.find((e) => e.genre === "libre");
  egal([libre.heure, libre.jusqua], ["17h50", "18h40"]);
  vrai(f.every((e, i) => i === 0 || e.min >= f[i - 1].min), "dans l'ordre des heures");
});
test("fil : trajets confies a Jeremy ce jour-la retires ; jour sans trajet = null", () => {
  egal(To.journeeDeLaDate(ACTIVITE, "2026-11-11", [{ date: "2026-11-11", trajets: ["b1", "b2"] }], duree, MAISON, T), null);
  egal(To.journeeDeLaDate(ACTIVITE.map((r) => ({ ...r, jours: r.jours.map((x, w) => ({ ...x, actif: w === 0 })) })), "2026-11-11", [], duree, MAISON, T), null);
});
