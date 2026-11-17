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
  vrai(m.includes("6900 ₪") && m.includes("#/projet/AbCdEf123456") && m.startsWith("Bonjour Dana,"));
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

import { trajetsDuJour, departConseille, departIso, secondes } from "../src/pricing/traficMatin.js";
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
