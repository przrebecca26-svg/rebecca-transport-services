// LOT P1 (nouvel accueil caché) : AUCUNE nouvelle règle - vérification sur l'émulateur avec les règles v42 publiées (27 nov. 2026)
// npx firebase-tools emulators:exec --only firestore --project demo-test "node tests/regles/p1-emulateur.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-test", firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
let ok = 0, ko = 0;
const t = async (nom, p) => { try { await p; ok++; console.log("✓", nom); } catch (e) { ko++; console.log("✗", nom, String(e.message).slice(0, 200)); } };
const admin = env.authenticatedContext("adm", { email: "przrebecca26@gmail.com", email_verified: true }).firestore();
const pub = env.unauthenticatedContext().firestore();
const cliente = env.authenticatedContext("c1", { email: "cli@x.com", email_verified: true }).firestore();
const photo = "data:image/jpeg;base64," + "A".repeat(300000);
await t("Rebecca enregistre le nouvel accueil", assertSucceeds(setDoc(doc(admin, "reglages", "accueilV2"), { json: "{}" })));
await t("Rebecca ajoute une photo de bannière", assertSucceeds(setDoc(doc(admin, "pagesPhotos", "phACCUEIL00001"), { donnees: photo, pageId: "accueil", octets: photo.length })));
await t("Rebecca efface une photo retirée", assertSucceeds(deleteDoc(doc(admin, "pagesPhotos", "phACCUEIL00001"))));
await t("visiteur : lit le nouvel accueil", assertSucceeds(getDoc(doc(pub, "reglages", "accueilV2"))));
await t("visiteur : ne modifie PAS l'accueil", assertFails(setDoc(doc(pub, "reglages", "accueilV2"), { json: "{}" })));
await t("cliente connectée : ne modifie PAS l'accueil", assertFails(setDoc(doc(cliente, "reglages", "accueilV2"), { json: "{}" })));
await t("cliente connectée : n'ajoute PAS de photo", assertFails(setDoc(doc(cliente, "pagesPhotos", "phACCUEIL00002"), { donnees: photo, pageId: "accueil", octets: 1 })));
await t("non-régression : visiteur lit l'annuaire public", assertSucceeds(getDoc(doc(pub, "reglages", "prosAnnuaire"))));
await t("non-régression : visiteur ne lit PAS les dossiers des pros", assertFails(getDoc(doc(pub, "admin", "prosDossiers"))));
await t("non-régression : visiteur ne lit PAS les tarifs des pages", assertFails(getDoc(doc(pub, "pagesProAdmin", "pg1"))));
console.log(`\nLot P1 (règles v42, inchangées) : ${ok} réussis sur ${ok + ko}`);
await env.cleanup();
process.exit(ko ? 1 : 0);
