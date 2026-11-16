// SUIVI DES VOLS (17 nov. 2026) - regles pures (aucun acces internet ici) - Rebecca Services
// Rebecca : « Pour une cliente aeroport, avec le numero de vol, la date et l'heure, je veux voir dans ma journee le
// terminal, si je dois l'amener ou la recuperer, si le vol est a l'heure ou retarde, et de combien de temps. »
// Source : tableau officiel des vols de l'aeroport Ben Gourion (Autorite des aeroports d'Israel, data.gov.il),
// gratuit, sans cle, mis a jour toutes les 15 minutes environ. Il ne contient que les vols proches (hier a demain).
// Champs du tableau : CHOPER (compagnie), CHFLTN (numero), CHOPERD (nom de la compagnie), CHSTOL (heure prevue),
// CHPTOL (heure mise a jour), CHAORD (A = arrivee, D = depart), CHLOCCT (ville), CHTERM (terminal), CHRMINE (etat).

export const RESSOURCE_VOLS = "e83f763b-b7d7-479e-b172-ae981ddc6de5";
export const TABLEAU_AEROPORT = "https://www.iaa.gov.il/airports/ben-gurion/flight-board/";
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_OK = /^\d{2}:\d{2}$/;

// « ly 001 », « LY-001 », « T03453 » (zero tape a la place du O) -> { compagnie: "LY", numero: "001" } ; sinon null
export function lireNumeroVol(texte) {
  const t = String(texte || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let m = /^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/.exec(t);
  if (m && /[A-Z]/.test(m[1])) return { compagnie: m[1], numero: m[2] };
  m = /^([A-Z]{3})(\d{1,4})[A-Z]?$/.exec(t); // code a 3 lettres (ELY315) : on ne garde que le numero
  if (m) return { compagnie: "", numero: m[2] };
  m = /^(\d{1,4})$/.exec(t);
  return m ? { compagnie: "", numero: m[1] } : null;
}

// Ecritures possibles du numero dans le tableau (avec ou sans zeros devant)
export function numerosPossibles(numero) {
  const n = String(numero || "").replace(/\D/g, "");
  if (!n) return [];
  const court = n.replace(/^0+/, "") || "0";
  return [...new Set([n, court, court.padStart(3, "0"), court.padStart(4, "0")])];
}

// Adresse de la recherche d'un vol dans le tableau de l'aeroport
export function adresseRecherche(numero) {
  const filtres = JSON.stringify({ CHFLTN: numerosPossibles(numero) });
  return `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESSOURCE_VOLS}&limit=100&filters=${encodeURIComponent(filtres)}`;
}

// « 2026-11-17T14:35:00 » -> minutes depuis une origine fixe (heure d'Israel, telle qu'ecrite dans le tableau)
const minutesDe = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null;
};
const memeCompagnie = (a, b) => String(a || "").toUpperCase().replace(/0/g, "O") === String(b || "").toUpperCase().replace(/0/g, "O");

// Ce qu'il faut suivre pour une course aeroport (d = demande ; le retour d'un aller-retour a son propre vol).
// -> { numero: { compagnie, numero }, texte, sens: "depart" | "arrivee", date, heure } ou null
export function volDeLaCourse(d) {
  if (!d || d.service !== "aeroport") return null;
  const v = d.details || {};
  const retour = !!d.estRetour;
  const texte = String((retour ? v.numeroVolRetour : v.numeroVol) || "").trim();
  const numero = lireNumeroVol(texte);
  if (!numero || !DATE_OK.test(d.date || "")) return null;
  const versAeroport = v.direction !== "depuis";
  const sens = (retour ? !versAeroport : versAeroport) ? "depart" : "arrivee";
  const heureVol = retour ? v.heureVolRetour : v.heureVol;
  const ville = String((retour ? v.villeVolRetour : v.villeVol) || "").trim().slice(0, 60);
  return { numero, texte, sens, ville, date: d.date, heure: HEURE_OK.test(heureVol || "") ? heureVol : HEURE_OK.test(d.heure || "") ? d.heure : "12:00" };
}

// Choisit la bonne ligne du tableau : bon sens, bonne compagnie, heure prevue la plus proche (14 h d'ecart au plus)
export function choisirVol(lignes, vol) {
  if (!vol || !Array.isArray(lignes)) return null;
  const cible = minutesDe(`${vol.date}T${vol.heure}`);
  const lettre = vol.sens === "depart" ? "D" : "A";
  const numeros = numerosPossibles(vol.numero.numero);
  let mieux = null;
  for (const l of lignes) {
    if (!l || String(l.CHAORD || "").toUpperCase() !== lettre) continue;
    if (!numeros.includes(String(l.CHFLTN || "").trim())) continue;
    if (vol.numero.compagnie && !memeCompagnie(l.CHOPER, vol.numero.compagnie)) continue;
    const prevu = minutesDe(l.CHSTOL);
    if (prevu == null || cible == null) continue;
    const ecart = Math.abs(prevu - cible);
    if (ecart <= 14 * 60 && (!mieux || ecart < mieux.ecart)) mieux = { l, ecart };
  }
  return mieux ? mieux.l : null;
}

const ETATS = {
  "ON TIME": "à l'heure",
  DELAYED: "retardé",
  EARLY: "en avance",
  LANDED: "atterri",
  DEPARTED: "décollé",
  CANCELED: "annulé",
  CANCELLED: "annulé",
  FINAL: "heure définitive",
  "NOT FINAL": "heure non définitive",
  BOARDING: "embarquement",
  "LAST CALL": "dernier appel",
  "GATE CLOSED": "porte fermée",
  "CHECK IN": "enregistrement ouvert",
};
const heureDe = (iso) => {
  const m = /[T ](\d{2}):(\d{2})/.exec(String(iso || ""));
  return m ? `${m[1]}:${m[2]}` : "";
};
// « TEL AVIV-YAFO » -> « Tel Aviv-Yafo » (les villes du tableau sont en majuscules)
export const nomVille = (x) => String(x || "").trim().toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
// Ville affichee : celle saisie par Rebecca, sinon celle du tableau de l'aeroport. « vers Paris » / « depuis Lyon »
export const villeDuVol = (vol, info) => {
  const ville = (vol && vol.ville) || nomVille(info && info.ville);
  return ville ? `${vol.sens === "depart" ? "vers" : "depuis"} ${ville}` : "";
};
export const dureeFr = (min) => {
  const m = Math.abs(Math.round(min));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? " " + String(m % 60).padStart(2, "0") : ""}`;
};

// Resume pour l'ecran. ligne = ligne du tableau (ou null) ; vol = volDeLaCourse(d).
// -> { trouve, sens, action, terminal, prevu, nouvelle, ecartMinutes, etat, alerte, texte }
export function etatDuVol(ligne, vol) {
  const action = vol.sens === "depart" ? "À déposer à l'aéroport" : "À récupérer à l'aéroport";
  if (!ligne) return { trouve: false, sens: vol.sens, action, texte: action };
  const prevu = minutesDe(ligne.CHSTOL);
  const maj = minutesDe(ligne.CHPTOL);
  const ecart = prevu != null && maj != null ? maj - prevu : 0;
  const brut = String(ligne.CHRMINE || "").trim().toUpperCase();
  const annule = /CANCEL/.test(brut);
  let etat;
  if (annule) etat = "Vol annulé";
  else if (ecart >= 5) etat = `Retard de ${dureeFr(ecart)}`;
  else if (ecart <= -5) etat = `En avance de ${dureeFr(ecart)}`;
  else etat = "À l'heure";
  const suite = ETATS[brut] && !["à l'heure", "retardé", "en avance", "annulé"].includes(ETATS[brut]) ? ETATS[brut] : "";
  const terminal = String(ligne.CHTERM ?? "").trim();
  const mot = vol.sens === "depart" ? "décollage" : "atterrissage";
  const heures = Math.abs(ecart) >= 5 && !annule ? `${mot} ${heureDe(ligne.CHPTOL)} au lieu de ${heureDe(ligne.CHSTOL)}` : `${mot} ${heureDe(ligne.CHSTOL)}`;
  return {
    trouve: true,
    sens: vol.sens,
    action,
    terminal,
    prevu: heureDe(ligne.CHSTOL),
    nouvelle: heureDe(ligne.CHPTOL),
    ecartMinutes: ecart,
    etat,
    suite,
    alerte: annule || ecart >= 5,
    compagnie: String(ligne.CHOPERD || "").trim(),
    ville: String(ligne.CHLOCCT || "").trim(),
    texte: [action, terminal ? `Terminal ${terminal}` : "", etat, heures, suite].filter(Boolean).join(" · "),
  };
}

// Le tableau de l'aeroport ne contient un vol qu'a partir de la veille : inutile de chercher avant
export function volConsultable(vol, aujourdhui) {
  if (!vol || !DATE_OK.test(aujourdhui || "")) return false;
  const jours = (minutesDe(`${vol.date}T00:00`) - minutesDe(`${aujourdhui}T00:00`)) / 1440;
  return jours >= -1 && jours <= 1;
}
