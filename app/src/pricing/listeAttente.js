// LISTE D'ATTENTE BEAUTE (19 nov. 2026, V2) - regles pures
// Le creneau voulu est pris : la cliente laisse son prenom, son telephone, le jour et le moment (matin, apres-midi,
// toute la journee). Si un creneau se libere (refus, annulation), Rebecca la previent sur WhatsApp en un geste.
export const PLAGES = [
  { id: "journee", label: "Toute la journée" },
  { id: "matin", label: "Le matin" },
  { id: "apresmidi", label: "L'après-midi" },
];
export const NOMS_SERVICES = { nails: "Nails Prestige", hair: "Prestige Hair", slim: "Prestige Slim & Lift", regenx: "RegenX" };
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

// { erreur } ou { fiche } prete a enregistrer (sans creeLe)
export function validerAttente(f = {}) {
  const prenom = String(f.prenom || "").trim().slice(0, 60);
  const telephone = String(f.telephone || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!NOMS_SERVICES[f.service]) return { erreur: "Activité inconnue." };
  if (!DATE_OK.test(f.date || "")) return { erreur: "Choisissez un jour." };
  if (prenom.length < 2) return { erreur: "Indiquez votre prénom." };
  if (telephone.replace(/\D/g, "").length < 9) return { erreur: "Indiquez un numéro de téléphone valide." };
  const plage = PLAGES.some((p) => p.id === f.plage) ? f.plage : "journee";
  return { erreur: "", fiche: { service: f.service, prestation: String(f.prestation || "").slice(0, 100), date: f.date, plage, prenom, telephone, note: String(f.note || "").trim().slice(0, 300), statut: "en attente" } };
}

const jourFr = (d) => {
  try {
    return new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  } catch {
    return d;
  }
};
// Message WhatsApp a la cliente quand une place se libere
export function messagePlaceLibre(a, heure = "") {
  const plage = (PLAGES.find((p) => p.id === a.plage) || PLAGES[0]).label.toLowerCase();
  return `Bonjour ${a.prenom}, c'est Rebecca (${NOMS_SERVICES[a.service] || "Rebecca Services"}). Une place s'est libérée le ${jourFr(a.date)}${heure ? ` à ${heure}` : ` (${plage})`}${a.prestation ? ` pour ${a.prestation}` : ""}. Elle vous intéresse ? Répondez-moi vite, je vous la garde un moment 😊`;
}

// Les inscriptions encore utiles (a partir d'aujourd'hui), triees par date ; parJour = nombre par date
export function attentesActives(liste = [], aujourdhui = "") {
  return liste.filter((a) => a && a.statut !== "fermee" && (!aujourdhui || a.date >= aujourdhui)).sort((x, y) => String(x.date).localeCompare(String(y.date)));
}
