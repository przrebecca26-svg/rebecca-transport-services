import { test, egal, vrai, section } from "./outils.mjs";
import * as R from "../src/pricing/rendezvous.js";

// VERROUILLAGE DES CRENEAUX (11 nov. 2026)
section("Rendez-vous : verrouillage des creneaux");
test("cellules : 11h15, 1 h 30 + 20 min de marge = 8 quarts d'heure", () => egal(R.cellulesDe("11:15", 90, 20), ["1115", "1130", "1145", "1200", "1215", "1230", "1245", "1300"]));
test("cellules : sans marge, 1 h = 4 quarts d'heure", () => egal(R.cellulesDe("09:00", 60, 0), ["0900", "0915", "0930", "0945"]));
test("cellules : heure ou duree invalide = rien", () => egal([R.cellulesDe("", 60).length, R.cellulesDe("10:00", 0).length], [0, 0]));
test("cellules : jamais au-dela de minuit", () => egal(R.cellulesDe("23:30", 120, 20), ["2330", "2345"]));
test("identifiant de l'agenda du jour", () => egal(R.idAgenda("2026-11-12"), "rebecca__2026-11-12"));

const A = R.cellulesDe("11:15", 90, 20); // rendez-vous deja pris, 11h15 - 12h45 (+20)
const prises = Object.fromEntries(A.map((c) => [c, true]));
test("meme heure : refuse", () => egal(R.cellulesLibres(R.cellulesDe("11:15", 90, 20), prises), false));
test("chevauchement en fin : refuse", () => egal(R.cellulesLibres(R.cellulesDe("12:30", 60, 20), prises), false));
test("juste apres, sans respecter la marge (13h00) : refuse", () => egal(R.cellulesLibres(R.cellulesDe("13:00", 60, 20), prises), false));
test("apres la marge (13h15) : accepte", () => egal(R.cellulesLibres(R.cellulesDe("13:15", 60, 20), prises), true));
test("avant, en laissant la marge (9h15, 1 h 30) : accepte", () => egal(R.cellulesLibres(R.cellulesDe("09:15", 90, 20), prises), true));
test("avant, sans laisser la marge (9h30, 1 h 30) : refuse", () => egal(R.cellulesLibres(R.cellulesDe("09:30", 90, 20), prises), false));
test("aucune cellule = jamais libre", () => egal(R.cellulesLibres([], {}), false));

const D = (x) => ({ id: "d1", service: "nails", statut: "en attente", date: "2026-11-12", heure: "11:15", details: { duree: 90, cellules: A }, ...x });
test("agenda voulu : une demande en attente bloque ses cellules", () => egal(R.agendaVoulu([D()], { depuis: "2026-11-11" }), { "rebecca__2026-11-12": A }));
test("agenda voulu : acceptee et confirmee bloquent aussi", () => egal(Object.keys(R.agendaVoulu([D({ statut: "acceptee" }), D({ id: "d2", statut: "confirmee", date: "2026-11-13" })], {})).length, 2));
test("agenda voulu : refusee, annulee, terminee liberent", () => egal(["refusee", "annulee", "terminee"].map((s) => Object.keys(R.agendaVoulu([D({ statut: s })], {})).length), [0, 0, 0]));
test("agenda voulu : annulation par la cliente libere", () => egal(R.agendaVoulu([D()], { suivis: { d1: "annulée par le client" } }), {}));
test("agenda voulu : une course (livraison) ne touche pas l'agenda des rendez-vous", () => egal(R.agendaVoulu([D({ service: "livraison" })], {}), {}));
test("agenda voulu : les jours passes sont ignores", () => egal(R.agendaVoulu([D()], { depuis: "2026-11-13" }), {}));
test("agenda voulu : sans cellules enregistrees, calcul avec 20 min de marge", () => egal(R.agendaVoulu([D({ details: { duree: 60 } })], {})["rebecca__2026-11-12"], R.cellulesDe("11:15", 60, 20)));
test("agenda voulu : deux rendez-vous le meme jour, cellules reunies et triees", () => egal(R.agendaVoulu([D(), D({ id: "d2", heure: "09:00", details: { cellules: ["0900", "0915"] } })], {})["rebecca__2026-11-12"].slice(0, 3), ["0900", "0915", "1115"]));

test("ecarts : agenda deja juste = rien a faire", () => egal(R.ecartsAgenda({ "rebecca__2026-11-12": A }, [{ id: "rebecca__2026-11-12", cells: prises }]), []));
test("ecarts : demande refusee = jour a liberer", () => egal(R.ecartsAgenda({}, [{ id: "rebecca__2026-11-12", cells: prises }]), [{ id: "rebecca__2026-11-12", cellules: [] }]));
test("ecarts : cellules en trop = reecriture du jour", () => egal(R.ecartsAgenda({ "rebecca__2026-11-12": ["0900"] }, [{ id: "rebecca__2026-11-12", cells: { "0900": true, "1700": true } }]), [{ id: "rebecca__2026-11-12", cellules: ["0900"] }]));
test("ecarts : jour manquant = a ecrire", () => egal(R.ecartsAgenda({ "rebecca__2026-11-12": ["0900"] }, []), [{ id: "rebecca__2026-11-12", cellules: ["0900"] }]));
test("4 activites de rendez-vous", () => vrai(R.ACTIVITES_RENDEZVOUS.join() === "nails,hair,slim,regenx"));
