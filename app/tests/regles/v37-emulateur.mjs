// TESTS DES REGLES FIREBASE v37 (reseau de professionnels) SUR L EMULATEUR - 25 nov. 2026 : 34 reussis sur 34.
// Lancement (hors tests habituels) : copier firestore.rules a cote, puis
// npx firebase-tools emulators:exec --only firestore --project demo-test "node v37-emulateur.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, getDoc, setDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-test", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8089 } });
let ok = 0, ko = 0;
const t = async (nom, p) => { try { await p; ok++; console.log("✓", nom); } catch (e) { ko++; console.log("✗", nom, e.message.slice(0, 200)); } };
const admin = env.authenticatedContext("adm", { email: "przrebecca26@gmail.com", email_verified: true }).firestore();
const pub = env.unauthenticatedContext().firestore();
const pro1 = env.authenticatedContext("u1", { email: "lou@x.com", email_verified: true }).firestore();
const pro2 = env.authenticatedContext("u2", { email: "ali@x.com", email_verified: true }).firestore();
const intrus = env.authenticatedContext("u3", { email: "intrus@x.com", email_verified: true }).firestore();
const setPage = (v) => setDoc(doc(admin, "reglages", "pages"), { pages: { pros: { visible: v } } });
await setPage(false);
await setDoc(doc(admin, "prosAgenda", "p1"), { json: "{}", nom: "Lou" });
await setDoc(doc(admin, "prosRdv", "r0"), { proId: "p2", date: "2026-12-02", heure: "10:00", duree: 60, prestation: "", client: { nom: "X", telephone: "05" }, note: "", statut: "confirme", source: "manuel" });

// Page cachée : rien pour le public
await t("caché : le public ne lit pas l'agenda d'un pro", assertFails(getDoc(doc(pub, "prosAgenda", "p1"))));
await t("caché : pas de compteur", assertFails(setDoc(doc(pub, "prosStats", "p1"), { visites: 1 })));
// Inscription
await t("inscription en ligne acceptée", assertSucceeds(setDoc(doc(pub, "prosCandidatures", "c1"), { json: "x".repeat(60), creeLe: serverTimestamp() })));
await t("le public ne lit pas les inscriptions", assertFails(getDoc(doc(pub, "prosCandidatures", "c1"))));
// Invitations et comptes
await assertSucceeds(setDoc(doc(admin, "prosInvitations", "CODE1234567890"), { proId: "p1", email: "lou@x.com", nom: "Lou" }));
await assertSucceeds(setDoc(doc(admin, "prosInvitations", "CODE2234567890"), { proId: "p2", email: "ali@x.com", nom: "Ali" }));
await t("un intrus ne lit pas l'invitation d'un autre", assertFails(getDoc(doc(intrus, "prosInvitations", "CODE1234567890"))));
await t("un intrus ne peut pas lier un compte avec le code d'un autre", assertFails(setDoc(doc(intrus, "prosComptes", "u3"), { proId: "p1", nom: "", code: "CODE1234567890", email: "intrus@x.com", statut: "actif", creeLe: serverTimestamp() })));
await t("le pro lie son compte", assertSucceeds(setDoc(doc(pro1, "prosComptes", "u1"), { proId: "p1", nom: "Lou", code: "CODE1234567890", email: "lou@x.com", statut: "actif", creeLe: serverTimestamp() })));
await t("pas de compte pour un autre dossier", assertFails(setDoc(doc(pro2, "prosComptes", "u2"), { proId: "p1", nom: "", code: "CODE2234567890", email: "ali@x.com", statut: "actif", creeLe: serverTimestamp() })));
await assertSucceeds(setDoc(doc(pro2, "prosComptes", "u2"), { proId: "p2", nom: "Ali", code: "CODE2234567890", email: "ali@x.com", statut: "actif", creeLe: serverTimestamp() }));
await t("le pro ne peut pas se réactiver lui-même", assertFails(updateDoc(doc(pro1, "prosComptes", "u1"), { statut: "actif" })));
// Agenda et rendez-vous du pro
await t("le pro écrit son agenda", assertSucceeds(setDoc(doc(pro1, "prosAgenda", "p1"), { json: "{}", nom: "Lou", majLe: serverTimestamp() })));
await t("le pro n'écrit pas l'agenda d'un autre", assertFails(setDoc(doc(pro1, "prosAgenda", "p2"), { json: "{}", nom: "x", majLe: serverTimestamp() })));
const rdv = (proId, extra = {}) => ({ proId, date: "2026-12-02", heure: "10:00", duree: 60, prestation: "Manucure", client: { nom: "Léa", telephone: "0541112233" }, note: "", statut: "confirme", source: "manuel", creeLe: serverTimestamp(), majLe: serverTimestamp(), ...extra });
await t("le pro ajoute un rendez-vous", assertSucceeds(setDoc(doc(pro1, "prosRdv", "r1"), rdv("p1"))));
await t("le pro lit SES rendez-vous", assertSucceeds(getDocs(query(collection(pro1, "prosRdv"), where("proId", "==", "p1")))));
await t("le pro ne lit pas ceux d'un autre", assertFails(getDocs(query(collection(pro1, "prosRdv"), where("proId", "==", "p2")))));
await t("le pro ne lit pas un rendez-vous d'un autre par son numéro", assertFails(getDoc(doc(pro1, "prosRdv", "r0"))));
await t("le pro ne déplace pas un rendez-vous vers un autre pro", assertFails(updateDoc(doc(pro1, "prosRdv", "r1"), { proId: "p2" })));
await t("le pro écrit ses quarts d'heure", assertSucceeds(setDoc(doc(pro1, "prosCreneaux", "p1__2026-12-02"), { proId: "p1", cells: { "1000": true }, majLe: serverTimestamp() })));
await t("le pro n'écrit pas ceux d'un autre", assertFails(setDoc(doc(pro1, "prosCreneaux", "p2__2026-12-02"), { proId: "p2", cells: { "1000": true }, majLe: serverTimestamp() })));
await t("le public ne lit pas les rendez-vous", assertFails(getDoc(doc(pub, "prosRdv", "r1"))));
// Demande d'une cliente : page cachée -> refusée
const demande = (db, heure, rid) => runTransaction(db, async (tx) => {
  const rc = doc(db, "prosCreneaux", "p1__2026-12-02");
  const s = await tx.get(rc);
  const avant = s.exists() ? s.data().cells : {};
  const q = heure.replace(":", "");
  tx.set(doc(db, "prosRdv", rid), rdv("p1", { heure, statut: "demande", source: "client" }));
  tx.set(rc, { proId: "p1", cells: { ...avant, [q]: true }, majLe: serverTimestamp(), rdv: rid });
});
await t("caché : une cliente ne peut pas demander", assertFails(demande(pub, "11:00", "c0")));
await setPage(true);
await t("ouvert : le public lit l'agenda", assertSucceeds(getDoc(doc(pub, "prosAgenda", "p1"))));
await t("ouvert : compteur +1", assertSucceeds(setDoc(doc(pub, "prosStats", "p1"), { visites: 1 })));
await t("ouvert : pas +5", assertFails(setDoc(doc(pub, "prosStats", "p1"), { visites: 6 }, { merge: true })));
await t("ouvert : une cliente demande un créneau libre", assertSucceeds(demande(pub, "11:00", "c1")));
await t("double réservation refusée (même heure)", assertFails(demande(pub, "11:00", "c2")));
await t("créneau du pro (10h) refusé", assertFails(demande(pub, "10:00", "c3")));
await t("une cliente ne peut pas créer un rendez-vous confirmé", assertFails(setDoc(doc(pub, "prosRdv", "c4"), rdv("p1", { heure: "12:00", source: "manuel" }))));
await t("une cliente ne lit pas les rendez-vous", assertFails(getDoc(doc(pub, "prosRdv", "c1"))));
await t("une cliente ne peut pas effacer des quarts d'heure", assertFails(setDoc(doc(pub, "prosCreneaux", "p1__2026-12-02"), { proId: "p1", cells: { "1500": true }, majLe: serverTimestamp(), rdv: "c1" })));
await t("Rebecca lit tout", assertSucceeds(getDocs(collection(admin, "prosRdv"))));
await t("Rebecca suspend un pro", assertSucceeds(updateDoc(doc(admin, "prosComptes", "u1"), { statut: "suspendu" })));
await t("pro suspendu : plus d'accès", assertFails(getDocs(query(collection(pro1, "prosRdv"), where("proId", "==", "p1")))));
// v36 intacte : un exemple
await t("v36 : le public ne lit pas les demandes", assertFails(getDocs(collection(pub, "demandes"))));
await t("v36 : le public ne lit pas admin/prosDossiers", assertFails(getDoc(doc(pub, "admin", "prosDossiers"))));
console.log(`\n${ok} réussis, ${ko} échoués`);
await env.cleanup();
