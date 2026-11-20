import { useEffect, useState } from "react";

// BOUTON « ← MON ESPACE » (20 nov. 2026, Rebecca) : depuis l'icône « Rebecca admin » de l'iPhone, une page du site
// ouverte depuis l'admin (« Voir le site comme une cliente », « Voir la page », un contrat, l'espace d'un restaurant…)
// n'avait aucun moyen de revenir : il fallait fermer l'appli. Quand Rebecca est connectée, ce bouton reste en haut à
// gauche de toutes les pages du site (jamais pour les clientes) et la ramène à son espace, à la rubrique où elle était.
const EMAIL_REBECCA = "przrebecca26@gmail.com";
const enAdmin = () => window.location.hash.startsWith("#/admin");

export default function RetourAdmin() {
  const [rebecca, setRebecca] = useState(false);
  const [admin, setAdmin] = useState(enAdmin());
  useEffect(() => {
    const suivre = () => setAdmin(enAdmin());
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);
  useEffect(() => {
    let fin = () => {};
    let actif = true;
    // Firebase est chargé après l'affichage (la page des clientes reste rapide)
    const t = setTimeout(() => {
      Promise.all([import("../firebase.js"), import("firebase/auth")])
        .then(([{ auth }, { onAuthStateChanged }]) => {
          if (!actif) return;
          fin = onAuthStateChanged(auth, (u) => setRebecca(!!u && u.email === EMAIL_REBECCA && u.emailVerified === true));
        })
        .catch(() => {});
    }, 800);
    return () => { actif = false; clearTimeout(t); fin(); };
  }, []);
  if (!rebecca || admin) return null;
  return (
    <button
      type="button"
      onClick={() => { window.location.href = "/#/admin"; }}
      style={{
        position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 8px)", left: 8, zIndex: 9999,
        padding: "10px 14px", borderRadius: 999, border: "1px solid #c9967a", background: "#141214", color: "#f3d6dc",
        font: "700 15px system-ui, sans-serif", boxShadow: "0 2px 10px rgba(0,0,0,.4)",
      }}
    >
      ← Mon espace
    </button>
  );
}
