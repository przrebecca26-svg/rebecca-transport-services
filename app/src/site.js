// ADRESSE DU SITE (18 nov. 2026) : utilisée dans les liens envoyés aux clientes (WhatsApp, e-mails).
// Le jour où Rebecca branche son nom de domaine, les liens prennent automatiquement la nouvelle adresse
// (celle du site ouvert dans le navigateur). Hors navigateur (tests, robot) : l'adresse officielle.
// 18 nov. 2026 : nom de domaine achete -> rebeccaservices.com (l'ancienne adresse Netlify y renvoie toute seule)
export const SITE_OFFICIEL = "https://rebeccaservices.com";
export const SITE_NETLIFY = SITE_OFFICIEL; // ancien nom, garde pour ne rien casser
const origine = typeof window !== "undefined" && window.location ? window.location.origin : "";
// les aperçus Netlify (deploy-preview--, branche--) et l'ordinateur de test gardent l'adresse officielle
export const SITE = /^https:\/\/[^/]+$/.test(origine) && !/--|localhost/.test(origine) ? origine : SITE_OFFICIEL;
