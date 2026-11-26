import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

// 26 nov. 2026 (Rebecca) : « kit marketing » dans l'espace de chaque pro partenaire.
// Le pro fabrique ses visuels (publication carrée, story) avec SON nom et le QR code de SA fiche
// (rebeccaservices.com/#/pros/<id>). Aucun tarif sur les visuels. Tout est dessiné sur le téléphone (rien n'est envoyé).
export const lienFichePro = (proId) => `https://rebeccaservices.com/#/pros/${proId}`;
export const FORMATS_VISUEL = { post: { l: 1080, h: 1080, nom: "Publication (carré)" }, story: { l: 1080, h: 1920, nom: "Story / statut WhatsApp" } };
export const MODELES_VISUEL = {
  classique: { nom: "Classique", fond: ["#2e1c20", "#0d0a0b"], titre: "#f3d3d8", accent: "#f1aeb7", deco: "" },
  hanouka: { nom: "Hanouka", fond: ["#14213d", "#070b16"], titre: "#f6e7b0", accent: "#e9c46a", deco: "🕎", voeu: "Hanouka Saméa'h !" },
};
export function messageVisuel(nom, proId, accroche) {
  return `✨ ${nom}\n${accroche ? accroche + "\n" : ""}Réservez directement en ligne 👉 ${lienFichePro(proId)}`;
}

function lignes(ctx, texte, max) {
  const mots = String(texte || "").split(/\s+/); const res = []; let l = "";
  for (const m of mots) { const t = l ? `${l} ${m}` : m; if (ctx.measureText(t).width > max && l) { res.push(l); l = m; } else l = t; }
  if (l) res.push(l);
  return res;
}

export async function dessiner(canvas, { format, modele, nom, metier, accroche, proId }) {
  const F = FORMATS_VISUEL[format]; const M = MODELES_VISUEL[modele];
  canvas.width = F.l; canvas.height = F.h;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(F.l / 2, 0, 50, F.l / 2, 0, F.h);
  g.addColorStop(0, M.fond[0]); g.addColorStop(0.65, M.fond[1]); c.fillStyle = g; c.fillRect(0, 0, F.l, F.h);
  c.strokeStyle = "#c9907a"; c.lineWidth = 3; c.beginPath(); c.roundRect(30, 30, F.l - 60, F.h - 60, 30); c.stroke();
  c.textAlign = "center"; let y = format === "story" ? 260 : 150;
  if (M.deco) { c.font = "110px serif"; c.fillText(M.deco, F.l / 2, y); y += 80; }
  if (M.voeu) { c.fillStyle = M.accent; c.font = "700 48px Georgia, serif"; c.fillText(M.voeu, F.l / 2, y); y += 80; }
  c.fillStyle = "#d9a48f"; c.font = "600 30px Inter, sans-serif"; c.fillText((metier || "Professionnel partenaire").toUpperCase(), F.l / 2, y); y += 90;
  c.fillStyle = M.titre; c.font = "700 76px Georgia, serif";
  for (const l of lignes(c, nom, F.l - 160).slice(0, 2)) { c.fillText(l, F.l / 2, y); y += 88; }
  if (accroche) { c.fillStyle = M.accent; c.font = "italic 42px Georgia, serif"; y += 10; for (const l of lignes(c, accroche, F.l - 180).slice(0, 3)) { c.fillText(l, F.l / 2, y); y += 54; } }
  const taille = format === "story" ? 560 : 380;
  const qr = new Image(); qr.src = await QRCode.toDataURL(lienFichePro(proId), { margin: 1, width: taille, color: { dark: "#111111", light: "#ffffff" } });
  await new Promise((ok) => { qr.onload = ok; qr.onerror = ok; });
  const qy = format === "story" ? Math.max(y + 60, 900) : F.h - taille - 210;
  c.fillStyle = "#fbf7f2"; c.beginPath(); c.roundRect((F.l - taille) / 2 - 26, qy - 26, taille + 52, taille + 52, 28); c.fill();
  c.drawImage(qr, (F.l - taille) / 2, qy, taille, taille);
  c.fillStyle = M.accent; c.font = "700 38px Inter, sans-serif"; c.fillText("📷 Scannez pour réserver", F.l / 2, qy + taille + 90);
  c.fillStyle = "#d8c9c6"; c.font = "26px Inter, sans-serif"; c.fillText("Annuaire des professionnels · rebeccaservices.com", F.l / 2, F.h - 70);
}

export default function ProVisuels({ proId, nom, metier: metierInitial }) {
  const [metier, setMetier] = useState(metierInitial || "");
  const ref = useRef(null);
  const [format, setFormat] = useState("post");
  const [modele, setModele] = useState("classique");
  const [accroche, setAccroche] = useState("Prenez rendez-vous en ligne");
  const [image, setImage] = useState("");
  useEffect(() => {
    let fini = false;
    dessiner(ref.current, { format, modele, nom, metier, accroche, proId }).then(() => { if (!fini) setImage(ref.current.toDataURL("image/png")); }).catch(() => {});
    return () => { fini = true; };
  }, [format, modele, nom, metier, accroche, proId]);
  const partager = async () => {
    try {
      const blob = await (await fetch(image)).blob();
      const fichier = new File([blob], `visuel-${format}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], text: messageVisuel(nom, proId, accroche) }); return; }
    } catch { /* partage annulé */ }
    const a = document.createElement("a"); a.href = image; a.download = `visuel-${format}.png`; a.click();
  };
  return (
    <div className="pp-bloc">
      <h3>🎨 Mes visuels</h3>
      <p className="tb-note">Tes visuels prêts à publier, avec le QR code de ta fiche. Tes clientes scannent et réservent directement.</p>
      <div className="tb-actions">
        {Object.entries(FORMATS_VISUEL).map(([k, f]) => <button key={k} type="button" className={format === k ? "pp-bouton" : "bouton-secondaire"} onClick={() => setFormat(k)}>{f.nom}</button>)}
      </div>
      <div className="tb-actions">
        {Object.entries(MODELES_VISUEL).map(([k, m]) => <button key={k} type="button" className={modele === k ? "pp-bouton" : "bouton-secondaire"} onClick={() => setModele(k)}>{m.nom}</button>)}
      </div>
      <label className="champ">Ton métier (ex. Onglerie)
        <input value={metier} maxLength={40} onChange={(e) => setMetier(e.target.value)} />
      </label>
      <label className="champ">Ta phrase (sans prix)
        <input value={accroche} maxLength={70} onChange={(e) => setAccroche(e.target.value)} />
      </label>
      <canvas ref={ref} style={{ display: "none" }} />
      {image && <img src={image} alt="Aperçu du visuel" style={{ width: "100%", maxWidth: 360, borderRadius: 14, display: "block", margin: "12px auto" }} />}
      <div className="tb-actions">
        <button type="button" className="pp-bouton" onClick={partager} disabled={!image}>📤 Enregistrer / partager l'image</button>
        <a className="bouton-secondaire" href={`https://wa.me/?text=${encodeURIComponent(messageVisuel(nom, proId, accroche))}`} target="_blank" rel="noopener noreferrer">💬 Texte WhatsApp</a>
      </div>
      <p className="tb-note">Sur iPhone : « Enregistrer l'image » la met dans tes photos. Ton lien : {lienFichePro(proId)}</p>
    </div>
  );
}
