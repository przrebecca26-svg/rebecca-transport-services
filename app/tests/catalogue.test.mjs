// TESTS FONDATIONS (Lot C, C1 et C2) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as C from "../src/pricing/catalogue.js";
import { TARIFS } from "../src/pricing/config.js";

section("Catalogue : tarifs modifiables");
test("valeurs de depart = prix du code (Tel-Aviv 235, Jerusalem 540)", () => egal([C.TARIFS_DEPART["zones.tel_aviv.grilleB.simple"], C.TARIFS_DEPART["zones.jerusalem.grilleB.simple"]], [235, 540]));
test("tous les chemins existent et sont des nombres", () => vrai(C.TARIFS_EDITABLES.every((c) => typeof C.TARIFS_DEPART[c.chemin] === "number"), "chemin manquant"));
test("rien en base : aucun prix ne change", () => {
  const avant = JSON.stringify(TARIFS);
  C.appliquerTarifs({});
  egal(JSON.stringify(TARIFS), avant);
});
test("changement applique puis retour au depart", () => {
  C.appliquerTarifs({ "zones.tel_aviv.grilleB.simple": 250, "nuit.0.pourcentage": 0.2 });
  const pendant = [TARIFS.zones.tel_aviv.grilleB.simple, TARIFS.nuit[0].pourcentage];
  C.appliquerTarifs({});
  egal([pendant, TARIFS.zones.tel_aviv.grilleB.simple, TARIFS.nuit[0].pourcentage], [[250, 0.2], 235, 0.15]);
});
test("valeur invalide ignoree", () => {
  C.appliquerTarifs({ "zones.tel_aviv.grilleB.simple": -5, "inconnu.x": 3 });
  egal(TARIFS.zones.tel_aviv.grilleB.simple, 235);
  C.appliquerTarifs({});
});
test("formulaire : pourcentage saisi en %, seules les differences gardees", () => egal(C.validerTarifs({ "nuit.0.pourcentage": "20", "zones.haifa.grilleB.simple": "365", "urgence.standard": "35" }).valeurs, { "urgence.standard": 35, "nuit.0.pourcentage": 0.2 }));
test("formulaire : valeur vide refusee", () => vrai(!!C.validerTarifs({ "urgence.standard": "" }).erreur));
test("lecture du document", () => egal([C.lireTarifs('{"a":1}'), C.lireTarifs("oups"), C.lireTarifs("[1]")], [{ a: 1 }, {}, {}]));

section("Catalogue : activites");
const A = C.activitesEffectives([{ id: "nails", margeMinutes: 15, debut: "10:00" }, { id: "transport", public: true }]);
test("8 activites", () => egal(A.length, 8));
test("valeurs de base modifiees champ par champ", () => egal([A.find((a) => a.id === "nails").margeMinutes, A.find((a) => a.id === "nails").debut, A.find((a) => a.id === "nails").fin], [15, "10:00", "18:00"]));
test("beaute : dimanche-jeudi 9h-18h, 20 min, acompte 20 %", () => {
  const h = C.activitesEffectives([]).find((a) => a.id === "hair");
  egal([h.jours, h.debut, h.fin, h.margeMinutes, h.acomptePourcent, h.acompteMin], [[0, 1, 2, 3, 4], "09:00", "18:00", 20, 20, 10]);
});
test("ancien interrupteur public du transport respecte", () => egal(A.find((a) => a.id === "transport").acces, "public"));
const F = { nom: "Nails Prestige", jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00", margeMinutes: "20", acomptePourcent: "20", acompteMin: "10", delaiAcompteHeures: "48", acces: "public" };
test("fiche correcte", () => egal(C.validerActivite(F).fiche.margeMinutes, 20));
test("fin avant debut refusee", () => vrai(!!C.validerActivite({ ...F, fin: "08:00" }).erreur));
test("aucun jour refuse", () => vrai(!!C.validerActivite({ ...F, jours: [] }).erreur));

section("Catalogue : prestations");
test("valeurs de depart : Nails 16, Hair 15, Slim 10, RegenX 8", () => egal(["nails", "hair", "slim", "regenx"].map((a) => C.CATALOGUE_DEPART.filter((x) => x.activite === a).length), [16, 15, 10, 8]));
test("prix valides du 4 nov. (VSP 100 / 1h30, mariee 1200 / 2h30)", () => {
  const vsp = C.CATALOGUE_DEPART.find((x) => x.nom === "Semi-permanent (VSP)");
  const mar = C.CATALOGUE_DEPART.find((x) => x.nom === "Coiffure mariée, jour J");
  egal([vsp.prix, vsp.dureeMinutes, mar.prix, mar.dureeMinutes, mar.acomptePourcent], [100, 90, 1200, 150, 40]);
});
test("aucun prix RegenX dans le code (sauf diagnostic)", () => vrai(C.CATALOGUE_DEPART.filter((x) => x.activite === "regenx" && x.typePrix === "prive").every((x) => x.prix === null)));
test("Epoxy : 42 articles du 9 nov. + 2 sur devis du 10 nov.", () => egal(C.CATALOGUE_DEPART.filter((x) => x.activite === "epoxy").length, 44));
test("Epoxy : les 2 ajouts sont sur devis, sans prix", () => egal(C.CATALOGUE_DEPART.filter((x) => x.activite === "epoxy" && x.typePrix === "devis").map((x) => x.prix), [null, null]));
test("identifiants du catalogue uniques", () => egal(new Set(C.CATALOGUE_DEPART.map((x) => x.id)).size, C.CATALOGUE_DEPART.length));
test("Epoxy : premier article = epoxy-050 (identifiants stables depuis le 9 nov.)", () => egal(C.CATALOGUE_DEPART.find((x) => x.activite === "epoxy").id, "epoxy-050"));
test("Epoxy : cendrier a 3 tailles, Hanoukia 450/550, table ronde 2000", () => {
  const n = (nom) => C.CATALOGUE_DEPART.find((x) => x.nom === nom);
  egal([n("Cendrier").variantes.map((v) => v.prix), n("Hanoukia").variantes.map((v) => v.prix), n("Table ronde").prix], [[65, 125, 195], [450, 550], 2000]);
});
test("Epoxy : chaque article passe la verification de l'admin", () => {
  const ko = C.CATALOGUE_DEPART.filter((x) => x.activite === "epoxy").map((x) => [x.nom, C.validerPrestation({ ...x, prix: x.prix == null ? "" : String(x.prix), variantes: x.variantes.map((v) => ({ nom: v.nom, prix: String(v.prix) })) }).erreur]).filter(([, e]) => e);
  egal(ko, []);
});
test("photo : format et poids verifies", () => egal([C.validerPhoto({ donnees: "data:image/jpeg;base64,AAAA", legende: " 20 x 30 cm " }).photo.legende, !!C.validerPhoto({ donnees: "http://x" }).erreur], ["20 x 30 cm", true]));
test("publie au depart (10 nov.), sauf les prix prives", () => vrai(C.CATALOGUE_DEPART.every((x) => x.publiee === (x.typePrix !== "prive"))));
test("identifiants uniques", () => egal(new Set(C.CATALOGUE_DEPART.map((x) => x.id)).size, C.CATALOGUE_DEPART.length));
const P = { activite: "nails", categorie: "Mains", nom: "Nouvelle pose", typePrix: "fixe", prix: "180", dureeMinutes: "120", publiee: true };
test("un prix prive ne peut pas etre publie", () => egal(C.validerPrestation({ ...P, activite: "regenx", typePrix: "prive", prix: "", publiee: true }).prestation.publiee, false));
test("une prestation a prix fixe peut etre publiee", () => egal(C.validerPrestation({ ...P, publiee: true }).prestation.publiee, true));
test("nouvelle prestation beaute", () => egal(C.validerPrestation(P).prestation, { activite: "nails", categorie: "Mains", nom: "Nouvelle pose", description: "", typePrix: "fixe", prix: 180, prixMax: null, dureeMinutes: 120, option: false, variantes: [], publiee: true, ordre: 999 }));
test("duree obligatoire pour un rendez-vous", () => vrai(!!C.validerPrestation({ ...P, dureeMinutes: "" }).erreur));
test("article Epoxy sans duree, avec variantes et delai", () => {
  const r = C.validerPrestation({ activite: "epoxy", categorie: "Bougies", nom: "Bougie ours", description: "Résine, couleur au choix", typePrix: "fixe", prix: "150", variantes: [{ nom: "Petit", prix: "150" }, { nom: "Grand", prix: "200" }], delaiFabrication: "2 à 5 jours" });
  egal([r.erreur, r.prestation.dureeMinutes, r.prestation.variantes.length, r.prestation.delaiFabrication], ["", null, 2, "2 à 5 jours"]);
});
test("variante sans prix refusee", () => vrai(!!C.validerPrestation({ ...P, activite: "epoxy", variantes: [{ nom: "Grand", prix: "" }] }).erreur));
test("prix prive sans prix accepte", () => egal(C.validerPrestation({ ...P, activite: "regenx", typePrix: "prive", prix: "" }).erreur, ""));
test("vue publique : jamais un prix prive", () => egal(C.vuePublique({ publiee: true, typePrix: "prive", prix: 1000 }).prix, null));
test("vue publique : non publiee = rien", () => egal(C.vuePublique({ publiee: false, prix: 10 }), null));
test("libelles", () => egal([C.libellePrix({ typePrix: "parongle", prix: 20, prixMax: 120 }), C.libellePrix({ typePrix: "fixe", prix: 0, variantes: [{ nom: "Petit", prix: 150 }, { nom: "Grand", prix: 200 }] }), C.libelleDuree(90), C.libelleDuree(40)], ["20 à 120 ₪ par ongle", "Petit 150 ₪ · Grand 200 ₪", "1 h 30", "40 min"]));

import * as S from "../src/services.js";
import { calculer } from "../src/pricing/engine.js";
import { ADRESSES as AD, TRAJETS as TR, MAINTENANT } from "./donnees.mjs";
test("le prix du site suit le tarif modifie (Tel-Aviv 235 -> 300 -> 235)", () => {
  const d = S.versDemande("transport", { ...S.valeursInitiales("transport"), depart: AD.netanya2, arrivee: AD.tel_aviv, date: "2026-11-10", heure: "10:00", typeTrajet: "simple" }, TR.tel_aviv, MAINTENANT);
  const a = calculer(d).total;
  C.appliquerTarifs({ "zones.tel_aviv.grilleB.simple": 300 });
  const b = calculer(d).total;
  C.appliquerTarifs({});
  egal([a, b, calculer(d).total], [235, 300, 235]);
});

section("Catalogue : ajustement de tous les prix");
test("-10 % : 100 -> 90, 220 -> 200 (arrondi 5), 0 = prix de base", () => egal([C.prixAjuste(100, -10), C.prixAjuste(220, -10), C.prixAjuste(140, 0)], [90, 200, 140]));
test("prestation ajustee, base intacte", () => {
  const x = { typePrix: "parongle", prix: 20, prixMax: 120, variantes: [] };
  egal([C.avecAjustement(x, -20).prix, C.avecAjustement(x, -20).prixMax, x.prix], [15, 95, 20]);
});
test("prix prive et sur devis jamais ajustes", () => egal([C.avecAjustement({ typePrix: "prive", prix: 1000 }, -10).prix, C.avecAjustement({ typePrix: "devis", prix: null }, -10).prix], [1000, null]));
test("variantes Epoxy ajustees", () => egal(C.avecAjustement({ typePrix: "fixe", prix: 0, variantes: [{ nom: "Petit", prix: 150 }] }, -20).variantes[0].prix, 120));
test("fiche activite : ajustement -90 a +100", () => egal([C.validerActivite({ ...F, ajustementPourcent: "-15" }).fiche.ajustementPourcent, !!C.validerActivite({ ...F, ajustementPourcent: "-95" }).erreur], [-15, true]));

import * as Pr from "../src/pricing/promos.js";
section("Codes promo par activite");
const base = { code: "HANOUKA20", type: "pourcentage", valeur: 20, actif: true, utilisationsParCompte: null, finLe: null };
test("code sans activite (bienvenue) : partout", () => vrai(Pr.promoSapplique(base, { service: "livraison" }) && Pr.promoSapplique(base, { activite: "nails" })));
test("code Epoxy : pas sur une livraison", () => egal([Pr.promoSapplique({ ...base, activite: "epoxy" }, { service: "livraison" }), Pr.promoSapplique({ ...base, activite: "epoxy" }, { activite: "epoxy" })], [false, true]));
test("code coursier : livraison et courses oui, transport non", () => egal(["livraison", "courses", "transport"].map((s) => Pr.promoSapplique({ ...base, activite: "coursier" }, { service: s })), [true, true, false]));
test("code vise un article : seulement cet article", () => {
  const p = { ...base, activite: "epoxy", cibles: ["epoxy-080"] };
  egal([Pr.promoSapplique(p, { activite: "epoxy", prestationId: "epoxy-080" }), Pr.promoSapplique(p, { activite: "epoxy", prestationId: "epoxy-081" })], [true, false]);
});
test("validation : activite inconnue ou cibles sans activite refusees", () => egal([Pr.validerPromo({ ...base, activite: "x" }) !== "", Pr.validerPromo({ ...base, cibles: ["a"] }) !== "", Pr.validerPromo({ ...base, activite: "nails", cibles: ["nails-001"] })], [true, true, ""]));
test("moteur : code Epoxy refuse sur un transport, prix inchange", () => {
  const d = { ...S.versDemande("transport", { ...S.valeursInitiales("transport"), depart: AD.netanya2, arrivee: AD.tel_aviv, date: "2026-11-10", heure: "10:00", typeTrajet: "simple" }, TR.tel_aviv, MAINTENANT), codePromo: "HANOUKA20" };
  const sans = calculer({ ...d, codePromo: "" }, TARIFS);
  const t = { ...TARIFS, codesPromo: { HANOUKA20: { ...base, activite: "epoxy" } } };
  const r = calculer(d, t);
  egal([r.total === sans.total, r.details.promo && r.details.promo.statut], [true, "autre_activite"]);
});

test("Digital : 3 formules et 3 forfaits de maintenance valides (250, 450, 750)", () => egal(C.CATALOGUE_DEPART.filter((x) => x.activite === "digital" && x.categorie === "Maintenance").map((x) => [x.nom, x.prix]), [["Sérénité", 250], ["Confort", 450], ["Premium", 750]]));
