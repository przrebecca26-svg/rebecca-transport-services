// POUR QUI EST LA COURSE ? (26 nov. 2026, 9h53, Rebecca : « une case Cliente, Ami ou Famille »)
// - Cliente : le prix du devis ;
// - Ami(e) : le devis avec une réduction choisie à chaque fois (-10, -20, -30 %), ou un prix tapé ;
// - Famille : le prix que je veux, 0 compris (offert). Règles Firebase v39.
// Ami et Famille sont des faveurs (prixAmi) : comptées à part de la rentabilité, jamais « mal tarifées ».
export const RELATIONS = [
  { v: "cliente", l: "👩 Cliente", aide: "Prix du devis." },
  { v: "ami", l: "💛 Ami(e)", aide: "Le devis avec une réduction, ou le prix convenu." },
  { v: "famille", l: "👨‍👩‍👧 Famille", aide: "Le prix que tu veux, 0 = offert." },
];
export const REDUCTIONS_AMI = [10, 20, 30];
const arrondi = (n) => Math.round(n * 100) / 100;

// Prix proposé quand on choisit la relation ou une réduction (le champ reste modifiable ensuite)
export function prixPropose(devis, relation, reduction = null) {
  const d = Number(devis);
  if (relation === "famille") return 0;
  if (!Number.isFinite(d) || d <= 0) return null;
  if (relation === "ami" && reduction) return Math.max(0, Math.round(d * (1 - reduction / 100)));
  return arrondi(d);
}

// Champs écrits sur la course (rien pour une cliente : la course reste comme avant)
export function champsRelation(relation) {
  if (relation === "ami") return { relation: "ami", prixAmi: true };
  if (relation === "famille") return { relation: "famille", prixAmi: true, prixFamille: true };
  return {};
}

// Le prix accepté : > 0 (cliente, ami) ; >= 0 pour la famille
export function prixAccepte(prix, relation) {
  if (prix == null || !Number.isFinite(prix) || prix > 20000) return false;
  return relation === "famille" ? prix >= 0 : prix > 0;
}

export const texteRelation = (d) => (d && d.prixFamille ? "👨‍👩‍👧 Famille" : d && d.prixAmi ? "💛 Prix ami" : "");
