import { useEffect, useState } from "react";
import AddressField from "./AddressField.jsx";
import ChoixLieu from "./MesLieux.jsx";
import { lireTableau } from "./InfoVol.jsx";
import { calculerDurees } from "../routing.js";
import { kmEntre } from "../pricing/coursesGroupees.js";
import { AEROPORT_BEN_GOURION } from "../pricing/tournee.js";
import { dureeFr, planTacheVol, reglagesVol, volDuJour } from "../pricing/planVol.js";

// 26 nov. 2026 (18h27, Rebecca) : tâche « Transport / aéroport » du Calendrier, comme une fiche de vol.
// « Je la récupère à l'aéroport » : son vol, l'heure où je la récupère, son adresse -> à quelle heure je pars de la maison,
// quand je la dépose, quand je suis rentrée. « Je l'amène à l'aéroport » : l'heure où je la prends chez elle et son vol
// -> à quelle heure elle arrive, avec combien d'avance sur le vol, et mon retour. Tout le créneau est bloqué tout seul.

const ok = (a) => !!(a && typeof a.lat === "number" && typeof a.lon === "number");
const h = (x) => String(x || "").replace(":", "h");
// Secours si le calcul d'itinéraire ne répond pas : distance à vol d'oiseau, route ~1,3 fois plus longue à 55 km/h
const estimer = (a, b) => (ok(a) && ok(b) ? Math.max(3, Math.round(((kmEntre(a, b) * 1.3) / 55) * 60)) : null);

function useTempsDeRoute(maison, adresse) {
  const cle = ok(maison) && ok(adresse) ? `${maison.lat},${maison.lon}|${adresse.lat},${adresse.lon}` : "";
  const [r, setR] = useState({ cle: "", d: null, estime: false });
  useEffect(() => {
    if (!cle) return undefined;
    const ctrl = new AbortController();
    const aero = AEROPORT_BEN_GOURION;
    const memeEndroit = kmEntre(maison, adresse) < 0.15;
    calculerDurees([maison, adresse, aero], ctrl.signal)
      .then((m) => setR({ cle, estime: false, d: { maisonAdresse: memeEndroit ? 0 : m[0][1], adresseAeroport: m[1][2], maisonAeroport: m[0][2] } }))
      .catch((e) => {
        if (e && e.name === "AbortError") return;
        setR({ cle, estime: true, d: { maisonAdresse: memeEndroit ? 0 : estimer(maison, adresse), adresseAeroport: estimer(adresse, aero), maisonAeroport: estimer(maison, aero) } });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return r.cle === cle ? r : { d: null, estime: false };
}

// f = champs du formulaire : volSens, volNumero, volHeure, volTerminal, volMoi (mon heure), prise (vers), lieu (depuis)
export default function FicheVolTache({ f, set, date, maison, connues, idBase, onPlan }) {
  const [cherche, setCherche] = useState("");
  const vers = f.volSens === "vers";
  const adresse = vers ? f.prise : f.lieu;
  const route = useTempsDeRoute(maison, adresse);
  const plan = route.d ? planTacheVol({ sens: f.volSens, date, heure: f.volMoi, heureVol: f.volHeure }, route.d) : null;
  const cleP = plan ? `${plan.partir}|${plan.prise}|${plan.depose}|${plan.retour}` : "";
  useEffect(() => {
    onPlan(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleP]);
  const { avance, apres } = reglagesVol();

  const chercher = async () => {
    setCherche("…");
    try {
      const lignes = await lireTableau(String(f.volNumero || "").replace(/\D/g, ""));
      const r = volDuJour(lignes, f.volNumero, date, vers ? "vers" : "depuis");
      if (!r) return setCherche("Vol introuvable ce jour-là sur le tableau de l'aéroport (il n'affiche que les vols des prochains jours) : tape l'heure du vol, tu pourras revérifier la veille.");
      set("volHeure", r.heure);
      if (r.terminal) set("volTerminal", r.terminal);
      // Je la récupère : je propose d'être là 30 min après l'atterrissage (bagages)
      if (!vers && !f.volMoi) {
        const [hh, mm] = r.heure.split(":").map(Number);
        const t = (hh * 60 + mm + apres) % 1440;
        set("volMoi", `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      }
      setCherche(`✅ Vol trouvé : ${vers ? "décolle" : "atterrit"} à ${h(r.heure)}${r.terminal ? `, terminal ${r.terminal}` : ""}${r.ville ? ` (${r.ville.charAt(0) + r.ville.slice(1).toLowerCase()})` : ""}.`);
    } catch {
      setCherche("Tableau de l'aéroport injoignable : tape l'heure du vol.");
    }
    return undefined;
  };

  return (
    <>
      <div className="ag-champ">Numéro de vol
        <input type="text" maxLength={12} placeholder="LY 316, W6 2811…" value={f.volNumero} onChange={(x) => set("volNumero", x.target.value.toUpperCase())} />
      </div>
      {String(f.volNumero || "").replace(/\D/g, "") && <button type="button" className="ag-modifier" onClick={chercher}>🔎 Retrouver l'heure du vol {f.volNumero}</button>}
      {cherche && <p className="tb-note">{cherche}</p>}
      <div className="ag-heures">
        <label className="ag-champ">{vers ? "Heure du décollage" : "Heure d'atterrissage"} <input type="time" value={f.volHeure} onChange={(x) => set("volHeure", x.target.value)} /></label>
        <label className="ag-champ">Terminal
          <select value={f.volTerminal} onChange={(x) => set("volTerminal", x.target.value)}>
            <option value="3">3</option>
            <option value="1">1</option>
          </select>
        </label>
      </div>
      <div className="ag-champ">{vers ? "Où je la prends (son adresse)" : "Où je la dépose (son adresse)"}
        <ChoixLieu id={idBase + "-cl"} connues={connues} valeur={adresse || null} choisir={(v) => set(vers ? "prise" : "lieu", v)} />
        <AddressField id={idBase + "-ad"} valeur={adresse || null} position={false} onChange={(v) => set(vers ? "prise" : "lieu", v)} />
        {ok(maison) && <button type="button" className="ag-modifier" onClick={() => set(vers ? "prise" : "lieu", maison)}>🏠 Chez moi</button>}
      </div>
      <label className="ag-champ">{vers ? "Je la prends chez elle à" : "Je la récupère à l'aéroport à"} <input type="time" value={f.volMoi} onChange={(x) => set("volMoi", x.target.value)} /></label>
      {!vers && f.volHeure && <p className="tb-note">Conseillé : {apres} min après l'atterrissage, pour les bagages ({h(plan ? plan.conseil : "")}).</p>}

      {!ok(maison) && <p className="tb-note">⚠️ Ton adresse de départ (la maison) n'est pas enregistrée dans ta tournée : je ne peux pas calculer l'heure de départ.</p>}
      {ok(maison) && ok(adresse) && !route.d && <p className="tb-note">Calcul des temps de route…</p>}
      {plan && (
        <div className="tb-note" style={{ borderLeft: "3px solid #e8a9b4", paddingLeft: 8 }}>
          <b>Ta journée</b>
          <br />🚗 Partir de la maison à <b>{h(plan.partir)}</b>
          <br />{vers ? `👤 Je la prends à ${h(plan.prise)}` : `🛬 Je la récupère à l'aéroport à ${h(plan.prise)}`}
          <br />{vers ? `✈️ Arrivée à l'aéroport vers ${h(plan.depose)}` : `📍 Je la dépose vers ${h(plan.depose)}`}
          <br />🏠 De retour à la maison vers <b>{h(plan.retour)}</b>
          <br />Créneau bloqué de {h(plan.partir)} à {h(plan.retour)}, heures de pointe comprises{route.estime ? " (temps de route estimés : le calcul d'itinéraire n'a pas répondu)" : ""}.
          {vers && plan.avance != null && (
            <p className={plan.alerte ? "dr-alerte-min" : ""} style={{ margin: "6px 0 0" }}>
              {plan.avance >= 0 ? `Elle est à l'aéroport ${dureeFr(plan.avance)} avant le vol` : `⚠️ Elle arrive ${dureeFr(plan.avance)} APRÈS le vol`} (conseillé : {dureeFr(avance)}).
              {plan.alerte && <> Pour être à l'heure, prends-la vers <b>{h(plan.conseil)}</b>. <button type="button" className="ag-modifier" onClick={() => set("volMoi", plan.conseil)}>Prendre {h(plan.conseil)}</button></>}
            </p>
          )}
          {!vers && plan.alerte && (
            <p className="dr-alerte-min" style={{ margin: "6px 0 0" }}>
              ⚠️ {plan.alerte === "avant" ? "Tu serais là avant l'atterrissage." : "C'est juste pour les bagages."} Sois plutôt là vers <b>{h(plan.conseil)}</b>. <button type="button" className="ag-modifier" onClick={() => set("volMoi", plan.conseil)}>Prendre {h(plan.conseil)}</button>
            </p>
          )}
        </div>
      )}
    </>
  );
}
