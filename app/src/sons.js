import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { lireStyles } from "./pricing/sonsNotif.js";

// SONS DANS L'APPLI (19 nov. 2026, 15h42) - quand l'appli est ouverte (support voiture) : 3 clochettes pour une
// nouvelle course, 2 clochettes pour l'heure de partir... (choix dans Réglages → Notifications).
// Sons fabriqués par le téléphone (aucun fichier). Sur iPhone, le son est débloqué au premier toucher de l'écran.
let ctx = null;
function contexte() {
  if (ctx) return ctx;
  const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!C) return null;
  ctx = new C();
  return ctx;
}
if (typeof window !== "undefined") {
  const debloquer = () => {
    const c = contexte();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", debloquer, { passive: true });
  window.addEventListener("touchstart", debloquer, { passive: true });
}

function clochette(c, quand, frequence = 1318.5, duree = 0.9, volume = 0.35) {
  for (const [mult, vol] of [[1, 1], [2.76, 0.35], [5.4, 0.15]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(frequence * mult, quand);
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(volume * vol, quand + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
    o.connect(g).connect(c.destination);
    o.start(quand);
    o.stop(quand + duree + 0.05);
  }
}

// son : "3", "2", "1" (clochettes), "c" (caisse), "0" (rien)
export function jouerSon(son) {
  const c = contexte();
  if (!c || !son || son === "0") return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t = c.currentTime + 0.05;
  if (son === "c") {
    clochette(c, t, 1760, 0.35, 0.3);
    clochette(c, t + 0.12, 2637, 0.6, 0.3);
    return;
  }
  const n = Number(son) || 0;
  for (let i = 0; i < n; i++) clochette(c, t + i * 0.28, 1318.5 - i * 120);
}

// Réglages des notifications (emoji et son par type), lus en direct
export function useStylesNotif(actif = true) {
  const [styles, setStyles] = useState(() => lireStyles("{}"));
  useEffect(() => (actif ? onSnapshot(doc(db, "reglages", "alerteDemandes"), (s) => setStyles(lireStyles((s.exists() && s.data().notifStyles) || "{}")), () => {}) : undefined), [actif]);
  return styles;
}
