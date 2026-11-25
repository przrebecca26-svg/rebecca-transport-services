// AGENDA IPHONE (25 nov. 2026) - Rebecca Services
// Lit le calendrier iCloud (ou Google) que Rebecca a partagé par un « lien public » (webcal://…) et le renvoie
// à son Calendrier admin. Le navigateur ne peut pas le lire directement (sécurité du site d'Apple) : on passe ici.
// Sécurité : seulement les adresses d'iCloud et de Google Agenda (pas un relais ouvert vers n'importe quel site).
const OK = /^(p\d+-caldav\.icloud\.com|[a-z0-9-]+\.icloud\.com|calendar\.google\.com)$/i;
export default async (req) => {
  const brut = new URL(req.url).searchParams.get("url") || "";
  let u;
  try { u = new URL(brut.replace(/^webcal:/i, "https:")); } catch { return new Response("lien invalide", { status: 400 }); }
  if (u.protocol !== "https:" || !OK.test(u.hostname)) return new Response("lien non autorisé (iCloud ou Google seulement)", { status: 400 });
  try {
    const r = await fetch(u.href, { headers: { Accept: "text/calendar" } });
    if (!r.ok) return new Response("calendrier injoignable", { status: 502 });
    const texte = (await r.text()).slice(0, 2_000_000);
    return new Response(texte, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return new Response("calendrier injoignable", { status: 502 });
  }
};
