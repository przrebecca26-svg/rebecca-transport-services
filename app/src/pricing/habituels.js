// RESERVER EN 2 TOUCHES (18 nov. 2026, suggestion validée) - regles pures - Rebecca Services
// Sur l'accueil, la cliente connectee retrouve ses trajets habituels (tires de son historique, sans rien enregistrer) :
// elle touche, le formulaire se remplit (adresses, passagers, bagages...), elle choisit juste la date et l'heure.
const EXCLUS = new Set(["date", "heure", "dateRetour", "heureRetour", "codePromo", "promoActif", "urgent"]);
const court = (t) => String(t || "").split(",")[0].trim().slice(0, 28);
const ANNULES = ["refusée", "annulée par le client", "remplacée", "annulée", "refusee", "annulee"];

export function trajetsHabituels(suivis = [], favoris = [], formulaires = {}, max = 4) {
  const vus = new Set((favoris || []).map((f) => cleDe(f.service, f.details, formulaires)));
  const tries = [...suivis].filter((x) => x && formulaires[x.service] && !ANNULES.includes(x.statut)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const r = [];
  for (const x of tries) {
    const cle = cleDe(x.service, x.details, formulaires);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    const lieux = [...new Set(adressesDe(x.service, x.details, formulaires).map((a) => court(a.label)).filter(Boolean))];
    const details = Object.fromEntries(Object.entries(x.details || {}).filter(([k]) => !EXCLUS.has(k)));
    r.push({ nom: `${String(x.serviceTitre || x.service).split("–")[0].trim()}${lieux.length ? " · " + lieux.join(" → ") : ""}`, service: x.service, details });
    if (r.length >= max) break;
  }
  return r;
}
function adressesDe(service, details, formulaires) {
  return (formulaires[service] || []).filter((c) => c.type === "adresse").map((c) => (details || {})[c.name]).filter((a) => a && typeof a === "object" && a.label);
}
function cleDe(service, details, formulaires) {
  const a = adressesDe(service, details, formulaires);
  return a.length ? `${service}|${a.map((x) => String(x.label).toLowerCase()).join(">")}` : "";
}
