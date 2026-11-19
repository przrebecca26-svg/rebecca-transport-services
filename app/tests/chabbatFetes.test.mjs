// TROIS CALENDRIERS SEPARES (19 nov. 2026) : Chabbat, fetes (Yom Tov) et vacances scolaires.
// Regle de Rebecca : fermeture 2 h avant l'entree (allumage) et reouverture 1 h apres la sortie,
// pour Chabbat comme pour les fetes. Les vacances scolaires levent seulement la tournee d'ecole.
import { test, egal, vrai, section } from "./outils.mjs";
import * as Cal from "../src/pricing/calendrier.js";
import { TARIFS } from "../src/pricing/config.js";

section("Chabbat, fetes et vacances : 3 calendriers");
const ferme = (date) => Cal.periodesFermees(date, 2).find((p) => p.type === "chabbat_fete" && p.debut.date === date);
const minutes = (a, b) => Math.round((b - a) / 60000);

test("marges : 2 h avant, 1 h apres", () => egal([TARIFS.calendrier.margeAvantMinutes, TARIFS.calendrier.margeApresMinutes], [120, 60]));

const c20 = ferme("2026-11-20");
test("Chabbat 20 nov. 2026 : entree 16h19 (allumage, Netanya)", () => egal(c20.entree, { date: "2026-11-20", heure: "16:19" }));
test("Chabbat 20 nov. 2026 : sortie 17h19", () => egal(c20.sortie, { date: "2026-11-21", heure: "17:19" }));
test("Chabbat 20 nov. 2026 : ferme a 14h19, 2 h avant l'entree", () => egal(c20.debut, { date: "2026-11-20", heure: "14:19" }));
test("Chabbat 20 nov. 2026 : rouvre a 18h19, 1 h apres la sortie", () => egal(c20.fin, { date: "2026-11-21", heure: "18:19" }));
test("Chabbat seul : pas marque fete", () => egal(c20.fete, false));
test("vendredi 14h00 pour 15 min : possible", () => egal(Cal.verifierDisponibilite("2026-11-20", "14:00", 15), null));
test("vendredi 14h00 pour 30 min : bloque (finirait apres 14h19)", () => vrai(Cal.verifierDisponibilite("2026-11-20", "14:00", 30) !== null));
test("samedi 18h00 : encore ferme", () => vrai(Cal.verifierDisponibilite("2026-11-21", "18:00", 0) !== null));
test("samedi 18h30 : ouvert", () => egal(Cal.verifierDisponibilite("2026-11-21", "18:30", 0), null));

// Fete (Yom Tov) : meme regle 1 h / 1 h
const yk = ferme("2027-10-10");
test("Yom Kippour 2027 : periode de fete", () => vrai(yk && yk.fete && /Yom Kippour/.test(yk.label), JSON.stringify(yk)));
test("Yom Kippour 2027 : ferme 2 h avant l'entree", () => egal(minutes(Cal.localVersUtc(yk.debut.date, yk.debut.heure), Cal.localVersUtc(yk.entree.date, yk.entree.heure)), 120));
test("Yom Kippour 2027 : rouvre 1 h apres la sortie", () => egal(minutes(Cal.localVersUtc(yk.sortie.date, yk.sortie.heure), Cal.localVersUtc(yk.fin.date, yk.fin.heure)), 60));
const rh = ferme("2027-10-01");
test("Roch Hachana 2027 : une seule periode du vendredi au dimanche (fete + Chabbat)", () => egal([rh.debut.date, rh.fin.date, rh.fete], ["2027-10-01", "2027-10-03", true]));

// Etiquettes : chacune son calendrier
test("jour ordinaire : aucune etiquette", () => egal(Cal.etiquettesDuJour("2026-11-17"), { chabbat: false, fete: "", veille: "", vacances: "", provisoire: false }));
test("vendredi : veille de Chabbat", () => egal(Cal.etiquettesDuJour("2026-11-20").veille, "Chabbat"));
test("samedi : Chabbat", () => egal(Cal.etiquettesDuJour("2026-11-21").chabbat, true));
test("Hanoucca 7 dec. 2026 : vacances, pas une fete", () => egal(Cal.etiquettesDuJour("2026-12-07"), { chabbat: false, fete: "", veille: "", vacances: "Vacances de Hanoucca", provisoire: false }));
test("22 avril 2027 : fete ET vacances de Pessah", () => {
  const e = Cal.etiquettesDuJour("2027-04-22");
  egal([e.fete, e.vacances], ["Pessah (1er jour)", "Vacances de Pessah"]);
});
test("Hol Hamoed 25 avril 2027 : vacances, pas une fete (a decider)", () => egal(Cal.etiquettesDuJour("2027-04-25").fete, ""));
test("Yom Haatsmaout 2027 : vacances seulement (on peut travailler)", () => {
  const e = Cal.etiquettesDuJour("2027-05-12");
  egal([e.fete, e.vacances], ["", "Yom Haatsmaout"]);
});
test("Souccot 2027 : vacances provisoires", () => {
  const e = Cal.etiquettesDuJour("2027-10-16");
  egal([e.chabbat, e.fete, e.provisoire], [true, "Souccot", true]);
});
test("rentree 2027 : 1er septembre, jour d'ecole", () => egal(Cal.etiquettesDuJour("2027-09-01").vacances, ""));
