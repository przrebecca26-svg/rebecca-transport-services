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
  egal(c.tarifs, { jusqua3: 35, de3a6: 45, enPlus: 20, minimumCreneau: 0, parHeure: 0, tresLourd: 5 });
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
  egal(a[a.length - 1].lignes[0].includes("A (à la demande)"), true);
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
test("formule B : créneaux avec heures, minimum garanti 150 ₪, clients jamais démarchés", () => {
  egal(erreursFormulaire({ ...rempli, formule: "B", creneaux: "jeudi soir" }, sig).length, 1);
  egal(erreursFormulaire({ ...rempli, formule: "B", creneaux: "jeudi 18h-21h" }, sig), []);
  const c = { ...contratPropre({ ...rempli, formule: "B", creneaux: "jeudi 18h-21h" }, tarifsStandard(null), sig), signeLe: "2026-11-20T10:05" };
  const tout = articlesContrat(c).map((a) => a.lignes.join(" ")).join(" ");
  egal(tout.includes("2 h = 150 ₪"), true);
  egal(tout.includes("même avec leur accord"), true);
  egal(tout.includes("Revolut, espèces ou virement"), true);
});
import { demandeComplement, lireCreneaux, erreursCreneaux, minimumCreneau, minimumsSemaine, tableauMinimums } from "../src/pricing/creneauxResto.js";
import { prixCommande, commandePropre } from "../src/pricing/restos.js";
test("créneaux B : 2 h minimum, 75 ₪ par heure, complément seulement", () => {
  egal(lireCreneaux("dim-jeu 19h30-21h30")[0].jours, [0, 1, 2, 3, 4]);
  egal(erreursCreneaux("jeudi 18h-19h").length, 1);
  egal([minimumCreneau(2), minimumCreneau(3), minimumCreneau(5), minimumCreneau(1)], [150, 225, 375, 150]);
  egal(tableauMinimums(75, 30).map((l) => l.minimum), [150, 225, 300, 375]);
  const s = { debut: "2026-11-15", fin: "2026-11-21" };
  const liv = [{ statut: "terminee", date: "2026-11-19", heure: "19:00", prixFinal: 30 }, { statut: "terminee", date: "2026-11-19", heure: "20:30", prixFinal: 40 }];
  const m = minimumsSemaine("jeudi 19h-21h", liv, s);
  egal([m.length, m[0].livre, m[0].complement, m[0].facture], [1, 70, 80, false]);
  const deja = [...liv, { statut: "terminee", date: "2026-11-19", heure: "19:00", prixFinal: 80, details: { minimumCreneau: "2026-11-19|19:00" } }];
  egal(minimumsSemaine("jeudi 19h-21h", deja, s)[0], { ...m[0], facture: true });
  const d = demandeComplement({ id: "f1", nom: "Ohi Sushi", telephone: "0541234567" }, m[0], "Bit");
  egal([d.prixFinal, d.statut, d.source, d.details.famille, d.details.minimumCreneau, d.heure], [80, "terminee", "manuel", "f1", "2026-11-19|19:00", "19:00"]);
  egal(demandeComplement({ id: "f1", nom: "X", telephone: "0541234567" }, { ...m[0], facture: true }, "Bit"), null);
  egal(demandeComplement({ id: "f1", nom: "X", telephone: "" }, m[0], "Bit"), null);
  // 20 nov. 9h33 : demi-heure et créneaux joints
  egal(minimumsSemaine("jeudi 19h30-22h", [], s)[0].minimum, 187.5);
  const j = minimumsSemaine("jeudi 19h-21h, jeudi 21h-23h", [], s);
  egal([j.length, j[0].heures, j[0].minimum], [1, 4, 300]);
  egal(minimumsSemaine("jeudi 18h-20h, jeudi 21h-23h", [], s).length, 2);
});
test("article très lourd : +5 ₪ chacun, sacs ordinaires gratuits", () => {
  egal(prixCommande({ jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 }, 2, 3), 50);
  egal(prixCommande({ jusqua3: 35, de3a6: 45, enPlus: 20 }, 4), 45);
  egal(commandePropre({ client: "A", telClient: "0541234567", adresse: { label: "x" }, pretA: "12:00", tresLourds: 2 }, "2026-11-20").tresLourds, 2);
  egal("tresLourds" in commandePropre({ client: "A", telClient: "0541234567", adresse: { label: "x" }, pretA: "12:00" }, "2026-11-20"), false);
});

// 20 nov. 2026 (Rebecca) : formule A + B
test("formule A + B : formulaire, contrat, annexe, e-mail, fiche", () => {
  egal(erreursFormulaire({ ...rempli, formule: "AB" }, sig).length, 1); // créneaux obligatoires
  egal(erreursFormulaire({ ...rempli, formule: "AB", creneaux: "jeudi 19h-20h" }, sig).length, 1); // 2 h minimum
  egal(erreursFormulaire({ ...rempli, formule: "AB", creneaux: "jeudi 19h-21h" }, sig), []);
  const ab = contratPropre({ ...rempli, formule: "AB", creneaux: "jeudi 19h-21h" }, tarifsStandard(null), sig);
  egal(ab.formule, "AB");
  egal(ab.tarifs, { jusqua3: 30, de3a6: 40, enPlus: 20, minimumCreneau: 5, parHeure: 75, tresLourd: 5 });
  egal(ab.tarifsA, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
  egal(ab.creneaux, "jeudi 19h-21h");
  egal(tarifsConformes(ab, tarifsStandard(null)), true);
  const c = { ...ab, signeLe: "2026-11-20T09:00:00.000Z" };
  const annexe = articlesContrat(c).at(-1).lignes.join("\n");
  egal(annexe.includes("A + B"), true);
  egal(annexe.includes("Prix pendant les créneaux réservés (formule B)"), true);
  egal(annexe.includes("Prix en dehors des créneaux réservés (formule A) : livraison jusqu'à 3 km : 35 ₪"), true);
  egal(annexe.includes("2 h, minimum 150 ₪"), true);
  egal(emailContrat(c, "abcdEFGH12", "x").includes("En dehors des créneaux : prix de la formule A"), true);
  const f = ficheDepuisContrat(c, "abcdEFGH12", { id: "f1" });
  egal(f.contratPro.formule, "AB");
  egal(f.contratPro.prixA, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
  // B seule : prix A aussi gardé pour les commandes hors créneaux
  const b = contratPropre({ ...rempli, formule: "B", creneaux: "jeudi 19h-21h" }, tarifsStandard(null), sig);
  egal(!!b.tarifsA, true);
  egal("tarifsA" in contratPropre(rempli, tarifsStandard(null), sig), false);
  const texte = new TextDecoder().decode(contratPdf(c, "abcdEFGH12"));
  egal(texte.startsWith("%PDF"), true);
});
