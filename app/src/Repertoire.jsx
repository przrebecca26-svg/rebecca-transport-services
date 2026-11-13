import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes } from "./accesDemandes.js";
import { construireFiches } from "./pricing/clients.js";
import { CATEGORIES, entreesRepertoire, filtrerEntrees, libelleCategorie } from "./pricing/fichesRepertoire.js";
import { familleVide } from "./pricing/familles.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import FicheRepertoire from "./FicheRepertoire.jsx";
import Champ from "./components/Champ.jsx";
import ChoixLieu from "./components/MesLieux.jsx";
import Familles from "./Familles.jsx";
import { lienWazePoint, lienWhatsApp } from "./pricing/navigation.js";
import { TYPES_LIEU, lieuVide, manqueLieu, cleAdresse, adressesClients, corriger } from "./pricing/repertoire.js";
import { useRepertoire, enregistrerRepertoire, enregistrerCleGoogle } from "./repertoireBase.js";
import { useFermetures } from "./fermetures.js";
import { definirCleGoogle, googleActif } from "./routing.js";
import "./client-commun.css";
import "./devis-rapide.css";

// REPERTOIRE (12 nov. 2026) : mes lieux habituels par leur nom, et les adresses de mes clientes.

const waze = (a) => lienWazePoint(a);
const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Lieu({ l, changer, supprimer, connues, ouvert, ouvrir }) {
  const set = (cle, valeur) => changer({ ...l, [cle]: valeur });
  return (
    <details className="bloc rp-enfant rp-trajet" open={ouvert} onToggle={(e) => ouvrir(e.currentTarget.open)}>
      <summary>
        <h3>{l.nom || "Nouveau lieu"}</h3>
        <span className="tdb-note">{l.adresse && l.adresse.label ? l.adresse.label : "Adresse à indiquer"}</span>
      </summary>
      <button type="button" className="tdb-retour" onClick={() => ouvrir(false)}>← Retour au répertoire</button>
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
        <button type="button" className="tdb-bouton" onClick={() => ouvrir(false)}>← Retour au répertoire</button>
      </div>
    </details>
  );
}

// Recherche d'adresses Google : Rebecca colle sa cle ici (jamais ecrite dans le programme)
function RechercheGoogle() {
  useFermetures(); // charge la cle deja enregistree
  const [cle, setCle] = useState("");
  const [message, setMessage] = useState("");
  const enregistrer = async (valeur) => {
    try {
      await enregistrerCleGoogle(valeur);
      definirCleGoogle(valeur);
      setCle("");
      setMessage(valeur ? (googleActif() ? "Clé enregistrée : la recherche Google est active." : "Cette clé n'a pas la bonne forme : vérifie que tu as tout copié.") : "Recherche Google arrêtée : retour au service gratuit.");
    } catch {
      setMessage("Enregistrement impossible : seule Rebecca peut régler la recherche Google.");
    }
  };
  return (
    <section className="tdb-bloc">
      <h2>Recherche d'adresses Google</h2>
      <p className="tdb-note">{googleActif() ? "✅ Active : écoles et magasins par leur nom, français, anglais ou hébreu, numéros de rue." : "Pas encore active : la recherche utilise le service gratuit."}</p>
      <div className="dr-actions">
        <input className="dr-tel" type="text" autoComplete="off" placeholder="Colle ici ta clé Google" value={cle} onChange={(e) => setCle(e.target.value)} />
        <button type="button" className="tdb-bouton" disabled={!cle.trim()} onClick={() => enregistrer(cle.trim())}>Enregistrer la clé</button>
        {googleActif() && <button type="button" className="dr-secondaire" onClick={() => enregistrer("")}>Arrêter la recherche Google</button>}
      </div>
      {message && <p className="tdb-note" role="status">{message}</p>}
    </section>
  );
}

// Fiches clientes du site (comme la rubrique Clients) + categories des clientes sans famille (document prive)
const COLLECTIONS = ["clients", "demandes", "clientsAdmin", "autorisations", "recharges", "mouvements"];
function useFichesClientes() {
  const [donnees, setDonnees] = useState({});
  const [categories, setCategories] = useState({});
  useEffect(() => {
    const arrets = COLLECTIONS.map((nom) =>
      onSnapshot(nom === "demandes" ? refDemandes() : collection(db, nom), (s) => setDonnees((a) => ({ ...a, [nom]: s.docs.map((x) => ({ id: x.id, ...x.data() })) })), () => setDonnees((a) => ({ ...a, [nom]: [] })))
    );
    arrets.push(onSnapshot(doc(db, "admin", "categoriesClients"), (s) => {
      try {
        setCategories(s.exists() ? JSON.parse(s.data().json || "{}") || {} : {});
      } catch {
        setCategories({});
      }
    }, () => {}));
    return () => arrets.forEach((a) => a());
  }, []);
  const pret = COLLECTIONS.every((n) => Array.isArray(donnees[n]));
  const fiches = useMemo(() => {
    if (!pret) return [];
    const admins = Object.fromEntries(donnees.clientsAdmin.map((x) => [x.id, x]));
    const transport = new Set(donnees.autorisations.filter((a) => a.activite === "transport" && a.actif === true).map((a) => a.uid || String(a.id).split("__")[0]));
    return construireFiches({ clients: donnees.clients, demandes: donnees.demandes, admins, transport, recharges: donnees.recharges, mouvements: donnees.mouvements });
  }, [pret, donnees]);
  const changerCategorie = (cle, v) => setDoc(doc(db, "admin", "categoriesClients"), { json: JSON.stringify({ ...categories, [cle]: v }), majLe: serverTimestamp() });
  return { pret, fiches, categories, changerCategorie, demandes: donnees.demandes || [], mouvements: donnees.mouvements || [] };
}

export default function Repertoire({ aller = null }) {
  const rep = useRepertoire();
  const { moi } = useEquipeContexte();
  const estAdmin = moi === ADMIN_ID;
  const fc = useFichesClientes();
  const [ficheOuverte, setFicheOuverte] = useState(null); // cle d'une entree, ou { nouvelle: famille }
  const [categorie, setCategorie] = useState("tous");
  const [lieux, setLieux] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [enCorrection, setEnCorrection] = useState(""); // "cle|nom" de l'adresse en cours de correction
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const [texte, setTexte] = useState("");
  const [lieuOuvert, setLieuOuvert] = useState(""); // un seul lieu ouvert a la fois, avec sa fleche de retour

  useEffect(() => {
    if (!modifie) {
      setLieux(rep.lieux);
      setCorrections(rep.corrections);
      setFamilles(rep.familles);
    }
  }, [rep, modifie]);

  if (!lieux) return <p className="tdb-note tb-pad">Chargement du répertoire…</p>;

  // 13 nov. 2026 : tout le monde dans un seul Repertoire (moi, famille et amis, clientes), chacun avec sa Fiche
  const entrees = entreesRepertoire(rep.familles, fc.fiches, fc.categories);
  const lieuxConnus0 = lieux.filter((x) => x.nom.trim() && cleAdresse(x.adresse)).map((x) => ({ id: x.id, nom: x.nom, adresse: x.adresse }));
  if (ficheOuverte) {
    const entree = ficheOuverte.nouvelle
      ? { cle: "fam:" + ficheOuverte.nouvelle.id, type: "famille", nom: "Nouvelle fiche", telephone: "", categorie: ficheOuverte.nouvelle.categorie, famille: ficheOuverte.nouvelle, clients: [] }
      : entrees.find((x) => x.cle === ficheOuverte);
    if (entree) {
      return (
        <FicheRepertoire
          key={entree.cle}
          entree={entree}
          demandes={fc.demandes}
          mouvements={fc.mouvements}
          estAdmin={estAdmin}
          categorie={entree.categorie}
          changerCategorie={(v) => fc.changerCategorie(entree.cle, v).catch(() => {})}
          retour={() => setFicheOuverte(null)}
          ouvrirFicheCliente={aller ? (cle) => aller("clients", cle) : null}
          connues={lieuxConnus0}
        />
      );
    }
  }

  const changer = (suite) => {
    setLieux(suite);
    setModifie(true);
    setMessage("");
  };
  const enregistrer = async () => {
    const pb = lieux.map(manqueLieu).find(Boolean);
    if (pb) return setMessage(pb);
    try {
      await enregistrerRepertoire(lieux, corrections, familles);
      setModifie(false);
      setLieuOuvert("");
      setEnCorrection("");
      setMessage("C'est enregistré.");
    } catch {
      setMessage("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
    return undefined;
  };
  const dejaLieu = (a) => !!cleAdresse(a) && lieux.some((l) => cleAdresse(l.adresse) === cleAdresse(a));
  const q = sansAccent(texte.trim());
  const voit = (...mots) => !q || mots.some((m) => sansAccent(m).includes(q));
  const changerCorrections = (suite) => {
    setCorrections(suite);
    setModifie(true);
    setMessage("");
  };
  const lieuxConnus = lieux.filter((x) => x.nom.trim() && cleAdresse(x.adresse)).map((x) => ({ id: x.id, nom: x.nom, adresse: x.adresse }));
  const clientes = adressesClients(rep.bruts, corrections).filter((c) => voit(c.nom, c.telephone, ...c.adresses.map((a) => a.nom)));

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Répertoire</h1>
        <p className="tdb-sous">Mes adresses habituelles et celles de mes clientes. Partout où je tape une adresse, j'écris le nom et elle se remplit.</p>
      </div>
      <input className="dr-tel rp-large" type="search" placeholder="Chercher un nom (Alexia, Carrefour, école…)" value={texte} onChange={(e) => setTexte(e.target.value)} />

      <div className="tb-filtres" role="tablist" aria-label="Catégories">
        {[{ v: "tous", l: "Tous" }, ...CATEGORIES].map((c) => (
          <button key={c.v} role="tab" aria-selected={categorie === c.v} className={"tb-filtre" + (categorie === c.v ? " actif" : "")} onClick={() => setCategorie(c.v)}>
            {c.l} <span>{c.v === "tous" ? entrees.length : entrees.filter((x) => x.categorie === c.v).length}</span>
          </button>
        ))}
      </div>
      <section className="tdb-bloc">
        {!fc.pret && <p className="tdb-note">Chargement des clientes du site…</p>}
        {filtrerEntrees(entrees, categorie, texte).map((x) => (
          <div key={x.cle} className="rp-forfait">
            <span>
              <strong>{x.nom}</strong>
              <small> · {x.telephone || "pas de téléphone"} · {libelleCategorie(x.categorie)}</small>
            </span>
            <button type="button" className="tdb-bouton" onClick={() => setFicheOuverte(x.cle)}>Fiche</button>
          </div>
        ))}
        <button type="button" className="dr-secondaire rp-large" onClick={() => setFicheOuverte({ nouvelle: { ...familleVide(), enfants: [], categorie: categorie === "tous" ? "clientes" : categorie } })}>+ Nouvelle fiche</button>
      </section>
      {(estAdmin || familles.length > 0) && (
        <details className="tdb-bloc">
          <summary>Toutes les familles et enfants (doublons, fusion)</summary>
          <Familles familles={familles} connues={lieuxConnus} voit={voit} changer={(suite) => { setFamilles(suite); setModifie(true); setMessage(""); }} />
        </details>
      )}

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
                <Lieu key={l.id} l={l} connues={lieuxConnus} ouvert={lieuOuvert === l.id} ouvrir={(oui) => { setLieuOuvert((actuel) => (oui ? l.id : actuel === l.id ? "" : actuel)); if (!oui) window.scrollTo({ top: 0, behavior: "smooth" }); }} changer={(n) => changer(lieux.map((x) => (x.id === l.id ? n : x)))} supprimer={() => changer(lieux.filter((x) => x.id !== l.id))} />
              ))}
            </div>
          );
        })}
      </div>
      <button type="button" className="dr-secondaire rp-large" onClick={() => { const nouveau = lieuVide(); setTexte(""); setLieuOuvert(nouveau.id); changer([...lieux, nouveau]); }}>+ Ajouter un lieu</button>

      <section className="tdb-bloc">
        <h2>Adresses de mes clientes</h2>
        <p className="tdb-note">Leurs adresses viennent de leurs comptes et se mettent à jour toutes seules.</p>
        {clientes.length === 0 && <p className="tdb-note">Aucune cliente avec une adresse enregistrée{q ? " pour cette recherche" : ""}.</p>}
        {clientes.map((c) => (
          <details className="rp-journee" key={c.cle}>
            <summary><span>{c.nom}</span><b>{c.adresses.length} adresse{c.adresses.length > 1 ? "s" : ""}</b></summary>
            {c.telephone && <p className="tdb-note"><a className="rp-waze" href={lienWhatsApp(c.telephone)} target="_blank" rel="noopener noreferrer">WhatsApp {c.telephone}</a></p>}
            <ol className="rp-arrets rp-adresses-cliente">
              {c.adresses.map((a, k) => {
                const id = `${c.cle}|${a.nom}`;
                return (
                  <li key={k}>
                    <span>{a.nom} <small>{a.adresse.label}{a.corrigee ? " · corrigée par moi" : ""}</small></span>
                    <div className="rp-boutons">
                      <a className="rp-waze" href={waze(a.adresse)} target="_blank" rel="noopener noreferrer">Waze</a>
                      <button type="button" className="rp-waze" onClick={() => setEnCorrection(enCorrection === id ? "" : id)}>Corriger</button>
                      <button type="button" className="rp-waze" onClick={() => changerCorrections(corriger(corrections, c.cle, a.nom, { masquee: true }))}>Masquer</button>
                      {cleAdresse(a.adresse) && !dejaLieu(a.adresse) && (
                        <button type="button" className="rp-waze" onClick={() => changer([...lieux, { ...lieuVide(), nom: `${c.nom} · ${a.nom}`.slice(0, 40), type: "famille", adresse: a.adresse }])}>+ Mes lieux</button>
                      )}
                    </div>
                    {enCorrection === id && (
                      <div className="rp-correction">
                        <ChoixLieu id={"cc-" + k + c.cle} connues={lieuxConnus} valeur={a.adresse} choisir={(x) => changerCorrections(corriger(corrections, c.cle, a.nom, { adresse: x }))} />
                        <Champ champ={{ name: "corr", label: "La bonne adresse", type: "adresse", indice: "Seulement dans mon répertoire : le compte de la cliente n'est pas modifié." }} valeurs={{ corr: a.corrigee ? a.adresse : null }} onChange={(_, v) => changerCorrections(corriger(corrections, c.cle, a.nom, { adresse: v }))} />
                        {a.corrigee && <button type="button" className="dr-secondaire" onClick={() => changerCorrections(corriger(corrections, c.cle, a.nom))}>Revenir à l'adresse du compte ({a.origine.label})</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {c.masquees.length > 0 && (
              <p className="tdb-note">Masquées : {c.masquees.map((m) => (
                <button key={m.nom} type="button" className="rp-waze" onClick={() => changerCorrections(corriger(corrections, c.cle, m.nom))}>Réafficher {m.nom}</button>
              ))}</p>
            )}
          </details>
        ))}
      </section>

      <RechercheGoogle />

      <div className="rp-enregistrer">
        <button type="button" className="tdb-bouton" onClick={enregistrer} disabled={!modifie}>{modifie ? "Enregistrer mon répertoire" : "Tout est enregistré"}</button>
        {message && <p className="tdb-note" role="status">{message}</p>}
      </div>
    </div>
  );
}
