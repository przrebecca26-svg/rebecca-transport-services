// PDF SIMPLE (19 nov. 2026) - Rebecca Services
// Sur iPhone, depuis l'icône de l'écran d'accueil, Apple bloque « Imprimer » : le bouton ne faisait rien ou fermait
// la page. On fabrique donc nous-mêmes un vrai fichier PDF (texte, traits, rectangles de couleur, une page A4),
// sans aucune bibliothèque, puis on l'envoie à la feuille de partage de l'iPhone (WhatsApp, Fichiers, e-mail…).
// Police Helvetica intégrée aux lecteurs PDF (codage WinAnsi) : les accents français passent ; le signe ₪ devient
// « ILS » ; l'hébreu (pas dans cette police) devient « ? ».

export const A4 = { largeur: 595.28, hauteur: 841.89 };

// Caractères hors Latin-1 présents dans WinAnsi
const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99, "œ": 0x9c, "Œ": 0x8c };

// Texte -> octets WinAnsi (tableau de nombres)
export function versWinAnsi(texte) {
  const s = String(texte == null ? "" : texte).replace(/₪/g, "ILS").replace(/\s*[✓✔]/g, "").replace(/ | /g, " ");
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (WIN[ch]) out.push(WIN[ch]);
    else if (c >= 32 && c <= 126) out.push(c);
    else if (c >= 160 && c <= 255) out.push(c);
    else if (c === 10 || c === 9) out.push(32);
    else out.push(63); // « ? »
  }
  return out;
}

// Largeur approximative d'un texte en points (Helvetica), pour centrer ou aligner à droite
export function largeurTexte(texte, taille, gras = false) {
  let w = 0;
  for (const b of versWinAnsi(texte)) {
    const ch = String.fromCharCode(b);
    if (" .,:;'!|iljtfI".includes(ch)) w += 0.28;
    else if (/[0-9]/.test(ch)) w += 0.556;
    else if ("mwMW@".includes(ch)) w += 0.85;
    else if (/[A-Z]/.test(ch) || b >= 0xc0 && b <= 0xde) w += 0.68;
    else w += 0.53;
  }
  return w * taille * (gras ? 1.06 : 1);
}

const couleur = (hex, def = "#000000") => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || def)) || /^#?([0-9a-f]{6})$/i.exec(def);
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (Math.round((v / 255) * 1000) / 1000).toString()).join(" ");
};
const num = (x) => (Math.round(Number(x) * 100) / 100).toString();
const echapper = (octets) => octets.map((b) => (b === 40 || b === 41 || b === 92 ? [92, b] : [b])).flat();

// Coupe un texte trop long en plusieurs lignes (largeur max en points)
export function couper(texte, taille, largeurMax, gras = false) {
  const mots = String(texte || "").split(/\s+/).filter(Boolean);
  const lignes = [];
  let l = "";
  for (const m of mots) {
    const essai = l ? l + " " + m : m;
    if (l && largeurTexte(essai, taille, gras) > largeurMax) {
      lignes.push(l);
      l = m;
    } else l = essai;
  }
  if (l) lignes.push(l);
  return lignes.length ? lignes : [""];
}

// elements : { t: "texte", x, y, texte, taille, gras, couleur, align: "gauche"|"centre"|"droite" }
//            { t: "trait", x1, y1, x2, y2, couleur, epaisseur }
//            { t: "rect", x, y, w, h, fond, bord, epaisseur }
// (y compté depuis le HAUT de la page, comme à l'écran)
// -> Uint8Array du fichier PDF
export function fabriquerPdf({ largeur = A4.largeur, hauteur = A4.hauteur, fond = "", elements = [], titre = "" } = {}) {
  return fabriquerPdfPages({ largeur, hauteur, fond, pages: [elements], titre });
}

// 19 nov. 2026 : plusieurs pages (contrat des restaurants partenaires). pages = [[elements], [elements], ...]
export function fabriquerPdfPages({ largeur = A4.largeur, hauteur = A4.hauteur, fond = "", pages = [[]], titre = "" } = {}) {
  const contenus = pages.map((elements) => {
    const flux = []; // octets du contenu de la page
    const ecrire = (s) => { for (const ch of s) flux.push(ch.charCodeAt(0) & 255); };
    if (fond) ecrire(`${couleur(fond)} rg 0 0 ${num(largeur)} ${num(hauteur)} re f\n`);
    for (const e of elements) {
      if (e.t === "rect") {
        const y = hauteur - e.y - e.h;
        if (e.fond) ecrire(`${couleur(e.fond)} rg ${num(e.x)} ${num(y)} ${num(e.w)} ${num(e.h)} re f\n`);
        if (e.bord) ecrire(`${couleur(e.bord)} RG ${num(e.epaisseur || 1)} w ${num(e.x)} ${num(y)} ${num(e.w)} ${num(e.h)} re S\n`);
      } else if (e.t === "trait") {
        ecrire(`${couleur(e.couleur, "#cccccc")} RG ${num(e.epaisseur || 0.8)} w 1 J ${num(e.x1)} ${num(hauteur - e.y1)} m ${num(e.x2)} ${num(hauteur - e.y2)} l S\n`);
      } else if (e.t === "texte") {
        const taille = e.taille || 11;
        const w = largeurTexte(e.texte, taille, e.gras);
        const x = e.align === "centre" ? e.x - w / 2 : e.align === "droite" ? e.x - w : e.x;
        ecrire(`BT /${e.gras ? "F2" : "F1"} ${num(taille)} Tf ${couleur(e.couleur)} rg ${num(x)} ${num(hauteur - e.y)} Td (`);
        for (const b of echapper(versWinAnsi(e.texte))) flux.push(b);
        ecrire(") Tj ET\n");
      }
    }
    return flux;
  });
  const n = contenus.length;
  // Objets : 1 catalogue, 2 pages, 3-4 polices, puis pour chaque page : la page et son contenu, puis les infos
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${contenus.map((_, i) => `${5 + 2 * i} 0 R`).join(" ")}] /Count ${n} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  contenus.forEach((flux, i) => {
    objets.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(largeur)} ${num(hauteur)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`);
    objets.push(flux);
  });
  objets.push(`<< /Title (${String.fromCharCode(...echapper(versWinAnsi(titre || "Rebecca Services")))}) /Producer (Rebecca Services) >>`);
  const sortie = [];
  const ajouter = (s) => { for (const ch of s) sortie.push(ch.charCodeAt(0) & 255); };
  ajouter("%PDF-1.4\n%âãÏÓ\n");
  const positions = [];
  objets.forEach((o, i) => {
    positions.push(sortie.length);
    ajouter(`${i + 1} 0 obj\n`);
    if (Array.isArray(o)) {
      ajouter(`<< /Length ${o.length} >>\nstream\n`);
      for (const b of o) sortie.push(b);
      ajouter("\nendstream");
    } else ajouter(o);
    ajouter("\nendobj\n");
  });
  const xref = sortie.length;
  ajouter(`xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`);
  for (const p of positions) ajouter(`${String(p).padStart(10, "0")} 00000 n \n`);
  ajouter(`trailer\n<< /Size ${objets.length + 1} /Root 1 0 R /Info ${objets.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Uint8Array(sortie);
}

// Envoie le PDF : feuille de partage de l'iPhone si possible, sinon téléchargement
export async function partagerPdf(octets, nomFichier, titre = "") {
  const fichier = typeof File !== "undefined" ? new File([octets], nomFichier, { type: "application/pdf" }) : null;
  try {
    if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: titre || nomFichier });
      return "partage";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "annule";
  }
  const url = URL.createObjectURL(new Blob([octets], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "telecharge";
}
