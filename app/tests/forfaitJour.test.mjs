// TESTS « ✓ FAIT » ET FORFAIT A LA JOURNEE (13 nov. 2026) - Rebecca Services
// Cas reel : la famille d'une amie paie un forfait de 70 ₪ par jour (matin + 14h), une seule fois par jour.

import { test, egal, vrai, section } from "./outils.mjs";
import * as To from "../src/pricing/tournee.js";
import * as F from "../src/pricing/forfaitJour.js";
import { lireFamilles, trajetsDesChoix } from "../src/pricing/familles.js";

section("Valider une étape (✓ Fait)");
const arret = { genre: "arret", ids: ["choix-b", "choix-a"], sorte: "prise", heure: "08h14" };
const tache = { genre: "tache", tache: { id: "t1", type: "autre" } };
test("clé d'un arrêt : identifiants triés + prise/dépose", () => egal(To.cleEtape(arret), "a:choix-a+choix-b:prise"));
test("clé d'une tâche", () => egal(To.cleEtape(tache), "t:t1"));
test("maison et temps libre : pas de bouton Fait", () => {
  vrai(!To.etapeValidable({ genre: "maison" }));
  vrai(!To.etapeValidable({ genre: "libre" }));
});
test("cocher puis décocher, ce jour seulement", () => {
  let j = To.validerEtape({}, "2026-11-13", "a:x:prise", "08:16");
  egal(To.faitA(j, "2026-11-13", "a:x:prise"), "08:16");
  egal(To.faitA(j, "2026-11-20", "a:x:prise"), "");
  j = To.annulerEtape(j, "2026-11-13", "a:x:prise");
  egal(j, {});
});
test("les étapes faites sont relues et gardées avec les autres changements du jour", () => {
  let j = To.retirerCeJour({}, "2026-11-13", ["r1"]);
  j = To.validerEtape(j, "2026-11-13", "t:t1", "09:00");
  const relu = To.lireJours(JSON.stringify(j));
  egal(relu["2026-11-13"].faits, { "t:t1": "09:00" });
  egal(relu["2026-11-13"].retires, ["r1"]);
  egal(To.journeeNormale(relu, "2026-11-13")["2026-11-13"].faits, { "t:t1": "09:00" });
});
test("heure invalide refusée", () => egal(To.validerEtape({}, "2026-11-13", "t:t1", "8h"), {}));

section("Forfait à la journée");
const familles = lireFamilles([
  { id: "fa", nom: "Alexia", telephone: "0500000000", forfaitJour: "70", enfants: [{ prenom: "Joy" }, { prenom: "Liel" }] },
  { id: "fb", nom: "Moi", enfants: [{ prenom: "Shyrel" }] },
]);
test("le forfait est relu depuis la fiche", () => {
  egal(familles[0].forfaitJour, 70);
  egal(familles[1].forfaitJour, 0);
});
test("lireForfait : nombres seulement", () => {
  egal(F.lireForfait("70 ₪"), 70);
  egal(F.lireForfait(""), 0);
  egal(F.lireForfait(-5), 0);
});
test("une seule course par famille et par jour", () => egal(F.idForfait("fa", "2026-11-13"), "tournee-fa-2026-11-13"));
const tous = [{ id: "choix-a", famille: "fa" }, { id: "choix-b", famille: "fa" }, { id: "choix-c", famille: "fb" }];
test("familles d'un arrêt regroupé", () => egal(F.famillesDeLEtape(arret, tous), ["fa"]));
test("famille d'une tâche de ramassage", () => egal(F.famillesDeLEtape({ genre: "tache", tache: { type: "ramassage", enfant: { famille: "fa", enfant: "e" } } }, tous), ["fa"]));
test("course du forfait : terminée, 70 ₪, ramassage, manuelle", () => {
  const c = F.courseForfait(familles[0], "2026-11-13", "08:14");
  egal([c.statut, c.source, c.service, c.prixFinal, c.date, c.heure, c.telephone], ["terminee", "manuel", "ramassage", 70, "2026-11-13", "08:14", "0500000000"]);
  egal(c.details.enfants, "Joy et Liel");
});
test("pas de forfait ou pas de téléphone : rien", () => {
  egal(F.courseForfait(familles[1], "2026-11-13", "08:00"), null);
  egal(F.courseForfait({ ...familles[0], telephone: "" }, "2026-11-13", "08:00"), null);
});
test("décocher le matin mais 14h encore coché : la journée reste", () => {
  const fil = [arret, { genre: "arret", ids: ["choix-a"], sorte: "depose" }];
  const faits = { [To.cleEtape(fil[1])]: "14:20" };
  vrai(F.familleEncoreFaite("fa", fil, faits, tous, To.cleEtape));
  vrai(!F.familleEncoreFaite("fa", fil, {}, tous, To.cleEtape));
});
test("les trajets des fiches portent leur famille", () => {
  const f = lireFamilles([{ id: "fa", nom: "A", enfants: [{ id: "e1", prenom: "Joy", rdv: [{ id: "r1", type: "ecole", jours: [{ actif: true }] }] }] }]);
  const t = trajetsDesChoix(f, [{ id: "c1", famille: "fa", enfant: "e1", rdv: "r1", sens: "aller", jours: [{ actif: true, heure: "", lieu: null }] }]);
  vrai(t.length >= 1 && t.every((x) => x.famille === "fa"));
});
