import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { lireParrain } from "./pricing/suiteClient.js";

// 17 nov. 2026 : lien de parrainage (?parrain=...) garde 60 jours sur ce telephone
try {
  const p = lireParrain(window.location.search);
  if (p) localStorage.setItem("rs-parrain", JSON.stringify({ p, le: Date.now() }));
} catch {
  // stockage indisponible : pas de parrainage
}

// 17 nov. 2026, 15h37 : apres une publication, un telephone qui garde l'ancienne page demande des fichiers
// qui n'existent plus -> page blanche. On recharge une seule fois tout seul.
const recharger = () => {
  try {
    if (sessionStorage.getItem("rs-recharge")) return;
    sessionStorage.setItem("rs-recharge", "1");
  } catch {
    return;
  }
  window.location.reload();
};
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  recharger();
});
window.addEventListener("load", () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem("rs-recharge");
    } catch {
      // rien
    }
  }, 10000);
});

// Plus jamais de page blanche : en cas d'erreur, un message avec le detail et un bouton Recharger
class Filet extends React.Component {
  constructor(p) {
    super(p);
    this.state = { erreur: null };
  }
  static getDerivedStateFromError(erreur) {
    return { erreur };
  }
  componentDidCatch(erreur) {
    if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(erreur && erreur.message))) recharger();
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    const texte = String((this.state.erreur && (this.state.erreur.stack || this.state.erreur.message)) || this.state.erreur).slice(0, 600);
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#222", background: "#fff", minHeight: "100vh" }}>
        <h2>Oups, un souci d'affichage</h2>
        <p>Appuie sur « Recharger ». Si ça recommence, fais une capture de cet écran pour Claude.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "12px 20px", fontSize: 16, borderRadius: 10, border: 0, background: "#e7a9b4", fontWeight: 700 }}>
          Recharger
        </button>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 20, color: "#a33" }}>{texte}</pre>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <Filet>
    <App />
  </Filet>
);
