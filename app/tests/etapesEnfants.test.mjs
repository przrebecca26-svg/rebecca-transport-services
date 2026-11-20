// TESTS ÉTAPES D'UN ARRÊT (arrivée, récupérés, départ, déposés) - 20 nov. 2026
import { test, egal, vrai, section } from "./outils.mjs";
import { boutonsEtape, boutonSuivant, messageEtape } from "../src/pricing/etapesEnfants.js";

section("Étapes d'un arrêt de la tournée");
test("prise : 3 boutons, validée au départ", () => {
  const b = boutonsEtape("prise");
  egal(b.map((x) => x.id).join(), "arrivee,avecMoi,depart");
  vrai(b[2].valide && !b[0].valide);
});
test("dépose : 2 boutons", () => egal(boutonsEtape("depose").length, 2));
test("bouton suivant", () => {
  egal(boutonSuivant("prise", {}).id, "arrivee");
  egal(boutonSuivant("prise", { arrivee: "12h48" }).id, "avecMoi");
  egal(boutonSuivant("prise", { arrivee: 1, avecMoi: 1, depart: 1 }), null);
});
test("messages", () => {
  const m = messageEtape("depart", ["Joy", "Liel"], "Gan", "12h53", "13h00");
  vrai(/Joy et Liel/.test(m) && /13h00/.test(m));
  vrai(/sont bien arrivés/.test(messageEtape("depose", ["Joy", "Liel"])));
  vrai(/est avec moi/.test(messageEtape("avecMoi", ["Joy"])));
});

import { avancementDe } from "../src/pricing/suiteClient.js";
import { majSuivi } from "../src/pricing/restos.js";
section("Étape « Je suis arrivée » (client, restaurant, assistance)");
test("avancement : arrivée sur place", () => {
  vrai(/arrivée sur place/.test(avancementDe({ chrono: { simple: { depart: "12:30", arrivee: "12:40" } } })));
  vrai(/Prise en charge/.test(avancementDe({ chrono: { simple: { depart: "12:30", arrivee: "12:40", prise: "12:45" } } })));
});
test("restaurant : l'étape suit la livraison", () => {
  const m = majSuivi({ statut: "acceptee", prix: 30 }, { statut: "acceptee", prixFinal: 30, chrono: { simple: { arrivee: "19:10" } } });
  vrai(m && /arrivée sur place/.test(m.etape));
  egal(majSuivi({ statut: "acceptee", prix: 30, etape: m.etape }, { statut: "acceptee", prixFinal: 30, chrono: { simple: { arrivee: "19:10" } } }), null);
});

import { peutProgrammer, etatCommande, commandePropre, messageNotifResto } from "../src/pricing/restos.js";
section("Commandes restaurant programmées (autre jour)");
test("programmer : demain ok, aujourd'hui non, fermeture non", () => {
  const r = { actif: true };
  vrai(peutProgrammer({ resto: r, aujourdhui: "2026-11-20", jourChoisi: "2026-11-22", pretA: "19:30" }).ok);
  vrai(!peutProgrammer({ resto: r, aujourdhui: "2026-11-20", jourChoisi: "2026-11-20", pretA: "19:30" }).ok);
  vrai(!peutProgrammer({ resto: r, aujourdhui: "2026-11-20", jourChoisi: "2027-01-10", pretA: "19:30" }).ok);
  vrai(!peutProgrammer({ resto: r, aujourdhui: "2026-11-20", jourChoisi: "2026-11-21", pretA: "12:00", fermeture: "Chabbat" }).ok);
  vrai(!peutProgrammer({ resto: { actif: false }, aujourdhui: "2026-11-20", jourChoisi: "2026-11-22" }).ok);
});
test("programmée : jamais refusée automatiquement", () => {
  egal(etatCommande({ statut: "nouvelle", programmee: true, creeLe: 1000 }, 10 * 3600e3), "nouvelle");
  egal(etatCommande({ statut: "nouvelle", creeLe: 1000 }, 10 * 3600e3), "expiree");
});
test("document : programmee seulement si demandé", () => {
  const f = { client: "A", telClient: "0541234567", adresse: { label: "x" }, pretA: "19:30", note: "" };
  vrai(commandePropre(f, "2026-11-22", "lien", true).programmee === true);
  vrai(!("programmee" in commandePropre(f, "2026-11-20")));
  vrai(/22\/11\/2026/.test(messageNotifResto({ nom: "X" }, { ...f, jour: "2026-11-22", programmee: true }).corps));
});

import { messageWhatsAppResto } from "../src/pricing/restos.js";
test("WhatsApp restaurant : jour programmé et prix", () => {
  const m = messageWhatsAppResto("News test", { client: "T", telClient: "054", adresse: { label: "HaZohar 7" }, pretA: "19:30" }, { jour: "2026-11-26", prix: 30, km: 2.9, formule: "B" });
  vrai(/programmée pour le 26\/11\/2026/.test(m) && /30 ₪ \(2.9 km, prix B\)/.test(m));
  vrai(!/programmée/.test(messageWhatsAppResto("X", { client: "T" })));
});
