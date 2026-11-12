import IconeService from "./IconeService.jsx";

// Tuile d'une activite (D2a) : logo officiel (jamais recadre) ou icone validee, nom, etat, chiffres reels.
// Une activite « Bientôt » n'affiche aucun chiffre.

const shekels = (n) => Math.round(n).toLocaleString("fr-FR") + " ₪";
const ICONE = { coursier: "livraison", transport: "transport" };

export default function TuileActivite({ activite, ouvrir }) {
  const a = activite;
  const active = a.etat === "active";
  return (
    <button className={"tdb-tuile" + (active ? "" : " bientot")} onClick={active ? ouvrir : undefined} disabled={!active} aria-label={a.titre + (active ? "" : " (bientôt)")}>
      {a.logo ? <img className="tdb-logo" src={a.logo} alt="" /> : <span className="tdb-icone"><IconeService id={ICONE[a.icone] || a.icone} taille={44} /></span>}
      <span className="tdb-tuile-texte">
        <b>{a.titre}</b>
        {active ? <span className="tdb-badge ok">Active</span> : <span className="tdb-badge bientot">Bientôt</span>}
        {active && a.texte && <span className="tdb-tuile-ca">{a.texte}</span>}
        {active && !a.texte && a.chiffres && <span className="tdb-tuile-ca">{shekels(a.chiffres.caRealise)} · {a.chiffres.prestationsTerminees} terminée{a.chiffres.prestationsTerminees > 1 ? "s" : ""}</span>}
      </span>
    </button>
  );
}
