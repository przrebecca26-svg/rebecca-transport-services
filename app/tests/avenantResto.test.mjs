// TESTS CHANGEMENT DE FORMULE D'UN RESTAURANT (avenant, 20 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { avenantPropre, contratApresAvenant, erreursAvenant, texteAvenant, texteDemandeAvenant } from "../src/pricing/avenantResto.js";
import { encoderSignature } from "../src/pricing/contratResto.js";

section("Avenant restaurant (changement de formule)");
const sig = encoderSignature([Array.from({ length: 20 }, (_, i) => [100 + i * 20, 100 + (i % 5) * 30])]);
const contratA = { formule: "A", jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5, parHeure: 0, moyen: "Bit", creneaux: "", lienResto: "AbCdEfGhJkMnPqRsTuVwXyZ2" };
const standardB = { jusqua3: 30, de3a6: 40, enPlus: 20, tresLourd: 5, parHeure: 75 };

test("demande : erreurs", () => {
  egal(erreursAvenant({ formule: "A", creneaux: "", signataire: "David" }, sig, contratA), ["Rien ne change : choisissez une autre formule ou d'autres créneaux."]);
  egal(erreursAvenant({ formule: "AB", creneaux: "", signataire: "David" }, sig, contratA).length, 1);
  egal(erreursAvenant({ formule: "AB", creneaux: "jeudi 19h-20h", signataire: "David" }, sig, contratA).length, 1);
  egal(erreursAvenant({ formule: "AB", creneaux: "jeudi 19h-21h", signataire: "D" }, "", contratA).length, 2);
  egal(erreursAvenant({ formule: "AB", creneaux: "jeudi 19h-21h", signataire: "David" }, sig, contratA), []);
  // même formule, autres créneaux : accepté
  egal(erreursAvenant({ formule: "AB", creneaux: "jeudi 19h-22h", signataire: "David" }, sig, { formule: "AB", creneaux: "jeudi 19h-21h" }), []);
});
test("document de la demande", () => {
  const d = avenantPropre({ formule: "AB", creneaux: " jeudi 19h-21h ", signataire: "David" }, sig, contratA, "Ohi Sushi");
  egal(Object.keys(d).sort(), ["ancienne", "creneaux", "formule", "nom", "signataire", "signature", "statut"]);
  egal([d.ancienne, d.formule, d.creneaux, d.statut], ["A", "AB", "jeudi 19h-21h", "demandee"]);
  egal(avenantPropre({ formule: "A", creneaux: "x", signataire: "David" }, sig, { formule: "B" }, "X").creneaux, "");
});
test("contrat après l'avenant", () => {
  const ab = contratApresAvenant(contratA, { formule: "AB", creneaux: "jeudi 19h-21h" }, standardB);
  egal([ab.formule, ab.jusqua3, ab.de3a6, ab.parHeure, ab.creneaux], ["AB", 30, 40, 75, "jeudi 19h-21h"]);
  egal(ab.prixA, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
  egal(ab.lienResto, contratA.lienResto, "le lien du restaurant ne change pas");
  const b = contratApresAvenant(ab, { formule: "B", creneaux: "jeudi 19h-22h" }, standardB);
  egal([b.formule, b.jusqua3, b.creneaux], ["B", 30, "jeudi 19h-22h"]);
  egal(b.prixA, ab.prixA);
  const a = contratApresAvenant(ab, { formule: "A", creneaux: "" }, standardB);
  egal([a.formule, a.jusqua3, a.de3a6, a.creneaux], ["A", 35, 45, ""]);
  vrai(!("prixA" in a));
});
test("textes de l'avenant", () => {
  const ab = contratApresAvenant(contratA, { formule: "AB", creneaux: "jeudi 19h-21h" }, standardB);
  const av = { nom: "Ohi Sushi", ancienne: "A", formule: "AB", creneaux: "jeudi 19h-21h", signataire: "David" };
  const t = texteAvenant({ nom: "Ohi Sushi", numero: "RSR-20261120-ABCD", av, contrat: ab, jour: "2026-11-22" });
  vrai(t.includes("À compter du 22/11/2026"));
  vrai(t.includes("« A (à la demande) » à « A + B (créneaux réservés et à la demande) »"));
  vrai(t.includes("jeudi 19h-21h : 2 h, minimum 150 ₪"));
  vrai(t.includes("Pendant les créneaux réservés (prix B) : jusqu'à 3 km : 30 ₪"));
  vrai(t.includes("En dehors des créneaux (prix A) : jusqu'à 3 km : 35 ₪"));
  vrai(texteDemandeAvenant(av).includes("Créneaux demandés : jeudi 19h-21h"));
});
