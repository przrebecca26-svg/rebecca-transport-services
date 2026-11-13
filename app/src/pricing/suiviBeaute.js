// SUIVI BEAUTE DE LA CLIENTE (13 nov. 2026, 09h49) - regles pures
// Rebecca : « dans la fiche de la cliente, un onglet Suivi par activite beaute : la seance, la date, si elle a paye
// ou pas, ce que je lui ai fait, si elle a achete des produits, le prochain rendez-vous, un commentaire. Pareil pour
// RegenX, les ongles, une cure Slim... » Cure : acompte de 20 % a la reservation, le reste en 4 fois maximum,
// chaque versement note (date, montant, moyen : especes, cheque...).
// Document PRIVE admin/suivi__<fiche> (Rebecca seule ; jamais Jeremy).
export const ACTIVITES_SUIVI = [
  { v: "nails", l: "Nails" },
  { v: "hair", l: "Hair" },
  { v: "slim", l: "Slim & Lift" },
  { v: "regenx", l: "RegenX" },
];
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;
const montant = (x) => {
  const n = cents(Number(String(x == null ? "" : x).replace(",", ".")));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : 0;
};
const txt = (x, n) => String(x || "").trim().slice(0, n);
const act = (v) => (ACTIVITES_SUIVI.some((a) => a.v === v) ? v : "nails");
let compteur = 0;
export const nouvelIdSuivi = () => `s${Date.now().toString(36)}${(compteur++).toString(36)}`;
export const idDocSuivi = (cle) => "suivi__" + String(cle || "").replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120);

export function lireSuivi(json) {
  let o;
  try {
    o = typeof json === "string" ? JSON.parse(json || "{}") : json;
  } catch {
    o = {};
  }
  if (!o || typeof o !== "object") o = {};
  const seances = (Array.isArray(o.seances) ? o.seances : [])
    .filter((x) => x && DATE_OK.test(x.date || ""))
    .slice(0, 500)
    .map((x) => ({ id: txt(x.id, 40) || nouvelIdSuivi(), activite: act(x.activite), date: x.date, prestation: txt(x.prestation, 120), prix: montant(x.prix), paye: montant(x.paye), moyen: txt(x.moyen, 30), produits: txt(x.produits, 200), prixProduits: montant(x.prixProduits), prochainRdv: DATE_OK.test(x.prochainRdv || "") ? x.prochainRdv : "", commentaire: txt(x.commentaire, 1000), cure: txt(x.cure, 40) }));
  const cures = (Array.isArray(o.cures) ? o.cures : [])
    .filter((x) => x && txt(x.nom, 120))
    .slice(0, 50)
    .map((x) => ({
      id: txt(x.id, 40) || nouvelIdSuivi(),
      activite: act(x.activite),
      nom: txt(x.nom, 120),
      prix: montant(x.prix),
      seances: Math.max(1, Math.min(50, Math.round(Number(x.seances) || 1))),
      debut: DATE_OK.test(x.debut || "") ? x.debut : "",
      versements: (Array.isArray(x.versements) ? x.versements : []).filter((v) => v && DATE_OK.test(v.date || "") && montant(v.montant) > 0).slice(0, 12).map((v) => ({ date: v.date, montant: montant(v.montant), moyen: txt(v.moyen, 30), note: txt(v.note, 100) })),
    }));
  return { seances, cures };
}

export const ajouterSeance = (s, x) => ({ ...s, seances: [...s.seances, ...lireSuivi({ seances: [{ ...x, id: nouvelIdSuivi() }] }).seances] });
export const modifierSeance = (s, id, x) => ({ ...s, seances: s.seances.map((y) => (y.id === id ? lireSuivi({ seances: [{ ...y, ...x, id }] }).seances[0] || y : y)) });
export const retirerSeance = (s, id) => ({ ...s, seances: s.seances.filter((y) => y.id !== id) });
export const ajouterCure = (s, x) => ({ ...s, cures: [...s.cures, ...lireSuivi({ cures: [{ ...x, id: nouvelIdSuivi() }] }).cures] });
export const retirerCure = (s, id) => ({ ...s, cures: s.cures.filter((c) => c.id !== id), seances: s.seances.map((y) => (y.cure === id ? { ...y, cure: "" } : y)) });
export const MAX_VERSEMENTS = 4;
export function ajouterVersement(s, cureId, v) {
  return { ...s, cures: s.cures.map((c) => (c.id === cureId && c.versements.length < MAX_VERSEMENTS + 1 ? lireSuivi({ cures: [{ ...c, versements: [...c.versements, v] }] }).cures[0] : c)) };
}

// Etat d'une cure : seances faites, paye, reste
export function etatCure(s, c) {
  const faites = s.seances.filter((x) => x.cure === c.id).length;
  const paye = cents(c.versements.reduce((t, v) => t + v.montant, 0));
  return { faites, restantes: Math.max(0, c.seances - faites), paye, reste: cents(Math.max(0, c.prix - paye)), versementsRestants: Math.max(0, MAX_VERSEMENTS + 1 - c.versements.length) };
}

// Resume d'une activite : seances, total, impaye, prochain rendez-vous
export function resumeActivite(s, activite, aujourdhui) {
  const l = s.seances.filter((x) => !activite || x.activite === activite);
  const impaye = cents(l.reduce((t, x) => t + Math.max(0, x.prix + x.prixProduits - x.paye), 0));
  const prochains = l.map((x) => x.prochainRdv).filter((d) => d && d >= aujourdhui).sort();
  return { nb: l.length, impaye, prochain: prochains[0] || "" };
}
