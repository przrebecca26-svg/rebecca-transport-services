import { useEffect, useMemo, useState } from "react";
import {
  FORMULES_PRO, LANGUES, LIBELLES_ETAT_JUSTIF, STATUTS_PRO, TYPES_JUSTIF, ajouterJournal, alertesJustificatifs, changerStatut, dossierVide,
  erreursDossier, etatJustif, fichePublique, importerCandidature, formuleAvecPage, justificatifsDemandes, libelleFormule, libelleStatutPro, manquePourBadge,
  nomCategorie, normaliserDossier, nouvelIdPro, statutsPossibles, annuairePublic, etatAbonnement, lireAbonnement, livraisonsDuPro, encaisseDe,
  tableauReseau, nouveauCodeInvitation, lienEspacePro, messageInvitationPro, formuleAvecAgenda,
} from "./pricing/pros.js";
import { statsRdv } from "./pricing/prosAgenda.js";
import { bilanEcheances } from "./pricing/digital.js";
import { reduirePhoto } from "./photoReduite.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import {
  aujourdhuiIsrael, enregistrerCategories, enregistrerDossiers, enregistrerImagesPro, enregistrerJustifPhoto, supprimerCandidature, supprimerImagesPro,
  supprimerJustifPhoto, useCandidaturesPros, useCategoriesPros, useDossiersPros, useImagesPro, useJustifPhoto, useStatsPros,
  publierAnnuaire, enregistrerInvitation, supprimerInvitation, useComptesPros, changerStatutCompte, useTousRdvPros, useCollectionAdmin, rattacherLivraison,
} from "./prosBase.js";
import { PARAMS_DEFAUT, bilanLivraisonPartenaire, eligibilitePro } from "./pricing/livraisonPartenaire.js";
import { bilanTrajet } from "./pricing/finCourse.js";
import { enregistrerParamsLivraisonPartenaire, useParamsLivraisonPartenaire } from "./prosBase.js";
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

const shek = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const MOYENS = ["Espèces", "Bit", "Revolut", "PayPal", "Virement", "Carte bancaire"];

// Espace pro (agenda) : invitation liée à l'e-mail du pro, comptes liés, suspension
function EspaceProAdmin({ d, set, sauver, comptes, rdvs }) {
  const [info, setInfo] = useState("");
  const lies = comptes.filter((c) => c.proId === d.id);
  const lien = d.codeInvitation ? lienEspacePro(d.codeInvitation) : "";
  const tel = d.whatsapp || d.telephone;
  const mois = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }).slice(0, 7);
  const st = statsRdv(rdvs.filter((r) => r.proId === d.id), `${mois}-01`, `${mois}-31`);
  const creer = async () => {
    if (!d.compteEmail) return setInfo("Écris d'abord l'adresse e-mail avec laquelle il se connectera.");
    const code = d.codeInvitation || nouveauCodeInvitation();
    try {
      await enregistrerInvitation(code, { proId: d.id, email: d.compteEmail, nom: d.nomCommercial });
      await sauver(ajouterJournal({ ...d, codeInvitation: code }, "Lien de l'espace pro créé"), "✓ Lien créé");
    } catch {
      setInfo("Création impossible : les règles Firebase v37 doivent être publiées.");
    }
    return undefined;
  };
  const retirer = async () => {
    try {
      await supprimerInvitation(d.codeInvitation);
      await sauver(ajouterJournal({ ...d, codeInvitation: "" }, "Lien de l'espace pro retiré"), "✓ Lien retiré");
    } catch {
      setInfo("Impossible pour l'instant.");
    }
  };
  return (
    <>
      <h4>Espace pro et agenda</h4>
      {!formuleAvecAgenda(d.formule, d.formule === "business" ? ["agenda"] : []) && <p className="tb-note">L'agenda en ligne est prévu pour Business (module agenda) et Pack Pro.</p>}
      <label className="champ"><span>E-mail de connexion du pro</span><input type="email" value={d.compteEmail} onChange={(e) => set("compteEmail", e.target.value)} /></label>
      <div className="tb-actions">
        {!d.codeInvitation && <button type="button" className="bouton-secondaire" onClick={creer}>Créer son lien d'espace pro</button>}
        {d.codeInvitation && tel && <a className="pp-bouton" href={lienWhatsApp(tel, messageInvitationPro(d, lien))} target="_blank" rel="noopener noreferrer">💬 Lui envoyer son lien</a>}
        {d.codeInvitation && <button type="button" className="bouton-secondaire" onClick={retirer}>Retirer le lien</button>}
      </div>
      {lien && <p className="tb-note" style={{ wordBreak: "break-all" }}>{lien}</p>}
      {lies.map((c) => (
        <div key={c.uid} className="tb-actions" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>👤 {c.email} · {c.statut === "actif" ? "actif" : "suspendu"}</span>
          <button type="button" className="bouton-secondaire" onClick={() => changerStatutCompte(c.uid, c.statut === "actif" ? "suspendu" : "actif").catch(() => setInfo("Impossible pour l'instant."))}>{c.statut === "actif" ? "Suspendre l'accès" : "Réactiver"}</button>
        </div>
      ))}
      {(st.total > 0 || lies.length > 0) && <p className="tb-note">Ce mois-ci : {st.total} rendez-vous · {st.enLigne} demandés en ligne · {st.termines} terminés · {st.annules} annulés ou refusés</p>}
      {info && <p className="erreur">{info}</p>}
    </>
  );
}

// Abonnement mensuel : montant du devis accepté (recopié par Rebecca), paiements à part des livraisons
function Abonnement({ d, setD }) {
  const ab = lireAbonnement(d.abonnement);
  const [p, setP] = useState({ date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), montant: "", moyen: "Bit" });
  const etat = etatAbonnement(ab, new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }));
  const maj = (x) => setD({ ...d, abonnement: { ...ab, ...x } });
  return (
    <>
      <h4>Abonnement mensuel</h4>
      <label className="case"><input type="checkbox" checked={ab.actif} onChange={() => maj({ actif: !ab.actif })} /><span>Abonnement en cours</span></label>
      <div className="tb-actions">
        <label className="champ"><span>Montant par mois (celui du devis)</span><input type="number" min="0" value={ab.mensuel || ""} onChange={(e) => maj({ mensuel: Number(e.target.value) })} /></label>
        <label className="champ"><span>Depuis le</span><input type="date" value={ab.debut} onChange={(e) => maj({ debut: e.target.value })} /></label>
      </div>
      {etat.actif && <p className="tb-note">{etat.payes} mois payés sur {etat.dus} · encaissé {shek(etat.encaisse)}{etat.retard ? ` · ⚠️ ${etat.retard} mois en retard` : " · à jour"} · prochaine échéance {etat.prochaine.split("-").reverse().join("/")}</p>}
      <div className="tb-actions" style={{ alignItems: "flex-end" }}>
        <label className="champ"><span>Paiement reçu le</span><input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></label>
        <label className="champ"><span>Montant</span><input type="number" min="0" value={p.montant} onChange={(e) => setP({ ...p, montant: e.target.value })} /></label>
        <label className="champ"><span>Moyen</span><select value={p.moyen} onChange={(e) => setP({ ...p, moyen: e.target.value })}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select></label>
        <button type="button" className="bouton-secondaire" onClick={() => Number(p.montant) > 0 && (maj({ paiements: [{ ...p, montant: Number(p.montant) }, ...ab.paiements] }), setP({ ...p, montant: "" }))}>+ Noter</button>
      </div>
      {ab.paiements.map((x, i) => (
        <p key={i} className="tb-note">{x.date.split("-").reverse().join("/")} · {shek(x.montant)} · {x.moyen} <button type="button" className="bouton-secondaire" onClick={() => maj({ paiements: ab.paiements.filter((_, n) => n !== i) })}>✕</button></p>
      ))}
      <p className="tb-note">Pense à « Enregistrer » en bas. Ces paiements restent séparés des livraisons et de la création du site.</p>
    </>
  );
}

// « Deux en un » : courses de Rebecca Services faites pour ce pro (grille du site), comptées à part
function Livraisons({ d, demandes, mouvements }) {
  const params = useParamsLivraisonPartenaire();
  const elig = eligibilitePro(d, params || PARAMS_DEFAUT, aujourdhuiIsrael());
  const [choix, setChoix] = useState("");
  const [info, setInfo] = useState("");
  const miennes = livraisonsDuPro(demandes, d.id);
  const total = miennes.reduce((s, x) => s + encaisseDe(x.id, mouvements), 0);
  const candidates = demandes.filter((x) => !x.proPartenaire && ["livraison", "courses", "demenagement", "transport"].includes(x.service)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40);
  return (
    <>
      <h4>📦 Livraisons Rebecca Services (deux en un)</h4>
      <p className="tb-note">{miennes.length} course(s) · encaissé {shek(total)} · compté à part de son abonnement Digital. {elig.ok ? "✅ A droit à l'avantage « Livraison partenaire » (Devis rapide → Livraison → 🤝)." : `Tarif public : ${elig.raison}`}</p>
      {miennes.slice(0, 10).map((x) => (
        <p key={x.id} className="tb-note">{String(x.date || "").split("-").reverse().join("/")} · {x.serviceTitre || x.service} · {shek(encaisseDe(x.id, mouvements))}{x.livraisonPartenaire && x.livraisonPartenaire.reduction > 0 ? ` · 🤝 −${shek(x.livraisonPartenaire.reduction)}${x.livraisonPartenaire.exception ? " (exception)" : ""}` : x.livraisonPartenaire && x.livraisonPartenaire.statut === "rentabilite" ? " · ⚠️ rentabilité insuffisante, tarif normal" : ""} <button type="button" className="bouton-secondaire" onClick={() => rattacherLivraison(x.id, null).catch(() => setInfo("Impossible."))}>Détacher</button></p>
      ))}
      <div className="tb-actions">
        <select value={choix} onChange={(e) => setChoix(e.target.value)} style={{ flex: 1 }}>
          <option value="">Rattacher une course…</option>
          {candidates.map((x) => <option key={x.id} value={x.id}>{String(x.date || "").split("-").reverse().join("/")} · {x.serviceTitre || x.service} · {x.nom}</option>)}
        </select>
        <button type="button" className="bouton-secondaire" disabled={!choix} onClick={() => rattacherLivraison(choix, d.id).then(() => setChoix("")).catch(() => setInfo("Impossible."))}>Rattacher</button>
      </div>
      {info && <p className="erreur">{info}</p>}
    </>
  );
}

function FicheDossier({ initial, categories, dossiers, stats, onFermer, donnees }) {
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
      <label className="champ">
        <span>Son projet Digital (devis, création, échéances)</span>
        <select value={d.projetDigital} onChange={(e) => set("projetDigital", e.target.value)}>
          <option value="">Aucun</option>
          {(donnees.projets || []).map((p) => <option key={p.id} value={p.id}>{p.nom || p.entreprise || p.id} {p.formule ? `· ${p.formule}` : ""}</option>)}
        </select>
      </label>
      <Abonnement d={d} setD={setD} />
      <EspaceProAdmin d={d} set={set} sauver={sauver} comptes={donnees.comptes} rdvs={donnees.rdvs} />
      <Livraisons d={d} demandes={donnees.demandes || []} mouvements={donnees.mouvements || []} />

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
          <input value={c.nomHe || ""} dir="rtl" placeholder="עברית" onChange={(e) => maj(i, "nomHe", e.target.value)} style={{ flex: 1 }} aria-label="Nom du métier en hébreu" />
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

function TableauReseau({ dossiers, categories, stats, donnees }) {
  const [periode, setPeriode] = useState("mois");
  const auj = aujourdhuiIsrael();
  const bornes = periode === "mois" ? [`${auj.slice(0, 7)}-01`, `${auj.slice(0, 7)}-31`] : periode === "annee" ? [`${auj.slice(0, 4)}-01-01`, `${auj.slice(0, 4)}-12-31`] : ["", "9999-12-31"];
  const recuProjet = (id) => {
    const p = (donnees.projets || []).find((x) => x.id === id);
    return p ? bilanEcheances(p.echeances || [], donnees.mouvements || []).recu : 0;
  };
  const t = tableauReseau({ dossiers, categories, demandes: donnees.demandes || [], mouvements: donnees.mouvements || [], recuProjet, stats, aujourdhui: auj, du: bornes[0], au: bornes[1] });
  return (
    <div className="pp-bloc">
      <div className="tb-actions">
        {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"]].map(([v, l]) => <button key={v} type="button" className={periode === v ? "pp-bouton" : "bouton-secondaire"} onClick={() => setPeriode(v)}>{l}</button>)}
      </div>
      <p><b>Professionnels :</b> {t.actifs} actifs · {t.enAttente} en attente · {t.suspendus} suspendus · {t.refuses} refusés</p>
      <p><b>Formules :</b> {FORMULES_PRO.map((f) => `${f.l} ${t.formules[f.v]}`).join(" · ")}</p>
      <p><b>Abonnements :</b> {t.abonnementsActifs} en cours{t.abonnementsEnRetard.length ? ` · ⚠️ en retard : ${t.abonnementsEnRetard.map((x) => `${x.nom} (${x.retard} mois)`).join(", ")}` : " · tous à jour"}</p>
      <p><b>Justificatifs à renouveler :</b> {t.aRenouveler.length ? t.aRenouveler.map((a) => `${a.nom} (${a.piece})`).join(", ") : "aucun"}</p>
      <h4>Revenus du réseau ({periode === "mois" ? "ce mois" : periode === "annee" ? "cette année" : "depuis le début"})</h4>
      <p>Création Digital : <b>{shek(t.revenusDigital)}</b> <small>(total encaissé sur les projets reliés)</small></p>
      <p>Abonnements : <b>{shek(t.revenusAbonnements)}</b></p>
      <p>Livraisons partenaires : <b>{shek(t.revenusLivraisons)}</b></p>
      <p>Total : <b>{shek(t.total)}</b></p>
      <p className="tb-note">Trois comptes séparés : la création Digital et les abonnements ne se mélangent jamais avec les livraisons. Les dépenses (essence…) des livraisons restent dans Finances et Statistiques.</p>
      <h4>Par professionnel</h4>
      {t.lignes.map((l) => <p key={l.id} className="tb-note"><b>{l.nom}</b> · {l.formule} · Digital {shek(l.digital)} · abonnement {shek(l.abonnementPeriode)} · livraisons {l.livraisons} ({shek(l.livraisonsEncaisse)}) · 👁 {l.visites} · 💬 {l.clics}</p>)}
    </div>
  );
}

// 25 nov. 2026 (21h42) : rubrique « Livraison partenaire » - réglages, réductions accordées, livraisons, rentabilité par pro
function LivraisonPartenaire({ dossiers, donnees }) {
  const lus = useParamsLivraisonPartenaire();
  const [p, setP] = useState(null);
  const [info, setInfo] = useState("");
  const [periode, setPeriode] = useState("mois");
  useEffect(() => { if (lus && !p) setP(lus); }, [lus]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || !donnees.demandes || !donnees.mouvements) return <p className="tb-note">Chargement…</p>;
  const auj = aujourdhuiIsrael();
  const bornes = periode === "mois" ? [`${auj.slice(0, 7)}-01`, `${auj.slice(0, 7)}-31`] : periode === "annee" ? [`${auj.slice(0, 4)}-01-01`, `${auj.slice(0, 4)}-12-31`] : ["", "9999-12-31"];
  const b = bilanLivraisonPartenaire({ dossiers, demandes: donnees.demandes, mouvements: donnees.mouvements, params: p, aujourdhui: auj, du: bornes[0], au: bornes[1], encaisseDe, bilan: bilanTrajet });
  const basculer = (f) => setP({ ...p, formules: p.formules.includes(f) ? p.formules.filter((x) => x !== f) : [...p.formules, f] });
  const sauver = async () => {
    try {
      await enregistrerParamsLivraisonPartenaire(p);
      setInfo("✓ Réglages enregistrés");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
  };
  const ph = (x) => (x == null ? "—" : `${x} ₪/h`);
  return (
    <>
      {b.alertes.length > 0 && (
        <div className="pp-bloc">
          <h3>⚠️ Alertes ({b.alertes.length})</h3>
          {b.alertes.map((a, i) => <p key={a.id + i} className="erreur">{String(a.date || "").split("-").reverse().join("/")} · {a.nom} · {a.texte}</p>)}
        </div>
      )}
      <div className="pp-bloc">
        <h3>🤝 Livraison partenaire</h3>
        <div className="tb-actions">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"]].map(([v, l]) => <button key={v} type="button" className={periode === v ? "pp-bouton" : "bouton-secondaire"} onClick={() => setPeriode(v)}>{l}</button>)}
        </div>
        <p>Livraisons réalisées : <b>{b.livraisons}</b> · avec avantage : <b>{b.avecAvantage}</b></p>
        <p>Réductions accordées : <b>{shek(b.reductions)}</b></p>
        <p>Encaissé sur ces livraisons : <b>{shek(b.encaisse)}</b> <small>(compté à part des abonnements et du Digital)</small></p>
        <h4>Par professionnel</h4>
        {!b.lignes.length && <p className="tb-note">Aucun professionnel concerné pour l'instant.</p>}
        {b.lignes.map((l) => (
          <p key={l.id} className="tb-note">
            <b>{l.nom}</b> · {libelleFormule(l.formule)} · {l.eligible ? "✅ avantage" : `tarif public (${l.raison.replace(/ : tarif public\.?$/, "")})`}
            <br />{l.livraisons} livraison(s) faite(s){l.aVenir ? ` · ${l.aVenir} à venir` : ""} · réductions {shek(l.reductions)}{l.exceptions ? ` (dont ${l.exceptions} exception${l.exceptions > 1 ? "s" : ""})` : ""} · encaissé {shek(l.encaisse)} · rentabilité réelle {ph(l.gainHeureReel)} · prévue {ph(l.gainHeurePrevu)}
          </p>
        ))}
      </div>
      <div className="pp-bloc">
        <h3>⚙️ Réglages</h3>
        <label className="case"><input type="checkbox" checked={p.actif} onChange={() => setP({ ...p, actif: !p.actif })} /><span>Formule « Livraison partenaire » active</span></label>
        <p className="tb-note">Formules qui ont l'avantage :</p>
        <div className="tb-actions">
          {FORMULES_PRO.map((f) => <label key={f.v} className="case"><input type="checkbox" checked={p.formules.includes(f.v)} onChange={() => basculer(f.v)} /><span>{f.l}</span></label>)}
        </div>
        <p className="tb-note">Avantage partenaire (26 nov. 2026) : une réduction en % sur le tarif public de la livraison, jusqu'à une distance maximum ; au-delà : grille normale.</p>
        <div className="tb-actions" style={{ alignItems: "flex-end" }}>
          <label className="champ"><span>Réduction (%)</span><input type="number" min="0" max="50" value={Math.round((p.pourcentage || 0) * 100)} onChange={(e) => setP({ ...p, version: 2, pourcentage: Number(e.target.value) / 100 })} /></label>
          <label className="champ"><span>Jusqu'à (km)</span><input type="number" min="0.5" step="0.5" value={p.kmMax || 20} onChange={(e) => setP({ ...p, version: 2, kmMax: Number(e.target.value) })} /></label>
        </div>
        <div className="tb-actions">
          <label className="champ"><span>Tarif minimum (₪)</span><input type="number" min="0" value={p.minimum} onChange={(e) => setP({ ...p, minimum: Number(e.target.value) })} /></label>
          <label className="champ"><span>Rentabilité minimum (₪/h)</span><input type="number" min="0" value={p.seuilHeure} onChange={(e) => setP({ ...p, seuilHeure: Number(e.target.value) })} /></label>
        </div>
        <p className="tb-note">Conditions : abonnement actif et à jour · suppléments habituels maintenus · non cumulable avec les promotions et le 💛 Prix ami · aucun volume minimum. Sous la rentabilité minimum, le tarif normal est proposé ; tu peux autoriser la réduction dans le devis.</p>
        <button type="button" className="pp-bouton" onClick={sauver}>Enregistrer</button>
        {info && <p className="tb-note" role="status">{info}</p>}
      </div>
    </>
  );
}

export default function ProsAdmin() {
  const dossiers = useDossiersPros();
  const categories = useCategoriesPros();
  const stats = useStatsPros(true);
  const comptes = useComptesPros(true);
  const rdvs = useTousRdvPros(true);
  const demandes = useCollectionAdmin("demandes", true);
  const mouvements = useCollectionAdmin("mouvements", true);
  const projets = useCollectionAdmin("projetsDigital", true);
  const donnees = useMemo(() => ({ comptes, rdvs, demandes, mouvements, projets }), [comptes, rdvs, demandes, mouvements, projets]);
  const [publie, setPublie] = useState(null);
  // À chaque ouverture : l'annuaire public est remis à jour (badges expirés, métiers cachés) ou vidé si la page est cachée
  const pret = !!(dossiers && categories);
  useEffect(() => {
    if (pret) publierAnnuaire(dossiers, categories).then(setPublie).catch(() => {});
  }, [pret]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vue, setVue] = useState("liste");
  const [ouvert, setOuvert] = useState(null);
  const [filtre, setFiltre] = useState("tous");
  if (!dossiers || !categories) return <p className="tb-note">Chargement…</p>;
  if (ouvert) return <FicheDossier key={ouvert.id} initial={ouvert} categories={categories} dossiers={dossiers} stats={stats} donnees={donnees} onFermer={() => setOuvert(null)} />;
  const auj = aujourdhuiIsrael();
  const alertes = alertesJustificatifs(dossiers, auj);
  const compte = (s) => dossiers.filter((d) => d.statut === s).length;
  const liste = dossiers.filter((d) => filtre === "tous" || d.statut === filtre || (filtre === "a_traiter" && ["soumis", "en_examen"].includes(d.statut)));
  const nouveau = () => setOuvert({ ...dossierVide(), id: nouvelIdPro(), statut: "en_examen", creeLeMs: Date.now(), journal: [{ leMs: Date.now(), texte: "Dossier créé par Rebecca" }] });
  return (
    <section>
      <div className="pp-bloc">
        <h2>✨ Professionnels partenaires</h2>
        <p className="tb-note">{publie && publie.visible ? `Annuaire ouvert au public : ${publie.nombre} fiche(s) publiée(s).` : "Annuaire caché du public : aucune fiche n'est publiée (même dans les données). Tu le vois en aperçu ici. Pour l'ouvrir : Réglages → Pages du site → « Annuaire des professionnels partenaires », puis reviens ici."}</p>
        <div className="tb-actions">
          {[["liste", "Dossiers"], ["reseau", "📊 Réseau"], ["livraison", "🤝 Livraison partenaire"], ["metiers", "Métiers"], ["apercu", "👁 Aperçu annuaire"], ["inscription", "👁 Aperçu inscription"]].map(([v, l]) => (
            <button key={v} type="button" className={vue === v ? "pp-bouton" : "bouton-secondaire"} onClick={() => setVue(v)}>{l}</button>
          ))}
        </div>
      </div>
      {vue === "metiers" && <Metiers categories={categories} dossiers={dossiers} />}
      {vue === "apercu" && <ProsAnnuaire apercu fichesApercu={annuairePublic(dossiers, categories, aujourdhuiIsrael())} />}
      {vue === "livraison" && <LivraisonPartenaire dossiers={dossiers} donnees={donnees} />}
      {vue === "reseau" && <TableauReseau dossiers={dossiers} categories={categories} stats={stats} donnees={donnees} />}
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
