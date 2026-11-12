import { useEffect, useState } from "react";
import Champ from "./components/Champ.jsx";
import ChoixLieu from "./components/MesLieux.jsx";
import { lienWazePoint, lienWhatsApp } from "./pricing/navigation.js";
import { TYPES_LIEU, lieuVide, manqueLieu, cleAdresse } from "./pricing/repertoire.js";
import { useRepertoire, enregistrerRepertoire } from "./repertoireBase.js";
import "./client-commun.css";
import "./devis-rapide.css";

// REPERTOIRE (12 nov. 2026) : mes lieux habituels par leur nom, et les adresses de mes clientes.

const waze = (a) => lienWazePoint(a);
const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Lieu({ l, changer, supprimer, connues }) {
  const set = (cle, valeur) => changer({ ...l, [cle]: valeur });
  return (
    <details className="bloc rp-enfant rp-trajet" open={!l.nom}>
      <summary>
        <h3>{l.nom || "Nouveau lieu"}</h3>
        <span className="tdb-note">{l.adresse && l.adresse.label ? l.adresse.label : "Adresse à indiquer"}</span>
      </summary>
      <div className="champ">
        <label htmlFor={"rn-" + l.id}>Nom (Maman, École, Basket, Carrefour…)</label>
        <input id={"rn-" + l.id} type="text" maxLength={40} value={l.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor={"rt-" + l.id}>Type</label>
        <select id={"rt-" + l.id} value={l.type} onChange={(e) => set("type", e.target.value)}>
          {TYPES_LIEU.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>
      <ChoixLieu id={"rc-" + l.id} connues={connues.filter((c) => c.id !== l.id)} valeur={l.adresse} choisir={(x) => set("adresse", x)} />
      <Champ champ={{ name: "ra" + l.id, label: "Adresse", type: "adresse" }} valeurs={{ ["ra" + l.id]: l.adresse }} onChange={(_, v) => set("adresse", v)} />
      <div className="champ">
        <label htmlFor={"ro-" + l.id}>Note (code du portail, étage…), facultatif</label>
        <input id={"ro-" + l.id} type="text" maxLength={200} value={l.note} onChange={(e) => set("note", e.target.value)} />
      </div>
      <div className="dr-actions">
        {l.adresse && l.adresse.label && <a className="tdb-bouton dr-lien" href={waze(l.adresse)} target="_blank" rel="noopener noreferrer">Ouvrir dans Waze</a>}
        <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer ce lieu</button>
      </div>
    </details>
  );
}

export default function Repertoire() {
  const rep = useRepertoire();
  const [lieux, setLieux] = useState(null);
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const [texte, setTexte] = useState("");

  useEffect(() => {
    if (!modifie) setLieux(rep.lieux);
  }, [rep, modifie]);

  if (!lieux) return <p className="tdb-note tb-pad">Chargement du répertoire…</p>;

  const changer = (suite) => {
    setLieux(suite);
    setModifie(true);
    setMessage("");
  };
  const enregistrer = async () => {
    const pb = lieux.map(manqueLieu).find(Boolean);
    if (pb) return setMessage(pb);
    try {
      await enregistrerRepertoire(lieux);
      setModifie(false);
      setMessage("C'est enregistré.");
    } catch {
      setMessage("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
    return undefined;
  };
  const dejaLieu = (a) => !!cleAdresse(a) && lieux.some((l) => cleAdresse(l.adresse) === cleAdresse(a));
  const q = sansAccent(texte.trim());
  const voit = (...mots) => !q || mots.some((m) => sansAccent(m).includes(q));
  const clientes = rep.clients.filter((c) => voit(c.nom, c.telephone, ...c.adresses.map((a) => a.nom)));

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Répertoire</h1>
        <p className="tdb-sous">Mes adresses habituelles et celles de mes clientes. Partout où je tape une adresse, j'écris le nom et elle se remplit.</p>
      </div>
      <input className="dr-tel rp-large" type="search" placeholder="Chercher un nom (Alexia, Carrefour, école…)" value={texte} onChange={(e) => setTexte(e.target.value)} />

      <section className="tdb-bloc">
        <h2>Mes lieux</h2>
        {lieux.length === 0 && <p className="tdb-note">Aucun lieu pour l'instant. Ajoute ta maison, l'école, le basket, tes magasins…</p>}
      </section>
      <div className="formulaire dr-formulaire">
        {TYPES_LIEU.map((t) => {
          const duType = lieux.filter((l) => l.type === t.v && voit(l.nom, l.note, l.adresse && l.adresse.label));
          if (duType.length === 0) return null;
          return (
            <div key={t.v}>
              <p className="rp-type">{t.l}</p>
              {duType.map((l) => (
                <Lieu key={l.id} l={l} connues={lieux.filter((x) => x.nom.trim() && cleAdresse(x.adresse)).map((x) => ({ id: x.id, nom: x.nom, adresse: x.adresse }))} changer={(n) => changer(lieux.map((x) => (x.id === l.id ? n : x)))} supprimer={() => changer(lieux.filter((x) => x.id !== l.id))} />
              ))}
            </div>
          );
        })}
      </div>
      <button type="button" className="dr-secondaire rp-large" onClick={() => { setTexte(""); changer([...lieux, lieuVide()]); }}>+ Ajouter un lieu</button>

      <section className="tdb-bloc">
        <h2>Mes clientes</h2>
        <p className="tdb-note">Leurs adresses viennent de leurs comptes et se mettent à jour toutes seules.</p>
        {clientes.length === 0 && <p className="tdb-note">Aucune cliente avec une adresse enregistrée{q ? " pour cette recherche" : ""}.</p>}
        {clientes.map((c) => (
          <details className="rp-journee" key={c.cle}>
            <summary><span>{c.nom}</span><b>{c.adresses.length} adresse{c.adresses.length > 1 ? "s" : ""}</b></summary>
            {c.telephone && <p className="tdb-note"><a className="rp-waze" href={lienWhatsApp(c.telephone)} target="_blank" rel="noopener noreferrer">WhatsApp {c.telephone}</a></p>}
            <ol className="rp-arrets">
              {c.adresses.map((a, k) => (
                <li key={k}>
                  <span>{a.nom} <small>{a.adresse.label}</small></span>
                  <a className="rp-waze" href={waze(a.adresse)} target="_blank" rel="noopener noreferrer">Waze</a>
                  {cleAdresse(a.adresse) && !dejaLieu(a.adresse) && (
                    <button type="button" className="rp-waze" onClick={() => changer([...lieux, { ...lieuVide(), nom: `${c.nom} · ${a.nom}`.slice(0, 40), type: "famille", adresse: a.adresse }])}>+ Mes lieux</button>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>

      <div className="rp-enregistrer">
        <button type="button" className="tdb-bouton" onClick={enregistrer} disabled={!modifie}>{modifie ? "Enregistrer mon répertoire" : "Tout est enregistré"}</button>
        {message && <p className="tdb-note" role="status">{message}</p>}
      </div>
    </div>
  );
}
