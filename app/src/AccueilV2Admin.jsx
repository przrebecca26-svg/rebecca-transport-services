import { useEffect, useMemo, useRef, useState } from "react";
import "./pages-pro-admin.css";
import {
  ICONES, PRESTATIONS_REBECCA, UNIVERS_REBECCA, categoriesDuPartenaire, categoriesParDefaut, idDepuisNom, lireAccueil, nombreParCategorie,
  normaliserCategorie, partenairesDepuis, specialitesDuPartenaire, texteUnivers,
} from "./pricing/accueilV2.js";
import { annuairePublic } from "./pricing/pros.js";
import { prestationDeFiche, rangRS } from "./pricing/recherche.js";
import { enregistrerAccueilV2, supprimerPhotosAccueil, useAccueilV2 } from "./accueilV2Base.js";
import { aujourdhuiIsrael, useAnnuairePros, useCategoriesPros, useDossiersPros } from "./prosBase.js";
import { useVitrineRestos } from "./vitrineRestosBase.js";
import { ajouterPhoto, usePhoto } from "./pagesProBase.js";
import IconeCategorie from "./components/IconeCategorie.jsx";
import { SITE_OFFICIEL } from "./site.js";

// NOUVEL ACCUEIL - réglages de Rebecca (lot P1, 27 nov. 2026). Tout depuis l'iPhone, sans passer par Claude :
// catégories et spécialités (noms, icônes, photos, ordre, visibles ou cachées, masquées si vides), rangement des
// partenaires (plusieurs catégories), mis en avant, nouveaux partenaires, bannières, annonces et offres, univers Rebecca.
// Rien n'est visible des clientes tant que le nouvel accueil n'a pas remplacé l'actuel (accord de Rebecca).

const ONGLETS = [["apercu", "Aperçu"], ["activites", "Mes activités"], ["categories", "Catégories"], ["partenaires", "Partenaires"], ["bannieres", "Bannières"], ["annonces", "Annonces et offres"], ["univers", "Mes univers"]];
const nouvelId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const deplacer = (l, i, d) => {
  const j = i + d;
  if (j < 0 || j >= l.length) return l;
  const c = [...l];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};
const photosDe = (c) => [...c.categories.map((x) => x.photo), ...c.bannieres.map((x) => x.photo), ...Object.values(c.univers).map((x) => x.photo)].filter(Boolean);

function Champ({ label, aide, children }) {
  return <label className="champ pg-champ"><span>{label}</span>{children}{aide && <small className="tb-note">{aide}</small>}</label>;
}
function Texte({ label, valeur, onChange, max = 120, aide, placeholder, type = "text" }) {
  return <Champ label={label} aide={aide}><input type={type} maxLength={max} value={valeur || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></Champ>;
}
function Case({ label, coche, onChange }) {
  return <label className="pg-case"><input type="checkbox" checked={!!coche} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}
function Vignette({ id, defaut, taille = 64 }) {
  const src = usePhoto(id || "") || defaut;
  return src ? <img src={src} alt="" style={{ width: taille, height: taille, objectFit: "cover", borderRadius: 10, flex: "none" }} /> : <div className="pg-sans-photo" style={{ width: taille, height: taille }}>Pas de photo</div>;
}
function ChoixPhoto({ id, defaut, onChange, setInfo }) {
  const r = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const choisir = async (f) => {
    setEnvoi(true);
    try {
      const x = await ajouterPhoto(f, "accueil", "photo");
      onChange(x.id);
    } catch (e) {
      setInfo(`La photo n'a pas pu être ajoutée : ${e.message}`);
    }
    setEnvoi(false);
  };
  return (
    <div className="pg-ligne">
      <Vignette id={id} defaut={defaut} />
      <button type="button" className="bouton-secondaire" disabled={envoi} onClick={() => r.current && r.current.click()}>{envoi ? "Envoi…" : id ? "Changer la photo" : "Ajouter une photo"}</button>
      {id && <button type="button" className="bouton-secondaire" onClick={() => onChange("")}>Retirer</button>}
      <input ref={r} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) choisir(f); }} />
    </div>
  );
}
function Fleches({ onHaut, onBas, onSuppr }) {
  return (
    <span className="tb-actions" style={{ margin: 0 }}>
      <button type="button" className="bouton-secondaire" aria-label="Monter" onClick={onHaut}>↑</button>
      <button type="button" className="bouton-secondaire" aria-label="Descendre" onClick={onBas}>↓</button>
      {onSuppr && <button type="button" className="bouton-secondaire" aria-label="Supprimer" onClick={onSuppr}>🗑️</button>}
    </span>
  );
}
function Dates({ x, maj }) {
  return (
    <div className="pg-ligne">
      <label className="champ pg-champ" style={{ flex: 1 }}><span>Du (facultatif)</span><input type="date" value={x.du} onChange={(e) => maj({ du: e.target.value })} /></label>
      <label className="champ pg-champ" style={{ flex: 1 }}><span>Au (facultatif)</span><input type="date" value={x.au} onChange={(e) => maj({ au: e.target.value })} /></label>
    </div>
  );
}
const AIDE_LIEN = "Une page du site (#/restaurants, #/pros, /p/adresse-de-la-page) ou un site qui commence par https://";

/* ---------- Catégories ---------- */
function EditeurCategorie({ c, i, config, anciensMetiers, nb, maj, setInfo }) {
  const [ouvert, setOuvert] = useState(false);
  const majC = (x) => maj({ ...config, categories: config.categories.map((y, j) => (j === i ? { ...y, ...x } : y)) });
  const specs = c.specialites;
  const majS = (k, x) => majC({ specialites: specs.map((s, j) => (j === k ? { ...s, ...x } : s)) });
  const [nouvelle, setNouvelle] = useState("");
  return (
    <div className="pg-item" style={{ display: "block" }}>
      <div className="pg-ligne" style={{ margin: 0 }}>
        <span style={{ color: "#f1aeb7", display: "inline-flex" }}>{c.photo ? <Vignette id={c.photo} taille={34} /> : <IconeCategorie nom={c.icone} taille={28} />}</span>
        <button type="button" onClick={() => setOuvert(!ouvert)} style={{ flex: 1, textAlign: "left", background: "none", border: 0, color: "inherit", padding: 6, cursor: "pointer", font: "inherit" }}>
          <b>{c.nom}</b><br /><small className="tb-note">{c.visible ? "Visible" : "Cachée"} · {nb} partenaire{nb > 1 ? "s" : ""} · {specs.length} spécialité{specs.length > 1 ? "s" : ""}{c.visible && !nb && c.masquerSiVide ? " · masquée car vide" : ""} {ouvert ? "▲" : "▼"}</small>
        </button>
        <Fleches onHaut={() => maj({ ...config, categories: deplacer(config.categories, i, -1) })} onBas={() => maj({ ...config, categories: deplacer(config.categories, i, 1) })} />
      </div>
      {ouvert && (
        <div style={{ padding: "10px 0 4px" }}>
          <Texte label="Nom de la catégorie" valeur={c.nom} max={50} onChange={(v) => majC({ nom: v })} />
          <Texte label="Petite phrase (facultatif)" valeur={c.texte} max={160} onChange={(v) => majC({ texte: v })} />
          <Case label="Visible sur l'accueil" coche={c.visible} onChange={(v) => majC({ visible: v })} />
          <Case label="La cacher automatiquement tant qu'elle est vide" coche={c.masquerSiVide} onChange={(v) => majC({ masquerSiVide: v })} />
          <p className="tb-note" style={{ marginBottom: 4 }}>Icône (ou une photo, qui la remplace) :</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 6, marginBottom: 10 }}>
            {ICONES.map((ic) => (
              <button key={ic} type="button" aria-label={ic} aria-pressed={c.icone === ic} onClick={() => majC({ icone: ic })} style={{ height: 44, borderRadius: 10, border: c.icone === ic ? "2px solid #f1aeb7" : "1px solid rgba(185,120,112,.35)", background: "#151114", color: "#f1aeb7", cursor: "pointer" }}>
                <IconeCategorie nom={ic} taille={22} />
              </button>
            ))}
          </div>
          <ChoixPhoto id={c.photo} onChange={(id) => majC({ photo: id })} setInfo={setInfo} />
          <h4 style={{ margin: "16px 0 4px" }}>Spécialités</h4>
          {specs.map((s, k) => (
            <div key={s.id} className="pg-ligne">
              <input style={{ flex: "1 1 100%", minWidth: 0 }} maxLength={50} value={s.nom} aria-label="Nom de la spécialité" onChange={(e) => majS(k, { nom: e.target.value })} />
              <button type="button" className="bouton-secondaire" onClick={() => majS(k, { visible: !s.visible })}>{s.visible ? "Visible" : "Cachée"}</button>
              <Fleches onHaut={() => majC({ specialites: deplacer(specs, k, -1) })} onBas={() => majC({ specialites: deplacer(specs, k, 1) })} onSuppr={() => majC({ specialites: specs.filter((_, j) => j !== k) })} />
            </div>
          ))}
          <div className="pg-ligne">
            <input style={{ flex: "1 1 100%", minWidth: 0 }} maxLength={50} placeholder="Nouvelle spécialité (ex. Perruques)" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} />
            <button type="button" className="bouton-secondaire" disabled={!nouvelle.trim()} onClick={() => { const id = idDepuisNom(nouvelle); if (!specs.some((s) => s.id === id)) majC({ specialites: [...specs, { id, nom: nouvelle.trim(), visible: true }] }); setNouvelle(""); }}>＋ Ajouter</button>
          </div>
          <h4 style={{ margin: "16px 0 4px" }}>Rangement automatique</h4>
          <p className="tb-note">Les pros de l'annuaire dont le métier est coché arrivent tout seuls ici (tu peux ensuite changer pro par pro dans l'onglet « Partenaires »).</p>
          {anciensMetiers.map((m) => <Case key={m.id} label={`${m.icone} ${m.nom}`} coche={c.anciens.includes(m.id)} onChange={(v) => majC({ anciens: v ? [...c.anciens, m.id] : c.anciens.filter((x) => x !== m.id) })} />)}
          <Case label="🍽️ Les restaurants de « Restaurants visibles sur le site »" coche={c.restos} onChange={(v) => majC({ restos: v })} />
          <p className="tb-note">Tes propres prestations (Nails, Hair, Slim & Lift, RegenX, Epoxy, Digital) ne sont jamais rangées ici : elles restent dans ton univers Rebecca Services.</p>
          <div className="tb-actions"><button type="button" className="bouton-secondaire" onClick={() => { if (window.confirm(`Supprimer la catégorie « ${c.nom} » ? Les partenaires ne sont pas supprimés.`)) maj({ ...config, categories: config.categories.filter((_, j) => j !== i) }); }}>🗑️ Supprimer cette catégorie</button></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Partenaires (rangement pro par pro) ---------- */
function LignePartenaire({ p, config, maj }) {
  const [ouvert, setOuvert] = useState(false);
  const choix = config.classement[p.cle];
  const cats = categoriesDuPartenaire(config, p);
  const specs = specialitesDuPartenaire(config, p);
  const nomCat = (id) => (config.categories.find((c) => c.id === id) || {}).nom || id;
  const majClassement = (x) => {
    const suite = { cats, specs, ...(choix || {}), ...x };
    maj({ ...config, classement: { ...config.classement, [p.cle]: suite } });
  };
  const bascule = (liste, id, v) => (v ? [...new Set([...liste, id])] : liste.filter((x) => x !== id));
  const avant = config.misEnAvant.includes(p.cle);
  const nouveau = config.nouveaux.includes(p.cle);
  return (
    <div className="pg-item" style={{ display: "block" }}>
      <button type="button" onClick={() => setOuvert(!ouvert)} style={{ width: "100%", textAlign: "left", background: "none", border: 0, color: "inherit", padding: 0, cursor: "pointer", font: "inherit" }}>
        <b>{p.type === "resto" ? "🍽️" : p.type === "rs" ? "✨" : "💼"} {p.nom}</b>{p.type === "rs" ? " · mon activité (toujours en premier)" : ""}{avant ? " ⭐" : ""}{nouveau ? " 🆕" : ""}<br />
        <small className="tb-note">{cats.length ? cats.map(nomCat).join(", ") : "⚠️ Aucune catégorie : n'apparaît pas"}{choix ? " (ton choix)" : " (automatique)"} {ouvert ? "▲" : "▼"}</small>
      </button>
      {ouvert && (
        <div style={{ padding: "8px 0" }}>
          {p.type !== "rs" && <Case label="⭐ Mis en avant (indiqué « Mis en avant », toujours après mes activités)" coche={avant} onChange={(v) => maj({ ...config, misEnAvant: bascule(config.misEnAvant, p.cle, v) })} />}
          {p.type !== "rs" && <Case label="🆕 Dans « Nouveaux partenaires »" coche={nouveau} onChange={(v) => maj({ ...config, nouveaux: bascule(config.nouveaux, p.cle, v) })} />}
          <h4 style={{ margin: "12px 0 4px" }}>Catégories (jusqu'à 5)</h4>
          {config.categories.map((c) => <Case key={c.id} label={c.nom} coche={cats.includes(c.id)} onChange={(v) => { const l = bascule(cats, c.id, v).slice(0, 5); majClassement({ cats: l }); }} />)}
          {cats.length > 0 && <h4 style={{ margin: "12px 0 4px" }}>Spécialités</h4>}
          {config.categories.filter((c) => cats.includes(c.id)).map((c) => c.specialites.map((s) => <Case key={c.id + s.id} label={`${s.nom} (${c.nom})`} coche={specs.includes(s.id)} onChange={(v) => majClassement({ specs: bascule(specs, s.id, v) })} />))}
          {choix && <div className="tb-actions"><button type="button" className="bouton-secondaire" onClick={() => { const c = { ...config.classement }; delete c[p.cle]; maj({ ...config, classement: c }); }}>Revenir au rangement automatique</button></div>}
          <p className="tb-note">Fiche : <a href={p.lien} target="_blank" rel="noopener noreferrer">{p.lien}</a></p>
        </div>
      )}
    </div>
  );
}

/* ---------- Mes activités : ordre de priorité (décision définitive du 27 nov., 15h30) ---------- */
function MesActivites({ config, dossiers, maj }) {
  const fiches = (dossiers || []).filter((d) => d.activiteRS);
  const entrees = [{ cle: "s:transport", nom: "Transport & Livraison", detail: "Transport privé, aéroport, ramassage, livraison, courses, déménagement…", prestation: "" }];
  for (const p of PRESTATIONS_REBECCA) {
    const f = fiches.find((x) => prestationDeFiche(x) === p.id);
    entrees.push({ cle: "x:" + p.id, nom: f ? f.nomCommercial : p.nom, detail: f ? `Fiche de l'annuaire · ${f.statut === "accepte" && f.actif ? "visible" : "pas encore visible"}` : "Pas de fiche dans l'annuaire (trouvée quand même dans la recherche)", prestation: p.id });
  }
  for (const f of fiches.filter((x) => !prestationDeFiche(x))) entrees.push({ cle: "p:" + f.id, nom: f.nomCommercial, detail: `Nouvelle activité · ${f.metier || ""}`, prestation: "" });
  const ordre = [...entrees].sort((a, b) => rangRS(config.prioriteRS, a.cle, a.prestation) - rangRS(config.prioriteRS, b.cle, b.prestation));
  const changer = (i, d) => maj({ ...config, prioriteRS: deplacer(ordre, i, d).map((e) => e.cle) });
  return (
    <div className="tb-bloc">
      <p className="tb-note">Tes activités passent <b>toujours avant les partenaires</b> quand elles correspondent à la recherche (métier, catégorie, ville et ta zone), même si un partenaire a une formule Business ou une mise en avant. Quand plusieurs de tes activités correspondent, celle qui contient les mots tapés passe d'abord, puis l'ordre ci-dessous.</p>
      {ordre.map((e, i) => (
        <div key={e.cle} className="pg-item">
          <b style={{ width: 24, color: "#f1aeb7" }}>{i + 1}</b>
          <div className="pg-item-int"><b>{e.nom}</b><small className="tb-note">{e.detail}</small></div>
          <Fleches onHaut={() => changer(i, -1)} onBas={() => changer(i, 1)} />
        </div>
      ))}
      <p className="tb-note">Une nouvelle activité : dans « Annuaire des professionnels », crée sa fiche et coche « ✨ C'est une de mes activités ». Elle arrive ici toute seule, en dernier, et passe déjà avant les partenaires. Ta ville et ta zone se règlent dans la fiche (champs Villes et Zone).</p>
    </div>
  );
}

/* ---------- Écran ---------- */
export default function AccueilV2Admin() {
  const enLigne = useAccueilV2();
  const dossiers = useDossiersPros();
  const anciens = useCategoriesPros();
  const annuaire = useAnnuairePros();
  const restos = useVitrineRestos();
  const [config, setConfig] = useState(null);
  const [onglet, setOnglet] = useState("apercu");
  const [info, setInfo] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [filtre, setFiltre] = useState("");
  useEffect(() => { if (enLigne && !config) setConfig(enLigne); }, [enLigne, config]);
  const fiches = useMemo(() => annuairePublic(dossiers || [], anciens || [], aujourdhuiIsrael()), [dossiers, anciens]);
  const partenaires = useMemo(() => partenairesDepuis(fiches, restos || []), [fiches, restos]);
  if (!config || !dossiers || !anciens) return <p className="tb-note">Chargement…</p>;

  const modifie = JSON.stringify(lireAccueil(config)) !== JSON.stringify(lireAccueil(enLigne));
  const maj = (c) => { setConfig(c); setInfo(""); };
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const garder = new Set(photosDe(lireAccueil(config)));
      const aEffacer = photosDe(lireAccueil(enLigne)).filter((id) => !garder.has(id));
      await enregistrerAccueilV2(config);
      await supprimerPhotosAccueil(aEffacer);
      setInfo("✅ Enregistré.");
    } catch (e) {
      setInfo(`❌ Pas enregistré : ${e.message}`);
    }
    setEnvoi(false);
  };
  const nb = nombreParCategorie(config, partenaires);
  const lien = `${SITE_OFFICIEL}/#/nouvel-accueil`;
  const annuaireFerme = fiches.length > 0 && (annuaire || []).length === 0;

  return (
    <div className="pg-admin" style={{ overflowX: "hidden" }}>
      <div className="pg-entete-editeur" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
        <span style={{ minWidth: 0 }}><b className="pg-titre-page">Nouvel accueil (caché)</b><small className="tb-note">{modifie ? "⚠️ Modifications non enregistrées" : "Tout est enregistré"}</small></span>
        <button type="button" className="pp-bouton pg-bouton-voir" disabled={!modifie || envoi} onClick={enregistrer}>{envoi ? "…" : "Enregistrer"}</button>
      </div>
      <div className="pg-onglets">{ONGLETS.map(([id, l]) => <button key={id} type="button" className={onglet === id ? "actif" : ""} onClick={() => setOnglet(id)}>{l}</button>)}</div>
      {info && <p className="tb-note" role="status">{info}</p>}

      {onglet === "apercu" && (
        <div className="tb-bloc">
          <h3>Voir le nouvel accueil</h3>
          <p className="tb-note">Il est caché : aucune cliente ne le voit, l'accueil actuel reste en place. Ouvre-le depuis ton iPhone pour naviguer dans les deux univers, les catégories, la recherche et la barre du bas. Il se remplacera seulement quand tu me donneras ton accord.</p>
          <div className="tb-actions">
            <a className="pp-bouton" style={{ color: "#141214", textDecoration: "none" }} href="/#/nouvel-accueil" target="_blank" rel="noopener noreferrer">👁️ Ouvrir le nouvel accueil</a>
            <button type="button" className="bouton-secondaire" onClick={() => navigator.clipboard && navigator.clipboard.writeText(lien).then(() => setInfo("Lien copié."))}>Copier le lien</button>
          </div>
          <p className="tb-note">Pense à appuyer sur « Enregistrer » avant d'ouvrir l'aperçu pour voir tes derniers changements.</p>
          <ul className="tb-note">
            <li>{config.categories.filter((c) => c.visible).length} catégories visibles sur {config.categories.length} · {config.categories.filter((c) => c.visible && !nb[c.id] && c.masquerSiVide).length} masquées car vides</li>
            <li>{fiches.length} professionnel{fiches.length > 1 ? "s" : ""} accepté{fiches.length > 1 ? "s" : ""} et actif{fiches.length > 1 ? "s" : ""} · {(restos || []).filter((r) => r.visible !== false).length} restaurant(s) visible(s)</li>
            <li>{partenaires.filter((p) => !categoriesDuPartenaire(config, p).length).length} partenaire(s) sans catégorie (onglet « Partenaires »)</li>
          </ul>
          {annuaireFerme && <p className="tb-note">⚠️ L'annuaire des professionnels est fermé au public (Réglages → Pages du site) : ses fiches ne s'affichent pas encore sur le nouvel accueil. Les restaurants, eux, s'affichent.</p>}
        </div>
      )}

      {onglet === "activites" && <MesActivites config={config} dossiers={dossiers} maj={maj} />}

      {onglet === "categories" && (
        <div className="tb-bloc">
          <p className="tb-note">Touche une catégorie pour la modifier. ↑ ↓ pour changer l'ordre d'affichage.</p>
          {config.categories.map((c, i) => <EditeurCategorie key={c.id} c={c} i={i} config={config} anciensMetiers={anciens} nb={nb[c.id] || 0} maj={maj} setInfo={setInfo} />)}
          <div className="tb-actions">
            <button type="button" className="bouton-secondaire" onClick={() => { const nom = window.prompt("Nom de la nouvelle catégorie"); if (!nom) return; const c = normaliserCategorie({ id: idDepuisNom(nom), nom, icone: "etoile" }); if (config.categories.some((x) => x.id === c.id)) return setInfo("Cette catégorie existe déjà."); maj({ ...config, categories: [...config.categories, c] }); return undefined; }}>＋ Nouvelle catégorie</button>
            <button type="button" className="bouton-secondaire" onClick={() => window.confirm("Remettre les 13 catégories d'origine (noms, ordre, spécialités) ? Le rangement de tes partenaires est gardé.") && maj({ ...config, categories: categoriesParDefaut() })}>Remettre les 13 catégories d'origine</button>
          </div>
        </div>
      )}

      {onglet === "partenaires" && (
        <div className="tb-bloc">
          <p className="tb-note">Les professionnels acceptés de l'annuaire et les restaurants visibles. Ils sont rangés automatiquement ; touche un partenaire pour lui donner plusieurs catégories, des spécialités, le mettre à la une ou dans les nouveaux.</p>
          <input type="search" placeholder="Rechercher un partenaire" value={filtre} onChange={(e) => setFiltre(e.target.value)} style={{ width: "100%", fontSize: 16, padding: 10, borderRadius: 10, border: "1px solid rgba(185,120,112,.45)", background: "#120f11", color: "#f8f3f1", boxSizing: "border-box" }} />
          {partenaires.filter((p) => !filtre || p.nom.toLowerCase().includes(filtre.toLowerCase())).map((p) => <LignePartenaire key={p.cle} p={p} config={config} maj={maj} />)}
          {!partenaires.length && <p className="tb-note">Aucun partenaire pour l'instant (pros acceptés et actifs, restaurants visibles).</p>}
        </div>
      )}

      {onglet === "bannieres" && (
        <div className="tb-bloc">
          <p className="tb-note">Grandes images qui défilent en haut de l'accueil (8 au maximum). Une date de début et de fin les fait apparaître et disparaître toutes seules.</p>
          {config.bannieres.map((b, i) => {
            const majB = (x) => maj({ ...config, bannieres: config.bannieres.map((y, j) => (j === i ? { ...y, ...x } : y)) });
            return (
              <div key={b.id} className="pg-item" style={{ display: "block" }}>
                <div className="pg-ligne" style={{ justifyContent: "space-between" }}><b>Bannière {i + 1}{b.actif ? "" : " (désactivée)"}</b><Fleches onHaut={() => maj({ ...config, bannieres: deplacer(config.bannieres, i, -1) })} onBas={() => maj({ ...config, bannieres: deplacer(config.bannieres, i, 1) })} onSuppr={() => window.confirm("Supprimer cette bannière ?") && maj({ ...config, bannieres: config.bannieres.filter((_, j) => j !== i) })} /></div>
                <ChoixPhoto id={b.photo} onChange={(id) => majB({ photo: id })} setInfo={setInfo} />
                <Texte label="Titre" valeur={b.titre} max={80} onChange={(v) => majB({ titre: v })} />
                <Texte label="Texte" valeur={b.texte} max={200} onChange={(v) => majB({ texte: v })} />
                <Texte label="Lien (facultatif)" valeur={b.lien} max={300} aide={AIDE_LIEN} onChange={(v) => majB({ lien: v })} />
                <Texte label="Texte du bouton" valeur={b.bouton} max={30} placeholder="Découvrir" onChange={(v) => majB({ bouton: v })} />
                <Dates x={b} maj={majB} />
                <Case label="Affichée" coche={b.actif} onChange={(v) => majB({ actif: v })} />
              </div>
            );
          })}
          {config.bannieres.length < 8 && <div className="tb-actions"><button type="button" className="bouton-secondaire" onClick={() => maj({ ...config, bannieres: [...config.bannieres, { id: nouvelId("b"), titre: "", texte: "", bouton: "", lien: "", photo: "", actif: true, du: "", au: "" }] })}>＋ Ajouter une bannière</button></div>}
        </div>
      )}

      {onglet === "annonces" && (
        <div className="tb-bloc">
          <p className="tb-note">Petits messages sous les bannières : une annonce (📣) ou une offre commerciale (🎁). N'écris un prix que s'il est déjà validé.</p>
          {config.annonces.map((a, i) => {
            const majA = (x) => maj({ ...config, annonces: config.annonces.map((y, j) => (j === i ? { ...y, ...x } : y)) });
            return (
              <div key={a.id} className="pg-item" style={{ display: "block" }}>
                <div className="pg-ligne" style={{ justifyContent: "space-between" }}>
                  <select value={a.type} onChange={(e) => majA({ type: e.target.value })} style={{ fontSize: 16, padding: 8, borderRadius: 10, background: "#120f11", color: "#f8f3f1" }}><option value="annonce">📣 Annonce</option><option value="offre">🎁 Offre</option></select>
                  <Fleches onHaut={() => maj({ ...config, annonces: deplacer(config.annonces, i, -1) })} onBas={() => maj({ ...config, annonces: deplacer(config.annonces, i, 1) })} onSuppr={() => maj({ ...config, annonces: config.annonces.filter((_, j) => j !== i) })} />
                </div>
                <Texte label="Message" valeur={a.texte} max={200} onChange={(v) => majA({ texte: v })} />
                <Texte label="Lien (facultatif)" valeur={a.lien} max={300} aide={AIDE_LIEN} onChange={(v) => majA({ lien: v })} />
                <Dates x={a} maj={majA} />
                <Case label="Affichée" coche={a.actif} onChange={(v) => majA({ actif: v })} />
              </div>
            );
          })}
          {config.annonces.length < 10 && <div className="tb-actions"><button type="button" className="bouton-secondaire" onClick={() => maj({ ...config, annonces: [...config.annonces, { id: nouvelId("a"), type: "annonce", texte: "", lien: "", actif: true, du: "", au: "" }] })}>＋ Ajouter une annonce ou une offre</button></div>}
        </div>
      )}

      {onglet === "univers" && (
        <div className="tb-bloc">
          <p className="tb-note">Les 4 grandes tuiles de Rebecca Services. Laisse vide pour garder le texte et l'illustration d'origine. Les services de chaque univers suivent Réglages → Pages du site (ouverte, bientôt, cachée).</p>
          {UNIVERS_REBECCA.map((u) => {
            const t = texteUnivers(config, u.id);
            const x = config.univers[u.id] || {};
            const majU = (y) => maj({ ...config, univers: { ...config.univers, [u.id]: { ...x, ...y } } });
            return (
              <div key={u.id} className="pg-item" style={{ display: "block" }}>
                <b>{u.titre}</b>
                <ChoixPhoto id={x.photo} defaut={t.illustration} onChange={(id) => majU({ photo: id })} setInfo={setInfo} />
                <Texte label="Titre" valeur={x.titre} placeholder={u.titre} max={50} onChange={(v) => majU({ titre: v })} />
                <Texte label="Texte" valeur={x.texte} placeholder={u.texte} max={160} onChange={(v) => majU({ texte: v })} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
