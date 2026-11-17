// DUREE DU TRAJET SELON L'HEURE (17 nov. 2026) - regles pures - Rebecca Services
// Rebecca : « savoir combien de temps le trajet va durer, par rapport aux heures de pointe, en reglages, pour tous les
// trajets de transport et de courses / livraison ». Le calcul d'itineraire gratuit (OSRM) ne connait pas la
// circulation : sa duree (deja majoree de 15 %) est la duree « normale ». Aux heures de pointe on ajoute le
// pourcentage regle dans Reglages -> Tarifs -> Circulation. Le PRIX ne change pas : seule la duree affichee.
// Heures en nombre : 7 = 7h00, 9.5 = 9h30. Jours de semaine israeliens : dimanche a jeudi.
import { TARIFS } from "./config.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^(\d{2}):(\d{2})$/;
const jourSemaine = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay(); // 0 = dimanche ... 6 = samedi
};
const pct = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Math.min(1, Number(x))) : 0);
const dans = (h, debut, fin) => Number.isFinite(+debut) && Number.isFinite(+fin) && h >= +debut && h < +fin;

// Plage de circulation pour un depart (date « AAAA-MM-JJ », heure « HH:MM ») -> { pct, plage } ; pct 0 = circulation normale
export function plageCirculation(date, heure, t = TARIFS) {
  const c = (t && t.circulation) || {};
  const m = HEURE_OK.exec(String(heure || ""));
  if (!DATE_OK.test(String(date || "")) || !m) return { pct: 0, plage: "" };
  const h = +m[1] + +m[2] / 60;
  const jour = jourSemaine(date);
  if (jour >= 0 && jour <= 4) {
    if (dans(h, c.matinDebut, c.matinFin) && pct(c.matin)) return { pct: pct(c.matin), plage: "heure de pointe du matin" };
    if (dans(h, c.soirDebut, c.soirFin) && pct(c.soir)) return { pct: pct(c.soir), plage: "heure de pointe du soir" };
  }
  if (jour === 5 && dans(h, c.vendrediDebut, c.vendrediFin) && pct(c.vendredi)) return { pct: pct(c.vendredi), plage: "vendredi avant Chabbat" };
  return { pct: 0, plage: "" };
}

// Duree prevue du trajet : minutes « normales » + la majoration de l'heure de depart
// -> { minutes, normales, pct, plage } ; null si la duree normale est inconnue
export function dureeSelonHeure(minutes, date, heure, t = TARIFS) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const { pct: p, plage } = plageCirculation(date, heure, t);
  return { minutes: Math.max(1, Math.ceil(n * (1 + p))), normales: Math.round(n), pct: p, plage };
}

// « 1 h 05 », « 45 min »
export const dureeTexte = (min) => {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

// Texte court : « environ 45 min (heure de pointe du matin, +50 %) »
export function texteDuree(minutes, date, heure, t = TARIFS) {
  const r = dureeSelonHeure(minutes, date, heure, t);
  if (!r) return "";
  return `environ ${dureeTexte(r.minutes)}${r.pct ? ` (${r.plage}, +${Math.round(r.pct * 100)} %)` : ""}`;
}
