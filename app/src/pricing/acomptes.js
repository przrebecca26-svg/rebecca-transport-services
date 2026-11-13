// ACOMPTE DE CHAQUE DEMANDE (13 nov. 2026) - regles pures
// Les reglages existaient (Reglages -> Activites : acompte de chaque activite ; catalogue : acompte de certaines
// prestations, ex. mariee 40 %, diagnostic RegenX 30 ₪ fixes) mais l'admin calculait toujours 20 %. Desormais :
// 1) la prestation (catalogue en base, sinon catalogue de depart) : acompte fixe ou pourcentage ;
// 2) sinon l'activite (Reglages -> Activites) ; 3) sinon 20 %, minimum 10 ₪.
import { ACTIVITES_DEPART, CATALOGUE_DEPART } from "./catalogue.js";
import { SERVICES } from "../services.js";

const ACT = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));
export const activiteDuService = (service) => ACT[service] || service;
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function reglesAcompte(d, { activites = [], catalogue = [] } = {}) {
  const act = activiteDuService(d && d.service);
  const a = activites.find((x) => x.id === act) || ACTIVITES_DEPART.find((x) => x.id === act) || {};
  const nom = d && d.details ? d.details.prestation || d.details.produit || "" : "";
  const enBase = nom ? catalogue.find((x) => x.activite === act && x.nom === nom) : null;
  const depart = nom ? CATALOGUE_DEPART.find((x) => x.activite === act && x.nom === nom) : null;
  const fixe = num(enBase && enBase.acompteFixe) ?? num(depart && depart.acompteFixe);
  const pct = num(enBase && enBase.acomptePourcent) ?? num(depart && depart.acomptePourcent) ?? num(Number(a.acomptePourcent)) ?? 20;
  const min = num(Number(a.acompteMin)) ?? 10;
  if (fixe != null) return { acomptePourcent: 0, acompteMinimum: fixe, libelle: `${fixe} ₪` };
  return { acomptePourcent: pct, acompteMinimum: min, libelle: `${pct} %` };
}
