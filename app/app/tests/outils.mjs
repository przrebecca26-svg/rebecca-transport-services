// OUTILS DE TEST - Rebecca Services
// Petit lanceur de tests sans aucune installation (Node seul).
// Lancer tous les tests depuis le dossier app : node tests/lancer.mjs

import { createHash } from "node:crypto";

const resultats = { ok: 0, echecs: [] };
let groupe = "";

export function section(nom) {
  groupe = nom;
}

export function test(nom, fn) {
  try {
    fn();
    resultats.ok++;
  } catch (e) {
    resultats.echecs.push((groupe ? groupe + " > " : "") + nom + " : " + (e && e.message ? e.message : e));
  }
}

const texte = (x) => JSON.stringify(x);

export function egal(obtenu, attendu, message = "") {
  if (texte(obtenu) !== texte(attendu)) throw new Error((message ? message + " - " : "") + "obtenu " + texte(obtenu) + ", attendu " + texte(attendu));
}

export function vrai(condition, message = "condition fausse") {
  if (!condition) throw new Error(message);
}

// JSON stable (cles triees) pour comparer des resultats complets
export function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined && typeof v[k] !== "function").map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  if (typeof v === "number" && !Number.isFinite(v)) return JSON.stringify(String(v));
  return JSON.stringify(v === undefined ? null : v);
}

export const empreinte = (v) => createHash("sha256").update(stable(v)).digest("hex").slice(0, 16);

export const bilan = () => resultats;
