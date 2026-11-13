// MON MOIS (13 nov. 2026, 09h15) - regles pures
// Rebecca : « savoir combien je fais par mois entre le ramassage scolaire, Wolt, les courses ; en meme temps mes
// depenses de voiture et d'essence ; et le benefice reel. Savoir clairement ce que je gagne par mois. »
// Gagne = argent vraiment encaisse ce mois-la (au jour du paiement), par activite, + Wolt.
// Depenses = essence de travail (Rebecca Services + Wolt, vue Essence) + depenses notees (peages, entretien...).
// L'essence perso est affichee pour info, jamais retiree du benefice.

import { SERVICES } from "../services.js";
import { avecCarburant, essenceDuMois, estCarburant } from "./essence.js";

const cents = (x) => Math.round(x * 100) / 100;
const nb = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const ACT = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));
export const GROUPES = [
  { id: "ramassage", l: "Ramassage scolaire" },
  { id: "coursier", l: "Courses et livraisons" },
  { id: "transport", l: "Transport privé" },
  { id: "beaute", l: "Beauté" },
  { id: "autre", l: "Epoxy, Digital et autres" },
];
export function groupeDe(service) {
  if (service === "ramassage") return "ramassage";
  const a = ACT[service] || service;
  if (a === "coursier" || a === "transport") return a;
  if (["nails", "hair", "slim", "regenx", "beaute"].includes(a)) return "beaute";
  return "autre";
}

export function monMois(mois, { demandes = [], mouvements = [], depenses = [], autresRevenus = [], essence = null, reel = null }) {
  const parId = new Map(demandes.map((d) => [d.id, d]));
  const gagne = Object.fromEntries(GROUPES.map((g) => [g.id, 0]));
  const idsParGroupe = Object.fromEntries(GROUPES.map((g) => [g.id, new Set()]));
  let troc = 0;
  for (const m of mouvements) {
    const d = parId.get(m.resId);
    if (!d || String(m.date || "").slice(0, 7) !== mois) continue;
    const v = m.kind === "paiement" || m.kind === "correction" ? nb(m.montant) : m.kind === "remboursement_effectue" ? -nb(m.montant) : 0;
    if (!v) continue;
    if (m.kind === "correction" && /^Déduit/.test(String(m.motif || ""))) troc += v;
    else {
      gagne[groupeDe(d.service)] += v;
      idsParGroupe[groupeDe(d.service)].add(d.id);
    }
  }
  const wolt = autresRevenus.filter((r) => !r.operateur && String(r.debut || "").slice(0, 7) === mois).reduce((s, r) => s + nb(r.revenu), 0);
  const idsReste = [];
  const reste = demandes.filter((d) => d.statut === "terminee" && String(d.date).slice(0, 7) === mois).reduce((s, d) => {
    const recu = mouvements.filter((m) => m.resId === d.id && (m.kind === "paiement" || m.kind === "correction")).reduce((t, m) => t + nb(m.montant), 0);
    if (nb(d.prixFinal) - recu > 0) idsReste.push(d.id);
    return s + Math.max(0, nb(d.prixFinal) - recu);
  }, 0);
  const dep = depenses.filter((x) => !x.operateur && String(x.date || "").slice(0, 7) === mois && !estCarburant(x));
  const parCat = {};
  for (const x of dep) parCat[x.categorie || "Autres frais"] = cents((parCat[x.categorie || "Autres frais"] || 0) + nb(x.montant));
  const totalDep = dep.reduce((s, x) => s + nb(x.montant), 0);
  const ess = essence ? essenceDuMois(mois, avecCarburant(essence, depenses), demandes, autresRevenus.filter((r) => !r.operateur), undefined, reel) : null;
  const essenceTravail = ess ? ess.essenceRS + ess.essenceWolt : 0;
  const totalGagne = Object.values(gagne).reduce((s, v) => s + v, 0) + wolt;
  for (const k of Object.keys(gagne)) gagne[k] = cents(gagne[k]);
  return {
    mois,
    gagne,
    wolt: cents(wolt),
    totalGagne: cents(totalGagne),
    troc: cents(troc),
    resteAEncaisser: cents(reste),
    depenses: parCat,
    totalDepenses: cents(totalDep),
    essence: ess,
    essenceTravail: cents(essenceTravail),
    beneficeReel: cents(totalGagne - totalDep - essenceTravail),
    // pour le detail (13 nov. 2026, 09h43) : quelles courses, quelles lignes
    idsParGroupe: Object.fromEntries(Object.entries(idsParGroupe).map(([k, v]) => [k, [...v]])),
    idsReste,
    lignesDepenses: dep,
    lignesWolt: autresRevenus.filter((r) => !r.operateur && String(r.debut || "").slice(0, 7) === mois),
  };
}
