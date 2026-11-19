// TESTS CONTRAT DES RESTAURANTS PARTENAIRES (19 nov. 2026)
import { test, egal, section } from "./outils.mjs";
import {
  articlesContrat, contratPdf, contratPropre, decoderSignature, emailContrat, encoderSignature, erreursFormulaire, ficheDepuisContrat,
  formulaireVide, numeroContrat, signatureValide, tarifsConformes, tarifsStandard,
} from "../src/pricing/contratResto.js";
import { lireFamilles } from "../src/pricing/familles.js";

section("Contrat restaurant partenaire");
const trait = Array.from({ length: 20 }, (_, i) => [100 + i * 20, 100 + (i % 5) * 30]);
const sig = encoderSignature([trait]);
const rempli = { ...formulaireVide(), nom: "Ohi Sushi", nomLegal: "Ohi Sushi", numero: "51-234567-8", adresse: { label: "Sha'ar HaGai St 12, Netanya", lat: 32.3, lon: 34.86 }, responsable: "David", telephone: "053-4909590", portable: "054-1112233", email: "Contact@OhiSushi.co.il ", signataire: "David" };

test("signature : encodage, décodage, validité", () => {
  egal(decoderSignature(sig).length, 1);
  egal(signatureValide(sig), true);
  egal(signatureValide(""), false);
  egal(signatureValide("1,2|3,4"), false);
});
test("formulaire : erreurs puis tout bon", () => {
  egal(erreursFormulaire(formulaireVide(), "").length > 5, true);
  egal(erreursFormulaire(rempli, sig), []);
  egal(erreursFormulaire({ ...rempli, formule: "B" }, sig).length, 1); // créneaux manquants
});
test("contrat propre : champs des règles v30", () => {
  const c = contratPropre(rempli, tarifsStandard(null), sig);
  egal(c.numero, "512345678");
  egal(c.email, "contact@ohisushi.co.il");
  egal(c.tarifs, { jusqua3: 35, de3a6: 45, enPlus: 20, minimumCreneau: 0 });
  egal(Object.keys(c).length, 20);
  const b = contratPropre({ ...rempli, formule: "B", creneaux: "jeudi soir" }, tarifsStandard({ B: { jusqua3: 28 } }), sig);
  egal([b.tarifs.jusqua3, b.tarifs.minimumCreneau, b.creneaux], [28, 5, "jeudi soir"]);
  egal(tarifsConformes(b, tarifsStandard(null)), false);
  egal(tarifsConformes(c, tarifsStandard(null)), true);
});
test("numéro, articles, e-mail et PDF", () => {
  const c = { ...contratPropre(rempli, tarifsStandard(null), sig), signeLe: "2026-11-20T10:05" };
  egal(numeroContrat("abcdEFGH12", c.signeLe), "RSR-20261120-ABCD");
  const a = articlesContrat(c);
  egal(a.length, 13);
  egal(a[a.length - 1].lignes[0].includes("A. À la demande"), true);
  egal(emailContrat(c, "abcdEFGH12", "https://x/#/contrat-resto/abcdEFGH12").includes("RSR-20261120-ABCD"), true);
  const pdf = contratPdf(c, "abcdEFGH12");
  const texte = new TextDecoder("latin1").decode(pdf);
  egal(texte.startsWith("%PDF"), true);
  egal((texte.match(/\/Type \/Page\b/g) || []).length >= 2, true);
});
test("fiche du Répertoire créée depuis le contrat", () => {
  const c = contratPropre(rempli, tarifsStandard(null), sig);
  const f = ficheDepuisContrat(c, "abcdEFGH12", { id: "f1", enfants: [] });
  egal([f.categorie, f.nom, f.nom2, f.resto.contratId, f.contratPro.jusqua3], ["commercants", "Ohi Sushi", "David", "abcdEFGH12", 35]);
  const lue = lireFamilles([f])[0];
  egal([lue.resto.email, lue.resto.contratId], ["contact@ohisushi.co.il", "abcdEFGH12"]);
});
test("PDF : pas de « ???? » pour l'hébreu de la forme d'entreprise", () => {
  const c = { ...contratPropre(rempli, tarifsStandard(null), sig), signeLe: "2026-11-20T10:05" };
  const texte = new TextDecoder("latin1").decode(contratPdf(c, "abcdEFGH12"));
  egal(texte.includes("????"), false);
  egal(texte.includes("Osek patur n"), true);
});
