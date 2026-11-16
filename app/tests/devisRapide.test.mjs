// TESTS DU DEVIS RAPIDE (D2a) - Rebecca Services
// Meme calculateur que le site ; message pret a envoyer ; pre-remplissage de « + Ajouter une course ».

import { test, egal, vrai, section } from "./outils.mjs";
import { ADRESSES as A, MAINTENANT } from "./donnees.mjs";
import * as S from "../src/services.js";
import { calculer } from "../src/pricing/engine.js";
import * as R from "../src/pricing/devisRapide.js";

const RAANANA = { label: "Rue Ahuza 100, Raanana", lat: 32.1848, lon: 34.8713 };
const v = { ...S.valeursInitiales("livraison"), recuperation: RAANANA, livraison: A.netanya, date: "2026-11-10", heure: "16:00" };
const res = calculer(S.versDemande("livraison", v, { km: 21, minutes: 24 }, MAINTENANT));

section("Devis rapide");
test("le cas du 9 nov. : Raanana -> Netanya = 140 ₪ (et non 240)", () => egal(res.total, 140));
test("resume livraison", () => egal(R.resume("livraison", v), "récupérer votre colis à Raanana et le livrer à Netanya"));
test("message : prix et date", () => {
  const m = R.messageDevis("livraison", v, res);
  vrai(m.includes("le tarif est de 140 ₪") && m.includes("mardi 10 novembre à 16h00"), m);
});
test("message signe Rebecca Services", () => vrai(R.messageDevis("livraison", v, res).includes("Votre temps est précieux, je vous aide à en profiter.")));
test("message sans alerte interne de rentabilite", () => vrai(!R.messageDevis("livraison", v, { ok: true, total: 100, aConfirmer: ["Rentabilité faible (retour à vide) : vérifier le prix avant de confirmer."] }).includes("Rentabilité")));
test("sur devis : pas de prix invente", () => {
  const m = R.messageDevis("demenagement", { typeDemenagement: "important" }, { ok: true, devis: true, total: null });
  vrai(m.includes("devis personnalisé") && !m.includes("₪"), m);
});
test("aeroport depuis", () => egal(R.resume("aeroport", { direction: "depuis", adresse: A.netanya }), "votre transfert depuis l'aéroport Ben Gourion jusqu'à Netanya"));
test("transport aller-retour", () => egal(R.resume("transport", { depart: A.netanya, arrivee: A.tel_aviv, typeTrajet: "ar" }), "votre trajet de Netanya à Tel Aviv (aller-retour)"));
test("pre-remplissage de l'ajout manuel", () => egal((({ detailDevis, formulaire, ...x }) => x)(R.versAjoutManuel("livraison", v, res)), { service: "livraison", date: "2026-11-10", heure: "16:00", adresses: { recuperation: RAANANA, livraison: A.netanya }, direction: "vers", magasin: "", typeTrajet: "simple", dateRetour: "", heureRetour: "", prix: "140" }));
test("pre-remplissage sans prix si sur devis", () => egal(R.versAjoutManuel("demenagement", {}, { ok: true, devis: true }).prix, ""));
test("ville sans le district en hebreu (cas du 9 nov.)", () => egal(R.resume("livraison", { recuperation: { label: "Raanana, נפת פתח תקווה" }, livraison: { label: "9 דוד רזניק, Neot Shaked, Netanya" } }), "récupérer votre colis à Raanana et le livrer à Netanya"));
test("ville sans le pays", () => egal(R.resume("transport", { depart: { label: "Herzliya, מחוז תל אביב, Israel" }, arrivee: { label: "Netanya" } }), "votre trajet de Herzliya à Netanya"));

section("Renvoyer le devis d'une demande (16 nov. 2026)");
const deborah = { service: "aeroport", nom: "Deborah Nacache", date: "2026-12-21", heure: "05:00", moyenPaiement: "Espèces", prixFinal: 250, statut: "acceptee", details: { adresse: A.netanya, direction: "vers" } };
test("devis d'une course acceptee : prenom, trajet, date, prix, paiement, confirmation", () => {
  const m = R.messageDevisDemande(deborah);
  vrai(m.startsWith("Bonjour Deborah") && m.includes("de Netanya vers l'aéroport Ben Gourion le lundi 21 décembre à 05h00, le tarif est de 250 ₪.") && m.includes("Paiement prévu : espèces.") && m.includes("confirmée"), m);
});
test("prix retenu prioritaire sur l'estimation", () => vrai(R.messageDevisDemande({ ...deborah, prixEstime: 200 }).includes("250 ₪")));
test("estimation du site si pas de prix retenu", () => vrai(R.messageDevisDemande({ ...deborah, prixFinal: undefined, prixEstime: 230 }).includes("230 ₪")));
test("sans prix : pas de devis", () => egal(R.messageDevisDemande({ ...deborah, prixFinal: null, prixEstime: null }), null));
test("cliente sans compte : rappel de creer son compte avec le code bienvenue", () => vrai(R.messageDevisDemande(deborah).includes("créer votre compte") && R.messageDevisDemande(deborah).includes("BIENVENUE10")));
test("cliente avec compte : pas de rappel", () => vrai(!R.messageDevisDemande({ ...deborah, uid: "x" }).includes("créer votre compte")));

section("Detail complet du devis (16 nov. 2026)");
const vAR = { ...S.valeursInitiales("aeroport"), adresse: A.netanya, direction: "vers", numeroVol: "LY001", heureVol: "08:00", date: "2026-12-21", heure: "05:00", typeTrajet: "ar", dateRetour: "2026-12-28", heureRetour: "18:00", valises: "2" };
const resAR = calculer(S.versDemande("aeroport", vAR, { km: 40, minutes: 35 }, MAINTENANT));
test("le message du devis rapide donne l'aller-retour, le vol, les bagages et le detail du tarif", () => {
  const m = R.messageDevis("aeroport", vAR, resAR);
  vrai(m.includes("Aller-retour") && m.includes("LY001") && m.includes("Date du retour") && m.includes("Détail du tarif"), m);
});
test("le detail est garde avec la course enregistree puis renvoye", () => {
  const det = R.versAjoutManuel("aeroport", vAR, resAR).detailDevis;
  const m = R.messageDevisDemande({ ...deborah, details: { ...deborah.details, detailDevis: det } });
  vrai(m.includes("Aller-retour") && m.includes("Détail du tarif"), m);
});

section("Aller-retour un autre jour (16 nov. 2026)");
import * as E from "../src/pricing/enchainement.js";
import * as M from "../src/pricing/ajoutManuel.js";
test("la course enregistree garde le retour", () => {
  const det = M.detailsCourse({ service: "aeroport", adresses: { adresse: A.netanya }, direction: "vers", typeTrajet: "ar", dateRetour: "2026-12-29", heureRetour: "00:45" });
  egal([det.typeTrajet, det.dateRetour, det.heureRetour], ["ar", "2026-12-29", "00:45"]);
});
test("le retour un autre jour apparait a sa date", () => {
  const r = E.retourAutreJour({ ...deborah, details: { ...deborah.details, typeTrajet: "ar", dateRetour: "2026-12-29", heureRetour: "00:45" } });
  vrai(r && r.date === "2026-12-29" && r.heure === "00:45" && r.serviceTitre.includes("(retour)") && r.estRetour);
});
test("aller simple ou retour le meme jour : rien en plus", () => {
  egal(E.retourAutreJour(deborah), null);
  egal(E.retourAutreJour({ ...deborah, details: { typeTrajet: "ar", dateRetour: deborah.date, heureRetour: "20:00" } }), null);
});
test("devis renvoye : retour indique", () => {
  const m = R.messageDevisDemande({ ...deborah, details: { ...deborah.details, typeTrajet: "ar", dateRetour: "2026-12-29", heureRetour: "00:45" } });
  vrai(m.includes("(aller-retour)") && m.includes("Retour : le mardi 29 décembre à 00h45"), m);
});

section("Modifier le devis d'une course (16 nov. 2026)");
test("formulaire garde avec la course (vol, bagages, retour)", () => {
  const f = R.versAjoutManuel("aeroport", vAR, resAR);
  const det = M.detailsCourse({ ...f, adresses: f.adresses });
  egal([det.numeroVol, det.valises, det.typeTrajet, det.dateRetour], ["LY001", "2", "ar", "2026-12-28"]);
});
test("le formulaire se pre-remplit depuis la course", () => {
  const d = { service: "aeroport", date: "2026-12-21", heure: "05:00", details: { adresse: A.netanya, direction: "vers", numeroVol: "LY001", typeTrajet: "ar", dateRetour: "2026-12-29", heureRetour: "00:45" } };
  const v2 = R.valeursDepuisDemande(d);
  egal([v2.date, v2.heure, v2.numeroVol, v2.typeTrajet, v2.dateRetour, v2.adresse.label], ["2026-12-21", "05:00", "LY001", "ar", "2026-12-29", A.netanya.label]);
});
test("mise a jour : nouvelles valeurs, prix convenu, detail du tarif seulement si meme prix", () => {
  const d = { service: "aeroport", date: "2026-12-21", heure: "05:00", prixFinal: 600, details: { adresse: A.netanya, direction: "vers", partageId: "x" } };
  const maj = R.majDepuisDevis(d, vAR, resAR, 600, { km: 40, minutes: 35 });
  vrai(maj.prixFinal === 600 && maj.details.numeroVol === "LY001" && maj.details.dateRetour === "2026-12-28" && maj.details.partageId === "x" && maj.kmEstime === 40);
  vrai(!maj.details.detailDevis.includes("Détail du tarif"), maj.details.detailDevis);
  vrai(R.majDepuisDevis(d, vAR, resAR, resAR.total).details.detailDevis.includes("Détail du tarif"));
});
test("passer en aller simple efface le retour", () => {
  const d = { service: "aeroport", details: { typeTrajet: "ar", dateRetour: "2026-12-29", heureRetour: "00:45" } };
  const maj = R.majDepuisDevis(d, { ...vAR, typeTrajet: "simple" }, resAR, 300);
  vrai(maj.details.typeTrajet === "simple" && !maj.details.dateRetour && !maj.details.heureRetour);
});
