// ENREGISTREMENT DES DEMANDES - Rebecca Services
// Une demande part dans la base (Firestore) + un e-mail de notification a Rebecca.
// Sans compte : seule la demande est enregistree (le client ne peut jamais la relire).
// Avec un compte verifie : la demande + son "suivi" (visible dans "Mon historique") + l'utilisation du code promo,
// le tout en UNE seule operation (tout passe ou rien ne passe). Respecte exactement les regles Firebase v6.1.
import { SERVICES, champsVisibles } from "./services.js";
import { lirePourboire, nettoyer, normaliserTelephone } from "./profil.js";
import { TARIFS } from "./pricing/config.js";

// Notification e-mail (EmailJS, plan gratuit). Ces trois codes sont publics : ils sont visibles dans le site.
const EMAILJS = { service: "service_apqztvn", modele: "template_g52zuwf", cle: "bdJTayNK-YJyKZ79V" };

const texte = (x, max) => String(x ?? "").slice(0, max);
const nombre = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const propre = (x, max) => texte(x, max).replace(/[<>]/g, "");
const CODE_OK = /^[A-Z0-9_-]{3,20}$/;

// Transforme une valeur de formulaire en donnee simple (Firestore refuse "undefined")
function simple(val) {
  if (val && typeof val === "object") {
    return { label: texte(val.label, 300), lat: nombre(val.lat), lon: nombre(val.lon) };
  }
  if (typeof val === "number" || typeof val === "boolean") return val;
  return texte(val, 1000);
}

// Code promo reellement applique par le moteur de prix (sinon null)
function promoAppliquee(devis) {
  const p = devis && devis.details && devis.details.promo;
  if (!p || p.statut !== "applique") return null;
  const code = String(p.code || "").trim().toUpperCase();
  const remise = Math.round(Number(p.reduction) || 0);
  if (!CODE_OK.test(code) || remise < 0 || remise > 100000) return null;
  return { code, remise };
}

// Construit le document "demande" (sans date : elle est ajoutee par le serveur).
// compte = { uid, remplace } quand le client est connecte avec un e-mail verifie (sinon null).
export function construireDemande(service, v, devis, route, message, compte = null) {
  const infos = SERVICES.find((s) => s.id === service);
  const details = {};
  for (const c of champsVisibles(service, v)) details[c.name] = simple(v[c.name]);
  if (v.promoActif && v.codePromo) details.codePromo = texte(v.codePromo, 50);

  const d = {
    service: texte(service, 40),
    serviceTitre: texte(infos ? infos.titre : service, 100),
    date: texte(v.date, 10),
    heure: texte(v.heure, 5),
    nom: texte(v.nom, 100).trim() || "Client",
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

  // Passager (reservation pour quelqu'un d'autre)
  if (v.pourAutrui && nettoyer(v.passagerNom, 80)) {
    d.passager = { nom: nettoyer(v.passagerNom, 80), telephone: normaliserTelephone(v.passagerTel).slice(0, 30) };
  }
  // Pourboire prevu par le client (100 % pour Rebecca, jamais reduit par un code)
  const tip = lirePourboire(v.pourboire, TARIFS.pourboire.max);
  if (!tip.erreur && tip.montant > 0) d.pourboire = tip.montant;

  // Champs reserves aux comptes verifies
  if (compte && compte.uid) {
    d.uid = compte.uid;
    if (compte.remplace) d.remplace = texte(compte.remplace, 40);
    const promo = promoAppliquee(devis);
    if (promo) {
      d.codePromo = promo.code;
      d.remise = promo.remise;
    }
  }
  return d;
}

// Le "suivi" visible par le client : copie des informations utiles de la demande
export function construireSuivi(d) {
  const s = {
    uid: d.uid,
    service: d.service,
    serviceTitre: d.serviceTitre,
    date: d.date,
    heure: d.heure,
    prixEstime: d.prixEstime,
    surDevis: d.surDevis,
    statut: "en attente",
    details: d.details,
  };
  for (const k of ["pourboire", "passager", "codePromo", "remise", "remplace"]) if (k in d) s[k] = d[k];
  return s;
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
  if (d.uid) lignes.push("Client avec compte");
  if (d.remplace) lignes.push("Remplace une demande précédente");
  if (d.pourboire) lignes.push("Pourboire prévu : " + d.pourboire + " ₪");
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

// Envoie la demande. Le code Firebase n'est charge qu'a ce moment-la. Renvoie l'identifiant de la demande.
// options.verrou = { date, cellules } pour un rendez-vous : le creneau est verrouille DANS la meme operation
// (agendaJours/rebecca__date). S'il vient d'etre pris, rien n'est enregistre et l'erreur porte le code « creneau-pris ».
export async function enregistrerDemande(demande, options = {}) {
  const [{ db }, fs] = await Promise.all([import("./firebase.js"), import("firebase/firestore")]);
  const { addDoc, collection, doc, runTransaction, serverTimestamp } = fs;

  // Sans compte : la demande seule (comme avant). L'e-mail et la base sont independants : si l'un echoue, l'autre part quand meme.
  // 13 nov. 2026 : un rendez-vous beaute SANS compte passe aussi par la transaction (verrou du creneau)
  if (!demande.uid && !(options.verrou && options.verrou.date)) {
    envoyerEmail(demande).catch(() => {});
    const ref = await addDoc(collection(db, "demandes"), { ...demande, creeLe: serverTimestamp() });
    return ref.id;
  }

  // Avec un compte (ou un rendez-vous a verrouiller) : demande + suivi si compte (+ code promo, + ancienne demande "remplacée") en une seule operation
  const ref = doc(collection(db, "demandes"));
  const suiviRef = doc(db, "suivi", ref.id);
  const usageRef = demande.codePromo ? doc(db, "utilisationsPromo", demande.codePromo + "__" + demande.uid) : null;
  const ancienRef = demande.remplace ? doc(db, "suivi", demande.remplace) : null;
  const verrou = options.verrou && options.verrou.date && Array.isArray(options.verrou.cellules) && options.verrou.cellules.length ? options.verrou : null;
  const agendaRef = verrou ? doc(db, "agendaJours", "rebecca__" + verrou.date) : null;

  await runTransaction(db, async (tx) => {
    // 1. Lectures d'abord (regle des transactions)
    const usage = usageRef ? await tx.get(usageRef) : null;
    const ancien = ancienRef ? await tx.get(ancienRef) : null;
    const agenda = agendaRef ? await tx.get(agendaRef) : null;
    if (agenda) {
      const prises = agenda.exists() ? agenda.data().cells || {} : {};
      if (verrou.cellules.some((c) => prises[c] === true)) throw Object.assign(new Error("Créneau déjà pris"), { code: "creneau-pris" });
    }
    // 2. Ecritures
    if (agendaRef) tx.set(agendaRef, { cells: Object.fromEntries(verrou.cellules.map((c) => [c, true])), majLe: serverTimestamp() }, { merge: true });
    tx.set(ref, { ...demande, creeLe: serverTimestamp() });
    if (demande.uid) tx.set(suiviRef, { ...construireSuivi(demande), creeLe: serverTimestamp(), majLe: serverTimestamp() });
    if (usageRef) {
      const deja = usage.exists() ? Number(usage.data().nombre) || 0 : 0;
      tx.set(usageRef, { code: demande.codePromo, uid: demande.uid, nombre: deja + 1, majLe: serverTimestamp() });
    }
    // L'ancienne demande n'est marquee "remplacée" que si elle est encore en attente
    if (ancien && ancien.exists() && ancien.data().statut === "en attente") {
      tx.update(ancienRef, { statut: "remplacée", majLe: serverTimestamp() });
    }
  });

  envoyerEmail(demande).catch(() => {});
  return ref.id;
}

// Message clair quand l'enregistrement est refuse (code promo epuise, compte bloque, connexion...)
export function messageEchec(e, demande) {
  const code = (e && e.code) || "";
  if (code === "creneau-pris") return "Ce créneau vient d'être pris. Choisissez-en un autre.";
  if (code === "permission-denied" && demande && demande.codePromo) {
    return "Ce code promo n'est plus utilisable sur votre compte. Retirez-le puis renvoyez la demande.";
  }
  if (code === "permission-denied") return "Votre demande n'a pas pu être enregistrée. Contactez Rebecca sur WhatsApp.";
  return "Enregistrement impossible pour le moment. Vérifiez la connexion puis réessayez.";
}
