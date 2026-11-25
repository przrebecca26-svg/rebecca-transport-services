import { useState } from "react";
import { niveauHeure } from "./RentabiliteDetail.jsx";
import { TARIFS } from "../pricing/config.js";

// SIMULATION DU PALIER VOLUME (formule B) - 25 nov. 2026, avant validation définitive par Rebecca.
// Proposition : dans un même créneau B, à partir de la 10e livraison, chaque livraison passe au prix volume
// (20 ₪ ≤ 3 km, 30 ₪ de 3 à 6 km), seulement si les livraisons sont regroupables en tournées.
// Le calcul : km = tournées (aller-retour au restaurant) + petits trajets entre clients ; temps = tout le créneau.
export default function SimulateurVolume({ tarifsB = { jusqua3: 25, de3a6: 35 } }) {
  const [heures, setHeures] = useState(3);
  const [nb, setNb] = useState(12);
  const [km, setKm] = useState(3);
  const [parTournee, setParTournee] = useState(3);
  const [seuil, setSeuil] = useState(10);
  const [v3, setV3] = useState(20);
  const [v6, setV6] = useState(30);
  const prixB = km <= 3 ? tarifsB.jusqua3 : tarifsB.de3a6;
  const prixV = km <= 3 ? v3 : v6;
  const tournees = Math.ceil(nb / Math.max(1, parTournee));
  const kmTotal = Math.round((tournees * 2 * km + Math.max(0, nb - tournees) * 1.5) * 10) / 10;
  const cout = kmTotal * (TARIFS.rentabilite.coutKmReel || 1.2);
  const minimum = heures * 75;
  const sans = Math.max(minimum, nb * prixB);
  const avec = Math.max(minimum, Math.min(nb, seuil - 1) * prixB + Math.max(0, nb - seuil + 1) * prixV);
  const ligne = (titre, ca) => {
    const net = Math.round(ca - cout);
    const h = Math.round(net / heures);
    const n = niveauHeure(h);
    return <p style={{ display: "flex", justifyContent: "space-between" }}><span>{titre}</span><strong>{ca} ₪ → net {net} ₪ · {n.pastille} {h} ₪/h</strong></p>;
  };
  const curseur = (label, val, set, min, max, pas = 1) => (
    <label className="champ">{label} : <b>{val}</b><input type="range" min={min} max={max} step={pas} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%" }} /></label>
  );
  return (
    <div className="tb-bloc">
      <h3>🧮 Simulation du palier volume (formule B)</h3>
      <p className="tb-note">✅ Validé le 25 nov. 2026 : dans le contrat (version 2026-11-25) et appliqué automatiquement à partir de la 10e livraison d'un créneau (20 ₪ ≤ 3 km, 30 ₪ de 3 à 6 km).</p>
      {curseur("Durée du créneau (h)", heures, setHeures, 2, 5, 0.5)}
      {curseur("Livraisons dans le créneau", nb, setNb, 1, 25)}
      {curseur("Distance moyenne restaurant → client (km)", km, setKm, 1, 6, 0.5)}
      {curseur("Livraisons par tournée (regroupement)", parTournee, setParTournee, 1, 7)}
      {curseur("Palier volume à partir de la livraison n°", seuil, setSeuil, 5, 15)}
      {curseur("Prix volume ≤ 3 km (₪)", v3, setV3, 15, 30)}
      {curseur("Prix volume 3-6 km (₪)", v6, setV6, 20, 40)}
      <p className="tb-note">{tournees} tournée(s) · environ {kmTotal} km · voiture ≈ {Math.round(cout)} ₪ · minimum du créneau {minimum} ₪</p>
      {ligne("Formule B actuelle", sans)}
      {ligne("Avec le palier volume", avec)}
      <p className="tb-note">Le restaurant économise {sans - avec} ₪ sur ce créneau. Si le palier passe en 🔴, il ne faut pas l'accepter sans regroupement.</p>
    </div>
  );
}
