import { test, egal } from "./outils.mjs";
import { validerAttente, messagePlaceLibre, attentesActives } from "../src/pricing/listeAttente.js";
import { lireLienPosition, positionPropre, aEnvoyer, carteOsm } from "../src/pricing/positionDirect.js";

test("liste d'attente : validation", () => {
  egal(validerAttente({ service: "nails", date: "2026-11-20", prenom: "Léa", telephone: "054-123-4567" }).fiche.telephone, "0541234567");
  egal(!!validerAttente({ service: "transport", date: "2026-11-20", prenom: "Léa", telephone: "0541234567" }).erreur, true);
  egal(!!validerAttente({ service: "nails", date: "", prenom: "Léa", telephone: "0541234567" }).erreur, true);
  egal(validerAttente({ service: "hair", date: "2026-11-20", prenom: "Léa", telephone: "0541234567", plage: "x" }).fiche.plage, "journee");
});
test("liste d'attente : message et tri", () => {
  egal(messagePlaceLibre({ prenom: "Léa", service: "nails", date: "2026-11-20", plage: "matin" }).includes("Léa"), true);
  egal(attentesActives([{ date: "2026-11-25" }, { date: "2026-11-18" }, { date: "2026-11-21" }], "2026-11-19").map((a) => a.date).join(","), "2026-11-21,2026-11-25");
});
test("position en direct", () => {
  egal(lireLienPosition("#/position/AbC123xyz"), "AbC123xyz");
  egal(lireLienPosition("#/position/x"), "");
  egal(positionPropre({ lat: 32.1234567, lon: 34.8 }).lat, 32.123457);
  egal(positionPropre({ lat: 200, lon: 0 }), null);
  egal(aEnvoyer(null, { lat: 32, lon: 34 }, 0), true);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32.0001, lon: 34 }, 5000), false);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32.001, lon: 34 }, 5000), true);
  egal(aEnvoyer({ lat: 32, lon: 34 }, { lat: 32, lon: 34 }, 25000), true);
  egal(carteOsm({ lat: 32, lon: 34 }).includes("marker=32,34"), true);
});
