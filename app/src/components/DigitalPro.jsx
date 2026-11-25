import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// VOTRE ESPACE PRO SUR REBECCA SERVICES (25 nov. 2026, grille de lancement validée par Rebecca)
// Vitrine (page pro + WhatsApp/RDV) et Business (Vitrine + espace admin à modules). Prix modifiables dans l'admin
// (document public reglages/digitalPro). Pas de module de factures : un logiciel agréé en Israël pourra être relié plus tard.
export const GRILLE_DEPART = {
  vitrine: { creation: 490, mois: 59 },
  business: { creation: 990, mois: 99 },
  modules: [
    { id: "agenda", nom: "Agenda et rendez-vous", creation: 390, mois: 29 },
    { id: "clients", nom: "Fichier clients", creation: 290, mois: 19 },
    { id: "devis", nom: "Devis PDF", creation: 290, mois: 19 },
    { id: "paiements", nom: "Suivi des paiements et acomptes", creation: 290, mois: 19 },
    { id: "rappels", nom: "Rappels automatiques", creation: 290, mois: 19 },
    { id: "stats", nom: "Statistiques", creation: 190, mois: 15 },
    { id: "catalogue", nom: "Catalogue et commandes", creation: 490, mois: 29 },
  ],
  packPro: { creation: 890, mois: 59, contenu: "Agenda, fichier clients, rappels et statistiques" },
  engagementMois: 6,
};
export function useGrilleDigitalPro() {
  const [g, setG] = useState(GRILLE_DEPART);
  useEffect(() => onSnapshot(doc(db, "reglages", "digitalPro"), (s) => { try { if (s.exists()) setG({ ...GRILLE_DEPART, ...JSON.parse(s.data().json || "{}") }); } catch { /* grille de départ */ } }, () => {}), []);
  return g;
}

export default function DigitalPro() {
  const g = useGrilleDigitalPro();
  const [choix, setChoix] = useState([]);
  const somme = (k) => choix.reduce((s, id) => s + ((g.modules.find((m) => m.id === id) || {})[k] || 0), 0);
  const message = `Bonjour Rebecca, je suis intéressé(e) par un espace pro sur Rebecca Services${choix.length ? ` (Business + ${choix.map((id) => (g.modules.find((m) => m.id === id) || {}).nom).join(", ")})` : ""}. Pouvez-vous me rappeler ?`;
  return (
    <div className="bloc" style={{ padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>Votre espace pro sur Rebecca Services</h3>
      <p>Pour les indépendants et commerçants : votre page professionnelle sur rebeccaservices.com, sans payer un site complet.</p>
      <div className="pp-avantages">
        <div className="pp-avantage"><span>🌸</span><div><b>Vitrine · {g.vitrine.creation} ₪ puis {g.vitrine.mois} ₪/mois</b><small>Votre page : présentation, photos, prestations et tarifs, boutons WhatsApp, téléphone, Instagram, prise de rendez-vous.</small></div></div>
        <div className="pp-avantage"><span>💼</span><div><b>Business · {g.business.creation} ₪ puis {g.business.mois} ₪/mois</b><small>La Vitrine + votre espace de gestion sur votre téléphone : vous changez vous-même prix, photos et prestations. Modules au choix.</small></div></div>
      </div>
      <p><b>Modules Business</b> (création · par mois) :</p>
      {g.modules.map((m) => (
        <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={choix.includes(m.id)} onChange={() => setChoix(choix.includes(m.id) ? choix.filter((x) => x !== m.id) : [...choix, m.id])} />
          <span>{m.nom} · {m.creation} ₪ · +{m.mois} ₪/mois</span>
        </label>
      ))}
      <p><b>Pack Pro · {g.packPro.creation} ₪ + {g.packPro.mois} ₪/mois</b> : {g.packPro.contenu}.</p>
      {choix.length > 0 && <p>Votre estimation Business : <b>{g.business.creation + somme("creation")} ₪</b> puis <b>{g.business.mois + somme("mois")} ₪/mois</b>.</p>}
      <p className="tb-note">Engagement {g.engagementMois} mois, une petite modification par mois incluse. Tarifs de lancement. Factures : à relier à votre logiciel agréé.</p>
      <a className="bouton" href={lienWhatsApp(WHATSAPP, message)} target="_blank" rel="noopener noreferrer">💬 Je suis intéressé(e)</a>
    </div>
  );
}

// Admin : tous les prix modifiables
export function DigitalProAdmin() {
  const g = useGrilleDigitalPro();
  const [f, setF] = useState(null);
  const [info, setInfo] = useState("");
  const v = f || g;
  const num = (x) => Math.max(0, Math.round(Number(x) || 0));
  const set = (chemin, val) => {
    const n = JSON.parse(JSON.stringify(v));
    const [a, b, c] = chemin;
    if (c !== undefined) n[a][b][c] = num(val); else if (b !== undefined) n[a][b] = num(val); else n[a] = num(val);
    setF(n);
  };
  const champ = (label, chemin, val) => <label className="champ" style={{ display: "inline-block", width: "48%", marginRight: "2%" }}>{label}<input inputMode="numeric" value={val} onChange={(e) => set(chemin, e.target.value)} /></label>;
  return (
    <div className="tb-bloc">
      <h3>💼 Espace pro (Vitrine / Business) : mes prix</h3>
      {champ("Vitrine création", ["vitrine", "creation"], v.vitrine.creation)}{champ("Vitrine / mois", ["vitrine", "mois"], v.vitrine.mois)}
      {champ("Business création", ["business", "creation"], v.business.creation)}{champ("Business / mois", ["business", "mois"], v.business.mois)}
      {v.modules.map((m, i) => <div key={m.id}>{champ(`${m.nom} création`, ["modules", i, "creation"], m.creation)}{champ("/ mois", ["modules", i, "mois"], m.mois)}</div>)}
      {champ("Pack Pro création", ["packPro", "creation"], v.packPro.creation)}{champ("Pack Pro / mois", ["packPro", "mois"], v.packPro.mois)}
      {champ("Engagement (mois)", ["engagementMois"], v.engagementMois)}
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={!f} onClick={() => setDoc(doc(db, "reglages", "digitalPro"), { json: JSON.stringify(f), majLe: serverTimestamp() }).then(() => { setInfo("✓ Prix enregistrés (visibles sur la page Digital)."); setF(null); }, () => setInfo("Enregistrement impossible."))}>Enregistrer</button>
        {f && <button type="button" className="tb-bouton tb-clair" onClick={() => setF(null)}>Annuler</button>}
        <button type="button" className="tb-bouton tb-clair" onClick={() => setF(JSON.parse(JSON.stringify(GRILLE_DEPART)))}>Remettre la grille de lancement</button>
      </div>
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
