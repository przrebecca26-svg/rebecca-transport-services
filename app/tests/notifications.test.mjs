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
