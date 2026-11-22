// TESTS ESPACE RESTAURANT + BOUTON « EN LIGNE » (V2, 19 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import {
  DELAI_REPONSE_MS, lireLienResto, lienResto, nouvelleCleResto, cleRestoValide, restoDepuisFiche, enLigneActif, peutCommander,
  validerCommande, commandePropre, etatCommande, secondesRestantes, compteARebours, heurePlus, prixCommande,
  demandeDepuisCommande, coursesProches, tarifsResto, dansSonCreneau, majSuivi, releveResto, semaineResto, messageNotifResto, messageWhatsAppResto, messageLienResto,
} from "../src/pricing/restos.js";
import { lireFamilles } from "../src/pricing/familles.js";
import { lireCategories } from "../src/pricing/repertoire.js";

section("Espace restaurant");
const CLE = "AbCdEfGhJkMnPqRsTuVwXyZ2";
test("lien privé : lu seulement avec une clé valable", () => {
  egal(lireLienResto(`#/resto/${CLE}`), CLE);
  egal(lireLienResto(`#/resto/${CLE}/`), CLE);
  egal([lireLienResto("#/resto/court"), lireLienResto("#/resto/abc$def0123456789012345"), lireLienResto("#/admin")], ["", "", ""]);
  egal(lienResto(CLE), `https://rebeccaservices.com/#/resto/${CLE}`);
  const k = nouvelleCleResto();
  vrai(cleRestoValide(k) && k.length === 24, "clé de 24 caractères");
  vrai(nouvelleCleResto() !== k, "deux clés différentes");
});

const fiche = { id: "f1", nom: "Pizza Centrale", telephone: "0521234567", categorie: "commercants", domicile: { label: "Herzl 20, Netanya", lat: 32.33, lon: 34.85 }, contratPro: { jusqua3: 30, de3a6: 40, enPlus: 15, moyen: "Revolut" } };
test("le restaurant depuis sa fiche du Répertoire", () => {
  const r = restoDepuisFiche(fiche);
  egal(r, { nom: "Pizza Centrale", telephone: "0521234567", adresse: { label: "Herzl 20, Netanya", lat: 32.33, lon: 34.85 }, tarifs: { jusqua3: 30, de3a6: 40, enPlus: 15, tresLourd: 5 }, formule: "A", moyen: "Revolut", ficheId: "f1", actif: true });
  egal(restoDepuisFiche({ id: "f2", nom: "", telephone: "" }).tarifs, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
});

test("en ligne : seulement le jour même ; Chabbat et lien inactif bloquent", () => {
  const etat = { enLigne: true, jour: "2026-11-19" };
  vrai(enLigneActif(etat, "2026-11-19"));
  vrai(!enLigneActif(etat, "2026-11-20"), "oublié la veille = hors ligne");
  vrai(!enLigneActif({ enLigne: false, jour: "2026-11-19" }, "2026-11-19"));
  const resto = { actif: true };
  egal(peutCommander({ resto, etat, jour: "2026-11-19", dispo: { ouvert: true } }).ok, true);
  vrai(!peutCommander({ resto, etat, jour: "2026-11-20", dispo: { ouvert: true } }).ok);
  vrai(peutCommander({ resto, etat, jour: "2026-11-19", dispo: { ouvert: false, titre: "Réservations fermées : Chabbat", detail: "Reprise samedi à 18h19" } }).raison.includes("Chabbat"));
  vrai(peutCommander({ resto: { actif: false }, etat, jour: "2026-11-19" }).raison.includes("plus actif"));
});

const saisie = { client: " Dan ", telClient: "054-111-2233", adresse: { label: "Smilansky 5, Netanya", lat: 32.32, lon: 34.86 }, pretA: "19:30", note: "Code porte 1234" };
test("commande : vérifications et document propre", () => {
  egal(validerCommande(saisie), "");
  egal(validerCommande({ ...saisie, client: "" }), "Indiquez le prénom du client.");
  egal(validerCommande({ ...saisie, telClient: "12" }), "Indiquez le téléphone du client.");
  egal(validerCommande({ ...saisie, adresse: null }), "Indiquez l'adresse de livraison.");
  egal(validerCommande({ ...saisie, pretA: "25:00" }), "Indiquez l'heure à laquelle la commande est prête.");
  const c = commandePropre(saisie, "2026-11-19");
  egal(c, { client: "Dan", telClient: "054-111-2233", adresse: { label: "Smilansky 5, Netanya", lat: 32.32, lon: 34.86 }, pretA: "19:30", note: "Code porte 1234", jour: "2026-11-19", statut: "nouvelle", source: "lien" });
  egal([commandePropre(saisie, "2026-11-19", "whatsapp").statut, commandePropre(saisie, "2026-11-19", "whatsapp").source], ["acceptee", "whatsapp"]);
});

test("refus automatique après 5 minutes sans réponse", () => {
  const t0 = Date.parse("2026-11-19T17:00:00Z");
  const c = { statut: "nouvelle", creeLe: { toMillis: () => t0 } };
  egal(etatCommande(c, t0 + 60000), "nouvelle");
  egal(etatCommande(c, t0 + DELAI_REPONSE_MS), "expiree");
  egal(etatCommande({ ...c, statut: "acceptee" }, t0 + 3600000), "acceptee", "une commande acceptée ne s'éteint pas");
  egal(etatCommande({ statut: "nouvelle", creeLe: null }, t0), "nouvelle", "pas encore enregistrée = en attente");
  egal(secondesRestantes(c, t0 + 61000), 239);
  egal(compteARebours(239), "3:59");
  egal(secondesRestantes(c, t0 + 9 * 60000), 0);
  egal(etatCommande({ statut: "nouvelle", creeLe: { seconds: t0 / 1000 } }, t0 + 301000), "expiree");
});

test("heure « prête à » proposée", () => {
  egal([heurePlus("19:02", 0), heurePlus("19:02", 15), heurePlus("23:50", 30)], ["19:05", "19:20", "23:55"]);
});

test("prix du contrat selon les km", () => {
  const tarifs = { jusqua3: 30, de3a6: 40, enPlus: 15 };
  egal([prixCommande(tarifs, 2.4), prixCommande(tarifs, 5), prixCommande(tarifs, 7), prixCommande(tarifs, null)], [30, 40, 50, null]);
  egal([prixCommande(tarifs, 10), prixCommande(tarifs, 13), prixCommande(tarifs, 8, 2)], [60, null, 60]);
});

test("commande acceptée = livraison dans le Calendrier, au téléphone du restaurant", () => {
  const resto = restoDepuisFiche(fiche);
  const c = commandePropre(saisie, "2026-11-19");
  const d = demandeDepuisCommande(resto, c, { cle: CLE, id: "c1", prix: 30, km: 2.4, minutes: 7 });
  egal([d.service, d.date, d.heure, d.nom, d.telephone, d.prixFinal, d.statut, d.source, d.moyenPaiement, d.kmEstime], ["livraison", "2026-11-19", "19:30", "Pizza Centrale", "0521234567", 30, "acceptee", "manuel", "Revolut", 2.4]);
  egal(d.details.recuperation.label, "Herzl 20, Netanya");
  egal(d.details.livraison.label, "Smilansky 5, Netanya");
  egal([d.details.destinataire, d.details.telDestinataire, d.details.instructions], ["Dan", "054-111-2233", "Code porte 1234"]);
  egal(d.details.commandeResto, { cle: CLE, id: "c1" });
  vrai(d.message.includes("Prête à 19h30"));
  // Clés autorisées par la règle des courses ajoutées à la main (demandeManuelleValide)
  const permises = ["service","serviceTitre","date","heure","nom","telephone","moyenPaiement","prixEstime","prixFinal","surDevis","kmEstime","minutesEstimees","details","message","statut","source","origine","pourboire","creeLe","majLe","attribueA","realisePar","vehicule"];
  vrai(Object.keys(d).every((k) => permises.includes(k)), "clés acceptées par Firebase");
});

test("priorité aux courses du site : courses proches de l'heure", () => {
  const demandes = [
    { id: "a", date: "2026-11-19", heure: "19:00", statut: "acceptee", service: "transport" },
    { id: "b", date: "2026-11-19", heure: "21:00", statut: "acceptee" },
    { id: "c", date: "2026-11-19", heure: "19:40", statut: "terminee" },
    { id: "d", date: "2026-11-19", heure: "19:45", statut: "acceptee", details: { commandeResto: { id: "x" } } },
    { id: "e", date: "2026-11-20", heure: "19:30", statut: "acceptee" },
  ];
  egal(coursesProches(demandes, "2026-11-19", "19:30").map((d) => d.id), ["a"]);
});

test("suivi : livrée, prix, payée, annulée", () => {
  const c = { statut: "acceptee", prix: 30 };
  egal(majSuivi(c, { id: "d1", statut: "acceptee", prixFinal: 30 }, []), null);
  egal(majSuivi(c, { id: "d1", statut: "acceptee", prixFinal: 35 }, []), { prix: 35 });
  egal(majSuivi(c, { id: "d1", statut: "terminee", prixFinal: 30 }, []), { statut: "livree" });
  egal(majSuivi({ statut: "livree", prix: 30, payee: false }, { id: "d1", statut: "terminee", prixFinal: 30 }, [{ kind: "paiement", resId: "d1", montant: 30 }]), { payee: true });
  egal(majSuivi({ statut: "livree", prix: 30, payee: true }, { id: "d1", statut: "terminee", prixFinal: 30 }, [{ kind: "paiement", resId: "d1", montant: 30 }]), null);
  egal(majSuivi(c, { id: "d1", statut: "annulee" }, []), { statut: "annulee" });
});

test("relevé de la semaine côté restaurant", () => {
  const cs = [
    { jour: "2026-11-16", pretA: "19:00", statut: "livree", prix: 30, payee: true },
    { jour: "2026-11-18", pretA: "20:00", statut: "livree", prix: 40, payee: false },
    { jour: "2026-11-18", pretA: "21:00", statut: "refusee", prix: 0 },
    { jour: "2026-11-23", pretA: "19:00", statut: "livree", prix: 30 },
  ];
  const r = releveResto(cs, semaineResto("2026-11-19"));
  egal([r.debut, r.fin, r.paiementLe, r.nb, r.du, r.paye, r.reste], ["2026-11-15", "2026-11-21", "2026-11-22", 2, 70, 30, 40]);
});

test("messages", () => {
  const n = messageNotifResto({ nom: "Pizza Centrale" }, { id: "c1", pretA: "19:30", adresse: { label: "Smilansky 5" } });
  egal(n, { titre: "🍕 Commande Pizza Centrale", corps: "#C1 · Prête à 19h30 · Smilansky 5 · Réponds en 5 min", tag: "resto-c1", lien: "/admin#/admin?onglet=commandes-resto" });
  const w = messageWhatsAppResto("Pizza Centrale", saisie);
  vrai(w.includes("Client : Dan") && w.includes("Prête à 19h30") && w.includes("Code porte"));
  vrai(messageLienResto("Pizza Centrale", "https://x/#/resto/" + CLE).includes("5 minutes"));
});

section("Répertoire : fiches relues sans rien perdre");
test("commerçant, contrat, contact et relances gardés à la relecture", () => {
  const [f] = lireFamilles([{ ...fiche, contactPref: "whatsapp", relances: "oui", contratPro: { ...fiche.contratPro, lienResto: CLE, formule: "B", creneaux: "jeudi soir", bidon: 3 } }]);
  egal([f.categorie, f.contactPref, f.relances], ["commercants", "whatsapp", "oui"]);
  egal(f.contratPro, { jusqua3: 30, de3a6: 40, enPlus: 15, formule: "B", moyen: "Revolut", creneaux: "jeudi soir", lienResto: CLE });
  const [g] = lireFamilles([{ id: "g", nom: "Alexia", categorie: "proches", contactPref: "pigeon", relances: "peut-être", contratPro: { jusqua3: 1 } }]);
  egal([g.categorie, "contactPref" in g, "relances" in g, "contratPro" in g], ["proches", false, false, false]);
  egal(lireCategories(JSON.stringify({ categories: { tel_052: "commercants", tel_053: "pirate" } })), { tel_052: "commercants" });
});

section("Wolt : retenue du réglage sur les lignes importées");
import { retenueDe, verseWolt, totauxRetenues } from "../src/pricing/financesAnnee.js";
test("ligne sans retenue notée = taux du réglage ; retenue notée = gardée", () => {
  const l = { source: "Wolt", revenu: 506.86, pourboire: 24.16 };
  egal([retenueDe(l), verseWolt(l)], [0, 531.02], "sans réglage : rien n'est enlevé");
  const r = { taux: 10, base: "revenu" };
  egal([retenueDe(l, r), verseWolt(l, r)], [50.69, 480.33]);
  egal(retenueDe({ ...l, retenue: 30 }, r), 30);
  egal(retenueDe({ source: "Autre", revenu: 100 }, r), 0);
  egal(totauxRetenues([l, { ...l, caution: 300 }], r), { retenue: 101.38, caution: 300, fraisPourboires: 0 });
});
import { estLivraisonResto, messageEnRouteResto } from "../src/pricing/restos.js";
import { rangFidelite } from "../src/pricing/fidelite.js";
import { avisADemander } from "../src/pricing/finCourse.js";
test("livraison restaurant : pas de fidélité, pas d'avis, message en route au client", () => {
  const d = { id: "r1", service: "livraison", statut: "terminee", date: "2026-11-18", heure: "20:00", nom: "Ohi Sushi", telephone: "0534909590", details: { commandeResto: { cle: "k", id: "c" }, destinataire: "Tesla Cohen", telDestinataire: "0547380193" } };
  egal(estLivraisonResto(d), true);
  egal(estLivraisonResto({ details: {} }), false);
  egal(rangFidelite(d, [d]), null);
  egal(avisADemander([d], "2026-11-19").length, 0);
  egal(messageEnRouteResto(d).includes("Bonjour Tesla") && messageEnRouteResto(d).includes("Ohi Sushi"), true);
});

// 20 nov. 2026 (Rebecca) : formule A + B / B -> prix B dans un créneau réservé, prix A en dehors
test("formule A + B : le bon prix selon le jour et l'heure", () => {
  const ficheAB = { id: "f9", nom: "Ohi", telephone: "0520000000", domicile: { label: "Herzl 1, Netanya", lat: 32.3, lon: 34.8 }, contratPro: { formule: "AB", jusqua3: 30, de3a6: 40, enPlus: 20, tresLourd: 5, parHeure: 75, creneaux: "jeudi 19h-21h", prixA: { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 }, moyen: "Bit" } };
  const r = restoDepuisFiche(ficheAB);
  egal(r.formule, "AB");
  egal(r.creneaux, "jeudi 19h-21h");
  egal(r.tarifsA, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
  // 2026-11-19 = jeudi
  egal(tarifsResto(r, "2026-11-19", "19:00").jusqua3, 30, "début du créneau inclus");
  egal(tarifsResto(r, "2026-11-19", "20:59").jusqua3, 30);
  egal(tarifsResto(r, "2026-11-19", "21:00").jusqua3, 35, "fin du créneau exclue");
  egal(tarifsResto(r, "2026-11-19", "18:30").jusqua3, 35);
  egal(tarifsResto(r, "2026-11-18", "19:30").jusqua3, 35, "mercredi : prix A");
  egal(prixCommande(tarifsResto(r, "2026-11-19", "19:30"), 8, 1), 55, "B 6-9 km = 50 + 5 lourd");
  egal(prixCommande(tarifsResto(r, "2026-11-18", "19:30"), 8, 1), 60, "A 6-9 km = 55 + 5 lourd");
  vrai(dansSonCreneau(r, "2026-11-19", "20:00"));
  vrai(!dansSonCreneau(r, "2026-11-20", "20:00"));
  // Formule B seule : hors créneau = prix A aussi
  const rB = restoDepuisFiche({ ...ficheAB, contratPro: { ...ficheAB.contratPro, formule: "B" } });
  egal(tarifsResto(rB, "2026-11-18", "12:00").jusqua3, 35);
  // Ancien B sans prixA enregistré : prix A standard
  const rB2 = restoDepuisFiche({ ...ficheAB, contratPro: { ...ficheAB.contratPro, formule: "B", prixA: undefined } });
  egal(tarifsResto(rB2, "2026-11-18", "12:00"), { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
  // Formule A : toujours sa grille, pas de créneaux
  const rA = restoDepuisFiche(fiche);
  egal(tarifsResto(rA, "2026-11-19", "19:30").jusqua3, 30);
  vrai(!("creneaux" in rA));
  // Fiche relue depuis la base : A + B et prix A gardés, créneaux jusqu'à 200 caractères
  const [lue] = lireFamilles([{ ...ficheAB, categorie: "commercants" }]);
  egal(lue.contratPro.formule, "AB");
  egal(lue.contratPro.prixA, { jusqua3: 35, de3a6: 45, enPlus: 20, tresLourd: 5 });
});

import { HEURES_LISTE, erreurLigne, lignesDepuisTexte, texteDepuisLignes, lireCreneaux as lireC } from "../src/pricing/creneauxResto.js";
test("créneaux et horaires en listes déroulantes : aller-retour avec le texte", () => {
  egal(HEURES_LISTE[0], "06:00");
  egal(HEURES_LISTE.at(-1), "24:00");
  const t = texteDepuisLignes([{ de: 4, a: 4, debut: "19:00", fin: "21:00" }, { de: 0, a: 4, debut: "19:30", fin: "22:00" }, { de: 5, a: 0, debut: "11:00", fin: "14:00" }]);
  egal(t, "jeudi 19h-21h, dim-jeu 19h30-22h, ven-dim 11h-14h");
  const l = lireC(t);
  egal(l.map((x) => [x.jours, x.debut, x.fin, x.heures]), [[[4], "19:00", "21:00", 2], [[0, 1, 2, 3, 4], "19:30", "22:00", 2.5], [[0, 5, 6], "11:00", "14:00", 3]]);
  egal(lignesDepuisTexte(t), [{ de: 4, a: 4, debut: "19:00", fin: "21:00" }, { de: 0, a: 4, debut: "19:30", fin: "22:00" }, { de: 5, a: 0, debut: "11:00", fin: "14:00" }]);
  egal(erreurLigne({ de: 4, a: 4, debut: "19:00", fin: "20:00" }), "Un créneau dure 2 heures au moins.");
  egal(erreurLigne({ de: 4, a: 4, debut: "19:00", fin: "20:00" }, 0), "");
  egal(erreurLigne({ de: 4, a: 4, debut: "21:00", fin: "19:00" }, 0), "L'heure de fin doit être après l'heure de début.");
  egal(texteDepuisLignes([{ de: 4, a: 4, debut: "23:00", fin: "24:00" }]), "jeudi 23h-24h");
});

// 22 nov. 2026 : numéro de commande
import { codeCommande, numeroCommande, commandePropre as cp2, numeroLivraison } from "../src/pricing/restos.js";
section("Numéro de commande");
test("le numéro du restaurant, sinon un code automatique tiré de l'identifiant", () => {
  egal(numeroCommande({ id: "abc12xyz", numero: "457" }), "n° 457");
  egal(numeroCommande({ id: "abc12xyz" }), "#ABC12");
  egal(codeCommande("a-b_c9Zq8"), "ABC9Z");
});
test("le numéro et « prioritaire » partent avec la commande", () => {
  const c = cp2({ client: "Dan", telClient: "0541234567", adresse: { label: "Rue 1" }, pretA: "12:00", note: "", numero: " 88 ", prioritaire: true }, "2026-11-22", "lien");
  egal([c.numero, c.prioritaire], ["88", true]);
  egal(numeroLivraison({ details: { numeroResto: "88" } }), "n° 88");
  egal(numeroLivraison({ details: { commandeResto: { id: "zz9kk1" } } }), "#ZZ9KK");
});

// 22 nov. 2026 : suggestions (avancement, relevé, attente)
import { messageReleveResto, semaineFinie, attenteRestos, releveResto as rr2, messageEnRouteResto as mer2 } from "../src/pricing/restos.js";
import { avancementDe as av2 } from "../src/pricing/suiteClient.js";
import { bilanTrajet as bt2 } from "../src/pricing/finCourse.js";
section("Restaurants : suivi, relevé, attente");
test("le restaurant voit son numéro avancer", () => {
  const d = { details: { numeroResto: "457", commandeResto: { cle: "K", id: "x" } }, chrono: { simple: { prise: "10:06", departResto: "10:10" } } };
  egal(av2(d), "n° 457 : en route vers le client à 10h10");
  egal(av2({ ...d, chrono: { simple: { prise: "10:06" } } }), "n° 457 : récupérée au restaurant à 10h06");
});
test("relevé du dimanche avec les numéros, semaine finie", () => {
  const s = semaineFinie("2026-11-29");
  egal([s.debut, s.fin], ["2026-11-22", "2026-11-28"]);
  const r = rr2([{ id: "abcde1", statut: "livree", jour: "2026-11-22", pretA: "10:05", client: "Gtest", prix: 55, numero: "457" }], s);
  const m = messageReleveResto("Test2", r, "Bit");
  vrai(m.includes("n° 457") && m.includes("55 ₪") && m.includes("par Bit"));
});
test("attente au restaurant : arrivée -> récupérée", () => {
  const a = attenteRestos([{ nom: "R", details: { commandeResto: { cle: "K" } }, chrono: { simple: { arrivee: "10:00", prise: "10:12" } } }, { nom: "R", details: { commandeResto: { cle: "K" } }, chrono: { simple: { arrivee: "11:00", prise: "11:04" } } }]);
  egal([a[0].moyenne, a[0].max, a[0].longues], [8, 12, 1]);
});
test("message « en route » avec le lien de suivi", () => vrai(mer2({ nom: "R", details: { destinataire: "Dan" } }, "https://x/#/position/1").includes("https://x/#/position/1")));
test("tournée : le temps est partagé entre les commandes (pas compté deux fois)", () => {
  const d = { prixFinal: 50, chrono: { simple: { depart: "10:00", maison: "11:00" } } };
  egal(bt2(d).total, 60);
  egal(bt2({ ...d, tourneeResto: { id: "a", n: 2 } }).total, 30);
});
