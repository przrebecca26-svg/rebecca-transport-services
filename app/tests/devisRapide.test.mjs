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
test("pre-remplissage de l'ajout manuel", () => egal(R.versAjoutManuel("livraison", v, res), { service: "livraison", date: "2026-11-10", heure: "16:00", adresses: { recuperation: RAANANA, livraison: A.netanya }, direction: "vers", magasin: "", prix: "140" }));
test("pre-remplissage sans prix si sur devis", () => egal(R.versAjoutManuel("demenagement", {}, { ok: true, devis: true }).prix, ""));
test("ville sans le district en hebreu (cas du 9 nov.)", () => egal(R.resume("livraison", { recuperation: { label: "Raanana, נפת פתח תקווה" }, livraison: { label: "9 דוד רזניק, Neot Shaked, Netanya" } }), "récupérer votre colis à Raanana et le livrer à Netanya"));
test("ville sans le pays", () => egal(R.resume("transport", { depart: { label: "Herzliya, מחוז תל אביב, Israel" }, arrivee: { label: "Netanya" } }), "votre trajet de Herzliya à Netanya"));
