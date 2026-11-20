// ÉTAPES D'UN ARRÊT DE LA TOURNÉE (20 nov. 2026, Rebecca : « entre le moment où j'arrive au Gan, où je récupère
// les filles et où je repars, il y a du temps : je dois pouvoir prévenir la maman à chaque moment »).
// Récupérer : 📍 Arrivée -> 👧 Récupéré(e)s -> 🚗 Je pars (l'étape est validée au départ).
// Déposer : 📍 Arrivée -> ✓ Déposé(e)s (l'étape est validée au dépôt).
const lister = (p) => (p.length > 1 ? `${p.slice(0, -1).join(", ")} et ${p[p.length - 1]}` : p[0] || "votre enfant");

export function boutonsEtape(sorte) {
  return sorte === "prise"
    ? [{ id: "arrivee", l: "📍 Je suis arrivée" }, { id: "avecMoi", l: "👧 Enfants récupérés" }, { id: "depart", l: "🚗 Je pars", valide: true }]
    : [{ id: "arrivee", l: "📍 Je suis arrivée" }, { id: "depose", l: "✓ Enfants déposés", valide: true }];
}

// Prochain bouton à toucher (celui d'après le dernier touché)
export function boutonSuivant(sorte, faits = {}) {
  return boutonsEtape(sorte).find((b) => !faits[b.id]) || null;
}

export function messageEtape(id, prenoms = [], lieu = "", heure = "", arriveeVers = "") {
  const qui = lister(prenoms);
  const pl = prenoms.length > 1;
  const ou = lieu ? ` (${lieu})` : "";
  const a = heure ? ` à ${heure}` : "";
  const ligne = id === "arrivee"
    ? `Je suis arrivée${ou}${a} pour ${qui} 📍`
    : id === "avecMoi"
      ? `${qui} ${pl ? "sont" : "est"} avec moi${a}, tout va bien 👧`
      : id === "depart"
        ? `On part maintenant${ou}${a} avec ${qui} 🚗${arriveeVers ? ` Arrivée prévue vers ${arriveeVers}.` : ""}`
        : `${qui} ${pl ? "sont bien arrivés" : "est bien arrivé(e)"}${ou}${a} ✅`;
  return ["Bonjour,", ligne, "Rebecca"].join("\n");
}
