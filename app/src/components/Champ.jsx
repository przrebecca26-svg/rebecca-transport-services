import AddressField from "./AddressField.jsx";
import { libelle } from "../services.js";

// Un champ de formulaire, selon son type. Les libelles peuvent dependre des autres reponses.
export default function Champ({ champ, valeurs, erreur, onChange }) {
  const id = "f-" + champ.name;
  const val = valeurs[champ.name];
  const label = libelle(champ, valeurs);
  const set = (x) => onChange(champ.name, x);

  if (champ.type === "case") {
    return (
      <div className="champ">
        <label className="case">
          <input type="checkbox" checked={!!val} onChange={(e) => set(e.target.checked)} />
          <span>{label}</span>
        </label>
        {champ.indice && <span className="aide">{champ.indice}</span>}
      </div>
    );
  }

  if (champ.type === "choix") {
    return (
      <fieldset className="champ">
        <legend>{label}{champ.required && " *"}</legend>
        <div className="choix">
          {champ.options.map((o) => (
            <button key={o.v} type="button" className={val === o.v ? "actif" : ""} aria-pressed={val === o.v} onClick={() => set(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
        {erreur && <span className="erreur">{erreur}</span>}
      </fieldset>
    );
  }

  return (
    <div className="champ">
      <label htmlFor={id}>{label}{champ.required && " *"}</label>
      {champ.type === "adresse" && <AddressField id={id} valeur={val} onChange={set} erreur={erreur} />}
      {champ.type === "text" && <input id={id} type="text" value={val} placeholder={champ.placeholder} autoComplete={champ.autocomplete} onChange={(e) => set(e.target.value)} aria-invalid={!!erreur} />}
      {champ.type === "tel" && <input id={id} type="tel" inputMode="tel" value={val} autoComplete={champ.autocomplete} onChange={(e) => set(e.target.value)} aria-invalid={!!erreur} />}
      {champ.type === "date" && <input id={id} type="date" value={val} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set(e.target.value)} aria-invalid={!!erreur} />}
      {champ.type === "time" && <input id={id} type="time" value={val} onChange={(e) => set(e.target.value)} aria-invalid={!!erreur} />}
      {champ.type === "nombre" && (
        <div className="stepper">
          <button type="button" aria-label="Moins" onClick={() => set(String(Math.max(champ.min ?? 0, (Number(val) || 0) - 1)))}>−</button>
          <input id={id} type="number" inputMode="numeric" min={champ.min} max={champ.max} value={val} onChange={(e) => set(e.target.value)} />
          <button type="button" aria-label="Plus" onClick={() => set(String(Math.min(champ.max ?? 999, (Number(val) || 0) + 1)))}>+</button>
        </div>
      )}
      {champ.type === "select" && (
        <select id={id} value={val} onChange={(e) => set(e.target.value)}>
          {champ.options.map((o) => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      )}
      {champ.type === "texte-long" && <textarea id={id} rows={3} value={val} placeholder={champ.placeholder} onChange={(e) => set(e.target.value)} aria-invalid={!!erreur} />}
      {champ.indice && <span className="aide">{champ.indice}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </div>
  );
}
