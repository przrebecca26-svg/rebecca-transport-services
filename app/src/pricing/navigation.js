// NAVIGATION ET CONTACT - Rebecca Transport & Services
// Quand Rebecca accepte une course, un bouton ouvre directement Waze (ou Google Maps / Apple Plans)
// sur l'adresse de prise en charge, puis sur chaque etape. Un bouton ouvre aussi WhatsApp vers le client.

const enc = encodeURIComponent;

function destination({ adresse, lat, lon }) {
  const aCoord = typeof lat === "number" && typeof lon === "number";
  return { adresse: adresse || "", aCoord, coord: aCoord ? `${lat},${lon}` : "" };
}

// Lien universel Waze : ouvre l'application si elle est installee, sinon la page web de Waze
export function lienWaze(etape) {
  const d = destination(etape);
  const p = [];
  if (d.adresse) p.push("q=" + enc(d.adresse));
  if (d.aCoord) p.push("ll=" + enc(d.coord));
  p.push("navigate=yes");
  return `https://waze.com/ul?${p.join("&")}`;
}

// Waze vers un POINT EXACT (12 nov. 2026) : quand on a les coordonnees, on n'envoie QUE les coordonnees.
// Avec le texte en plus, Waze refaisait sa propre recherche et pouvait partir vers un homonyme dans une autre ville.
export function lienWazePoint(adresse) {
  if (adresse && typeof adresse.lat === "number" && typeof adresse.lon === "number") return `https://waze.com/ul?ll=${enc(`${adresse.lat},${adresse.lon}`)}&navigate=yes`;
  return lienWaze({ adresse: (adresse && adresse.label) || "" });
}

// Lien direct vers l'application Waze (iPhone) : a utiliser si Waze est installe
export function lienWazeApp(etape) {
  return lienWaze(etape).replace("https://waze.com/ul?", "waze://?");
}

export function lienGoogleMaps(etape) {
  const d = destination(etape);
  return `https://www.google.com/maps/dir/?api=1&destination=${enc(d.aCoord ? d.coord : d.adresse)}&travelmode=driving`;
}

export function lienApplePlans(etape) {
  const d = destination(etape);
  return `https://maps.apple.com/?daddr=${enc(d.aCoord ? d.coord : d.adresse)}&dirflg=d`;
}

// Une etape = { role, adresse, lat?, lon? } -> tous les liens de navigation
export function liensEtapes(etapes) {
  return etapes
    .filter((e) => e && (e.adresse || typeof e.lat === "number"))
    .map((e) => ({
      role: e.role,
      adresse: e.adresse,
      waze: lienWaze(e),
      wazeApp: lienWazeApp(e),
      googleMaps: lienGoogleMaps(e),
      applePlans: lienApplePlans(e),
    }));
}

// Numero de telephone israelien -> chiffres internationaux (972...), ou null si invalide
export function numeroInternational(telephone) {
  let n = String(telephone || "").replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "972" + n.slice(1);
  return /^9725\d{8}$/.test(n) ? n : null;
}

export function lienWhatsApp(telephone, message = "") {
  const n = numeroInternational(telephone);
  if (!n) return null;
  return `https://wa.me/${n}${message ? "?text=" + enc(message) : ""}`;
}

export const lienAppel = (telephone) => {
  const n = numeroInternational(telephone);
  return n ? `tel:+${n}` : null;
};
