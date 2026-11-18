import { useEffect, useState } from "react";

// INSTALLER L'APPLICATION (18 nov. 2026, idee reprise de HOP!, adaptee a Rebecca Services)
// Bandeau sur l'accueil : « Installez Rebecca Services sur votre téléphone ». Il disparait quand le site est deja
// ouvert depuis l'icone, ou si la personne le ferme (memorise 30 jours sur ce telephone).
// iPhone : les 3 gestes de Safari. Android : bouton d'installation direct quand le navigateur le propose.
const CLE = "rs_installer_ferme";
const JOURS = 30;
const estInstallee = () => (typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true));
const estIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const fermeRecemment = () => {
  try {
    const t = Number(window.localStorage.getItem(CLE) || 0);
    return t && Date.now() - t < JOURS * 86400000;
  } catch {
    return false;
  }
};

function Etape({ n, children }) {
  return (
    <li style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "10px 0" }}>
      <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "var(--g-rose, #F1AEB7)", color: "#080709", fontWeight: 800, display: "grid", placeItems: "center" }}>{n}</span>
      <span style={{ lineHeight: 1.45 }}>{children}</span>
    </li>
  );
}

export default function InstallerAppli({ titre = "Installez Rebecca Services sur votre téléphone", sousTitre = "L'icône sur votre écran d'accueil : réserver et suivre vos demandes en un geste." }) {
  const [visible, setVisible] = useState(false);
  const [aide, setAide] = useState(false);
  const [invite, setInvite] = useState(null);
  useEffect(() => {
    if (estInstallee() || fermeRecemment()) return;
    setVisible(true);
    const capter = (e) => {
      e.preventDefault();
      setInvite(e);
    };
    window.addEventListener("beforeinstallprompt", capter);
    return () => window.removeEventListener("beforeinstallprompt", capter);
  }, []);
  if (!visible) return null;

  const fermer = () => {
    try {
      window.localStorage.setItem(CLE, String(Date.now()));
    } catch {
      /* navigation privee */
    }
    setVisible(false);
  };
  const installer = async () => {
    if (invite) {
      invite.prompt();
      const r = await invite.userChoice.catch(() => null);
      if (r && r.outcome === "accepted") setVisible(false);
      return;
    }
    setAide(true);
  };
  const ios = estIos();

  return (
    <>
      <div className="bloc" style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, margin: "12px 0", position: "relative" }}>
        <img src="/apple-touch-icon.png" alt="" width={56} height={56} style={{ borderRadius: 14, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block" }}>{titre}</strong>
          <small style={{ display: "block", opacity: 0.8, margin: "2px 0 8px" }}>{sousTitre}</small>
          <button type="button" className="bouton" style={{ width: "auto", padding: "8px 22px", minHeight: 40 }} onClick={installer}>Installer</button>
        </div>
        <button type="button" aria-label="Fermer" onClick={fermer} style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.08)", color: "inherit", fontSize: 16 }}>✕</button>
      </div>
      {aide && (
        <div role="dialog" aria-modal="true" onClick={() => setAide(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }}>
          <div className="bloc" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: "100%", padding: 22, textAlign: "left" }}>
            <div style={{ textAlign: "center" }}>
              <img src="/apple-touch-icon.png" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
              <h3 style={{ margin: "10px 0 4px" }}>Installez Rebecca Services en 3 gestes</h3>
            </div>
            {ios ? (
              <ol style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
                <Etape n="1">Touchez <strong>Partager</strong> <span aria-hidden="true">⬆️</span> en bas de Safari (ou dans le menu <strong>•••</strong>).</Etape>
                <Etape n="2">Faites défiler et touchez <strong>« Sur l'écran d'accueil »</strong> <span aria-hidden="true">➕</span>.</Etape>
                <Etape n="3">Touchez <strong>« Ajouter »</strong> en haut à droite. L'icône Rebecca Services est sur votre téléphone !</Etape>
              </ol>
            ) : (
              <ol style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
                <Etape n="1">Touchez le menu <strong>⋮</strong> en haut à droite de Chrome.</Etape>
                <Etape n="2">Touchez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.</Etape>
                <Etape n="3">Confirmez avec <strong>« Installer »</strong>. L'icône Rebecca Services est sur votre téléphone !</Etape>
              </ol>
            )}
            <p className="aide" style={{ textAlign: "center" }}>Ensuite, ouvrez Rebecca Services depuis son icône : vos demandes et votre compte vous attendent.</p>
            <button type="button" className="bouton" onClick={() => { setAide(false); fermer(); }}>J'ai compris</button>
          </div>
        </div>
      )}
    </>
  );
}
