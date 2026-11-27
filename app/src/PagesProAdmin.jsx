import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import "./pages-pro-admin.css";
import PageProVue from "./components/PageProVue.jsx";
import {
  DISPOSITIONS, LIBELLES_COULEURS, MAX_GALERIE, MAX_PRODUITS, MODELES, POLICES, SECTIONS, STATUTS_PAGE, STATUTS_PREPARATION,
  abonnementDepuisContrat, adresseDepuisNom, adresseUnique, ajouterJournalPage, calculTarif, changerModele, compteurEspace, contratDepuisTarif,
  contratEnVigueur, dupliquerPage, enLigne, enMo, erreursPage, libelleStatutPage, lienApercu, lienPage, lienWhatsAppPage, modele, modifsNonPubliees,
  nombrePhotos, normaliserPage, pagePublique, pageVide, poidsPhotos, restaurerVersion, sectionsDePage, sectionsPermises,
} from "./pricing/pagesPro.js";
import { CATEGORIES_DEFAUT, FORMULES_PRO, dossierVide, etatAbonnement, libelleFormule, normaliserDossier, nouvelIdPro, ajouterJournal } from "./pricing/pros.js";
import { aujourdhuiIsrael, enregistrerDossiers, useCategoriesPros, useDossiersPros } from "./prosBase.js";
import {
  ajouterPhoto, creerApercu, enregistrerPageAdmin, exporterPages, lirePublique, publierPage, rangerPhotos, restaurerSauvegarde, retirerPage,
  supprimerApercu, useGrilleDigitalPro, usePagesAdmin, usePhoto, useVersionsPage,
} from "./pagesProBase.js";
import { SITE_OFFICIEL } from "./site.js";

// GENERATEUR DE PAGES PROFESSIONNELLES - espace de Rebecca (lot 1, 27 nov. 2026). Cahier des charges section 9.
// Tout se fait depuis l'iPhone : creer (pro existant ou nouveau client), demonstration privee, contenu, photos,
// produits, modele et disposition, sections, forfait et options (dans le DOSSIER du pro), tarif du client et son
// historique, apercu telephone / tablette / ordinateur, publication, apercu prive, QR code, versions, sauvegarde ZIP.
// Le brouillon s'enregistre tout seul ; la page EN LIGNE ne change que quand Rebecca appuie sur « Publier ».

const fmt = (ms) => (ms ? new Date(ms).toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const COULEUR_STATUT = { attente_elements: "#d9a441", en_creation: "#b9aeb0", brouillon: "#b9aeb0", attente_validation: "#d9a441", publiee: "#5cb85c", suspendue: "#e05a5a", archivee: "#777" };
const shekels = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} ₪`;
const telecharger = (blob, nom) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
};
const MODULES_BUSINESS = [["agenda", "Agenda et rendez-vous"], ["clients", "Fichier clients"], ["devis", "Devis PDF"], ["paiements", "Paiements et acomptes"], ["rappels", "Rappels automatiques"], ["stats", "Statistiques"], ["catalogue", "Catalogue et commandes"]];

/* ---------- Petits elements ---------- */
function Champ({ label, aide, children }) {
  return <label className="champ pg-champ"><span>{label}</span>{children}{aide && <small className="tb-note">{aide}</small>}</label>;
}
function Texte({ label, valeur, onChange, long = false, max = 300, aide, placeholder, type = "text" }) {
  return (
    <Champ label={label} aide={aide}>
      {long ? <textarea rows={5} maxLength={max} value={valeur || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input type={type} maxLength={max} value={valeur || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </Champ>
  );
}
function Vignette({ id, taille = 72 }) {
  const src = usePhoto(id);
  return src ? <img src={src} alt="" style={{ width: taille, height: taille, objectFit: "cover", borderRadius: 10, flex: "none" }} /> : <div style={{ width: taille, height: taille, borderRadius: 10, background: "#2a2326", flex: "none" }} />;
}
function BoutonPhoto({ label, multiple = false, onFichiers, disabled }) {
  const r = useRef(null);
  return (
    <>
      <button type="button" className="bouton-secondaire" disabled={disabled} onClick={() => r.current && r.current.click()}>{label}</button>
      <input ref={r} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ""; if (f.length) onFichiers(f); }} />
    </>
  );
}

/* ---------- Compteur d'espace photos (precision de Rebecca, 27 nov. 14h11) ---------- */
function CompteurEspace({ pages }) {
  const c = compteurEspace(pages);
  const [detail, setDetail] = useState(false);
  const couleur = c.alerte >= 95 ? "#e05a5a" : c.alerte >= 85 ? "#e08a3a" : c.alerte >= 70 ? "#d9a441" : "#5cb85c";
  return (
    <div className="pp-bloc">
      <h3 style={{ marginTop: 0 }}>📷 Espace photos (gratuit)</h3>
      <div className="pg-jauge"><div style={{ width: `${Math.min(100, c.pourcent)}%`, background: couleur }} /></div>
      <p className="tb-note"><b>{enMo(c.total)}</b> utilisés sur {enMo(c.budget)} réservés aux photos des pages ({c.pourcent} %) · reste <b>{enMo(c.reste)}</b> · {c.photos} photos.</p>
      {c.alerte > 0 && <p className="erreur" role="alert">⚠️ Seuil de {c.alerte} % atteint. {c.alerte >= 95 ? "Plus de place bientôt : fais une sauvegarde et range les photos inutiles avant d'en ajouter." : "Pense à ranger les photos inutiles. Aucune solution payante ne sera activée sans ton accord."}</p>}
      <p className="tb-note">L'espace gratuit Firebase est de 1 Go pour tout le site : {enMo(c.budget)} sont réservés aux photos des pages, le reste au site (demandes, clients…).</p>
      <button type="button" className="bouton-secondaire" onClick={() => setDetail(!detail)}>{detail ? "Masquer" : "Voir"} le détail par professionnel</button>
      {detail && (
        <table className="pg-table"><thead><tr><th>Professionnel</th><th>Photos</th><th>Espace</th></tr></thead>
          <tbody>{c.parPro.map((x) => <tr key={x.proId || x.nom}><td>{x.nom}{x.pages > 1 ? ` (${x.pages} pages)` : ""}</td><td>{x.photos}</td><td>{enMo(x.octets)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- Creation d'une page ---------- */
function NouvellePage({ dossiers, categories, pages, onCree, onAnnuler }) {
  const [etape, setEtape] = useState(1);
  const [proId, setProId] = useState("");
  const [nouveau, setNouveau] = useState(false);
  const [f, setF] = useState({ nomCommercial: "", categorie: "", villes: "", whatsapp: "", formule: "vitrine", instagram: "" });
  const [demo, setDemo] = useState(false);
  const [modeleId, setModeleId] = useState("boutique");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const tries = useMemo(() => [...(dossiers || [])].filter((d) => d.statut !== "refuse").sort((a, b) => a.nomCommercial.localeCompare(b.nomCommercial, "fr")), [dossiers]);
  const avecPage = new Set((pages || []).map((p) => p.proId));
  const suivant = () => {
    if (!nouveau && !proId) return setInfo("Choisis le professionnel, ou « Nouveau client ».");
    if (nouveau && (!f.nomCommercial.trim() || !f.categorie || String(f.whatsapp).replace(/\D/g, "").length < 9)) return setInfo("Nom commercial, métier et numéro WhatsApp sont obligatoires.");
    setInfo("");
    return setEtape(2);
  };
  const creer = async () => {
    setEnCours(true);
    try {
      let dossier = (dossiers || []).find((d) => d.id === proId);
      if (nouveau) {
        // Nouveau client ajoute par Rebecca : dossier en « brouillon » (invisible dans l'annuaire, aucun abonnement)
        dossier = normaliserDossier(ajouterJournal({ ...dossierVide(), ...f, id: nouvelIdPro(), statut: "brouillon", source: "admin", telephone: f.whatsapp, creeLeMs: Date.now(), majLeMs: Date.now() }, demo ? "Créé depuis le générateur de pages (démonstration)" : "Créé depuis le générateur de pages"));
        await enregistrerDossiers([...(dossiers || []), dossier], categories);
      }
      let page = pageVide(dossier, modeleId);
      page = { ...page, demo, adresse: adresseUnique(page.adresse || adresseDepuisNom(dossier.nomCommercial), pages, page.id), sections: sectionsDePage([], dossier.formule, dossier.modules).map(({ id, actif }) => ({ id, actif })) };
      page = ajouterJournalPage(page, demo ? "Page de démonstration créée" : "Page créée");
      await enregistrerPageAdmin(page);
      onCree(page.id);
    } catch (e) {
      setInfo("Création impossible : " + (e && e.message ? e.message : "vérifie la connexion."));
    }
    setEnCours(false);
  };
  return (
    <div className="pp-bloc">
      <h3 style={{ marginTop: 0 }}>Nouvelle page · étape {etape} sur 2</h3>
      {etape === 1 && (
        <>
          <div className="tb-actions">
            <button type="button" className={!nouveau ? "pp-bouton" : "bouton-secondaire"} onClick={() => setNouveau(false)}>Client déjà inscrit</button>
            <button type="button" className={nouveau ? "pp-bouton" : "bouton-secondaire"} onClick={() => setNouveau(true)}>+ Nouveau client</button>
          </div>
          {!nouveau ? (
            <Champ label="Professionnel" aide="Sa formule et ses options sont lues dans son dossier de l'annuaire.">
              <select value={proId} onChange={(e) => setProId(e.target.value)}>
                <option value="">Choisir…</option>
                {tries.map((d) => <option key={d.id} value={d.id}>{d.nomCommercial} · {libelleFormule(d.formule)}{avecPage.has(d.id) ? " · a déjà une page" : ""}</option>)}
              </select>
            </Champ>
          ) : (
            <>
              <Texte label="Nom commercial" valeur={f.nomCommercial} max={80} onChange={(v) => setF({ ...f, nomCommercial: v })} />
              <Champ label="Métier"><select value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}><option value="">Choisir…</option>{(categories || CATEGORIES_DEFAUT).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}</select></Champ>
              <Texte label="Ville(s)" valeur={f.villes} max={200} onChange={(v) => setF({ ...f, villes: v })} />
              <Texte label="Numéro WhatsApp" type="tel" valeur={f.whatsapp} max={20} onChange={(v) => setF({ ...f, whatsapp: v })} />
              <Texte label="Instagram (facultatif)" valeur={f.instagram} max={120} placeholder="@compte" onChange={(v) => setF({ ...f, instagram: v })} />
              <Champ label="Formule"><select value={f.formule} onChange={(e) => setF({ ...f, formule: e.target.value })}>{FORMULES_PRO.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select></Champ>
              <p className="tb-note">Le client est ajouté à tes professionnels en « brouillon » : il n'apparaît pas dans l'annuaire tant que tu ne l'acceptes pas.</p>
            </>
          )}
          <label className="pg-case"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Page de <b>démonstration</b> (privée, pour présenter avant signature ; aucun abonnement)</label>
          {info && <p className="erreur" role="alert">{info}</p>}
          <div className="tb-actions"><button type="button" className="pp-bouton" onClick={suivant}>Suivant : le modèle</button><button type="button" className="bouton-secondaire" onClick={onAnnuler}>Annuler</button></div>
        </>
      )}
      {etape === 2 && (
        <>
          <p className="tb-note">Tu pourras changer de modèle plus tard sans perdre les textes ni les photos.</p>
          <div className="pg-modeles">
            {MODELES.map((m) => (
              <button key={m.id} type="button" className={`pg-modele ${modeleId === m.id ? "actif" : ""}`} onClick={() => setModeleId(m.id)}>
                <MiniModele m={m} />
                <b>{m.nom}</b><small>{m.pour}</small>
              </button>
            ))}
          </div>
          {info && <p className="erreur" role="alert">{info}</p>}
          <div className="tb-actions"><button type="button" className="pp-bouton" disabled={enCours} onClick={creer}>{enCours ? "Création…" : "Créer la page"}</button><button type="button" className="bouton-secondaire" onClick={() => setEtape(1)}>Retour</button></div>
        </>
      )}
    </div>
  );
}
// Miniature dessinee du modele (structure reelle de son en-tete, pas une simple pastille de couleur)
function MiniModele({ m }) {
  const c = m.couleurs;
  const e = m.disposition.entete;
  const photo = <div style={{ background: `linear-gradient(135deg, ${c.accent2}, ${c.doux})`, borderRadius: e === "centre" ? 6 : 0 }} />;
  const ligne = (w, h = 5, col = c.texte) => <div style={{ width: w, height: h, background: col, borderRadius: 2, opacity: 0.85 }} />;
  const texte = <div style={{ display: "grid", gap: 4, alignContent: "center", justifyItems: e === "centre" ? "center" : "start", padding: 6 }}>{ligne("70%", e === "magazine" ? 12 : 7)}{ligne("50%", 4, c.doux)}<div style={{ width: 34, height: 9, background: c.accent, borderRadius: m.disposition.boutons === "pilule" ? 9 : 1 }} /></div>;
  const grilles = { plein: { gridTemplate: "1fr / 1fr" }, partage: { gridTemplate: "1fr / 1fr 1fr" }, centre: { gridTemplate: "auto 1fr / 1fr" }, bandeau: { gridTemplate: "auto 1fr / 1fr" }, magazine: { gridTemplate: "1fr / 2fr 1fr" } };
  return (
    <div className="pg-mini" style={{ background: e === "bandeau" ? c.accent : c.fond, ...grilles[e] }}>
      {e === "plein" ? <div style={{ position: "relative", background: `linear-gradient(180deg, ${c.accent2}, ${c.doux})` }}><div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>{texte}</div></div>
        : e === "partage" ? <>{texte}{photo}</>
          : e === "magazine" ? <>{texte}{photo}</>
            : <>{texte}<div style={{ padding: "0 8px 8px", display: "grid" }}>{photo}</div></>}
    </div>
  );
}

/* ---------- Apercu (telephone, tablette, ordinateur) ---------- */
function Apercu({ page, dossier, onFermer }) {
  const [largeur, setLargeur] = useState(390);
  const zone = useRef(null);
  const [place, setPlace] = useState(360);
  useEffect(() => {
    const t = () => setPlace(zone.current ? zone.current.clientWidth : 360);
    t();
    window.addEventListener("resize", t);
    return () => window.removeEventListener("resize", t);
  }, []);
  const echelle = Math.min(1, place / largeur);
  const pub = useMemo(() => pagePublique(page, dossier), [page, dossier]);
  return (
    <div className="pg-apercu" role="dialog" aria-modal="true">
      <div className="pg-apercu-barre">
        {[[390, "📱 Téléphone"], [820, "Tablette"], [1280, "💻 Ordinateur"]].map(([l, t]) => <button key={l} type="button" className={largeur === l ? "pp-bouton" : "bouton-secondaire"} onClick={() => setLargeur(l)}>{t}</button>)}
        <button type="button" className="bouton-secondaire" onClick={onFermer}>✕ Fermer</button>
      </div>
      <div className="pg-apercu-zone" ref={zone}>
        <div style={{ width: largeur, transform: `scale(${echelle})`, transformOrigin: "top left", height: 0 }}>
          <div className="pg-apercu-cadre" style={{ width: largeur }}><PageProVue page={pub} largeur={largeur} apercu /></div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Editeur ---------- */
const ONGLETS = [["contenu", "Contenu"], ["photos", "Photos"], ["produits", "Produits"], ["style", "Style"], ["sections", "Sections"], ["forfait", "Forfait et tarif"], ["publier", "Publier"]];

function Editeur({ pageInitiale, pages, dossiers, categories, grille, onRetour }) {
  const [page, setPageBrut] = useState(pageInitiale);
  const [onglet, setOnglet] = useState("contenu");
  const [etat, setEtat] = useState("ok");
  const [info, setInfo] = useState("");
  const [voir, setVoir] = useState(false);
  const versions = useVersionsPage(page.id);
  const dossier = (dossiers || []).find((d) => d.id === page.proId) || null;
  const formule = dossier ? dossier.formule : "vitrine";
  const modules = dossier ? dossier.modules : [];
  const minuteur = useRef(null);
  const derniere = useRef(page);
  // Enregistrement automatique du BROUILLON (la page en ligne ne bouge pas)
  const setPage = (fn) => {
    setPageBrut((avant) => {
      const p = { ...(typeof fn === "function" ? fn(avant) : fn), majLeMs: Date.now() };
      derniere.current = p;
      setEtat("modif");
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => {
        setEtat("enreg");
        enregistrerPageAdmin(derniere.current).then(() => setEtat("ok"), () => setEtat("erreur"));
      }, 1200);
      return p;
    });
  };
  useEffect(() => () => { clearTimeout(minuteur.current); if (derniere.current !== pageInitiale) enregistrerPageAdmin(derniere.current).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const maj = (cle) => (v) => setPage((p) => ({ ...p, [cle]: v }));
  const majDossier = async (patch, journal) => {
    if (!dossier) return;
    const d = normaliserDossier(ajouterJournal({ ...dossier, ...patch, majLeMs: Date.now() }, journal));
    await enregistrerDossiers((dossiers || []).map((x) => (x.id === d.id ? d : x)), categories);
  };

  /* photos */
  const [envoi, setEnvoi] = useState("");
  const envoyer = async (fichiers, type, placer) => {
    const ok = [];
    for (let i = 0; i < fichiers.length; i++) {
      setEnvoi(`Photo ${i + 1} sur ${fichiers.length}…`);
      try { ok.push(await ajouterPhoto(fichiers[i], page.id, type)); } catch (e) { setInfo(`Une photo n'a pas pu être ajoutée : ${e.message}`); }
    }
    setEnvoi("");
    if (ok.length) setPage((p) => placer({ ...p, photosInfo: { ...p.photosInfo, ...Object.fromEntries(ok.map((x) => [x.id, x.octets])) } }, ok.map((x) => x.id)));
  };
  const menage = async () => {
    const publiee = enLigne(page) ? await lirePublique(page.adresse).catch(() => null) : null;
    const p = await rangerPhotos(derniere.current, versions, publiee);
    if (p !== derniere.current) setPage(p);
  };

  const enregistrerMaintenant = async () => {
    clearTimeout(minuteur.current);
    setEtat("enreg");
    try { await enregistrerPageAdmin(derniere.current); setEtat("ok"); } catch { setEtat("erreur"); }
  };
  const libelleEtat = { ok: "✓ Brouillon enregistré", modif: "Modification…", enreg: "Enregistrement…", erreur: "⚠️ Pas enregistré (connexion)" }[etat];
  const permises = sectionsPermises(formule, modules);

  return (
    <div className="pg-editeur">
      <div className="pg-entete-editeur">
        <button type="button" className="bouton-secondaire" onClick={async () => { await enregistrerMaintenant(); onRetour(); }}>‹ Mes pages</button>
        <div style={{ minWidth: 0 }}>
          <b className="pg-titre-page">{page.nom || "Sans nom"}</b>
          <small style={{ color: COULEUR_STATUT[page.statut] }}>● {libelleStatutPage(page.statut)}{page.demo ? " · démonstration" : ""}{modifsNonPubliees(page) ? " · modifications non publiées" : ""}</small>
        </div>
        <button type="button" className="pp-bouton pg-bouton-voir" onClick={() => setVoir(true)}>👁 Aperçu</button>
      </div>
      <p className="tb-note" style={{ margin: "4px 0 8px" }}>{libelleEtat}{dossier ? ` · ${dossier.nomCommercial} · formule ${libelleFormule(formule)}` : " · ⚠️ dossier du pro introuvable"}</p>
      <div className="pg-onglets">{ONGLETS.map(([v, l]) => <button key={v} type="button" className={onglet === v ? "actif" : ""} onClick={() => setOnglet(v)}>{l}</button>)}</div>
      {info && <p className="erreur" role="alert" onClick={() => setInfo("")}>{info}</p>}
      {envoi && <p className="tb-note">⏳ {envoi}</p>}

      {onglet === "contenu" && (
        <div className="pp-bloc">
          <Champ label="Étape de la page"><select value={STATUTS_PREPARATION.includes(page.statut) ? page.statut : ""} disabled={!STATUTS_PREPARATION.includes(page.statut)} onChange={(e) => setPage((p) => ajouterJournalPage({ ...p, statut: e.target.value }, `Étape : ${libelleStatutPage(e.target.value)}`))}>
            {!STATUTS_PREPARATION.includes(page.statut) && <option value="">{libelleStatutPage(page.statut)} (voir l'onglet Publier)</option>}
            {STATUTS_PAGE.filter((s) => STATUTS_PREPARATION.includes(s.v)).map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select></Champ>
          <Texte label="Nom commercial" valeur={page.nom} max={80} onChange={maj("nom")} />
          <Texte label="Catégorie / spécialité" valeur={page.specialite} max={80} placeholder="Ex. Boutique de mode femme" onChange={maj("specialite")} />
          <Texte label="Phrase d'accroche" valeur={page.accroche} max={160} onChange={maj("accroche")} />
          <Texte label="Présentation de l'entreprise" long max={2000} valeur={page.presentation} onChange={maj("presentation")} />
          {permises.includes("tarifs") && <Texte label="Tarifs (facultatif)" long max={1500} valeur={page.tarifsTexte} aide="Laisse vide pour ne pas afficher de tarifs." onChange={maj("tarifsTexte")} />}
          <Texte label="Horaires" long max={600} valeur={page.horaires} placeholder={"Dim-jeu : 10h-19h\nVendredi : 9h-13h"} onChange={maj("horaires")} />
          <Texte label="Adresse (facultatif)" valeur={page.adressePostale} max={200} onChange={maj("adressePostale")} />
          <Texte label="Zone d'intervention" valeur={page.zone} max={300} onChange={maj("zone")} />
          <Texte label="Téléphone" type="tel" valeur={page.telephone} max={20} onChange={maj("telephone")} />
          <Texte label="WhatsApp" type="tel" valeur={page.whatsapp} max={20} onChange={maj("whatsapp")} />
          <Texte label="Message WhatsApp prérempli" long max={300} valeur={page.messageWhatsApp} placeholder={`Bonjour ${page.nom}, je vous contacte depuis votre page sur Rebecca Services.`} onChange={maj("messageWhatsApp")} />
          <Texte label="Texte du bouton WhatsApp" valeur={page.boutonWhatsApp} max={60} onChange={maj("boutonWhatsApp")} />
          <Texte label="Instagram" valeur={page.instagram} max={120} placeholder="@compte" onChange={maj("instagram")} />
          <Texte label="Texte du bouton Instagram" valeur={page.boutonInstagram} max={60} onChange={maj("boutonInstagram")} />
          <Texte label="Facebook" valeur={page.facebook} max={200} onChange={maj("facebook")} />
          <Texte label="TikTok" valeur={page.tiktok} max={120} onChange={maj("tiktok")} />
          <Texte label="Site web" valeur={page.siteWeb} max={200} onChange={maj("siteWeb")} />
          <AutresLiens liens={page.autresLiens} onChange={maj("autresLiens")} />
          {permises.includes("livraison") && <Texte label="Livraison, retrait et délais" long max={1200} valeur={page.livraison} onChange={maj("livraison")} />}
          {permises.includes("reservation") && <Texte label="Lien de réservation en ligne (facultatif)" valeur={page.lienRdv} max={300} placeholder="https://…" aide="Sans lien, le bouton propose un rendez-vous sur WhatsApp." onChange={maj("lienRdv")} />}
          {permises.includes("infos") && <Texte label="Informations complémentaires" long max={1500} valeur={page.infos} onChange={maj("infos")} />}
          {permises.includes("avis") && <Avis avis={page.avis} onChange={maj("avis")} />}
          <Texte label="Note privée (jamais affichée)" long max={1000} valeur={page.notePrivee} onChange={maj("notePrivee")} />
        </div>
      )}

      {onglet === "photos" && (
        <div className="pp-bloc">
          {!permises.includes("galerie") && <p className="erreur">La formule {libelleFormule(formule)} n'affiche pas de photos. Elles sont gardées et s'afficheront si le client passe en Vitrine ou Business.</p>}
          <p className="tb-note">{nombrePhotos(page)} photos · {enMo(poidsPhotos(page))} pour cette page. Les photos de l'iPhone sont réduites avant l'envoi (nettes sur téléphone et tablette).</p>
          <h4>Logo</h4>
          <div className="pg-ligne">{page.logo && <Vignette id={page.logo} />}<BoutonPhoto label={page.logo ? "Remplacer" : "Ajouter le logo"} onFichiers={(f) => envoyer(f.slice(0, 1), "logo", (p, ids) => ({ ...p, logo: ids[0] }))} />{page.logo && <button type="button" className="bouton-secondaire" onClick={() => { setPage((p) => ({ ...p, logo: "" })); setTimeout(menage, 1500); }}>Retirer</button>}</div>
          <h4>Photo de couverture</h4>
          <div className="pg-ligne">{page.couverture && <Vignette id={page.couverture} taille={110} />}<BoutonPhoto label={page.couverture ? "Remplacer" : "Ajouter la couverture"} onFichiers={(f) => envoyer(f.slice(0, 1), "photo", (p, ids) => ({ ...p, couverture: ids[0] }))} />{page.couverture && <button type="button" className="bouton-secondaire" onClick={() => { setPage((p) => ({ ...p, couverture: "" })); setTimeout(menage, 1500); }}>Retirer</button>}</div>
          <h4>Galerie ({page.galerie.length} / {MAX_GALERIE})</h4>
          <BoutonPhoto label="+ Ajouter des photos" multiple disabled={page.galerie.length >= MAX_GALERIE} onFichiers={(f) => envoyer(f.slice(0, MAX_GALERIE - page.galerie.length), "photo", (p, ids) => ({ ...p, galerie: [...p.galerie, ...ids.map((photo) => ({ photo, legende: "" }))].slice(0, MAX_GALERIE) }))} />
          {page.galerie.map((g, i) => (
            <div key={g.photo} className="pg-item">
              <Vignette id={g.photo} />
              <div className="pg-item-int">
                <input value={g.legende} maxLength={120} placeholder="Légende (facultatif)" onChange={(e) => setPage((p) => ({ ...p, galerie: p.galerie.map((x, j) => (j === i ? { ...x, legende: e.target.value } : x)) }))} />
                <div className="tb-actions">
                  <button type="button" className="bouton-secondaire" disabled={i === 0} onClick={() => setPage((p) => { const l = [...p.galerie]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...p, galerie: l }; })}>↑</button>
                  <button type="button" className="bouton-secondaire" disabled={i === page.galerie.length - 1} onClick={() => setPage((p) => { const l = [...p.galerie]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...p, galerie: l }; })}>↓</button>
                  <BoutonPhoto label="Remplacer" onFichiers={(f) => envoyer(f.slice(0, 1), "photo", (p, ids) => ({ ...p, galerie: p.galerie.map((x, j) => (j === i ? { ...x, photo: ids[0] } : x)) }))} />
                  <button type="button" className="bouton-secondaire" onClick={() => { setPage((p) => ({ ...p, galerie: p.galerie.filter((_, j) => j !== i) })); setTimeout(menage, 1500); }}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {onglet === "produits" && (
        <div className="pp-bloc">
          {!permises.includes("produits") && <p className="erreur">La formule {libelleFormule(formule)} n'affiche pas les produits. Ils sont gardés pour plus tard.</p>}
          <p className="tb-note">Produits et prestations ({page.produits.length} / {MAX_PRODUITS}). Le prix est facultatif. Chaque produit a son bouton « Demander sur WhatsApp ».</p>
          <div className="tb-actions">
            <button type="button" className="pp-bouton" disabled={page.produits.length >= MAX_PRODUITS} onClick={() => setPage((p) => ({ ...p, produits: [...p.produits, { nom: "Nouveau produit", prix: "", description: "", photo: "" }] }))}>+ Ajouter un produit</button>
            <BoutonPhoto label="+ Plusieurs produits d'un coup (une photo = un produit)" multiple disabled={page.produits.length >= MAX_PRODUITS} onFichiers={(f) => envoyer(f.slice(0, MAX_PRODUITS - page.produits.length), "photo", (p, ids) => ({ ...p, produits: [...p.produits, ...ids.map((photo, k) => ({ nom: `Article ${p.produits.length + k + 1}`, prix: "", description: "", photo }))] }))} />
          </div>
          {page.produits.map((x, i) => {
            const majP = (patch) => setPage((p) => ({ ...p, produits: p.produits.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
            return (
              <div key={i} className="pg-item">
                {x.photo ? <Vignette id={x.photo} /> : <div className="pg-sans-photo">Pas de photo</div>}
                <div className="pg-item-int">
                  <input value={x.nom} maxLength={80} placeholder="Nom" onChange={(e) => majP({ nom: e.target.value })} />
                  <input value={x.prix} maxLength={40} placeholder="Prix (facultatif, ex. 120 ₪)" onChange={(e) => majP({ prix: e.target.value })} />
                  <textarea rows={2} value={x.description} maxLength={400} placeholder="Description (facultatif)" onChange={(e) => majP({ description: e.target.value })} />
                  <div className="tb-actions">
                    <button type="button" className="bouton-secondaire" disabled={i === 0} onClick={() => setPage((p) => { const l = [...p.produits]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...p, produits: l }; })}>↑</button>
                    <button type="button" className="bouton-secondaire" disabled={i === page.produits.length - 1} onClick={() => setPage((p) => { const l = [...p.produits]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...p, produits: l }; })}>↓</button>
                    <BoutonPhoto label={x.photo ? "Changer la photo" : "Photo"} onFichiers={(f) => envoyer(f.slice(0, 1), "photo", (p, ids) => ({ ...p, produits: p.produits.map((y, j) => (j === i ? { ...y, photo: ids[0] } : y)) }))} />
                    <button type="button" className="bouton-secondaire" onClick={() => { setPage((p) => ({ ...p, produits: p.produits.filter((_, j) => j !== i) })); setTimeout(menage, 1500); }}>Supprimer</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onglet === "style" && (
        <div className="pp-bloc">
          <h4 style={{ marginTop: 0 }}>Modèle</h4>
          <p className="tb-note">Changer de modèle remplace seulement les couleurs, les polices et la disposition : textes et photos restent.</p>
          <div className="pg-modeles">
            {MODELES.map((m) => (
              <button key={m.id} type="button" className={`pg-modele ${page.modele === m.id ? "actif" : ""}`} onClick={() => { if (m.id === page.modele || window.confirm(`Passer au modèle « ${m.nom} » ? Tes couleurs et ta disposition actuelles seront remplacées (textes et photos gardés).`)) setPage((p) => changerModele(p, m.id)); }}>
                <MiniModele m={m} /><b>{m.nom}</b>
              </button>
            ))}
          </div>
          <h4>Couleurs du professionnel</h4>
          <div className="pg-couleurs">
            {Object.keys(LIBELLES_COULEURS).map((k) => (
              <label key={k} className="pg-couleur"><input type="color" value={page.couleurs[k]} onChange={(e) => setPage((p) => ({ ...p, couleurs: { ...p.couleurs, [k]: e.target.value } }))} /><span>{LIBELLES_COULEURS[k]}</span></label>
            ))}
          </div>
          <h4>Polices</h4>
          <Champ label="Titres"><select value={page.policeTitre} onChange={(e) => maj("policeTitre")(e.target.value)}>{POLICES.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select></Champ>
          <Champ label="Textes"><select value={page.policeTexte} onChange={(e) => maj("policeTexte")(e.target.value)}>{POLICES.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select></Champ>
          <h4>Disposition</h4>
          {[["entete", "En-tête"], ["menu", "Menu"], ["titres", "Titres des sections"], ["produits", "Produits"], ["galerie", "Galerie"], ["largeur", "Largeur"], ["fond", "Fond des sections"], ["boutons", "Boutons"], ["flottant", "Bouton WhatsApp flottant"]].map(([k, l]) => (
            <Champ key={k} label={l}><select value={page.disposition[k]} onChange={(e) => setPage((p) => ({ ...p, disposition: { ...p.disposition, [k]: e.target.value } }))}>{DISPOSITIONS[k].map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select></Champ>
          ))}
          <button type="button" className="bouton-secondaire" onClick={() => { if (window.confirm(`Revenir aux réglages d'origine du modèle « ${modele(page.modele).nom} » ?`)) setPage((p) => changerModele(p, p.modele)); }}>Revenir au style d'origine du modèle</button>
          <p className="tb-note">« Enregistrer comme mon modèle » arrive au lot 4.</p>
        </div>
      )}

      {onglet === "sections" && (
        <div className="pp-bloc">
          <p className="tb-note">Active, désactive et range les sections. Les sections grisées ne sont pas comprises dans la formule {libelleFormule(formule)} : elles apparaissent toutes seules si tu changes son forfait (onglet « Forfait et tarif »).</p>
          {sectionsDePage(page.sections, formule, modules).map((s, i, l) => (
            <div key={s.id} className={`pg-section ${s.permise ? "" : "grise"}`}>
              <label className="pg-case"><input type="checkbox" disabled={!s.permise} checked={s.actif} onChange={(e) => setPage((p) => ({ ...p, sections: sectionsDePage(p.sections, formule, modules).map(({ id, actif }) => ({ id, actif: id === s.id ? e.target.checked : actif })) }))} /> {SECTIONS.find((x) => x.id === s.id).nom}{!s.permise && " (pas dans sa formule)"}</label>
              <div>
                <button type="button" className="bouton-secondaire" disabled={i === 0} onClick={() => setPage((p) => { const x = sectionsDePage(p.sections, formule, modules).map(({ id, actif }) => ({ id, actif })); [x[i - 1], x[i]] = [x[i], x[i - 1]]; return { ...p, sections: x }; })}>↑</button>
                <button type="button" className="bouton-secondaire" disabled={i === l.length - 1} onClick={() => setPage((p) => { const x = sectionsDePage(p.sections, formule, modules).map(({ id, actif }) => ({ id, actif })); [x[i + 1], x[i]] = [x[i], x[i + 1]]; return { ...p, sections: x }; })}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {onglet === "forfait" && <Forfait page={page} setPage={setPage} dossier={dossier} grille={grille} majDossier={majDossier} />}
      {onglet === "publier" && <Publier page={page} setPage={setPage} pages={pages} dossier={dossier} versions={versions} majDossier={majDossier} enregistrerMaintenant={enregistrerMaintenant} menage={menage} setInfo={setInfo} />}
      {voir && <Apercu page={page} dossier={dossier} onFermer={() => setVoir(false)} />}
    </div>
  );
}

function AutresLiens({ liens, onChange }) {
  return (
    <div className="pg-champ">
      <span style={{ fontWeight: 600 }}>Autres liens</span>
      {liens.map((x, i) => (
        <div key={i} className="pg-ligne">
          <input style={{ flex: 1 }} value={x.titre} maxLength={40} placeholder="Titre" onChange={(e) => onChange(liens.map((y, j) => (j === i ? { ...y, titre: e.target.value } : y)))} />
          <input style={{ flex: 2 }} value={x.url} maxLength={300} placeholder="https://…" onChange={(e) => onChange(liens.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} />
          <button type="button" className="bouton-secondaire" onClick={() => onChange(liens.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {liens.length < 6 && <button type="button" className="bouton-secondaire" onClick={() => onChange([...liens, { titre: "", url: "https://" }])}>+ Ajouter un lien</button>}
      <small className="tb-note">Un lien sans « https:// » valide n'est pas affiché.</small>
    </div>
  );
}
function Avis({ avis, onChange }) {
  return (
    <div className="pg-champ">
      <span style={{ fontWeight: 600 }}>Avis clients</span>
      <small className="tb-note">Uniquement de vrais avis de clients du professionnel (recopiés de ses messages ou de Google), jamais inventés.</small>
      {avis.map((a, i) => (
        <div key={i} className="pg-item-int" style={{ borderTop: "1px solid #3a3034", paddingTop: 8 }}>
          <div className="pg-ligne"><input style={{ flex: 1 }} value={a.nom} maxLength={40} placeholder="Prénom" onChange={(e) => onChange(avis.map((y, j) => (j === i ? { ...y, nom: e.target.value } : y)))} />
            <select value={a.note} onChange={(e) => onChange(avis.map((y, j) => (j === i ? { ...y, note: Number(e.target.value) } : y)))}><option value={0}>Sans note</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
            <button type="button" className="bouton-secondaire" onClick={() => onChange(avis.filter((_, j) => j !== i))}>✕</button></div>
          <textarea rows={2} value={a.texte} maxLength={400} placeholder="Texte de l'avis" onChange={(e) => onChange(avis.map((y, j) => (j === i ? { ...y, texte: e.target.value } : y)))} />
        </div>
      ))}
      {avis.length < 12 && <button type="button" className="bouton-secondaire" onClick={() => onChange([...avis, { nom: "", texte: "", note: 5 }])}>+ Ajouter un avis</button>}
    </div>
  );
}

/* ---------- Forfait, options et tarif du client ---------- */
function Forfait({ page, setPage, dossier, grille, majDossier }) {
  const [info, setInfo] = useState("");
  const [appliquer, setAppliquer] = useState(true);
  if (!dossier) return <div className="pp-bloc"><p className="erreur">Le dossier de ce professionnel est introuvable.</p></div>;
  const t = page.tarif;
  const c = calculTarif(t, grille, dossier.formule, dossier.modules);
  const majT = (patch) => setPage((p) => ({ ...p, tarif: { ...p.tarif, ...patch } }));
  const majOpt = (id, patch) => majT({ options: { ...t.options, [id]: { ...(t.options[id] || {}), ...patch } } });
  const nombre = (v) => (v === "" ? null : Number(v));
  const contrat = contratEnVigueur(page);
  const ab = etatAbonnement(dossier.abonnement, aujourdhuiIsrael());
  const accepter = async () => {
    const k = contratDepuisTarif(t, grille, dossier.formule, dossier.modules);
    setPage((p) => ajouterJournalPage({ ...p, contrats: [k, ...(p.contrats || [])].slice(0, 40) }, `Tarif accepté : ${shekels(k.totalCreation)} + ${shekels(k.totalMensuel)}/mois`));
    if (appliquer && !page.demo) {
      await majDossier({ abonnement: abonnementDepuisContrat(k, dossier.abonnement) }, `Abonnement : ${shekels(k.totalMensuel)}/mois à partir du ${k.premierMoisPaye || k.debut || "?"}`);
      setInfo("Tarif enregistré dans l'historique et abonnement mis à jour dans son dossier.");
    } else setInfo(page.demo ? "Tarif gardé dans l'historique. Page de démonstration : aucun abonnement démarré." : "Tarif enregistré dans l'historique.");
  };
  return (
    <>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Forfait et options</h4>
        <p className="tb-note">Changer la formule ou une option met tout à jour : sections de la page et, pour Business, son espace. Aucune donnée n'est perdue.</p>
        <Champ label="Formule"><select value={dossier.formule} onChange={(e) => majDossier({ formule: e.target.value }, `Formule : ${libelleFormule(e.target.value)}`)}>{FORMULES_PRO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select></Champ>
        {dossier.formule === "business" && (
          <div className="pg-champ">
            <span style={{ fontWeight: 600 }}>Options Business</span>
            {MODULES_BUSINESS.map(([id, nom]) => (
              <label key={id} className="pg-case"><input type="checkbox" checked={dossier.modules.includes(id)} onChange={(e) => majDossier({ modules: e.target.checked ? [...dossier.modules, id] : dossier.modules.filter((m) => m !== id) }, `Option ${nom} ${e.target.checked ? "ajoutée" : "retirée"}`)} /> {nom}</label>
            ))}
            <small className="tb-note">L'agenda en ligne existe déjà dans l'espace pro. Les autres modules de l'espace Business arrivent au lot 5 : ce que tu coches maintenant sera ouvert automatiquement.</small>
          </div>
        )}
      </div>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Tarif de ce client</h4>
        {page.demo && <p className="tb-note">🎭 Page de démonstration : rien n'est facturé, aucun abonnement n'est démarré.</p>}
        <p className="tb-note">Prix de départ = ta grille Digital. Change ce que tu veux pour ce client : ta grille n'est pas modifiée, et un tarif accepté ne change plus jamais, même si tu modifies ta grille.</p>
        <table className="pg-table"><thead><tr><th></th><th>Création</th><th>Par mois</th></tr></thead><tbody>
          {c.lignes.map((l, i) => (
            <tr key={l.nom}>
              <td>{l.nom}{l.offerte ? " 🎁" : ""}</td>
              <td><input type="number" min="0" inputMode="decimal" value={i === 0 ? t.creation ?? "" : (t.options[l.id] || {}).creation ?? ""} placeholder={String(l.grilleCreation)} disabled={l.offerte} onChange={(e) => (i === 0 ? majT({ creation: nombre(e.target.value) }) : majOpt(l.id, { creation: nombre(e.target.value) }))} /></td>
              <td><input type="number" min="0" inputMode="decimal" value={i === 0 ? t.mensuel ?? "" : (t.options[l.id] || {}).mensuel ?? ""} placeholder={String(l.grilleMensuel)} disabled={l.offerte} onChange={(e) => (i === 0 ? majT({ mensuel: nombre(e.target.value) }) : majOpt(l.id, { mensuel: nombre(e.target.value) }))} /></td>
            </tr>
          ))}
        </tbody></table>
        {c.lignes.slice(1).map((l) => <label key={l.id} className="pg-case"><input type="checkbox" checked={l.offerte} onChange={(e) => majOpt(l.id, { offerte: e.target.checked })} /> Option « {l.nom} » offerte</label>)}
        <div className="pg-grille2">
          <Champ label="Remise en %"><input type="number" min="0" max="100" inputMode="decimal" value={t.remisePct || ""} onChange={(e) => majT({ remisePct: Number(e.target.value) })} /></Champ>
          <Champ label="Remise en ₪ sur la création"><input type="number" min="0" inputMode="decimal" value={t.remiseCreationShekels || ""} onChange={(e) => majT({ remiseCreationShekels: Number(e.target.value) })} /></Champ>
          <Champ label="Remise en ₪ par mois"><input type="number" min="0" inputMode="decimal" value={t.remiseMoisShekels || ""} onChange={(e) => majT({ remiseMoisShekels: Number(e.target.value) })} /></Champ>
          <Champ label="Mois d'abonnement offerts"><input type="number" min="0" max="36" inputMode="numeric" value={t.moisOfferts || ""} onChange={(e) => majT({ moisOfferts: Number(e.target.value) })} /></Champ>
          <Champ label="Début de l'abonnement"><input type="date" value={t.debutAbonnement} onChange={(e) => majT({ debutAbonnement: e.target.value })} /></Champ>
        </div>
        <label className="pg-case"><input type="checkbox" checked={t.creationOfferte} onChange={(e) => majT({ creationOfferte: e.target.checked })} /> Création offerte</label>
        <label className="pg-case"><input type="checkbox" checked={t.preferentiel} onChange={(e) => majT({ preferentiel: e.target.checked })} /> Tarif préférentiel permanent</label>
        <Texte label="Note sur ce tarif (privée)" valeur={t.note} max={300} onChange={(v) => majT({ note: v })} />
        <div className="pg-total">
          <p>Création : <b>{shekels(c.totalCreation)}</b>{c.remiseCreation > 0 && <small> (grille {shekels(c.grilleCreation)})</small>}</p>
          <p>Abonnement : <b>{shekels(c.totalMensuel)} / mois</b>{c.remiseMensuel > 0 && <small> (grille {shekels(c.grilleMensuel)})</small>}</p>
          {c.moisOfferts > 0 && <p>🎁 {c.moisOfferts} mois offerts{c.premierMoisPaye ? ` : premier mois payé le ${c.premierMoisPaye.split("-").reverse().join("/")}` : ""}</p>}
        </div>
        {!page.demo && <label className="pg-case"><input type="checkbox" checked={appliquer} onChange={(e) => setAppliquer(e.target.checked)} /> Mettre à jour le suivi d'abonnement de son dossier</label>}
        <button type="button" className="pp-bouton" onClick={accepter}>✓ Le client accepte ce tarif</button>
        {info && <p className="tb-note">{info}</p>}
      </div>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Historique des tarifs acceptés</h4>
        {ab.actif && <p className="tb-note">Abonnement suivi : {shekels(dossier.abonnement.mensuel)}/mois · {ab.payes} mois payés · {ab.retard > 0 ? <b style={{ color: "#e05a5a" }}>{ab.retard} mois en retard</b> : "à jour"}{ab.prochaine ? ` · prochaine échéance ${ab.prochaine.split("-").reverse().join("/")}` : ""}</p>}
        {!(page.contrats || []).length && <p className="tb-note">Aucun tarif accepté pour l'instant.</p>}
        {(page.contrats || []).map((k, i) => (
          <div key={k.leMs} className="pg-contrat">
            <b>{i === 0 ? "En vigueur · " : ""}{fmt(k.leMs)}</b> · {libelleFormule(k.formule)}{k.modules.length ? ` + ${k.modules.length} option(s)` : ""}
            <br />Création {shekels(k.totalCreation)}{k.creationOfferte ? " (offerte)" : ""} · {shekels(k.totalMensuel)}/mois{k.moisOfferts ? ` · ${k.moisOfferts} mois offerts` : ""}{k.preferentiel ? " · tarif préférentiel" : ""}{k.note ? ` · ${k.note}` : ""}
          </div>
        ))}
        {contrat && <p className="tb-note">Les encaissements de l'abonnement se notent dans le dossier du pro (Annuaire des professionnels). Le tableau de bord Digital complet arrive au lot 3.</p>}
      </div>
    </>
  );
}

/* ---------- Publication, apercu prive, QR code, versions, sauvegarde ---------- */
function Publier({ page, setPage, pages, dossier, versions, majDossier, enregistrerMaintenant, menage, setInfo }) {
  const [qr, setQr] = useState("");
  const [enCours, setEnCours] = useState("");
  const adresseAvant = useRef(page.adresse);
  const lien = lienPage(SITE_OFFICIEL, page.adresse);
  const erreurs = erreursPage(page, pages, dossier);
  const nbErreurs = Object.keys(erreurs).length;
  useEffect(() => { if (enLigne(page)) QRCode.toDataURL(lien, { margin: 1, width: 600 }).then(setQr, () => setQr("")); else setQr(""); }, [lien, page.statut]); // eslint-disable-line react-hooks/exhaustive-deps
  const lienAnnuaire = (actif) => {
    if (!dossier || page.demo) return Promise.resolve();
    const nouveau = actif ? lien : dossier.siteDigital === lien ? "" : dossier.siteDigital;
    return nouveau === dossier.siteDigital ? Promise.resolve() : majDossier({ siteDigital: nouveau }, actif ? `Page en ligne : ${lien}` : "Page retirée de la fiche");
  };
  const publier = async () => {
    if (nbErreurs) return setInfo(Object.values(erreurs).join(" "));
    if (page.demo) return setInfo("Page de démonstration : décoche « démonstration » (plus bas) quand le client a accepté, puis publie.");
    setEnCours("Publication…");
    try {
      await enregistrerMaintenant();
      const ancienne = enLigne(page) || ["suspendue", "archivee"].includes(page.statut) ? adresseAvant.current : "";
      const p = await publierPage(ajouterJournalPage(page, enLigne(page) ? "Nouvelle version publiée" : "Publiée"), dossier, versions, ancienne);
      adresseAvant.current = p.adresse;
      setPage(p);
      await lienAnnuaire(true);
      setTimeout(menage, 2500);
      setInfo("");
    } catch (e) {
      setInfo("Publication impossible : " + (e && e.message ? e.message : "vérifie la connexion."));
    }
    return setEnCours("");
  };
  const retirer = async (statut) => {
    const libelle = statut === "suspendue" ? "Suspendre la page ? Elle affichera « momentanément indisponible ». Rien n'est effacé." : "Archiver la page ? Elle ne sera plus visible. Rien n'est effacé, tu peux la remettre en ligne.";
    if (!window.confirm(libelle)) return;
    setEnCours("…");
    try {
      await enregistrerMaintenant();
      const p = await retirerPage(ajouterJournalPage(page, statut === "suspendue" ? "Suspendue" : "Archivée"), statut);
      setPage(p);
      await lienAnnuaire(false);
    } catch { setInfo("Impossible pour l'instant. Vérifie la connexion."); }
    setEnCours("");
  };
  const apercuPrive = async () => {
    setEnCours("Création du lien…");
    try {
      const a = await creerApercu(page, dossier);
      setPage((p) => ajouterJournalPage({ ...p, apercu: a }, "Lien d'aperçu privé créé"));
    } catch { setInfo("Lien d'aperçu impossible. Vérifie la connexion."); }
    setEnCours("");
  };
  const lienPrive = page.apercu.jeton && page.apercu.expireLeMs > Date.now() ? lienApercu(SITE_OFFICIEL, page.apercu.jeton) : "";
  const telWa = dossier ? dossier.whatsapp || dossier.telephone : page.whatsapp;
  const exporter = async () => {
    setEnCours("Préparation de la sauvegarde…");
    try { telecharger(await exporterPages([page], { [page.id]: versions }), `sauvegarde-${page.adresse || page.id}.zip`); } catch { setInfo("Sauvegarde impossible."); }
    setEnCours("");
  };
  return (
    <>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Adresse de la page</h4>
        <Champ label="rebeccaservices.com/p/…" aide="Lettres minuscules, chiffres et tirets.">
          <input value={page.adresse} maxLength={40} onChange={(e) => setPage((p) => ({ ...p, adresse: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
        </Champ>
        <Texte label="Titre pour Google et WhatsApp (facultatif)" valeur={page.seo.titre} max={70} placeholder={[page.nom, page.specialite].filter(Boolean).join(" – ")} onChange={(v) => setPage((p) => ({ ...p, seo: { ...p.seo, titre: v } }))} />
        <Texte label="Description pour Google et WhatsApp (facultatif)" long valeur={page.seo.description} max={170} placeholder={page.accroche || "Reprend la phrase d'accroche"} onChange={(v) => setPage((p) => ({ ...p, seo: { ...p.seo, description: v } }))} />
        <label className="pg-case"><input type="checkbox" checked={page.demo} onChange={(e) => setPage((p) => ajouterJournalPage({ ...p, demo: e.target.checked }, e.target.checked ? "Passée en démonstration" : "N'est plus une démonstration"))} /> Page de démonstration (privée, jamais publiée)</label>
        {nbErreurs > 0 && <ul className="erreur">{Object.values(erreurs).map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="tb-actions">
          <button type="button" className="pp-bouton" disabled={!!enCours || page.demo} onClick={publier}>{enLigne(page) ? (modifsNonPubliees(page) ? "Publier la nouvelle version" : "Republier") : "Publier la page"}</button>
          {enLigne(page) && <button type="button" className="bouton-secondaire" onClick={() => retirer("suspendue")}>Suspendre</button>}
          {page.statut !== "archivee" && (enLigne(page) || page.statut === "suspendue") && <button type="button" className="bouton-secondaire" onClick={() => retirer("archivee")}>Archiver</button>}
        </div>
        {enCours && <p className="tb-note">⏳ {enCours}</p>}
        {enLigne(page) && <p className="tb-note">En ligne depuis le {fmt(page.publieeLeMs)}. Tes modifications restent dans le brouillon jusqu'à « Publier la nouvelle version ».</p>}
      </div>
      {enLigne(page) && (
        <div className="pp-bloc">
          <h4 style={{ marginTop: 0 }}>Partager</h4>
          <p><a href={lien} target="_blank" rel="noopener noreferrer">{lien}</a></p>
          <div className="tb-actions">
            <button type="button" className="bouton-secondaire" onClick={() => navigator.clipboard && navigator.clipboard.writeText(lien).then(() => setInfo("Lien copié."), () => {})}>Copier le lien</button>
            {telWa && <a className="bouton-secondaire" href={lienWhatsAppPage(telWa, `Bonjour, votre page est en ligne : ${lien}`)} target="_blank" rel="noopener noreferrer">Envoyer au client</a>}
          </div>
          {qr && <><img src={qr} alt="QR code de la page" style={{ width: 180, background: "#fff", padding: 8, borderRadius: 10, marginTop: 12 }} /><br /><a className="bouton-secondaire" href={qr} download={`qr-${page.adresse}.png`}>Télécharger le QR code</a></>}
        </div>
      )}
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Aperçu privé pour le client</h4>
        <p className="tb-note">Un lien secret (valable 14 jours) pour que le client voie sa page avant la publication. Il montre le brouillon au moment où tu crées le lien : recrée-le après des changements.</p>
        <div className="tb-actions">
          <button type="button" className="bouton-secondaire" disabled={!!enCours} onClick={apercuPrive}>{lienPrive ? "Mettre à jour l'aperçu" : "Créer le lien d'aperçu"}</button>
          {lienPrive && telWa && <a className="bouton-secondaire" href={lienWhatsAppPage(telWa, `Bonjour, voici l'aperçu de votre page avant publication : ${lienPrive}`)} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>}
          {lienPrive && <button type="button" className="bouton-secondaire" onClick={async () => { await supprimerApercu(page.apercu.jeton).catch(() => {}); setPage((p) => ({ ...p, apercu: { jeton: "", expireLeMs: 0 } })); }}>Retirer le lien</button>}
        </div>
        {lienPrive && <p className="tb-note" style={{ wordBreak: "break-all" }}>{lienPrive} · expire le {fmt(page.apercu.expireLeMs)}</p>}
      </div>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Anciennes versions ({versions.length} / 5)</h4>
        <p className="tb-note">Les 5 dernières versions publiées. Restaurer remet la version dans le brouillon (rien ne change en ligne avant « Publier »). Les versions ne recopient pas les photos : elles les réutilisent.</p>
        {versions.map((v) => (
          <div key={v.leMs} className="pg-ligne" style={{ justifyContent: "space-between" }}>
            <span>{fmt(v.leMs)} · {libelleModele(v.page.modele)}</span>
            <button type="button" className="bouton-secondaire" onClick={() => { if (window.confirm("Remettre cette version dans le brouillon ?")) setPage((p) => ajouterJournalPage(restaurerVersion(p, v), `Version du ${fmt(v.leMs)} restaurée`)); }}>Restaurer</button>
          </div>
        ))}
      </div>
      <div className="pp-bloc">
        <h4 style={{ marginTop: 0 }}>Sauvegarde</h4>
        <p className="tb-note">Télécharge un fichier ZIP (textes, versions et photos) dans ton iPhone ou ton Drive : rien n'est recopié dans Firebase.</p>
        <button type="button" className="bouton-secondaire" disabled={!!enCours} onClick={exporter}>Télécharger la sauvegarde de cette page</button>
        <h4>Journal</h4>
        {(page.journal || []).slice(0, 12).map((j) => <p key={j.leMs + j.texte} className="tb-note" style={{ margin: "2px 0" }}>{fmt(j.leMs)} · {j.texte}</p>)}
      </div>
    </>
  );
}
const libelleModele = (id) => modele(id).nom;

/* ---------- Liste des pages ---------- */
export default function PagesProAdmin() {
  const pages = usePagesAdmin();
  const dossiers = useDossiersPros();
  const categories = useCategoriesPros();
  const grille = useGrilleDigitalPro();
  const [vue, setVue] = useState({ nom: "liste" });
  const [filtre, setFiltre] = useState("toutes");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState("");
  const fichierZip = useRef(null);
  if (!pages || !dossiers) return <p className="tb-note">Chargement…</p>;
  const dossierDe = (p) => dossiers.find((d) => d.id === p.proId);
  if (vue.nom === "nouvelle") return <NouvellePage dossiers={dossiers} categories={categories} pages={pages} onCree={(id) => setVue({ nom: "attente", id })} onAnnuler={() => setVue({ nom: "liste" })} />;
  if (vue.nom === "attente" || vue.nom === "editeur") {
    const p = pages.find((x) => x.id === vue.id);
    if (!p) return <p className="tb-note">Ouverture de la page…</p>;
    return <Editeur key={p.id} pageInitiale={p} pages={pages} dossiers={dossiers} categories={categories} grille={grille} onRetour={() => setVue({ nom: "liste" })} />;
  }
  const filtrees = pages.filter((p) => (filtre === "toutes" ? p.statut !== "archivee" : filtre === "demo" ? p.demo : filtre === "preparation" ? STATUTS_PREPARATION.includes(p.statut) : p.statut === filtre));
  const dupliquer = async (p) => {
    const c = dupliquerPage(p, pages);
    await enregistrerPageAdmin(ajouterJournalPage(c, `Copie de « ${p.nom} »`));
    setVue({ nom: "attente", id: c.id });
  };
  const toutExporter = async () => {
    setEnCours("Préparation de la sauvegarde complète…");
    try { telecharger(await exporterPages(pages), `sauvegarde-pages-pros-${aujourdhuiIsrael()}.zip`); } catch { setInfo("Sauvegarde impossible."); }
    setEnCours("");
  };
  const restaurer = async (f) => {
    if (!window.confirm("Restaurer cette sauvegarde ? Les pages qu'elle contient remplacent leur version actuelle (brouillon).")) return;
    setEnCours("Restauration…");
    try { const l = await restaurerSauvegarde(f); setInfo(`Restauré : ${l.join(", ") || "rien"}.`); } catch (e) { setInfo("Fichier illisible : " + (e && e.message ? e.message : "")); }
    setEnCours("");
  };
  return (
    <div className="pg-admin">
      <h2 style={{ marginTop: 0 }}>Pages des professionnels</h2>
      <p className="tb-note">Crée et publie toi-même les pages de tes clients (Référencement, Vitrine, Business, Pack Pro). Elles sont en ligne tout de suite, sans publication Netlify.</p>
      <button type="button" className="pp-bouton" onClick={() => setVue({ nom: "nouvelle" })}>+ Créer une page</button>
      <div className="pg-filtres">
        {[["toutes", "En cours"], ["preparation", "En préparation"], ["publiee", "Publiées"], ["demo", "Démonstrations"], ["suspendue", "Suspendues"], ["archivee", "Archivées"]].map(([v, l]) => <button key={v} type="button" className={filtre === v ? "actif" : ""} onClick={() => setFiltre(v)}>{l}</button>)}
      </div>
      {!filtrees.length && <p className="tb-note">Aucune page ici.</p>}
      {filtrees.map((p) => {
        const d = dossierDe(p);
        const ab = d ? etatAbonnement(d.abonnement, aujourdhuiIsrael()) : null;
        return (
          <div key={p.id} className="pp-bloc pg-carte">
            <div className="pg-ligne" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <b>{p.nom || "Sans nom"}</b>{p.demo && <span className="pg-badge">démo</span>}
                <br /><small style={{ color: COULEUR_STATUT[p.statut] }}>● {libelleStatutPage(p.statut)}{modifsNonPubliees(p) ? " · modifs non publiées" : ""}</small>
                <br /><small className="tb-note">{d ? libelleFormule(d.formule) : "dossier introuvable"} · {modele(p.modele).nom} · {nombrePhotos(p)} photos ({enMo(poidsPhotos(p))})</small>
                {ab && ab.retard > 0 && <><br /><small style={{ color: "#e05a5a" }}>⚠️ {ab.retard} mois d'abonnement en retard</small></>}
                {enLigne(p) && <><br /><small><a href={lienPage(SITE_OFFICIEL, p.adresse)} target="_blank" rel="noopener noreferrer">/p/{p.adresse}</a></small></>}
              </div>
            </div>
            <div className="tb-actions">
              <button type="button" className="pp-bouton" style={{ marginTop: 0 }} onClick={() => setVue({ nom: "editeur", id: p.id })}>Ouvrir</button>
              <button type="button" className="bouton-secondaire" onClick={() => dupliquer(p)}>Dupliquer</button>
            </div>
          </div>
        );
      })}
      <CompteurEspace pages={pages} />
      <div className="pp-bloc">
        <h3 style={{ marginTop: 0 }}>💾 Sauvegarde de toutes les pages</h3>
        <p className="tb-note">Un fichier ZIP avec les textes, les anciennes versions et toutes les photos, à garder dans ton iPhone (Fichiers) ou ton Google Drive. Conseillé une fois par semaine. Rien n'est recopié dans Firebase.</p>
        <div className="tb-actions">
          <button type="button" className="bouton-secondaire" disabled={!!enCours} onClick={toutExporter}>Télécharger la sauvegarde</button>
          <button type="button" className="bouton-secondaire" disabled={!!enCours} onClick={() => fichierZip.current && fichierZip.current.click()}>Restaurer une sauvegarde</button>
          <input ref={fichierZip} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) restaurer(f); }} />
        </div>
        {enCours && <p className="tb-note">⏳ {enCours}</p>}
        {info && <p className="tb-note">{info}</p>}
      </div>
    </div>
  );
}
