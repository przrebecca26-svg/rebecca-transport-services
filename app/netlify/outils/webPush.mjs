// NOTIFICATIONS SUR LE TELEPHONE (18 nov. 2026) - Rebecca Services
// Envoi d'une notification « Web Push » vers l'iPhone de Rebecca (icone « Rebecca admin » sur l'ecran d'accueil).
// Ecrit sans aucun module a installer : seulement le module « crypto » de Node (deja dans Netlify).
//   - chiffrement du message : norme RFC 8291 (aes128gcm), obligatoire pour Apple, Google et Mozilla ;
//   - signature « VAPID » (RFC 8292) : prouve que la notification vient bien de rebeccaservices.com.
// La cle privee n'est JAMAIS dans le code : variable Netlify VAPID_PRIVEE (secrete).
import crypto from "node:crypto";
import { VAPID_PUBLIQUE } from "../../src/pricing/notifications.js";

export { VAPID_PUBLIQUE };
export const VAPID_CONTACT = "mailto:rebecca.services.transport@gmail.com";

const b64 = (b) => Buffer.from(b).toString("base64url");
const deB64 = (t) => Buffer.from(String(t || ""), "base64url");

function hkdf(sel, cle, info, longueur) {
  return Buffer.from(crypto.hkdfSync("sha256", cle, sel, info, longueur));
}

// Chiffre le texte pour UN abonnement (cles p256dh et auth donnees par le telephone)
export function chiffrer(texte, p256dh, auth, { selFixe, clePrivee } = {}) {
  const clientPublique = deB64(p256dh);
  const secretAuth = deB64(auth);
  if (clientPublique.length !== 65 || secretAuth.length !== 16) throw new Error("abonnement invalide");
  const ecdh = crypto.createECDH("prime256v1");
  if (clePrivee) ecdh.setPrivateKey(clePrivee); else ecdh.generateKeys();
  const serveurPublique = ecdh.getPublicKey();
  const partage = ecdh.computeSecret(clientPublique);
  const infoCle = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublique, serveurPublique]);
  const ikm = hkdf(secretAuth, partage, infoCle, 32);
  const sel = selFixe || crypto.randomBytes(16);
  const cek = hkdf(sel, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(sel, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const chiffreur = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const clair = Buffer.concat([Buffer.from(texte, "utf8"), Buffer.from([2])]); // 2 = dernier bloc
  const corps = Buffer.concat([chiffreur.update(clair), chiffreur.final(), chiffreur.getAuthTag()]);
  const taille = Buffer.alloc(4);
  taille.writeUInt32BE(4096);
  return Buffer.concat([sel, taille, Buffer.from([serveurPublique.length]), serveurPublique, corps]);
}

// Jeton VAPID (JWT ES256) pour le service de notifications (Apple, Google...) de cet abonnement
export function jetonVapid(endpoint, clePriveeB64, maintenant = Date.now()) {
  const pub = deB64(VAPID_PUBLIQUE);
  const cle = crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: clePriveeB64, x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const entete = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const charge = b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant / 1000) + 12 * 3600, sub: VAPID_CONTACT }));
  const signature = crypto.sign("sha256", Buffer.from(`${entete}.${charge}`), { key: cle, dsaEncoding: "ieee-p1363" });
  return `${entete}.${charge}.${b64(signature)}`;
}

// Envoie une notification. Renvoie { ok, expire } : expire = le telephone s'est desabonne (on efface l'abonnement)
export async function envoyerNotification(abonnement, message, clePriveeB64) {
  const corps = chiffrer(JSON.stringify(message), abonnement.p256dh, abonnement.auth);
  const r = await fetch(abonnement.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jetonVapid(abonnement.endpoint, clePriveeB64)}, k=${VAPID_PUBLIQUE}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: corps,
  });
  return { ok: r.ok, statut: r.status, expire: r.status === 404 || r.status === 410 };
}
