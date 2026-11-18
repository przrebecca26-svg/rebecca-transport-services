// NOTIFICATIONS SUR LE TELEPHONE (18 nov. 2026) - Rebecca Services
// Texte de la notification envoyee a l'iPhone de Rebecca pour chaque nouvelle demande du site,
// et identifiant de chaque telephone abonne (collection Firestore « notificationsPush », lue par Rebecca et le robot).
// Cle PUBLIQUE des notifications (VAPID) : pas secrete. La cle privee est dans Netlify (VAPID_PRIVEE).
export const VAPID_PUBLIQUE = "BIchHt_bbyRG5NPHuXXDmXaAPnazto70FSzDK2LpVE7EHJk94BQGZvSvuu1TOfxfNrcNm8-2He8MNgseu1n5gbM";

const ICONES = {
  transport: "🚗", aeroport: "✈️", livraison: "📦", courses: "🛍️", hatan_kala: "💍", demenagement: "📚",
  ramassage: "🎒", attente: "⏱️", nails: "💅", hair: "💇‍♀️", slim: "✨", regenx: "🌿", epoxy: "🎁", digital: "💻",
};

function dateCourte(date, heure) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  const jour = m ? `${m[3]}/${m[2]}` : "";
  return [jour, String(heure || "").replace(":", "h")].filter(Boolean).join(" ");
}

// Une notification par demande : { titre, corps, tag, lien }
export function messageNotification(d = {}) {
  const icone = ICONES[d.service] || "🔔";
  const prix = typeof d.prixEstime === "number" ? `${d.prixEstime} ₪` : "";
  const corps = [d.serviceTitre || d.service || "Demande", d.nom, dateCourte(d.date, d.heure), prix].filter(Boolean).join(" · ");
  return { titre: `${icone} Nouvelle demande`, corps: corps.slice(0, 180), tag: `demande-${d.id || ""}`, lien: "/?admin=1#/admin" };
}

export function messageTest() {
  return { titre: "🔔 Rebecca Services", corps: "C'est bon ! Les notifications arrivent bien sur ce téléphone.", tag: "test", lien: "/?admin=1#/admin" };
}

// Identifiant stable d'un telephone abonne (meme telephone = meme fiche, jamais en double)
export function idAbonnement(endpoint = "") {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < endpoint.length; i++) {
    const c = endpoint.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return `tel_${h1.toString(36)}${h2.toString(36)}`;
}

// iPhone : les notifications ne marchent que dans l'icone de l'ecran d'accueil (pas dans Safari)
export function etatTelephone({ standalone = false, push = false, permission = "default", ios = false } = {}) {
  if (ios && !standalone) return "icone";
  if (!push) return "impossible";
  if (permission === "denied") return "refuse";
  return "pret";
}
