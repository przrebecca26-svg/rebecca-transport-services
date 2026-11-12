// ADRESSES ET DISTANCES - fournisseur gratuit par defaut (Photon + OSRM, sans cle).
// Le moteur de prix ne depend PAS du fournisseur : on pourra passer a Google Maps ou
// OpenRouteService en ne changeant que ce fichier. Aucune cle secrete ne doit etre ecrite ici.

const PHOTON = "https://photon.komoot.io/api/";
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
// Zone de recherche : Israel (ouest, sud, est, nord)
const BBOX = "34.2,29.4,35.9,33.4";

// Netanya : les adresses proches passent en premier (12 nov. 2026 : « School uziel netanya » ne proposait que
// des ecoles Uziel d'autres villes).
const CENTRE = { lat: 32.32, lon: 34.85 };
const RAYON_PROCHE_KM = 12;
const MOTS_GENERIQUES = /(^|\s)(school|ecole|école|college|collège|lycee|lycée|gan|בית ספר|ביה"ס|בי"ס|גן)(?=\s|$)/gi;

export const distanceKm = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

// Adresses proches de Netanya d'abord (dans l'ordre trouve), puis les autres ; sans doublon ; 8 au maximum
export function classerAdresses(liste) {
  const vues = new Set();
  const uniques = liste.filter((a) => a && a.label && !vues.has(a.label) && vues.add(a.label));
  const proche = (a) => distanceKm(CENTRE, a) <= RAYON_PROCHE_KM;
  return [...uniques.filter(proche), ...uniques.filter((a) => !proche(a))].slice(0, 8);
}

async function photon(q, signal) {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=15&lat=${CENTRE.lat}&lon=${CENTRE.lon}&bbox=${BBOX}`;
  const rep = await fetch(url, { signal });
  if (!rep.ok) throw new Error("Recherche d'adresse indisponible");
  const data = await rep.json();
  return (data.features || []).map(versAdresse).filter((a) => a.label);
}

/* ---------- Recherche Google (facultative) ----------
   12 nov. 2026, decision de Rebecca (« oui Google ») : le service gratuit ne connait ni les ecoles par leur nom, ni
   les rues ecrites en lettres latines, ni les numeros. Avec une cle Google (enregistree par Rebecca dans son espace,
   document reglages/google ; jamais ecrite dans le programme), la recherche passe par Google Places :
   nom d'une ecole ou d'un magasin, francais, anglais ou hebreu, numero de rue, point exact.
   Sans cle, ou si Google refuse (quota du jour atteint, panne), le service gratuit prend le relais tout seul.
   Cout maitrise : une « session » par adresse cherchee, et seulement l'adresse et le point demandes a la fin
   (tarif « Essentials »). */
const GOOGLE = "https://places.googleapis.com/v1/places";
let cleGoogle = "";
let sessionGoogle = "";
export function definirCleGoogle(cle) {
  cleGoogle = /^[A-Za-z0-9_-]{20,80}$/.test(String(cle || "").trim()) ? String(cle).trim() : "";
}
export const googleActif = () => !!cleGoogle;
const nouvelleSession = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s${Date.now()}${Math.round(Math.random() * 1e9)}`.slice(0, 36));
const sansPays = (label) => String(label || "").replace(/,\s*(Israël|Israel|ישראל)\s*$/i, "").trim();

// Reponse de Google (suggestions) -> [{ label, placeId, session }]
export function lireSuggestionsGoogle(data, session) {
  return ((data && data.suggestions) || [])
    .map((x) => x && x.placePrediction)
    .filter((p) => p && p.placeId && p.text && p.text.text)
    .slice(0, 6)
    .map((p) => ({ label: sansPays(p.text.text), placeId: p.placeId, session }));
}

// Reponse de Google (detail d'un lieu) -> { label, lat, lon } ; le nom du lieu choisi est garde devant l'adresse
export function lireDetailGoogle(data, suggestion) {
  const loc = data && data.location;
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") return null;
  const adresse = sansPays(data.formattedAddress);
  const nom = String(suggestion.label || "").split(",")[0].trim();
  const label = !adresse ? suggestion.label : nom && !adresse.toLowerCase().includes(nom.toLowerCase()) && !/\d/.test(nom) ? `${nom}, ${adresse}` : adresse;
  return { label, lat: loc.latitude, lon: loc.longitude };
}

async function google(q, signal) {
  if (!sessionGoogle) sessionGoogle = nouvelleSession();
  const rep = await fetch(`${GOOGLE}:autocomplete`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": cleGoogle },
    body: JSON.stringify({
      input: q,
      languageCode: "fr",
      includedRegionCodes: ["il"],
      locationBias: { circle: { center: { latitude: CENTRE.lat, longitude: CENTRE.lon }, radius: 30000 } },
      sessionToken: sessionGoogle,
    }),
  });
  if (!rep.ok) throw new Error("Recherche Google indisponible");
  return lireSuggestionsGoogle(await rep.json(), sessionGoogle);
}

// Suggestion choisie : si elle vient de Google, on demande son adresse exacte et son point (fin de la session)
export async function preciserAdresse(a, signal) {
  if (!a || !a.placeId) return a;
  const rep = await fetch(`${GOOGLE}/${encodeURIComponent(a.placeId)}?sessionToken=${encodeURIComponent(a.session || "")}&languageCode=fr`, {
    signal,
    headers: { "X-Goog-Api-Key": cleGoogle, "X-Goog-FieldMask": "location,formattedAddress" },
  });
  sessionGoogle = "";
  if (!rep.ok) throw new Error("Adresse Google indisponible");
  const r = lireDetailGoogle(await rep.json(), a);
  if (!r) throw new Error("Adresse Google incomplète");
  return r;
}

export async function chercherAdresses(texte, signal) {
  const q = (texte || "").trim();
  if (q.length < 3) return [];
  if (cleGoogle && q.length >= 4) {
    try {
      const trouvees = await google(q, signal);
      if (trouvees.length) return trouvees;
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      // Google indisponible ou quota atteint : le service gratuit prend le relais
    }
  }
  let liste = await photon(q, signal);
  // Rien pres de Netanya : on reessaie sans les mots « ecole », « school », « gan »... (le nom de la rue suffit souvent)
  if (!liste.some((a) => distanceKm(CENTRE, a) <= RAYON_PROCHE_KM)) {
    const court = q.replace(MOTS_GENERIQUES, " ").replace(/\s+/g, " ").trim();
    if (court.length >= 3 && court !== q) {
      try {
        liste = [...liste, ...(await photon(court, signal))];
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
      }
    }
  }
  return classerAdresses(liste);
}

// NUMERO DE RUE (12 nov. 2026) : le service gratuit connait souvent la rue mais pas le numero. Si la personne a tape
// un numero qui n'est pas dans la suggestion choisie, on le garde dans l'adresse : « Rue X 10, quartier, ville ».
// Le point reste celui de la rue (suffisant pour le prix et les temps) ; Waze, lui, recoit l'adresse avec le numero.
export function avecNumero(adresse, texteTape) {
  if (!adresse || !adresse.label) return adresse;
  const m = String(texteTape || "").match(/(?:^|\s)(\d{1,4}[a-zA-Z\u05d0-\u05ea]?)(?=\s|,|$)/);
  if (!m) return adresse;
  const numero = m[1];
  if (/(^|[\s,])\d{1,4}[a-zA-Z\u05d0-\u05ea]?(?=[\s,]|$)/.test(adresse.label)) return adresse; // la suggestion a deja un numero
  const morceaux = adresse.label.split(",");
  morceaux[0] = `${morceaux[0].trim()} ${numero}`;
  // approx : le point est celui de la rue, pas de la porte (Waze recevra donc le texte avec le numero)
  return { ...adresse, label: morceaux.map((x, i) => (i === 0 ? x : x.trim())).join(", "), approx: true };
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

// Temps de route (minutes) entre plusieurs points, en UN seul appel : matrice[i][j] = de i vers j.
// Meme majoration prudente de 15 % que calculerTrajet (OSRM ne connait pas la circulation).
export async function calculerDurees(points, signal) {
  if (!points || points.length < 2) return [[0]];
  const url = `https://router.project-osrm.org/table/v1/driving/${points.map((p) => `${p.lon},${p.lat}`).join(";")}?annotations=duration`;
  const rep = await fetch(url, { signal });
  if (!rep.ok) throw new Error("Calcul d'itinéraire indisponible");
  const data = await rep.json();
  if (!data.durations) throw new Error("Aucun itinéraire trouvé");
  return data.durations.map((ligne) => ligne.map((s) => (typeof s === "number" ? Math.max(1, Math.round((s / 60) * 1.15)) : null)));
}
