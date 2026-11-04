import AddressField from "./AddressField.jsx";
import { libelle } from "../services.js";
import { aujourdhui } from "../profil.js";

// Un champ de formulaire, selon son type. Les libelles peuvent dependre des autres reponses.
// Types : text, tel, case, select, choix, nombre, date, time, adresse, texte-long.
export default function Champ({ champ, valeurs, erreur, onChange }) {
  const id = "f-" + champ.name;
  const val = valeurs[champ.name] ?? "";
  const label = libelle(champ, valeurs);
  const set = (x) => onChange(champ.name, x);
  const aideId = champ.indice ? id + "-aide" : undefined;
  const messageErreur = erreur ? <span className="erreur" role="alert">{erreur}</span> : null;

  if (champ.type === "case") {
    return (
      <div className="champ">
        <label className="case">
          <input id={id} type="checkbox" checked={!!valeurs[champ.name]} onChange={(e) => set(e.target.checked)} aria-describedby={aideId} />
          <span>{label}</span>
        </label>
        {champ.indice && <span className="aide" id={aideId}>{champ.indice}</span>}
        {messageErreur}
      </div>
    );
  }

  if (champ.type === "choix") {
    return (
      <fieldset className="champ" id={id}>
        <legend>{label}{champ.required && " *"}</legend>
        <div className="choix">
          {champ.options.map((o) => (
            <button key={o.v} type="button" className={val === o.v ? "actif" : ""} aria-pressed={val === o.v} onClick={() => set(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
        {champ.indice && <span className="aide">{champ.indice}</span>}
        {messageErreur}
      </fieldset>
    );
  }

  const commun = { id, "aria-invalid": !!erreur, "aria-describedby": aideId };

  return (
    <div className="champ">
      <label htmlFor={id}>{label}{champ.required && " *"}</label>
      {champ.type === "adresse" && <AddressField id={id} valeur={valeurs[champ.name]} onChange={set} erreur={erreur} raccourcis />}
      {champ.type === "text" && <input {...commun} type="text" value={val} maxLength={200} placeholder={champ.placeholder} autoComplete={champ.autocomplete} onChange={(e) => set(e.target.value)} />}
      {champ.type === "tel" && <input {...commun} type="tel" inputMode="tel" value={val} maxLength={20} placeholder="05X XXX XXXX" autoComplete={champ.autocomplete} onChange={(e) => set(e.target.value)} />}
      {/* date du jour en Israel (et non en heure de Londres) : apres minuit, on peut choisir le jour meme */}
      {champ.type === "date" && <input {...commun} type="date" value={val} min={aujourdhui()} onChange={(e) => set(e.target.value)} />}
      {champ.type === "time" && <input {...commun} type="time" value={val} onChange={(e) => set(e.target.value)} />}
      {champ.type === "nombre" && (
        <div className="stepper">
          <button type="button" aria-label="Moins" onClick={() => set(String(Math.max(champ.min ?? 0, (Number(val) || 0) - 1)))}>−</button>
          <input {...commun} type="number" inputMode="numeric" min={champ.min} max={champ.max} value={val} onChange={(e) => set(e.target.value)} />
          <button type="button" aria-label="Plus" onClick={() => set(String(Math.min(champ.max ?? 999, (Number(val) || 0) + 1)))}>+</button>
        </div>
      )}
      {champ.type === "select" && (
        <select {...commun} value={val} onChange={(e) => set(e.target.value)}>
          {champ.options.map((o) => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      )}
      {champ.type === "texte-long" && <textarea {...commun} rows={3} value={val} maxLength={1000} placeholder={champ.placeholder} onChange={(e) => set(e.target.value)} />}
      {champ.indice && <span className="aide" id={aideId}>{champ.indice}</span>}
      {messageErreur}
    </div>
  );
}
