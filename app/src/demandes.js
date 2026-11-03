// Enregistrement des demandes dans la base (Firestore) + e-mail de notification a Rebecca.
// Le client peut CREER une demande, jamais la relire : seule Rebecca la voit (regles de securite).
import { SERVICES, champsVisibles } from "./services.js";

// Notification e-mail (EmailJS, plan gratuit). Ces trois codes sont publics : ils sont visibles dans le site.
const EMAILJS = { service: "service_apqztvn", modele: "template_g52zuwf", cle: "bdJTayNK-YJyKZ79V" };

const texte = (x, max) => String(x ?? "").slice(0, max);
const nombre = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const propre = (x, max) => texte(x, max).replace(/[<>]/g, "");

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

const jourLong = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

// Envoie l'e-mail de notification a Rebecca (le destinataire est fixe dans le modele EmailJS)
export async function envoyerEmail(d) {
  const lignes = String(d.message || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i) => l && i > 0 && !/^(Nom|Téléphone|Paiement prévu|Estimation|Prix) :/.test(l) && !/^Merci de me confirmer/.test(l));
  const prix = d.surDevis ? "Sur devis" : typeof d.prixEstime === "number" ? d.prixEstime + " ₪" : "À confirmer";
  const reponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS.service,
      template_id: EMAILJS.modele,
      user_id: EMAILJS.cle,
      template_params: {
        service: propre(d.serviceTitre, 100),
        date: propre(jourLong(d.date), 60),
        heure: propre(d.heure, 5),
        nom: propre(d.nom, 100),
        telephone: propre(d.telephone, 30),
        paiement: propre(d.moyenPaiement, 30),
        prix,
        resume: propre(lignes.join(" | "), 1500),
      },
    }),
  });
  if (!reponse.ok) throw new Error("E-mail refuse : " + reponse.status);
}

// Envoie la demande a Firestore. Le code Firebase n'est charge qu'a ce moment-la.
export async function enregistrerDemande(demande) {
  // L'e-mail et la base sont independants : si l'un echoue, l'autre part quand meme
  envoyerEmail(demande).catch(() => {});
  const [{ db }, { addDoc, collection, serverTimestamp }] = await Promise.all([import("./firebase.js"), import("firebase/firestore")]);
  const ref = await addDoc(collection(db, "demandes"), { ...demande, creeLe: serverTimestamp() });
  return ref.id;
}
