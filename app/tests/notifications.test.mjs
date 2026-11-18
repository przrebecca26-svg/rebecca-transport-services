// TESTS NOTIFICATIONS SUR LE TELEPHONE (18 nov. 2026)
import crypto from "node:crypto";
import { test, egal, vrai, section } from "./outils.mjs";
import { messageNotification, idAbonnement, etatTelephone, VAPID_PUBLIQUE } from "../src/pricing/notifications.js";
import { chiffrer, jetonVapid } from "../netlify/outils/webPush.mjs";

section("Notifications téléphone");
test("texte de la notification", () => {
  const m = messageNotification({ id: "x1", service: "aeroport", serviceTitre: "Aéroport Ben Gourion", nom: "Sarah", date: "2026-11-24", heure: "06:30", prixEstime: 250 });
  egal(m.titre, "✈️ Nouvelle demande");
  egal(m.corps, "Aéroport Ben Gourion · Sarah · 24/11 06h30 · 250 ₪");
  egal(m.tag, "demande-x1");
  vrai(m.lien.includes("#/admin"));
});
test("même téléphone = même fiche", () => {
  egal(idAbonnement("https://web.push.apple.com/abc"), idAbonnement("https://web.push.apple.com/abc"));
  vrai(idAbonnement("https://web.push.apple.com/abc") !== idAbonnement("https://web.push.apple.com/abd"));
  vrai(!idAbonnement("https://a/b/c").includes("/"));
});
test("iPhone hors icône = installer l'icône d'abord", () => {
  egal(etatTelephone({ ios: true, standalone: false, push: false }), "icone");
  egal(etatTelephone({ ios: true, standalone: true, push: true, permission: "denied" }), "refuse");
  egal(etatTelephone({ ios: true, standalone: true, push: true }), "pret");
});
test("chiffrement RFC 8291 : le téléphone retrouve exactement le message", () => {
  const tel = crypto.createECDH("prime256v1"); tel.generateKeys();
  const auth = crypto.randomBytes(16);
  const texte = JSON.stringify({ titre: "✈️ Nouvelle demande", corps: "Sarah · 250 ₪" });
  const b = chiffrer(texte, tel.getPublicKey().toString("base64url"), auth.toString("base64url"));
  const sel = b.subarray(0, 16), idlen = b[20], serveur = b.subarray(21, 21 + idlen), corps = b.subarray(21 + idlen);
  egal(b.readUInt32BE(16), 4096);
  const partage = tel.computeSecret(serveur);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", partage, auth, Buffer.concat([Buffer.from("WebPush: info\0"), tel.getPublicKey(), serveur]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(corps.subarray(corps.length - 16));
  const clair = Buffer.concat([d.update(corps.subarray(0, corps.length - 16)), d.final()]);
  egal(clair[clair.length - 1], 2);
  egal(clair.subarray(0, clair.length - 1).toString("utf8"), texte);
});
test("clé publique VAPID au bon format", () => {
  const pub = Buffer.from(VAPID_PUBLIQUE, "base64url");
  egal(pub.length, 65);
  egal(pub[0], 4);
  vrai(typeof jetonVapid === "function");
});

import { evenementsDuJour, messageSoir, messageMatin, rappelsAvant, messageSite, maintenantIsrael } from "../src/pricing/planningNotif.js";
import { trajetPonctuel, ajouterTrajetCeJour } from "../src/pricing/tournee.js";
section("Notifications de ma journée");
const demJ = [
  { id: "a", statut: "acceptee", service: "aeroport", serviceTitre: "Aéroport Ben Gourion", nom: "Sarah", date: "2026-11-19", heure: "06:30" },
  { id: "b", statut: "acceptee", service: "nails", serviceTitre: "Nails", nom: "Dana", date: "2026-11-19", heure: "10:00" },
  { id: "c", statut: "acceptee", service: "transport", serviceTitre: "Transport", nom: "Léa", date: "2026-11-17", heure: "09:00", details: { typeTrajet: "ar", dateRetour: "2026-11-19", heureRetour: "18:00" } },
  { id: "d", statut: "en attente", service: "livraison", nom: "X", date: "2026-11-19", heure: "11:00" },
];
const p = trajetPonctuel({ date: "2026-11-19", sens: "recuperer", heure: "12:45", de: { label: "École", lat: 32.3, lon: 34.85 }, a: { label: "Maison", lat: 32.31, lon: 34.86 }, nom: "Shyrel" });
const joursJ = JSON.stringify(ajouterTrajetCeJour({}, "2026-11-19", p));
test("journée : courses acceptées, retour d'aller-retour, trajet scolaire, dans l'ordre", () => {
  egal(evenementsDuJour("2026-11-19", { demandes: demJ, joursJson: joursJ }).map((e) => e.heure), ["06:30", "10:00", "12:45", "18:00"]);
});
test("19h : résumé de demain", () => {
  const m = messageSoir("2026-11-18", { demandes: demJ, joursJson: joursJ });
  vrai(m.corps.includes("2 courses") && m.corps.includes("1 RDV beauté") && m.corps.includes("1 trajet scolaire"), m.corps);
});
test("7h : la journée course par course", () => {
  vrai(messageMatin("2026-11-19", { demandes: demJ }).corps.startsWith("06h30 ✈️"));
});
test("15 minutes avant, une seule fois", () => {
  egal(rappelsAvant(Date.parse("2026-11-19T04:15:30Z"), { demandes: demJ }).length, 1);
  egal(rappelsAvant(Date.parse("2026-11-19T04:17:30Z"), { demandes: demJ }).length, 0);
  egal(rappelsAvant(Date.parse("2026-11-19T04:13:30Z"), { demandes: demJ }).length, 0);
});
test("heure d'Israël", () => egal(maintenantIsrael(Date.parse("2026-11-19T17:00:00Z")).min, 19 * 60));
test("alertes du site", () => {
  vrai(messageSite("paiementsDeclares", { id: "x", montant: 120, moyen: "Bit", sorte: "acompte", prenom: "Sarah" }).corps.includes("120 ₪ par Bit"));
  egal(messageSite("demandes", { source: "manuel" }), null);
  vrai(messageSite("demandes", { service: "nails", serviceTitre: "Nails" }).titre.includes("rendez-vous"));
});

import { paiementsEnRetard, demandesSansReponse, semainePassee, signalVol } from "../src/pricing/planningNotif.js";
section("Suggestions : retards, attente, vols, semaine");
test("paiement en retard après 3 jours seulement", () => {
  const d = [{ id: "a", statut: "terminee", nom: "S", date: "2026-11-15", prixFinal: 100 }, { id: "b", statut: "terminee", nom: "L", date: "2026-11-16", prixFinal: 100 }];
  egal(paiementsEnRetard(d, [], "2026-11-18").map((x) => x.d.id), ["a"]);
  egal(paiementsEnRetard(d, [{ kind: "paiement", resId: "a", date: "2026-11-15", montant: 100 }], "2026-11-18").length, 0);
});
test("sans réponse depuis 2 h : une seule fois, jamais la nuit", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const d = [{ id: "x", statut: "en attente", creeLe: new Date(now - 2 * 3600000 - 30000).toISOString() }];
  egal(demandesSansReponse(d, now).length, 1);
  egal(demandesSansReponse(d, now + 120000).length, 0);
  egal(demandesSansReponse(d, Date.parse("2026-11-18T22:00:00Z")).length, 0);
});
test("semaine passée de dimanche à samedi", () => egal(semainePassee("2026-11-22"), { debut: "2026-11-15", fin: "2026-11-21" }));
test("vol : 15 min de retard ou annulé", () => {
  const vol = { sens: "arrivee", date: "2026-11-19", heure: "10:00", numero: { compagnie: "LY", numero: "001" } };
  egal(signalVol({ CHSTOL: "2026-11-19T10:00:00", CHPTOL: "2026-11-19T10:05:00", CHRMINE: "ON TIME" }, vol), null);
  egal(signalVol({ CHSTOL: "2026-11-19T10:00:00", CHPTOL: "2026-11-19T10:45:00", CHRMINE: "DELAYED" }, vol).cle, "r45");
  egal(signalVol({ CHSTOL: "2026-11-19T10:00:00", CHPTOL: "2026-11-19T10:00:00", CHRMINE: "CANCELED" }, vol).cle, "annule");
});

import { objectifDuMois, joursDeTravailRestants } from "../src/pricing/objectif.js";
import { trajetsHabituels } from "../src/pricing/habituels.js";
section("Objectif du mois et trajets habituels");
test("objectif : barre, reste, par jour de travail sans samedi", () => {
  egal(joursDeTravailRestants("2026-11", "2026-11-28"), 2); // 28 = samedi exclu : 29, 30
  const o = objectifDuMois(3000, 8000, "2026-11", "2026-11-18");
  egal([o.pct, o.reste, o.atteint], [38, 5000, false]);
  egal(objectifDuMois(100, 0, "2026-11", "2026-11-18"), null);
});
test("trajets habituels : sans doublon, sans les favoris, sans les annulés", () => {
  const F = { aeroport: [{ name: "adresse", type: "adresse" }, { name: "nb", type: "nombre" }] };
  const a = (l) => ({ adresse: { label: l, lat: 1, lon: 1 }, nb: 2, date: "2026-11-01" });
  const s = [
    { service: "aeroport", serviceTitre: "Aéroport", date: "2026-11-10", statut: "terminée", details: a("Maison, Netanya") },
    { service: "aeroport", serviceTitre: "Aéroport", date: "2026-11-05", statut: "terminée", details: a("Maison, Netanya") },
    { service: "aeroport", serviceTitre: "Aéroport", date: "2026-11-04", statut: "refusée", details: a("Hôtel, Tel Aviv") },
  ];
  const r = trajetsHabituels(s, [], F);
  egal(r.length, 1);
  egal(r[0].nom, "Aéroport · Maison");
  egal("date" in r[0].details, false);
  egal(trajetsHabituels(s, [{ service: "aeroport", details: a("Maison, Netanya") }], F).length, 0);
});
