// TESTS « SUIVI DES VOLS » (17 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as V from "../src/pricing/vols.js";
import * as S from "../src/services.js";

section("Vols : numéro, bonne ligne du tableau, retard");
const L = (o) => ({ CHOPER: "TO", CHFLTN: "3453", CHOPERD: "TRANSAVIA FRANCE", CHSTOL: "2026-11-17T14:35:00", CHPTOL: "2026-11-17T14:35:00", CHAORD: "D", CHLOCCT: "PARIS", CHTERM: 3, CHRMINE: "ON TIME", ...o });
const course = (o = {}, det = {}) => ({ service: "aeroport", date: "2026-11-17", heure: "11:30", details: { direction: "vers", numeroVol: "T03453", heureVol: "14:35", ...det }, ...o });

test("numéro de vol : espaces, tiret, zéro tapé à la place du O", () => {
  egal(V.lireNumeroVol("ly 001"), { compagnie: "LY", numero: "001" });
  egal(V.lireNumeroVol("T03453"), { compagnie: "T0", numero: "3453" });
  egal(V.lireNumeroVol("W6-2325"), { compagnie: "W6", numero: "2325" });
  egal(V.lireNumeroVol("ELY315"), { compagnie: "", numero: "315" });
  egal(V.lireNumeroVol("je ne sais pas"), null);
  egal(V.numerosPossibles("001"), ["001", "1", "0001"]);
  vrai(V.adresseRecherche("3453").includes(V.RESSOURCE_VOLS));
});
test("départ à l'heure : à déposer, terminal 3", () => {
  const vol = V.volDeLaCourse(course());
  egal([vol.sens, vol.heure], ["depart", "14:35"]);
  const e = V.etatDuVol(V.choisirVol([L({ CHAORD: "A" }), L({ CHSTOL: "2026-11-18T14:35:00" }), L()], vol), vol);
  egal([e.trouve, e.action, e.terminal, e.etat, e.alerte, e.ville], [true, "À déposer à l'aéroport", "3", "À l'heure", false, "PARIS"]);
});
test("arrivée retardée de 1 h 20 : à récupérer, nouvelle heure", () => {
  const vol = V.volDeLaCourse(course({ heure: "22:10" }, { direction: "depuis", numeroVol: "LY 316", heureVol: "22:10" }));
  const ligne = V.choisirVol([L({ CHOPER: "LY", CHFLTN: "316", CHAORD: "A", CHSTOL: "2026-11-17T22:10:00", CHPTOL: "2026-11-17T23:30:00", CHRMINE: "DELAYED", CHTERM: "3" })], vol);
  const e = V.etatDuVol(ligne, vol);
  egal([e.action, e.etat, e.ecartMinutes, e.prevu, e.nouvelle, e.alerte], ["À récupérer à l'aéroport", "Retard de 1 h 20", 80, "22:10", "23:30", true]);
  vrai(e.texte.includes("atterrissage 23:30 au lieu de 22:10"), e.texte);
});
test("annulé, en avance, autre compagnie, vol introuvable", () => {
  const vol = V.volDeLaCourse(course());
  egal(V.etatDuVol(L({ CHRMINE: "CANCELED" }), vol).etat, "Vol annulé");
  egal(V.etatDuVol(L({ CHPTOL: "2026-11-17T14:20:00" }), vol).etat, "En avance de 15 min");
  egal(V.choisirVol([L({ CHOPER: "LY" })], vol), null);
  egal(V.etatDuVol(null, vol).trouve, false);
  egal(V.volDeLaCourse({ service: "transport", date: "2026-11-17", details: { numeroVol: "LY1" } }), null);
  egal(V.volDeLaCourse(course({}, { numeroVol: "" })), null);
});
test("aller-retour : le jour du retour, on suit le vol du retour dans l'autre sens", () => {
  const d = course({ date: "2026-11-24", heure: "20:00", estRetour: true }, { typeTrajet: "ar", numeroVolRetour: "TO3452", heureVolRetour: "19:15" });
  const vol = V.volDeLaCourse(d);
  egal([vol.sens, vol.numero.numero, vol.heure, vol.date], ["arrivee", "3452", "19:15", "2026-11-24"]);
  egal(V.volDeLaCourse(course({ estRetour: true })), null); // pas de vol de retour saisi
  const v = { ...S.valeursInitiales("aeroport"), typeTrajet: "ar" };
  vrai(S.champsVisibles("aeroport", v).some((c) => c.name === "numeroVolRetour"));
  vrai(!S.champsVisibles("transport", { ...S.valeursInitiales("transport"), typeTrajet: "ar" }).some((c) => /VolRetour/.test(c.name)));
});
test("ville du vol : celle saisie, sinon celle du tableau", () => {
  const vol = V.volDeLaCourse(course());
  egal(V.villeDuVol(vol, V.etatDuVol(L(), vol)), "vers Paris");
  egal(V.villeDuVol(V.volDeLaCourse(course({}, { villeVol: "Lyon" })), V.etatDuVol(L(), vol)), "vers Lyon");
  egal(V.villeDuVol(vol, null), "");
  egal(V.nomVille("TEL AVIV-YAFO"), "Tel Aviv-Yafo");
  const retour = V.volDeLaCourse(course({ estRetour: true, date: "2026-11-26" }, { numeroVolRetour: "TO3452", villeVolRetour: "Paris" }));
  egal(V.villeDuVol(retour, null), "depuis Paris");
});
test("le tableau ne donne un vol qu'autour du jour même", () => {
  const vol = V.volDeLaCourse(course());
  egal([V.volConsultable(vol, "2026-11-16"), V.volConsultable(vol, "2026-11-17"), V.volConsultable(vol, "2026-11-18"), V.volConsultable(vol, "2026-11-10")], [true, true, true, false]);
});
