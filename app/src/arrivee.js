import { calculerTrajetSur, dureeAvecTrafic, positionActuelle } from "./routing.js";

// SUIVI EN DIRECT (18 nov. 2026) : heure d'arrivee prevue a une adresse, depuis la position actuelle de Rebecca
// (trafic Google si la cle le permet, sinon le calcul gratuit). Renvoie « 14:32 », ou "" si impossible.
export async function minutesJusqua(vers) {
  if (!vers || typeof vers.lat !== "number" || typeof vers.lon !== "number") return null;
  const ici = await positionActuelle();
  let minutes = null;
  try { minutes = Math.round((await dureeAvecTrafic(ici, vers)).avecTrafic / 60); } catch { minutes = null; }
  if (!(minutes > 0)) minutes = (await calculerTrajetSur(ici, vers)).minutes;
  return Math.max(1, Math.round(minutes));
}
// Heure (Israel) dans « minutes » a partir de maintenant : « 14:32 »
export const heureDans = (minutes, depuis = Date.now()) => new Date(depuis + Math.max(1, minutes) * 60000).toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
export async function heureArrivee(vers) {
  const minutes = await minutesJusqua(vers);
  return minutes ? heureDans(minutes) : "";
}
