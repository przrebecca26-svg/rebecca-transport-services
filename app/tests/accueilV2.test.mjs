// TESTS DU NOUVEL ACCUEIL « DEUX UNIVERS » (lot P1, 27 nov. 2026)
import { section, test, egal, vrai } from "./outils.mjs";
import {
  CATEGORIES_V2_DEFAUT, accueilVide, annoncesActives, bannieresActives, categoriesAffichees, categoriesDuPartenaire, correspond, lireAccueil,
  misEnAvantListe, nombreParCategorie, partenairesDeCategorie, partenairesDepuis, rechercher, specialitesAffichees, specialitesDuPartenaire,
  texteUnivers, villesDesPartenaires,
} from "../src/pricing/accueilV2.js";

const SERVICES = [
  { id: "transport", activite: "transport", titre: "Transport privé", texte: "Un trajet d'une adresse à une autre." },
  { id: "aeroport", activite: "transport", titre: "Aéroport Ben Gourion", texte: "Départ vers l'aéroport." },
  { id: "livraison", activite: "coursier", titre: "Livraison", texte: "Colis, clés, documents." },
];
const FICHES = [
  { id: "p1", nomCommercial: "Salon Léa", categorie: "beaute", metier: "Coiffeuse", prestations: "Coupe, couleur", villes: "Netanya", verifie: true },
  { id: "p2", nomCommercial: "Mode et Tendances", categorie: "autres", metier: "Boutique de vêtements", prestations: "Prêt-à-porter femme", villes: "Netanya" },
  { id: "p3", nomCommercial: "Dépann'Eau", categorie: "travaux", metier: "Plombier", prestations: "Fuites, débouchage", villes: "Hadera, Netanya" },
  { id: "p4", nomCommercial: "Prestige Hair", categorie: "beaute", metier: "Coiffure", activiteRS: true },
];
const RESTOS = [{ id: "r1", nom: "Ohi Sushi", cuisine: "Sushis", adresse: "Netanya", visible: true, page: "/p/ohi-sushi" }, { id: "r2", nom: "Caché", visible: false }];
const toutOuvert = () => true;

section("Nouvel accueil : réglages");
test("13 catégories validées, Épicerie & Supermarché comprise", () => {
  egal(CATEGORIES_V2_DEFAUT.length, 13);
  vrai(CATEGORIES_V2_DEFAUT.some((c) => c.nom === "Épicerie & Supermarché"));
});
test("sans réglage : les 13 catégories par défaut, rien de publié", () => { const c = lireAccueil(null); egal(c.categories.length, 13); egal(c.publie, false); });
test("réglage abîmé : on retombe sur le défaut sans planter", () => egal(lireAccueil("{pas du json").categories.length, 13));
test("liens dangereux refusés (javascript:)", () => {
  const c = lireAccueil({ bannieres: [{ titre: "x", lien: "javascript:alert(1)" }, { titre: "y", lien: "#/restaurants" }] });
  egal(c.bannieres[0].lien, "");
  egal(c.bannieres[1].lien, "#/restaurants");
});
test("classement : catégorie inconnue ignorée, clé invalide ignorée", () => {
  const c = lireAccueil({ classement: { "p:p2": { cats: ["mode", "inexistante"], specs: [] }, "x:zz": { cats: ["mode"] } } });
  egal(c.classement["p:p2"].cats, ["mode"]);
  egal(c.classement["x:zz"], undefined);
});
test("univers : texte personnalisé, sinon celui d'origine", () => {
  const c = lireAccueil({ univers: { beaute: { titre: "Beauté" } } });
  egal(texteUnivers(c, "beaute").titre, "Beauté");
  egal(texteUnivers(c, "digital").titre, "Digital & Applications");
});

section("Nouvel accueil : partenaires et catégories");
const P = partenairesDepuis(FICHES, RESTOS);
const C = lireAccueil(null);
test("les activités de Rebecca ne sont pas mélangées aux partenaires", () => vrai(!P.some((p) => p.nom === "Prestige Hair")));
test("restaurant caché non repris", () => vrai(!P.some((p) => p.nom === "Caché")));
test("rangement automatique : ancien métier beauté -> Beauté & Esthétique", () => egal(categoriesDuPartenaire(C, P.find((p) => p.id === "p1")), ["beaute"]));
test("restaurants -> Restaurants & Traiteurs, lien vers sa page", () => {
  const r = P.find((p) => p.cle === "r:r1");
  egal(categoriesDuPartenaire(C, r), ["restaurants"]);
  egal(r.lien, "/p/ohi-sushi");
});
test("plusieurs catégories pour un même pro (choix de Rebecca)", () => {
  const c = lireAccueil({ classement: { "p:p2": { cats: ["mode", "autres"], specs: ["pret-a-porter"] } } });
  egal(categoriesDuPartenaire(c, P.find((p) => p.id === "p2")), ["mode", "autres"]);
  egal(partenairesDeCategorie(c, P, "mode").map((p) => p.id), ["p2"]);
});
test("spécialité trouvée toute seule (Coiffeuse -> Coiffure)", () => vrai(specialitesDuPartenaire(C, P.find((p) => p.id === "p1")).includes("coiffure")));
test("filtre par spécialité et par ville", () => {
  egal(partenairesDeCategorie(C, P, "travaux", { specialite: "plomberie" }).map((p) => p.id), ["p3"]);
  egal(partenairesDeCategorie(C, P, "travaux", { ville: "Haïfa" }).length, 0);
  egal(partenairesDeCategorie(C, P, "travaux", { ville: "hadera" }).length, 1);
});
test("catégories vides masquées automatiquement", () => {
  const ids = categoriesAffichees(C, P).map((c) => c.id);
  vrai(ids.includes("beaute") && ids.includes("travaux") && ids.includes("restaurants"));
  vrai(!ids.includes("automobile") && !ids.includes("epicerie"));
});
test("catégorie vide montrée si Rebecca décoche « masquer si vide »", () => {
  const c = lireAccueil({ categories: CATEGORIES_V2_DEFAUT.map((x) => (x.id === "automobile" ? { ...x, masquerSiVide: false } : x)) });
  vrai(categoriesAffichees(c, P).some((x) => x.id === "automobile"));
});
test("catégorie cachée jamais montrée", () => {
  const c = lireAccueil({ categories: CATEGORIES_V2_DEFAUT.map((x) => (x.id === "beaute" ? { ...x, visible: false } : x)) });
  vrai(!categoriesAffichees(c, P).some((x) => x.id === "beaute"));
});
test("spécialités vides masquées", () => {
  const beaute = C.categories.find((c) => c.id === "beaute");
  egal(specialitesAffichees(C, P, beaute).map((s) => s.id), ["coiffure"]);
});
test("compte des partenaires par catégorie", () => { const n = nombreParCategorie(C, P); egal(n.beaute, 1); egal(n.restaurants, 1); });
test("mis en avant d'abord, dans l'ordre choisi", () => {
  const c = lireAccueil({ misEnAvant: ["r:r1", "p:p3", "p:inconnu"] });
  egal(misEnAvantListe(c, P).map((p) => p.cle), ["r:r1", "p:p3"]);
});
test("villes proposées sans doublons", () => egal(villesDesPartenaires(P), ["Hadera", "Netanya"]));

test("mes prestations ne remplissent JAMAIS une catégorie partenaire (cas réel du 27 nov.)", () => {
  const seulesMesFiches = partenairesDepuis([FICHES[3]], []);
  egal(seulesMesFiches.length, 0);
  egal(categoriesAffichees(C, seulesMesFiches).length, 0);
});
test("ancien réglage « Aussi chez Rebecca » ignoré", () => vrai(!("rebecca" in lireAccueil({ categories: [{ id: "beaute", nom: "Beauté", rebecca: ["hair"] }] }).categories[0])));

section("Nouvel accueil : recherche générale");
test("« coiffeuse » : Prestige Hair (Rebecca) ET la coiffeuse partenaire, séparés", () => {
  const r = rechercher("coiffeuse", { config: C, partenaires: P, services: SERVICES, visible: toutOuvert });
  vrai(r.rebecca.some((x) => x.id === "hair"));
  egal(r.partenaires.map((p) => p.id), ["p1"]);
});
test("prestation fermée (Pages du site) : pas proposée", () => {
  const r = rechercher("coiffeuse", { config: C, partenaires: P, services: SERVICES, visible: (id) => id !== "hair" });
  vrai(!r.rebecca.some((x) => x.id === "hair"));
});
test("« aéroport » : mon service Aéroport", () => vrai(rechercher("aeroport", { config: C, partenaires: P, services: SERVICES, visible: toutOuvert }).rebecca.some((x) => x.id === "aeroport")));
test("« plombier » : la plomberie partenaire et la catégorie Travaux", () => {
  const r = rechercher("plombier", { config: C, partenaires: P, services: SERVICES, visible: toutOuvert });
  egal(r.partenaires.map((p) => p.id), ["p3"]);
  vrai(r.categories.some((c) => c.id === "travaux"));
});
test("« sushi » : le restaurant partenaire", () => egal(rechercher("sushi", { config: C, partenaires: P, services: SERVICES, visible: toutOuvert }).partenaires.map((p) => p.cle), ["r:r1"]));
test("par ville seule : les partenaires de la ville, pas mes services", () => {
  const r = rechercher("", { config: C, partenaires: P, services: SERVICES, visible: toutOuvert, ville: "Hadera" });
  egal(r.partenaires.map((p) => p.id), ["p3"]);
  egal(r.rebecca.length, 0);
});
test("sans accents ni majuscules", () => vrai(correspond("ÉPICERIE", "Épiceries")));
test("texte trop court : rien", () => egal(rechercher("a", { config: C, partenaires: P, services: SERVICES }).partenaires.length, 0));
test("partenaire d'une catégorie cachée : pas dans la recherche", () => {
  const c = lireAccueil({ categories: CATEGORIES_V2_DEFAUT.map((x) => (x.id === "travaux" ? { ...x, visible: false } : x)) });
  egal(rechercher("plombier", { config: c, partenaires: P, services: SERVICES }).partenaires.length, 0);
});

section("Nouvel accueil : bannières et annonces programmées");
test("dates de début et de fin respectées", () => {
  const c = lireAccueil({ bannieres: [{ titre: "Noël", du: "2026-12-01", au: "2026-12-31" }, { titre: "Toujours" }, { titre: "Off", actif: false }], annonces: [{ texte: "Offre", type: "offre", au: "2026-11-26" }] });
  egal(bannieresActives(c, "2026-11-27").map((b) => b.titre), ["Toujours"]);
  egal(bannieresActives(c, "2026-12-10").map((b) => b.titre), ["Noël", "Toujours"]);
  egal(annoncesActives(c, "2026-11-27").length, 0);
});
test("accueil vide : rien à la une", () => egal(misEnAvantListe(accueilVide(), P).length, 0));
