import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { aEnvoyer, positionPropre } from "./pricing/positionDirect.js";

// SUIVI EN DIRECT DU RAMASSAGE (19 nov. 2026, 14h10) - Rebecca : « quand je préviens Alexia, il n'y a pas la
// localisation en direct pour elle ». « 💬 Prévenir » d'une prise d'enfants lance le partage de position vers un lien
// propre à la famille et au jour (#/position/ID, impossible à deviner) ; « ✓ Fait » sur la dépose l'arrête et l'efface.
// Une seule écoute GPS pour toutes les familles suivies en même temps. Arrêt automatique au bout de 90 minutes.
// Comme pour les courses : sur iPhone, l'appli doit rester ouverte (support voiture).
const DUREE_MAX = 90 * 60000;
const actifs = new Map(); // id -> début (ms)
let veille = null;
let dernier = { p: null, t: 0 };

const cle = (date, famille) => `rs-suivi-${date}-${famille}`;
const nouvelId = () => "r" + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);

// Le lien d'une famille pour ce jour (créé une fois, gardé dans le téléphone)
export function idSuivi(date, famille) {
  try {
    const k = cle(date, famille);
    let id = localStorage.getItem(k);
    if (!/^[A-Za-z0-9_-]{6,60}$/.test(id || "")) {
      id = nouvelId();
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "";
  }
}

function ecrire(p) {
  const maintenant = Date.now();
  for (const [id, debut] of [...actifs]) {
    if (maintenant - debut > DUREE_MAX) {
      actifs.delete(id);
      deleteDoc(doc(db, "positions", id)).catch(() => {});
      continue;
    }
    setDoc(doc(db, "positions", id), { ...p, prenom: "Rebecca", actif: true, majLe: serverTimestamp() }).catch(() => {});
  }
  if (!actifs.size) couper();
}
function couper() {
  if (veille != null && navigator.geolocation) navigator.geolocation.clearWatch(veille);
  veille = null;
  dernier = { p: null, t: 0 };
}

// À appeler dans le geste (toucher « Prévenir ») : l'iPhone demande la permission de localisation la 1re fois
export function demarrerSuivi(id) {
  if (!id || !navigator.geolocation) return false;
  actifs.set(id, Date.now());
  dernier = { p: null, t: 0 }; // envoyer tout de suite la 1re position pour ce nouveau lien
  const recu = (pos) => {
    const p = positionPropre({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    const t = Date.now();
    if (!aEnvoyer(dernier.p, p, t - dernier.t)) return;
    dernier = { p, t };
    ecrire(p);
  };
  const options = { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 };
  navigator.geolocation.getCurrentPosition(recu, () => {}, options); // la carte s'affiche tout de suite pour la famille
  if (veille == null) veille = navigator.geolocation.watchPosition(recu, () => {}, options);
  return true;
}

export function arreterSuivi(date, famille) {
  let id = "";
  try { id = localStorage.getItem(cle(date, famille)) || ""; } catch { id = ""; }
  if (!id) return;
  actifs.delete(id);
  deleteDoc(doc(db, "positions", id)).catch(() => {});
  if (!actifs.size) couper();
}
