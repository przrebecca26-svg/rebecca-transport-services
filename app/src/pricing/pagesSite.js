// PAGES DU SITE (20 nov. 2026, Rebecca) - règles pures
// « Dans les réglages de mon admin, un onglet : chaque page (coursier partenaire, restaurant partenaire, transport…)
// en un clic je l'affiche ou je l'enlève côté client, et un bouton réglages : ce qui apparaît, pour qui, bloquer
// des personnes en particulier. » + ses 5 idées validées : lien direct toujours actif, mode « Bientôt »,
// ouverture programmée, « Voir comme une cliente », fermer une page sans casser ce qui existe.
// Réglage enregistré dans reglages/pages (lecture publique, écriture Rebecca seule : aucune nouvelle règle).

export const PAGES = [
  { id: "coursier", titre: "Services coursier", type: "activite" },
  { id: "transport", titre: "Transport privé (aéroport, Hatan & Kala, mise à disposition)", type: "activite" },
  { id: "nails", titre: "Nails Prestige", type: "activite" },
  { id: "regenx", titre: "RegenX", type: "activite" },
  { id: "hair", titre: "Prestige Hair", type: "activite" },
  { id: "slim", titre: "Prestige Slim & Lift", type: "activite" },
  { id: "epoxy", titre: "Boutique Epoxy", type: "activite" },
  { id: "digital", titre: "Digital & Applications", type: "activite" },
  { id: "restoPartenaire", titre: "Devenir restaurant partenaire", type: "partenaire", lien: "#/restaurant-partenaire" },
  { id: "coursierPartenaire", titre: "Devenir coursier partenaire", type: "partenaire", lien: "#/partenaire" },
  // 25 nov. 2026 : reseau de professionnels partenaires, CACHE (meme par lien direct) jusqu'a l'accord de Rebecca
  { id: "pros", titre: "Annuaire des professionnels partenaires", type: "partenaire", lien: "#/pros" },
  { id: "proInscription", titre: "Professionnels : rejoindre l'annuaire", type: "partenaire", lien: "#/pro" },
];

// Ce qui marche aujourd'hui (rien ne change tant que Rebecca ne touche à rien)
const DEFAUTS = {
  transport: { visible: true, pour: "autorisees" }, // « sur autorisation », comme décidé
  restoPartenaire: { visible: false },
  coursierPartenaire: { visible: false },
  pros: { visible: false, lienDirect: false },
  proInscription: { visible: false, lienDirect: false },
};
export const POUR = [
  { v: "tous", l: "Tout le monde" },
  { v: "comptes", l: "Seulement les clientes avec un compte" },
  { v: "autorisees", l: "Seulement les clientes que j'autorise (une par une)" },
];
export const OU = [
  { v: "accueil", l: "Une carte sur l'accueil" },
  { v: "pied", l: "Un lien en bas de page" },
  { v: "lien", l: "Seulement par lien direct (je l'envoie moi-même)" },
];

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const empreinteOk = (x) => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);

// Réglage d'une page, complet et propre
export function reglagePage(reglages, id) {
  const page = PAGES.find((p) => p.id === id) || { type: "activite" };
  const r = (reglages && reglages.pages && reglages.pages[id]) || {};
  const d = DEFAUTS[id] || {};
  const choix = (v, liste, defaut) => (liste.some((x) => x.v === v) ? v : defaut);
  return {
    visible: typeof r.visible === "boolean" ? r.visible : d.visible !== false,
    bientot: r.bientot === true,
    pour: choix(r.pour, POUR, d.pour || "tous"),
    ou: page.type === "partenaire" ? choix(r.ou, OU, "pied") : "accueil",
    lienDirect: typeof r.lienDirect === "boolean" ? r.lienDirect : d.lienDirect !== false,
    ouvertureLe: DATE_OK.test(r.ouvertureLe || "") ? r.ouvertureLe : "",
    bloques: Array.isArray(r.bloques) ? r.bloques.filter((b) => b && empreinteOk(b.e)).slice(0, 100).map((b) => ({ e: b.e, nom: String(b.nom || "").slice(0, 60) })) : [],
  };
}

// Ce que voit CE visiteur : "ouverte" | "bientot" | "cachee" | "bloquee"
// v = { connecte, autorise (Transport : autorisation de Rebecca), empreintes: [sha256 de son téléphone…], jour: "AAAA-MM-JJ" }
export function etatPage(reglages, id, v = {}) {
  const r = reglagePage(reglages, id);
  if ((v.empreintes || []).some((e) => r.bloques.some((b) => b.e === e))) return "bloquee";
  if (!r.visible) return "cachee";
  if (r.ouvertureLe && v.jour && v.jour < r.ouvertureLe) return "bientot";
  if (r.bientot) return "bientot";
  if (r.pour === "comptes" && !v.connecte) return "cachee";
  if (r.pour === "autorisees" && !v.autorise) return "cachee";
  return "ouverte";
}

// Lien direct (#/restaurant-partenaire, #/partenaire, formulaire d'un service) : marche-t-il ?
// La page cachée reste joignable par son lien si « lien direct toujours actif » (par défaut) ;
// les demandes déjà reçues et les liens déjà envoyés (espaces, contrats, suivis) ne passent jamais par ici.
export function lienDirectOuvert(reglages, id, v = {}) {
  const e = etatPage(reglages, id, v);
  if (e === "ouverte") return true;
  if (e === "bloquee") return false;
  return reglagePage(reglages, id).lienDirect;
}

// Texte de la ligne dans les réglages
export function resumePage(reglages, id) {
  const r = reglagePage(reglages, id);
  const page = PAGES.find((p) => p.id === id) || {};
  if (!r.visible) return `cachée${r.lienDirect ? " · lien direct actif" : ""}`;
  const morceaux = [r.bientot ? "« Bientôt »" : "affichée"];
  if (r.ouvertureLe) morceaux.push(`ouvre le ${r.ouvertureLe.split("-").reverse().join("/")}`);
  morceaux.push((POUR.find((x) => x.v === r.pour) || {}).l.toLowerCase());
  if (page.type === "partenaire") morceaux.push((OU.find((x) => x.v === r.ou) || {}).l.toLowerCase());
  if (r.bloques.length) morceaux.push(`${r.bloques.length} bloquée${r.bloques.length > 1 ? "s" : ""}`);
  return morceaux.join(" · ");
}

// Téléphone -> empreinte (on ne stocke jamais le numéro en clair dans ce réglage public)
export const telPourEmpreinte = (t) => {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d.length >= 9 ? d : "";
};
export async function empreinte(texte) {
  const octets = new TextEncoder().encode(`rebecca-services|${texte}`);
  const h = await globalThis.crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
