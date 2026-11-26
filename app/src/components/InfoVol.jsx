import { useEffect, useState } from "react";
import { trajetACalculer } from "../services.js";
import { kmEntre, MIN_PAR_KM } from "../pricing/coursesGroupees.js";
import { auth, db } from "../firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import { lienWhatsApp } from "../pricing/navigation.js";
import { TABLEAU_AEROPORT, arriveeConseillee, adresseRecherche, choisirVol, etatDuVol, iconeVol, lieuDuVol, villeDuVol, volConsultable, volDeLaCourse } from "../pricing/vols.js";

// Suivi du vol d'une course aeroport (17 nov. 2026) : terminal, a deposer ou a recuperer, a l'heure ou en retard.
// Lecture du tableau officiel de l'aeroport Ben Gourion (data.gov.il), relue toutes les 5 minutes tant que l'ecran
// est ouvert. Si le tableau ne repond pas, on garde ce qui a ete saisi et un lien vers le tableau de l'aeroport.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const CINQ_MINUTES = 5 * 60 * 1000;
const memoire = new Map(); // numero -> { quand, promesse }

export function lireTableau(numero) {
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

// Étape 3 (26 nov. 2026) : le vol bouge -> ma nouvelle heure conseillée, et ma journée tient-elle à cette heure-là ?
function NouvelleHeure({ d, info }) {
  const a = arriveeConseillee(d, info);
  const [verif, setVerif] = useState({ statut: "" });
  const cle = a ? `${d.id}|${d.estRetour ? "r" : "a"}|${a.conseillee}` : "";
  useEffect(() => {
    if (!a || !d.id) return undefined;
    let actif = true;
    setVerif({ statut: "calcul" });
    (async () => {
      try {
        const u = auth.currentUser;
        const jeton = u ? await u.getIdToken() : "";
        const corps = { demandeId: d.id, ...(d.estRetour ? { heureRetour: a.conseillee } : { heure: a.conseillee }) };
        const r = await fetch("/.netlify/functions/insertion", { method: "POST", headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) }, body: JSON.stringify(corps) });
        const o = r.ok ? await r.json() : null;
        if (actif) setVerif(o && o.possible != null ? { statut: "ok", ...o } : { statut: "erreur" });
      } catch {
        if (actif) setVerif({ statut: "erreur" });
      }
    })();
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  const [change, setChange] = useState("");
  if (!a) return null;
  const h = (x) => x.replace(":", "h");
  const changer = async () => {
    setChange("en cours");
    try {
      await updateDoc(doc(db, "demandes", d.id), d.estRetour ? { "details.heureRetour": a.conseillee, "details.margeVolRetour": a.marge } : { heure: a.conseillee, "details.margeVol": a.marge });
      setChange("fait");
    } catch {
      setChange("erreur");
    }
  };
  const prenom = String(d.nom || "").trim().split(" ")[0];
  const lienCliente = d.telephone ? lienWhatsApp(d.telephone, `Bonjour${prenom ? " " + prenom : ""}, c'est Rebecca 😊\nVotre vol a ${a.ecartVol > 0 ? `${a.ecartVol} min de retard` : `${-a.ecartVol} min d'avance`} : je serai là pour vous vers ${h(a.conseillee)} au lieu de ${h(a.prevue)}. À tout à l'heure !`) : null;
  return (
    <>
      <p style={{ color: "#c0392b", fontWeight: 600 }}>
        🕒 Sois là vers {h(a.conseillee)} au lieu de {h(a.prevue)} (vol {a.ecartVol > 0 ? `en retard de ${a.ecartVol}` : `en avance de ${-a.ecartVol}`} min, même écart de {a.marge} min après l'atterrissage).
      </p>
      {verif.statut === "calcul" && <p className="tb-note">Je vérifie ta journée à {h(a.conseillee)}…</p>}
      {verif.statut === "ok" && verif.possible && <p className="tb-note">✅ Ta journée tient à {h(a.conseillee)} (marge de {verif.marge} min avant et après tes autres rendez-vous). Pense à prévenir la cliente.</p>}
      {/* 26 nov. 2026 (Rebecca : « changer l'heure d'une course directement depuis la fiche du vol ») */}
      {d.id && (
        <div className="tb-actions">
          {change !== "fait" && <button type="button" className="tb-bouton" disabled={change === "en cours"} onClick={changer}>{change === "en cours" ? "Enregistrement…" : `Passer la course à ${h(a.conseillee)}`}</button>}
          {change === "fait" && <span className="tb-note">✅ Course passée à {h(a.conseillee)} : ta journée se recalcule.</span>}
          {lienCliente && <a className="tb-bouton tb-clair" href={lienCliente} target="_blank" rel="noopener noreferrer">Prévenir la cliente</a>}
        </div>
      )}
      {change === "erreur" && <p className="tb-note">Enregistrement impossible : vérifie la connexion.</p>}
      {verif.statut === "ok" && !verif.possible && (
        <p className="tb-note" style={{ color: "#c0392b" }}>⚠️ À {h(a.conseillee)}, un autre rendez-vous de ta journée n'est plus tenu{verif.proposition ? ` (première heure faisable : ${h(verif.proposition)})` : ""}. Regarde ton Calendrier ou confie une course à Jérémy.</p>
      )}
    </>
  );
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
  const lieu = lieuDuVol(vol, info);
  const icone = iconeVol(vol);
  const decale = info && Math.abs(info.ecartMinutes) >= 5 && !/annulé/.test(info.etat);
  // Heure du vol : celle du tableau (nouvelle heure si elle a bouge), sinon celle saisie
  const heureVol = info ? (decale ? `${info.nouvelle} au lieu de ${info.prevu}` : info.prevu) : (d.estRetour ? v.heureVolRetour : v.heureVol) || "";

  if (compact) {
    return (
      <small style={style}>
        {icone} {vol.texte.toUpperCase()}{ville ? ` ${ville}` : ""}{heureVol ? ` · ${mot.toLowerCase()} ${heureVol}` : ""} · {suite} · {base.action}
        {(() => {
          const a = info ? arriveeConseillee(d, info) : null;
          return a ? ` · 🕒 sois là vers ${a.conseillee.replace(":", "h")}` : "";
        })()}
      </small>
    );
  }
  // 25 nov. 2026 (Rebecca) : à titre d'information, l'heure de départ au plus tard pour être à l'aéroport 3 h avant
  // le décollage, même si la cliente a réservé une autre heure (trajet estimé depuis l'adresse de prise en charge)
  let conseil = "";
  const hm = /(\d{1,2})[:h](\d{2})/.exec(info && decale ? info.nouvelle || "" : heureVol || "");
  if (vol.sens === "depart" && hm) {
    const t = trajetACalculer(d.service, v);
    const de = t && (d.estRetour ? t.arrivee : t.depart);
    const vers = t && (d.estRetour ? t.depart : t.arrivee);
    const route = de && vers && Number.isFinite(de.lat) && Number.isFinite(vers.lat) ? Math.round(kmEntre(de, vers) * MIN_PAR_KM * 1.15) + 10 : null;
    const aeroport = Number(hm[1]) * 60 + Number(hm[2]) - 180;
    const fmt = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}h${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
    if (route) conseil = `À l'aéroport 3 h avant le décollage (${fmt(aeroport)}) : partir au plus tard vers ${fmt(aeroport - route)} (environ ${route} min de route + stationnement).`;
    else conseil = `À l'aéroport 3 h avant le décollage : ${fmt(aeroport)}.`;
  }
  const ligne = (titre, valeur, st) => (valeur ? <p style={st}><strong>{titre} :</strong> {valeur}</p> : null);
  return (
    <div className="tb-bloc">
      <h3>{icone} Vol {d.estRetour ? "du retour " : "de l'aller "}{vol.texte.toUpperCase()}</h3>
      <p><strong>{base.action}</strong>{d.estRetour && d.date ? ` · le ${d.date.split("-").reverse().join("/")}` : ""}</p>
      {ligne(vol.sens === "depart" ? "Destination" : "Provenance", lieu)}
      {ligne("Compagnie", info && info.compagnie)}
      {ligne(mot, heureVol, style)}
      {ligne("Terminal", info ? info.terminal || (!d.estRetour && v.terminal) : !d.estRetour && v.terminal)}
      {ligne("État", info ? [info.etat, info.suite].filter(Boolean).join(" · ") : suite, style)}
      {ligne("Enregistrement", info && info.comptoirs)}
      {conseil && <p><strong>🕒 Info :</strong> {conseil}</p>}
      {info && <NouvelleHeure d={d} info={info} />}
      <p className="tb-note">
        {s.statut === "ok" ? `Tableau de l'aéroport Ben Gourion, lu à ${s.a}, relu toutes les 5 minutes. ` : ""}
        <a href={TABLEAU_AEROPORT} target="_blank" rel="noopener noreferrer">Voir le tableau de l'aéroport</a>
      </p>
    </div>
  );
}
