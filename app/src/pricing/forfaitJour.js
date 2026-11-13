import { TARIFS } from "./config.js";

// FORFAIT A LA JOURNEE D'UNE FAMILLE (13 nov. 2026, 08h11)
// Rebecca : « Alexia a un prix particulier : un forfait a la journee, 70 ₪. Au depart je recuperais seulement les
// filles a 14h ; j'ai rajoute le matin sans augmenter le prix. Des fois elle me paye le jour meme, des fois apres. »
// -> Dans la fiche de la famille (Repertoire) : « Forfait a la journee (₪) ».
// -> Quand Rebecca coche « ✓ Fait » sur un trajet de cette famille, UNE course « Ramassage scolaire » est enregistree
//    pour cette date (terminee, prix = forfait) : elle compte dans Finances et dans « reste a payer » de la cliente,
//    une seule fois par jour meme s'il y a plusieurs trajets (matin + 14h).
// -> Le paiement s'enregistre a part (le jour meme ou plus tard), comme pour toutes les courses.
// -> Si elle decoche tous les trajets de la famille ce jour-la, la journee est retiree (sauf si un paiement y est deja lie).

export function lireForfait(v) {
  const t = String(v == null ? "" : v).trim();
  if (t.startsWith("-")) return 0;
  const n = Math.round(Number(t.replace(",", ".").replace(/[^0-9.]/g, "")));
  return Number.isFinite(n) && n > 0 && n <= 5000 ? n : 0;
}

// Identifiant fixe : une seule course par famille et par jour (cocher deux trajets ne la compte pas deux fois)
export const idForfait = (familleId, date) => `tournee-${String(familleId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}-${date}`;

// Les familles concernees par une etape de ma journee
// tous = trajets de la tournee (ceux des fiches portent « famille ») ; tache de ramassage : tache.enfant.famille
export function famillesDeLEtape(e, tous = []) {
  const ids = new Set();
  if (!e) return [];
  if (e.genre === "tache" && e.tache && e.tache.type === "ramassage" && e.tache.enfant && e.tache.enfant.famille) ids.add(e.tache.enfant.famille);
  if (e.genre === "arret") {
    for (const id of e.ids || []) {
      const r = tous.find((x) => x.id === id);
      if (r && r.famille) ids.add(r.famille);
    }
  }
  return [...ids];
}

export const telephoneFamille = (f) => String((f && (f.telephone || f.telephone2)) || "").trim();
const prenoms = (f) => [...new Set(((f && f.enfants) || []).map((e) => String(e.prenom || "").trim()).filter(Boolean))].join(" et ");
const jjmm = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// La course a enregistrer (sans creeLe / majLe, ajoutes a l'enregistrement). null = pas de forfait ou pas de telephone.
export function courseForfait(f, date, heure) {
  const prix = lireForfait(f && f.forfaitJour);
  const telephone = telephoneFamille(f);
  if (!prix || telephone.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const enfants = prenoms(f);
  return {
    service: "ramassage",
    serviceTitre: "Ramassage scolaire",
    date,
    heure: /^\d{2}:\d{2}$/.test(heure || "") ? heure : "08:00",
    nom: String(f.nom || "Cliente").trim().slice(0, 100) || "Cliente",
    telephone: telephone.slice(0, 30),
    moyenPaiement: TARIFS.moyensPaiement[0],
    prixEstime: null,
    prixFinal: prix,
    surDevis: false,
    kmEstime: null,
    minutesEstimees: null,
    details: { forfait: "Forfait à la journée", enfants, famille: String(f.id || "").slice(0, 40) },
    message: `Forfait à la journée · Ramassage scolaire${enfants ? " · " + enfants : ""} · ${jjmm(date)} · ${prix} ₪`,
    statut: "terminee",
    source: "manuel",
  };
}

// Apres avoir decoche une etape : la famille a-t-elle encore un trajet coche ce jour-la ?
// fil = etapes du jour ; faits = { cle: heure } apres le changement ; cle(e) = cleEtape
export function familleEncoreFaite(familleId, fil, faits, tous, cle) {
  return fil.some((e) => faits[cle(e)] && famillesDeLEtape(e, tous).includes(familleId));
}
