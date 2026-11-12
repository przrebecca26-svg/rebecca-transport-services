// TESTS AGENDA COMMUN ET CRENEAUX DE RENDEZ-VOUS (Lot C, C3) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/rendezvous.js";
import { activitesEffectives } from "../src/pricing/catalogue.js";
import { TARIFS } from "../src/pricing/config.js";

const NAILS = activitesEffectives([]).find((a) => a.id === "nails");
const MARDI = "2026-11-10";
const libres = (r) => r.filter((c) => c.libre).map((c) => c.heure);

section("Rendez-vous : creneaux du jour");
const base = R.creneauxDuJour({ activite: NAILS, dureeMinutes: 90, date: MARDI, pas: 30 });
test("9h-18h par pas de 30 min (18 propositions)", () => egal([base.length, base[0].heure, base[base.length - 1].heure], [18, "09:00", "17:30"]));
test("creneau ecole 13h15-14h45 grise (VSP 1h30)", () => egal(base.filter((c) => !c.libre).map((c) => c.heure), ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"]));
test("un rendez-vous peut finir apres 18h (17h30 libre)", () => vrai(libres(base).includes("17:30")));
test("vendredi et samedi : ferme", () => egal([R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: "2026-11-13" }).length, R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: "2026-11-14" }).length], [0, 0]));
const occ = [{ debut: MARDI + "T10:00", fin: MARDI + "T11:00" }];
const avecCourse = R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: MARDI, pas: 30, occupes: occ });
test("course 10h-11h + 20 min entre deux : 9h, 9h30, 10h, 10h30, 11h grises", () => egal(avecCourse.filter((c) => !c.libre && c.heure < "12:00").map((c) => c.heure), ["09:00", "09:30", "10:00", "10:30", "11:00"]));
test("temps entre clientes modifiable (0 min : 9h et 11h libres)", () => {
  const r = R.creneauxDuJour({ activite: { ...NAILS, margeMinutes: 0 }, dureeMinutes: 60, date: MARDI, pas: 30, occupes: occ });
  vrai(libres(r).includes("09:00") && libres(r).includes("11:00"), JSON.stringify(libres(r)));
});
test("heures passees grisees", () => egal(R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: MARDI, pas: 60, maintenantMs: Date.parse("2026-11-10T09:30:00Z") }).filter((c) => c.libre)[0].heure, "12:00"));
test("bloc mal forme ignore", () => egal(libres(R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: MARDI, pas: 60, occupes: [{ debut: "x", fin: "y" }] })).length, libres(R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: MARDI, pas: 60 })).length));
test("prochains creneaux sur plusieurs jours", () => egal(R.prochainsCreneaux({ activite: NAILS, dureeMinutes: 60, jours: ["2026-11-13", MARDI], nombre: 2, pas: 60 }), [{ date: MARDI, heure: "09:00" }, { date: MARDI, heure: "10:00" }]));
test("Jeremy libre ne rouvre pas le creneau ecole pour la beaute", () => {
  const avant = TARIFS.calendrier.equipe;
  TARIFS.calendrier.equipe = [{ id: "j", services: ["livraison"], indispos: [] }];
  const r = R.creneauxDuJour({ activite: NAILS, dureeMinutes: 60, date: MARDI, pas: 60 });
  TARIFS.calendrier.equipe = avant;
  vrai(!r.find((c) => c.heure === "14:00").libre);
});

section("Rendez-vous : liste publique des occupations");
const D = [
  { id: "a", service: "livraison", date: MARDI, heure: "10:00", statut: "acceptee", minutesEstimees: 20 },
  { id: "b", service: "livraison", date: MARDI, heure: "12:00", statut: "acceptee", attribueA: "uid-j" },
  { id: "c", service: "livraison", date: MARDI, heure: "15:00", statut: "en attente" },
  { id: "d", service: "livraison", date: "2026-11-01", heure: "15:00", statut: "acceptee" },
];
const blocs = R.blocsDesCourses(D, { depuis: "2026-11-09" });
test("seulement les courses acceptees de Rebecca, a partir d'aujourd'hui", () => egal(blocs.map((b) => b.id.split("-")[0]), ["a"]));
test("aucun nom ni service dans un bloc public", () => egal(Object.keys(blocs[0]).sort(), ["debut", "fin", "id", "personne"]));
test("bloc commence a l'heure de la course", () => egal(blocs[0].debut, MARDI + "T10:00"));
test("synchronisation : ecrire le nouveau, supprimer l'ancien, garder les rendez-vous", () => {
  const s = R.synchroniser(blocs, [{ id: "vieux", debut: "x", fin: "y", personne: "rebecca", source: "course" }, { id: "rdv1", source: "rendezvous" }, { ...blocs[0] }]);
  egal([s.aEcrire.length, s.aSupprimer], [0, ["vieux"]]);
});

section("Calendrier : vacances scolaires");
{
  const C = await import("../src/pricing/calendrier.js");
  const { TARIFS: TT } = await import("../src/pricing/config.js");
  test("vacances du calendrier lisibles par date", () => {
    egal(C.vacancesDuJour("2026-12-08", TT), "Vacances de Hanoucca");
    egal(C.vacancesDuJour("2026-12-15", TT), "");
  });
  test("pendant les vacances, les creneaux fixes (tournee) sont leves ; Chabbat reste ferme", () => {
    const t = JSON.parse(JSON.stringify(TT));
    t.calendrier.creneauxPersonnels = [{ jours: [0, 1, 2, 3, 4, 5], debut: "07:45", fin: "08:45", motif: "x" }];
    const types = (d) => C.periodesFermees(d, 0, t).filter((p) => p.debut.date === d).map((p) => p.type);
    vrai(types("2026-12-09").every((x) => x !== "personnel"), "Hanoucca : tournee levee");
    vrai(types("2026-12-16").includes("personnel"), "jour d'ecole : tournee bloquee");
    t.calendrier.vacancesAjoutees = [{ debut: "2026-12-16", fin: "2026-12-16", motif: "Grève" }];
    vrai(types("2026-12-16").every((x) => x !== "personnel"), "jour ajoute par Rebecca : leve aussi");
  });
}

section("Calendrier : trajets confies a Jeremy (creneaux par date)");
{
  const C = await import("../src/pricing/calendrier.js");
  const { TARIFS: TT } = await import("../src/pricing/config.js");
  test("ce jour-la, mes creneaux par date remplacent ceux de la semaine", () => {
    const t = JSON.parse(JSON.stringify(TT));
    t.calendrier.creneauxPersonnels = [{ jours: [0, 1, 2, 3, 4, 5], debut: "07:45", fin: "08:45", motif: "x" }, { jours: [0, 1, 2, 3, 4], debut: "13:50", fin: "14:35", motif: "x" }];
    t.calendrier.creneauxDates = { "2026-11-16": [{ debut: "07:45", fin: "08:45" }] };
    const perso = (d) => C.periodesFermees(d, 0, t).filter((p) => p.type === "personnel" && p.debut.date === d).map((p) => p.debut.heure);
    egal(perso("2026-11-16"), ["07:45"]);
    egal(perso("2026-11-17"), ["07:45", "13:50"]);
    t.calendrier.creneauxDates = { "2026-11-16": [] };
    egal(perso("2026-11-16"), []);
  });
}
