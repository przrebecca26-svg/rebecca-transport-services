// CLIENTS (espace prive) : regles pures, sans acces internet ni base de donnees - Rebecca Services
// Regroupe les comptes clients (collection "clients") et les demandes faites sans compte
// (reconnues par leur numero de telephone) en une seule liste de fiches.
//
// Cle d'une fiche :
//   - client avec compte : son uid
//   - client sans compte : "tel_" + numero normalise (ex : tel_0547380193)
// Les notes privees et le blocage sont dans clientsAdmin/{cle} (jamais visibles du client).

import { encaisseBrut, situationCourse } from "./comptes.js";

// Numero comparable : chiffres seulement, +972 / 972 remplace par 0
export function telNormalise(s) {
  let t = String(s == null ? "" : s).replace(/[^\d+]/g, "");
  if (t.startsWith("+972")) t = "0" + t.slice(4);
  else if (t.startsWith("972") && t.length >= 11) t = "0" + t.slice(3);
  t = t.replace(/\+/g, "");
  return t.length >= 6 ? t : "";
}

// Cle de la fiche a laquelle appartient une demande (utilisee aussi par l'onglet Demandes)
export function cleClient(demande) {
  if (demande && demande.uid) return demande.uid;
  const t = telNormalise(demande && demande.telephone);
  return t ? "tel_" + t : "";
}

export const estSansCompte = (cle) => String(cle || "").startsWith("tel_");

const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
const cents = (x) => Math.round(x * 100) / 100;

// Texte de recherche : minuscules, sans accents
export const sansAccents = (s) =>
  String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/* ---------- Construction de la liste ---------- */
// clients : [{ id(uid), prenom, nom, telephone, email, ... }]
// demandes : [{ id, uid?, nom, telephone, date, heure, statut, prixFinal?, prixEstime?, moyenPaiement, creeLe? }]
// admins : { [cle]: { notes, bloque, motifBlocage } }
// transport : Set des uid autorises au Transport prive (actif == true)
// recharges : [{ id, uid, statut, montant }]
// mouvements : mouvements financiers (pour encaisse / reste a payer)
export function construireFiches({ clients = [], demandes = [], admins = {}, transport = new Set(), recharges = [], mouvements = [] }) {
  const fiches = new Map();
  const parTel = new Map(); // numero d'un compte -> uid (pour rattacher les demandes faites avant le compte)

  for (const c of clients) {
    fiches.set(c.id, { cle: c.id, avecCompte: true, profil: c, demandes: [] });
    const t = telNormalise(c.telephone);
    if (t && !parTel.has(t)) parTel.set(t, c.id);
  }

  for (const d of demandes) {
    let cle = d.uid && fiches.has(d.uid) ? d.uid : "";
    if (!cle && !d.uid) {
      const t = telNormalise(d.telephone);
      if (t && parTel.has(t)) cle = parTel.get(t);
    }
    if (!cle) cle = cleClient(d);
    if (!cle) continue;
    if (!fiches.has(cle)) fiches.set(cle, { cle, avecCompte: !estSansCompte(cle), profil: null, demandes: [] });
    fiches.get(cle).demandes.push(d);
  }

  const resultat = [];
  for (const f of fiches.values()) {
    const tri = [...f.demandes].sort((a, b) => (String(b.date) + String(b.heure || "")).localeCompare(String(a.date) + String(a.heure || "")));
    const derniere = tri[0] || null;
    const p = f.profil;
    const nom = p ? `${p.prenom || ""} ${p.nom || ""}`.trim() : (derniere && derniere.nom) || "Client";
    const telephone = (p && p.telephone) || (derniere && derniere.telephone) || "";
    const adm = admins[f.cle] || {};
    resultat.push({
      ...f,
      demandes: tri,
      nom,
      telephone,
      email: (p && p.email) || "",
      derniereDate: derniere ? String(derniere.date || "") : "",
      transport: f.avecCompte && transport.has(f.cle),
      bloque: adm.bloque === true,
      aNotes: !!(adm.notes && String(adm.notes).trim()),
      rechargesEnAttente: f.avecCompte ? recharges.filter((r) => r.uid === f.cle && r.statut === "en attente").length : 0,
      stats: statistiques(tri, mouvements),
      recherche: sansAccents([nom, telephone, telNormalise(telephone), p && p.email].filter(Boolean).join(" ")),
    });
  }
  // Activite la plus recente en premier, puis par nom
  return resultat.sort((a, b) => b.derniereDate.localeCompare(a.derniereDate) || a.nom.localeCompare(b.nom, "fr"));
}

/* ---------- Statistiques d'une fiche ---------- */
export function statistiques(demandes, mouvements = []) {
  const terminees = demandes.filter((d) => d.statut === "terminee");
  const chiffreAffaires = cents(terminees.reduce((s, d) => s + prixDe(d), 0));
  const encaisse = cents(demandes.reduce((s, d) => s + encaisseBrut(mouvements, d.id), 0));
  const resteAPayer = cents(
    terminees.reduce((s, d) => s + situationCourse({ id: d.id, date: d.date, prixConvenu: prixDe(d), statut: d.statut }, mouvements).resteAPayer, 0)
  );
  const ids = new Set(demandes.map((d) => d.id));
  const moyensUtilises = {};
  for (const m of mouvements) {
    if (m.kind === "paiement" && ids.has(m.resId)) moyensUtilises[m.moyen] = cents((moyensUtilises[m.moyen] || 0) + (Number(m.montant) || 0));
  }
  const moyensPrevus = {};
  for (const d of demandes) if (d.moyenPaiement) moyensPrevus[d.moyenPaiement] = (moyensPrevus[d.moyenPaiement] || 0) + 1;
  return {
    nbDemandes: demandes.length,
    nbTerminees: terminees.length,
    nbAnnulees: demandes.filter((d) => d.statut === "annulee").length,
    nbRefusees: demandes.filter((d) => d.statut === "refusee").length,
    nbAVenir: demandes.filter((d) => d.statut === "acceptee" || d.statut === "en attente").length,
    chiffreAffaires,
    encaisse,
    resteAPayer,
    prixMoyen: terminees.length ? Math.round(chiffreAffaires / terminees.length) : 0,
    moyensUtilises,
    moyensPrevus,
  };
}

/* ---------- Filtres de la liste ---------- */
export const FILTRES = [
  { id: "tous", label: "Tous" },
  { id: "compte", label: "Avec compte" },
  { id: "sans", label: "Sans compte" },
  { id: "transport", label: "Transport" },
  { id: "credit", label: "Recharges" },
  { id: "bloques", label: "Bloqués" },
];

export function filtrer(fiches, filtre, texte) {
  const q = sansAccents(texte);
  const chiffres = String(texte || "").replace(/\D/g, "");
  return fiches.filter((f) => {
    if (filtre === "compte" && !f.avecCompte) return false;
    if (filtre === "sans" && f.avecCompte) return false;
    if (filtre === "transport" && !f.transport) return false;
    if (filtre === "credit" && f.rechargesEnAttente === 0) return false;
    if (filtre === "bloques" && !f.bloque) return false;
    if (!q) return true;
    if (f.recherche.includes(q)) return true;
    return chiffres.length >= 3 && telNormalise(f.telephone).includes(chiffres.replace(/^972/, "0"));
  });
}

/* ---------- Credit : confirmation d'une recharge par Rebecca ---------- */
// Renvoie les lignes du carnet de credit a ajouter (recharge + bonus eventuel).
// bonus : calcule par bonusRecharge() (pricing/credit.js) ; destinataireUid : le compte qui recoit le credit.
export function lignesRecharge(recharge, bonus, destinataireUid, jour) {
  const cadeau = !!(recharge.cadeau && destinataireUid !== recharge.uid);
  const lignes = [{ uid: destinataireUid, kind: cadeau ? "cadeau" : "recharge", montant: Number(recharge.montant), date: jour, rechargeId: recharge.id }];
  if (bonus > 0) lignes.push({ uid: destinataireUid, kind: "bonus", montant: bonus, date: jour, rechargeId: recharge.id });
  return lignes;
}

// Une correction de credit saisie par Rebecca (montant + ou -, motif obligatoire)
export function validerCorrectionCredit(montantTexte, motif) {
  const n = Number(String(montantTexte == null ? "" : montantTexte).replace(",", "."));
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 5000) return { erreur: "Indique un montant (ex : 50 ou -20).", montant: 0 };
  if (String(motif || "").trim().length < 3) return { erreur: "Un motif est obligatoire pour une correction.", montant: 0 };
  return { erreur: "", montant: Math.round(n * 100) / 100 };
}
