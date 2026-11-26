// ETAPE 2 : INSERER UNE NOUVELLE COURSE DANS MA JOURNEE (26 nov. 2026) - exemples donnés par Rebecca
import { test, egal, vrai, section } from "./outils.mjs";
import { blocsDuJour, blocsTournee, legsDeLaDemande, requeteDepuisDemande, requeteValide, resumeAdmin, verifierInsertion } from "../src/pricing/insertion.js";

section("Insertion des courses dans ma journée (étape 2)");
const DATE = "2026-12-01"; // un mardi
const L = (label, lat, lon) => ({ label, lat, lon });
const MAISON = L("Maison, Netanya", 32.3215, 34.8532);
const HERZL = L("Herzl, Netanya", 32.3286, 34.8567);
const AGAMIM = L("Agamim, Netanya", 32.302, 34.866);
const KIKAR = L("Kikar, Netanya", 32.3329, 34.8519);
const HERZLIYA = L("Herzliya", 32.1663, 34.8433);
const TLV = L("Dizengoff, Tel Aviv", 32.0853, 34.7818);
const tournee = JSON.stringify({ trajets: [], domicile: MAISON });
const course = (id, heure, de, a, minutes, x = {}) => ({ id, statut: "acceptee", service: "transport", serviceTitre: "Transport", nom: "Kelly", date: DATE, heure, minutesEstimees: minutes, details: { depart: de, arrivee: a }, ...x });
const journee = (demandes = [], joursJson = "{}") => ({ [DATE]: blocsDuJour(DATE, { demandes, tourneeJson: tournee, joursJson }) });
const req = (service, heure, depart, arrivee, x = {}) => ({ service, date: DATE, heure, depart, arrivee, ...x });

test("journée vide : une livraison à 11h est possible", () => vrai(verifierInsertion(req("livraison", "11:00", HERZL, AGAMIM), journee()).possible));

test("colis à Netanya puis une course vers Herzliya à 12h : on ne refuse pas (dépose rapide avant)", () => {
  const j = journee([course("c1", "12:00", HERZL, HERZLIYA, 30)]);
  const r = verifierInsertion(req("livraison", "11:15", KIKAR, AGAMIM), j);
  vrai(r.possible, "possible");
  egal(r.legs[0].trou, 0); // avant la course de 12h
});

test("deux courses dans Netanya : refus si la marge de 10 min n'est pas tenue, puis la prochaine heure faisable", () => {
  const j = journee([course("c1", "11:00", HERZL, AGAMIM, 8)]); // finit vers 11h23 (8 min + 15 min sur place)
  const r = verifierInsertion(req("transport", "11:20", KIKAR, HERZL), j);
  vrai(!r.possible && r.proposition && r.proposition >= "11:33" && r.proposition <= "11:50", `proposition ${r.proposition}`);
  vrai(verifierInsertion(req("transport", r.proposition, KIKAR, HERZL), j).possible, "à l'heure proposée");
});

test("le rendez-vous suivant reste tenu avec 10 min de marge AVANT (sinon refus)", () => {
  const j = journee([course("c1", "14:00", HERZL, AGAMIM, 8)]);
  vrai(!verifierInsertion(req("transport", "13:30", HERZL, HERZLIYA), j).possible, "Herzliya à 13h30 : pas revenue à 14h");
  vrai(verifierInsertion(req("transport", "13:30", KIKAR, HERZL), j).possible, "petit trajet en ville : oui");
});

test("transport avec un colis dans le coffre : récupéré avant, livré à Tel-Aviv après la dépose", () => {
  const j = journee([course("c1", "12:00", HERZL, TLV, 45)]);
  const r = verifierInsertion(req("livraison", "11:30", KIKAR, TLV), j);
  vrai(r.possible, "possible");
  vrai(r.legs[0].trouLivraison === 1 || r.legs[0].trou === 0, "récupéré avant la course");
});

test("trajet personnel : un pro peut se rajouter entre deux étapes", () => {
  const jours = JSON.stringify({ [DATE]: { taches: [{ id: "p1", type: "perso", titre: "Trajet avec Debo", debut: "10:00", fin: "13:00", prise: HERZL, lieu: TLV, pour: "Debo", arrets: [{ nom: "Déjeuner", adresse: HERZLIYA, debut: "11:30", fin: "12:00" }] }] } });
  const j = journee([], jours);
  vrai(j[DATE].blocs.length === 3, "3 étapes");
  vrai(verifierInsertion(req("livraison", "10:15", HERZL, KIKAR), j).possible, "petite livraison entre la prise et le déjeuner");
});

test("aller à l'aéroport puis un retour depuis l'aéroport le même jour : remplir la voiture", () => {
  const AERO = L("Ben Gurion Airport Terminal 3", 32.0055, 34.8854);
  const j = journee([{ id: "a1", statut: "acceptee", service: "aeroport", nom: "Sarah", date: DATE, heure: "08:00", minutesEstimees: 50, details: { direction: "vers", adresse: HERZL } }]);
  const r = verifierInsertion(req("aeroport", "09:30", AERO, AGAMIM), j);
  vrai(r.possible, "possible");
  const s = resumeAdmin(r, j, { prix: 250 });
  vrai(s.lignes[0].apres.includes("08h00") && s.detourMin < 20 && s.gain > 200, `détour ${s.detourMin} min`);
});

test("aller-retour avec heure de retour : les deux trajets doivent passer", () => {
  const j = journee([course("c1", "16:00", HERZL, AGAMIM, 8)]);
  egal(legsDeLaDemande(req("transport", "10:00", KIKAR, HERZLIYA, { allerRetour: true, heureRetour: "15:50" })).length, 2);
  vrai(!verifierInsertion(req("transport", "10:00", KIKAR, HERZLIYA, { allerRetour: true, heureRetour: "15:50" }), j).possible, "retour 15h50 à Herzliya : pas tenu");
  vrai(verifierInsertion(req("transport", "10:00", KIKAR, HERZLIYA, { allerRetour: true, heureRetour: "14:00" }), j).possible, "retour 14h : oui");
});

test("ma journée : les courses de Jérémy ne me bloquent pas ; une activité d'enfant ne bloque que la dépose et le retour", () => {
  const jours = JSON.stringify({ [DATE]: { taches: [{ id: "b", type: "ramassage", titre: "Basket Shyrel", debut: "16:00", fin: "17:00", lieu: KIKAR }] } });
  const b = blocsDuJour(DATE, { demandes: [course("j1", "12:00", HERZL, TLV, 45, { attribueA: "jeremy" })], tourneeJson: tournee, joursJson: jours }).blocs;
  egal(b.map((x) => [x.debut, x.fin]), [[960, 965], [1020, 1025]]);
  vrai(verifierInsertion(req("livraison", "16:20", KIKAR, HERZL), { [DATE]: { blocs: b, domicile: MAISON } }).possible, "petite course pendant le basket");
});

test("tournée scolaire : chaque moment devient un bloc (maison → école → maison)", () => {
  const j = { arrets: [{ maison: "depart", heure: 450 }, { trajet: true, lieu: HERZL, debut: 460, arrivee: 458, depart: 465 }, { trajet: true, lieu: KIKAR, debut: 475, arrivee: 472, depart: 480 }, { maison: "retour", heure: 490 }] };
  const b = blocsTournee(j, MAISON);
  egal(b.map((x) => [x.debut, x.fin, x.a.label]), [[450, 490, MAISON.label]]);
});

test("adresse approximative (un quartier) acceptée ; coordonnées hors d'Israël refusées", () => {
  vrai(!!requeteValide({ service: "livraison", date: DATE, heure: "10:00", depart: { lat: 32.302, lon: 34.866 }, arrivee: HERZL }), "Agamim");
  egal(requeteValide({ service: "livraison", date: DATE, heure: "10:00", depart: { lat: 48.85, lon: 2.35 }, arrivee: HERZL }), null);
  egal(requeteValide({ service: "nails", date: DATE, heure: "10:00", depart: HERZL, arrivee: HERZL }), null);
});

test("demande enregistrée (admin) → requête : livraison avec récupération et livraison", () => {
  const r = requeteDepuisDemande({ service: "livraison", date: DATE, heure: "10:00", details: { recuperation: HERZL, livraison: AGAMIM } });
  egal([r.depart.label, r.arrivee.label, r.heure], [HERZL.label, AGAMIM.label, "10:00"]);
});

import { calculer } from "../src/pricing/engine.js";
import { GRILLE_26NOV as T } from "./ancienneGrille.mjs";
test("site : « possible » du serveur → devis affiché + « Rebecca confirme » ; jamais pendant Chabbat", () => {
  const avant = T.calendrier.creneauxDates;
  T.calendrier.creneauxDates = { [DATE]: [{ debut: "11:00", fin: "12:30", motif: "Créneau déjà réservé" }] };
  try {
    const d = { service: "livraison", date: DATE, heure: "11:30", aller: { km: 3, minutes: 8 }, zoneDepart: "netanya", zoneArrivee: "netanya" };
    vrai(calculer({ ...d }, T).bloque, "sans vérification : bloqué");
    const r = calculer({ ...d, insertionPossible: true }, T);
    vrai(!r.bloque && r.details.insertion && r.aConfirmer.some((x) => /organiser sa journée/.test(x)), "avec vérification");
    vrai(calculer({ ...d, date: "2026-12-05", heure: "11:30", insertionPossible: true }, T).bloque, "samedi = Chabbat");
  } finally {
    T.calendrier.creneauxDates = avant;
  }
});

section("Étape 3 : l'heure conseillée suit le vol (26 nov. 2026)");
import { arriveeConseillee, etatDuVol, volDeLaCourse } from "../src/pricing/vols.js";
import { messageVol } from "../src/pricing/planningNotif.js";
const arrivee = { id: "v1", service: "aeroport", statut: "acceptee", nom: "Sarah", date: DATE, heure: "15:00", details: { direction: "depuis", numeroVol: "LY 316", heureVol: "14:20", adresse: HERZL } };
const ligne = (maj) => ({ CHAORD: "A", CHFLTN: "316", CHOPER: "LY", CHSTOL: `${DATE}T14:20:00`, CHPTOL: `${DATE}T${maj}:00`, CHRMINE: "DELAYED", CHTERM: "3" });
test("atterrissage 14h20 → 14h45 : je suis là à 15h25 au lieu de 15h00 (même écart de 40 min)", () => {
  const a = arriveeConseillee(arrivee, etatDuVol(ligne("14:45"), volDeLaCourse(arrivee)));
  egal([a.prevue, a.conseillee, a.ecartVol, a.marge], ["15:00", "15:25", 25, 40]);
});
test("vol à l'heure ou départ (vers l'aéroport) : pas de nouvelle heure", () => {
  egal(arriveeConseillee(arrivee, etatDuVol(ligne("14:22"), volDeLaCourse(arrivee))), null);
  const depart = { ...arrivee, details: { ...arrivee.details, direction: "vers" } };
  egal(arriveeConseillee(depart, etatDuVol({ ...ligne("15:30"), CHAORD: "D" }, volDeLaCourse(depart))), null);
});
test("la notification de retard donne l'heure où être là", () => {
  const vol = volDeLaCourse(arrivee);
  const e = etatDuVol(ligne("14:50"), vol);
  vrai(/sois là vers 15h30 au lieu de 15h00/.test(messageVol({ d: arrivee, vol, cle: "v1" }, { cle: "r30", e }).corps));
});

section("Étape 4 : message prêt pour la cliente, courses et achats");
import { messageCliente } from "../src/pricing/insertion.js";
test("message WhatsApp : oui à son heure, ou l'heure proposée (rien sur mes autres rendez-vous)", () => {
  const d = { nom: "Kelly Cohen", date: DATE, heure: "11:20", serviceTitre: "Livraison", prixEstime: 40 };
  vrai(/Bonjour Kelly.*C'est bon pour livraison le 01\/12 à 11h20 \(40 ₪\)/s.test(messageCliente(d, { possible: true })));
  vrai(/je peux à 11h45 \(même prix : 40 ₪\)/.test(messageCliente(d, { possible: false, proposition: "11:45" })));
  egal(messageCliente(d, { possible: false, proposition: null }), "");
});
test("courses faites par Rebecca : 45 min au magasin comptées avant la livraison", () => {
  const j = journee([course("c1", "11:40", HERZL, AGAMIM, 8)]);
  vrai(!verifierInsertion(req("courses", "11:00", MAISON, KIKAR, { faitesParRebecca: true }), j).possible, "11h + 45 min : trop juste avant 11h40");
  vrai(verifierInsertion(req("courses", "11:00", MAISON, KIKAR), j).possible, "achats déjà payés (20 min) : oui");
});

section("Minimum par heure après la grille du 26 nov.");
import { minimumEffectif, alerteMinimum } from "../src/pricing/finCourse.js";
test("ancien minimum de 80 ₪/h (17 nov.) remplacé par 40 : plus d'alerte sur un aéroport à 71 ₪/h", () => {
  const m = minimumEffectif(80, Date.parse("2026-11-17T10:00:00Z"), { rentabilite: { seuilAlerteGainNetHeure: 40 } });
  egal([m.min, m.ancien], [40, 80]);
  egal(alerteMinimum({ gainNet: 125, gainNetHeure: 71 }, m.min, 250), null);
  egal(minimumEffectif(60, Date.parse("2026-11-26T09:00:00Z")).min, 60); // enregistré après : gardé
});
