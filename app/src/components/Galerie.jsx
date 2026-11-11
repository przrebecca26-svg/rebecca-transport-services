import { useState } from "react";

// GALERIE D'UNE ACTIVITE (11 nov. 2026) - Rebecca Services
// Photos ajoutees par Rebecca dans Reglages > Catalogue > Galerie (avant / apres, protocoles, realisations...).
// photos = [{ donnees, legende }]. Un toucher agrandit la photo ; un second toucher la referme.
export default function Galerie({ photos = [], titre = "Galerie" }) {
  const [zoom, setZoom] = useState(null);
  if (!photos.length) return null;
  const p = zoom === null ? null : photos[zoom];
  return (
    <div style={{ marginBottom: 16 }}>
      {titre && <h3>{titre}</h3>}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        {photos.map((x, i) => (
          <button key={i} type="button" onClick={() => setZoom(i)} aria-label={x.legende || "Agrandir la photo"} style={{ padding: 0, border: "none", background: "transparent", flex: "none", cursor: "pointer" }}>
            <img src={x.donnees} alt={x.legende || ""} loading="lazy" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, display: "block" }} />
          </button>
        ))}
      </div>
      {p && (
        <div role="dialog" aria-modal="true" onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8, 7, 9, 0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, gap: 12 }}>
          <img src={p.donnees} alt={p.legende || ""} style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 12 }} />
          {p.legende && <p style={{ color: "#F8F3F1", textAlign: "center", margin: 0 }}>{p.legende}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            {photos.length > 1 && <button type="button" className="bouton" onClick={(e) => { e.stopPropagation(); setZoom((zoom + photos.length - 1) % photos.length); }}>← Précédente</button>}
            <button type="button" className="bouton" onClick={() => setZoom(null)}>Fermer</button>
            {photos.length > 1 && <button type="button" className="bouton" onClick={(e) => { e.stopPropagation(); setZoom((zoom + 1) % photos.length); }}>Suivante →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
