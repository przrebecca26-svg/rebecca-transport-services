// DEVIS RAPIDE - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// D2a (9 nov. 2026), demande de Rebecca : simuler un devis pour un client qui demande un prix hors du site
// (Instagram, WhatsApp...), avec EXACTEMENT le meme calculateur que le site, et preparer le message a envoyer.

import { CODE_BIENVENUE, SITE, champsAdresses } from "./ajoutManuel.js";
import { lignesPartage } from "./partage.js";
import { CHAMPS_CLIENT, champsVisibles, libelle, texteValeur } from "../services.js";

// Nom de la ville : dernier morceau de l'adresse, sans le district ni le pays
// (ex. « Raanana, נפת פתח תקווה » -> Raanana ; D2b, 9 nov. 2026)
const HORS_VILLE = /^(נפת|מחוז|ישראל$|israel$|district\b)|\bdistrict$/i;
const ville = (a) => {
  if (!a || !a.label) return "";
  const morceaux = String(a.label).split(",").map((s) => s.trim()).filter((s) => s && !HORS_VILLE.test(s) && !/^\d+$/.test(s));
  return morceaux[morceaux.length - 1] || "";
};
const jourFr = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

// Phrase qui decrit la prestation, selon le service
export function resume(service, v) {
  const de = (x) => ville(v[x]);
  switch (service) {
    case "livraison":
      return de("recuperation") && de("livraison") ? `récupérer votre colis à ${de("recuperation")} et le livrer à ${de("livraison")}` : "votre livraison";
    case "courses":
      return v.typePrestation === "courses" ? `faire vos courses et vous les livrer${de("livraison") ? " à " + de("livraison") : ""}` : `récupérer vos achats et vous les livrer${de("livraison") ? " à " + de("livraison") : ""}`;
    case "aeroport":
      return v.direction === "depuis" ? `votre transfert depuis l'aéroport Ben Gourion${de("adresse") ? " jusqu'à " + de("adresse") : ""}` : `votre transfert${de("adresse") ? " de " + de("adresse") : ""} vers l'aéroport Ben Gourion`;
    case "transport":
      return de("depart") && de("arrivee") ? `votre trajet de ${de("depart")} à ${de("arrivee")}${v.typeTrajet === "ar" ? " (aller-retour)" : ""}` : "votre trajet";
    case "demenagement":
      return de("depart") && de("arrivee") ? `votre petit déménagement de ${de("depart")} à ${de("arrivee")}` : "votre petit déménagement";
    case "hatan_kala":
      return "le transport des mariés";
    case "attente":
      return "la mise à disposition";
    case "ramassage":
      return "le ramassage scolaire";
    default:
      return "votre demande";
  }
}

// Detail complet du devis (16 nov. 2026, demande de Rebecca : aller-retour, vol, bagages... et detail du tarif).
// Lignes « Libellé : valeur » de tout ce qui a ete rempli (sauf client, date et heure deja dans la phrase),
// puis le detail du prix. Jamais les alertes internes.
const SANS_DETAIL = new Set(CHAMPS_CLIENT.map((c) => c.name).concat(["date", "heure", "promoActif", "codePromo"]));
export function lignesDetail(service, v, resultat) {
  const lignes = [];
  let champs = [];
  try {
    champs = champsVisibles(service, v);
  } catch {
    champs = [];
  }
  for (const c of champs) {
    if (SANS_DETAIL.has(c.name)) continue;
    const t = texteValeur(c, v[c.name]);
    if (t === "" || t === "0" || (c.type === "texte-long" && !t.trim())) continue;
    // Deja dit dans la phrase du devis, ou sans interet pour la cliente
    if (c.name === "direction" || (c.name === "nbFamilles" && String(v[c.name]) === "1") || ["Je ne sais pas", "Aucune", "Aller simple"].includes(t)) continue;
    lignes.push(`• ${String(libelle(c, v)).replace("d'passagers", "de passagers")} : ${t}`);
  }
  if (resultat && resultat.ok && !resultat.devis) {
    const prix = (resultat.lignes || []).filter((l) => l && l.libelle && typeof l.montant === "number");
    const separe = (resultat.separe || []).filter((l) => l && l.libelle && typeof l.montant === "number");
    if (prix.length || separe.length) {
      lignes.push("", "Détail du tarif :");
      for (const l of prix) lignes.push(`• ${l.libelle} : ${l.montant} ₪`);
      for (const l of separe) lignes.push(`• ${l.libelle} (hors prestation) : ${l.montant} ₪`);
    }
  }
  return lignes;
}

// Message pret a envoyer (Instagram, WhatsApp). resultat = sortie du calculateur.
// Le prix n'est donne que s'il est calcule ; sinon « sur devis ». Jamais les alertes internes (rentabilite).
export function messageDevis(service, v, resultat) {
  const quand = v.date ? ` le ${jourFr(v.date)}${v.heure ? " à " + v.heure.replace(":", "h") : ""}` : "";
  const lignes = ["Bonjour 😊", ""];
  if (resultat && resultat.ok && !resultat.bloque && !resultat.devis && resultat.total != null) {
    lignes.push(`Pour ${resume(service, v)}${quand}, le tarif est de ${resultat.total} ₪.`);
    const detail = lignesDetail(service, v, resultat);
    if (detail.length) lignes.push("", ...detail);
    const aConfirmer = (resultat.aConfirmer || []).filter((a) => !/^Rentabilité/.test(a));
    if (aConfirmer.length) lignes.push("", ...aConfirmer);
    const partage = resultat.details && resultat.details.partage;
    if (partage) lignes.push("", ...lignesPartage(partage, service === "ramassage" ? "enfant" : "passager"));
  } else {
    lignes.push(`Pour ${resume(service, v)}${quand}, je vous prépare un devis personnalisé.`);
  }
  lignes.push("", "Pouvez-vous me confirmer les adresses exactes et l'horaire qui vous convient ?", "", "Rebecca Services", "Votre temps est précieux, je vous aide à en profiter. 🌸");
  return lignes.join("\n");
}

// Renvoyer le devis d'une demande deja enregistree (16 nov. 2026, demande de Rebecca : devis oublie au telephone).
// d = document de la demande. Prix retenu (supplements compris), sinon estimation du site ; sans prix -> null.
export function prixDemande(d) {
  if (!d) return null;
  if (typeof d.prixFinal === "number") return d.prixFinal;
  return typeof d.prixEstime === "number" ? d.prixEstime : null;
}

export function messageDevisDemande(d) {
  const prix = prixDemande(d);
  if (prix == null || prix <= 0) return null;
  const v = { ...(d.details || {}), date: d.date || "", heure: d.heure || "" };
  const quand = v.date ? ` le ${jourFr(v.date)}${v.heure ? " à " + v.heure.replace(":", "h") : ""}` : "";
  const prenom = String(d.nom || "").trim().split(/\s+/)[0] || "";
  const lignes = [prenom ? `Bonjour ${prenom} 😊` : "Bonjour 😊", "", "Voici votre devis :", `Pour ${resume(d.service, v)}${quand}, le tarif est de ${prix} ₪.`];
  const detail = d.details && typeof d.details.detailDevis === "string" ? d.details.detailDevis.trim() : "";
  if (detail) lignes.push("", detail, "");
  if (d.moyenPaiement) lignes.push(`Paiement prévu : ${String(d.moyenPaiement).toLowerCase()}.`);
  if (d.statut === "acceptee") lignes.push("", "Votre réservation est confirmée ✅");
  else if (d.statut === "en attente") lignes.push("", "N'hésitez pas à me confirmer pour que je réserve ce créneau.");
  // Cliente sans compte : petite pub pour creer son compte (16 nov. 2026)
  if (!d.uid) lignes.push("", `🎁 N'oubliez pas de créer votre compte sur ${SITE} avec ce numéro de téléphone : vous recevrez le code ${CODE_BIENVENUE} (-10 ₪ sur votre prochaine réservation) et vous retrouverez toutes vos courses.`);
  lignes.push("", "Rebecca Services", "Votre temps est précieux, je vous aide à en profiter. 🌸");
  return lignes.join("\n");
}

// Pre-remplissage de « + Ajouter une course » a partir du devis (meme prix, memes adresses)
export function versAjoutManuel(service, v, resultat) {
  const adresses = {};
  for (const { cle } of champsAdresses(service)) if (v[cle] && v[cle].label) adresses[cle] = v[cle];
  return {
    service,
    date: v.date || "",
    heure: v.heure || "",
    adresses,
    direction: v.direction === "depuis" ? "depuis" : "vers",
    magasin: v.magasin || "",
    prix: resultat && resultat.ok && !resultat.devis && resultat.total != null ? String(resultat.total) : "",
    // Detail du devis garde avec la course, pour « Renvoyer le devis » (16 nov. 2026)
    detailDevis: lignesDetail(service, v, resultat).join("\n").slice(0, 3000),
  };
}
