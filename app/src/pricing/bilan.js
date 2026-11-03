// BILAN : choix de la periode (jour, semaine, mois, tout) - Rebecca Transport & Services
// Logique pure (aucun acces internet ni base de donnees) : elle se teste seule.
// Les dates sont des textes "AAAA-MM-JJ". La semaine va du dimanche au samedi (Israel).

export const TYPES = [
  { id: "jour", titre: "Jour" },
  { id: "semaine", titre: "Semaine" },
  { id: "mois", titre: "Mois" },
  { id: "tout", titre: "Tout" },
];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const lire = (s) => {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
};
const plusJours = (d, n) => {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

// Periode (debut et fin inclus) qui contient la date "ref". "tout" : pas de limite (null).
export function periodeDe(type, ref) {
  if (type === "tout") return null;
  const d = lire(ref);
  if (type === "jour") return { debut: ref, fin: ref };
  if (type === "semaine") {
    const debut = plusJours(d, -d.getUTCDay());
    return { debut: iso(debut), fin: iso(plusJours(debut, 6)) };
  }
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return { debut: a + "-" + pad(m + 1) + "-01", fin: iso(new Date(Date.UTC(a, m + 1, 0, 12))) };
}

// Date de reference de la periode precedente (delta = -1) ou suivante (delta = +1)
export function decaler(type, ref, delta) {
  if (type === "tout") return ref;
  const d = lire(ref);
  if (type === "jour") return iso(plusJours(d, delta));
  if (type === "semaine") return iso(plusJours(d, 7 * delta));
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 12)));
}

const fr = (d, options) => d.toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" });

export function libelle(type, ref) {
  if (type === "tout") return "Depuis le début";
  const p = periodeDe(type, ref);
  if (type === "jour") return fr(lire(ref), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (type === "semaine") return "Du " + fr(lire(p.debut), { day: "numeric", month: "short" }) + " au " + fr(lire(p.fin), { day: "numeric", month: "short", year: "numeric" });
  return fr(lire(ref), { month: "long", year: "numeric" });
}

// Peut-on aller a la periode suivante ? Non si elle commence apres aujourd'hui.
export function suivantPossible(type, ref, aujourdhui) {
  if (type === "tout") return false;
  return periodeDe(type, decaler(type, ref, 1)).debut <= aujourdhui;
}
