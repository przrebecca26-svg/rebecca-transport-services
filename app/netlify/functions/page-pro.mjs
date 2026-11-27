// PAGE D'UN PROFESSIONNEL : rebeccaservices.com/p/ADRESSE (generateur de pages, lot 1, 27 nov. 2026)
// Le site est une seule page : sans cette fonction, WhatsApp, Facebook et Google verraient le titre de Rebecca
// Services pour toutes les pages. Ici on renvoie le meme site, avec le titre, la description et la photo du pro.
// Installee une seule fois : les nouvelles pages ne demandent AUCUNE publication Netlify.
// Lit seulement pagesPubliques/ADRESSE (lecture publique d'une page par son adresse, regles v42). Aucune donnee privee.
const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const ADRESSE_OK = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const config = { path: ["/p/*"] };

const echapper = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function remplacerEntete(html, { titre, description, url, image }) {
  let h = html.replace("<head>", '<head>\n    <base href="/" />');
  const meta = (attr, nom, valeur) => {
    const re = new RegExp(`<meta ${attr}="${nom}" content="[^"]*"\\s*/?>`);
    const balise = `<meta ${attr}="${nom}" content="${echapper(valeur)}" />`;
    h = re.test(h) ? h.replace(re, balise) : h.replace("</head>", `    ${balise}\n  </head>`);
  };
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${echapper(titre)}</title>`);
  meta("name", "description", description);
  meta("property", "og:title", titre);
  meta("property", "og:description", description);
  meta("property", "og:url", url);
  meta("property", "og:type", "website");
  if (image) meta("property", "og:image", image);
  meta("name", "twitter:card", image ? "summary_large_image" : "summary");
  return h;
}
const photoDe = (p) => (p && (p.couverture || p.logo || ((p.galerie || [])[0] || {}).photo || ((p.produits || []).find((x) => x.photo) || {}).photo)) || "";

export default async function pagePro(req) {
  const url = new URL(req.url);
  const adresse = (url.pathname.match(/^\/p\/([^/]+)\/?$/) || [])[1] || "";
  const reponseSite = await fetch(new URL("/index.html", url.origin));
  let html = await reponseSite.text();
  let infos = { titre: "Page introuvable – Rebecca Services", description: "Professionnels partenaires de Rebecca Services.", url: url.href, image: "" };
  let statut = 404;
  if (ADRESSE_OK.test(adresse)) {
    try {
      const r = await fetch(`${BASE}/pagesPubliques/${adresse}?key=${CLE_API}`);
      if (r.ok) {
        const doc = await r.json();
        const p = JSON.parse(((doc.fields || {}).json || {}).stringValue || "null");
        if (p && p.statut === "publiee") {
          const seo = p.seo || {};
          const photo = photoDe(p);
          infos = { titre: seo.titre || p.nom, description: seo.description || p.accroche || "", url: `${url.origin}/p/${adresse}`, image: photo ? `${url.origin}/p-photo/${photo}.jpg` : "" };
          statut = 200;
        } else if (p) {
          infos = { ...infos, titre: `${p.nom || "Page"} – momentanément indisponible` };
          statut = 200;
        }
      }
    } catch {
      // Firebase injoignable : on renvoie quand meme le site, la page se chargera dans le navigateur
      statut = 200;
    }
  }
  html = remplacerEntete(html, infos);
  return new Response(html, { status: statut, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300" } });
}
