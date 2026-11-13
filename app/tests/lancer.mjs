// LANCE TOUS LES TESTS - Rebecca Services
// Depuis le dossier app : node tests/lancer.mjs
import { bilan } from "./outils.mjs";
await import("./metier.test.mjs");
await import("./reference.test.mjs");
await import("./equipe.test.mjs");
await import("./tableauBord.test.mjs");
await import("./devisRapide.test.mjs");
await import("./espaceEquipe.test.mjs");
await import("./quiFait.test.mjs");
await import("./transferts.test.mjs");
await import("./reverser.test.mjs");
await import("./catalogue.test.mjs");
await import("./rendezvous.test.mjs");
await import("./statistiques.test.mjs");
await import("./verrouCreneaux.test.mjs");
await import("./ramassagePlanning.test.mjs");
await import("./tournee.test.mjs");
await import("./repertoire.test.mjs");
await import("./familles.test.mjs");
await import("./forfaitJour.test.mjs");
await import("./comptesEntreNous.test.mjs");
await import("./essence.test.mjs");
await import("./fichesRepertoire.test.mjs");
const r = bilan();
console.log(`Tests reussis : ${r.ok} / ${r.ok + r.echecs.length}`);
r.echecs.forEach((e) => console.log("ECHEC  " + e));
process.exit(r.echecs.length ? 1 : 0);
