// MENU ET PANIER EN LIGNE DES RESTAURANTS PARTENAIRES (26 nov. 2026) - règles pures, testées dans tests/carteResto.test.mjs
// Rebecca écrit la carte du restaurant dans son espace (une ligne par plat), le client remplit son panier sur
// #/restaurants et la commande part au RESTAURANT par WhatsApp (il paie son repas au restaurant ; Rebecca livre).
// Aucun argent des repas chez Rebecca, aucune nouvelle donnée en base côté client : règles Firebase inchangées.
// Format de la carte (champ texte) :
//   # Sushis            <- une catégorie
//   California saumon ; 42 ; 8 pièces     <- nom ; prix en ₪ ; description (facultative)
//   Poké thon ; 58
//   Edamame ; 18 ; épuisé                 <- « épuisé » dans la description = non commandable

const PRIX = /^\d{1,4}([.,]\d{1,2})?$/;
export const MAX_PLATS = 150;

export function lireCarte(texte) {
  const categories = [];
  let courante = null;
  let n = 0;
  for (const brute of String(texte || "").split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    if (ligne.startsWith("#")) {
      courante = { nom: ligne.replace(/^#+\s*/, "").slice(0, 60) || "Menu", plats: [] };
      categories.push(courante);
      continue;
    }
    const [nom, prix, ...reste] = ligne.split(/\s*;\s*/);
    if (!nom || !PRIX.test(String(prix || "").replace(/\s*₪\s*$/, "").trim()) || n >= MAX_PLATS) continue;
    if (!courante) {
      courante = { nom: "Menu", plats: [] };
      categories.push(courante);
    }
    const description = reste.join(" ; ").slice(0, 120);
    n++;
    courante.plats.push({ id: `p${n}`, nom: nom.slice(0, 70), prix: Number(String(prix).replace(",", ".").replace(/\s*₪\s*$/, "")), description, epuise: /épuisé|epuise|indisponible/i.test(description) });
  }
  return categories.filter((c) => c.plats.length);
}

export const platsDe = (carte) => (carte || []).flatMap((c) => c.plats);

// panier = { idPlat: quantité }
export function totalPanier(carte, panier = {}) {
  const lignes = platsDe(carte)
    .filter((p) => !p.epuise && Number(panier[p.id]) > 0)
    .map((p) => ({ ...p, quantite: Math.min(20, Math.round(Number(panier[p.id]))), sousTotal: Math.round(p.prix * Math.min(20, Math.round(Number(panier[p.id]))) * 100) / 100 }));
  return { lignes, articles: lignes.reduce((s, l) => s + l.quantite, 0), total: Math.round(lignes.reduce((s, l) => s + l.sousTotal, 0) * 100) / 100 };
}

const prixFr = (n) => `${String(n).replace(".", ",")} ₪`;

export function erreursPanier(t, client = {}) {
  const e = {};
  if (!t.lignes.length) e.panier = "Choisissez au moins un plat.";
  if (!String(client.nom || "").trim()) e.nom = "Votre nom.";
  if (String(client.telephone || "").replace(/\D/g, "").length < 9) e.telephone = "Votre téléphone.";
  if (String(client.adresse || "").trim().length < 5) e.adresse = "L'adresse de livraison.";
  return e;
}

// Message WhatsApp envoyé au restaurant
export function messagePanier(resto, t, client = {}) {
  return [
    `Bonjour ${resto.nom}, nouvelle commande en livraison (site Rebecca Services) :`,
    ...t.lignes.map((l) => `• ${l.quantite} × ${l.nom} — ${prixFr(l.sousTotal)}`),
    `Total des plats : ${prixFr(t.total)} (payé au restaurant)`,
    "",
    `Nom : ${String(client.nom || "").trim()}`,
    `Téléphone : ${String(client.telephone || "").trim()}`,
    `Adresse de livraison : ${String(client.adresse || "").trim()}`,
    ...(String(client.note || "").trim() ? [`Note : ${String(client.note).trim().slice(0, 200)}`] : []),
    "",
    "Livraison assurée par Rebecca Services. Merci de me confirmer la commande et l'heure !",
  ].join("\n");
}

// 26 nov. 2026, 9h07 (Rebecca : un onglet menu avec le nom, le descriptif et le prix, ajouter et supprimer) :
// la carte se modifie plat par plat ; elle est toujours enregistrée dans le même format texte (une ligne par plat).
export function ecrireCarte(carte) {
  const lignes = [];
  for (const c of carte || []) {
    const plats = (c.plats || []).filter((p) => String(p.nom || "").trim()).map((p) => ({ ...p, prix: Number(p.prix) >= 0 ? Number(p.prix) : 0 }));
    if (!plats.length) continue;
    lignes.push(`# ${String(c.nom || "Menu").replace(/[#;\n]/g, " ").trim().slice(0, 60) || "Menu"}`);
    for (const p of plats) {
      const desc = [String(p.description || "").replace(/;/g, ",").replace(/\n/g, " ").replace(/\s*(épuisé|epuise|indisponible)\s*/gi, " ").trim(), p.epuise ? "épuisé" : ""].filter(Boolean).join(" ");
      lignes.push([String(p.nom).replace(/[;\n]/g, " ").trim().slice(0, 70), String(Math.round(Number(p.prix) * 100) / 100).replace(".", ","), desc].filter((x, i) => i < 2 || x).join(" ; "));
    }
  }
  return lignes.join("\n");
}

// Import d'une liste collée (WhatsApp, Excel, Google Sheets) : « Nom ; prix ; description », ou séparée par des
// tabulations (copier depuis un tableur), ou « Nom - 42 ₪ ». Les lignes déjà au bon format restent telles quelles.
export function importerCarte(texte) {
  const lignes = String(texte || "").split(/\r?\n/).map((l) => {
    const x = l.trim();
    if (!x || x.startsWith("#") || x.includes(";")) return x;
    if (x.includes("\t")) {
      const [nom, prix, ...desc] = x.split("\t").map((s) => s.trim());
      return prix ? [nom, prix.replace(/[^\d.,]/g, ""), desc.join(" ")].filter((v, i) => i < 2 || v).join(" ; ") : `# ${nom}`;
    }
    const m = /^(.+?)\s*[-–:]\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:₪|nis|ils|shekels?)?\s*(.*)$/i.exec(x);
    return m ? [m[1], m[2], m[3]].filter((v, i) => i < 2 || v).join(" ; ") : `# ${x}`;
  });
  return lireCarte(lignes.join("\n"));
}
