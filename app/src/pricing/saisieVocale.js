// SAISIE VOCALE V1 (19 nov. 2026) - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// Rebecca dicte une phrase (micro du clavier de l'iPhone, ou bouton « Parler » quand le telephone le permet) :
//   « J'ai encaissé 85 shekels en espèces, 5 de pourboire » · « plein d'essence de 240 » · « péage 15 shekels »
//   « rendez-vous personnel demain à 10 heures »
// L'appli comprend la phrase et REMPLIT le formulaire deja ouvert. Rien n'est jamais enregistre tout seul :
// Rebecca relit puis touche le bouton habituel (Valider le paiement, Enregistrer…). Aucune IA payante.

const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

// Nombres ecrits en lettres que la dictee de l'iPhone laisse parfois (« cinq », « vingt »)
const UNITES = { zero: 0, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100 };
function lettresEnChiffres(t) {
  return t.replace(/\b(zero|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent)\b/g, (m) => String(UNITES[m]));
}

// Prepare le texte : minuscules, sans accents, « 85,50 » -> « 85.50 », « 1 200 » -> « 1200 »
export function normaliser(texte) {
  let t = sansAccent(texte);
  t = lettresEnChiffres(t);
  t = t.replace(/(\d)\s(?=\d{3}\b)/g, "$1");
  t = t.replace(/(\d),(\d{1,2})\b/g, "$1.$2");
  t = t.replace(/₪/g, " shekels ").replace(/\b(nis|ils|sh|shekel|shekels|chekels?|sheqels?|shequels?)\b/g, " shekels ");
  return t.replace(/\s+/g, " ").trim();
}

const MOYENS = [
  { m: "Espèces", re: /\b(especes?|cash|liquide|en main propre|billets?)\b/ },
  { m: "Bit", re: /\b(bit|beat|bitte)\b/ },
  { m: "Revolut", re: /\b(revolut|revolute|revolution)\b/ },
  { m: "PayPal", re: /\b(paypal|pay pal)\b/ },
  { m: "Carte bancaire", re: /\b(carte bancaire|carte bleue|carte de credit|cb|par carte)\b/ },
  { m: "Virement", re: /\b(virement|transfert bancaire)\b/ },
  { m: "Carte cadeau", re: /\b(carte cadeau)\b/ },
];
export const moyenDe = (t) => (MOYENS.find((x) => x.re.test(t)) || {}).m || "";

const NOMBRE = /(\d+(?:\.\d{1,2})?)/;
const nombre = (s) => Math.round(Number(s) * 100) / 100;

// Montant suivi ou precede d'un mot cle (« 5 de pourboire », « pourboire de 5 », « pourboire 5 »)
function montantPres(t, mots) {
  const m = `(?:${mots})`;
  const apres = new RegExp(`${NOMBRE.source}\\s*(?:shekels?\\s*)?(?:de |d |en )?${m}`).exec(t);
  if (apres) return { valeur: nombre(apres[1]), index: apres.index, fin: apres.index + apres[0].length };
  const avant = new RegExp(`${m}\\s*(?:de |d |:|a |=)?\\s*${NOMBRE.source}`).exec(t);
  if (avant) return { valeur: nombre(avant[1]), index: avant.index, fin: avant.index + avant[0].length };
  return null;
}
// Tous les nombres du texte, sauf ceux deja pris
function nombresLibres(t, pris = []) {
  const res = [];
  const re = /\d+(?:\.\d{1,2})?/g;
  let x;
  while ((x = re.exec(t))) {
    const debut = x.index;
    const fin = debut + x[0].length;
    if (pris.some((p) => debut >= p.index && fin <= p.fin)) continue;
    res.push({ valeur: nombre(x[0]), index: debut });
  }
  return res;
}

// ENCAISSEMENT d'une course : { recu, pourboire, ajout, moyen } (textes, comme le formulaire) ou { erreur }
export function comprendreEncaissement(texte) {
  const t = normaliser(texte);
  if (!t) return { erreur: "Dis ou écris ce que tu as reçu, par exemple : « 85 shekels en espèces, 5 de pourboire »." };
  const tip = montantPres(t, "pourboires?|tips?|tip");
  const ajout = montantPres(t, "supplements?|en plus pour|ajout");
  const remise = montantPres(t, "remise|reduction|deduction|deduis|je deduis|en moins");
  const pris = [tip, ajout, remise].filter(Boolean);
  const libres = nombresLibres(t, pris);
  const recu = libres.length ? libres[0].valeur : 0;
  const moyen = moyenDe(t);
  if (!recu && !tip && !ajout && !remise) return { erreur: "Je n'ai pas trouvé de montant. Exemple : « 85 en espèces, 5 de pourboire »." };
  const r = { recu: recu ? String(recu) : "", pourboire: tip ? String(tip.valeur) : "", ajout: ajout ? String(ajout.valeur) : remise ? String(-remise.valeur) : "", moyen };
  return { ...r, resume: resumeEncaissement(r) };
}
export function resumeEncaissement(r) {
  return [
    r.recu ? `Reçu ${r.recu} ₪${r.moyen ? ` · ${r.moyen}` : " · moyen à choisir"}` : "",
    r.pourboire ? `Pourboire ${r.pourboire} ₪` : "",
    r.ajout ? `${Number(r.ajout) < 0 ? "Déduction" : "Ajout"} ${Math.abs(Number(r.ajout))} ₪` : "",
  ].filter(Boolean).join(" · ");
}

// PLEIN D'ESSENCE : { montant, litres, compteur } ou { erreur }
export function comprendrePlein(texte) {
  const t = normaliser(texte);
  const litres = montantPres(t, "litres?");
  const compteur = /(?:compteur|kilometrage|km au compteur)\D{0,12}(\d{3,7})/.exec(t) || /(\d{4,7})\s*(?:km|kilometres?)\b/.exec(t);
  const pris = [litres, compteur ? { index: compteur.index, fin: compteur.index + compteur[0].length } : null].filter(Boolean);
  const libres = nombresLibres(t, pris);
  const montant = libres.length ? libres[0].valeur : 0;
  if (!montant) return { erreur: "Je n'ai pas trouvé le montant du plein. Exemple : « plein de 240 shekels, 32 litres »." };
  const r = { montant: String(montant), litres: litres ? String(litres.valeur) : "", compteur: compteur ? compteur[1] : "" };
  return { ...r, resume: [`Plein ${r.montant} ₪`, r.litres ? `${r.litres} L` : "", r.compteur ? `compteur ${r.compteur} km` : ""].filter(Boolean).join(" · ") };
}

// DEPENSE : { categorie, montant, motif } ou { erreur } ; categories = celles des Depenses
export function comprendreDepense(texte, categories = ["Carburant", "Péages", "Stationnement", "Entretien du véhicule", "Autres frais"]) {
  const t = normaliser(texte);
  const libres = nombresLibres(t);
  const montant = libres.length ? libres[0].valeur : 0;
  if (!montant) return { erreur: "Je n'ai pas trouvé de montant. Exemple : « péage 15 shekels »." };
  const choix = [
    ["Péages", /\b(peage|kvish|route 6|autoroute)\b/],
    ["Stationnement", /\b(parking|stationnement|parcmetre|pango|cellopark)\b/],
    ["Carburant", /\b(essence|plein|carburant|gasoil|diesel)\b/],
    ["Entretien du véhicule", /\b(garage|entretien|pneus?|vidange|lavage|reparation|revision|test)\b/],
  ].find(([, re]) => re.test(t));
  const categorie = choix && categories.includes(choix[0]) ? choix[0] : categories.includes("Autres frais") ? "Autres frais" : categories[categories.length - 1];
  const motif = String(texte || "").trim().slice(0, 200);
  return { categorie, montant: String(montant), motif, resume: `${categorie} · ${montant} ₪` };
}

// DATE ET HEURE (« demain à 10 heures », « jeudi 14h30 », « le 25 ») a partir du jour J (AAAA-MM-JJ)
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const plusJours = (jour, n) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function comprendreDateHeure(texte, aujourdhui) {
  const t = normaliser(texte);
  let date = "";
  if (/\bapres demain\b/.test(t)) date = plusJours(aujourdhui, 2);
  else if (/\bdemain\b/.test(t)) date = plusJours(aujourdhui, 1);
  else if (/\baujourd hui\b|\bce (matin|soir|midi)\b|\bcet apres midi\b/.test(t)) date = aujourdhui;
  else {
    const j = JOURS.findIndex((x) => new RegExp(`\\b${x}\\b`).test(t));
    if (j >= 0) {
      const auj = new Date(aujourdhui + "T12:00:00Z").getUTCDay();
      date = plusJours(aujourdhui, ((j - auj + 7) % 7) || 7);
    } else {
      const n = /\b(?:le )?(\d{1,2})(?:er)?(?:\/(\d{1,2}))?\b(?!\s*(?:h|heures?|:))/.exec(t);
      if (n && Number(n[1]) >= 1 && Number(n[1]) <= 31) {
        const [a, m] = aujourdhui.split("-").map(Number);
        let mo = n[2] ? Number(n[2]) : m;
        let an = a;
        if (!n[2] && Number(n[1]) < Number(aujourdhui.slice(8, 10))) mo += 1;
        if (mo > 12) { mo -= 12; an += 1; }
        date = `${an}-${String(mo).padStart(2, "0")}-${String(Number(n[1])).padStart(2, "0")}`;
      }
    }
  }
  let heure = "";
  const h = /\b(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/.exec(t);
  if (h && Number(h[1]) <= 23) {
    let hh = Number(h[1]);
    if (/\b(de l apres midi|du soir|ce soir)\b/.test(t) && hh < 12) hh += 12;
    heure = `${String(hh).padStart(2, "0")}:${h[2] || "00"}`;
  } else if (/\bmidi\b/.test(t) && !/\bapres midi\b/.test(t)) heure = "12:00";
  return { date, heure };
}

// Reconnaissance vocale du navigateur (Safari, Chrome) : disponible ou non
export const parleDisponible = () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
