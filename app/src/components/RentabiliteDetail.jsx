import { analyserRentabilite } from "../pricing/engine.js";
import { kmEntre, MIN_PAR_KM } from "../pricing/coursesGroupees.js";
import { trajetACalculer } from "../services.js";
import { useTournee } from "../tourneeBase.js";

// RENTABILITÉ DÉTAILLÉE (25 nov. 2026) - pour Rebecca seulement, jamais visible par la cliente.
// Prix - coût réel de la voiture (essence + entretien/usure, 1,30 ₪/km depuis le 26 nov.) sur TOUS les km : approche depuis la maison,
// course, retour à vide ; temps = route (trafic des heures de pointe compris) + attente + temps sur place.
// 26 nov. 2026, 00h51 (Rebecca, audit ChatGPT) : objectif 55 ₪/h EN MOYENNE (pas sur chaque course).
// 🟢 65 et plus très rentable · 🟢 55 à 65 objectif atteint · 🟡 45 à 55 acceptable · 🟠 40 à 45 exceptionnel ou stratégique ·
// 🔴 moins de 40 à éviter sauf justification (amis, course regroupée).
export const niveauHeure = (h) =>
  h >= 65 ? { pastille: "🟢", texte: "Très rentable (65 ₪/h et plus)", couleur: "#2e9e6a" }
  : h >= 55 ? { pastille: "🟢", texte: "Objectif atteint (55 à 65 ₪/h)", couleur: "#2e9e6a" }
  : h >= 45 ? { pastille: "🟡", texte: "Acceptable (45 à 55 ₪/h)", couleur: "#c9b037" }
  : h >= 40 ? { pastille: "🟠", texte: "Exceptionnel ou stratégique (40 à 45 ₪/h)", couleur: "#e0a030" }
  : { pastille: "🔴", texte: "À éviter (moins de 40 ₪/h), sauf entre amis ou course regroupée", couleur: "#e57373" };
const fr = (x) => String(x).replace(".", ",");
const ok = (a) => a && Number.isFinite(a.lat) && Number.isFinite(a.lon);

// d = demande (service, details, date, heure, kmEstime, minutesEstimees, prixFinal/prixEstime)
export function rentaDeLaDemande(d, domicile = null) {
  const prix = Number(d.prixFinal ?? d.prixEstime);
  const km = Number(d.kmEstime);
  if (!(prix >= 0) || !(km >= 0) || d.kmEstime == null) return null;
  return calculerRenta(d, { km, minutes: Number(d.minutesEstimees) || (km / 40) * 60 }, prix, domicile);
}
export function calculerRenta(d, aller, prix, domicile = null) {
  const v = d.details || {};
  const t = trajetACalculer(d.service, v);
  const depart = t && (d.estRetour ? t.arrivee : t.depart);
  const approcheKm = ok(domicile) && ok(depart) ? kmEntre(domicile, depart) : 0;
  const approche = approcheKm > 0.3 ? { km: approcheKm, minutes: Math.max(3, Math.round(approcheKm * MIN_PAR_KM)) } : null;
  return analyserRentabilite({ service: d.service, date: d.date, heure: d.heure, aller, allerRetour: v.typeTrajet === "ar", attenteMinutes: Number(v.attenteMinutes) || 0, approche }, prix);
}

export default function RentabiliteDetail({ r: r0 = null, d = null, aller = null, prix = null, commission = 0 }) {
  const tournee = useTournee();
  const domicile = tournee.donnees && tournee.donnees.domicile;
  const r = d && aller && prix != null ? calculerRenta(d, aller, prix, domicile) : r0 || (d ? rentaDeLaDemande(d, domicile) : null);
  if (!r) return null;
  const net = r.gainNet - commission;
  const heure = Math.round((net / Math.max(r.minutesTotal, 1)) * 60);
  const ami = !!(d && d.prixAmi);
  const n = ami ? { pastille: "💛", texte: "Prix ami : faveur, pas comptée comme une course mal tarifée", couleur: "#e8a0b4" } : niveauHeure(heure);
  const ligne = (a, b) => <p style={{ margin: "2px 0", display: "flex", justifyContent: "space-between", gap: 8 }}><span>{a}</span><strong style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{b}</strong></p>;
  return (
    <div className="tb-bloc" style={{ borderColor: n.couleur }}>
      <h3>{n.pastille} Ce que tu gagnes vraiment <small>(toi seule)</small></h3>
      {ligne("Prix encaissé", `${r.encaisse} ₪`)}
      {ligne(`Kilomètres : ${r.approcheKm ? `approche ${fr(r.approcheKm)} km + ` : ""}course${r.retourAVide ? " + retour à vide" : " aller-retour"}`, `${fr(Math.round(r.kmTotal * 10) / 10)} km`)}
      {ligne(`Voiture : essence ≈ ${r.carburant} ₪ + entretien et usure (${fr(r.coutParKm)} ₪/km en tout)`, `− ${r.coutVehicule} ₪`)}
      {commission > 0 && ligne("Commission / part coursier", `− ${commission} ₪`)}
      {ligne(`Temps : route${r.traficMinutes ? ` (dont ${r.traficMinutes} min de trafic)` : ""}${r.attenteMinutes ? ` + ${r.attenteMinutes} min d'attente` : ""}${r.surPlaceMinutes ? ` + ${r.surPlaceMinutes} min sur place` : ""}`, `${r.minutesTotal} min`)}
      {ligne("Gain net", `${net} ₪`)}
      {ligne("Soit de l'heure", `${n.pastille} ${heure} ₪/h`)}
      <p style={{ color: n.couleur, margin: "4px 0" }}><strong>{n.texte}</strong>{!ami && heure < 45 ? " : propose un créneau flexible, regroupe avec une autre course, ou ajuste le prix." : ""}</p>
      <p className="tb-note">Avant impôts et charges fixes. {r.approcheKm ? "Approche comptée depuis ta maison." : "Approche non comptée (départ = chez toi ou adresse inconnue)."}</p>
    </div>
  );
}
