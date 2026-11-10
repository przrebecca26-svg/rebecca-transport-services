import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { appliquerTarifsBase } from "./fermetures.js";
import {
  ACTIVITES_CATALOGUE,
  CATALOGUE_DEPART,
  CATEGORIES_EPOXY,
  JOURS,
  PHOTO,
  TARIFS_DEPART,
  TARIFS_EDITABLES,
  TYPES_PRIX,
  activitesEffectives,
  avecAjustement,
  libelleDuree,
  libellePrix,
  lireTarifs,
  validerActivite,
  validerPhoto,
  validerPrestation,
  validerTarifs,
} from "./pricing/catalogue.js";
import { creneauxDuJour } from "./pricing/rendezvous.js";
import { useFermetures } from "./fermetures.js";
import "./reglages.css";

// REGLAGES DES FONDATIONS (Lot C, C1 et C2, 9 nov. 2026) - espace de Rebecca seulement.
//  - Tarifs : prix Transport et coursier (document public reglages/tarifs ; valeurs de depart = prix en ligne) ;
//  - Catalogue : prestations beaute et articles Epoxy (collection catalogue) : ajouter, modifier, publier ;
//  - Activites : horaires, temps entre deux clientes, acompte, acces (collection activites).
// Rebecca (21h14) : les prix valides sont la base de depart, TOUT est modifiable ici, sans code.

const NOMS_ACTIVITE = { nails: "Nails Prestige", hair: "Prestige Hair", slim: "Prestige Slim & Lift", regenx: "RegenX", epoxy: "Boutique Epoxy" };
const enTexte = (c, v) => (c.pourcent ? String(Math.round(v * 10000) / 100) : String(v));

function Message({ m }) {
  if (!m) return null;
  return <p className={m.erreur ? "admin-erreur" : "rg-ok"} role={m.erreur ? "alert" : "status"}>{m.texte}</p>;
}

/* ---------- Tarifs ---------- */
function Tarifs() {
  const [enBase, setEnBase] = useState(null);
  const [saisie, setSaisie] = useState(null);
  const [message, setMessage] = useState(null);
  const [ouvert, setOuvert] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "tarifs"),
        (s) => {
          const v = s.exists() ? lireTarifs(s.data().json) : {};
          setEnBase(v);
          appliquerTarifsBase(v, true);
        },
        () => setEnBase({})
      ),
    []
  );
  useEffect(() => {
    if (enBase && !saisie) setSaisie(Object.fromEntries(TARIFS_EDITABLES.map((c) => [c.chemin, enTexte(c, c.chemin in enBase ? enBase[c.chemin] : TARIFS_DEPART[c.chemin])])));
  }, [enBase, saisie]);

  if (!saisie) return <p className="tb-note tb-pad">Chargement des tarifs…</p>;
  const groupes = [...new Set(TARIFS_EDITABLES.map((c) => c.groupe))];
  const modifies = Object.keys(enBase || {}).length;

  const enregistrer = async () => {
    const v = validerTarifs(saisie);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      await setDoc(doc(db, "reglages", "tarifs"), { json: JSON.stringify(v.valeurs), majLe: serverTimestamp() });
      setMessage({ texte: "Tarifs enregistrés : le site les utilise tout de suite." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible pour l'instant (connexion ou règles Firebase)." });
    }
  };
  const revenir = (c) => setSaisie({ ...saisie, [c.chemin]: enTexte(c, TARIFS_DEPART[c.chemin]) });

  return (
    <section className="tb-liste">
      <div className="tb-bloc">
        <h3>Tarifs Transport et coursier</h3>
        <p className="tb-note">Valeurs de départ = les prix validés ensemble et en ligne aujourd'hui. Change un montant puis touche « Enregistrer » : le calculateur du site et le Devis rapide l'utilisent aussitôt.{modifies ? ` ${modifies} tarif${modifies > 1 ? "s" : ""} modifié${modifies > 1 ? "s" : ""}.` : " Aucun tarif modifié pour l'instant."}</p>
      </div>
      {groupes.map((g) => (
        <div key={g} className="tb-bloc">
          <button className="tb-ligne rg-groupe" onClick={() => setOuvert(ouvert === g ? null : g)} aria-expanded={ouvert === g}>
            <strong>{g}</strong>
            <span>{ouvert === g ? "−" : "+"}</span>
          </button>
          {ouvert === g &&
            TARIFS_EDITABLES.filter((c) => c.groupe === g).map((c) => {
              const change = saisie[c.chemin] !== enTexte(c, TARIFS_DEPART[c.chemin]);
              return (
                <label key={c.chemin} className="pm-champ">
                  {c.label}
                  <div className="rg-ligne">
                    <input inputMode="decimal" value={saisie[c.chemin]} onChange={(e) => setSaisie({ ...saisie, [c.chemin]: e.target.value })} />
                    <span>{c.unite}</span>
                    {change && (
                      <button type="button" className="tb-retour aj-lien" onClick={() => revenir(c)}>
                        départ : {enTexte(c, TARIFS_DEPART[c.chemin])}
                      </button>
                    )}
                  </div>
                </label>
              );
            })}
        </div>
      ))}
      <Message m={message} />
      <button className="tb-bouton" onClick={enregistrer}>Enregistrer les tarifs</button>
    </section>
  );
}

/* ---------- Photos d'un article (21h26) : reduites dans le telephone, rangees dans « photosCatalogue » ---------- */
function reduirePhoto(fichier) {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => ko(new Error("lecture"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => ko(new Error("image"));
      img.onload = () => {
        const r = Math.min(1, PHOTO.cote / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        let q = PHOTO.qualite;
        let d = c.toDataURL("image/jpeg", q);
        while (d.length > PHOTO.maxOctets && q > 0.35) {
          q -= 0.1;
          d = c.toDataURL("image/jpeg", q);
        }
        ok(d);
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

function PhotosArticle({ prestationId }) {
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "photosCatalogue"), where("prestationId", "==", prestationId)),
        (s) => setPhotos(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => (a.ordre || 0) - (b.ordre || 0))),
        () => setMessage({ texte: "Les photos seront disponibles après la mise à jour des règles Firebase (fin du Lot C)." })
      ),
    [prestationId]
  );
  const ajouter = async (e) => {
    const fichiers = [...(e.target.files || [])].slice(0, PHOTO.maxParArticle - photos.length);
    e.target.value = "";
    if (!fichiers.length) return;
    setEnCours(true);
    setMessage(null);
    try {
      let ordre = photos.length;
      for (const f of fichiers) {
        const v = validerPhoto({ donnees: await reduirePhoto(f) });
        if (v.erreur) throw new Error(v.erreur);
        await addDoc(collection(db, "photosCatalogue"), { prestationId, ...v.photo, ordre: ordre++, creeLe: serverTimestamp() });
      }
    } catch (err) {
      setMessage({ erreur: true, texte: err && err.message && err.message.length > 12 ? err.message : "Ajout impossible pour l'instant (connexion ou règles Firebase)." });
    }
    setEnCours(false);
  };
  const legende = async (p, texte) => {
    const v = validerPhoto({ donnees: p.donnees, legende: texte });
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      await updateDoc(doc(db, "photosCatalogue", p.id), { legende: v.photo.legende });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible." });
    }
  };
  const supprimer = async (p) => {
    try {
      await deleteDoc(doc(db, "photosCatalogue", p.id));
    } catch {
      setMessage({ erreur: true, texte: "Suppression impossible." });
    }
  };
  return (
    <div className="rg-photos">
      <p className="tb-note">Photos ({photos.length}/{PHOTO.maxParArticle}) : réduites automatiquement. Description facultative (dimensions, couleurs…).</p>
      {photos.map((p) => (
        <div key={p.id} className="rg-photo">
          <img src={p.donnees} alt={p.legende || "Photo de l'article"} />
          <input className="am-champ" defaultValue={p.legende || ""} maxLength={PHOTO.legendeMax} placeholder="Ex : 30 x 20 cm, noir et or" onBlur={(e) => e.target.value !== (p.legende || "") && legende(p, e.target.value)} />
          <button type="button" className="tb-bouton tb-danger" onClick={() => { if (confirm("Supprimer cette photo ?")) supprimer(p); }}>Supprimer</button>
        </div>
      ))}
      {photos.length < PHOTO.maxParArticle && (
        <label className="tb-bouton tb-clair rg-ajout-photo">
          {enCours ? "Ajout en cours…" : "+ Ajouter des photos"}
          <input type="file" accept="image/*" multiple hidden disabled={enCours} onChange={ajouter} />
        </label>
      )}
      <Message m={message} />
    </div>
  );
}

/* ---------- Catalogue ---------- */
const vide = (activite) => ({ activite, categorie: activite === "epoxy" ? CATEGORIES_EPOXY[0] : "", nom: "", description: "", typePrix: "fixe", prix: "", prixMax: "", dureeMinutes: activite === "epoxy" ? "" : "60", option: false, variantes: [], publiee: false, delaiFabrication: activite === "epoxy" ? "2 à 5 jours" : "" });
const enFormulaire = (x) => ({ ...x, prix: x.prix == null ? "" : String(x.prix), prixMax: x.prixMax == null ? "" : String(x.prixMax), dureeMinutes: x.dureeMinutes == null ? "" : String(x.dureeMinutes), variantes: (x.variantes || []).map((v) => ({ nom: v.nom, prix: String(v.prix) })), delaiFabrication: x.delaiFabrication || "" });

function FichePrestation({ f: depart, existe, onFermer }) {
  const [f, setF] = useState(depart);
  const [message, setMessage] = useState(null);
  const ch = (k, v) => setF((a) => ({ ...a, [k]: v }));
  const commande = f.activite === "epoxy";
  const enregistrer = async () => {
    const v = validerPrestation(f);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      const id = f.id || `${f.activite}-${Date.now().toString(36)}`;
      await setDoc(doc(db, "catalogue", id), { ...v.prestation, ordre: f.ordre ?? 999, majLe: serverTimestamp() });
      onFermer();
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible pour l'instant (connexion ou règles Firebase)." });
    }
  };
  const variante = (i, k, val) => ch("variantes", f.variantes.map((v, j) => (j === i ? { ...v, [k]: val } : v)));
  return (
    <div className="tb-bloc pm-form">
      <h4>{existe ? "Modifier" : commande ? "Nouvel article" : "Nouvelle prestation"} · {NOMS_ACTIVITE[f.activite]}</h4>
      <label className="pm-champ">Nom<input value={f.nom} maxLength={100} onChange={(e) => ch("nom", e.target.value)} /></label>
      <label className="pm-champ">
        Catégorie
        <input value={f.categorie} maxLength={60} list={"cat-" + f.activite} onChange={(e) => ch("categorie", e.target.value)} />
      </label>
      <label className="pm-champ">Descriptif (facultatif)<textarea rows={3} value={f.description} maxLength={1000} onChange={(e) => ch("description", e.target.value)} /></label>
      <label className="pm-champ">
        Type de prix
        <select value={f.typePrix} onChange={(e) => ch("typePrix", e.target.value)}>
          {TYPES_PRIX.filter((t) => commande ? t.id !== "parongle" : true).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      {f.typePrix !== "devis" && (
        <div className="fi-deux">
          <label className="pm-champ">Prix (₪)<input inputMode="decimal" value={f.prix} onChange={(e) => ch("prix", e.target.value)} placeholder={f.typePrix === "prive" ? "privé" : ""} /></label>
          <label className="pm-champ">Jusqu'à (₪, facultatif)<input inputMode="decimal" value={f.prixMax} onChange={(e) => ch("prixMax", e.target.value)} /></label>
        </div>
      )}
      {!commande && <label className="pm-champ">Durée (minutes)<input inputMode="numeric" value={f.dureeMinutes} onChange={(e) => ch("dureeMinutes", e.target.value)} /></label>}
      {commande && (
        <>
          <label className="pm-champ">Délai de fabrication<input value={f.delaiFabrication} maxLength={40} onChange={(e) => ch("delaiFabrication", e.target.value)} /></label>
          <p className="tb-note">Variantes (ex. Petit / Grand, Époxy / Bougie) : chacune son prix.</p>
          {f.variantes.map((v, i) => (
            <div key={i} className="fi-deux">
              <input className="am-champ" value={v.nom} placeholder="Nom" maxLength={40} onChange={(e) => variante(i, "nom", e.target.value)} />
              <input className="am-champ" inputMode="decimal" value={v.prix} placeholder="Prix ₪" onChange={(e) => variante(i, "prix", e.target.value)} />
            </div>
          ))}
          {f.variantes.length < 6 && <button type="button" className="tb-retour aj-lien" onClick={() => ch("variantes", [...f.variantes, { nom: "", prix: "" }])}>+ Ajouter une variante</button>}
        </>
      )}
      {existe && f.id ? <PhotosArticle prestationId={f.id} /> : <p className="tb-note">Les photos s'ajoutent après le premier enregistrement.</p>}
      <label className="rg-case"><input type="checkbox" checked={f.option} onChange={(e) => ch("option", e.target.checked)} /> Option (s'ajoute à une prestation)</label>
      <label className="rg-case"><input type="checkbox" checked={f.publiee} onChange={(e) => ch("publiee", e.target.checked)} /> Publiée (visible des clientes quand l'activité est ouverte)</label>
      <Message m={message} />
      <div className="tb-actions">
        <button className="tb-bouton" onClick={enregistrer}>Enregistrer</button>
        <button className="tb-bouton tb-clair" onClick={onFermer}>Annuler</button>
      </div>
    </div>
  );
}

function Catalogue() {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState("");
  const [activite, setActivite] = useState("nails");
  const [edition, setEdition] = useState(null); // { f, existe }
  const [message, setMessage] = useState(null);
  const [fichesActivites, setFichesActivites] = useState([]);
  useEffect(() => onSnapshot(collection(db, "activites"), (s) => setFichesActivites(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {}), []);
  const ajust = (activitesEffectives(fichesActivites).find((a) => a.id === activite) || {}).ajustementPourcent || 0;

  useEffect(
    () =>
      onSnapshot(
        collection(db, "catalogue"),
        (s) => setListe(s.docs.map((x) => ({ id: x.id, ...x.data() }))),
        () => {
          setListe([]);
          setErreur("Le catalogue en base sera disponible après la mise à jour des règles Firebase (fin du Lot C). En attendant, voici les valeurs de départ.");
        }
      ),
    []
  );
  const enBase = (liste || []).length > 0;
  const source = enBase ? liste : CATALOGUE_DEPART;
  const items = useMemo(() => source.filter((x) => x.activite === activite).sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999) || String(a.nom).localeCompare(String(b.nom))), [source, activite]);
  const categories = [...new Set(items.map((x) => x.categorie))];

  const importer = async () => {
    try {
      const lot = writeBatch(db);
      for (const x of CATALOGUE_DEPART) {
        const { id, ...reste } = x;
        lot.set(doc(db, "catalogue", id), { ...reste, majLe: serverTimestamp() });
      }
      await lot.commit();
      setMessage({ texte: "Catalogue de départ enregistré : tu peux maintenant tout modifier." });
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible pour l'instant (règles Firebase pas encore à jour)." });
    }
  };

  if (liste === null) return <p className="tb-note tb-pad">Chargement du catalogue…</p>;
  if (edition) return <section className="tb-liste"><FichePrestation key={edition.f.id || "neuf"} f={edition.f} existe={edition.existe} onFermer={() => setEdition(null)} /></section>;

  return (
    <section className="tb-liste">
      <div className="tb-filtres tb-pad" role="tablist" aria-label="Activité">
        {ACTIVITES_CATALOGUE.map((a) => (
          <button key={a} role="tab" aria-selected={activite === a} className={"tb-filtre" + (activite === a ? " actif" : "")} onClick={() => setActivite(a)}>{NOMS_ACTIVITE[a]}</button>
        ))}
      </div>
      {erreur && <p className="tb-note tb-pad">{erreur}</p>}
      {!enBase && !erreur && (
        <div className="tb-bloc">
          <p className="tb-note">Le catalogue n'est pas encore dans la base. Touche le bouton pour y enregistrer les prestations validées le 4 novembre (Nails, Hair, Slim & Lift, durées RegenX). Elles restent non publiées.</p>
          <button className="tb-bouton" onClick={importer}>Enregistrer le catalogue de départ</button>
        </div>
      )}
      <Message m={message} />
      {enBase && <button className="tb-bouton tb-pad" onClick={() => setEdition({ f: vide(activite), existe: false })}>{activite === "epoxy" ? "+ Ajouter un article" : "+ Ajouter une prestation"}</button>}
      {activite === "epoxy" && items.length === 0 && <p className="tb-note tb-pad">Aucun article pour l'instant. Ajoute tes créations une par une (nom, descriptif, prix ou variantes, délai).</p>}
      {ajust !== 0 && <p className="fi-alerte tb-pad">Ajustement en cours : {ajust > 0 ? "+" : ""}{ajust} % sur tous les prix de {NOMS_ACTIVITE[activite]} (prix de base conservés). Pour revenir aux prix de base : Activités → {NOMS_ACTIVITE[activite]} → 0.</p>}
      {activite === "regenx" && <p className="tb-note tb-pad">Les prix RegenX ne sont jamais affichés aux clientes : saisis-les ici, ils restent privés.</p>}
      {categories.map((c) => (
        <div key={c} className="tb-bloc">
          <h3>{c}</h3>
          {items.filter((x) => x.categorie === c).map((x) => (
            <div key={x.id} className="tb-carte" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
              <div style={{ flex: 1 }}>
                <span className="tb-ligne">
                  <strong>{x.nom}</strong>
                  <strong>{ajust && x.typePrix !== "prive" && x.typePrix !== "devis" ? <><s>{libellePrix(x)}</s> {libellePrix(avecAjustement(x, ajust))}</> : libellePrix(x)}</strong>
                </span>
                <span className="tb-quand">
                  {x.dureeMinutes ? libelleDuree(x.dureeMinutes) : x.delaiFabrication || ""}
                  {x.option ? " · option" : ""} · {x.publiee ? "publiée" : "non publiée"}
                </span>
              </div>
              <button type="button" className="tb-bouton" style={{ fontSize: 13, padding: "4px 8px" }} onClick={() => setEdition({ f: enFormulaire(x), existe: true })}>Modifier</button>
              <button type="button" className="tb-bouton tb-danger" style={{ fontSize: 13, padding: "6px 10px" }} onClick={async () => {
                if (!confirm("Supprimer « " + x.nom + " » ? Cette action est irréversible.")) return;
                try {
                  await deleteDoc(doc(db, "catalogue", x.id));
                } catch {
                  setMessage({ erreur: true, texte: "Suppression impossible." });
                }
              }}>Supprimer</button>
            </div>
          ))}
        </div>
      ))}
      <datalist id={"cat-" + activite}>
        {(activite === "epoxy" ? CATEGORIES_EPOXY : categories).map((c) => <option key={c} value={c} />)}
      </datalist>
    </section>
  );
}

/* ---------- Apercu des creneaux (C3) : ce que verra une cliente ---------- */
const demain = () => {
  const d = new Date(Date.now() + 86400000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
};
function ApercuCreneaux({ activite }) {
  useFermetures(); // Chabbat, fetes, fermetures et creneaux fixes a jour
  const [date, setDate] = useState(demain());
  const [duree, setDuree] = useState("60");
  const [occupes, setOccupes] = useState([]);
  useEffect(() => onSnapshot(collection(db, "creneauxOccupes"), (s) => setOccupes(s.docs.map((x) => x.data())), () => setOccupes([])), []);
  const liste = creneauxDuJour({ activite, dureeMinutes: Number(duree) || 60, date, occupes, pas: 30, maintenantMs: Date.now() });
  return (
    <div className="tb-bloc">
      <h3>Aperçu : ce que verra une cliente</h3>
      <div className="fi-deux">
        <label className="pm-champ">Jour<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="pm-champ">Durée (min)<input inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} /></label>
      </div>
      {liste.length === 0 && <p className="tb-note">Jour fermé pour cette activité.</p>}
      <div className="rg-creneaux">
        {liste.map((c) => (
          <span key={c.heure} className={"rg-creneau" + (c.libre ? "" : " gris")}>{c.heure}</span>
        ))}
      </div>
      <p className="tb-note">Gris = indisponible (Chabbat, fêtes, fermetures, école, tes courses, temps entre deux clientes). La cliente ne voit jamais pourquoi.</p>
    </div>
  );
}

/* ---------- Activites ---------- */
function FicheActivite({ a, onFermer }) {
  const [f, setF] = useState({ ...a, ajustementPourcent: String(a.ajustementPourcent || 0), margeMinutes: String(a.margeMinutes), acomptePourcent: String(a.acomptePourcent), acompteMin: String(a.acompteMin), delaiAcompteHeures: String(a.delaiAcompteHeures) });
  const [message, setMessage] = useState(null);
  const ch = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const enregistrer = async () => {
    const v = validerActivite(f);
    if (v.erreur) return setMessage({ erreur: true, texte: v.erreur });
    try {
      await setDoc(doc(db, "activites", a.id), { ...v.fiche, majLe: serverTimestamp() }, { merge: true });
      onFermer();
    } catch {
      setMessage({ erreur: true, texte: "Enregistrement impossible pour l'instant (connexion ou règles Firebase)." });
    }
  };
  const basculer = (j) => ch("jours", f.jours.includes(j) ? f.jours.filter((x) => x !== j) : [...f.jours, j]);
  const rendezvous = a.type === "rendezvous";
  return (
    <div className="tb-bloc pm-form">
      <h4>{a.nom}</h4>
      <label className="pm-champ">Nom affiché<input value={f.nom} maxLength={60} onChange={(e) => ch("nom", e.target.value)} /></label>
      <p className="tb-note">Jours ouverts</p>
      <div className="tb-filtres" style={{ flexWrap: "wrap" }}>
        {JOURS.map((j, i) => (
          <button key={j} type="button" className={"tb-filtre" + (f.jours.includes(i) ? " actif" : "")} aria-pressed={f.jours.includes(i)} onClick={() => basculer(i)}>{j}</button>
        ))}
      </div>
      <p className="tb-note">Vendredi : jamais pendant Chabbat (fermé automatiquement). Samedi : fermé automatiquement.</p>
      <div className="fi-deux">
        <label className="pm-champ">De<input type="time" value={f.debut} onChange={(e) => ch("debut", e.target.value)} /></label>
        <label className="pm-champ">À<input type="time" value={f.fin} onChange={(e) => ch("fin", e.target.value)} /></label>
      </div>
      <label className="pm-champ">
        {rendezvous ? "Temps entre deux clientes (minutes)" : "Marge entre deux courses ou commandes (minutes)"}
        <input inputMode="numeric" value={f.margeMinutes} onChange={(e) => ch("margeMinutes", e.target.value)} />
      </label>
      <div className="fi-deux">
        <label className="pm-champ">Acompte (%)<input inputMode="decimal" value={f.acomptePourcent} onChange={(e) => ch("acomptePourcent", e.target.value)} /></label>
        <label className="pm-champ">Minimum (₪)<input inputMode="decimal" value={f.acompteMin} onChange={(e) => ch("acompteMin", e.target.value)} /></label>
      </div>
      <label className="pm-champ">Délai pour payer l'acompte (heures)<input inputMode="numeric" value={f.delaiAcompteHeures} onChange={(e) => ch("delaiAcompteHeures", e.target.value)} /></label>
      {(a.type === "rendezvous" || a.type === "commande") && (
        <label className="pm-champ">
          Ajuster tous les prix (%)
          <input inputMode="numeric" value={f.ajustementPourcent} onChange={(e) => ch("ajustementPourcent", e.target.value)} />
          <span className="tb-note">Ex. -10 = tous les prix baissent de 10 % (arrondis à 5 ₪). Tes prix de base restent enregistrés : remets 0 pour y revenir. Le clavier n'a pas de « − » ? Utilise les boutons.</span>
          <span className="tb-actions">
            <button type="button" className="tb-filtre" onClick={() => ch("ajustementPourcent", String((Number(f.ajustementPourcent) || 0) - 5))}>− 5 %</button>
            <button type="button" className="tb-filtre" onClick={() => ch("ajustementPourcent", String((Number(f.ajustementPourcent) || 0) + 5))}>+ 5 %</button>
            <button type="button" className="tb-filtre" onClick={() => ch("ajustementPourcent", "0")}>Prix de base</button>
          </span>
        </label>
      )}
      <label className="pm-champ">
        Accès
        <select value={f.acces} onChange={(e) => ch("acces", e.target.value)}>
          <option value="public">Ouverte à tous</option>
          <option value="autorisation">Sur autorisation, cliente par cliente</option>
        </select>
      </label>
      <Message m={message} />
      <div className="tb-actions">
        <button className="tb-bouton" onClick={enregistrer}>Enregistrer</button>
        <button className="tb-bouton tb-clair" onClick={onFermer}>Annuler</button>
      </div>
    </div>
  );
}

function Activites() {
  const [enBase, setEnBase] = useState([]);
  const [ouverte, setOuverte] = useState(null);
  useEffect(() => onSnapshot(collection(db, "activites"), (s) => setEnBase(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {}), []);
  const liste = activitesEffectives(enBase);
  const a = ouverte && liste.find((x) => x.id === ouverte);
  if (a) return <section className="tb-liste"><FicheActivite key={a.id} a={a} onFermer={() => setOuverte(null)} />{a.type === "rendezvous" && <ApercuCreneaux activite={a} />}</section>;
  return (
    <section className="tb-liste">
      <p className="tb-note tb-pad">Horaires, temps entre deux clientes, acompte et accès de chaque activité. Les durées de chaque prestation se règlent dans « Catalogue ».</p>
      {liste.map((x) => (
        <button key={x.id} className="tb-carte" onClick={() => setOuverte(x.id)}>
          <span className="tb-ligne">
            <strong><span className="rg-pastille" style={{ background: x.couleur }} /> {x.nom}</strong>
            <span>{x.acces === "public" ? "ouverte" : "sur autorisation"}</span>
          </span>
          <span className="tb-quand">
            {x.jours.map((j) => JOURS[j]).join(", ")} · {x.debut}-{x.fin} · {x.margeMinutes} min entre deux · acompte {x.acomptePourcent} %{x.ajustementPourcent ? ` · prix ${x.ajustementPourcent > 0 ? "+" : ""}${x.ajustementPourcent} %` : ""}
          </span>
        </button>
      ))}
    </section>
  );
}

/* ---------- Sous-menu ---------- */
const ONGLETS = [
  { id: "general", label: "Général" },
  { id: "tarifs", label: "Tarifs" },
  { id: "catalogue", label: "Catalogue" },
  { id: "activites", label: "Activités" },
];

// general : le contenu actuel des Reglages (marge, plafond, textes, modes, vehicules)
export default function ReglagesFondations({ general }) {
  const [onglet, setOnglet] = useState("general");
  return (
    <>
      <div className="tb-filtres tb-pad fi-choix" role="tablist" aria-label="Réglages">
        {ONGLETS.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id} className={"tb-filtre" + (onglet === o.id ? " actif" : "")} onClick={() => setOnglet(o.id)}>{o.label}</button>
        ))}
      </div>
      {onglet === "general" && general}
      {onglet === "tarifs" && <Tarifs />}
      {onglet === "catalogue" && <Catalogue />}
      {onglet === "activites" && <Activites />}
    </>
  );
}
