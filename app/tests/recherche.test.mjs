// TESTS : PRIORITÉ DES ACTIVITÉS REBECCA SERVICES ET RECHERCHE TOLÉRANTE (décision définitive du 27 nov. 2026, 15h30)
import { section, test, egal, vrai } from "./outils.mjs";
import { correspond, separerVille, villeCanon, villeCouverte, prestationDeFiche } from "../src/pricing/recherche.js";
import { rechercherPros } from "../src/pricing/pros.js";
import { readFileSync } from "fs";
import { lireAccueil, partenairesDeCategorie, partenairesDepuis, rechercher } from "../src/pricing/accueilV2.js";

// Mes 6 fiches RÉELLES (copie de l'annuaire public du 27 nov. 2026) + des partenaires, dont des formules payantes mises en avant
const RS = JSON.parse(readFileSync(new URL("./fiches-rebecca-27nov.json", import.meta.url), "utf8"));
const PARTS = [
  { id: "p1", nomCommercial: "Ongles by Sarah", categorie: "beaute", metier: "Prothésiste ongulaire", prestations: "Semi-permanent, gel", villes: "Netanya", formule: "packpro", verifie: true },
  { id: "p2", nomCommercial: "Salon Léa", categorie: "beaute", metier: "Coiffeuse", prestations: "Coupe, couleur", villes: "Netanya, Haïfa", formule: "business", verifie: true },
  { id: "p3", nomCommercial: "Web Studio", categorie: "autres", metier: "Création de sites internet", prestations: "Sites vitrines", villes: "Tel Aviv", zone: "Toute Israël" },
  { id: "p4", nomCommercial: "Taxi Moshe", categorie: "autres", metier: "Chauffeur privé", prestations: "Transferts aéroport", villes: "Netanya" },
  { id: "p5", nomCommercial: "Résine Créa", categorie: "autres", metier: "Créations en résine epoxy", villes: "Netanya" },
];
const FICHES = [...PARTS, ...RS];
const premier = (texte) => (rechercherPros(FICHES, { texte })[0] || {}).nomCommercial;
const SERVICES = [
  { id: "transport", activite: "transport", titre: "Transport privé", texte: "Un trajet d'une adresse à une autre." },
  { id: "aeroport", activite: "transport", titre: "Aéroport Ben Gourion", texte: "Départ vers l'aéroport." },
  { id: "livraison", activite: "coursier", titre: "Livraison", texte: "Colis, clés, documents." },
];
const C = lireAccueil({ misEnAvant: ["p:p1", "p:p2", "p:p3"] });
const P = partenairesDepuis(FICHES, []);
const r = (t, ville = "") => rechercher(t, { config: C, partenaires: P, services: SERVICES, visible: () => true, ville });

section("Recherche : villes écrites autrement");
for (const v of ["Netanya", "Natanya", "Natania", "netania", "NETANYA", "Nétanya", "natnya", "נתניה"]) test(`« ${v} » = Netanya`, () => egal(villeCanon(v), "netanya"));
test("« Tel-Aviv » et « tlv » = Tel Aviv", () => { egal(villeCanon("Tel-Aviv"), "tel aviv"); egal(villeCanon("tlv"), "tel aviv"); });
test("« ongles natania » : la ville est reconnue dans la phrase", () => egal(separerVille("ongles natania"), { ville: "netanya", reste: "ongles" }));
test("zone « Netanya et alentours – sur rendez-vous » couvre Natanya", () => vrai(villeCouverte("Natanya", "Netanya, Netanya et alentours – sur rendez-vous")));
test("zone « Toute Israël » couvre Haïfa", () => vrai(villeCouverte("Haifa", "Toute Israël – à distance")));
test("Netanya ne couvre pas Haïfa", () => vrai(!villeCouverte("Haïfa", "Netanya et alentours")));

section("Recherche : synonymes et fautes courantes");
for (const [q, c] of [["manucure", "onglerie semi-permanent"], ["coifeuse", "coiffure femme"], ["radiofrequence", "Radiofréquence"], ["drainage", "soins minceur"], ["aeroprt", "aéroport"], ["livreur", "livraison colis"], ["appli", "création d'applications"], ["resine", "Créations en résine"], ["natbag", "aéroport Ben Gourion"]]) {
  test(`« ${q} » trouve « ${c} »`, () => vrai(correspond(q, c)));
}
test("pas de faux positif : « plombier » ne trouve pas une onglerie", () => vrai(!correspond("plombier", "Onglerie semi-permanent")));

section("Annuaire (#/pros) : mes activités toujours en premier");
for (const [q, attendu] of [
  ["ongles netanya", "Nails Prestige"], ["Ongles Natanya", "Nails Prestige"], ["manucure natania", "Nails Prestige"], ["vernis semi permanent", "Nails Prestige"],
  ["coiffeuse netanya", "Prestige Hair"], ["coiffeuse Natania", "Prestige Hair"], ["coifeuse", "Prestige Hair"], ["coupe couleur", "Prestige Hair"],
  ["soin capillaire", "RegenX by rebecca"], ["barbe", "RegenX by rebecca"], ["sourcils", "RegenX by rebecca"],
  ["radiofréquence", "Prestige Slim & Lift"], ["cavitation", "Prestige Slim & Lift"], ["drainage", "Prestige Slim & Lift"],
  ["création de site", "Digital & Applications"], ["application", "Digital & Applications"], ["vitrine", "Digital & Applications"],
  ["résine", "Boutique Epoxy"], ["creations en resine", "Boutique Epoxy"],
]) test(`« ${q} » → ${attendu} en premier`, () => egal(premier(q), attendu));
test("partenaire Pack Pro vérifié et mis en avant : toujours APRÈS Nails Prestige", () => {
  const l = rechercherPros(FICHES, { texte: "ongles" }).map((f) => f.nomCommercial);
  egal(l.slice(0, 2), ["Nails Prestige", "Ongles by Sarah"]);
});
test("coiffeuse à Haïfa : hors de ma zone, la coiffeuse partenaire seulement", () => egal(rechercherPros(FICHES, { texte: "coiffeuse haifa" }).map((f) => f.nomCommercial), ["Salon Léa"]));
test("par ville seule (Natanya) : mes activités d'abord, puis les partenaires", () => {
  const l = rechercherPros(FICHES, { ville: "Natanya" });
  vrai(l[0].activiteRS === true && l.findIndex((f) => !f.activiteRS) > l.filter((f) => f.activiteRS).length - 1);
});
test("par catégorie Beauté : mes activités beauté d'abord", () => egal(rechercherPros(FICHES, { categorie: "beaute" })[0].activiteRS, true));
test("ordre choisi par Rebecca entre ses activités (Hair avant Nails)", () => {
  const l = rechercherPros(FICHES, { categorie: "beaute" }, ["x:hair", "x:nails"]).map((f) => f.nomCommercial);
  egal(l.slice(0, 2), ["Prestige Hair", "Nails Prestige"]);
});
test("une FUTURE activité de Rebecca (cochée dans l'annuaire) passe aussi en premier, sans code", () => {
  const futur = { id: "rsX", nomCommercial: "Rebecca Événements", categorie: "evenements", metier: "Décoration d'événements", activiteRS: true, villes: "Netanya" };
  const autre = { id: "pX", nomCommercial: "Déco Party", categorie: "evenements", metier: "Décoration d'événements", villes: "Netanya", verifie: true };
  egal(rechercherPros([autre, futur], { texte: "decoration" }).map((f) => f.nomCommercial), ["Rebecca Événements", "Déco Party"]);
});
test("le nom d'un partenaire ne lui donne pas le logo ou le lien de Rebecca", () => egal(prestationDeFiche({ ...PARTS[1], nomCommercial: "Hair Studio" }) && PARTS[1].activiteRS === true, false));

section("Nouvel accueil : priorité dans la recherche générale et les catégories");
for (const [q, attendu] of [["ongles netanya", "nails"], ["coiffeuse natania", "hair"], ["soin capillaire", "regenx"], ["cavitation", "slim"], ["aeroport", "aeroport"], ["livraison", "livraison"], ["creation de site", "digital"], ["resine", "epoxy"]]) {
  test(`« ${q} » : ${attendu} en tête du groupe Rebecca Services`, () => egal((r(q).rebecca[0] || {}).id, attendu));
}
test("« ongles » : Nails Prestige d'abord, la prothésiste partenaire (mise en avant) dans le groupe partenaires", () => {
  const x = r("ongles");
  egal(x.rebecca[0].id, "nails");
  egal(x.partenaires[0].id, "p1");
});
test("« coiffeuse haïfa » : pas Prestige Hair (hors zone), Salon Léa oui", () => { const x = r("coiffeuse haifa"); vrai(!x.rebecca.some((y) => y.id === "hair")); egal(x.partenaires.map((p) => p.id), ["p2"]); egal(x.ville, "Haifa"); });
test("« taxi » : mon transport avant Taxi Moshe", () => { const x = r("taxi"); egal(x.rebecca[0].id, "transport"); vrai(x.partenaires.some((p) => p.id === "p4")); });
test("catégorie Beauté : mes 3 activités beauté puis les partenaires (mis en avant après moi)", () => {
  const l = partenairesDeCategorie(C, P, "beaute").map((p) => p.type);
  egal(l.slice(0, 4), ["rs", "rs", "rs", "rs"]);
  vrai(l.indexOf("pro") > l.lastIndexOf("rs"));
});
test("mon ordre dans l'admin s'applique aux catégories (RegenX avant Nails)", () => {
  const c = lireAccueil({ prioriteRS: ["x:regenx", "x:nails"] });
  egal(partenairesDeCategorie(c, P, "beaute")[0].prestation, "regenx");
});
