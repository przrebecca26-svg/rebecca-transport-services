// FORMULE « LIVRAISON PARTENAIRE » (demandee par Rebecca le 25 nov. 2026, 21h42) - logique pure, sans Firebase.
// Testee dans tests/livraisonPartenaire.test.mjs.
//
// Regles de Rebecca :
//  - Referencement gratuit et Vitrine : tarif public. Business et Pack Pro : avantage de 5 ₪ par livraison eligible.
//  - Jusqu'a 3 km : 30 ₪ au lieu de 35 ₪ ; de 3 a 5 km : 35 ₪ au lieu de 40 ₪ ; au-dela de 5 km : grille normale.
//  - Abonnement professionnel actif et a jour ; tarif minimum 30 ₪ ; aucun volume minimum.
//  - Reduction seulement si la rentabilite prevue reste >= 60 ₪/h ; sinon tarif normal + alerte dans l'admin,
//    et Rebecca peut autoriser exceptionnellement la reduction.
//  - Supplements habituels maintenus (seul le prix de base baisse) ; non cumulable avec les promotions et le Prix ami.
//  - Les formules restaurants A et B, les tarifs publics et les regles Firebase ne changent pas.
// Parametres modifiables par Rebecca : admin/livraisonPartenaire (champ json), lu seulement par elle.
import { analyserRentabilite } from "./engine.js";
import { etatAbonnement } from "./pros.js";

// 26 nov. 2026, 00h51 (Rebecca, audit ChatGPT) : -10 % sur les livraisons jusqu'a 20 km, si la course reste a 40 ₪/h au moins.
// (Avant : prix fixes 30 / 35 ₪, devenus egaux au tarif public.) version 2 : les anciens reglages enregistres sont remplaces.
export const PARAMS_DEFAUT = {
  version: 2,
  actif: true,
  formules: ["business", "packpro"],
  pourcentage: 0.1,
  kmMax: 20,
  paliers: [],
  minimum: 20,
  seuilHeure: 40,
};

const nb = (x, min, max, defaut) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 100) / 100)) : defaut;
};
export function lireParams(json) {
  let v = null;
  try {
    v = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    v = null;
  }
  if (!v || typeof v !== "object") return { ...PARAMS_DEFAUT, paliers: PARAMS_DEFAUT.paliers.map((p) => ({ ...p })), formules: [...PARAMS_DEFAUT.formules] };
  // Reglages d'avant le 26 nov. (prix fixes 30 / 35 ₪) : on garde seulement « actif » et les formules
  if (v.version !== 2) return { ...PARAMS_DEFAUT, paliers: [], actif: v.actif !== false, formules: (Array.isArray(v.formules) ? v.formules : PARAMS_DEFAUT.formules).filter((f) => ["referencement", "vitrine", "business", "packpro"].includes(f)) };
  const paliers = (Array.isArray(v.paliers) ? v.paliers : PARAMS_DEFAUT.paliers)
    .map((p) => ({ kmMax: nb(p && p.kmMax, 0.5, 50, 0), prix: nb(p && p.prix, 0, 1000, 0) }))
    .filter((p) => p.kmMax > 0 && p.prix > 0)
    .sort((a, b) => a.kmMax - b.kmMax)
    .slice(0, 6);
  const formules = (Array.isArray(v.formules) ? v.formules : PARAMS_DEFAUT.formules).filter((f) => ["referencement", "vitrine", "business", "packpro"].includes(f));
  return {
    version: 2,
    actif: v.actif !== false,
    formules,
    pourcentage: nb(v.pourcentage, 0, 0.5, PARAMS_DEFAUT.pourcentage),
    kmMax: nb(v.kmMax, 0.5, 50, PARAMS_DEFAUT.kmMax),
    paliers,
    minimum: nb(v.minimum, 0, 1000, PARAMS_DEFAUT.minimum),
    seuilHeure: nb(v.seuilHeure, 0, 1000, PARAMS_DEFAUT.seuilHeure),
  };
}

// Le pro a-t-il droit a l'avantage aujourd'hui ? { ok, raison }
export function eligibilitePro(dossier, params, aujourdhui) {
  const p = params || PARAMS_DEFAUT;
  if (!dossier) return { ok: false, raison: "Aucun professionnel choisi." };
  if (!p.actif) return { ok: false, raison: "Formule « Livraison partenaire » désactivée dans tes réglages." };
  if (dossier.statut !== "accepte" || !dossier.actif) return { ok: false, raison: "Professionnel pas accepté ou suspendu : tarif public." };
  if (!p.formules.includes(dossier.formule)) return { ok: false, raison: "Sa formule (Référencement ou Vitrine) a le tarif public." };
  const ab = etatAbonnement(dossier.abonnement, aujourdhui);
  if (!ab.actif) return { ok: false, raison: "Abonnement professionnel pas en cours : tarif public." };
  if (ab.retard > 0) return { ok: false, raison: `Abonnement en retard (${ab.retard} mois) : tarif public.` };
  return { ok: true, raison: "" };
}

const ligneBase = (r) => (r.lignes || []).find((l) => l.base);

// Applique l'avantage a un devis deja calcule par engine.calculer().
// d = la demande envoyee au calculateur ; options : { dossier, params, aujourdhui, exception, prixAmi, t }
// Retour : { resultat, info } ; info.statut :
//   applique | exception | rentabilite (refusee, alerte) | non_eligible | hors_zone | non_cumulable | sans_objet
export function appliquerLivraisonPartenaire(r, d, { dossier, params, aujourdhui, exception = false, prixAmi = false, t } = {}) {
  const p = params || PARAMS_DEFAUT;
  const info = { proId: dossier ? dossier.id : "", nom: dossier ? dossier.nomCommercial || "" : "", statut: "sans_objet", raison: "", reduction: 0, prixPublic: r && typeof r.total === "number" ? r.total : null, prixPartenaire: null, gainHeure: null, gainHeurePublic: null, seuil: p.seuilHeure, exception: false };
  const fin = (statut, raison) => ({ resultat: r, info: { ...info, statut, raison } });
  if (!dossier) return { resultat: r, info: null };
  if (!r || !r.ok || r.bloque || r.devis || typeof r.total !== "number") return fin("sans_objet", "Prix sur devis : avantage à décider toi-même.");
  if (!d || d.service !== "livraison") return fin("hors_zone", "L'avantage partenaire ne concerne que les livraisons.");
  const elig = eligibilitePro(dossier, p, aujourdhui);
  if (!elig.ok) return fin("non_eligible", elig.raison);
  if (prixAmi) return fin("non_cumulable", "💛 Prix ami : non cumulable avec l'avantage partenaire.");
  if (r.details && r.details.promo && r.details.promo.statut === "applique") return fin("non_cumulable", "Code promo appliqué : non cumulable avec l'avantage partenaire.");
  const km = d.aller && Number(d.aller.km) >= 0 ? Number(d.aller.km) : null;
  const base = ligneBase(r);
  const enPourcent = p.pourcentage > 0;
  const palier = km == null ? null : enPourcent ? (km <= p.kmMax ? { prix: null } : null) : (p.paliers || []).find((x) => km <= x.kmMax);
  const kmLimite = enPourcent ? p.kmMax : p.paliers && p.paliers.length ? p.paliers[p.paliers.length - 1].kmMax : 5;
  if (!palier || !base) return fin("hors_zone", `Plus de ${kmLimite} km : grille normale du site.`);
  const prixPartenaire = Math.max(p.minimum, enPourcent ? base.montant - Math.round(base.montant * p.pourcentage * 2) / 2 : palier.prix);
  const reduction = Math.round((base.montant - prixPartenaire) * 100) / 100;
  if (!(reduction > 0)) return fin("hors_zone", "Le tarif public est déjà au tarif partenaire.");
  const total = Math.max(p.minimum, Math.ceil(r.total - reduction - 1e-9));
  const reductionReelle = Math.round((r.total - total) * 100) / 100;
  const aller = { km, minutes: d.aller.minutes || (km / 40) * 60 };
  const rentaPart = analyserRentabilite({ ...d, aller }, total, t);
  const rentaPublic = r.details && r.details.rentabilite ? r.details.rentabilite : analyserRentabilite({ ...d, aller }, r.total, t);
  const avec = { ...info, reduction: reductionReelle, prixPartenaire: total, gainHeure: rentaPart.gainNetHeure, gainHeurePublic: rentaPublic.gainNetHeure };
  if (rentaPart.gainNetHeure < p.seuilHeure && !exception) {
    return { resultat: r, info: { ...avec, reduction: 0, statut: "rentabilite", raison: `Rentabilité prévue ${rentaPart.gainNetHeure} ₪/h avec l'avantage (minimum ${p.seuilHeure} ₪/h) : tarif normal proposé.` } };
  }
  const lignes = [...r.lignes, { libelle: `Avantage partenaire ${info.nom ? `(${info.nom})` : ""}`.trim(), montant: -reductionReelle }];
  const details = { ...r.details, rentabilite: rentaPart, livraisonPartenaire: { proId: info.proId, reduction: reductionReelle } };
  const statut = rentaPart.gainNetHeure < p.seuilHeure ? "exception" : "applique";
  return {
    resultat: { ...r, lignes, total, details },
    info: { ...avec, statut, exception: statut === "exception", raison: statut === "exception" ? `Réduction autorisée exceptionnellement par toi (${rentaPart.gainNetHeure} ₪/h).` : `Tarif partenaire : ${total} ₪ au lieu de ${r.total} ₪.` },
  };
}

// Ce qui est enregistre sur la course (champ livraisonPartenaire) + le rattachement au pro (proPartenaire)
export function champsCourse(info, aujourdhui) {
  if (!info || !info.proId) return null;
  return {
    proPartenaire: info.proId,
    livraisonPartenaire: {
      proId: info.proId,
      nom: String(info.nom || "").slice(0, 80),
      statut: info.statut,
      reduction: Number(info.reduction) || 0,
      prixPublic: typeof info.prixPublic === "number" ? info.prixPublic : null,
      prixPartenaire: typeof info.prixPartenaire === "number" ? info.prixPartenaire : null,
      gainHeure: typeof info.gainHeure === "number" ? info.gainHeure : null,
      seuil: Number(info.seuil) || 0,
      exception: info.exception === true,
      le: aujourdhui || "",
    },
  };
}

/* ---------- Rubrique « Livraison partenaire » de l'admin ---------- */
const cents = (x) => Math.round(x * 100) / 100;
const ANNULEES = new Set(["refusee", "annulee", "supprimee"]);
// dossiers, demandes, mouvements ; encaisseDe(resId, mouvements) ; bilan(d) = bilanTrajet (temps reel)
export function bilanLivraisonPartenaire({ dossiers = [], demandes = [], mouvements = [], params, aujourdhui, du = "", au = "9999-12-31", encaisseDe, bilan }) {
  const p = params || PARAMS_DEFAUT;
  const dans = (x) => (x.date || "") >= du && (x.date || "") <= au;
  const courses = demandes.filter((x) => x.proPartenaire && !ANNULEES.has(x.statut));
  const lignes = dossiers.map((dos) => {
    const miennes = courses.filter((x) => x.proPartenaire === dos.id && dans(x));
    const faites = miennes.filter((x) => x.statut === "terminee");
    const lp = (x) => x.livraisonPartenaire || {};
    const avecAvantage = faites.filter((x) => ["applique", "exception"].includes(lp(x).statut));
    const reductions = cents(avecAvantage.reduce((s, x) => s + (Number(lp(x).reduction) || 0), 0));
    const encaisse = cents(faites.reduce((s, x) => s + (encaisseDe ? encaisseDe(x.id, mouvements) : 0), 0));
    let minutes = 0;
    let gain = 0;
    for (const x of faites) {
      const b = bilan ? bilan(x) : null;
      if (b && b.total > 0 && b.gainReel != null) {
        minutes += b.total;
        gain += b.gainReel;
      }
    }
    const prevus = miennes.map((x) => lp(x).gainHeure).filter((g) => typeof g === "number");
    const elig = eligibilitePro(dos, p, aujourdhui);
    return {
      id: dos.id,
      nom: dos.nomCommercial,
      formule: dos.formule,
      eligible: elig.ok,
      raison: elig.raison,
      livraisons: faites.length,
      aVenir: miennes.length - faites.length,
      avecAvantage: avecAvantage.length,
      exceptions: avecAvantage.filter((x) => lp(x).statut === "exception").length,
      reductions,
      encaisse,
      gainHeureReel: minutes > 0 ? Math.round((gain * 60) / minutes) : null,
      gainHeurePrevu: prevus.length ? Math.round(prevus.reduce((s, g) => s + g, 0) / prevus.length) : null,
    };
  }).filter((l) => l.livraisons || l.aVenir || l.eligible);
  // Alertes : rentabilite insuffisante (tarif normal propose), Prix ami coche sur une course avec avantage,
  // avantage donne alors que l'abonnement n'est plus a jour
  const alertes = [];
  for (const x of courses) {
    const lp = x.livraisonPartenaire || {};
    if (x.statut === "terminee" && x.date < du) continue;
    if (lp.statut === "rentabilite") alertes.push({ id: x.id, date: x.date, nom: lp.nom || x.nom, texte: `Rentabilité insuffisante (${lp.gainHeure} ₪/h, minimum ${lp.seuil} ₪/h) : tarif normal proposé. Tu peux autoriser la réduction dans « Modifier le devis ».` });
    if (["applique", "exception"].includes(lp.statut) && x.prixAmi) alertes.push({ id: x.id, date: x.date, nom: lp.nom || x.nom, texte: "💛 Prix ami coché sur une course qui a déjà l'avantage partenaire : non cumulable." });
    const dos = dossiers.find((y) => y.id === x.proPartenaire);
    if (["applique", "exception"].includes(lp.statut) && x.statut !== "terminee" && dos && !eligibilitePro(dos, p, aujourdhui).ok) alertes.push({ id: x.id, date: x.date, nom: lp.nom || x.nom, texte: `Avantage prévu mais ${eligibilitePro(dos, p, aujourdhui).raison.toLowerCase()}` });
  }
  const somme = (k) => cents(lignes.reduce((s, l) => s + (Number(l[k]) || 0), 0));
  return {
    lignes: lignes.sort((a, b) => b.livraisons - a.livraisons || b.encaisse - a.encaisse),
    livraisons: somme("livraisons"),
    avecAvantage: somme("avecAvantage"),
    reductions: somme("reductions"),
    encaisse: somme("encaisse"),
    alertes: alertes.sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
}
