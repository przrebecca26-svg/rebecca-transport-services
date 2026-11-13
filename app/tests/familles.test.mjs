// TESTS DES FAMILLES ET ENFANTS (12 nov. 2026) - Rebecca Services
// Les fiches du Repertoire (ecole, activites, jours, heures) fabriquent la tournee scolaire.
// Prenoms et adresses inventes pour les tests (aucune vraie donnee dans le programme).

import { test, egal, vrai, section } from "./outils.mjs";
import { TARIFS } from "../src/pricing/config.js";
import * as F from "../src/pricing/familles.js";
import * as To from "../src/pricing/tournee.js";
import * as P from "../src/pricing/ramassagePlanning.js";
import * as R from "../src/pricing/repertoire.js";

const lieu = (label, n) => ({ label, lat: 32.3 + n / 100, lon: 34.85 });
const [MAISON, ECOLE, AMIE, GAN, GYMNASE, TRAVAIL] = ["Maison", "École A", "Chez l'amie", "Gan", "Gymnase", "Bureau"].map((x, n) => lieu(x + ", Netanya", n));
const duree = () => 4;
const NOMS = new Map([[MAISON, "maison"], [ECOLE, "ecole"], [AMIE, "amie"], [GAN, "gan"], [GYMNASE, "gymnase"], [TRAVAIL, "travail"]].map(([l, n]) => [To.cleLieu(l), n]));
const cleDe = (l) => NOMS.get(To.cleLieu(l));
const T = JSON.parse(JSON.stringify(TARIFS));
const jours = (actifs, plus = {}) => To.JOURS.map((_, w) => ({ actif: actifs.includes(w), arrivee: "", sortie: "", ...(plus[w] || {}) }));

const MOI = {
  ...F.familleVide(), id: "moi", nom: "Moi", domicile: MAISON, adresses: [{ nom: "Travail", adresse: TRAVAIL }],
  enfants: [{ id: "e1", prenom: "Dana", age: "enfant", naissance: "", ageAnnees: 0, ageNote: 0, rdv: [
    { ...F.rdvVide("ecole"), id: "r1", lieu: ECOLE, heureArrivee: "08:00", heureSortie: "13:30", jours: jours([0, 1, 2, 3, 4], { 4: { sortie: "12:00" } }), priseAilleurs: AMIE, attend: true },
    { ...F.rdvVide("activite"), id: "r2", nom: "Basket", lieu: GYMNASE, heureArrivee: "18:00", heureSortie: "19:30", jours: jours([1, 3]) },
  ] }],
};
const AMIE_F = {
  ...F.familleVide(), id: "amie", nom: "Mon amie", domicile: AMIE,
  enfants: ["Liel", "Joy"].map((prenom, k) => ({ id: "a" + k, prenom, rdv: [{ ...F.rdvVide("ecole"), id: "g" + k, lieu: GAN, heurePrise: "08:15", heureArrivee: "08:30", heureSortie: "14:00", jours: jours([0, 1, 2, 3, 4]) }] })),
};

section("Familles et enfants");

test("une fiche complete ne manque de rien ; sans domicile ou sans heure, on le dit", () => {
  egal(F.manqueRdv(MOI, MOI.enfants[0].rdv[0]), "");
  vrai(/domicile/.test(F.manqueRdv({ ...MOI, domicile: null }, MOI.enfants[0].rdv[0])));
  vrai(/sortie/.test(F.manqueRdv(MOI, { ...MOI.enfants[0].rdv[0], heureSortie: "", jours: jours([0]) })));
  vrai(/aucun jour/.test(F.manqueRdv(MOI, { ...F.rdvVide("activite"), lieu: GYMNASE })));
  egal(F.manqueRdv(MOI, { ...F.rdvVide("ecole"), depose: false, recupere: false }), "");
});

test("les fiches fabriquent les trajets : ecole aller et retour, activite aller et retour", () => {
  const t = F.trajetsDesFamilles([MOI]);
  egal(t.map((r) => [r.nom, r.type, r.heure]), [["Dana · École (aller)", "matin", "08:00"], ["Dana · École (retour, m'attend ailleurs)", "sortie", "13:30"], ["Dana · Basket (aller)", "matin", "18:00"], ["Dana · Basket (retour)", "sortie", "19:30"]]);
  egal([t[0].de, t[0].a], [MAISON, ECOLE]);
  egal([t[1].de, t[1].a, t[1].peutAttendre], [AMIE, MAISON, true]); // elle m'attend chez l'amie
  egal(To.heureTrajet(t[1], 4), "12:00"); // jeudi : sortie plus tot
  egal(t[2].jours.map((j) => j.actif), [false, true, false, true, false, false]);
  vrai(t.every((r) => To.manqueTrajet(r) === ""));
});

test("« je le depose » seulement : pas de trajet retour", () => {
  const f = { ...MOI, enfants: [{ ...MOI.enfants[0], rdv: [{ ...MOI.enfants[0].rdv[0], recupere: false }] }] };
  egal(F.trajetsDesFamilles([f]).map((r) => r.type), ["matin"]);
});

test("la tournee du jour sort des fiches : deux soeurs au meme Gan = un seul arret, le basket le soir", () => {
  const tous = F.trajetsDesFamilles([MOI, AMIE_F]);
  const lundi = To.evaluerJour(tous, 1, duree, T, { domicile: MAISON });
  egal(lundi.statut, "possible");
  const arrets = lundi.arrets.filter((x) => x.trajet);
  vrai(arrets.some((x) => x.sorte === "prise" && x.trajet.places === 2), "les deux soeurs ensemble");
  vrai(arrets.some((x) => /Basket \(aller\)/.test(x.trajet.nom)));
  const dimanche = To.evaluerJour(tous, 0, duree, T, { domicile: MAISON });
  vrai(!dimanche.arrets.some((x) => x.trajet && /Basket/.test(x.trajet.nom)));
});

test("une cliente accepte un devis : sa famille devient une fiche, avec les dates du forfait", () => {
  const e1 = { ...P.enfantVide(), prenom: "Noa", heureSortie: "14:15" };
  e1.jours[5].actif = false;
  const plan = { ...P.planVide(), domicile: TRAVAIL, ecole: ECOLE, periode: "mois", date: "2026-11-15", enfants: [e1, { ...P.enfantVide(), sens: "deux", heureMatin: "07:15", heureSortie: "16:00", autreEcole: true, ecole: GAN }] };
  const f = F.familleDuDevis(plan, "Mme Cohen");
  egal([f.nom, f.domicile, f.du, f.au, f.enfants.map((e) => e.prenom)], ["Mme Cohen", TRAVAIL, "2026-11-15", "2026-12-14", ["Noa", "Enfant 2"]]);
  const t = F.trajetsDesFamilles([f]);
  egal(t.map((r) => [r.nom, r.type]), [["Noa · École (retour)", "sortie"], ["Enfant 2 · École (aller)", "matin"], ["Enfant 2 · École (retour)", "sortie"]]);
  egal([t[0].de, t[0].a, t[0].jours[5].actif, To.heureTrajet(t[0], 0)], [ECOLE, TRAVAIL, false, "14:15"]);
  egal([t[1].a, t[1].heurePrise, t[1].du, t[1].au], [GAN, "07:15", "2026-11-15", "2026-12-14"]);
  vrai(t.every((r) => To.manqueTrajet(r) === ""));
  egal(To.trajetActif(t[0], 0, "2027-01-10", "2027-01-16"), false); // forfait termine : plus compte
});

test("lecture de la base : fiches propres, contenu abime ignore", () => {
  const relu = F.lireFamilles(JSON.parse(JSON.stringify([MOI, AMIE_F, null, "x", { nom: "Vide" }])));
  egal(relu.length, 3);
  egal(relu[0], JSON.parse(JSON.stringify(MOI)));
  egal([relu[2].enfants, relu[2].adresses, relu[2].domicile], [[], [], null]);
  egal(F.lireFamilles("pas une liste"), []);
});

test("le document du repertoire garde lieux, corrections et familles", () => {
  const json = JSON.stringify({ lieux: [], corrections: [], familles: [MOI] });
  egal(F.lireFamilles(R.famillesBrutes(json))[0].nom, "Moi");
  egal(R.famillesBrutes(JSON.stringify([])), []);
});

test("recherche par nom : un enfant, une activite, une adresse favorite", () => {
  const source = { lieux: [], clients: [], familles: [MOI, AMIE_F] };
  egal(R.chercherRepertoire("dana", 5, source).map((x) => x.titre), ["Dana · École", "Dana · Basket"]);
  egal(R.chercherRepertoire("basket", 5, source)[0].adresse, GYMNASE);
  egal(R.chercherRepertoire("travail", 5, source).map((x) => [x.titre, x.adresse]), [["Moi · Travail", TRAVAIL]]);
  egal(R.chercherRepertoire("mon amie", 5, source)[0].titre, "Mon amie · Domicile");
});

test("forfait au mois d'une cliente : garde sans dupliquer les trajets (ils viennent de la fiche)", () => {
  const plan = { ...P.planVide(), domicile: TRAVAIL, ecole: ECOLE, periode: "mois", date: "", enfants: [{ ...P.enfantVide(), heureSortie: "14:15" }] };
  const doc = { trajets: [], forfaits: [], vacances: [], lieux: [], domicile: MAISON };
  const d = To.ajouterALaTournee(doc, plan, { km: 2, minutes: 5 }, "Mme Cohen", "2026-11-12", { sansTrajets: true });
  egal([d.trajets.length, d.forfaits.length, d.forfaits[0].nom], [0, 1, "Mme Cohen"]);
  egal(To.ajouterALaTournee(doc, { ...plan, periode: "semaine" }, {}, "X", "", { sansTrajets: true }), doc);
});

test("elle m'attend chez l'amie seulement certains jours : ces jours-la je la prends la-bas, les autres a l'ecole", () => {
  const r = { ...MOI.enfants[0].rdv[0], joursAilleurs: [true, false, true, false, false, false] };
  const t = F.trajetsDesFamilles([{ ...MOI, enfants: [{ ...MOI.enfants[0], rdv: [r] }] }]).filter((x) => x.type === "sortie");
  egal(t.map((x) => [x.nom, x.de, x.peutAttendre, x.jours.map((j) => (j.actif ? 1 : 0)).join("")]), [
    ["Dana · École (retour)", ECOLE, false, "010110"],
    ["Dana · École (retour, m'attend ailleurs)", AMIE, true, "101000"],
  ]);
  egal(To.heureTrajet(t[0], 4), "12:00");
  egal(F.lireFamilles([{ enfants: [{ rdv: [{ priseAilleurs: AMIE }] }] }])[0].enfants[0].rdv[0].joursAilleurs, [true, true, true, true, true, true]);
});

section("Familles : doublons");

test("la meme famille saisie deux fois est signalee (nom contenu dans l'autre, telephone, domicile + enfant)", () => {
  const a = { ...AMIE_F, id: "x1", nom: "Alexia" };
  const b = { ...AMIE_F, id: "x2", nom: "Alexia Dahan" };
  egal(F.doublonsFamilles([MOI, a, b]).length, 1);
  vrai(/« Alexia » et « Alexia Dahan » : même nom, enfant\(s\) en commun : liel, joy/.test(F.doublonsFamilles([MOI, a, b])[0].texte));
  egal([F.doublonsFamilles([MOI, a, b])[0].a, F.doublonsFamilles([MOI, a, b])[0].b], ["x1", "x2"]);
  egal(F.doublonsFamilles([{ ...MOI, nom: "Rebecca", telephone: "054-111 22 33" }, { ...AMIE_F, nom: "Autre", telephone: "+972541112233" }]).length, 1);
  egal(F.doublonsFamilles([{ ...MOI, nom: "A" }, { ...MOI, id: "m2", nom: "B" }]).length, 1); // meme domicile, meme enfant
});

test("deux familles differentes ne sont pas des doublons ; un enfant saisi deux fois est signale", () => {
  egal(F.doublonsFamilles([MOI, AMIE_F]), []);
  egal(F.doublonsFamilles([{ ...MOI, nom: "Anna" }, { ...AMIE_F, nom: "Joanna" }]), []);
  const deuxFois = { ...AMIE_F, enfants: [AMIE_F.enfants[0], { ...AMIE_F.enfants[0], id: "bis" }] };
  vrai(/Liel.*deux fois/.test(F.doublonsFamilles([deuxFois])[0].texte));
  egal(F.fusionnerDoublon([deuxFois], deuxFois.id, null)[0].enfants.map((e) => e.prenom), ["Liel"]);
});

test("trajet ajoute a la main en double avec une fiche", () => {
  const fiches = F.trajetsDesFamilles([AMIE_F]);
  const manuels = [To.trajetVide({ nom: "Vieux trajet Gan", type: "sortie", de: GAN, a: AMIE }), To.trajetVide({ nom: "Autre", type: "sortie", de: ECOLE, a: MAISON })];
  egal(F.doublonsTrajets(manuels, fiches).map((r) => r.nom), ["Vieux trajet Gan"]);
});

section("Familles : fusion de deux fiches en double");

test("on garde la fiche la plus complete et on recupere ce qui lui manque dans l'autre", () => {
  // Premiere saisie : incomplete (pas de telephone, une seule fille, pas d'heure de sortie)
  const vieille = { ...F.familleVide(), id: "v", nom: "Alexia", domicile: { label: "tapé à la main" }, adresses: [{ nom: "Travail", adresse: TRAVAIL }],
    enfants: [{ id: "v1", prenom: "Liel", rdv: [{ ...F.rdvVide("ecole"), lieu: GAN, heureArrivee: "08:30", jours: jours([0, 1, 2, 3, 4]) }, { ...F.rdvVide("activite"), nom: "Danse", lieu: GYMNASE, heureArrivee: "17:00", heureSortie: "18:00", jours: jours([2]) }] }] };
  const neuve = { ...AMIE_F, id: "n", nom: "Alexia Dahan", telephone: "0541112233" };
  const liste = F.fusionnerDoublon([MOI, vieille, neuve], "v", "n");
  egal(liste.map((f) => f.id), ["moi", "v"]);
  const f = liste[1];
  egal([f.nom, f.telephone, f.domicile, f.adresses.length], ["Alexia Dahan", "0541112233", AMIE, 1]);
  egal(f.enfants.map((e) => e.prenom), ["Liel", "Joy"]);
  const liel = f.enfants[0];
  egal(liel.rdv.map((r) => F.nomRdv(r)), ["École", "Danse"]); // l'activite de l'ancienne fiche est recuperee
  egal([liel.rdv[0].heurePrise, liel.rdv[0].heureArrivee, liel.rdv[0].heureSortie], ["08:15", "08:30", "14:00"]);
  egal(F.doublonsFamilles(liste), []);
  vrai(F.trajetsDesFamilles(liste).every((r) => To.manqueTrajet(r) === ""));
});

test("fusion : peu importe l'ordre, rien n'est perdu ; identifiants inconnus = rien ne change", () => {
  const a = { ...AMIE_F, id: "a", nom: "Alexia" };
  const b = { ...AMIE_F, id: "b", nom: "Alexia Dahan", telephone: "0541112233" };
  const f1 = F.fusionnerDoublon([a, b], "a", "b")[0];
  const f2 = F.fusionnerDoublon([a, b], "b", "a")[0];
  egal([f1.nom, f1.telephone, f1.enfants.length, f2.nom, f2.telephone, f2.enfants.length], ["Alexia Dahan", "0541112233", 2, "Alexia Dahan", "0541112233", 2]);
  egal(F.fusionnerDoublon([a, b], "a", "zzz"), [a, b]);
});

section("Mes trajets : c'est moi qui choisis (14h45)");

test("rien n'entre dans la tournee sans choix ; un choix propose l'agenda tout coche", () => {
  egal(F.trajetsDesChoix([MOI, AMIE_F], []), []);
  const c = F.choixPour(MOI, MOI.enfants[0], MOI.enfants[0].rdv[0], "aller");
  egal(c.jours.map((j) => (j.actif ? 1 : 0)).join(""), "111110");
  egal(F.titreChoix([MOI], c), "Dana · École · Aller");
  const t = F.trajetsDesChoix([MOI], [c]);
  egal(t.map((r) => [r.nom, r.type, r.de, r.a, To.heureTrajet(r, 0)]), [["Dana · École (aller)", "matin", MAISON, ECOLE, "08:00"]]);
  egal(To.manqueTrajet(t[0]), "");
});

test("je decoche un jour, je change une heure : seul ce choix change, l'agenda reste", () => {
  const c = F.choixPour(MOI, MOI.enfants[0], MOI.enfants[0].rdv[0], "aller");
  c.jours[2].actif = false;
  c.jours[0].heure = "07:45";
  const t = F.trajetsDesChoix([MOI], [c])[0];
  egal([t.jours.map((j) => (j.actif ? 1 : 0)).join(""), To.heureTrajet(t, 0), To.heureTrajet(t, 1)], ["110110", "07:45", "08:00"]);
  egal(MOI.enfants[0].rdv[0].heureArrivee, "08:00");
});

test("retour : le dimanche je la recupere chez l'amie a 14h15, les autres jours a l'ecole a l'heure de l'agenda", () => {
  const c = F.choixPour(MOI, MOI.enfants[0], MOI.enfants[0].rdv[0], "retour");
  c.jours[0] = { actif: true, heure: "14:15", lieu: AMIE };
  const t = F.trajetsDesChoix([MOI], [c]);
  egal(t.map((r) => [r.nom, r.de, r.peutAttendre, r.jours.map((j) => (j.actif ? 1 : 0)).join("")]), [
    ["Dana · École (retour, m'attend ailleurs)", AMIE, true, "100000"],
    ["Dana · École (retour)", ECOLE, false, "011110"],
  ]);
  egal([To.heureTrajet(t[0], 0), To.heureTrajet(t[1], 1), To.heureTrajet(t[1], 4)], ["14:15", "13:30", "12:00"]);
  vrai(t.every((r) => To.manqueTrajet(r) === ""));
});

test("la journee se calcule avec les trajets choisis : elle est prise chez l'amie quand je depose ses filles", () => {
  const c1 = F.choixPour(MOI, MOI.enfants[0], MOI.enfants[0].rdv[0], "retour");
  c1.jours[0] = { actif: true, heure: "14:15", lieu: AMIE };
  const amies = AMIE_F.enfants.map((e) => F.choixPour(AMIE_F, e, e.rdv[0], "retour"));
  const j = To.evaluerJour(F.trajetsDesChoix([MOI, AMIE_F], [c1, ...amies]), 0, duree, T, { domicile: MAISON });
  egal(j.statut, "possible");
  const a = j.arrets.filter((x) => x.trajet).map((x) => `${x.sorte} ${cleDe(x.lieu)}`);
  egal(a, ["prise gan", "depose amie", "prise amie", "depose maison"].map((x) => x));
});

test("fiche supprimee du repertoire : son choix ne donne plus de trajet ; lecture de la base", () => {
  const c = F.choixPour(AMIE_F, AMIE_F.enfants[0], AMIE_F.enfants[0].rdv[0], "aller");
  egal(F.trajetsDesChoix([MOI], [c]), []);
  egal(F.titreChoix([MOI], c), "Fiche supprimée du Répertoire");
  const relu = F.lireChoix(JSON.parse(JSON.stringify([c, null, { famille: "x" }, { ...c, sens: "bizarre", jours: [{ actif: true, heure: "25:99", lieu: AMIE }] }])));
  egal(relu.length, 2);
  egal(relu[0], JSON.parse(JSON.stringify(c)));
  egal([relu[1].sens, relu[1].jours[0], relu[1].jours[5].actif], ["aller", { actif: true, heure: "", lieu: AMIE }, false]);
  egal(To.lireTournee(JSON.stringify({ trajets: [], choix: [c] })).choix.length, 1);
  egal(To.lireTournee("").choix, []);
});

test("devis accepte : les trajets de la cliente sont choisis d'office", () => {
  const plan = { ...P.planVide(), domicile: TRAVAIL, ecole: ECOLE, enfants: [{ ...P.enfantVide(), prenom: "Noa", sens: "deux", heureMatin: "07:15", heureSortie: "14:15" }] };
  const f = F.familleDuDevis(plan, "Mme Cohen", "0541112233");
  egal(f.telephone, "0541112233");
  const choix = F.choixDeLaFamille(f);
  egal(choix.map((c) => c.sens), ["aller", "retour"]);
  egal(F.trajetsDesChoix([f], choix).map((r) => [r.nom, To.manqueTrajet(r)]), [["Noa · École (aller)", ""], ["Noa · École (retour)", ""]]);
});

section("Calendrier : ramassage avec un nouvel enfant, adulte ou enfant (12 nov. 2026, 22h52)");
test("liste des enfants : prenom, parent, ecole et heure de sortie", () => {
  const l = F.listeEnfants([MOI]);
  egal([l[0].prenom, l[0].parent, l[0].age, l[0].sortie], ["Dana", "Moi", "enfant", "13:30"]);
  vrai(!!l[0].ecole);
});
test("nouvel enfant dans une nouvelle famille : parents, telephones, ecole, horaires", () => {
  const res = F.ajouterEnfantDepuisTache([MOI], { parent: "Parent B", telephone: "0501112233", parent2: "Autre B", telephone2: "0524445566", prenom: "Lia", age: "enfant", ecole: GAN, entree: "08:00", sortie: "13:00" });
  egal(res.familles.length, 2);
  const f = res.familles[1];
  egal([f.nom, f.telephone, f.nom2, f.telephone2, f.enfants[0].prenom, f.enfants[0].age], ["Parent B", "0501112233", "Autre B", "0524445566", "Lia", "enfant"]);
  egal([f.enfants[0].rdv[0].heureArrivee, f.enfants[0].rdv[0].heureSortie, f.enfants[0].rdv[0].lieu.label], ["08:00", "13:00", GAN.label]);
  egal(res.ref, { famille: f.id, enfant: f.enfants[0].id });
  // relu depuis la base : rien ne se perd ; il n'entre pas dans la tournee sans choix
  egal(F.lireFamilles(JSON.parse(JSON.stringify(res.familles)))[1].nom2, "Autre B");
  egal(F.trajetsDesChoix(res.familles, []).length, 0);
});
test("nouvel enfant dans une famille existante ; refuse sans prenom ou sans parent", () => {
  const res = F.ajouterEnfantDepuisTache([MOI], { famille: "moi", prenom: "Noa", ecole: ECOLE });
  egal([res.familles.length, res.familles[0].enfants.length, res.ref.famille], [1, 2, "moi"]);
  egal(F.ajouterEnfantDepuisTache([MOI], { famille: "moi", prenom: " " }), null);
  egal(F.ajouterEnfantDepuisTache([MOI], { prenom: "Noa" }), null);
});
test("tache : type, pour qui, adulte ou enfant ; le ramassage garde l'enfant de la fiche", () => {
  let j = To.ajouterTache({}, "2026-11-15", { type: "autre", titre: "Docteur", pour: "Moi", age: "adulte", debut: "11:00", fin: "12:00" });
  let t = To.tachesDuJour(j, "2026-11-15")[0];
  egal([t.type, t.titre, t.pour, t.age, t.enfant], ["autre", "Docteur", "Moi", "adulte", null]);
  j = To.ajouterTache({}, "2026-11-15", { type: "ramassage", titre: "Ramassage · Lia", pour: "Lia", enfant: { famille: "f1", enfant: "e9" }, debut: "12:45", fin: "13:15" });
  t = To.lireJours(JSON.stringify(j))["2026-11-15"].taches[0];
  egal([t.type, t.age, t.enfant], ["ramassage", "enfant", { famille: "f1", enfant: "e9" }]);
  // ancienne tache (sans type) : lue comme « autre », sans age
  t = To.lireJours('{"2026-11-15":{"taches":[{"id":"a","titre":"RDV","debut":"10:00","fin":"10:30"}]}}')["2026-11-15"].taches[0];
  egal([t.type, t.age, t.pour], ["autre", "", ""]);
  egal(To.iconeTache({ type: "beaute" }), "💅");
});
