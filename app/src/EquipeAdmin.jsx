import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { SERVICES } from "./services.js";
import { ACTIVITES_ACCES, MODES, ficheParDefaut, validerFiche, validerMesReglages, validerModes } from "./pricing/espaceEquipe.js";
import "./reglages.css";
import "./equipe.css";

// Rubrique « Equipe » de l'espace prive (Lot J, seance J2, 9 nov. 2026) - Rebecca seule.
//  - demandes d'acces : creees automatiquement quand un coequipier se connecte a /#/admin avec son compte Google ;
//  - Rebecca active (ou refuse) ; la fiche du membre fixe ce qu'il voit : activites, services, modes de transport,
//    telephone des clients, plafond osek patur. Aucun e-mail n'est ecrit dans le code.
// Collections : demandesEquipe/{uid}, equipe/{uid} (regles Firestore v9, publiees en J5).

const titreService = (id) => (SERVICES.find((s) => s.id === id) || { titre: id }).titre;

function Case({ coche, onChange, children }) {
  return (
    <label className="rg-case">
      <input type="checkbox" checked={!!coche} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

const basculer = (liste, id, oui) => (oui ? [...new Set([...(liste || []), id])] : (liste || []).filter((x) => x !== id));

function FicheMembre({ uid, fiche, onFermer }) {
  const [f, setF] = useState(() => ({ ...fiche, plafond: String(fiche.plafond || "") }));
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const changer = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const enregistrer = async () => {
    const v = validerFiche(f);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    setEnCours(true);
    try {
      await updateDoc(doc(db, "equipe", uid), { ...v.fiche, majLe: serverTimestamp() });
      setMessage({ texte: "Fiche enregistrée." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion puis réessaie." });
    }
    setEnCours(false);
  };

  return (
    <section className="tb-detail">
      <button className="tb-retour" onClick={onFermer}>← Équipe</button>
      <h2>{fiche.nom || "Membre"}</h2>
      <p className="tb-note">{fiche.email}</p>

      <div className="tb-bloc">
        <h3>Coordonnées</h3>
        <label className="am-label">Nom<input className="am-champ" value={f.nom || ""} maxLength={80} onChange={(e) => changer("nom", e.target.value)} /></label>
        <label className="am-label">Téléphone<input className="am-champ" type="tel" inputMode="tel" value={f.telephone || ""} maxLength={20} onChange={(e) => changer("telephone", e.target.value)} /></label>
        <Case coche={f.actif !== false} onChange={(v) => changer("actif", v)}>Accès actif (décocher = il ne peut plus rien voir)</Case>
      </div>

      <div className="tb-bloc">
        <h3>Activités et services</h3>
        <p className="tb-note">Il voit et gère, comme toi, les clients, les demandes et les prix des activités cochées. Jamais tes finances.</p>
        {ACTIVITES_ACCES.map((a) => {
          const ouverte = (f.activites || []).includes(a.id);
          return (
            <div key={a.id} className="eq-activite">
              <Case coche={ouverte} onChange={(v) => changer("activites", basculer(f.activites, a.id, v))}>
                <strong>{a.label}</strong>{a.services.length === 0 ? " (bientôt)" : ""}
              </Case>
              {ouverte && a.services.length > 0 && (
                <div className="eq-services">
                  {a.services.map((s) => (
                    <Case key={s} coche={(f.services || []).includes(s)} onChange={(v) => changer("services", basculer(f.services, s, v))}>{titreService(s)}</Case>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <Case coche={f.voitTelephone !== false} onChange={(v) => changer("voitTelephone", v)}>Il voit le téléphone des clients</Case>
      </div>

      <div className="tb-bloc">
        <h3>Modes de transport</h3>
        {MODES.map((m) => (
          <Case key={m.id} coche={(f.modes || []).includes(m.id)} onChange={(v) => changer("modes", basculer(f.modes, m.id, v))}>{m.label}</Case>
        ))}
        <p className="tb-note">Il peut aussi les cocher lui-même. Le partage de ta voiture se règle avec les véhicules (étape J3).</p>
      </div>

      <div className="tb-bloc">
        <h3>Son plafond osek patur</h3>
        <div className="rg-ligne">
          <input inputMode="numeric" value={f.plafond} onChange={(e) => changer("plafond", e.target.value)} />
          <span>₪ par an (le sien, séparé du tien)</span>
        </div>
      </div>

      {message && <p className={message.erreur ? "admin-erreur" : "rg-ok"} role={message.erreur ? "alert" : "status"}>{message.texte}</p>}
      <div className="tb-actions">
        <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>{enCours ? "Enregistrement…" : "Enregistrer la fiche"}</button>
        <button className="tb-bouton tb-clair" onClick={onFermer}>Fermer</button>
      </div>
    </section>
  );
}

export default function EquipeAdmin() {
  const [membres, setMembres] = useState(null);
  const [demandes, setDemandes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    const arrets = [
      onSnapshot(collection(db, "equipe"), (s) => setMembres(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setErreur("Lecture de l'équipe impossible pour l'instant (les règles de sécurité de l'équipe seront publiées à l'étape J5).")),
      onSnapshot(collection(db, "demandesEquipe"), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setErreur("Lecture de l'équipe impossible pour l'instant (les règles de sécurité de l'équipe seront publiées à l'étape J5).")),
    ];
    return () => arrets.forEach((a) => a());
  }, []);

  const repondre = async (d, accepte) => {
    try {
      const lot = writeBatch(db);
      if (accepte) lot.set(doc(db, "equipe", d.id), { ...ficheParDefaut(d), creeLe: serverTimestamp(), majLe: serverTimestamp() });
      lot.update(doc(db, "demandesEquipe", d.id), { statut: accepte ? "acceptee" : "refusee", majLe: serverTimestamp() });
      await lot.commit();
      if (accepte) setOuvert(d.id);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
  };

  const fiche = ouvert && membres && membres.find((m) => m.id === ouvert);
  if (fiche) return <FicheMembre key={ouvert} uid={ouvert} fiche={fiche} onFermer={() => setOuvert(null)} />;

  const enAttente = (demandes || []).filter((d) => d.statut === "en_attente" && !(membres || []).some((m) => m.id === d.id));
  const lien = typeof window !== "undefined" && window.location.origin.startsWith("http") ? window.location.origin + "/#/admin" : "/#/admin";

  return (
    <div className="tdb">
      <div className="tdb-tete">
        <h1>Équipe</h1>
        <p className="tdb-sous">Les personnes qui gèrent avec toi le coursier et le transport</p>
      </div>
      {erreur && <p className="tdb-erreur" role="alert">{erreur}</p>}

      <section className="tdb-bloc">
        <h2>Ajouter un coéquipier</h2>
        <p className="tdb-texte">Envoie-lui le lien de l'espace privé. Il se connecte avec son compte Google : sa demande d'accès apparaît ici, et tu l'actives.</p>
        <a className="tdb-bouton eq-lien" href={`https://wa.me/?text=${encodeURIComponent("Voici le lien de l'espace équipe Rebecca Services : " + lien + " (connecte-toi avec ton compte Google)")}`} target="_blank" rel="noopener noreferrer">Envoyer le lien par WhatsApp</a>
      </section>

      {enAttente.length > 0 && (
        <section className="tdb-bloc">
          <h2>Demandes d'accès</h2>
          {enAttente.map((d) => (
            <div key={d.id} className="eq-demande">
              <p><strong>{d.nom || "Sans nom"}</strong><br /><span className="tb-note">{d.email}</span></p>
              <div className="tb-actions">
                <button className="tb-bouton" onClick={() => repondre(d, true)}>Activer</button>
                <button className="tb-bouton tb-clair" onClick={() => repondre(d, false)}>Refuser</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="tdb-bloc">
        <h2>Membres</h2>
        {membres === null && !erreur && <p className="tdb-texte">Chargement…</p>}
        {membres && membres.length === 0 && <p className="tdb-texte">Personne pour l'instant.</p>}
        {(membres || []).map((m) => (
          <button key={m.id} className="tb-carte" onClick={() => setOuvert(m.id)}>
            <span className="tb-ligne">
              <strong>{m.nom || m.email}</strong>
              <span className={"tb-badge " + (m.actif ? "tb-acceptee" : "tb-annulee")}>{m.actif ? "Actif" : "Désactivé"}</span>
            </span>
            <span className="tb-quand">
              {ACTIVITES_ACCES.filter((a) => (m.activites || []).includes(a.id)).map((a) => a.label).join(" · ") || "Aucune activité"}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

/* ---------- Modes de transport de chacun (demande de Rebecca, 9 nov. 2026 : « on coche ce qu'on a disponible ») ---------- */

// Rebecca : ses modes dans equipe/rebecca (son acces admin ne change pas)
export function MesModes({ id = "rebecca" }) {
  const [modes, setModes] = useState(null);
  const [message, setMessage] = useState(null);
  useEffect(
    () => onSnapshot(doc(db, "equipe", id), (s) => setModes((avant) => avant || (s.exists() && s.data().modes) || ["voiture"]), () => setModes((avant) => avant || ["voiture"])),
    [id]
  );
  const enregistrer = async () => {
    const v = validerModes(modes);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      await setDoc(doc(db, "equipe", id), { modes: v.modes, majLe: serverTimestamp() }, { merge: true });
      setMessage({ texte: "Modes enregistrés." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible pour l'instant (règles de l'équipe publiées à l'étape J5)." });
    }
  };
  return (
    <div className="tb-bloc">
      <h3>Mes modes de transport</h3>
      <p className="tb-note">Coche ce que tu as à disposition : l'application te conseillera le plus intéressant pour chaque course.</p>
      {MODES.map((m) => (
        <Case key={m.id} coche={(modes || []).includes(m.id)} onChange={(v) => setModes((l) => basculer(l, m.id, v))}>{m.label}</Case>
      ))}
      {message && <p className={message.erreur ? "admin-erreur" : "rg-ok"} role={message.erreur ? "alert" : "status"}>{message.texte}</p>}
      <button className="tb-bouton" disabled={!modes} onClick={enregistrer}>Enregistrer mes modes</button>
    </div>
  );
}

// Coequipier : ses reglages a lui (modes de transport, telephone, son plafond). Jamais ses droits.
export function MesReglages({ membre }) {
  const [f, setF] = useState(() => ({ telephone: membre.telephone || "", plafond: String(membre.plafond || ""), modes: membre.modes || [] }));
  const [message, setMessage] = useState(null);
  const changer = (k, v) => setF((a) => ({ ...a, [k]: v }));
  const enregistrer = async () => {
    const v = validerMesReglages(f);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      await updateDoc(doc(db, "equipe", membre.id), { ...v.maj, majLe: serverTimestamp() });
      setMessage({ texte: "Réglages enregistrés." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible. Vérifie la connexion puis réessaie." });
    }
  };
  return (
    <section className="tb-pad">
      <div className="tb-bloc">
        <h3>Mes modes de transport</h3>
        <p className="tb-note">Coche ce que tu as à disposition : l'application te conseillera le plus intéressant pour chaque course (la voiture de Rebecca, si elle te la prête, se règle avec les véhicules).</p>
        {MODES.map((m) => (
          <Case key={m.id} coche={f.modes.includes(m.id)} onChange={(v) => changer("modes", basculer(f.modes, m.id, v))}>{m.label}</Case>
        ))}
      </div>
      <div className="tb-bloc">
        <h3>Mon téléphone</h3>
        <input className="am-champ" type="tel" inputMode="tel" value={f.telephone} maxLength={20} onChange={(e) => changer("telephone", e.target.value)} />
      </div>
      <div className="tb-bloc">
        <h3>Mon plafond osek patur</h3>
        <div className="rg-ligne">
          <input inputMode="numeric" value={f.plafond} onChange={(e) => changer("plafond", e.target.value)} />
          <span>₪ par an (le tien, séparé de celui de Rebecca)</span>
        </div>
      </div>
      {message && <p className={message.erreur ? "admin-erreur" : "rg-ok"} role={message.erreur ? "alert" : "status"}>{message.texte}</p>}
      <button className="tb-bouton" onClick={enregistrer}>Enregistrer</button>
      <p className="tb-note">Les tarifs, les textes du site et l'équipe restent réglés par Rebecca.</p>
    </section>
  );
}
