// SUIVI GPS EN DIRECT (19 nov. 2026, V2) - regles pures
// Rebecca partage sa position pendant une course : la cliente ouvre un lien (#/position/ID) et voit la voiture
// arriver sur une carte, avec l'heure de la derniere mise a jour. Rien n'est garde apres la course.
export const lireLienPosition = (hash) => {
  const m = /^#\/position\/([A-Za-z0-9_-]{6,60})$/.exec(String(hash || ""));
  return m ? m[1] : "";
};
export const lienPosition = (id, origine = "https://rebeccaservices.com") => `${origine}/#/position/${id}`;

// Position propre (6 decimales ~ 10 cm, inutile d'aller plus loin) ou null
export function positionPropre(p) {
  const lat = Number(p && p.lat);
  const lon = Number(p && p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const r = (x) => Math.round(x * 1e6) / 1e6;
  return { lat: r(lat), lon: r(lon) };
}
// Envoyer une nouvelle position seulement si on a bouge d'au moins ~30 m ou s'il s'est passe 20 secondes
export function aEnvoyer(avant, apres, msDepuis) {
  if (!apres) return false;
  if (!avant) return true;
  const dLat = (apres.lat - avant.lat) * 111000;
  const dLon = (apres.lon - avant.lon) * 111000 * Math.cos((apres.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon) >= 30 || msDepuis >= 20000;
}
// Carte OpenStreetMap integree (sans cle) centree sur la voiture
export function carteOsm(p, zoom = 0.01) {
  const b = [p.lon - zoom, p.lat - zoom * 0.7, p.lon + zoom, p.lat + zoom * 0.7].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${p.lat},${p.lon}`;
}
export const messagePosition = (prenom, lien) => `Bonjour${prenom ? " " + prenom : ""}, c'est Rebecca 🚗 Je suis en route : vous pouvez suivre ma voiture en direct ici : ${lien}`;
