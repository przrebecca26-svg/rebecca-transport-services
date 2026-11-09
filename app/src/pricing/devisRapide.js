// DEVIS RAPIDE - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// D2a (9 nov. 2026), demande de Rebecca : simuler un devis pour un client qui demande un prix hors du site
// (Instagram, WhatsApp...), avec EXACTEMENT le meme calculateur que le site, et preparer le message a envoyer.

import { champsAdresses } from "./ajoutManuel.js";

const ville = (a) => {
  if (!a || !a.label) return "";
  const morceaux = String(a.label).split(",").map((s) => s.trim()).filter(Boolean);
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

// Message pret a envoyer (Instagram, WhatsApp). resultat = sortie du calculateur.
// Le prix n'est donne que s'il est calcule ; sinon « sur devis ». Jamais les alertes internes (rentabilite).
export function messageDevis(service, v, resultat) {
  const quand = v.date ? ` le ${jourFr(v.date)}${v.heure ? " à " + v.heure.replace(":", "h") : ""}` : "";
  const lignes = ["Bonjour 😊", ""];
  if (resultat && resultat.ok && !resultat.bloque && !resultat.devis && resultat.total != null) {
    lignes.push(`Pour ${resume(service, v)}${quand}, le tarif est de ${resultat.total} ₪.`);
    const aConfirmer = (resultat.aConfirmer || []).filter((a) => !/^Rentabilité/.test(a));
    if (aConfirmer.length) lignes.push("", ...aConfirmer);
  } else {
    lignes.push(`Pour ${resume(service, v)}${quand}, je vous prépare un devis personnalisé.`);
  }
  lignes.push("", "Pouvez-vous me confirmer les adresses exactes et l'horaire qui vous convient ?", "", "Rebecca Services", "Votre temps est précieux, je vous aide à en profiter. 🌸");
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
  };
}
