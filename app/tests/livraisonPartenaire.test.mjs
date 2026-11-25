// TESTS DE LA FORMULE « LIVRAISON PARTENAIRE » (25 nov. 2026, 21h42)
import { test, egal, vrai, section } from "./outils.mjs";
import { calculer as calc } from "../src/pricing/engine.js";
import { NOUVELLE_GRILLE as T } from "./ancienneGrille.mjs";
const calculer = (d) => calc(d, T);
import * as L from "../src/pricing/livraisonPartenaire.js";

section("Livraison partenaire");
const AUJ = "2026-11-25";
const pro = (x = {}) => ({ id: "p1", nomCommercial: "Ongles de Lou", statut: "accepte", actif: true, formule: "business", abonnement: { actif: true, mensuel: 99, debut: "2026-11-01", paiements: [{ date: "2026-11-01", montant: 99 }] }, ...x });
// Livraison dans Netanya un mardi a 11h (pas de nuit, pas de Chabbat)
const dem = (km, x = {}) => ({ service: "livraison", date: "2026-12-01", heure: "11:00", aller: { km, minutes: Math.max(4, km * 2.5) }, zoneDepart: "netanya", zoneArrivee: "netanya", ...x });
const appli = (km, opts = {}, x = {}) => {
  const d = dem(km, x);
  return L.appliquerLivraisonPartenaire(calculer(d), d, { dossier: pro(opts.pro), params: opts.params, aujourdhui: AUJ, exception: opts.exception, prixAmi: opts.prixAmi, t: T });
};

test("tarifs publics inchangés : 35 ₪ jusqu'à 3 km, 40 ₪ jusqu'à 5 km", () => {
  egal(calculer(dem(2.2)).total, 35);
  egal(calculer(dem(4.5)).total, 40);
});

test("Business : 30 ₪ au lieu de 35 ₪ jusqu'à 3 km, 35 ₪ au lieu de 40 ₪ de 3 à 5 km", () => {
  const a = appli(2.2);
  egal([a.info.statut, a.resultat.total, a.info.reduction], ["applique", 30, 5]);
  const b = appli(3.5, {}, { aller: { km: 3.5, minutes: 6 } });
  egal([b.info.statut, b.resultat.total, b.info.reduction], ["applique", 35, 5]);
  vrai(a.resultat.lignes.some((l) => l.montant === -5 && l.libelle.includes("Avantage partenaire")));
});

test("Pack Pro aussi ; Référencement et Vitrine : tarif public", () => {
  egal(appli(2, { pro: { formule: "packpro" } }).resultat.total, 30);
  for (const f of ["referencement", "vitrine"]) {
    const r = appli(2, { pro: { formule: f } });
    egal([r.info.statut, r.resultat.total], ["non_eligible", 35]);
  }
});

test("au-delà de 5 km : grille normale du site", () => {
  const r = appli(6.5);
  egal([r.info.statut, r.resultat.total], ["hors_zone", calculer(dem(6.5)).total]);
});

test("abonnement pas en cours, en retard, pro suspendu : tarif public", () => {
  egal(appli(2, { pro: { abonnement: { actif: false } } }).info.statut, "non_eligible");
  const retard = appli(2, { pro: { abonnement: { actif: true, mensuel: 99, debut: "2026-09-01", paiements: [{ date: "2026-09-01", montant: 99 }] } } });
  egal([retard.info.statut, retard.resultat.total], ["non_eligible", 35]);
  vrai(retard.info.raison.includes("retard"));
  egal(appli(2, { pro: { statut: "suspendu", actif: false } }).info.statut, "non_eligible");
});

test("non cumulable avec le Prix ami", () => {
  const r = appli(2, { prixAmi: true });
  egal([r.info.statut, r.resultat.total], ["non_cumulable", 35]);
});

test("non cumulable avec un code promo appliqué", () => {
  const d = dem(2);
  const avecPromo = { ...calculer(d), details: { ...calculer(d).details, promo: { statut: "applique", code: "X", reduction: 3 } } };
  egal(L.appliquerLivraisonPartenaire(avecPromo, d, { dossier: pro(), aujourdhui: AUJ }).info.statut, "non_cumulable");
});

test("suppléments maintenus : seule la base baisse de 5 ₪ (urgence gardée)", () => {
  const pub = calculer(dem(2, { urgent: true })).total;
  const r = appli(2, {}, { urgent: true });
  egal(r.resultat.total, pub - 5);
});

test("minimum 30 ₪ : un réglage plus bas ne descend jamais sous le minimum", () => {
  const params = L.lireParams({ paliers: [{ kmMax: 3, prix: 20 }], minimum: 30 });
  egal(appli(2, { params }).resultat.total, 30);
});

test("rentabilité < 60 ₪/h : tarif normal proposé et alerte ; exception possible", () => {
  // longue attente sur place -> rentabilite trop basse avec la reduction
  const lent = { attenteMinutes: 40 };
  const r = appli(2.5, {}, lent);
  egal([r.info.statut, r.resultat.total, r.info.reduction], ["rentabilite", 35, 0]);
  vrai(r.info.gainHeure < 60 && r.info.raison.includes("tarif normal"));
  const e = appli(2.5, { exception: true }, lent);
  egal([e.info.statut, e.resultat.total, e.info.exception], ["exception", 30, true]);
});

test("cas réel 4,5 km et 9 min de route : sous 60 ₪/h avec 35 ₪, tarif normal 40 ₪ proposé", () => {
  const r = appli(4.5, {}, { aller: { km: 4.5, minutes: 9 } });
  egal([r.info.statut, r.resultat.total, r.info.gainHeure], ["rentabilite", 40, 52]);
});

test("seuil modifiable : à 0 ₪/h la réduction passe toujours", () => {
  egal(appli(2.5, { params: L.lireParams({ seuilHeure: 0 }) }, { attenteMinutes: 40 }).info.statut, "applique");
});

test("formule désactivée : tarif public", () => {
  egal(appli(2, { params: L.lireParams({ actif: false }) }).info.statut, "non_eligible");
});

test("autres services (transport) : pas d'avantage", () => {
  const d = { ...dem(2), service: "transport" };
  const r = L.appliquerLivraisonPartenaire(calculer(d), d, { dossier: pro(), aujourdhui: AUJ });
  vrai(["hors_zone", "sans_objet"].includes(r.info.statut));
  egal(r.resultat.total, calculer(d).total);
});

test("lecture des réglages tolérante", () => {
  egal(L.lireParams("pas du json"), L.PARAMS_DEFAUT);
  egal(L.lireParams({ formules: ["business", "pirate"] }).formules, ["business"]);
});

test("champs enregistrés sur la course : rattachée au pro, montant de la réduction", () => {
  const c = L.champsCourse(appli(2).info, AUJ);
  egal([c.proPartenaire, c.livraisonPartenaire.statut, c.livraisonPartenaire.reduction, c.livraisonPartenaire.prixPublic, c.livraisonPartenaire.prixPartenaire], ["p1", "applique", 5, 35, 30]);
});

test("rubrique admin : réductions accordées, livraisons, encaissé, rentabilité, alertes ; revenus à part", () => {
  const lp = (statut, red, g = 80) => ({ proId: "p1", nom: "Ongles de Lou", statut, reduction: red, gainHeure: g, seuil: 60 });
  const demandes = [
    { id: "a", proPartenaire: "p1", statut: "terminee", date: "2026-11-20", livraisonPartenaire: lp("applique", 5, 90) },
    { id: "b", proPartenaire: "p1", statut: "terminee", date: "2026-11-21", livraisonPartenaire: lp("exception", 5, 50) },
    { id: "c", proPartenaire: "p1", statut: "acceptee", date: "2026-11-28", livraisonPartenaire: lp("rentabilite", 0, 45) },
    { id: "d", proPartenaire: "p1", statut: "refusee", date: "2026-11-22", livraisonPartenaire: lp("applique", 5) },
    { id: "e", proPartenaire: "p1", statut: "acceptee", date: "2026-11-29", prixAmi: true, livraisonPartenaire: lp("applique", 5) },
  ];
  const mouvements = [{ resId: "a", kind: "paiement", montant: 30 }, { resId: "b", kind: "paiement", montant: 30 }];
  const enc = (id, m) => m.filter((x) => x.resId === id).reduce((s, x) => s + x.montant, 0);
  const b = L.bilanLivraisonPartenaire({ dossiers: [pro()], demandes, mouvements, aujourdhui: AUJ, du: "2026-11-01", au: "2026-11-30", encaisseDe: enc, bilan: (x) => ({ total: 30, gainReel: 27 }) });
  egal([b.livraisons, b.avecAvantage, b.reductions, b.encaisse], [2, 2, 10, 60]);
  egal([b.lignes[0].exceptions, b.lignes[0].aVenir, b.lignes[0].gainHeureReel], [1, 2, 54]);
  egal(b.alertes.length, 2);
  vrai(b.alertes.some((a) => a.texte.includes("Rentabilité insuffisante")) && b.alertes.some((a) => a.texte.includes("Prix ami")));
});
