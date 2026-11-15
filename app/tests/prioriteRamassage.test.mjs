// TESTS DE LA PRIORITE DES DEMANDES DE RAMASSAGE (15 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/prioriteRamassage.js";
import { garderDevis, lireDevis, statutDevis } from "../src/pricing/tournee.js";

const J = 86400000;
const MAINTENANT = Date.parse("2026-11-30T12:00:00+02:00");
const il = (jours) => new Date(MAINTENANT - jours * J).toISOString();
const d = (cle, jours, enAttente = true) => ({ cle, nom: cle, arrivee: il(jours), enAttente });

section("Priorite des demandes de ramassage");

test("moins d'1 semaine : prioritaire ; 1 a 2 semaines : en attente ; 2 semaines : annulee", () => {
  egal([R.etatAge(il(2), MAINTENANT).etat, R.etatAge(il(8), MAINTENANT).etat, R.etatAge(il(14), MAINTENANT).etat], ["prioritaire", "attente", "expiree"]);
});

test("ordre : la 1re arrivee passe devant pendant 1 semaine", () => {
  const c = R.classerDemandes([d("B", 2), d("A", 5), d("C", 1)], MAINTENANT);
  egal(c.map((x) => [x.cle, x.rang]), [["A", 1], ["B", 2], ["C", 3]]);
});

test("passe 1 semaine : la suivante devient prioritaire, l'ancienne reste en attente derriere", () => {
  const c = R.classerDemandes([d("A", 9), d("B", 3)], MAINTENANT);
  egal(c.map((x) => [x.cle, x.etat]), [["B", "prioritaire"], ["A", "attente"]]);
  egal(R.demandesAvant(c, "A", MAINTENANT).map((x) => x.cle), ["B"]);
  egal(R.demandesAvant(c, "B", MAINTENANT).map((x) => x.cle), []);
});

test("un nouveau devis passe apres les demandes de moins d'1 semaine seulement", () => {
  const c = R.classerDemandes([d("A", 9), d("B", 3)], MAINTENANT);
  egal(R.demandesAvant(c, "", MAINTENANT).map((x) => x.cle), ["B"]);
});

test("refusees, annulees ou acceptees : plus de priorite ; 2 semaines : a annuler", () => {
  const liste = [d("A", 3, false), d("B", 15), d("C", 4)];
  egal(R.classerDemandes(liste, MAINTENANT).map((x) => x.cle), ["C"]);
  egal(R.demandesExpirees(liste, MAINTENANT).map((x) => x.cle), ["B"]);
});

test("texte pour Rebecca", () => {
  const liste = [d("A", 2)];
  const c = R.classerDemandes(liste, MAINTENANT);
  vrai(R.textePriorite(liste[0], c, MAINTENANT).startsWith("Prioritaire n°1 jusqu'au 5 décembre"), R.textePriorite(liste[0], c, MAINTENANT));
});

test("devis rapide : l'arrivee est gardee quand on le modifie ; statut annule", () => {
  const plan = { enfants: [{}] };
  const a = garderDevis({ devis: [] }, { nom: "X", plan, arriveeLe: "2026-11-10T09:00:00.000Z" });
  const b = garderDevis(a.doc, { id: a.id, nom: "X modifie", plan, arriveeLe: "2026-11-20T09:00:00.000Z" });
  egal(lireDevis(b.doc.devis)[0].arriveeLe, "2026-11-10T09:00:00.000Z");
  egal(lireDevis(statutDevis(b.doc, a.id, "annule").devis)[0].statut, "annule");
});
