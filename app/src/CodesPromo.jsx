import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { CODES_DE_DEPART, POURCENT_MAX, MONTANT_MAX, etatCode, libelleLimite, libelleRemise, normaliserCode, validerPromo } from "./pricing/promos.js";
import "./paiements.css";
import "./promos.css";

// Codes promo (espace prive de Rebecca).
// Un code = une remise sur le tarif de base du trajet ou du service (jamais sur les supplements).
// Un code ne peut pas etre utilise sans compte client. Les regles Firebase gardent ces codes prives.

const ETATS = {
  actif: { texte: "Actif", classe: "pm-confirmee" },
  inactif: { texte: "Désactivé", classe: "pm-annulee" },
  expire: { texte: "Expiré", classe: "" },
};

const dateFr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : "");
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const VIDE = { code: "", type: "pourcentage", valeur: "", limite: "", avecFin: false, finLe: "" };

export default function CodesPromo() {
  const [codes, setCodes] = useState(null); // null = chargement
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [mode, setMode] = useState(null); // null | "nouveau" | "modifier"
  const [f, setF] = useState(VIDE);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "promos"), orderBy("code"));
    return onSnapshot(
      q,
      (snap) => setCodes(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setLectureImpossible(true)
    );
  }, []);

  // Un message d'erreur disparait des qu'un champ est modifie
  useEffect(() => {
    setErreur("");
  }, [f]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture des codes impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (codes === null) return <p className="admin-texte tb-pad">Chargement des codes…</p>;

  const maj = (champ, valeur) => setF((x) => ({ ...x, [champ]: valeur }));

  const ouvrirNouveau = () => {
    setF(VIDE);
    setConfirmerSuppression(false);
    setErreur("");
    setMode("nouveau");
  };
  const ouvrirModifier = (c) => {
    setF({
      code: c.code,
      type: c.type,
      valeur: String(c.valeur),
      limite: c.utilisationsParCompte == null ? "" : String(c.utilisationsParCompte),
      avecFin: !!c.finLe,
      finLe: c.finLe || "",
    });
    setConfirmerSuppression(false);
    setErreur("");
    setMode("modifier");
  };
  const fermer = () => {
    setMode(null);
    setConfirmerSuppression(false);
    setErreur("");
  };

  // Construit le code a partir du formulaire
  const construire = () => {
    const nombre = (s) => (String(s).trim() === "" ? NaN : Number(String(s).replace(",", ".")));
    const limite = String(f.limite).trim() === "" ? null : nombre(f.limite);
    return {
      code: normaliserCode(f.code),
      type: f.type,
      valeur: nombre(f.valeur),
      actif: mode === "modifier" ? (codes.find((c) => c.code === f.code) || {}).actif !== false : true,
      utilisationsParCompte: limite,
      finLe: f.avecFin ? f.finLe || "" : null,
    };
  };

  const enregistrer = async () => {
    const p = construire();
    let err = validerPromo(p);
    if (!err && f.avecFin && !p.finLe) err = "Choisis la date de fin, ou décoche « Date de fin ».";
    if (!err && mode === "nouveau" && codes.some((c) => c.code === p.code)) err = "Ce code existe déjà. Modifie-le dans la liste.";
    if (err) {
      setErreur(err);
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      if (mode === "nouveau") {
        await setDoc(doc(db, "promos", p.code), { ...p, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "promos", p.code), {
          type: p.type,
          valeur: p.valeur,
          utilisationsParCompte: p.utilisationsParCompte,
          finLe: p.finLe,
          majLe: serverTimestamp(),
        });
      }
      fermer();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const basculer = async (c) => {
    setEnCours(true);
    setErreur("");
    try {
      await updateDoc(doc(db, "promos", c.code), { actif: c.actif !== true, majLe: serverTimestamp() });
    } catch {
      setErreur("Changement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const supprimer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await deleteDoc(doc(db, "promos", normaliserCode(f.code)));
      fermer();
    } catch {
      setErreur("Suppression impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const ajouterCodesDeDepart = async () => {
    setEnCours(true);
    setErreur("");
    try {
      const lot = writeBatch(db);
      for (const c of CODES_DE_DEPART) lot.set(doc(db, "promos", c.code), { ...c, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      await lot.commit();
    } catch {
      setErreur("Ajout impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const jour = aujourdhui();

  return (
    <section className="tb-liste">
      <div className="tb-bloc">
        <h3>Codes promo</h3>
        <p className="tb-note">
          La remise s'applique sur le tarif de base du trajet ou du service. Les suppléments (nuit, urgence, bagages, arrêts, étages, colis, péages) ne sont jamais réduits. Le prix final est arrondi au shekel supérieur. Le client doit avoir un compte pour utiliser un code.
        </p>

        {codes.length === 0 && mode === null && (
          <>
            <p className="tb-note">Aucun code pour l'instant.</p>
            <div className="tb-actions">
              <button className="tb-bouton" disabled={enCours} onClick={ajouterCodesDeDepart}>
                Ajouter mes 3 codes de départ
              </button>
            </div>
            <p className="tb-note">BIENVENUE10 (-10 ₪, 1 fois par compte), AMI10 (-10 %, sans limite), FIDELE5 (-5 %, 10 fois par compte).</p>
          </>
        )}

        {codes.length > 0 && (
          <ul className="pr-liste">
            {codes.map((c) => {
              const etat = ETATS[etatCode(c, jour)];
              return (
                <li key={c.id} className="pr-ligne">
                  <div className="pr-tete">
                    <strong>{c.code}</strong>
                    <span className={"pm-etat " + etat.classe}>{etat.texte}</span>
                  </div>
                  <p className="pr-meta">
                    {libelleRemise(c)} · {libelleLimite(c)}
                    {c.finLe ? " · jusqu'au " + dateFr(c.finLe) : ""}
                  </p>
                  {mode === null && (
                    <div className="tb-actions">
                      <button className="tb-bouton tb-clair" onClick={() => ouvrirModifier(c)}>
                        Modifier
                      </button>
                      <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => basculer(c)}>
                        {c.actif === true ? "Désactiver" : "Activer"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {mode === null && (
          <div className="tb-actions">
            <button className="tb-bouton" onClick={ouvrirNouveau}>
              Nouveau code
            </button>
          </div>
        )}

        {mode !== null && (
          <div className="pm-form">
            <h4>{mode === "nouveau" ? "Nouveau code" : "Modifier " + f.code}</h4>
            {mode === "nouveau" ? (
              <label className="pm-champ">
                Code (lettres sans accent, chiffres, tiret)
                <input value={f.code} maxLength={20} autoCapitalize="characters" autoCorrect="off" spellCheck={false} onChange={(e) => maj("code", normaliserCode(e.target.value))} placeholder="Ex : NOEL10" />
              </label>
            ) : (
              <p className="tb-note">Le nom d'un code ne peut pas changer. Pour un autre nom, crée un nouveau code.</p>
            )}
            <label className="pm-champ">
              Type de remise
              <select value={f.type} onChange={(e) => maj("type", e.target.value)}>
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="montant">Montant en shekels (₪)</option>
              </select>
            </label>
            <label className="pm-champ">
              {f.type === "pourcentage" ? "Remise en % (1 à " + POURCENT_MAX + ")" : "Remise en ₪ (1 à " + MONTANT_MAX + ")"}
              <input inputMode="numeric" value={f.valeur} onChange={(e) => maj("valeur", e.target.value)} />
            </label>
            <label className="pm-champ">
              Utilisations par compte (vide = sans limite)
              <input inputMode="numeric" value={f.limite} onChange={(e) => maj("limite", e.target.value)} placeholder="Ex : 1" />
            </label>
            <label className="pm-radio">
              <input type="checkbox" checked={f.avecFin} onChange={(e) => setF((x) => ({ ...x, avecFin: e.target.checked, finLe: e.target.checked && !x.finLe ? aujourdhui() : x.finLe }))} />
              <span>Date de fin</span>
            </label>
            {f.avecFin && (
              <label className="pm-champ">
                Valable jusqu'au (inclus)
                <input type="date" value={f.finLe} onChange={(e) => maj("finLe", e.target.value)} />
              </label>
            )}
            {!confirmerSuppression ? (
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>
                  Enregistrer
                </button>
                <button className="tb-bouton tb-clair" disabled={enCours} onClick={fermer}>
                  Annuler
                </button>
                {mode === "modifier" && (
                  <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => setConfirmerSuppression(true)}>
                    Supprimer ce code
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="tb-note">Supprimer définitivement {f.code} ? Les courses déjà enregistrées gardent leur remise. Pour arrêter un code sans le perdre, utilise plutôt « Désactiver ».</p>
                <div className="tb-actions">
                  <button className="tb-bouton tb-danger" disabled={enCours} onClick={supprimer}>
                    Oui, supprimer
                  </button>
                  <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => setConfirmerSuppression(false)}>
                    Non
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {erreur && (
          <p className="admin-erreur" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </section>
  );
}
