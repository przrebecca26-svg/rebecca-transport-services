import { useState } from "react";
import { doc, serverTimestamp, setDoc, collection } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { CHOIX_SAISIE, ajouterLigne, courseDuCompte, historique, ligneSupprimable, nouvelIdCompte, phraseSolde, retirerLigne, soldeCompte } from "./pricing/comptesEntreNous.js";
import { enregistrerComptes, useComptes, useCoursesEtMouvements } from "./comptesBase.js";
import { useRepertoire } from "./repertoireBase.js";

// COMPTES ENTRE NOUS (13 nov. 2026) - Rebecca seule. Un compte par personne (Alexia, gg Dahan...) avec un solde dans
// les deux sens. Ce qui est encaisse se place tout seul sur ses courses -> Finances (SyncComptes).
// « Il/elle me doit » (ancienne dette) cree une course terminee : elle entre dans Finances et se paie comme les autres.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => `${Number(n || 0).toLocaleString("fr-FR")} ₪`;
const jjmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

export default function ComptesEntreNous() {
  const { pret, comptes } = useComptes();
  const { demandes, mouvements } = useCoursesEtMouvements(true);
  const [ouvert, setOuvert] = useState("");
  const [nouveau, setNouveau] = useState(null);
  const [message, setMessage] = useState("");
  const rep = useRepertoire();
  if (!pret || !demandes || !mouvements) return <p className="admin-texte tb-pad">Chargement des comptes…</p>;

  const sauver = async (suite) => {
    setMessage("");
    try {
      await enregistrerComptes(suite);
      return true;
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
      return false;
    }
  };
  const creer = async () => {
    const c = { id: nouvelIdCompte(), nom: nouveau.nom.trim().slice(0, 60), telephone: nouveau.telephone.trim(), famille: nouveau.famille, note: "", lignes: [] };
    if (await sauver([...comptes, c])) {
      setNouveau(null);
      setOuvert(c.id);
    }
  };
  const c = comptes.find((x) => x.id === ouvert);
  if (c) return <Compte c={c} comptes={comptes} demandes={demandes} mouvements={mouvements} sauver={sauver} familles={rep.familles} retour={() => setOuvert("")} message={message} />;

  return (
    <section className="tb-pad">
      <p className="tdb-note">Pour les personnes avec qui tu fais des comptes à part : courses dues, paiements le jour même ou plus tard, troc. Ce que tu encaisses part dans Finances.</p>
      {comptes.length === 0 && <p className="admin-texte">Aucun compte pour l'instant.</p>}
      {comptes.map((x) => {
        const s = soldeCompte(x, demandes, mouvements);
        return (
          <button key={x.id} type="button" className="bloc rp-trajet" style={{ display: "block", width: "100%", textAlign: "left" }} onClick={() => setOuvert(x.id)}>
            <h3>{x.nom}</h3>
            <span className={s > 0 ? "fm-erreur" : "tdb-note"}>{phraseSolde(x.nom, s)}</span>
          </button>
        );
      })}
      {nouveau ? (
        <div className="bloc">
          <h3>Nouveau compte</h3>
          <label className="champ">Nom<input type="text" maxLength={60} value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} /></label>
          <label className="champ">Téléphone (facultatif, tu peux l'ajouter après)<input type="tel" inputMode="tel" maxLength={20} value={nouveau.telephone} onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })} /></label>
          <label className="champ">Famille du Répertoire (pour le domicile), facultatif
            <select value={nouveau.famille} onChange={(e) => setNouveau({ ...nouveau, famille: e.target.value })}>
              <option value="">Aucune</option>
              {rep.familles.map((f) => <option key={f.id} value={f.id}>{f.nom || "Sans nom"}</option>)}
            </select>
          </label>
          <p className="tdb-note">Les courses avec le même téléphone sont comptées toutes seules (ex. le forfait d'Alexia à 14h).</p>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!nouveau.nom.trim()} onClick={creer}>Créer le compte</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setNouveau(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" className="tb-bouton tb-clair" onClick={() => setNouveau({ nom: "", telephone: "", famille: "" })}>+ Nouveau compte</button>
      )}
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </section>
  );
}

const LIGNE_VIDE = { type: "paye", montant: "", libelle: "", moyen: TARIFS.moyensPaiement[0], date: "" };

function Compte({ c, comptes, demandes, mouvements, sauver, familles, retour, message }) {
  const [l, setL] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const s = soldeCompte(c, demandes, mouvements);
  const lignes = historique(c, demandes, mouvements);
  const montant = Number(String((l && l.montant) || "").replace(",", "."));

  const ajouter = async () => {
    setErreur("");
    setEnCours(true);
    const date = l.date || aujourdhui();
    try {
      if (l.type === "dette" || l.type === "passee") {
        // Ancienne dette = une course terminee : elle entre dans Finances (chiffre d'affaires) et se paie comme les autres
        const d = courseDuCompte(c, { date, heure: "12:00", titre: l.libelle.trim() || "Anciennes courses", prix: montant });
        if (!d) throw new Error("montant");
        await setDoc(doc(collection(db, "demandes")), { ...d, creeLe: serverTimestamp(), majLe: serverTimestamp() });
        // Deja payee : le paiement a la meme date se place tout seul sur cette course (Finances : encaisse ce jour-la)
        if (l.type === "passee" && !(await sauver(ajouterLigne(comptes, c.id, { type: "paye", date, montant, moyen: l.moyen, libelle: l.libelle.trim() })))) throw new Error("paiement");
        setL(null);
      } else if (await sauver(ajouterLigne(comptes, c.id, { ...l, date, montant }))) setL(null);
    } catch {
      setErreur("Enregistrement impossible. Vérifie le montant et la connexion.");
    }
    setEnCours(false);
  };

  return (
    <section className="tb-pad">
      <button type="button" className="tdb-retour" onClick={retour}>← Tous les comptes</button>
      <h3>{c.nom}{c.telephone ? ` · ${c.telephone}` : ""}</h3>
      <p className={s > 0 ? "fm-erreur" : "tdb-note"} style={{ fontSize: 18, fontWeight: 700 }}>{phraseSolde(c.nom, s)}</p>

      {l ? (
        <div className="bloc">
          <div className="choix" role="radiogroup" aria-label="Type">
            {CHOIX_SAISIE.map((t) => (
              <button key={t.v} type="button" role="radio" aria-checked={l.type === t.v} className={l.type === t.v ? "actif" : ""} onClick={() => setL({ ...l, type: t.v })}>{t.l}</button>
            ))}
          </div>
          <p className="tdb-note">{(CHOIX_SAISIE.find((t) => t.v === l.type) || {}).aide}{l.type === "dette" || l.type === "passee" ? " · entre dans Finances à sa date, comme une course." : l.type === "paye" ? " · part dans Finances (encaissé) sur ses courses dues ; le reste est une avance." : l.type === "jedois" ? " · déduit de ses courses (troc, pas d'argent reçu)." : " · seulement dans ce compte."}</p>
          <label className="champ">Montant (₪)<input type="text" inputMode="decimal" value={l.montant} onChange={(e) => setL({ ...l, montant: e.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          {(l.type === "paye" || l.type === "jepaie" || l.type === "passee") && (
            <label className="champ">Moyen de paiement
              <select value={l.moyen} onChange={(e) => setL({ ...l, moyen: e.target.value })}>
                {TARIFS.moyensPaiement.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}
          <label className="champ">Détail (facultatif)<input type="text" maxLength={120} placeholder={l.type === "dette" || l.type === "passee" ? "Courses de gg, livraison Herzliya…" : l.type === "jedois" ? "Mes ongles" : ""} value={l.libelle} onChange={(e) => setL({ ...l, libelle: e.target.value })} /></label>
          <label className="champ">Date<input type="date" value={l.date || aujourdhui()} onChange={(e) => setL({ ...l, date: e.target.value })} /></label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!(montant > 0) || enCours} onClick={ajouter}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setL(null)}>Annuler</button>
          </div>
          {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
        </div>
      ) : (
        <button type="button" className="tb-bouton" onClick={() => setL({ ...LIGNE_VIDE })}>+ Ajouter (payé, doit, troc…)</button>
      )}

      <ul className="ag-fil" style={{ marginTop: 12 }}>
        {lignes.length === 0 && <li className="ag-etape">Rien pour l'instant.</li>}
        {lignes.map((x) => (
          <li key={x.cle} className="ag-etape">
            <div className="ag-etape-ligne">
              <b>{jjmm(x.date)}</b>
              <span>
                {x.texte} · <strong>{x.signe > 0 ? "+" : "−"}{shekels(x.montant)}</strong>
                {x.course && <small>{x.reste > 0 ? ` · reste ${shekels(x.reste)}` : " · réglée"}</small>}
                {x.ligne && x.affecte > 0 && <small> · {shekels(x.affecte)} placés sur ses courses</small>}
              </span>
              {x.ligne && ligneSupprimable(c.lignes.find((y) => y.id === x.id) || {}) && (
                <button type="button" className="ag-modifier" onClick={() => sauver(retirerLigne(comptes, c.id, x.id))}>Supprimer</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {fiche ? (
        <div className="bloc">
          <label className="champ">Nom<input type="text" maxLength={60} value={fiche.nom} onChange={(e) => setFiche({ ...fiche, nom: e.target.value })} /></label>
          <label className="champ">Téléphone<input type="tel" inputMode="tel" maxLength={20} value={fiche.telephone} onChange={(e) => setFiche({ ...fiche, telephone: e.target.value })} /></label>
          <label className="champ">Famille du Répertoire
            <select value={fiche.famille} onChange={(e) => setFiche({ ...fiche, famille: e.target.value })}>
              <option value="">Aucune</option>
              {familles.map((f) => <option key={f.id} value={f.id}>{f.nom || "Sans nom"}</option>)}
            </select>
          </label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!fiche.nom.trim()} onClick={async () => (await sauver(comptes.map((x) => (x.id === c.id ? { ...x, ...fiche, nom: fiche.nom.trim() } : x)))) && setFiche(null)}>Enregistrer</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setFiche(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" className="dr-secondaire" onClick={() => setFiche({ nom: c.nom, telephone: c.telephone, famille: c.famille })}>Modifier le nom, le téléphone, la famille</button>
      )}
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </section>
  );
}
