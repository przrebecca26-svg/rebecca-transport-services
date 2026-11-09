// LANCE TOUS LES TESTS - Rebecca Services
// Depuis le dossier app : node tests/lancer.mjs
import { bilan } from "./outils.mjs";
await import("./metier.test.mjs");
await import("./reference.test.mjs");
await import("./equipe.test.mjs");
await import("./tableauBord.test.mjs");
await import("./devisRapide.test.mjs");
const r = bilan();
console.log(`Tests reussis : ${r.ok} / ${r.ok + r.echecs.length}`);
r.echecs.forEach((e) => console.log("ECHEC  " + e));
process.exit(r.echecs.length ? 1 : 0);
