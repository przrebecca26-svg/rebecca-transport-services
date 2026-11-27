// TESTS DU GENERATEUR DE PAGES PROFESSIONNELLES (lot 1, 27 nov. 2026)
import { section, test, egal, vrai } from "./outils.mjs";
import {
  MODELES, adresseDepuisNom, adresseUnique, ajouterVersion, calculTarif, changerModele, compteurEspace, contratDepuisTarif, abonnementDepuisContrat,
  dupliquerPage, erreursPage, lienWhatsAppPage, normaliserPage, pagePublique, pageVide, photosAEffacer, restaurerVersion, sectionsDePage,
  sectionsPermises, sectionsVisibles, lienReseauPage, seoDePage, photoPartage,
} from "../src/pricing/pagesPro.js";
import { remplacerEntete } from "../netlify/functions/page-pro.mjs";

const GRILLE = {
  vitrine: { creation: 490, mois: 59 }, business: { creation: 990, mois: 99 }, packPro: { creation: 890, mois: 59 },
  modules: [{ id: "agenda", nom: "Agenda et rendez-vous", creation: 390, mois: 29 }, { id: "catalogue", nom: "Catalogue et commandes", creation: 490, mois: 29 }],
};
const dossier = (formule = "vitrine", modules = []) => ({ id: "p1", nomCommercial: "Mode & Tendances", statut: "accepte", formule, modules, whatsapp: "054-111-2233" });
const ID1 = "phAAAAAAAAAAAA1", ID2 = "phAAAAAAAAAAAA2", ID3 = "phAAAAAAAAAAAA3";

section("Pages pros : modèles vraiment différents");
test("8 modèles", () => egal(MODELES.length, 8));
test("chaque modèle a une disposition différente des autres", () => {
  const empreintes = new Set(MODELES.map((m) => JSON.stringify(m.disposition)));
  egal(empreintes.size, 8);
});
test("au moins 4 en-têtes et 4 styles de produits utilisés", () => {
  vrai(new Set(MODELES.map((m) => m.disposition.entete)).size >= 4);
  vrai(new Set(MODELES.map((m) => m.disposition.produits)).size >= 4);
});

section("Pages pros : forfait et sections");
test("Référencement : 4 sections, pas de photos ni produits", () => egal(sectionsPermises("referencement"), ["presentation", "horaires", "zone", "contact"]));
test("Vitrine : galerie, produits, avis ; pas de réservation", () => { const l = sectionsPermises("vitrine"); vrai(l.includes("galerie") && l.includes("produits") && l.includes("avis") && !l.includes("reservation")); });
test("Business + agenda : réservation", () => vrai(sectionsPermises("business", ["agenda"]).includes("reservation")));
test("Pack Pro : réservation", () => vrai(sectionsPermises("packpro").includes("reservation")));
test("passer de Référencement à Vitrine : les données restent, la galerie apparaît", () => {
  const p = normaliserPage({ ...pageVide(dossier("referencement")), galerie: [{ photo: ID1, legende: "" }] });
  egal(p.galerie.length, 1);
  vrai(!sectionsVisibles(p, "referencement", []).includes("galerie"));
  vrai(sectionsVisibles(p, "vitrine", []).includes("galerie"));
});
test("en Référencement, la version publique ne montre aucune photo (mais elles restent dans la page)", () => {
  const p = normaliserPage({ ...pageVide(dossier("referencement")), logo: ID1, galerie: [{ photo: ID2 }] });
  const pub = pagePublique(p, dossier("referencement"));
  egal([pub.logo, pub.galerie.length], ["", 0]);
});
test("ordre des sections gardé, section désactivée cachée", () => {
  const s = sectionsDePage([{ id: "contact" }, { id: "presentation", actif: false }], "vitrine", []);
  egal(s[0].id, "contact");
  vrai(!sectionsVisibles({ sections: s }, "vitrine", []).includes("presentation"));
});

section("Pages pros : modèle, duplication, adresse");
test("changer de modèle garde textes et photos", () => {
  const p = normaliserPage({ ...pageVide(dossier(), "luxe"), presentation: "Bonjour", galerie: [{ photo: ID1 }] });
  const q = changerModele(p, "restaurant");
  egal([q.presentation, q.galerie.length, q.modele, q.disposition.produits], ["Bonjour", 1, "restaurant", "menu"]);
});
test("adresse depuis le nom", () => egal(adresseDepuisNom("Mode & Tendances 26"), "mode-et-tendances-26"));
test("adresse unique", () => egal(adresseUnique("deborah", [{ id: "a", adresse: "deborah" }], "b"), "deborah-2"));
test("adresse réservée refusée", () => egal(adresseUnique("admin", [], "x"), "admin-pro"));
test("dupliquer : sans photos ni tarif, nouvelle adresse", () => {
  const p = normaliserPage({ ...pageVide(dossier()), adresse: "mode", logo: ID1, contrats: [{ leMs: 1 }] });
  const c = dupliquerPage(p, [p]);
  egal([c.logo, c.contrats.length, c.adresse !== p.adresse, c.id !== p.id], ["", 0, true, true]);
});

section("Pages pros : version publique (rien de privé)");
test("aucun tarif, contrat, note ni journal en public", () => {
  const p = normaliserPage({ ...pageVide(dossier()), notePrivee: "secret", tarif: { creation: 100 }, contrats: [{ leMs: 1, totalMensuel: 9 }] });
  const pub = JSON.stringify(pagePublique(p, dossier()));
  vrai(!/secret|notePrivee|contrats|tarif"|journal|photosInfo|proId/.test(pub), pub.slice(0, 200));
});
test("SEO par défaut : nom – spécialité, description = accroche", () => {
  const s = seoDePage(normaliserPage({ ...pageVide(dossier()), specialite: "Boutique", accroche: "La mode à Netanya" }));
  egal(s, { titre: "Mode & Tendances – Boutique", description: "La mode à Netanya" });
});
test("photo de partage : couverture d'abord", () => egal(photoPartage({ couverture: ID2, logo: ID1 }), ID2));
test("erreurs avant publication", () => {
  const e = erreursPage(normaliserPage({ ...pageVide(dossier()), whatsapp: "12" }), [], { statut: "suspendu" });
  vrai(e.whatsapp && e.proId);
});

section("Pages pros : tarif du client");
test("sans changement = grille", () => { const c = calculTarif({}, GRILLE, "vitrine", []); egal([c.totalCreation, c.totalMensuel], [490, 59]); });
test("Business + 2 options", () => { const c = calculTarif({}, GRILLE, "business", ["agenda", "catalogue"]); egal([c.totalCreation, c.totalMensuel], [1870, 157]); });
test("remise 10 % + 50 ₪ sur la création", () => { const c = calculTarif({ remisePct: 10, remiseCreationShekels: 50 }, GRILLE, "vitrine", []); egal([c.totalCreation, c.totalMensuel], [391, 53]); });
test("création offerte", () => egal(calculTarif({ creationOfferte: true }, GRILLE, "vitrine", []).totalCreation, 0));
test("option offerte", () => egal(calculTarif({ options: { agenda: { offerte: true } } }, GRILLE, "business", ["agenda"]).totalMensuel, 99));
test("tarif préférentiel : 39 ₪/mois au lieu de 59", () => egal(calculTarif({ mensuel: 39, preferentiel: true }, GRILLE, "vitrine", []).totalMensuel, 39));
test("remise en ₪ par mois", () => egal(calculTarif({ remiseMoisShekels: 9 }, GRILLE, "vitrine", []).totalMensuel, 50));
test("3 mois offerts à partir du 15/12 : premier mois payé le 15/03", () => egal(calculTarif({ moisOfferts: 3, debutAbonnement: "2026-12-15" }, GRILLE, "vitrine", []).premierMoisPaye, "2027-03-15"));
test("31 janvier + 1 mois = 28 février", () => egal(calculTarif({ moisOfferts: 1, debutAbonnement: "2027-01-31" }, GRILLE, "vitrine", []).premierMoisPaye, "2027-02-28"));
test("un tarif accepté ne change pas si la grille change", () => {
  const k = contratDepuisTarif({}, GRILLE, "vitrine", []);
  GRILLE.vitrine.mois = 79;
  egal(k.totalMensuel, 59);
  GRILLE.vitrine.mois = 59;
});
test("abonnement du dossier depuis le contrat (paiements gardés)", () => {
  const k = contratDepuisTarif({ moisOfferts: 2, debutAbonnement: "2026-12-01" }, GRILLE, "vitrine", []);
  const a = abonnementDepuisContrat(k, { paiements: [{ date: "2026-11-01", montant: 10 }] });
  egal([a.mensuel, a.debut, a.actif, a.paiements.length], [59, "2027-02-01", true, 1]);
});

section("Pages pros : photos, versions, espace");
test("les versions réutilisent les photos (pas de copie)", () => {
  const p = normaliserPage({ ...pageVide(dossier()), logo: ID1, photosInfo: { [ID1]: 100 } });
  const v = ajouterVersion([], p);
  egal([JSON.stringify(v).split(ID1).length - 1, v[0].page.tarif, v[0].page.photosInfo !== undefined], [2, undefined, true]);
});
test("5 versions au maximum", () => {
  let v = [];
  for (let i = 0; i < 8; i++) v = ajouterVersion(v, normaliserPage(pageVide(dossier())), i + 1);
  egal(v.length, 5);
});
test("ménage : une photo encore dans une ancienne version n'est pas effacée", () => {
  const p = normaliserPage({ ...pageVide(dossier()), logo: ID1, photosInfo: { [ID1]: 10, [ID2]: 10, [ID3]: 10 } });
  const versions = [{ leMs: 1, page: { galerie: [{ photo: ID2 }] } }];
  egal(photosAEffacer(p, versions, null), [ID3]);
});
test("restaurer une version garde le tarif et l'historique", () => {
  const p = normaliserPage({ ...pageVide(dossier()), nom: "Nouveau", contrats: [{ leMs: 5 }] });
  const r = restaurerVersion(p, { leMs: 1, page: { nom: "Ancien" } });
  egal([r.nom, r.contrats.length, r.id], ["Ancien", 1, p.id]);
});
test("compteur : par pro, total, alertes 70/85/95", () => {
  const pages = [{ proId: "a", nom: "A", photosInfo: { x: 600 } }, { proId: "b", nom: "B", photosInfo: { y: 260, z: 0 } }];
  const c = compteurEspace(pages, 1000);
  egal([c.total, c.photos, c.pourcent, c.alerte, c.parPro[0].nom], [860, 3, 86, 85, "A"]);
  egal(compteurEspace(pages, 900).alerte, 95);
  egal(compteurEspace(pages, 2000).alerte, 0);
});

section("Pages pros : liens et aperçus");
test("WhatsApp international avec message", () => egal(lienWhatsAppPage("054-111-2233", "Bonjour"), "https://wa.me/972541112233?text=Bonjour"));
test("Instagram @compte", () => egal(lienReseauPage("instagram", "@mode.et.tendances26"), "https://www.instagram.com/mode.et.tendances26"));
test("aperçu WhatsApp : titre, description, image, base", () => {
  const h = remplacerEntete('<html><head><title>X</title><meta name="description" content="a" /><meta property="og:title" content="b" /></head></html>', { titre: "Mode <26>", description: "Desc", url: "https://r.com/p/m", image: "https://r.com/p-photo/x.jpg" });
  vrai(h.includes('<base href="/" />') && h.includes("<title>Mode &lt;26&gt;</title>") && h.includes('property="og:image" content="https://r.com/p-photo/x.jpg"') && h.includes('name="description" content="Desc"'));
});
