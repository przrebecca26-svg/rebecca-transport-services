import { useState } from "react";
import {
  FORMULES_PRO, LANGUES, LIBELLES_ETAT_JUSTIF, STATUTS_PRO, TYPES_JUSTIF, ajouterJournal, alertesJustificatifs, changerStatut, dossierVide,
  erreursDossier, etatJustif, fichePublique, importerCandidature, formuleAvecPage, justificatifsDemandes, libelleFormule, libelleStatutPro, manquePourBadge,
  nomCategorie, normaliserDossier, nouvelIdPro, statutsPossibles,
} from "./pricing/pros.js";
import { reduirePhoto } from "./photoReduite.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import {
  aujourdhuiIsrael, enregistrerCategories, enregistrerDossiers, enregistrerImagesPro, enregistrerJustifPhoto, supprimerCandidature, supprimerImagesPro,
  supprimerJustifPhoto, useCandidaturesPros, useCategoriesPros, useDossiersPros, useImagesPro, useJustifPhoto, useStatsPros,
} from "./prosBase.js";
import ProsAnnuaire from "./components/ProsAnnuaire.jsx";
import ProInscription from "./components/ProInscription.jsx";

// ESPACE DE REBECCA : PROFESSIONNELS PARTENAIRES (25 nov. 2026)
// Dossiers privés, statuts (brouillon -> soumis -> en examen -> accepté / refusé / suspendu), journal des décisions,
// justificatifs privés avec dates de validité, badge « Partenaire vérifié » donné à la main, photos publiques,
// métiers, aperçu de l'annuaire. Seules les fiches acceptées et actives sortent dans l'annuaire public.

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const COULEUR_ETAT = { manquant: "#b88", a_controler: "#d9a441", valide: "#5cb85c", bientot: "#d9a441", expire: "#e05a5a" };

function JustifLigne({ id, type, piece, demande, onChange, aujourdhui }) {
  const [voir, setVoir] = useState(false);
  const [info, setInfo] = useState("");
  const photo = useJustifPhoto(id, type, voir);
  const j = piece || { recu: false, controle: false, expire: "", note: "", photo: false };
  const etat = etatJustif(piece, aujourdhui);
  const ajouterPhoto = async (fichier) => {
    setInfo("Préparation…");
    try {
      const p = await reduirePhoto(fichier, { cote: 1400, maxOctets: 700000 });
      await enregistrerJustifPhoto(id, type, p);
      onChange({ ...j, recu: true, photo: true });
      setInfo("✓ Photo enregistrée (privée)");
    } catch (e) {
      setInfo(e.message || "Enregistrement impossible.");
    }
  };
  const retirerPhoto = async () => {
    try {
      await supprimerJustifPhoto(id, type);
      onChange({ ...j, photo: false });
      setVoir(false);
    } catch {
      setInfo("Suppression impossible.");
    }
  };
  return (
    <div style={{ borderTop: "1px solid #333", padding: "8px 0" }}>
      <p style={{ margin: 0 }}>
        <b>{TYPES_JUSTIF.find((t) => t.v === type).l}</b>{demande ? " *" : ""} · <span style={{ color: COULEUR_ETAT[etat] }}>{LIBELLES_ETAT_JUSTIF[etat]}</span>
      </p>
      <div className="tb-actions">
        <label className="case"><input type="checkbox" checked={j.recu} onChange={() => onChange({ ...j, recu: !j.recu })} /><span>Reçu</span></label>
        <label className="case"><input type="checkbox" checked={j.controle} disabled={!j.recu} onChange={() => onChange({ ...j, controle: !j.controle })} /><span>Contrôlé</span></label>
      </div>
      <label className="champ"><span>Valable jusqu'au (si le document expire)</span><input type="date" value={j.expire} onChange={(e) => onChange({ ...j, expire: e.target.value })} /></label>
      <label className="champ"><span>Note</span><input value={j.note} onChange={(e) => onChange({ ...j, note: e.target.value })} /></label>
      <div className="tb-actions">
        <label className="bouton-secondaire" style={{ cursor: "pointer" }}>
          📷 {j.photo ? "Remplacer la photo" : "Ajouter la photo"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && ajouterPhoto(e.target.files[0])} />
        </label>
        {j.photo && <button type="button" className="bouton-secondaire" onClick={() => setVoir(!voir)}>{voir ? "Cacher" : "👁 Voir"}</button>}
        {j.photo && <button type="button" className="bouton-secondaire" onClick={retirerPhoto}>Supprimer la photo</button>}
      </div>
      {voir && photo === null && <p className="tb-note">Chargement…</p>}
      {voir && photo && <img src={photo} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 6 }} />}
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

function PhotosPubliques({ id }) {
  const img = useImagesPro(id);
  const [info, setInfo] = useState("");
  const sauver = async (suite) => {
    try {
      await enregistrerImagesPro(id, suite);
      setInfo("✓ Enregistré");
    } catch {
      setInfo("Enregistrement impossible (4 photos maximum, réduites).");
    }
  };
  const ajouter = async (fichiers, logo) => {
    setInfo("Préparation…");
    try {
      if (logo) return sauver({ ...img, logo: await reduirePhoto(fichiers[0], { cote: 400, maxOctets: 60000 }) });
      const nouv = [];
      for (const x of [...fichiers].slice(0, 4)) nouv.push(await reduirePhoto(x, { cote: 1000, maxOctets: 180000 }));
      return sauver({ ...img, photos: [...(img.photos || []), ...nouv].slice(0, 4) });
    } catch (e) {
      setInfo(e.message || "Photo illisible.");
    }
    return undefined;
  };
  return (
    <div className="champ">
      <span>Logo et photos publiques (4 maximum)</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {img.logo && <img src={img.logo} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} />}
        {(img.photos || []).map((p, i) => (
          <span key={i} style={{ position: "relative" }}>
            <img src={p} alt="" style={{ height: 70, borderRadius: 8 }} />
            <button type="button" aria-label="Retirer" onClick={() => sauver({ ...img, photos: img.photos.filter((_, k) => k !== i) })} style={{ position: "absolute", top: 0, right: 0 }}>✕</button>
          </span>
        ))}
      </div>
      <div className="tb-actions">
        <label className="bouton-secondaire" style={{ cursor: "pointer" }}>Logo<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files.length && ajouter(e.target.files, true)} /></label>
        <label className="bouton-secondaire" style={{ cursor: "pointer" }}>+ Photos<input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && ajouter(e.target.files, false)} /></label>
      </div>
      {info && <span className="aide" role="status">{info}</span>}
    </div>
  );
}

function FicheDossier({ initial, categories, dossiers, stats, onFermer }) {
  const [d, setD] = useState(() => normaliserDossier(initial));
  const [motif, setMotif] = useState("");
  const [info, setInfo] = useState("");
  const [err, setErr] = useState({});
  const [confirmSuppr, setConfirmSuppr] = useState(false);
  const auj = aujourdhuiIsrael();
  const cat = categories.find((c) => c.id === d.categorie);
  const demandes = justificatifsDemandes(cat, d.qualificationNecessaire);
  const manque = manquePourBadge(d, categories, auj);
  const st = stats[d.id] || {};
  const set = (k, v) => setD({ ...d, [k]: v });
  const sauver = async (suite = d, texte = "✓ Enregistré") => {
    const e = erreursDossier(suite);
    setErr(e);
    if (Object.keys(e).length) return setInfo("Vérifie les champs signalés.");
    const propre = normaliserDossier({ ...suite, majLeMs: Date.now(), creeLeMs: suite.creeLeMs || Date.now() });
    const liste = dossiers.some((x) => x.id === propre.id) ? dossiers.map((x) => (x.id === propre.id ? propre : x)) : [propre, ...dossiers];
    try {
      await enregistrerDossiers(liste, categories);
      setD(propre);
      setInfo(texte + (fichePublique(propre, categories, auj) ? " · visible dans l'annuaire" : " · pas dans l'annuaire"));
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
    return undefined;
  };
  const statut = async (nouveau) => {
    const r = changerStatut(d, nouveau, motif);
    if (r.erreur) return setInfo(r.erreur);
    setMotif("");
    return sauver(r.dossier, `✓ ${libelleStatutPro(nouveau)}`);
  };
  const badge = async () => {
    if (!d.badge && manque.length) return setInfo(`Avant le badge, il manque : ${manque.join(", ")}.`);
    return sauver(ajouterJournal({ ...d, badge: !d.badge }, d.badge ? "Badge « Partenaire vérifié » retiré" : "Badge « Partenaire vérifié » donné"), d.badge ? "✓ Badge retiré" : "✓ Badge donné");
  };
  const supprimer = async () => {
    try {
      await enregistrerDossiers(dossiers.filter((x) => x.id !== d.id), categories);
      await supprimerImagesPro(d.id).catch(() => {});
      for (const t of TYPES_JUSTIF) if ((d.justificatifs[t.v] || {}).photo) await supprimerJustifPhoto(d.id, t.v).catch(() => {});
      onFermer();
    } catch {
      setInfo("Suppression impossible.");
    }
  };
  const champ = (label, k, opts = {}) => (
    <label className="champ">
      <span>{label}</span>
      {opts.multi ? <textarea rows={3} value={d[k]} onChange={(e) => set(k, e.target.value)} /> : <input type={opts.type || "text"} value={d[k]} onChange={(e) => set(k, e.target.value)} />}
      {opts.aide && <span className="aide">{opts.aide}</span>}
      {err[k] && <span className="erreur" role="alert">{err[k]}</span>}
    </label>
  );
  const tel = d.whatsapp || d.telephone;
  return (
    <div className="pp-bloc">
      <button type="button" className="tdb-retour" onClick={onFermer}>← Tous les professionnels</button>
      <h3 style={{ marginBottom: 4 }}>{d.nomCommercial || "Nouveau professionnel"}</h3>
      <p className="tb-note">
        {libelleStatutPro(d.statut)} · {libelleFormule(d.formule)}{d.badge ? " · ✅ vérifié" : ""}{d.source === "inscription" ? " · inscrit depuis le site" : ""}
        {(st.visites || st.whatsapp) ? ` · 👁 ${st.visites || 0} visites · 💬 ${st.whatsapp || 0} clics` : ""}
      </p>
      {tel && <a className="bouton-secondaire" href={lienWhatsApp(tel, `Bonjour ${d.prenom || d.nomCommercial}, c'est Rebecca de Rebecca Services, au sujet de votre fiche dans l'annuaire des professionnels.`)} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}

      <h4>Décision</h4>
      {statutsPossibles(d.statut).length > 0 && (
        <>
          <label className="champ"><span>Motif (obligatoire pour refuser ou suspendre)</span><input value={motif} onChange={(e) => setMotif(e.target.value)} /></label>
          <div className="tb-actions">
            {statutsPossibles(d.statut).map((s) => <button key={s} type="button" className={s === "accepte" ? "pp-bouton" : "bouton-secondaire"} onClick={() => statut(s)}>{s === "accepte" ? "✓ Accepter et publier" : s === "suspendu" ? "Suspendre" : s === "refuse" ? "✗ Refuser" : libelleStatutPro(s)}</button>)}
          </div>
        </>
      )}
      <div className="tb-actions">
        <button type="button" className="bouton-secondaire" onClick={badge}>{d.badge ? "Retirer le badge ✅" : "Donner le badge ✅ Partenaire vérifié"}</button>
      </div>
      {!d.badge && manque.length > 0 && <p className="tb-note">Pour le badge, il manque : {manque.join(", ")}.</p>}
      {d.badge && manque.length > 0 && <p className="erreur">Badge donné mais caché sur le site : {manque.join(", ")}.</p>}

      <h4>Fiche</h4>
      {champ("Nom commercial *", "nomCommercial")}
      <div className="tb-actions">{champ("Prénom", "prenom")}{champ("Nom", "nom")}</div>
      <label className="champ">
        <span>Métier *</span>
        <select value={d.categorie} onChange={(e) => set("categorie", e.target.value)}>
          <option value="">Choisir…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}{c.visible ? "" : " (caché)"}</option>)}
        </select>
        {err.categorie && <span className="erreur" role="alert">{err.categorie}</span>}
      </label>
      {champ("Spécialité", "metier")}
      {champ("Présentation", "description", { multi: true })}
      {champ("Prestations", "prestations", { multi: true })}
      {champ("Tarifs indicatifs", "tarifs", { aide: "vide = « Sur devis »" })}
      {champ("Villes *", "villes", { aide: "séparées par des virgules" })}
      {champ("Zone d'intervention", "zone")}
      <fieldset className="champ">
        <legend>Langues</legend>
        {LANGUES.map((l) => <label key={l} className="case"><input type="checkbox" checked={d.langues.includes(l)} onChange={() => set("langues", d.langues.includes(l) ? d.langues.filter((x) => x !== l) : [...d.langues, l])} /><span>{l}</span></label>)}
      </fieldset>
      {champ("Horaires", "horaires")}
      {champ("Téléphone", "telephone", { type: "tel" })}
      {champ("WhatsApp", "whatsapp", { type: "tel" })}
      {err.whatsapp && <span className="erreur" role="alert">{err.whatsapp}</span>}
      <label className="case"><input type="checkbox" checked={d.whatsappPublic} onChange={() => set("whatsappPublic", !d.whatsappPublic)} /><span>Numéro affiché sur la fiche (son accord)</span></label>
      {champ("E-mail (privé)", "email", { type: "email" })}
      {champ("Numéro d'osek (privé)", "osek")}
      <PhotosPubliques id={d.id} />

      <h4>Formule</h4>
      <label className="champ">
        <span>Formule</span>
        <select value={d.formule} onChange={(e) => set("formule", e.target.value)}>
          {FORMULES_PRO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
        <span className="aide">{FORMULES_PRO.find((f) => f.v === d.formule).detail}. Le devis et les paiements se font dans Projets Digital.</span>
      </label>
      {formuleAvecPage(d.formule) && champ("Lien de sa page (https://…)", "siteDigital", { aide: "affiché sur sa fiche" })}

      <h4>Justificatifs (privés)</h4>
      <label className="case"><input type="checkbox" checked={d.qualificationNecessaire} onChange={() => set("qualificationNecessaire", !d.qualificationNecessaire)} /><span>Ce métier demande un diplôme ou une qualification</span></label>
      {TYPES_JUSTIF.map((t) => (
        <JustifLigne key={t.v} id={d.id} type={t.v} piece={d.justificatifs[t.v]} demande={demandes.includes(t.v)} aujourdhui={auj} onChange={(j) => setD({ ...d, justificatifs: { ...d.justificatifs, [t.v]: j } })} />
      ))}

      <h4>Note privée</h4>
      {champ("Visible par toi seule", "notePrivee", { multi: true })}

      <div className="tb-actions" style={{ position: "sticky", bottom: 0, background: "var(--fond, #111)", padding: "8px 0" }}>
        <button type="button" className="pp-bouton" onClick={() => sauver()}>Enregistrer</button>
        <button type="button" className="bouton-secondaire" onClick={onFermer}>Fermer</button>
      </div>
      {info && <p className="tb-note" role="status">{info}</p>}

      <h4>Journal des décisions</h4>
      {d.journal.length ? <ul className="tb-note">{d.journal.map((j, i) => <li key={i}>{fmtDate(j.leMs)} — {j.texte}</li>)}</ul> : <p className="tb-note">Rien pour l'instant.</p>}

      {confirmSuppr ? (
        <div className="tb-actions"><span>Supprimer ce dossier, ses photos et ses justificatifs ?</span><button type="button" className="bouton-secondaire" onClick={supprimer}>Oui, supprimer</button><button type="button" className="bouton-secondaire" onClick={() => setConfirmSuppr(false)}>Non</button></div>
      ) : (
        <button type="button" className="bouton-secondaire" onClick={() => setConfirmSuppr(true)}>🗑 Supprimer le dossier</button>
      )}
    </div>
  );
}

function Metiers({ categories, dossiers }) {
  const [l, setL] = useState(categories);
  const [info, setInfo] = useState("");
  const sauver = async () => {
    try {
      await enregistrerCategories(l.filter((c) => c.nom.trim()), dossiers);
      setInfo("✓ Métiers enregistrés (l'annuaire est mis à jour)");
    } catch {
      setInfo("Enregistrement impossible.");
    }
  };
  const maj = (i, k, v) => setL(l.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <div className="pp-bloc">
      <p className="tb-note">Un métier caché retire ses fiches de l'annuaire. La garde d'enfants reste cachée jusqu'à l'avis du juriste.</p>
      {l.map((c, i) => (
        <div key={c.id} className="tb-actions" style={{ alignItems: "center" }}>
          <input value={c.icone} onChange={(e) => maj(i, "icone", e.target.value)} style={{ width: 48 }} aria-label="Icône" />
          <input value={c.nom} onChange={(e) => maj(i, "nom", e.target.value)} style={{ flex: 1 }} aria-label="Nom du métier" />
          <label className="case"><input type="checkbox" checked={c.visible} onChange={() => maj(i, "visible", !c.visible)} /><span>Visible</span></label>
        </div>
      ))}
      <div className="tb-actions">
        <button type="button" className="bouton-secondaire" onClick={() => setL([...l, { id: `m${Date.now().toString(36)}`, nom: "", icone: "✨", visible: true }])}>+ Ajouter un métier</button>
        <button type="button" className="pp-bouton" onClick={sauver}>Enregistrer</button>
      </div>
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

function CandidaturesEnLigne({ dossiers, categories, onOuvrir }) {
  const { liste, erreur } = useCandidaturesPros(true);
  const [info, setInfo] = useState("");
  if (erreur) return <p className="tb-note">Inscriptions en ligne : pas encore ouvertes (règles Firebase v37 à publier). En attendant, les inscriptions t'arrivent par WhatsApp : crée le dossier avec « + Ajouter un professionnel ».</p>;
  if (!liste || !liste.length) return null;
  const importer = async (c) => {
    try {
      const d = importerCandidature(c.dossier);
      await enregistrerDossiers([d, ...dossiers], categories);
      await supprimerCandidature(c.cle);
      onOuvrir(d);
    } catch {
      setInfo("Import impossible.");
    }
  };
  return (
    <div className="pp-bloc">
      <h3>📥 Inscriptions reçues ({liste.length})</h3>
      {liste.map((c) => (
        <div key={c.cle} className="tb-actions" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}><b>{c.dossier.nomCommercial}</b> · {nomCategorie(categories, c.dossier.categorie)} · {c.dossier.villes}</span>
          <button type="button" className="pp-bouton" onClick={() => importer(c)}>Examiner</button>
        </div>
      ))}
      {info && <p className="erreur">{info}</p>}
    </div>
  );
}

export default function ProsAdmin() {
  const dossiers = useDossiersPros();
  const categories = useCategoriesPros();
  const stats = useStatsPros(true);
  const [vue, setVue] = useState("liste");
  const [ouvert, setOuvert] = useState(null);
  const [filtre, setFiltre] = useState("tous");
  if (!dossiers || !categories) return <p className="tb-note">Chargement…</p>;
  if (ouvert) return <FicheDossier key={ouvert.id} initial={ouvert} categories={categories} dossiers={dossiers} stats={stats} onFermer={() => setOuvert(null)} />;
  const auj = aujourdhuiIsrael();
  const alertes = alertesJustificatifs(dossiers, auj);
  const compte = (s) => dossiers.filter((d) => d.statut === s).length;
  const liste = dossiers.filter((d) => filtre === "tous" || d.statut === filtre || (filtre === "a_traiter" && ["soumis", "en_examen"].includes(d.statut)));
  const nouveau = () => setOuvert({ ...dossierVide(), id: nouvelIdPro(), statut: "en_examen", creeLeMs: Date.now(), journal: [{ leMs: Date.now(), texte: "Dossier créé par Rebecca" }] });
  return (
    <section>
      <div className="pp-bloc">
        <h2>✨ Professionnels partenaires</h2>
        <p className="tb-note">Annuaire <b>caché du public</b> tant que tu ne l'ouvres pas (Réglages → Pages du site → « Annuaire des professionnels partenaires »). Seules les fiches acceptées et actives y apparaissent.</p>
        <div className="tb-actions">
          {[["liste", "Dossiers"], ["metiers", "Métiers"], ["apercu", "👁 Aperçu annuaire"], ["inscription", "👁 Aperçu inscription"]].map(([v, l]) => (
            <button key={v} type="button" className={vue === v ? "pp-bouton" : "bouton-secondaire"} onClick={() => setVue(v)}>{l}</button>
          ))}
        </div>
      </div>
      {vue === "metiers" && <Metiers categories={categories} dossiers={dossiers} />}
      {vue === "apercu" && <ProsAnnuaire apercu />}
      {vue === "inscription" && <div className="pp-bloc"><p className="tb-note">Aperçu : ce que voit un professionnel sur rebeccaservices.com/#/pro (n'envoie rien d'ici).</p><ProInscription /></div>}
      {vue === "liste" && (
        <>
          <CandidaturesEnLigne dossiers={dossiers} categories={categories} onOuvrir={(d) => setOuvert(d)} />
          {alertes.length > 0 && (
            <div className="pp-bloc">
              <h3>⚠️ Justificatifs à renouveler</h3>
              {alertes.map((a, i) => <p key={i} className="tb-note">{a.nom} · {a.piece} · {a.etat === "expire" ? "expiré" : "expire"} le {a.expire.split("-").reverse().join("/")}</p>)}
            </div>
          )}
          <div className="pp-bloc">
            <div className="tb-actions">
              <button type="button" className="pp-bouton" onClick={nouveau}>+ Ajouter un professionnel</button>
            </div>
            <label className="champ">
              <span>Afficher</span>
              <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
                <option value="tous">Tous ({dossiers.length})</option>
                <option value="a_traiter">À traiter ({compte("soumis") + compte("en_examen")})</option>
                {STATUTS_PRO.map((s) => <option key={s.v} value={s.v}>{s.l} ({compte(s.v)})</option>)}
              </select>
            </label>
            {!liste.length && <p className="tb-note">Aucun professionnel pour l'instant.</p>}
            {liste.map((d) => {
              const pub = fichePublique(d, categories, auj);
              const st = stats[d.id] || {};
              return (
                <button key={d.id} type="button" className="bouton-secondaire" style={{ display: "block", width: "100%", textAlign: "left", margin: "6px 0" }} onClick={() => setOuvert(d)}>
                  <b>{d.nomCommercial}</b>{pub && pub.verifie ? " ✅" : ""}
                  <br />
                  <small>{nomCategorie(categories, d.categorie)} · {d.villes} · {libelleStatutPro(d.statut)} · {libelleFormule(d.formule)}{pub ? " · 🌐 dans l'annuaire" : ""}{st.visites ? ` · 👁 ${st.visites}` : ""}{st.whatsapp ? ` · 💬 ${st.whatsapp}` : ""}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
