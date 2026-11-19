import { useEffect, useRef, useState } from "react";
import { parleDisponible } from "../pricing/saisieVocale.js";

// SAISIE VOCALE V1 (19 nov. 2026) : Rebecca dicte (micro du clavier de l'iPhone, ou « Parler » si le téléphone le
// permet), l'appli comprend et REMPLIT le formulaire ouvert. Rien n'est enregistré : elle relit puis valide comme
// d'habitude. À utiliser garée, jamais en conduisant.
// comprendre(texte) -> { ...champs, resume } ou { erreur } ; remplir(resultat) remplit le formulaire.
// 19 nov. 2026 (test C13) : depuis l'icône de l'écran d'accueil, l'iPhone ouvre le micro mais ne rend jamais le texte
// (« Je t'écoute… » bloqué). Là, pas de bouton « Parler » : la case s'ouvre avec le clavier, on dicte avec son 🎤.
// Ailleurs, « Parler » s'arrête tout seul au bout de 8 secondes sans réponse.
const appliIcone = () => {
  try {
    return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
};
export default function Dicter({ comprendre, remplir, exemple = "" }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState("");
  const [ecoute, setEcoute] = useState(false);
  const reco = useRef(null);
  const minuteur = useRef(null);
  const zone = useRef(null);
  useEffect(() => {
    if (ouvert && zone.current) zone.current.focus();
  }, [ouvert]);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  const appliquer = (t = texte) => {
    const r = comprendre(t);
    if (!r || r.erreur) return setInfo((r && r.erreur) || "Je n'ai pas compris.");
    remplir(r);
    setInfo(`✓ J'ai rempli : ${r.resume}. Vérifie puis valide.`);
    return undefined;
  };
  const parler = () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return;
    if (ecoute && reco.current) { reco.current.stop(); return; }
    const r = new R();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      clearTimeout(minuteur.current);
      const t = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      setTexte(t);
      appliquer(t);
    };
    r.onerror = () => setInfo("Micro indisponible : touche le 🎤 du clavier et dicte dans la case.");
    r.onend = () => {
      clearTimeout(minuteur.current);
      setEcoute(false);
    };
    reco.current = r;
    setEcoute(true);
    setInfo("Je t'écoute…");
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      try { r.abort(); } catch { /* deja arrete */ }
      setEcoute(false);
      setInfo("Je n'ai rien entendu : touche le 🎤 du clavier et dicte dans la case.");
    }, 8000);
    try { r.start(); } catch { clearTimeout(minuteur.current); setEcoute(false); setInfo("Micro indisponible : touche le 🎤 du clavier et dicte dans la case."); }
  };
  if (!ouvert) return <button type="button" className="tb-bouton tb-clair" onClick={() => setOuvert(true)}>🎙️ Dicter</button>;
  return (
    <div className="ag-etape-actions">
      <label className="ag-champ">Dis ce que tu as fait (touche 🎤 sur le clavier pour dicter)
        <textarea ref={zone} rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={exemple} />
      </label>
      <div className="tb-actions">
        <button type="button" className="tb-bouton" onClick={() => appliquer()} disabled={!texte.trim()}>Comprendre et remplir</button>
        {parleDisponible() && !appliIcone() && <button type="button" className="tb-bouton tb-clair" onClick={parler}>{ecoute ? "■ Arrêter" : "🎤 Parler"}</button>}
        <button type="button" className="ag-modifier" onClick={() => { setOuvert(false); setTexte(""); setInfo(""); }}>Fermer</button>
      </div>
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}
