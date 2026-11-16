// REPARTITION DES STATISTIQUES WOLT (16 nov. 2026) - Rebecca Services
// Rebecca : « J'ai rentre tous les montants recus de Wolt, avec les dates. Galere de reprendre chaque paiement pour
// mettre le nombre de livraisons et les pourboires. Trouve un moyen de les mettre a jour d'apres la photo. »
// L'ecran « Vos statistiques » de Wolt donne, pour une periode : livraisons terminees, km, pourboires.
// On partage ces totaux entre les lignes Wolt deja saisies de la periode, en proportion du montant de chaque ligne.
// REGLE : le montant recu de chaque ligne (revenu + pourboire) NE CHANGE PAS ; les pourboires sont sortis du revenu.
// Aucun centime et aucune livraison ne se perd : la somme des parts = exactement le total de Wolt.

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const nb = (x) => Number(x) || 0;
const lire = (x) => Number(String(x == null ? "" : x).trim().replace(/\s/g, "").replace(",", ".") || "0");

// Partage un total entier entre des poids (methode du plus fort reste) : la somme des parts = total
export function partager(total, poids) {
  const somme = poids.reduce((s, p) => s + p, 0);
  if (!(somme > 0) || !(total > 0)) return poids.map(() => 0);
  const exact = poids.map((p) => (total * p) / somme);
  const parts = exact.map(Math.floor);
  let reste = total - parts.reduce((s, p) => s + p, 0);
  const ordre = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || poids[b.i] - poids[a.i] || a.i - b.i);
  for (let k = 0; reste > 0 && k < ordre.length; k++, reste--) parts[ordre[k].i] += 1;
  return parts;
}

// lignes : lignes Wolt de la personne ; f : { debut, fin, livraisons, pourboires, km } (textes du formulaire)
// -> { erreur } ou { erreur: "", totalRecu, lignes: [{ id, debut, fin, total, livraisons, revenu, pourboire, km }] }
export function repartirStatsWolt(lignes, f) {
  if (!DATE_OK.test(f.debut || "") || !DATE_OK.test(f.fin || "")) return { erreur: "Indique les deux dates, comme sur l'écran de Wolt." };
  if (f.fin < f.debut) return { erreur: "La date de fin est avant la date de début." };
  const livraisons = lire(f.livraisons);
  const pourboires = Math.round(lire(f.pourboires) * 100);
  const km = Math.round(lire(f.km) * 100);
  if (!Number.isInteger(livraisons) || livraisons < 0) return { erreur: "Nombre de livraisons invalide (nombre entier)." };
  if (!Number.isFinite(pourboires) || pourboires < 0) return { erreur: "Montant des pourboires invalide." };
  if (!Number.isFinite(km) || km < 0) return { erreur: "Kilomètres invalides." };
  if (!livraisons && !pourboires && !km) return { erreur: "Recopie au moins un chiffre de l'écran de Wolt." };

  // Lignes Wolt de la periode (rattachees a leur date de debut), avec un montant recu positif (pas les corrections)
  const choisies = lignes
    .filter((l) => /wolt/i.test(l.source || "Wolt") && String(l.debut) >= f.debut && String(l.debut) <= f.fin)
    .map((l) => ({ l, cents: Math.round((nb(l.revenu) + nb(l.pourboire)) * 100) }))
    .filter((x) => x.cents > 0 && nb(x.l.revenu) >= 0 && nb(x.l.pourboire) >= 0)
    .sort((a, b) => String(a.l.debut).localeCompare(String(b.l.debut)) || String(a.l.id).localeCompare(String(b.l.id)));
  if (!choisies.length) return { erreur: "Aucune ligne Wolt saisie entre ces deux dates." };

  const poids = choisies.map((x) => x.cents);
  const totalRecu = poids.reduce((s, p) => s + p, 0);
  if (pourboires >= totalRecu) return { erreur: "Les pourboires dépassent ce que tu as saisi comme reçu sur cette période. Vérifie les dates." };
  if (livraisons > 5000 * choisies.length) return { erreur: "Nombre de livraisons trop grand." };

  const partLiv = partager(livraisons, poids);
  const partPb = partager(pourboires, poids);
  const partKm = partager(km, poids);
  if (partLiv.some((n) => n > 5000)) return { erreur: "Trop de livraisons pour une seule ligne. Vérifie les dates." };
  return {
    erreur: "",
    totalRecu: totalRecu / 100,
    livraisons,
    pourboires: pourboires / 100,
    km: km / 100,
    lignes: choisies.map((x, i) => ({
      id: x.l.id,
      debut: x.l.debut,
      fin: x.l.fin,
      total: x.cents / 100,
      livraisons: livraisons ? partLiv[i] : nb(x.l.livraisons),
      pourboire: pourboires ? partPb[i] / 100 : nb(x.l.pourboire),
      revenu: pourboires ? (x.cents - partPb[i]) / 100 : nb(x.l.revenu),
      km: km ? partKm[i] / 100 : null,
    })),
  };
}
