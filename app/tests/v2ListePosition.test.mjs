import { test, egal } from "./outils.mjs";
import { validerAttente, messagePlaceLibre, attentesActives } from "../src/pricing/listeAttente.js";
import { lireLienPosition, positionPropre, aEnvoyer, carteOsm } from "../src/pricing/positionDirect.js";

test("liste d'attente : validation", () => {
  egal(validerAttente({ service: "nails", date: "2026-11-20", prenom: "Léa", telephone: "054-123-4567" }).fiche.telephone, "0541234567");
  egal(!!validerAttente({ service: "transport", date: "2026-11-20", prenom: "Léa", telephone: "0541234567" }).erreur, true);
  egal(!!validerAttente({ service: "nails", date: "", prenom: "Léa", telephone: "0541234567" }).erreur, true);
  egal(validerAttente({ service: "hair", date: "2026-11-20", prenom: "Léa", telephone: "0541234567", plage: "x" }).fiche.plage, "journee");
});
test("liste d'attente : message et tri", () => {
  egal(messagePlaceLibre({ prenom: "Léa", service: "nails", date: "2026-11-20", plage: "matin" }).includes("Léa"), true);
  egal(attentesActives([{ date: "2026-11-25" }, { date: "2026-11-18" }, { date: "2026-11-21" }], "2026-11-19").map((a) => a.date).join(","), "2026-11-21,2026-11-25");
});
test("position en direct", () => {
  egal(lireLienPosition("#/position/AbC123xyz"), "AbC123xyz");
  egal(lireLienPosition("#/position/x"), "");
  egal(positionPropre({ lat: 32.1234567, lon: 34.8 }).lat, 32.123457);
  egal(positionPropre({ lat: 200, lon: 0 }), null);
  egal(aEnvoyer(null, { lat: 32, lon: 34 }, 0), true);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32.0001, lon: 34 }, 5000), false);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32.001, lon: 34 }, 5000), true);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32, lon: 34 }, 25000), true);
  egal(carteOsm({ lat: 32, lon: 34 }).includes("marker=32,34"), true);
});

// 19 nov. 2026, 14h10 : « Prévenir » avec le lien de suivi, et « avec ou sans Shyrel »
import { messageEnfant } from "../src/pricing/finCourse.js";
import { changerAvecMoi, avecMoiDe, lireJours, texteAvecMoi } from "../src/pricing/tournee.js";
test("prévenir : lien de suivi en direct", () => {
  const m = messageEnfant("prise", ["Joy", "Liel"], "14:01", "Gan", "14:12", "Maison", "https://rebeccaservices.com/#/position/rabc123def456");
  egal(m.includes("vers 14h12"), true);
  egal(m.includes("Suivez la voiture en direct : https://rebeccaservices.com/#/position/rabc123def456"), true);
  egal(messageEnfant("depose", ["Joy"], "14:10", "Maison", "", "", "https://rebeccaservices.com/#/position/rabc123def456").includes("Suivez"), false);
  egal(messageEnfant("prise", ["Joy"], "14:01", "Gan", "", "", "javascript:x").includes("Suivez"), false);
});
test("avec ou sans moi dans la voiture", () => {
  let j = changerAvecMoi({}, "2026-11-19", "c:abc", ["Shyrel", "Shyrel", " "]);
  egal(avecMoiDe(j, "2026-11-19", "c:abc").join(","), "Shyrel");
  egal(texteAvecMoi(["Shyrel", "Joy", "Liel"]), "avec Shyrel, Joy et Liel");
  egal(avecMoiDe(lireJours(JSON.stringify(j)), "2026-11-19", "c:abc").join(","), "Shyrel");
  j = changerAvecMoi(j, "2026-11-19", "c:abc", []);
  egal(JSON.stringify(j), "{}");
});

// 19 nov. 2026, 14h33 : trajet fait -> sort du trafic
import { trajetsDuJour, etapesCourses } from "../src/pricing/traficMatin.js";
test("trafic : étapes cochées marquées faites", () => {
  const maison = { lat: 32.33, lon: 34.86, label: "Maison" };
  const gan = { lat: 32.32, lon: 34.85, label: "Gan" };
  const ecole = { lat: 32.30, lon: 34.87, label: "École" };
  const fil = [
    { min: 840, genre: "arret", adresse: gan, lieu: "Gan", texte: "Prendre", cle: "a:x:prise", fait: true },
    { min: 860, genre: "arret", adresse: ecole, lieu: "École", texte: "Déposer", cle: "a:x:depose", fait: false },
  ];
  const t = trajetsDuJour(fil, maison, 0);
  egal(t.find((x) => x.cle === "a:x:prise").fait, true);
  egal(t.find((x) => x.cle === "a:x:depose").fait, false);
  const c = etapesCourses([{ id: "abc", statut: "acceptee", service: "livraison", heure: "15:00", details: { depart: gan, arrivee: ecole }, chrono: { simple: { prise: "15:02" } } }]);
  if (c.length) { egal(c[0].fait, true); egal(c[1].fait, false); }
});

// 19 nov. 2026, 15h05 : tâche à la maison dans le trafic
import { quoiDeTache, aLaMaison } from "../src/pricing/saisieVocale.js";
test("tâche à la maison : dictée et trafic", () => {
  const t = "Sortir le chien 20 minutes, trouve-moi un créneau, sachant que le chien est à la maison";
  egal(quoiDeTache(t), "Sortir le chien");
  egal(aLaMaison(t), true);
  egal(aLaMaison("docteur à 10 heures"), false);
  const maison = { lat: 32.33, lon: 34.86, label: "Maison" };
  const activite = { lat: 32.30, lon: 34.87, label: "Activité" };
  const fil = [
    { min: 930, genre: "arret", adresse: activite, lieu: "Activité", texte: "Déposer Shyrel" },
    { min: 965, genre: "tache", adresse: maison, lieu: "Maison", texte: "Sortir le chien", jusqua: "16h25" },
    { min: 1013, genre: "maison", texte: "Partir de la maison" },
    { min: 1020, genre: "arret", adresse: activite, lieu: "Activité", texte: "Prendre Shyrel" },
  ];
  const tr = trajetsDuJour(fil, maison, 0);
  const vers = tr.find((x) => x.quoi === "Prendre Shyrel");
  egal(vers.apresMin, 985);
  egal(vers.apresQuoi, "Sortir le chien");
  egal(!!tr.find((x) => x.quoi === "Sortir le chien"), true);
});
