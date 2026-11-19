// CARTE CADEAU (18 nov. 2026, suggestion validée) - regles pures - Rebecca Services
// Une cliente offre une carte (montant ou idée de prestation) ; elle paie (PayPal, Bit, Revolut, espèces) et prévient
// Rebecca d'un appui ; Rebecca confirme le paiement : la carte devient active, avec un code et un lien à offrir.
// Le jour de la course ou du rendez-vous, Rebecca encaisse avec « Carte cadeau » + le code : le solde baisse tout seul.
// Collection « cartesCadeaux » (règles v26) ; le lien #/cadeau/ID (identifiant impossible à deviner) montre la carte.
export const MONTANTS_CADEAU = [50, 100, 150, 200, 300];
export const IDEES_CADEAU = ["Au choix", "Transfert aéroport", "Soin Nails", "Coiffure", "Slim & Lift", "RegenX", "Boutique Epoxy", "Courses et livraisons", "Transport"];
export const MOYENS_CADEAU = ["PayPal", "Bit", "Revolut", "Espèces"];
export const MIN_CADEAU = 20;
// 19 nov. 2026, décision de Rebecca : valable sur TOUTES les activités, non remboursable, valable 1 an
// (à partir du jour où Rebecca confirme le paiement), utilisable en une ou plusieurs fois.
export const VALIDITE_MOIS = 12;
export const CONDITIONS_CADEAU = "Valable 1 an à partir de l'activation, sur toutes les activités Rebecca Services, en une ou plusieurs fois. Non remboursable, non échangeable contre de l'argent.";
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
// Date de fin de validité (AAAA-MM-JJ) : même jour, un an plus tard (29 février → 28 février)
export function dateExpiration(debut, mois = VALIDITE_MOIS) {
  if (!DATE_ISO.test(debut || "")) return "";
  const [a, m, j] = debut.split("-").map(Number);
  const total = m - 1 + mois;
  const an = a + Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const dernier = new Date(Date.UTC(an, mo, 0)).getUTCDate();
  return `${an}-${String(mo).padStart(2, "0")}-${String(Math.min(j, dernier)).padStart(2, "0")}`;
}
export const finValidite = (carte) => (carte && (carte.expireLe || dateExpiration(carte.payeeLe))) || "";
export const estExpiree = (carte, jour) => {
  const fin = finValidite(carte);
  return !!fin && DATE_ISO.test(jour || "") && jour > fin;
};
// Statut à afficher : une carte active dont la date est passée est « expirée »
export const statutAffiche = (carte, jour) => (carte && carte.statut === "active" && estExpiree(carte, jour) ? "expiree" : carte && carte.statut);
export const dateFrCadeau = (d) => (DATE_ISO.test(d || "") ? d.split("-").reverse().join("/") : "");
export const MAX_CADEAU = 5000;
const SITE = "https://rebeccaservices.com";
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genererCode(alea = Math.random) {
  const bloc = () => Array.from({ length: 4 }, () => LETTRES[Math.floor(alea() * LETTRES.length)]).join("");
  return `RS-${bloc()}-${bloc()}`;
}
export const CODE_OK = /^RS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const normaliserCode = (t) => {
  const x = String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const y = x.startsWith("RS") ? x.slice(2) : x;
  return y.length === 8 ? `RS-${y.slice(0, 4)}-${y.slice(4)}` : String(t || "").toUpperCase().trim();
};

export function validerCarte(f) {
  const e = {};
  const m = Number(String(f.montant || "").replace(",", "."));
  if (!(m >= MIN_CADEAU && m <= MAX_CADEAU)) e.montant = `Choisissez un montant entre ${MIN_CADEAU} et ${MAX_CADEAU} ₪.`;
  if (!String(f.acheteurNom || "").trim()) e.acheteurNom = "Indiquez votre prénom.";
  if (String(f.acheteurTel || "").replace(/\D/g, "").length < 9) e.acheteurTel = "Indiquez votre téléphone.";
  if (!String(f.pourNom || "").trim()) e.pourNom = "Pour qui est ce cadeau ?";
  if (!MOYENS_CADEAU.includes(f.moyen)) e.moyen = "Choisissez comment vous payez.";
  return e;
}
export function nouvelleCarte(f, code) {
  const montant = Math.round(Number(String(f.montant).replace(",", ".")) * 100) / 100;
  return {
    statut: "a_payer",
    code,
    montant,
    solde: montant,
    idee: IDEES_CADEAU.includes(f.idee) ? f.idee : "Au choix",
    acheteurNom: String(f.acheteurNom).trim().slice(0, 60),
    acheteurTel: String(f.acheteurTel).trim().slice(0, 30),
    pourNom: String(f.pourNom).trim().slice(0, 60),
    pourTel: String(f.pourTel || "").trim().slice(0, 30),
    message: String(f.message || "").trim().slice(0, 300),
    moyen: f.moyen,
  };
}
export const lienCarte = (id) => `${SITE}/#/cadeau/${id}`;
export function lireLienCarte(hash) {
  const m = /^#\/cadeau\/([A-Za-z0-9]{10,40})$/.exec(String(hash || ""));
  return m ? m[1] : null;
}
export const STATUTS_CADEAU = { a_payer: "En attente du paiement", paiement_annonce: "Paiement annoncé, à confirmer", active: "Active", utilisee: "Entièrement utilisée", annulee: "Annulée", expiree: "Expirée (plus d'un an)" };

// Utiliser une carte pour une course : { solde, utilisations, statut } ou { erreur }
export function utiliserCarte(carte, montant, quand, resId = "") {
  const m = Math.round(Number(montant) * 100) / 100;
  if (!carte || carte.statut !== "active") return { erreur: "Cette carte cadeau n'est pas active." };
  if (estExpiree(carte, quand)) return { erreur: `Cette carte cadeau a expiré le ${dateFrCadeau(finValidite(carte))} (validité 1 an).` };
  if (!(m > 0)) return { erreur: "Montant invalide." };
  const solde = Math.round((Number(carte.solde) || 0) * 100) / 100;
  if (m > solde) return { erreur: `Solde insuffisant : il reste ${solde} ₪ sur cette carte.` };
  const reste = Math.round((solde - m) * 100) / 100;
  return { solde: reste, statut: reste === 0 ? "utilisee" : "active", utilisations: [...(carte.utilisations || []), { montant: m, quand, resId: String(resId).slice(0, 100) }].slice(-50) };
}
export function messageOffrir(carte, id) {
  return [
    `🎁 Coucou ${carte.pourNom} !`,
    `${carte.acheteurNom} t'offre une carte cadeau Rebecca Services de ${carte.montant} ₪${carte.idee && carte.idee !== "Au choix" ? ` (${carte.idee})` : ""}.`,
    carte.message ? `« ${carte.message} »` : "",
    `Ta carte : ${lienCarte(id)}`,
    `Ton code : ${carte.code} (à donner à Rebecca au moment de payer).`,
    finValidite(carte) ? `Valable jusqu'au ${dateFrCadeau(finValidite(carte))}, sur toutes les activités.` : "Valable 1 an, sur toutes les activités.",
    "Réserve sur rebeccaservices.com ou sur WhatsApp au 054-738-0193.",
  ].filter(Boolean).join("\n");
}

// Champs enregistrés quand Rebecca confirme le paiement
export const champsActivation = (jour) => ({ statut: "active", payeeLe: jour, expireLe: dateExpiration(jour) });
