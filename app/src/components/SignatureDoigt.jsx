import { useEffect, useRef } from "react";
import { SIG_H, SIG_L, decoderSignature, encoderSignature } from "../pricing/contratResto.js";

// SIGNATURE AU DOIGT (19 nov. 2026) : un cadre où l'on signe avec le doigt (ou la souris).
// On garde des traits (pas une image) : ils se redessinent à l'identique sur l'écran et dans le PDF du contrat.
export default function SignatureDoigt({ valeur, onChange }) {
  const toile = useRef(null);
  const traits = useRef(decoderSignature(valeur));
  const enCours = useRef(false);

  const dessiner = () => {
    const c = toile.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#141214";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const t of traits.current) {
      ctx.beginPath();
      t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (t.length === 1) ctx.lineTo(t[0][0] + 0.5, t[0][1] + 0.5);
      ctx.stroke();
    }
  };
  useEffect(dessiner, []); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e) => {
    const r = toile.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIG_L, ((e.clientY - r.top) / r.height) * SIG_H];
  };
  const debut = (e) => {
    e.preventDefault();
    toile.current.setPointerCapture && toile.current.setPointerCapture(e.pointerId);
    enCours.current = true;
    traits.current.push([point(e)]);
    dessiner();
  };
  const suite = (e) => {
    if (!enCours.current) return;
    e.preventDefault();
    const t = traits.current[traits.current.length - 1];
    const p = point(e);
    const d = t[t.length - 1];
    if (Math.hypot(p[0] - d[0], p[1] - d[1]) >= 4) t.push(p);
    dessiner();
  };
  const fin = () => {
    if (!enCours.current) return;
    enCours.current = false;
    onChange(encoderSignature(traits.current));
  };
  const effacer = () => {
    traits.current = [];
    dessiner();
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={toile}
        width={SIG_L}
        height={SIG_H}
        aria-label="Cadre de signature : signez avec le doigt"
        style={{ width: "100%", aspectRatio: `${SIG_L} / ${SIG_H}`, background: "#faf6f2", borderRadius: 14, border: "2px dashed #b97870", touchAction: "none", display: "block" }}
        onPointerDown={debut}
        onPointerMove={suite}
        onPointerUp={fin}
        onPointerCancel={fin}
        onPointerLeave={fin}
      />
      <button type="button" className="bouton-secondaire" style={{ marginTop: 8 }} onClick={effacer}>Effacer et recommencer</button>
    </div>
  );
}

// La signature redessinée (écran) : SVG
export function SignatureVue({ valeur, largeur = 260 }) {
  const t = decoderSignature(valeur);
  return (
    <svg viewBox={`0 0 ${SIG_L} ${SIG_H}`} width={largeur} style={{ background: "#faf6f2", borderRadius: 10, display: "block" }} role="img" aria-label="Signature">
      {t.map((tr, i) => <polyline key={i} points={tr.map((p) => p.join(",")).join(" ")} fill="none" stroke="#141214" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
