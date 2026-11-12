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
const T = JSON.parse(JSON.stringify(TARIFS));
const jours = (actifs, plus = {}) => To.JOURS.map((_, w) => ({ actif: actifs.includes(w), arrivee: "", sortie: "", ...(plus[w] || {}) }));

const MOI = {
  ...F.familleVide(), id: "moi", nom: "Moi", domicile: MAISON, adresses: [{ nom: "Travail", adresse: TRAVAIL }],
  enfants: [{ id: "e1", prenom: "Dana", rdv: [
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
  vrai(/« Alexia » et « Alexia Dahan » : même nom, enfant\(s\) en commun : liel, joy/.test(F.doublonsFamilles([MOI, a, b])[0]));
  egal(F.doublonsFamilles([{ ...MOI, nom: "Rebecca", telephone: "054-111 22 33" }, { ...AMIE_F, nom: "Autre", telephone: "+972541112233" }]).length, 1);
  egal(F.doublonsFamilles([{ ...MOI, nom: "A" }, { ...MOI, id: "m2", nom: "B" }]).length, 1); // meme domicile, meme enfant
});

test("deux familles differentes ne sont pas des doublons ; un enfant saisi deux fois est signale", () => {
  egal(F.doublonsFamilles([MOI, AMIE_F]), []);
  egal(F.doublonsFamilles([{ ...MOI, nom: "Anna" }, { ...AMIE_F, nom: "Joanna" }]), []);
  const deuxFois = { ...AMIE_F, enfants: [AMIE_F.enfants[0], { ...AMIE_F.enfants[0], id: "bis" }] };
  vrai(/Liel.*deux fois/.test(F.doublonsFamilles([deuxFois])[0]));
});

test("trajet ajoute a la main en double avec une fiche", () => {
  const fiches = F.trajetsDesFamilles([AMIE_F]);
  const manuels = [To.trajetVide({ nom: "Vieux trajet Gan", type: "sortie", de: GAN, a: AMIE }), To.trajetVide({ nom: "Autre", type: "sortie", de: ECOLE, a: MAISON })];
  egal(F.doublonsTrajets(manuels, fiches).map((r) => r.nom), ["Vieux trajet Gan"]);
});
