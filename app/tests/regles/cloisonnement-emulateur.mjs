// TESTS DE CLOISONNEMENT (26 nov. 2026, cahier « Tests finaux : sécurité ») - règles en place (firestore.rules)
// Une cliente, un restaurant, Jérémy et le public ne voient que leur part. Lancement :
// npx firebase-tools emulators:exec --only firestore --project demo-test "node cloisonnement.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync, writeFileSync } from "fs";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-test", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
let ok = 0, ko = 0;
const lignes = [];
const t = async (nom, p) => { try { await p; ok++; lignes.push("✓ " + nom); } catch (e) { ko++; lignes.push("✗ " + nom + " : " + e.message.slice(0, 160)); } };

// Données de départ (sans règles)
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "equipe", "jer"), { actif: true, services: ["livraison", "transport"], nom: "Jérémy" });
  await setDoc(doc(db, "demandes", "dLiv"), { service: "livraison", uid: "cli1", nom: "Kelly", statut: "acceptee", date: "2026-12-01" });
  await setDoc(doc(db, "demandes", "dNails"), { service: "nails", uid: "cli1", nom: "Eden", statut: "acceptee", date: "2026-12-01" });
  await setDoc(doc(db, "clients", "cli1"), { nom: "Kelly", telephone: "0500000000" });
  await setDoc(doc(db, "clients", "cli2"), { nom: "Autre", telephone: "0511111111" });
  await setDoc(doc(db, "clientsAdmin", "_repertoire"), { json: "{}" });
  await setDoc(doc(db, "admin", "tournee"), { json: "{}" });
  await setDoc(doc(db, "admin", "tourneeJours"), { json: "{}" });
  await setDoc(doc(db, "reglages", "rentabilite"), { minParHeure: 40 });
  await setDoc(doc(db, "reglages", "alerteDemandes"), { email: "x@y.z" });
  await setDoc(doc(db, "reglages", "tarifs"), { json: "{}" });
  await setDoc(doc(db, "mouvements", "m1"), { montant: 40, demandeId: "dLiv" });
  await setDoc(doc(db, "depenses", "dep1"), { montant: 50, operateur: "rebecca" });
  await setDoc(doc(db, "depenses", "dep2"), { montant: 20, operateur: "jer" });
  await setDoc(doc(db, "autresRevenus", "w1"), { montant: 300, operateur: "rebecca" });
  await setDoc(doc(db, "restos", "RESTOAAAAAAAAAAAAAAAAAAAA"), { nom: "Ohi", actif: true });
  await setDoc(doc(db, "restos", "RESTOAAAAAAAAAAAAAAAAAAAA", "commandesResto", "c1"), { client: "A" });
  await setDoc(doc(db, "restos", "RESTOBBBBBBBBBBBBBBBBBBBB"), { nom: "Autre resto", actif: true });
  await setDoc(doc(db, "sauvegardes", "s1"), { json: "{}" });
});
const pub = env.unauthenticatedContext().firestore();
const cli = env.authenticatedContext("cli1", { email: "kelly@x.com", email_verified: true }).firestore();
const jer = env.authenticatedContext("jer", { email: "jeremy@x.com", email_verified: true }).firestore();
const adm = env.authenticatedContext("adm", { email: "przrebecca26@gmail.com", email_verified: true }).firestore();

// Public
await t("public : ne lit aucune demande", assertFails(getDoc(doc(pub, "demandes", "dLiv"))));
await t("public : ne liste pas les demandes", assertFails(getDocs(collection(pub, "demandes"))));
await t("public : pas de fiche client", assertFails(getDoc(doc(pub, "clients", "cli1"))));
await t("public : pas le répertoire privé", assertFails(getDoc(doc(pub, "clientsAdmin", "_repertoire"))));
await t("public : pas la tournée ni la journée de Rebecca", assertFails(getDoc(doc(pub, "admin", "tournee"))));
await t("public : pas la journée du calendrier", assertFails(getDoc(doc(pub, "admin", "tourneeJours"))));
await t("public : pas la rentabilité", assertFails(getDoc(doc(pub, "reglages", "rentabilite"))));
await t("public : pas l'adresse des alertes", assertFails(getDoc(doc(pub, "reglages", "alerteDemandes"))));
await t("public : lit les tarifs publics", assertSucceeds(getDoc(doc(pub, "reglages", "tarifs"))));
await t("public : pas les paiements", assertFails(getDoc(doc(pub, "mouvements", "m1"))));
await t("public : pas les dépenses", assertFails(getDoc(doc(pub, "depenses", "dep1"))));
await t("public : pas les sauvegardes", assertFails(getDoc(doc(pub, "sauvegardes", "s1"))));
await t("public : ne liste pas les restaurants", assertFails(getDocs(collection(pub, "restos"))));

// Cliente
await t("cliente : lit SA fiche", assertSucceeds(getDoc(doc(cli, "clients", "cli1"))));
await t("cliente : pas la fiche d'une autre", assertFails(getDoc(doc(cli, "clients", "cli2"))));
await t("cliente : ne lit pas les demandes (même la sienne, par la base)", assertFails(getDoc(doc(cli, "demandes", "dLiv"))));
await t("cliente : pas l'admin ni la rentabilité", assertFails(getDoc(doc(cli, "reglages", "rentabilite"))));
await t("cliente : pas la tournée", assertFails(getDoc(doc(cli, "admin", "tournee"))));
await t("cliente : pas les paiements", assertFails(getDoc(doc(cli, "mouvements", "m1"))));
await t("cliente : pas le répertoire", assertFails(getDoc(doc(cli, "clientsAdmin", "_repertoire"))));

// Restaurant (lien secret) : son espace seulement
await t("restaurant : lit sa fiche par son lien", assertSucceeds(getDoc(doc(pub, "restos", "RESTOAAAAAAAAAAAAAAAAAAAA"))));
await t("restaurant : lit ses commandes par son lien", assertSucceeds(getDocs(collection(pub, "restos", "RESTOAAAAAAAAAAAAAAAAAAAA", "commandesResto"))));
await t("restaurant : pas les demandes", assertFails(getDoc(doc(pub, "demandes", "dLiv"))));

// Jérémy (coéquipier actif) : co-gestion du coursier et du transport, rien d'autre
await t("Jérémy : lit une livraison (co-gestion)", assertSucceeds(getDoc(doc(jer, "demandes", "dLiv"))));
await t("Jérémy : PAS les rendez-vous beauté", assertFails(getDoc(doc(jer, "demandes", "dNails"))));
await t("Jérémy : liste seulement les services de l'équipe", assertSucceeds(getDocs(query(collection(jer, "demandes"), where("service", "in", ["livraison", "transport"])))));
await t("Jérémy : ne liste pas toutes les demandes", assertFails(getDocs(collection(jer, "demandes"))));
await t("Jérémy : pas la tournée privée de Rebecca", assertFails(getDoc(doc(jer, "admin", "tournee"))));
await t("Jérémy : pas la journée privée de Rebecca", assertFails(getDoc(doc(jer, "admin", "tourneeJours"))));
await t("Jérémy : ses dépenses", assertSucceeds(getDoc(doc(jer, "depenses", "dep2"))));
await t("Jérémy : PAS les dépenses de Rebecca", assertFails(getDoc(doc(jer, "depenses", "dep1"))));
await t("Jérémy : PAS le Wolt de Rebecca", assertFails(getDoc(doc(jer, "autresRevenus", "w1"))));
await t("Jérémy : pas les sauvegardes", assertFails(getDoc(doc(jer, "sauvegardes", "s1"))));
await t("Jérémy : ne s'ajoute pas de droits", assertFails(setDoc(doc(jer, "equipe", "jer"), { actif: true, services: ["nails"], nom: "Jérémy" })));

// Rebecca
await t("Rebecca : lit tout (tournée, beauté)", assertSucceeds(Promise.all([getDoc(doc(adm, "admin", "tournee")), getDoc(doc(adm, "demandes", "dNails"))])));

await env.cleanup();
lignes.push(`\n${ok} réussis sur ${ok + ko}`);
writeFileSync("resultat.txt", lignes.join("\n"));
console.log(lignes.join("\n"));
process.exit(ko ? 1 : 0);
