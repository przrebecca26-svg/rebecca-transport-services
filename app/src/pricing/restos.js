// ESPACE RESTAURANT + BOUTON « EN LIGNE » (V2, 19 nov. 2026) - regles pures - Rebecca Services
// Decisions de Rebecca (19 nov., 16h25) :
//  - la commande arrive par les DEUX moyens : le lien prive du restaurant (#/resto/CLE) ET WhatsApp (Rebecca la saisit) ;
//  - le restaurant paie la livraison, avec un releve chaque semaine (dimanche -> samedi, paiement le dimanche) ;
//  - refus automatique si personne ne repond en 5 minutes ; personne en ligne = la commande ne part pas ;
//  - « En ligne » : Accepter (la livraison va dans le Calendrier) / Refuser / Passer a Jeremy ou a un coursier.
// Les courses du site restent prioritaires : la carte previent quand une course est deja prevue a cette heure-la.
import { contratDe, prixPro, semaineDe } from "./commercants.js";
import { duDe, encaisseDe } from "./finCourse.js";
import { telNormalise } from "./clients.js";

export const DELAI_REPONSE_MS = 5 * 60 * 1000;
const CLE_OK = /^[A-Za-z0-9]{20,40}$/;
const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const cents = (x) => Math.round(x * 100) / 100;

/* ---------- Lien prive du restaurant ---------- */
export const cleRestoValide = (cle) => CLE_OK.test(String(cle || ""));
export const lireLienResto = (hash) => {
  const m = /^#\/resto\/([A-Za-z0-9]{20,40})\/?$/.exec(String(hash || ""));
  return m ? m[1] : "";
};
export const lienResto = (cle, origine = "https://rebeccaservices.com") => `${origine}/#/resto/${cle}`;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
// Cle impossible a deviner (24 caracteres) : c'est le « mot de passe » du restaurant
export function nouvelleCleResto(hasard = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(hasard(24), (o) => ALPHABET[o % ALPHABET.length]).join("");
}

const adresseNette = (a) => {
  if (!a || typeof a !== "object" || !String(a.label || "").trim()) return null;
  const r = { label: String(a.label).trim().slice(0, 300) };
  if (typeof a.lat === "number" && typeof a.lon === "number" && Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180) {
    r.lat = a.lat;
    r.lon = a.lon;
  }
  return r;
};

// Ce que le restaurant voit de lui-meme (document restos/CLE) : nom, telephone, adresse de retrait, tarifs du contrat
export function restoDepuisFiche(f) {
  const c = contratDe(f);
  const adresse = adresseNette(f && f.domicile) || adresseNette(f && f.adresses && f.adresses[0] && f.adresses[0].adresse);
  return {
    nom: String((f && f.nom) || "").trim().slice(0, 60) || "Restaurant",
    telephone: String((f && f.telephone) || "").trim().slice(0, 20),
    adresse,
    tarifs: { jusqua3: c.jusqua3, de3a6: c.de3a6, enPlus: c.enPlus },
    moyen: c.moyen,
    ficheId: String((f && f.id) || "").slice(0, 40),
    actif: true,
  };
}

/* ---------- En ligne ---------- */
// « En ligne » ne compte que le jour ou Rebecca l'a mis (oublie le soir = hors ligne le lendemain)
export const enLigneActif = (etat, jour) => !!etat && etat.enLigne === true && etat.jour === jour;

// Le restaurant peut-il envoyer une commande maintenant ?
export function peutCommander({ resto, etat, jour, dispo }) {
  if (!resto || resto.actif === false) return { ok: false, raison: "Ce lien n'est plus actif. Contactez Rebecca sur WhatsApp." };
  if (dispo && dispo.ouvert === false) return { ok: false, raison: `${dispo.titre}. ${dispo.detail || ""}`.trim() };
  if (!enLigneActif(etat, jour)) return { ok: false, raison: "Rebecca n'est pas en ligne pour le moment : la commande ne peut pas partir. Réessayez plus tard ou écrivez-lui sur WhatsApp." };
  return { ok: true, raison: "" };
}

/* ---------- Commande ---------- */
// f : { client, telClient, adresse {label, lat?, lon?}, pretA "HH:MM", note }
export function validerCommande(f) {
  if (!String((f && f.client) || "").trim()) return "Indiquez le prénom du client.";
  if (!telNormalise(f.telClient)) return "Indiquez le téléphone du client.";
  if (!adresseNette(f.adresse)) return "Indiquez l'adresse de livraison.";
  if (!HEURE_OK.test(f.pretA || "")) return "Indiquez l'heure à laquelle la commande est prête.";
  if (String(f.note || "").length > 300) return "La note est trop longue (300 caractères au plus).";
  return "";
}
// Document a ecrire (creeLe ajoute au moment de l'ecriture). source : "lien" (le restaurant) ou "whatsapp" (Rebecca)
export function commandePropre(f, jour, source = "lien") {
  return {
    client: String(f.client).trim().slice(0, 60),
    telClient: String(f.telClient).trim().slice(0, 20),
    adresse: adresseNette(f.adresse),
    pretA: f.pretA,
    note: String(f.note || "").trim().slice(0, 300),
    jour,
    statut: source === "whatsapp" ? "acceptee" : "nouvelle",
    source: source === "whatsapp" ? "whatsapp" : "lien",
  };
}

const enMs = (t) => {
  if (!t) return null;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  const d = Date.parse(t);
  return Number.isFinite(d) ? d : null;
};
export const creeMs = (c) => enMs(c && c.creeLe);

// Statut affiche : une commande « nouvelle » sans reponse depuis 5 minutes est refusee automatiquement
export function etatCommande(c, maintenantMs) {
  if (!c) return "";
  if (c.statut !== "nouvelle") return c.statut || "";
  const t = creeMs(c);
  return t != null && maintenantMs - t >= DELAI_REPONSE_MS ? "expiree" : "nouvelle";
}
export function secondesRestantes(c, maintenantMs) {
  const t = creeMs(c);
  if (t == null) return Math.round(DELAI_REPONSE_MS / 1000);
  return Math.max(0, Math.ceil((t + DELAI_REPONSE_MS - maintenantMs) / 1000));
}
export const compteARebours = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const LIBELLES = {
  nouvelle: "⏳ En attente de réponse",
  acceptee: "✓ Acceptée",
  refusee: "✗ Refusée",
  expiree: "✗ Sans réponse en 5 minutes (refusée automatiquement)",
  annulee: "Annulée",
  livree: "✓ Livrée",
};

// Heure « prete a » proposee : maintenant + n minutes, arrondie aux 5 minutes
export function heurePlus(heureActuelle, n) {
  const m = /^(\d{2}):(\d{2})$/.exec(heureActuelle || "");
  if (!m) return "";
  const total = Math.min(23 * 60 + 55, Math.ceil((Number(m[1]) * 60 + Number(m[2]) + n) / 5) * 5);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ---------- Prix et livraison ---------- */
// Prix du contrat selon les km (null = au-dela de 6 km ou km inconnus : Rebecca tape le prix)
export const prixCommande = (tarifs, km) => prixPro(contratDe({ contratPro: tarifs || {} }), km);

// La livraison qui entre dans le Calendrier (meme forme qu'une course ajoutee a la main, source « manuel »).
// Le telephone est celui du RESTAURANT : elle compte dans son releve de la semaine (Repertoire -> fiche -> Finances).
export function demandeDepuisCommande(resto, c, { cle, id, prix, km = null, minutes = null }) {
  const details = {
    recuperation: adresseNette(resto.adresse) || { label: resto.nom },
    livraison: adresseNette(c.adresse),
    destinataire: c.client,
    telDestinataire: c.telClient,
    commandeResto: { cle, id },
  };
  if (c.note) details.instructions = c.note;
  const lignes = [
    `Commande du restaurant ${resto.nom} (${c.source === "whatsapp" ? "WhatsApp" : "lien privé"}).`,
    `Prête à ${String(c.pretA).replace(":", "h")}.`,
    `Récupération : ${details.recuperation.label}`,
    `Livraison : ${details.livraison ? details.livraison.label : ""}`,
    `Client : ${c.client} · ${c.telClient}`,
  ];
  if (c.note) lignes.push("", c.note);
  return {
    service: "livraison",
    serviceTitre: "Livraison",
    date: c.jour,
    heure: c.pretA,
    nom: resto.nom.slice(0, 100),
    telephone: resto.telephone || "000",
    moyenPaiement: ["Bit", "Revolut", "Espèces", "Virement"].includes(resto.moyen) ? resto.moyen : "Bit",
    prixEstime: null,
    prixFinal: cents(Number(prix)),
    surDevis: false,
    kmEstime: typeof km === "number" ? km : null,
    minutesEstimees: typeof minutes === "number" ? minutes : null,
    details,
    message: lignes.join("\n").slice(0, 5000),
    statut: "acceptee",
    source: "manuel",
  };
}

// Priorite aux courses du site : courses deja acceptees ce jour-la a moins d'une heure de l'heure « prete »
export function coursesProches(demandes = [], jour, heure, fenetreMin = 60) {
  const m = /^(\d{2}):(\d{2})$/.exec(heure || "");
  if (!m) return [];
  const t = Number(m[1]) * 60 + Number(m[2]);
  return demandes
    .filter((d) => d && d.date === jour && d.statut === "acceptee" && HEURE_OK.test(d.heure || "") && !(d.details && d.details.commandeResto))
    .filter((d) => Math.abs(Number(d.heure.slice(0, 2)) * 60 + Number(d.heure.slice(3)) - t) <= fenetreMin)
    .sort((a, b) => a.heure.localeCompare(b.heure));
}

/* ---------- Suivi et releve ---------- */
// Ce qu'il faut mettre a jour dans la commande quand la livraison avance (ou null)
export function majSuivi(c, demande, mouvements = []) {
  if (!c || !demande) return null;
  const maj = {};
  if (demande.statut === "terminee") {
    const du = duDe(demande);
    if (c.statut !== "livree") maj.statut = "livree";
    if (c.prix !== du) maj.prix = du;
    const paye = du > 0 && encaisseDe(mouvements, demande.id) >= du;
    if (!!c.payee !== paye) maj.payee = paye;
  } else if (demande.statut === "annulee" && c.statut === "acceptee") maj.statut = "annulee";
  else if (demande.statut === "acceptee" && typeof demande.prixFinal === "number" && c.prix !== demande.prixFinal) maj.prix = demande.prixFinal;
  return Object.keys(maj).length ? maj : null;
}

// Releve de la semaine, cote restaurant : ses livraisons faites (commandes « livree »)
export function releveResto(commandes = [], semaine) {
  if (!semaine) return null;
  const lignes = commandes
    .filter((c) => c && c.statut === "livree" && DATE_OK.test(c.jour || "") && c.jour >= semaine.debut && c.jour <= semaine.fin)
    .sort((a, b) => (a.jour + a.pretA).localeCompare(b.jour + b.pretA))
    .map((c) => ({ c, du: cents(Number(c.prix) || 0), paye: c.payee === true }));
  const du = cents(lignes.reduce((s, l) => s + l.du, 0));
  const paye = cents(lignes.filter((l) => l.paye).reduce((s, l) => s + l.du, 0));
  return { ...semaine, lignes, nb: lignes.length, du, paye, reste: cents(du - paye) };
}
export const semaineResto = (jour) => semaineDe(jour);

/* ---------- Messages ---------- */
const h = (x) => String(x || "").replace(":", "h");
// Notification sur le telephone de Rebecca
export function messageNotifResto(resto, c) {
  return {
    titre: `🍕 Commande ${String((resto && resto.nom) || "restaurant").slice(0, 40)}`,
    corps: [`Prête à ${h(c.pretA)}`, c.adresse && c.adresse.label, "Réponds en 5 min"].filter(Boolean).join(" · ").slice(0, 180),
    tag: `resto-${c.id || ""}`,
    lien: "/admin#/admin?onglet=commandes-resto", // 19 nov. 2026 : ouvre l'onglet « Commandes restaurants »
  };
}
// Message WhatsApp que le restaurant peut envoyer (et que Rebecca saisit ensuite)
export function messageWhatsAppResto(nomResto, f) {
  return [
    `Bonjour Rebecca, c'est ${nomResto} 🍕`,
    "Une livraison :",
    String(f.client || "").trim() ? `Client : ${String(f.client).trim()}${f.telClient ? " · " + String(f.telClient).trim() : ""}` : "",
    f.adresse && f.adresse.label ? `Adresse : ${f.adresse.label}` : "",
    f.pretA ? `Prête à ${h(f.pretA)}` : "",
    String(f.note || "").trim() ? `Note : ${String(f.note).trim()}` : "",
  ].filter(Boolean).join("\n");
}
// Message du lien, envoye au restaurant par WhatsApp
export const messageLienResto = (nom, lien) =>
  [
    `Bonjour ${nom},`,
    "Voici votre espace livraison Rebecca Services (gardez ce lien pour vous, c'est votre accès) :",
    lien,
    "Vous y envoyez vos commandes et suivez la réponse en direct (sans réponse en 5 minutes, la commande est refusée automatiquement : vous pouvez alors la confier à quelqu'un d'autre).",
    "Vous y voyez aussi le relevé de chaque semaine : livraisons, montant dû et payé.",
    "Astuce : sur iPhone, touchez Partager puis « Sur l'écran d'accueil » pour l'avoir comme une appli.",
    "Merci, Rebecca",
  ].join("\n");
