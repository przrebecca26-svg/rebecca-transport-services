// TESTS « DURÉE DU TRAJET SELON L'HEURE » (17 nov. 2026) - Rebecca Services
import { test, egal, vrai, section } from "./outils.mjs";
import * as C from "../src/pricing/circulation.js";
import { TARIFS } from "../src/pricing/config.js";
import { TARIFS_EDITABLES } from "../src/pricing/catalogue.js";

section("Circulation : durée du trajet aux heures de pointe");
// 2026-11-17 = mardi, 2026-11-20 = vendredi, 2026-11-21 = samedi
test("pointe du matin et du soir en semaine, vendredi, Chabbat, nuit", () => {
  egal(C.dureeSelonHeure(40, "2026-11-17", "08:00"), { minutes: 60, normales: 40, pct: 0.5, plage: "heure de pointe du matin" });
  egal(C.dureeSelonHeure(40, "2026-11-17", "17:00").minutes, 56);
  egal(C.dureeSelonHeure(40, "2026-11-17", "09:30").pct, 0);
  egal(C.dureeSelonHeure(40, "2026-11-17", "11:00").minutes, 40);
  egal(C.dureeSelonHeure(40, "2026-11-20", "12:00").minutes, 48);
  egal(C.dureeSelonHeure(40, "2026-11-20", "08:00").minutes, 40);
  egal(C.dureeSelonHeure(40, "2026-11-21", "08:00").minutes, 40);
  egal(C.dureeSelonHeure(0, "2026-11-17", "08:00"), null);
  egal(C.dureeSelonHeure(40, "", "08:00").minutes, 40);
});
test("textes", () => {
  egal(C.texteDuree(40, "2026-11-17", "08:00"), "environ 1 h 00 (heure de pointe du matin, +50 %)");
  egal(C.texteDuree(25, "2026-11-17", "11:00"), "environ 25 min");
  egal(C.dureeTexte(65), "1 h 05");
});
test("réglages : modifiables dans Tarifs, et pris en compte", () => {
  vrai(TARIFS_EDITABLES.filter((c) => c.chemin.startsWith("circulation.")).length === 9);
  const t = { circulation: { ...TARIFS.circulation, matin: 1 } };
  egal(C.dureeSelonHeure(30, "2026-11-17", "08:00", t).minutes, 60);
});
