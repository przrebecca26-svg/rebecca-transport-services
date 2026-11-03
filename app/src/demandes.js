// Enregistrement des demandes dans la base (Firestore).
// Le client peut CREER une demande, jamais la relire : seule Rebecca la voit (regles de securite).
import { SERVICES, champsVisibles } from "./services.js";

const texte = (x, max) => String(x ?? "").slice(0, max);
const nombre = (x) => (typeof x === "number" && isFinite(x) ? x : null);

// Transforme une valeur de formulaire en donnee simple (Firestore refuse "undefined")
function simple(val) {
  if (val && typeof val === "object") {
    return { label: texte(val.label, 300), lat: nombre(val.lat), lon: nombre(val.lon) };
  }
  if (typeof val === "number" || typeof val === "boolean") return val;
  return texte(val, 1000);
}

// Construit le document a enregistrer (sans date : elle est ajoutee par le serveur)
export function construireDemande(service, v, devis, route, message) {
  const infos = SERVICES.find((s) => s.id === service);
  const details = {};
  for (const c of champsVisibles(service, v)) details[c.name] = simple(v[c.name]);
  if (v.promoActif && v.codePromo) details.codePromo = texte(v.codePromo, 50);
  return {
    service: texte(service, 40),
    serviceTitre: texte(infos ? infos.titre : service, 100),
    date: texte(v.date, 10),
    heure: texte(v.heure, 5),
    nom: texte(v.nom, 100).trim(),
    telephone: texte(v.telephone, 30).trim(),
    moyenPaiement: texte(v.moyenPaiement, 30),
    prixEstime: devis && !devis.devis ? nombre(devis.total) : null,
    surDevis: !!(devis && devis.devis),
    kmEstime: route ? nombre(route.km) : null,
    minutesEstimees: route ? nombre(route.minutes) : null,
    details,
    message: texte(message, 5000),
    statut: "en attente",
    source: "site",
  };
}

// Envoie la demande a Firestore. Le code Firebase n'est charge qu'a ce moment-la.
export async function enregistrerDemande(demande) {
  const [{ db }, { addDoc, collection, serverTimestamp }] = await Promise.all([import("./firebase.js"), import("firebase/firestore")]);
  const ref = await addDoc(collection(db, "demandes"), { ...demande, creeLe: serverTimestamp() });
  return ref.id;
}
