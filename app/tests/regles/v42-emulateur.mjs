// TESTS DES REGLES FIREBASE v42 (generateur de pages pros, lot 1) SUR L'EMULATEUR - 27 nov. 2026
// npx firebase-tools emulators:exec --only firestore --project demo-test "node tests/regles/v42-emulateur.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-test", firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
let ok = 0, ko = 0;
const t = async (nom, p) => { try { await p; ok++; console.log("✓", nom); } catch (e) { ko++; console.log("✗", nom, String(e.message).slice(0, 200)); } };
const admin = env.authenticatedContext("adm", { email: "przrebecca26@gmail.com", email_verified: true }).firestore();
const pub = env.unauthenticatedContext().firestore();
const pro = env.authenticatedContext("u1", { email: "lou@x.com", email_verified: true }).firestore();
const cliente = env.authenticatedContext("c1", { email: "cli@x.com", email_verified: true }).firestore();
const photo = "data:image/jpeg;base64," + "A".repeat(330000);
const PH = "phAAAAAAAAAAAA1";

await t("Rebecca écrit une page (brouillon, tarif)", assertSucceeds(setDoc(doc(admin, "pagesProAdmin", "pg1"), { json: '{"tarif":{"creation":100},"notePrivee":"secret"}' })));
await t("Rebecca écrit une version", assertSucceeds(setDoc(doc(admin, "pagesProVersions", "pg1"), { json: "[]" })));
await t("Rebecca publie une page", assertSucceeds(setDoc(doc(admin, "pagesPubliques", "mode-tendances"), { json: '{"statut":"publiee"}' })));
await t("Rebecca enregistre une photo de 330 Ko", assertSucceeds(setDoc(doc(admin, "pagesPhotos", PH), { donnees: photo, pageId: "pg1", octets: photo.length })));
await t("Rebecca crée un aperçu privé", assertSucceeds(setDoc(doc(admin, "pagesApercus", "A".repeat(28)), { json: "{}", expireLeMs: Date.now() + 1000 })));
await t("Rebecca liste ses pages", assertSucceeds(getDocs(collection(admin, "pagesProAdmin"))));

await t("public : lit UNE page publiée par son adresse", assertSucceeds(getDoc(doc(pub, "pagesPubliques", "mode-tendances"))));
await t("public : lit UNE photo par son numéro", assertSucceeds(getDoc(doc(pub, "pagesPhotos", PH))));
await t("public : lit un aperçu avec le lien secret", assertSucceeds(getDoc(doc(pub, "pagesApercus", "A".repeat(28)))));
await t("public : ne liste PAS les pages publiées", assertFails(getDocs(collection(pub, "pagesPubliques"))));
await t("public : ne liste PAS les photos", assertFails(getDocs(collection(pub, "pagesPhotos"))));
await t("public : ne liste PAS les aperçus privés", assertFails(getDocs(collection(pub, "pagesApercus"))));
await t("public : ne lit PAS les brouillons ni les tarifs", assertFails(getDoc(doc(pub, "pagesProAdmin", "pg1"))));
await t("public : ne lit PAS les anciennes versions", assertFails(getDoc(doc(pub, "pagesProVersions", "pg1"))));
await t("un pro connecté ne lit PAS les tarifs ni brouillons", assertFails(getDoc(doc(pro, "pagesProAdmin", "pg1"))));
await t("un pro connecté ne liste PAS les pages des autres", assertFails(getDocs(collection(pro, "pagesProAdmin"))));
await t("un pro ne liste PAS les photos des autres", assertFails(getDocs(collection(pro, "pagesPhotos"))));
await t("un pro ne modifie PAS une page publiée", assertFails(setDoc(doc(pro, "pagesPubliques", "mode-tendances"), { json: '{"statut":"publiee"}' })));
await t("un pro n'efface PAS une photo", assertFails(deleteDoc(doc(pro, "pagesPhotos", PH))));
await t("une cliente n'écrit PAS de photo", assertFails(setDoc(doc(cliente, "pagesPhotos", "phBBBBBBBBBBBB1"), { donnees: photo, pageId: "x", octets: 1 })));
await t("public n'écrit PAS d'aperçu", assertFails(setDoc(doc(pub, "pagesApercus", "B".repeat(28)), { json: "{}", expireLeMs: 1 })));
await t("Rebecca : photo trop lourde refusée", assertFails(setDoc(doc(admin, "pagesPhotos", "phCCCCCCCCCCCC1"), { donnees: "data:image/jpeg;base64," + "A".repeat(950000), pageId: "x", octets: 1 })));
await t("Rebecca : pas autre chose qu'une image", assertFails(setDoc(doc(admin, "pagesPhotos", "phDDDDDDDDDDDD1"), { donnees: "<script>", pageId: "x", octets: 1 })));
await t("Rebecca : adresse de page invalide refusée", assertFails(setDoc(doc(admin, "pagesPubliques", "Mauvaise_Adresse"), { json: "{}" })));
await t("Rebecca : champ en trop refusé", assertFails(setDoc(doc(admin, "pagesPubliques", "autre-page"), { json: "{}", tarif: 100 })));
await t("non-régression : public lit toujours reglages/tarifs", assertSucceeds(getDoc(doc(pub, "reglages", "tarifs"))));
await t("non-régression : public ne lit toujours pas admin/prosDossiers", assertFails(getDoc(doc(pub, "admin", "prosDossiers"))));

console.log(`\nRègles v42 : ${ok} réussis sur ${ok + ko}`);
await env.cleanup();
process.exit(ko ? 1 : 0);
