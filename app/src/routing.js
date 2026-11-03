// ADRESSES ET DISTANCES - fournisseur gratuit par defaut (Photon + OSRM, sans cle).
// Le moteur de prix ne depend PAS du fournisseur : on pourra passer a Google Maps ou
// OpenRouteService en ne changeant que ce fichier. Aucune cle secrete ne doit etre ecrite ici.

const PHOTON = "https://photon.komoot.io/api/";
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
// Zone de recherche : Israel (ouest, sud, est, nord)
const BBOX = "34.2,29.4,35.9,33.4";

export async function chercherAdresses(texte, signal) {
  const q = (texte || "").trim();
  if (q.length < 3) return [];
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=6&lat=32.32&lon=34.85&bbox=${BBOX}`;
  const rep = await fetch(url, { signal });
  if (!rep.ok) throw new Error("Recherche d'adresse indisponible");
  const data = await rep.json();
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const rue = [p.name, p.housenumber && p.street ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean);
    const label = [...new Set([...rue, p.district, p.city || p.town || p.village || p.county])].filter(Boolean).join(", ");
    return { label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
  }).filter((a) => a.label);
}

// Distance routiere reelle (km) et duree (minutes) entre deux points
export async function calculerTrajet(depart, arrivee, signal) {
  const url = `${OSRM}${depart.lon},${depart.lat};${arrivee.lon},${arrivee.lat}?overview=false`;
  const rep = await fetch(url, { signal });
  if (!rep.ok) throw new Error("Calcul d'itinéraire indisponible");
  const data = await rep.json();
  const r = data.routes && data.routes[0];
  if (!r) throw new Error("Aucun itinéraire trouvé");
  return {
    km: Math.round((r.distance / 1000) * 10) / 10,
    // OSRM ne connait pas la circulation : on majore la duree de 15 % (marge prudente)
    minutes: Math.max(5, Math.round((r.duration / 60) * 1.15)),
    source: "OSRM",
  };
}
