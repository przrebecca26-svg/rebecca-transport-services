import { useEffect, useState } from "react";
import { TABLEAU_AEROPORT, adresseRecherche, choisirVol, etatDuVol, villeDuVol, volConsultable, volDeLaCourse } from "../pricing/vols.js";

// Suivi du vol d'une course aeroport (17 nov. 2026) : terminal, a deposer ou a recuperer, a l'heure ou en retard.
// Lecture du tableau officiel de l'aeroport Ben Gourion (data.gov.il), relue toutes les 5 minutes tant que l'ecran
// est ouvert. Si le tableau ne repond pas, on garde ce qui a ete saisi et un lien vers le tableau de l'aeroport.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const CINQ_MINUTES = 5 * 60 * 1000;
const memoire = new Map(); // numero -> { quand, promesse }

function lireTableau(numero) {
  const deja = memoire.get(numero);
  if (deja && Date.now() - deja.quand < CINQ_MINUTES - 5000) return deja.promesse;
  const promesse = fetch(adresseRecherche(numero))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("tableau"))))
    .then((j) => (j && j.success && j.result && Array.isArray(j.result.records) ? j.result.records : Promise.reject(new Error("tableau"))));
  memoire.set(numero, { quand: Date.now(), promesse });
  promesse.catch(() => memoire.delete(numero));
  return promesse;
}

export function useVol(d) {
  const vol = volDeLaCourse(d);
  const cle = vol ? `${vol.numero.compagnie}|${vol.numero.numero}|${vol.sens}|${vol.date}|${vol.heure}` : "";
  const [r, setR] = useState({ statut: "attente" });
  useEffect(() => {
    if (!vol) return undefined;
    if (!volConsultable(vol, aujourdhui())) {
      setR({ statut: "tot" });
      return undefined;
    }
    let actif = true;
    const lire = () =>
      lireTableau(vol.numero.numero)
        .then((lignes) => actif && setR({ statut: "ok", info: etatDuVol(choisirVol(lignes, vol), vol), a: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) }))
        .catch(() => actif && setR((o) => (o.statut === "ok" ? o : { statut: "erreur" })));
    lire();
    const id = setInterval(lire, CINQ_MINUTES);
    return () => {
      actif = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return vol ? { vol, ...r } : null;
}

// compact : une seule ligne (liste du jour) ; sinon bloc detaille (fiche de la course)
export default function InfoVol({ d, compact = false }) {
  const s = useVol(d);
  if (!s) return null;
  const { vol } = s;
  const v = d.details || {};
  const base = etatDuVol(null, vol);
  const terminalSaisi = !d.estRetour && v.terminal ? `Terminal ${v.terminal}` : "";
  const info = s.statut === "ok" && s.info.trouve ? s.info : null;
  let suite;
  if (info) suite = [info.terminal ? `Terminal ${info.terminal}` : terminalSaisi, info.etat].filter(Boolean).join(" · ");
  else if (s.statut === "attente") suite = [terminalSaisi, "recherche du vol…"].filter(Boolean).join(" · ");
  else if (s.statut === "tot") suite = [terminalSaisi, "suivi du vol à partir de la veille"].filter(Boolean).join(" · ");
  else if (s.statut === "erreur") suite = [terminalSaisi, "tableau de l'aéroport injoignable"].filter(Boolean).join(" · ");
  else suite = [terminalSaisi, "vol introuvable sur le tableau de l'aéroport (vérifie le numéro)"].filter(Boolean).join(" · ");
  const style = info && info.alerte ? { color: "#c0392b", fontWeight: 600 } : undefined;
  const mot = vol.sens === "depart" ? "Décollage" : "Atterrissage";
  const ville = villeDuVol(vol, info);

  if (compact) {
    return (
      <small style={style}>
        ✈️ {vol.texte.toUpperCase()}{ville ? ` ${ville}` : ""} · {base.action} · {suite}
        {info && Math.abs(info.ecartMinutes) >= 5 && !/annulé/.test(info.etat) ? ` (${info.nouvelle} au lieu de ${info.prevu})` : ""}
      </small>
    );
  }
  return (
    <div className="tb-bloc">
      <h3>✈️ Vol {d.estRetour ? "du retour " : ""}{vol.texte.toUpperCase()}{ville ? ` ${ville}` : ""}</h3>
      <p><strong>{base.action}</strong>{info && info.compagnie ? ` · ${info.compagnie}` : ""}</p>
      <p style={style}>{suite}</p>
      {info && <p>{mot} : {Math.abs(info.ecartMinutes) >= 5 ? `${info.nouvelle} au lieu de ${info.prevu}` : info.prevu}{info.suite ? ` · ${info.suite}` : ""}</p>}
      <p className="tb-note">
        {s.statut === "ok" ? `Tableau de l'aéroport Ben Gourion, lu à ${s.a}, relu toutes les 5 minutes. ` : ""}
        <a href={TABLEAU_AEROPORT} target="_blank" rel="noopener noreferrer">Voir le tableau de l'aéroport</a>
      </p>
    </div>
  );
}
