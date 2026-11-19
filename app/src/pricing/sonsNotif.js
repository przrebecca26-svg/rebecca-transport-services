// SONS ET EMOJIS DES NOTIFICATIONS (19 nov. 2026, 15h42) - regles pures - Rebecca Services
// Rebecca : « comme Wolt, trois petites cloches pour une nouvelle course, deux cloches quand c'est l'heure de partir,
// et je choisis pour chaque notification ». Sur iPhone, une appli installée depuis Safari ne peut pas choisir le son
// de ses notifications (son standard d'iOS) : chaque type a donc un EMOJI en tête du titre, lisible sur l'écran
// verrouillé, et un vrai SON joué par l'appli quand elle est ouverte. Tout se règle dans Réglages → Notifications.
// (Une vraie appli App Store pourrait avoir ses propres sons : projet futur, noté par Rebecca.)

export const SONS = [
  { id: "3", label: "🔔🔔🔔 Trois clochettes" },
  { id: "2", label: "🔔🔔 Deux clochettes" },
  { id: "1", label: "🔔 Une clochette" },
  { id: "c", label: "💰 Caisse (ding aigu)" },
  { id: "0", label: "Aucun son" },
];

export const TYPES_NOTIF = [
  { id: "nouvelle", label: "Nouvelle course, demande ou rendez-vous", emoji: "🔔🔔🔔", son: "3" },
  { id: "partir", label: "C'est bientôt l'heure de partir (rappel avant une course)", emoji: "🔔🔔", son: "2" },
  { id: "paiement", label: "Paiement annoncé ou reçu", emoji: "💰", son: "c" },
  { id: "alerte", label: "Alerte (retard, vol, demande sans réponse)", emoji: "⚠️", son: "2" },
  { id: "info", label: "Résumés (7h, 19h, dimanche) et avis", emoji: "📅", son: "0" },
];

const EMOJI_OK = /^[^\n<>]{0,12}$/;
// Réglages enregistrés (texte JSON) + valeurs par défaut
export function lireStyles(json) {
  let o = {};
  try { o = typeof json === "string" ? JSON.parse(json || "{}") : json || {}; } catch { o = {}; }
  const r = {};
  for (const t of TYPES_NOTIF) {
    const x = (o && o[t.id]) || {};
    r[t.id] = {
      emoji: typeof x.emoji === "string" && EMOJI_OK.test(x.emoji) ? x.emoji.trim() : t.emoji,
      son: SONS.some((s) => s.id === x.son) ? x.son : t.son,
    };
  }
  return r;
}

// Type d'une notification du robot, d'après son étiquette (tag)
export function typeDeTag(tag = "") {
  const t = String(tag);
  if (t.startsWith("avant-")) return "partir";
  if (/^(retards|vol|attente)-/.test(t)) return "alerte";
  if (/^(paiementsDeclares|recharges|cartesCadeauxPaye)-/.test(t)) return "paiement";
  if (/^(demandes|commandes|projetsDigital|candidaturesPartenaires|cartesCadeaux)-/.test(t)) return "nouvelle";
  return "info";
}

// Le titre commence par l'emoji choisi pour son type (sans doubler un emoji déjà en tête)
export function styliser(m, styles = lireStyles("{}")) {
  if (!m) return m;
  const type = typeDeTag(m.tag);
  const s = styles[type] || {};
  const titre = String(m.titre || "");
  const emoji = s.emoji || "";
  return { ...m, type, son: s.son || "0", titre: emoji && !titre.startsWith(emoji) ? `${emoji} ${titre}`.slice(0, 120) : titre };
}

// Rappel « avant une course » quand Rebecca est dehors : « 📍 Localise-toi » (le lien ouvre l'appli et la localise)
export function avecLocalisation(m) {
  return { ...m, corps: `${m.corps}\n📍 Touche ici pour te localiser : ton trajet se recalcule depuis là où tu es.`.slice(0, 400), lien: "/admin#/admin?localiser=1" };
}

// Rebecca est-elle « dehors » aujourd'hui ? (bouton « Je sors » ou détection à l'ouverture de l'appli)
export const estDehors = (reglage = {}, aujourdhui = "") => reglage.ou === "dehors" && String(reglage.ouLe || "").slice(0, 10) === aujourdhui;
