// TESTS RESTAURANTS ET COMMERCANTS PARTENAIRES, version simple (19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import { semaineDe, semaineDecalee, prixPro, releveSemaine, messageReleve, paiementsSemaine, contratDe } from "../src/pricing/commercants.js";

section("Commerçants partenaires");
test("semaine du dimanche au samedi, paiement le dimanche", () => {
  egal(semaineDe("2026-11-19"), { debut: "2026-11-15", fin: "2026-11-21", paiementLe: "2026-11-22" });
  egal(semaineDe("2026-11-15").debut, "2026-11-15");
  egal(semaineDecalee(semaineDe("2026-11-19"), -1).debut, "2026-11-08");
});
test("prix pro par distance", () => {
  const c = contratDe({});
  egal([prixPro(c, 2), prixPro(c, 5), prixPro(c, 8), prixPro(c, 0), prixPro(c, 2, true)], [35, 45, null, null, 20]);
  egal(contratDe({ contratPro: { jusqua3: 30 } }).jusqua3, 30);
});
const liv = (id, date, prix, extra = {}) => ({ id, service: "livraison", statut: "terminee", date, heure: "19:30", prixFinal: prix, nom: "Client", details: { livraison: { label: "Rue Herzl 10, Netanya" } }, ...extra });
test("relevé : livraisons terminées de la semaine, dû, payé, reste", () => {
  const liste = [liv("a", "2026-11-16", 35), liv("b", "2026-11-18", 45), liv("c", "2026-11-23", 35), liv("d", "2026-11-17", 35, { statut: "annulee" })];
  const mv = [{ kind: "paiement", resId: "a", date: "2026-11-16", montant: 35 }];
  const r = releveSemaine(liste, mv, semaineDe("2026-11-19"));
  egal([r.nb, r.du, r.paye, r.reste], [2, 80, 35, 45]);
  egal(paiementsSemaine(r, "Bit", "2026-11-22"), [{ kind: "paiement", resId: "b", date: "2026-11-22", montant: 45, moyen: "Bit" }]);
  const m = messageReleve("Pizza Centrale", r, { moyen: "Bit" });
  vrai(m.includes("Reste à payer : 45 ₪, le 22/11/2026 par Bit"));
  vrai(m.includes("Rue Herzl 10"));
});

// 19 nov. 2026 : fiche restaurant (Infos) — les champs propres au restaurant sont gardés à la relecture
import { lireFamilles, restoLu } from "../src/pricing/familles.js";
import { chercherRepertoire } from "../src/pricing/repertoire.js";
test("fiche restaurant : infos gardées, jamais pour une famille", () => {
  const resto = { id: "r1", nom: "Ohi Sushi", telephone: "053-4909590", categorie: "commercants", nom2: "Cousin", domicile: { label: "Sha'ar HaGai 12, Netanya", lat: 32.3, lon: 34.85 }, resto: { recuperation: "Comptoir", horaires: "dim-jeu 11h-23h", nomLegal: "Ohi SARL", numero: "123456789", pirate: "x" } };
  const [lu] = lireFamilles([resto]);
  egal(lu.resto, { recuperation: "Comptoir", horaires: "dim-jeu 11h-23h", nomLegal: "Ohi SARL", numero: "123456789" });
  egal(lu.nom2, "Cousin");
  const [fam] = lireFamilles([{ ...resto, categorie: "clientes" }]);
  egal(fam.resto, undefined);
  egal(restoLu(null), { recuperation: "", horaires: "", nomLegal: "", numero: "" });
  egal(chercherRepertoire("ohi", 5, { lieux: [], clients: [], familles: [lu] })[0].titre, "Ohi Sushi · Restaurant");
});

import { clientsDuResto, ficheMaCliente } from "../src/pricing/commercants.js";
test("clients d'un restaurant : séparés, avec historique, case « aussi dans mes clientes »", () => {
  const cmd = { cle: "K", id: "c" };
  const d = (id, date, tel, nom, extra = {}) => ({ id, date, heure: "19:30", statut: "terminee", prixFinal: 35, details: { commandeResto: cmd, destinataire: nom, telDestinataire: tel, livraison: { label: "Herzl 1, Netanya" }, instructions: "2 rolls saumon" }, ...extra });
  const l = clientsDuResto([d("a", "2026-11-10", "+972 54-111-2233", "Dana"), d("b", "2026-11-18", "0541112233", "Dana C."), d("c", "2026-11-12", "0529998877", "Yossi"), { id: "x", date: "2026-11-15", details: {} }]);
  egal(l.map((c) => [c.nom, c.telephone, c.nb]), [["Dana C.", "0541112233", 2], ["Yossi", "0529998877", 1]]);
  egal(l[0].livraisons.map((x) => x.id), ["b", "a"]);
  egal(l[0].livraisons[0].note, "2 rolls saumon");
  egal(ficheMaCliente(l[0], [{ telephone: "054-111-2233", categorie: "clientes" }]) !== null, true);
  egal(ficheMaCliente(l[0], [{ telephone: "054-111-2233", categorie: "commercants" }]), null);
  egal(lireFamilles([{ id: "r", nom: "R", categorie: "commercants", habitudes: { "0541112233": "sans wasabi", vide: " " } }])[0].habitudes, { "0541112233": "sans wasabi" });
  egal(lireFamilles([{ id: "f", nom: "F", categorie: "clientes", depuisResto: "r" }])[0].depuisResto, "r");
});

import { restosDuClient } from "../src/pricing/commercants.js";
test("un client : chez quels restaurants partenaires il commande", () => {
  const d = (id, nom, cle, date, statut = "terminee") => ({ id, nom, date, statut, details: { commandeResto: { cle, id }, telDestinataire: "054-111-2233" } });
  const l = restosDuClient("0541112233", [d("a", "Ohi Sushi", "K1", "2026-11-10"), d("b", "Ohi Sushi", "K1", "2026-11-12"), d("c", "Pizzeria", "K2", "2026-11-15"), d("d", "Pizzeria", "K2", "2026-11-16", "annulee")]);
  egal(l.map((r) => [r.nom, r.nb]), [["Ohi Sushi", 2], ["Pizzeria", 1]]);
  egal(restosDuClient("12", []), []);
});
