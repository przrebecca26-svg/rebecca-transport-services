// TRAJET PARTAGE DU RAMASSAGE SCOLAIRE SUR LE SITE - regles pures (aucun acces internet ni base de donnees)
// 15 nov. 2026, demande de Rebecca :
// - une maman fait sa demande sur le site et coche « Partager le trajet » : elle indique le nom et le telephone
//   de chaque autre famille (2 ou 3 familles en tout) et, si elle veut, ce qu'elle sait deja de leurs enfants ;
// - elle voit tout de suite une idee de son prix ; chaque autre famille recoit un lien (WhatsApp) et complete
//   ses enfants et leurs horaires ; le devis se recalcule pour toutes, selon le partage choisi ;
// - meme calcul que le Devis rapide de Rebecca (ramassagePlanning.js).
// Le document partage (Firestore « trajetsPartages ») :
//   { statut, commun: { domicile, ecole, periode, date, sansEcoleDu, sansEcoleAu }, modePartage,
//     familles: [{ nom, telephone, rempli, enfants: [enfant du devis] }], creeLe, majLe }

import { planVide, enfantVide, calculerPlan, manquePlan, nomEnfant, libellePeriode, horairesEnfant, JOURS, MAX_ENFANTS } from "./ramassagePlanning.js";
import { prixFr } from "./partage.js";

export const STATUTS_PARTAGE = { "en cours": "En cours", acceptee: "Accepté par Rebecca", refusee: "Refusé", annulee: "Annulé" };

const texte = (x, max) => String(x == null ? "" : x).slice(0, max);
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const heure = (x) => (HEURE.test(x || "") ? x : "");
const nb = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const adresse = (a) => (a && typeof a === "object" && String(a.label || "").trim() ? { label: texte(a.label, 300), lat: nb(a.lat), lon: nb(a.lon) } : null);

export const familleVidePartage = (nom = "", telephone = "") => ({ nom, telephone, rempli: false, enfants: [] });

// Un enfant tel qu'il est garde dans la base (rien d'inutile, tailles limitees)
export function enfantPropre(e) {
  const x = { ...enfantVide(), ...(e || {}) };
  return {
    prenom: texte(x.prenom, 40),
    sens: ["sortie", "matin", "deux"].includes(x.sens) ? x.sens : "sortie",
    heureMatin: heure(x.heureMatin),
    heureSortie: heure(x.heureSortie),
    jours: JOURS.map((_, w) => ({ actif: !!(x.jours[w] && x.jours[w].actif), heure: heure(x.jours[w] && x.jours[w].heure) })),
    autreEcole: !!x.autreEcole,
    ecole: x.autreEcole ? adresse(x.ecole) : null,
  };
}

const familleProp = (f) => ({
  nom: texte(f && f.nom, 60).trim(),
  telephone: texte(f && f.telephone, 20).trim(),
  rempli: !!(f && f.rempli),
  enfants: ((f && f.enfants) || []).slice(0, MAX_ENFANTS).map(enfantPropre),
});

// Document a enregistrer (creation par la 1re maman)
export function nouveauPartage(commun, familles, modePartage = "enfant") {
  return {
    statut: "en cours",
    commun: {
      domicile: adresse(commun.domicile),
      ecole: adresse(commun.ecole),
      periode: ["jour", "semaine", "mois"].includes(commun.periode) ? commun.periode : "mois",
      date: DATE.test(commun.date || "") ? commun.date : "",
      sansEcoleDu: DATE.test(commun.sansEcoleDu || "") ? commun.sansEcoleDu : "",
      sansEcoleAu: DATE.test(commun.sansEcoleAu || "") ? commun.sansEcoleAu : "",
    },
    modePartage: modePartage === "egal" ? "egal" : "enfant",
    familles: familles.slice(0, 3).map(familleProp),
  };
}

// Une famille complete sa partie : on ne touche qu'a SA ligne
export function remplirFamille(doc, f, { enfants, nom, telephone }) {
  const familles = doc.familles.map((x, i) => (i !== f ? familleProp(x, i) : familleProp({ ...x, nom: nom != null ? nom : x.nom, telephone: telephone != null ? telephone : x.telephone, enfants, rempli: true }, i)));
  return { familles };
}

// Le devis pour le calcul : seuls les enfants deja connus comptent (une famille sans enfant = « en attente »)
export function planDuPartage(doc) {
  const comptees = doc.familles.map((f, i) => ({ f, i })).filter((x) => x.f.enfants && x.f.enfants.length > 0);
  const plan = {
    ...planVide(),
    ...doc.commun,
    reduction: "",
    nbFamilles: Math.max(1, comptees.length),
    modePartage: doc.modePartage === "egal" ? "egal" : "enfant",
    autresFamilles: [1, 2].map((k) => ({ nom: comptees[k] ? nomPartage(doc, comptees[k].i) : "", telephone: comptees[k] ? String(comptees[k].f.telephone || "") : "" })),
    enfants: comptees.flatMap((x, k) => x.f.enfants.map((e) => ({ ...enfantVide(), ...e, famille: comptees.length > 1 ? k : 0 }))),
  };
  return { plan, comptees: comptees.map((x) => x.i), nomCliente: comptees[0] ? nomPartage(doc, comptees[0].i) : "" };
}

export const nomPartage = (doc, f) => String((doc.familles[f] && doc.familles[f].nom) || "").trim() || `Famille ${f + 1}`;
export const familleEnAttente = (doc, f) => !(doc.familles[f] && doc.familles[f].enfants && doc.familles[f].enfants.length);

// Calcul complet : { plan, resultat, parFamille: [{ nom, montant | null, enfants, rempli }], manque, complet }
export function calculerPartage(doc, routes, t, options = {}) {
  const { plan, comptees, nomCliente } = planDuPartage(doc);
  const manque = plan.enfants.length ? manquePlan(plan) : "Ajoutez au moins un enfant.";
  const resultat = manque ? null : calculerPlan(plan, routes, t, { ...options, nomCliente });
  const ok = !!(resultat && resultat.ok);
  const parts = ok ? (resultat.details.partage ? resultat.details.partage.parts : [{ nom: nomCliente, personnes: plan.enfants.length, montant: resultat.total }]) : [];
  const parFamille = doc.familles.map((f, i) => {
    const k = comptees.indexOf(i);
    return { nom: nomPartage(doc, i), telephone: f.telephone || "", enfants: (f.enfants || []).length, rempli: !!f.rempli, montant: ok && k >= 0 && parts[k] ? parts[k].montant : null };
  });
  return { plan, resultat, manque: manque || (resultat && !resultat.ok ? resultat.erreur : ""), parFamille, complet: ok && doc.familles.every((f) => f.rempli && f.enfants.length > 0) };
}

// Lien personnel de chaque famille
export const lienPartage = (origine, id, f) => `${String(origine || "").replace(/\/$/, "")}/#/partage/${id}/${f}`;
export function lireLienPartage(hash) {
  const m = /^#\/partage\/([A-Za-z0-9_-]{10,40})\/([0-2])$/.exec(hash || "");
  return m ? { id: m[1], famille: Number(m[2]) } : null;
}

// Resume des enfants d'une famille (pour les messages)
function enfantsTexte(doc, f) {
  const fam = doc.familles[f];
  if (!fam || !fam.enfants.length) return ["• Enfants : à compléter"];
  const plan = { ...planVide(), ...doc.commun, enfants: fam.enfants.map((e) => ({ ...enfantVide(), ...e })) };
  return fam.enfants.map((e, i) => `• ${nomEnfant(e, i)} : ${horairesEnfant(plan, i)}`);
}

// Message WhatsApp d'invitation (ou de nouveau devis) pour la famille f
export function messagePartage(doc, f, lien, calcul, deQui = "") {
  const lignes = ["Bonjour 😊", ""];
  const invite = !doc.familles[f].rempli;
  lignes.push(
    invite
      ? `${deQui || nomPartage(doc, 0)} vous propose de partager le ramassage scolaire avec Rebecca Services (${doc.familles.length} familles, trajets partagés : moins cher pour chacune).`
      : `Le devis du ramassage scolaire partagé a été mis à jour.`
  );
  lignes.push("", "Vos enfants :", ...enfantsTexte(doc, f));
  const p = calcul && calcul.parFamille[f];
  if (calcul && calcul.resultat && calcul.resultat.ok) {
    lignes.push("", `Devis ${libellePeriode(calcul.plan, calcul.resultat)} : ${prixFr(calcul.resultat.total)} ₪ pour toutes les familles.`);
    if (p && p.montant != null) lignes.push(`Votre part (${doc.modePartage === "egal" ? "parts égales" : "par enfant"}) : ${prixFr(p.montant)} ₪.`);
    const attente = calcul.parFamille.filter((x) => x.montant == null).map((x) => x.nom);
    if (attente.length) lignes.push(`Prix provisoire : en attente des enfants de ${attente.join(", ")}.`);
  }
  lignes.push("", invite ? "Complétez ou corrigez les enfants et les horaires de votre famille ici :" : "Voir le détail ou modifier vos horaires :", lien, "", "Rebecca Services", "Votre temps est précieux, je vous aide à en profiter. 🌸");
  return lignes.join("\n");
}

// Message pour Rebecca (WhatsApp et liste des demandes)
export function messageRebecca(doc, calcul, liens = []) {
  const lignes = [`Bonjour Rebecca, nouvelle demande : Ramassage scolaire partagé (${doc.familles.length} familles)`, ""];
  if (doc.commun.domicile) lignes.push(`Domicile : ${doc.commun.domicile.label}`);
  if (doc.commun.ecole) lignes.push(`École : ${doc.commun.ecole.label}`);
  doc.familles.forEach((f, i) => {
    lignes.push("", `${nomPartage(doc, i)}${f.telephone ? ` (${f.telephone})` : ""}${f.rempli ? "" : " : à compléter par la famille"}`, ...enfantsTexte(doc, i));
  });
  if (calcul && calcul.resultat && calcul.resultat.ok) {
    lignes.push("", `Estimation : ${prixFr(calcul.resultat.total)} ₪ (${calcul.plan.periode === "mois" ? "au mois" : calcul.plan.periode === "semaine" ? "à la semaine" : "un jour"})`);
    calcul.parFamille.forEach((p) => lignes.push(`• ${p.nom} : ${p.montant != null ? prixFr(p.montant) + " ₪" : "en attente"}`));
    lignes.push(`Partage : ${doc.modePartage === "egal" ? "parts égales" : "par enfant"}`);
  }
  if (liens.length) lignes.push("", "Suivi du trajet partagé :", liens[0]);
  lignes.push("", "Merci de me confirmer la disponibilité.");
  return lignes.join("\n").slice(0, 4900);
}
