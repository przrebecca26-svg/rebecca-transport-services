import { section, test, egal, vrai } from "./outils.mjs";
import * as Q from "../src/pricing/quiFait.js";

section("Transfert avec acceptation (12 nov. 2026)");
const J = "jeremy-uid";
const R = "rebecca";
const course = { id: "c1", statut: "acceptee", service: "livraison", attribueA: R };

test("proposer : la course reste chez Rebecca tant que Jeremy n'a pas accepte", () => {
  const p = Q.proposer(course, J, R, 1000);
  egal(p.maj.proposeA, J);
  egal("attribueA" in p.maj, false);
  const d = { ...course, ...p.maj };
  egal(Q.attribueA(d), R);
  egal(Q.transfertsPour([d], J).aAccepter.length, 1);
  egal(Q.transfertsPour([d], R).enAttente.length, 1);
  egal(Q.nombreATraiter([d], J), 1);
  egal(Q.nombreATraiter([d], R), 0);
});
test("accepter : la course passe chez Jeremy", () => {
  const d = { ...course, ...Q.proposer(course, J, R, 1000).maj };
  const a = Q.accepterProposition(d, J, 2000);
  const apres = { ...d, ...a.maj };
  egal(Q.attribueA(apres), J);
  egal(apres.proposeA, null);
  egal(a.trace, { de: R, vers: J, leMs: 2000 });
  egal(Q.nombreATraiter([apres], J), 0);
});
test("refuser : la course reste chez Rebecca et elle est prevenue", () => {
  const d = { ...course, ...Q.proposer(course, J, R, 1000).maj };
  const apres = { ...d, ...Q.refuserProposition(d, J, 3000).maj };
  egal(Q.attribueA(apres), R);
  egal(Q.transfertsPour([apres], R).refus.length, 1);
  egal(Q.nombreATraiter([apres], R), 1);
  const vu = { ...apres, ...Q.effacerRefus() };
  egal(Q.nombreATraiter([vu], R), 0);
});
test("Jeremy propose sa course a Rebecca ; il ne peut pas proposer celle de Rebecca", () => {
  const sienne = { ...course, attribueA: J };
  egal(Q.proposer(sienne, R, J, 1).maj.proposeA, R);
  vrai(Q.proposer(course, "autre", J, 1).erreur !== "");
});
test("course terminee : pas de proposition ; seule la personne visee peut accepter", () => {
  vrai(Q.proposer({ ...course, statut: "terminee" }, J, R, 1).erreur !== "");
  const d = { ...course, ...Q.proposer(course, J, R, 1000).maj };
  vrai(Q.accepterProposition(d, R, 1).erreur !== "");
});
test("message WhatsApp de proposition", () => {
  const m = Q.messageProposition({ service: "livraison", serviceTitre: "Livraison", date: "2026-11-13", heure: "10:00", nom: "Naomie" }, "Rebecca", "Jérémy");
  vrai(m.includes("je te propose une course") && m.includes("À accepter"), m);
});
