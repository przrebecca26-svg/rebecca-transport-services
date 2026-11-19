// TESTS DIGITAL & APPLICATIONS (17 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import {
  formuleConseillee, erreursEcran, construireDemandeDigital, lireLienProjet, lienProjet, prixConseille, totalDevis, lignesPropres,
  echeancier, etatEcheance, bilanEcheances, finGarantie, enGarantie, maintenanceDuMois, enHeures, avancement, cahierDepuisTexte,
  dossierPropre, aFournir, QUESTIONS_DOSSIER, demandeEcheance, etapeAtteinte, messageDevis,
} from "../src/pricing/digital.js";
import { indicateurs } from "../src/pricing/tableauBord.js";

section("Digital : formule conseillée");
test("règle du 5 nov.", () => {
  egal(formuleConseillee([]), "");
  egal(formuleConseillee(["presentation", "contact"]), "Essentielle");
  egal(formuleConseillee(["presentation", "espaceClient"]), "Business");
  egal(formuleConseillee(["presentation", "paiement"]), "Sur mesure");
  egal(formuleConseillee(["presentation", "contact", "reservation", "emails", "whatsapp", "maps", "promos"]), "Sur mesure");
  egal(formuleConseillee(["inconnue"]), "");
});

section("Digital : questionnaire");
const f = { nom: "Dana Levi", email: "dana@exemple.com", telephone: "054-123-4567", contact: "whatsapp", pays: "israel", typeProjet: "Site vitrine professionnel", domaine: "Beauté et bien-être", description: "Un site pour mon institut avec mes soins.", fonctions: ["presentation", "contact"], demarrage: "Dans le mois", budget: "7 000 à 15 000 ₪", consentement: true };
test("écrans valides", () => {
  egal(erreursEcran(1, f), {});
  egal(erreursEcran(2, f), {});
  egal(erreursEcran(3, f), {});
});
test("erreurs", () => {
  vrai(erreursEcran(1, { ...f, email: "x" }).email);
  vrai(erreursEcran(2, { ...f, fonctions: [] }).fonctions);
  vrai(erreursEcran(2, { ...f, domaine: "Autre" }).domaineAutre);
  vrai(erreursEcran(3, { ...f, consentement: false }).consentement);
});
test("document créé", () => {
  const d = construireDemandeDigital(f, "uid1");
  egal([d.statut, d.source, d.formuleConseillee, d.uid, d.consentement, d.domaineAutre], ["nouvelle", "site", "Essentielle", "uid1", true, ""]);
  vrai(!("uid" in construireDemandeDigital(f)));
});
test("lien de suivi", () => {
  egal(lireLienProjet("#/projet/AbCdEf123456"), "AbCdEf123456");
  egal(lireLienProjet("#/projet/court"), null);
  vrai(lienProjet("AbCdEf123456").endsWith("#/projet/AbCdEf123456"));
});

section("Digital : devis et échéancier");
test("règle D4 : heures × 240 + 20 %, arrondi à 50", () => {
  egal(prixConseille(29), 8400);
  egal(prixConseille(10, 200), 2400);
  egal(prixConseille(0), 0);
});
test("lignes et total", () => {
  const l = [{ libelle: "Formule Essentielle", montant: "6900" }, { libelle: "WhatsApp", montant: 800 }, { libelle: "Étude déduite", montant: -450 }, { libelle: "", montant: 5 }];
  egal(lignesPropres(l).length, 3);
  egal(totalDevis(l), 7250);
});
test("40 / 30 / 30, le dernier absorbe les arrondis", () => {
  egal(echeancier(7250).map((e) => e.montant), [2900, 2175, 2175]);
  egal(echeancier(1001).map((e) => e.montant), [400, 300, 301]);
  egal(echeancier(0), []);
});
test("état des échéances d'après les paiements", () => {
  const e = { montant: 2900, demandeId: "d1" };
  egal(etatEcheance({ montant: 2900 }).etat, "a_demander");
  egal(etatEcheance(e, []).etat, "demande");
  egal(etatEcheance(e, [{ resId: "d1", kind: "paiement", montant: 2900 }]).etat, "paye");
  const b = bilanEcheances([e, { montant: 2175, demandeId: "d2" }], [{ resId: "d1", kind: "paiement", montant: 1000 }]);
  egal([b.total, b.recu, b.reste], [5075, 1000, 4075]);
});
test("échéance = demande Digital terminée, comptée dans le CA digital", () => {
  const d = demandeEcheance({ id: "p1", nom: "Dana Levi", telephone: "0541234567" }, { libelle: "Acompte à la commande", pourcent: 40, montant: 2900 }, 0, "2026-11-17");
  egal([d.service, d.statut, d.source, d.prixFinal, d.details.projetDigital], ["digital", "terminee", "manuel", 2900, "p1"]);
  const i = indicateurs({ demandes: [{ ...d, id: "x" }], mouvements: [{ resId: "x", kind: "paiement", montant: 2900, date: "2026-11-17" }], periode: { debut: "2026-11-01", fin: "2026-11-30" } });
  egal([i.parDomaine.digital, i.encaisse], [2900, 2900]);
});
test("message du devis", () => {
  const m = messageDevis({ id: "AbCdEf123456", nom: "Dana Levi", formule: "Essentielle", lignesDevis: [{ libelle: "Formule Essentielle", montant: 6900 }] });
  vrai(m.includes("6 900 ₪") && m.includes("#/projet/AbCdEf123456") && m.startsWith("Bonjour Dana,"));
});

section("Digital : garantie, maintenance, cahier, dossier");
test("garantie 60 jours", () => {
  egal(finGarantie("2026-11-17"), "2027-01-16");
  egal(enGarantie("2026-11-17", "2026-12-01"), true);
  egal(enGarantie("2026-11-17", "2027-01-17"), false);
});
test("maintenance du mois", () => {
  const m = maintenanceDuMois({ niveau: "Confort", interventions: [{ date: "2026-11-03", minutes: 60 }, { date: "2026-11-20", minutes: 45 }, { date: "2026-10-30", minutes: 30 }] }, "2026-11");
  egal([m.inclus, m.utilise, m.restant, m.depassement], [90, 105, 0, 15]);
  egal(enHeures(105), "1 h 45");
  egal(enHeures(30), "30 min");
});
test("cahier des charges à cocher", () => {
  const c = cahierDepuisTexte("- Page d'accueil\n✓ Logo\n[x] Formulaire\nEspace client");
  egal(c.map((x) => x.fait), [false, true, true, false]);
  egal(c[1].texte, "Logo");
  egal(avancement(c), { faits: 2, total: 4, pourcent: 50 });
});
test("dossier de lancement", () => {
  egal(Object.keys(dossierPropre({ nomCommercial: " Dana ", inconnu: "x", logo: "" })), ["nomCommercial"]);
  const tout = aFournir({}, "Business").length;
  egal(tout, QUESTIONS_DOSSIER.length);
  egal(aFournir({}, "Essentielle").length, tout - 4);
});
test("frise du client", () => {
  egal(etapeAtteinte("etude", "nouvelle"), true);
  egal(etapeAtteinte("etude", "devis_envoye"), false);
  egal(etapeAtteinte("maintenance", "livre"), true);
});

import { erreursPartenaire, construireCandidature, resumeCandidature } from "../src/pricing/partenaires.js";
section("Devenir partenaire");
const cand = { prenom: "Yossi", nom: "Cohen", telephone: "0521234567", email: "y@ex.com", ville: "Netanya", vehicules: ["scooter", "x"], services: ["livraison"], jours: ["Lundi"], majeur: true, consentement: true };
test("candidature valide", () => {
  egal(erreursPartenaire(cand), {});
  const c = construireCandidature(cand);
  egal([c.statut, c.vehicules, c.permis], ["nouvelle", ["scooter"], false]);
  vrai(resumeCandidature(c).includes("Scooter"));
});
test("erreurs", () => {
  vrai(erreursPartenaire({ ...cand, majeur: false }).majeur);
  vrai(erreursPartenaire({ ...cand, vehicules: [] }).vehicules);
});

import { rappelsDuSoir, documentRest, motDePasseRobot } from "../src/pricing/rappelsAuto.js";
section("Rappels envoyés tout seuls");
test("retours et rendez-vous de demain, une seule fois", () => {
  const demandes = [
    { id: "a", service: "aeroport", statut: "acceptee", nom: "Dana Levi", date: "2026-11-10", prixFinal: 500, details: { typeTrajet: "ar", dateRetour: "2026-11-18", heureRetour: "14:00" } },
    { id: "b", service: "nails", serviceTitre: "Semi-permanent", statut: "acceptee", nom: "Lia", date: "2026-11-18", heure: "10:00" },
    { id: "c", service: "nails", statut: "acceptee", nom: "Mia", date: "2026-11-18", heure: "11:00", rappelMailAutoLe: "2026-11-17" },
  ];
  const r = rappelsDuSoir(demandes, [], "2026-11-17");
  egal(r.map((x) => x.demande.id), ["a", "b"]);
  vrai(r[0].texte.includes("Petit rappel") && r[1].sujet.includes("rendez-vous"));
});
test("lecture REST et mot de passe", () => {
  const d = documentRest({ name: "projects/p/databases/(default)/documents/demandes/X1", fields: { statut: { stringValue: "acceptee" }, prixFinal: { integerValue: "500" }, details: { mapValue: { fields: { dateRetour: { stringValue: "2026-11-18" } } } } } });
  egal(d, { id: "X1", statut: "acceptee", prixFinal: 500, details: { dateRetour: "2026-11-18" } });
  egal(motDePasseRobot().length, 24);
});

import { trajetsDuJour, departConseille, departIso, secondes, etapesCourses } from "../src/pricing/traficMatin.js";
section("Trafic du matin");
test("trajets de la journée depuis la maison", () => {
  const maison = { label: "Maison", lat: 32.3, lon: 34.85 };
  const ecole = { label: "École Ouziel, Netanya", lat: 32.31, lon: 34.86 };
  const gan = { label: "Gan, Netanya", lat: 32.32, lon: 34.87 };
  const fil = [
    { min: 450, genre: "maison", texte: "Partir de la maison" },
    { min: 470, genre: "arret", adresse: ecole, lieu: "École Ouziel", texte: "Déposer Shyrel" },
    { min: 480, genre: "arret", adresse: ecole, lieu: "École Ouziel", texte: "Déposer X" },
    { min: 495, genre: "arret", adresse: gan, lieu: "Gan", texte: "Déposer Joy" },
    { min: 520, genre: "maison", texte: "De retour à la maison" },
  ];
  const t = trajetsDuJour(fil, maison, 0);
  egal(t.map((x) => `${x.nomDe}>${x.nomVers}`), ["Maison>École Ouziel", "École Ouziel>Gan", "Gan>Maison"]);
  egal(trajetsDuJour(fil, maison, 490).length, 2);
});
test("les courses acceptées du jour entrent dans le trafic (19 nov.)", () => {
  const maison = { label: "Maison", lat: 32.3, lon: 34.85 };
  const ecole = { label: "École Ouziel, Netanya", lat: 32.31, lon: 34.86 };
  const neot = { label: "Neot Shaked, Netanya", lat: 32.29, lon: 34.87 };
  const centre = { label: "Centre, Netanya", lat: 32.33, lon: 34.86 };
  const courses = [
    { id: "a", service: "transport", statut: "acceptee", heure: "11:40", nom: "Deborah", details: { depart: neot, arrivee: centre } },
    { id: "b", service: "livraison", statut: "terminee", heure: "11:30", details: {} }, // sans adresse : ignorée
    { id: "c", service: "transport", statut: "en attente", heure: "12:00", details: { depart: neot, arrivee: centre } },
  ];
  const e = etapesCourses(courses);
  egal(e.map((x) => x.texte), ["Récupérer (Deborah)", "Déposer (Deborah)"]);
  vrai(e[1].min > e[0].min);
  const fil = [
    { min: 450, genre: "maison", texte: "Partir de la maison" },
    { min: 470, genre: "arret", adresse: ecole, lieu: "École Ouziel", texte: "Déposer Shyrel" },
    { min: 490, genre: "maison", texte: "De retour à la maison" },
    { min: 830, genre: "maison", texte: "Partir de la maison" },
    ...e,
  ];
  const t = trajetsDuJour(fil, maison, 0);
  egal(t.map((x) => `${x.nomDe}>${x.nomVers}`), ["Maison>École Ouziel", "École Ouziel>Maison", "Maison>Neot Shaked", "Neot Shaked>Centre", "Centre>Maison"]);
  const retour = etapesCourses([{ ...courses[0], estRetour: true }]);
  egal(retour.map((x) => x.lieu), ["Centre", "Neot Shaked"]);
});
test("départ conseillé et heure d'Israël", () => {
  egal(departConseille(470, 900), 450);
  egal(departIso("2026-11-18", 450), "2026-11-18T05:30:00.000Z");
  egal(departIso("2026-07-01", 450), "2026-07-01T04:30:00.000Z");
  egal(secondes("754s"), 754);
});

import { validerPrestation } from "../src/pricing/catalogue.js";
section("Catalogue Digital : durée facultative");
test("formule Digital sans durée enregistrable, beauté toujours avec durée", () => {
  const base = { activite: "digital", categorie: "Formules", nom: "Formule Essentielle", typePrix: "apartir", prix: "6900", dureeMinutes: "", publiee: true };
  const r = validerPrestation(base);
  egal([r.erreur, r.prestation && r.prestation.dureeMinutes], ["", null]);
  vrai(validerPrestation({ ...base, activite: "nails", typePrix: "fixe" }).erreur.includes("Durée"));
});

import { devisAutomatique } from "../src/pricing/digital.js";
import { CATALOGUE_DEPART } from "../src/pricing/catalogue.js";
section("Devis automatique");
test("Essentielle + WhatsApp + Google Maps", () => {
  const d = devisAutomatique({ fonctions: ["presentation", "contact", "whatsapp", "maps"], budget: "7 000 à 15 000 ₪" }, CATALOGUE_DEPART);
  egal(d.formule, "Essentielle");
  egal(d.lignes.map((l) => [l.libelle, l.montant]), [["Formule Essentielle", 6900], ["WhatsApp", 800], ["Google Maps", 1000]]);
  egal([d.total, d.heures, d.notes.length], [8700, 30, 0]);
});
test("Business : WhatsApp et statistiques compris, fidélité en option", () => {
  const d = devisAutomatique({ fonctions: ["espaceClient", "whatsapp", "stats", "promos"] }, CATALOGUE_DEPART);
  egal(d.lignes.map((l) => l.libelle), ["Formule Business", "Fidélité et codes promo"]);
});
test("test de Rebecca : Sur mesure, budget trop petit signalé", () => {
  const d = devisAutomatique({ fonctions: ["commandes", "paiement", "emails", "whatsapp", "promos", "stats", "langues", "admin", "espaceClient", "presentation"], formuleEnvisagee: "Essentielle", budget: "Moins de 7 000 ₪" }, CATALOGUE_DEPART);
  egal(d.formule, "Sur mesure");
  egal(d.lignes.map((l) => [l.libelle, l.montant]), [["Formule Sur mesure", 22000], ["Langue supplémentaire", 700]]);
  vrai(d.notes.some((n) => n.includes("budget")) && d.notes.some((n) => n.includes("Essentielle")));
});
import { shekels } from "../src/pricing/digital.js";
test("montants lisibles", () => {
  egal([shekels(22700), shekels(360), shekels(1234.5), shekels(-450)], ["22 700 ₪", "360 ₪", "1 234,50 ₪", "−450 ₪"]);
});

import { validerAutreRevenu, verseWolt, totauxRetenues } from "../src/pricing/financesAnnee.js";
section("Relevé Wolt (19 nov.)");
test("retenue, caution et n° de facture : versé = revenu + pourboires − retenue − caution", () => {
  const v = validerAutreRevenu({ source: "Wolt", periode: "semaine", debut: "2026-07-16", fin: "2026-07-22", livraisons: "19", revenu: "421,11", pourboire: "16.95", retenue: "131,42", caution: "300", numero: "117000001" });
  egal(v.erreur, "");
  egal([v.ligne.retenue, v.ligne.caution, v.ligne.numero], [131.42, 300, "117000001"]);
  egal(verseWolt(v.ligne), 6.64);
  const sans = validerAutreRevenu({ source: "Wolt", periode: "semaine", debut: "2026-11-08", fin: "2026-11-15", livraisons: "18", revenu: "516.02", pourboire: "12.71" });
  egal(["retenue" in sans.ligne, verseWolt(sans.ligne)], [false, 528.73]);
  vrai(validerAutreRevenu({ source: "Wolt", periode: "jour", debut: "2026-11-08", fin: "2026-11-08", livraisons: "1", revenu: "10", pourboire: "0", retenue: "-5" }).erreur);
  egal(totauxRetenues([v.ligne, sans.ligne]), { retenue: 131.42, caution: 300 });
});

import { fabriquerPdf, versWinAnsi } from "../src/pricing/pdfSimple.js";
import { recuPdf, carteCadeauPdf } from "../src/pricing/documentsPdf.js";
section("PDF du reçu et de la carte cadeau (19 nov.)");
const texteDe = (o) => String.fromCharCode(...o);
test("un vrai fichier PDF, accents et ₪ lisibles", () => {
  egal(versWinAnsi("é₪"), [0xe9, 73, 76, 83]);
  egal(versWinAnsi("א")[0], 63);
  const p = texteDe(fabriquerPdf({ elements: [{ t: "texte", x: 10, y: 10, texte: "Payé (test)" }] }));
  vrai(p.startsWith("%PDF-1.4") && p.includes("%%EOF") && p.includes("Payé \\(test\\)"));
  const xref = Number(/startxref\n(\d+)/.exec(p)[1]);
  egal(p.slice(xref, xref + 4), "xref");
});
test("reçu et carte cadeau", () => {
  const r = texteDe(recuPdf({ numero: "20261119-ABCDE", client: "Test", lignes: [{ libelle: "Livraison", montant: 30 }, { libelle: "Total", montant: 30, gras: true }] }));
  vrai(r.includes("20261119-ABCDE") && r.includes("30 ILS"));
  const c = texteDe(carteCadeauPdf({ montant: 100, pourNom: "R", acheteurNom: "T", code: "RS-577U-9J4P", solde: 10 }));
  vrai(c.includes("RS-577U-9J4P") && c.includes("Solde : 10 ILS"));
});

import { sauvegardeJson, COLLECTIONS_SAUVEGARDE } from "../src/pricing/sauvegarde.js";
section("Sauvegarde manuelle complète (19 nov.)");
test("la sauvegarde contient aussi Wolt, Répertoire, cartes cadeaux, réglages…", () => {
  const j = JSON.parse(sauvegardeJson({ demandes: [], mouvements: [], depenses: [], autres: { autresRevenus: [{ id: "w", revenu: 516.02 }], cartesCadeaux: [{ id: "c", code: "RS-577U-9J4P" }] } }));
  egal([j.nombre.autresRevenus, j.nombre.cartesCadeaux, j.autres.cartesCadeaux[0].code], [1, 1, "RS-577U-9J4P"]);
  vrai(COLLECTIONS_SAUVEGARDE.includes("cartesCadeaux") && COLLECTIONS_SAUVEGARDE.includes("autresRevenus"));
  egal("autres" in JSON.parse(sauvegardeJson({ demandes: [], mouvements: [], depenses: [] })), false);
});
