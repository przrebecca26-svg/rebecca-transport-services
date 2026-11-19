// TESTS ASSISTANCE CLIENTS (19 nov. 2026, étape 1 sans IA)
import { test, egal, section } from "./outils.mjs";
import {
  SUJETS, CATEGORIES, sujetsDe, urgenceDe, fermetureEnCours, conversationPropre, erreursAssistance, formulaireAssistance,
  bandeauFermeture, MESSAGES_FERMETURE, lireLienAssistance, ajouterConversationLocale, messageNotifAssistance, aTraiterAssistance,
} from "../src/pricing/assistance.js";
import { localVersUtc } from "../src/pricing/calendrier.js";

section("Assistance clients");
test("17 sujets, 4 catégories, restaurant seulement pour les partenaires", () => {
  egal([SUJETS.length, CATEGORIES.length], [17, 4]);
  egal(sujetsDe("specialises", false).some((s) => s.id === "restaurant"), false);
  egal(sujetsDe("specialises", true).some((s) => s.id === "restaurant"), true);
});
const maintenant = localVersUtc("2026-11-23", "10:00");
test("urgence : course dans moins d'1 h, objet important, ramassage du jour", () => {
  egal(urgenceDe("suivi", { demande: { date: "2026-11-23", heure: "10:40" }, maintenantMs: maintenant }), "haute");
  egal(urgenceDe("suivi", { demande: { date: "2026-11-23", heure: "15:00" }, maintenantMs: maintenant }), "normale");
  egal(urgenceDe("objet", { message: "mes clés", maintenantMs: maintenant }), "haute");
  egal(urgenceDe("objet", { message: "un parapluie", maintenantMs: maintenant }), "normale");
  egal(urgenceDe("ramassage", { message: "Joy est absente aujourd'hui", maintenantMs: maintenant }), "haute");
  egal(urgenceDe("prix", { urgentCoche: true, maintenantMs: maintenant }), "haute");
  egal(urgenceDe("prix", { urgentCoche: true, ferme: true, maintenantMs: maintenant }), "normale");
});
test("fermeture : Chabbat 21 nov. 2026 à 10h fermé, lundi 23 ouvert", () => {
  egal(!!fermetureEnCours(localVersUtc("2026-11-21", "10:00")), true);
  egal(fermetureEnCours(maintenant), null);
});
test("formulaire et conversation propre (règles v31)", () => {
  const f = { ...formulaireAssistance({ prenom: "Deborah", nom: "Toledano", telephone: "0541234567", email: "D@X.com" }), message: "Bonjour" };
  egal(erreursAssistance(f), []);
  egal(erreursAssistance(formulaireAssistance(null)).length, 3);
  const c = conversationPropre("objet", { ...f, demandeId: "abc123def" }, { uid: "u1", urgence: "haute", ferme: false, resume: "Transport" });
  egal([c.sujet, c.urgence, c.email, c.demandeId, c.statut, c.dernierDe, c.aLire, c.uid], ["objet", "haute", "d@x.com", "abc123def", "nouvelle", "client", true, "u1"]);
  egal(Object.keys(conversationPropre("zzz", f)).includes("uid"), false);
  egal(conversationPropre("zzz", f).sujet, "autre");
});
test("messages de fermeture et de réouverture", () => {
  egal(bandeauFermeture({ statut: "nouvelle", ferme: false }, [], true), MESSAGES_FERMETURE.general);
  egal(bandeauFermeture({ statut: "nouvelle", ferme: true }, [{ de: "client" }], false), MESSAGES_FERMETURE.reouverture);
  egal(bandeauFermeture({ statut: "nouvelle", ferme: true }, [{ de: "rebecca" }], false), "");
});
test("liens, conversations locales, notification, pastille", () => {
  egal(lireLienAssistance("#/assistance"), { vue: "accueil" });
  egal(lireLienAssistance("#/assistance/resto/abcdefghijklmnopqrstuvwx"), { vue: "accueil", resto: "abcdefghijklmnopqrstuvwx" });
  egal(lireLienAssistance("#/assistance/AbCdEfGhIjKlMnOpQrSt"), { vue: "conversation", id: "AbCdEfGhIjKlMnOpQrSt" });
  egal(lireLienAssistance("#/autre"), null);
  egal(ajouterConversationLocale([{ id: "a" }, { id: "b" }], "a", "T").map((x) => x.id), ["a", "b"]);
  egal(messageNotifAssistance({ nom: "Dina", urgence: "haute", titre: "Objet", id: "x" }).titre.startsWith("🔴"), true);
  egal([aTraiterAssistance({ statut: "nouvelle", aLire: true }), aTraiterAssistance({ statut: "resolue", aLire: true })], [true, false]);
});
