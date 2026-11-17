// TESTS « FIN DE COURSE DEPUIS L'AGENDA » (17 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as F from "../src/pricing/finCourse.js";

section("Fin de course : fait, encaissé, merci, chrono");
const ar = (o = {}) => ({ id: "r1", nom: "Naomie Cohen", service: "aeroport", statut: "acceptee", date: "2026-11-17", heure: "09:30", prixFinal: 300, details: { typeTrajet: "ar", direction: "vers", dateRetour: "2026-11-24", heureRetour: "18:00" }, ...o });
const retour = (o = {}) => ({ ...ar(o), date: "2026-11-24", heure: "18:00", estRetour: true });
const simple = (o = {}) => ({ id: "s1", nom: "Léa", service: "aeroport", statut: "acceptee", date: "2026-11-17", heure: "09:30", prixFinal: 150, details: { direction: "vers" }, ...o });

test("aller d'un aller-retour : la demande reste acceptée, l'aller est noté", () => {
  egal(F.champsFait(ar(), "10:20"), { allerFaitA: "10:20" });
  egal(F.faitDe(ar({ allerFaitA: "10:20" })), "10:20");
  egal(F.faitDe(retour({ allerFaitA: "10:20" })), "");
});
test("retour fait ou aller simple fait : terminée", () => {
  egal(F.champsFait(retour({ allerFaitA: "10:20" }), "19:00").statut, "terminee");
  egal(F.champsFait(simple(), "10:00").statut, "terminee");
  egal(F.champsPasFait(simple({ statut: "terminee" })).statut, "acceptee");
});
test("encaissement : course et pourboire séparés", () => {
  const r = F.preparerEncaissement(ar(), { recu: "300", pourboire: "10", moyen: "Espèces" }, "2026-11-17");
  egal(r.erreur, "");
  egal(r.paiement.montant, 300);
  egal(r.champs.pourboire, 10);
  vrai(!!F.preparerEncaissement(ar(), { recu: "", pourboire: "", moyen: "Espèces" }, "2026-11-17").erreur);
});
test("merci : aller-retour tout payé, en partie, aller simple", () => {
  const tout = F.messageMerci(ar(), 0);
  vrai(tout.includes("Bon vol et bon séjour") && tout.includes("rappel la veille") && !tout.includes("restera"));
  vrai(F.messageMerci(ar(), 150).includes("Il restera 150 ₪ à régler au retour"));
  const s = F.messageMerci(simple(), 0);
  vrai(s.includes("Merci de m'avoir fait confiance") && s.includes("Au plaisir de vous revoir") && !s.includes("retour"));
  vrai(F.messageMerci(retour(), 0).includes("Bon retour"));
  egal(F.resteDe(ar(), [{ resId: "r1", kind: "paiement", montant: 150 }]), 150);
});
test("chrono : récupérée → déposée (= fait) → rentrée, temps et ₪ par heure", () => {
  egal(F.prochaineEtape(ar()), "prise");
  egal(F.champsEtape(ar(), "prise", "08:50"), { "chrono.aller.prise": "08:50" });
  egal(F.champsEtape(ar(), "depose", "09:35"), { "chrono.aller.depose": "09:35", allerFaitA: "09:35" });
  const d = ar({ chrono: { aller: { prise: "08:50", depose: "09:35", maison: "10:20" } }, allerFaitA: "09:35" });
  const b = F.bilanTrajet(d);
  egal([b.course, b.retourMaison, b.total, b.prix, b.parHeure], [45, 45, 90, 150, 100]);
  egal(F.prochaineEtape(d), "");
  egal(F.champsAnnulerEtape(d), { "chrono.aller.maison": "" });
  egal(F.texteMinutes(90), "1 h 30");
});

test("lien du site partout ; sans compte : créer son compte", () => {
  for (const m of [F.messageMerci(simple(), 0), F.messageMerci(ar(), 150), F.messageRappelRetour(retour(), 0)]) {
    vrai(m.includes("rebecca-services-netanya.netlify.app"));
    vrai(m.includes("créer votre compte"));
  }
  const avecCompte = F.messageRappelRetour(retour({ uid: "u1" }), 0);
  vrai(avecCompte.includes("netlify.app") && !avecCompte.includes("créer votre compte"));
});
