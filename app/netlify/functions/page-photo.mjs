// PHOTO D'UNE PAGE PRO pour l'apercu WhatsApp / Facebook : rebeccaservices.com/p-photo/NUMERO.jpg (lot 1, 27 nov. 2026)
// WhatsApp et Facebook n'acceptent qu'une adresse d'image : on renvoie la photo enregistree dans pagesPhotos/NUMERO
// (lecture publique d'UNE photo par son numero, regles v42). Gardee en cache 1 jour par Netlify.
const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
export const config = { path: ["/p-photo/*"] };

export default async function pagePhoto(req) {
  const id = (new URL(req.url).pathname.match(/^\/p-photo\/([A-Za-z0-9]{12,40})(\.jpg)?$/) || [])[1];
  if (!id) return new Response("introuvable", { status: 404 });
  const r = await fetch(`${BASE}/pagesPhotos/${id}?key=${CLE_API}`);
  if (!r.ok) return new Response("introuvable", { status: 404 });
  const d = (((await r.json()).fields || {}).donnees || {}).stringValue || "";
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(d);
  if (!m) return new Response("introuvable", { status: 404 });
  return new Response(Buffer.from(m[3], "base64"), { status: 200, headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
