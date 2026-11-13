// OPTIONS PAR ONGLE (13 nov. 2026, 09h49) - regles pures
// Une cliente qui reserve une prestation Nails peut AJOUTER du nail art ou une reparation sur X ongles :
// le prix et la duree s'ajoutent tout seuls (options « par ongle » du catalogue : prix et duree par ongle).
// Duree d'une option : sa duree x nombre d'ongles, au plus 90 min de plus par option (reglable dans le Catalogue).
export const MAX_ONGLES = 10;
export const MAX_MIN_OPTION = 90;
export const optionsParOngle = (prestations = []) => prestations.filter((x) => x && x.option && x.typePrix === "parongle");

// p : prestation choisie ; options : options (deja ajustees) ; choix : { idOption: nombre d'ongles }
export function totalAvecOptions(p, options = [], choix = {}) {
  const lignes = options
    .map((o) => ({ o, n: Math.max(0, Math.min(MAX_ONGLES, Math.round(Number(choix[o.id]) || 0))) }))
    .filter((x) => x.n > 0)
    .map(({ o, n }) => ({ id: o.id, nom: o.nom.replace(/\s*\(par ongle\)\s*$/i, ""), ongles: n, prix: (Number(o.prix) || 0) * n, minutes: Math.min(MAX_MIN_OPTION, (Number(o.dureeMinutes) || 0) * n), aPartirDe: !!o.prixMax }));
  const prix = (Number(p && p.prix) || 0) + lignes.reduce((s, l) => s + l.prix, 0);
  const minutes = (Number(p && p.dureeMinutes) || 60) + lignes.reduce((s, l) => s + l.minutes, 0);
  return { lignes, prix, minutes, aPartirDe: lignes.some((l) => l.aPartirDe) };
}
export const texteOptions = (lignes) => lignes.map((l) => `${l.nom} : ${l.ongles} ongle${l.ongles > 1 ? "s" : ""} (${l.aPartirDe ? "à partir de " : ""}${l.prix} ₪)`).join(", ");
