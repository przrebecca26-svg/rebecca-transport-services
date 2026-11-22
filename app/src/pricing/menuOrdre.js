// ORDRE DU MENU (19 nov. 2026, Rebecca) : « pouvoir modifier cette barre, mettre en priorité les commandes tout en
// haut, juste en dessous du tableau de bord, comme je préfère ». Règles pures ; l'ordre est gardé sur le téléphone.

// Les rubriques dans l'ordre choisi ; celles qui ne sont pas dans l'ordre gardent leur place par défaut, à la fin.
export function ordonner(rubriques = [], ordre = []) {
  const ids = Array.isArray(ordre) ? ordre.filter((x) => typeof x === "string") : [];
  const dedans = ids.map((id) => rubriques.find((r) => r.id === id)).filter(Boolean);
  return [...dedans, ...rubriques.filter((r) => !ids.includes(r.id))];
}

// Monter (-1) ou descendre (+1) une rubrique ; renvoie le nouvel ordre complet (liste d'identifiants)
export function deplacer(rubriques = [], ordre = [], id, sens) {
  const liste = ordonner(rubriques, ordre).map((r) => r.id);
  const i = liste.indexOf(id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= liste.length) return liste;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return liste;
}

// 22 nov. 2026 (Rebecca : « À accepter, Commandes restaurants, Demandes et missions… ça se mélange, ce n'est pas
// clair ») : le menu est range par sections (Ma journée, Rebecca Services, Restaurants…). L'ordre choisi par
// Rebecca est garde a l'interieur de chaque section.
export function parSections(rubriques = [], sections = []) {
  const rang = (r) => {
    const i = sections.findIndex((s) => s.id === r.section);
    return i < 0 ? sections.length : i;
  };
  return rubriques.map((r, i) => ({ r, i })).sort((a, b) => rang(a.r) - rang(b.r) || a.i - b.i).map((x) => x.r);
}
// Monter / descendre dans la liste affichee, sans changer de section ; renvoie le nouvel ordre (identifiants)
export function deplacerDans(liste = [], id, sens) {
  const ids = liste.map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= ids.length || (liste[i].section || "") !== (liste[j].section || "")) return ids;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}
