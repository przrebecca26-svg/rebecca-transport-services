import { useState } from "react";
import { KM_MAX_GRILLE, grilleKm, prixPro } from "../pricing/commercants.js";

// GRILLE DES PRIX SELON LES KM (20 nov. 2026, 9h43, Rebecca) : jusqu'à 3 km, 3 à 6, 6 à 9, 9 à 12 km
// (+ le même écart par tranche de 3 km), au-delà de 12 km sur devis. Avec un petit simulateur :
// « il va me poser la question, il faut que je puisse répondre ».
export default function GrilleKmResto({ tarifs, titre = "Prix selon la distance", essai = true }) {
  const [km, setKm] = useState("");
  const [lourds, setLourds] = useState("");
  const t = tarifs || {};
  const k = Number(String(km).replace(",", "."));
  const n = Math.max(0, Math.round(Number(lourds) || 0));
  const base = k > 0 ? prixPro(t, k) : null;
  const total = base == null ? null : base + n * (Number(t.tresLourd) || 0);
  return (
    <div>
      <p className="tb-note"><strong>{titre}</strong></p>
      <ul className="pm-resume">
        {grilleKm(t).map((x) => (
          <li key={x.a}><span>{x.de ? `De ${x.de} à ${x.a} km` : `Jusqu'à ${x.a} km`}</span><strong>{x.prix} ₪</strong></li>
        ))}
        <li><span>Au-delà de {KM_MAX_GRILLE} km</span><strong>sur devis</strong></li>
        <li><span>Commande en plus (même tournée)</span><strong>{Number(t.enPlus) || 0} ₪</strong></li>
        <li><span>Article très lourd</span><strong>+{Number(t.tresLourd ?? 5)} ₪</strong></li>
      </ul>
      {essai && (
        <div className="tb-actions" style={{ alignItems: "flex-end" }}>
          <label className="tb-note">Essayer : km<br /><input type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="ex. 8" style={{ width: 80 }} /></label>
          <label className="tb-note">articles très lourds<br /><input type="number" inputMode="numeric" min="0" max="30" value={lourds} onChange={(e) => setLourds(e.target.value)} placeholder="0" style={{ width: 80 }} /></label>
          <span className="tb-note">{k > 0 ? (total == null ? `${String(k).replace(".", ",")} km : sur devis` : <>→ <strong>{total} ₪</strong>{n ? ` (dont ${n * (Number(t.tresLourd) || 0)} ₪ d'articles lourds)` : ""}</>) : ""}</span>
        </div>
      )}
    </div>
  );
}
