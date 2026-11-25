// TESTS : TRAJET PERSONNEL, PRO / PERSO, ALERTES DE DEPART (25 nov. 2026, 22h30) - exemple réel du jeudi 26 nov.
import { test, egal, vrai, section } from "./outils.mjs";
import * as TR from "../src/pricing/tournee.js";
import * as D from "../src/pricing/deplacementsJour.js";
import { rappelsAvant, evenementsDuJour } from "../src/pricing/planningNotif.js";

section("Trajet personnel et journée pro / perso");
const DATE = "2026-11-26";
const P = (label, lat, lon) => ({ label, lat, lon });
const MAISON = P("Maison, Netanya", 32.3215, 34.8532);
const DEBO = P("Chez Debo, Netanya", 32.33, 34.86);
const AGAMIM = P("Agamim, Netanya", 32.293, 34.866);
const BOGRA = P("Bograshov, Tel Aviv", 32.0784, 34.7686);
const HOTEL = P("Hôtel, Tayelet, Tel Aviv", 32.0815, 34.7675);
const jours = TR.ajouterTache({}, DATE, { type: "perso", pour: "Debo", titre: "", debut: "11:00", fin: "14:05", prise: DEBO, lieu: HOTEL, arrets: [{ nom: "Déjeuner", adresse: BOGRA, debut: "12:50", fin: "13:55" }] });
const tache = jours[DATE].taches[0];

test("tâche gardée : type perso, passagère, prise, arrêt, dépose", () => {
  egal([tache.type, tache.pour, tache.prise.label, tache.arrets.length, tache.arrets[0].nom, tache.lieu.label, TR.iconeTache(tache)], ["perso", "Debo", "Chez Debo, Netanya", 1, "Déjeuner", "Hôtel, Tayelet, Tel Aviv", "🚗"]);
});
test("étapes dans l'ordre : prendre Debo, déjeuner, déposer Debo ; une clé par étape", () => {
  const e = TR.etapesPerso(tache);
  egal(e.map((x) => [x.heure, x.texte]), [["11h00", "Prendre Debo"], ["12h50", "Déjeuner"], ["14h05", "Déposer Debo"]]);
  const cles = e.map((x) => TR.cleEtape({ ...x, genre: "tache", tache }));
  egal(new Set(cles).size, 3);
});
test("Debo avec moi pendant la course de 11h30, plus pendant celle de 15h", () => {
  egal(TR.avecMoiPerso([tache], 11 * 60 + 30), ["Debo"]);
  egal(TR.avecMoiPerso([tache], 15 * 60), []);
});

const etapes = [
  ...TR.etapesPerso(tache).map((e) => ({ ...e, genre: "tache" })),
  { min: 11 * 60 + 30, genre: "arret", adresse: AGAMIM, texte: "Récupérer (cliente)", demandeId: "c1", sorte: "prise" },
  { min: 12 * 60 + 20, genre: "arret", adresse: TR.AEROPORT_BEN_GOURION, texte: "Déposer (cliente)", demandeId: "c1", sorte: "depose" },
  { min: 15 * 60, genre: "arret", adresse: TR.AEROPORT_BEN_GOURION, texte: "Récupérer (Debo Sultan)", demandeId: "c2", sorte: "prise" },
  { min: 15 * 60 + 55, genre: "arret", adresse: MAISON, texte: "Déposer (Debo Sultan)", demandeId: "c2", sorte: "depose" },
];
test("trajets comptés une seule fois : aéroport → Tel-Aviv perso, Tel-Aviv → aéroport et clientes pro", () => {
  const t = D.trajetsProPerso(etapes, MAISON);
  const de = (a, b) => t.find((x) => x.de.startsWith(a) && x.vers.startsWith(b));
  egal([de("Agamim", "Ben Gurion").pro, de("Ben Gurion", "Bograshov").pro, de("Bograshov", "Hôtel").pro, de("Hôtel", "Ben Gurion").pro], [true, false, false, true]);
  egal(de("Maison", "Chez Debo").pro, false);
});
test("bilan : km pro et perso séparés, gain par heure, CA du jour 565 ₪", () => {
  const b = D.bilanJournee(etapes, MAISON, { ca: 565 });
  vrai(b.kmPro > 60 && b.kmPerso > 15 && b.kmPerso < 40, JSON.stringify([b.kmPro, b.kmPerso]));
  egal(b.kmTotal, Math.round(b.trajets.reduce((s, x) => s + x.km, 0)));
  vrai(b.gainParHeure > 100, String(b.gainParHeure));
});
test("pro avant perso : déposer Debo à 14h05 met en retard pour une cliente à 14h20 -> alerte", () => {
  const avec1420 = etapes.map((e) => (e.demandeId === "c2" && e.sorte === "prise" ? { ...e, min: 14 * 60 + 20 } : e));
  const a = D.alertesPerso(avec1420, DATE);
  vrai(a.some((x) => x.texte.includes("Déposer Debo") && x.texte.includes("pars au plus tard")));
  egal(D.alertesPerso(etapes, DATE).length, 0);
});
test("temps de route estimé : Agamim → aéroport entre 35 et 60 min", () => {
  const m = D.minutesRoute(AGAMIM, TR.AEROPORT_BEN_GOURION);
  vrai(m >= 35 && m <= 60, String(m));
});

section("Notifications : alerte de départ selon la route");
const donnees = {
  demandes: [{ id: "c1", statut: "acceptee", service: "aeroport", serviceTitre: "Aéroport", nom: "Cliente", date: DATE, heure: "11:30", details: { direction: "vers", adresse: AGAMIM } }],
  tourneeJson: JSON.stringify({ trajets: [], domicile: MAISON }),
  joursJson: JSON.stringify(jours),
  repertoireJson: "",
};
const msIsrael = (h, m) => Date.parse(`${DATE}T${String(h - 2).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
test("les étapes du trajet perso ont leur notification", () => {
  const l = evenementsDuJour(DATE, donnees).map((e) => e.texte);
  vrai(l.includes("🚗 Prendre Debo") && l.includes("🚗 Déjeuner") && l.includes("🚗 Déposer Debo"));
});
test("après le déjeuner à Tel-Aviv, « Pars maintenant » arrive avant le classique 15 min", () => {
  const dem = [...donnees.demandes, { id: "c2", statut: "acceptee", service: "aeroport", serviceTitre: "Aéroport", nom: "Debo Sultan", date: DATE, heure: "15:00", details: { direction: "depuis", adresse: MAISON } }];
  const toutes = [];
  for (let m = 13 * 60; m < 15 * 60; m += 2) toutes.push(...rappelsAvant(msIsrael(Math.floor(m / 60), m % 60), { ...donnees, demandes: dem }));
  const r = toutes.find((x) => x.tag.endsWith("d-c2"));
  vrai(r && r.titre.startsWith("🚗 Pars maintenant"), JSON.stringify(toutes.map((x) => x.titre + x.tag)));
});
