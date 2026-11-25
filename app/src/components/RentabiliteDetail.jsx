import { analyserRentabilite } from "../pricing/engine.js";
import { TARIFS } from "../pricing/config.js";

// RENTABILITÉ DÉTAILLÉE (25 nov. 2026) - pour Rebecca seulement, jamais visible par la cliente.
// « Combien je gagne vraiment, combien de l'heure » : prix - coût réel de la voiture (tous les km, retour à vide
// compris, 1,20 ₪/km modifiable) ; temps = route + temps sur place. Commission d'un coursier partenaire en plus si besoin.
export function rentaDeLaDemande(d) {
  const prix = Number(d.prixFinal ?? d.prixEstime);
  const km = Number(d.kmEstime);
  if (!(prix >= 0) || !(km >= 0) || d.kmEstime == null) return null;
  const minutes = Number(d.minutesEstimees) || (km / 40) * 60;
  return analyserRentabilite({ service: d.service, aller: { km, minutes }, allerRetour: (d.details || {}).typeTrajet === "ar" }, prix);
}

export default function RentabiliteDetail({ r, commission = 0 }) {
  if (!r) return null;
  const min = TARIFS.rentabilite.seuilAlerteGainNetHeure;
  const net = r.gainNet - commission;
  const heure = Math.round((net / Math.max(r.minutesTotal || r.heuresTotal * 60, 1)) * 60);
  const ligne = (a, b) => <p style={{ margin: "2px 0", display: "flex", justifyContent: "space-between", gap: 8 }}><span>{a}</span><strong>{b}</strong></p>;
  return (
    <div className="tb-bloc" style={{ borderColor: heure < min ? "#e57373" : undefined }}>
      <h3>💰 Ce que tu gagnes vraiment <small>(toi seule)</small></h3>
      {ligne("Prix encaissé", `${r.encaisse} ₪`)}
      {ligne(`Kilomètres${r.retourAVide ? " (retour à vide compris)" : " (aller + retour)"}`, `${Math.round(r.kmTotal * 10) / 10} km`)}
      {ligne(`Voiture : essence ≈ ${r.carburant} ₪ + entretien (${r.coutParKm} ₪/km en tout)`, `− ${r.coutVehicule} ₪`)}
      {commission > 0 && ligne("Commission / part coursier", `− ${commission} ₪`)}
      {ligne(`Temps : route${r.surPlaceMinutes ? ` + ${r.surPlaceMinutes} min sur place` : ""}`, `${r.minutesTotal} min`)}
      {ligne("Gain net", `${net} ₪`)}
      {ligne("Soit de l'heure", `${heure} ₪/h`)}
      {heure < min ? <p className="fm-erreur">⚠️ Sous ton objectif de {min} ₪/h : propose un créneau flexible, regroupe avec une autre course, ou ajuste le prix.</p> : <p className="tb-note">✓ Au-dessus de ton objectif de {min} ₪/h.</p>}
      <p className="tb-note">Avant impôts et charges fixes. L'approche depuis la maison n'est comptée que si la course part de chez toi.</p>
    </div>
  );
}
