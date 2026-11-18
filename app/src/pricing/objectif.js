// OBJECTIF DU MOIS (18 nov. 2026, suggestion validée) - regles pures - Rebecca Services
// Rebecca fixe un montant a gagner pour le mois ; une barre montre ou elle en est (ce qu'elle a encaisse, Wolt compris),
// ce qui reste, et combien par jour de travail il faut encore (sans les samedis : Chabbat).
const cents = (x) => Math.round(x * 100) / 100;

export function joursDeTravailRestants(mois, aujourdhui) {
  const [a, m] = mois.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const debut = aujourdhui.slice(0, 7) === mois ? Number(aujourdhui.slice(8, 10)) : aujourdhui.slice(0, 7) < mois ? 1 : dernier + 1;
  let n = 0;
  for (let j = debut; j <= dernier; j++) if (new Date(Date.UTC(a, m - 1, j)).getUTCDay() !== 6) n++;
  return n;
}

export function objectifDuMois(gagne, objectif, mois, aujourdhui) {
  const o = Number(objectif) || 0;
  if (o <= 0) return null;
  const g = Number(gagne) || 0;
  const reste = Math.max(0, cents(o - g));
  const jours = joursDeTravailRestants(mois, aujourdhui);
  return {
    objectif: o,
    gagne: cents(g),
    pct: Math.min(100, Math.round((g / o) * 100)),
    atteint: g >= o,
    reste,
    jours,
    parJour: jours ? Math.ceil(reste / jours) : reste,
  };
}
