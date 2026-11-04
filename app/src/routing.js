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
  return (data.features || []).map(versAdresse).filter((a) => a.label);
}

// Une reponse Photon -> { label, lat, lon }
function versAdresse(f) {
  const p = f.properties || {};
  const rue = [p.name, p.housenumber && p.street ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean);
  const label = [...new Set([...rue, p.district, p.city || p.town || p.village || p.county])].filter(Boolean).join(", ");
  return { label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
}

// ADRESSE DEPUIS LA POSITION (comme "partager ma position" sur WhatsApp).
// Si l'adresse exacte n'est pas trouvee, on garde quand meme les coordonnees GPS : le prix et le lien Waze fonctionnent.
export async function adresseDepuisPosition(lat, lon, signal) {
  const garde = { label: `Ma position (${lat.toFixed(5)}, ${lon.toFixed(5)})`, lat, lon };
  try {
    const rep = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&limit=1&lang=fr`, { signal });
    if (!rep.ok) return garde;
    const data = await rep.json();
    const f = (data.features || [])[0];
    if (!f) return garde;
    const a = versAdresse(f);
    // on garde le point GPS exact de la personne (pas celui du batiment trouve)
    return a.label ? { label: a.label, lat, lon } : garde;
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    return garde;
  }
}

// Position du telephone (demande l'autorisation au client). Rejette avec un message en francais.
export function positionActuelle() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("La localisation n'est pas disponible sur cet appareil."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e && e.code === 1
              ? "Autorisation refusée. Autorisez la localisation pour ce site dans les réglages de votre téléphone, ou tapez l'adresse."
              : "Position introuvable pour le moment. Réessayez ou tapez l'adresse."
          )
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
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
