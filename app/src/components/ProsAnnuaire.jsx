import { Fragment, useEffect, useMemo, useState } from "react";
import { categoriesVisibles, libelleFormule, lienContactPro, nomCategorie, rechercherPros, villesDesFiches } from "../pricing/pros.js";
import { fermetureEnCours } from "../pricing/assistance.js";
import { compterPro, demanderRdvPro, useAgendaPro, useAnnuairePros, useCategoriesPros, useCellulesPro, useImagesPro } from "../prosBase.js";
import { useHebreuPros } from "../prosBase.js";
import { useAccueilV2 } from "../accueilV2Base.js";
import { prestationDeFiche } from "../pricing/recherche.js";
import "../partenariat.css";
import { ajouterJoursDate, creneauxLibres, erreursDemandeClient } from "../pricing/prosAgenda.js";
import { LANGUES_SITE, erreursTraduites, langueDepart, locale, memoriserLangue, nomMetier, sens, traduction } from "../pricing/prosTextes.js";

// ANNUAIRE DES PROFESSIONNELS PARTENAIRES (25 nov. 2026) - #/pros et #/pros/ID
// Page cachée du public jusqu'à l'accord de Rebecca (Réglages -> Pages du site). Rebecca la voit en aperçu dans son
// espace (Professionnels -> Aperçu). Mention « Prestataire indépendant » sur chaque fiche ; aucune demande envoyée
// pendant Chabbat et les fêtes ; Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
// Logos des activités de Rebecca (ses vraies images) quand la fiche n'a pas encore de logo
const LOGOS_RS = { nails: "/brand/logo-nails-prestige.png", hair: "/brand/logo-prestige-hair.png", regenx: "/brand/logo-regenx.png", slim: "/brand/logo-prestige-slim-lift.png", epoxy: "/brand/logo-epoxy.png", digital: "/brand/logo-digital-applications.png" };
const idDansLien = (h) => (/^#\/pros\/([A-Za-z0-9_-]{2,30})$/.exec(h || "") || [])[1] || "";

// 25 nov. 2026, 20h23 (Rebecca) : pas de blocage Chabbat pour les pros (seul l'agenda de Rebecca Services est fermé)
function Contact({ fiche, onClic, t }) {
  const c = lienContactPro(fiche, null, { texte: t.msgContact(fiche.nomCommercial) });
  const r = lienContactPro(fiche, null, { rdv: true, texte: t.msgRdv(fiche.nomCommercial) });
  if (!c.lien) return <p className="tb-note" role="status">{t.pasDeNumero}</p>;
  return (
    <div className="tb-actions">
      <a className="pp-bouton" href={c.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>{t.contacter}</a>
      <a className="bouton-secondaire" href={r.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>{t.demanderRdv}</a>
    </div>
  );
}

// Réservation en ligne (agenda Business ou Pack Pro) : la cliente DEMANDE, le professionnel confirme par WhatsApp.
// Jamais deux fois le même créneau. Chabbat et fêtes : seulement si le pro a choisi de fermer.
function ReserverPro({ f, apercu, t, langue }) {
  const agenda = useAgendaPro(f.id);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ prestation: "", date: "", heure: "", nom: "", telephone: "", note: "" });
  const [e, setE] = useState({});
  const [etat, setEtat] = useState("");
  const cellules = useCellulesPro(ouvert ? f.id : "", form.date);
  if (!agenda || !agenda.actif || !agenda.enLigne) return null;
  const prestations = agenda.prestations.filter((p) => p.enLigne);
  if (!prestations.length) return null;
  const p = prestations.find((x) => x.nom === form.prestation);
  const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const jours = Array.from({ length: Math.min(agenda.joursMax, 30) }, (_, i) => ajouterJoursDate(auj, i));
  const heures = p && form.date && cellules ? creneauxLibres(agenda, form.date, p.duree, { cellules, enLigne: true }) : [];
  // le pro qui a choisi de fermer pendant Chabbat et les fêtes : aucune demande envoyée à ce moment-là
  const ferme = agenda.fermeChabbat ? fermetureEnCours() : null;
  const envoyer = async () => {
    const err = erreursTraduites(erreursDemandeClient(form), t);
    setE(err);
    if (Object.keys(err).length || !p) return;
    if (ferme) return setEtat(t.ferme(ferme.label));
    if (apercu) return setEtat(t.apercu);
    setEtat("envoi");
    try {
      await demanderRdvPro(f.id, form, p, agenda);
      setEtat("ok");
    } catch (x) {
      setEtat(x && x.message === "pris" ? t.pris : t.impossible);
      setForm({ ...form, heure: "" });
    }
    return undefined;
  };
  if (etat === "ok") return <p className="tb-note" role="status">{t.envoye(f.nomCommercial)}</p>;
  if (!ouvert) return <button type="button" className="bouton-secondaire" onClick={() => setOuvert(true)}>{t.reserver}</button>;
  return (
    <div className="pp-bloc" style={{ padding: 10 }}>
      <label className="champ"><span>{t.prestation}</span>
        <select value={form.prestation} onChange={(x) => setForm({ ...form, prestation: x.target.value, heure: "" })}>
          <option value="">Choisir…</option>
          {prestations.map((x) => <option key={x.id} value={x.nom}>{x.nom} · {x.duree} min{x.prix ? ` · ${x.prix}` : ""}</option>)}
        </select>
        {e.prestation && <span className="erreur">{e.prestation}</span>}
      </label>
      <label className="champ"><span>{t.jour}</span>
        <select value={form.date} onChange={(x) => setForm({ ...form, date: x.target.value, heure: "" })}>
          <option value="">Choisir…</option>
          {jours.map((d) => <option key={d} value={d}>{new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(langue), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</option>)}
        </select>
      </label>
      {p && form.date && (
        <div className="champ">
          <span>{t.heure}</span>
          {!cellules ? <span className="aide">{t.chargement}</span> : heures.length ? (
            <div className="tb-actions">{heures.map((h) => <button key={h} type="button" className={form.heure === h ? "pp-bouton" : "bouton-secondaire"} onClick={() => setForm({ ...form, heure: h })}>{h.replace(":", "h")}</button>)}</div>
          ) : <span className="aide">{t.aucunCreneau}</span>}
          {e.heure && <span className="erreur">{e.heure}</span>}
        </div>
      )}
      <label className="champ"><span>{t.votreNom}</span><input value={form.nom} onChange={(x) => setForm({ ...form, nom: x.target.value })} />{e.nom && <span className="erreur">{e.nom}</span>}</label>
      <label className="champ"><span>{t.votreTel}</span><input type="tel" value={form.telephone} onChange={(x) => setForm({ ...form, telephone: x.target.value })} />{e.telephone && <span className="erreur">{e.telephone}</span>}</label>
      <label className="champ"><span>{t.message}</span><input value={form.note} onChange={(x) => setForm({ ...form, note: x.target.value })} /></label>
      <button type="button" className="pp-bouton" disabled={etat === "envoi"} onClick={envoyer}>{etat === "envoi" ? t.envoi : t.envoyer}</button>
      {etat && etat !== "envoi" && <p className="tb-note" role="status">{etat}</p>}
      <p className="tb-note">{t.confidentialite}</p>
    </div>
  );
}

function Fiche({ f, categories, ouverte, onOuvrir, apercu, t, langue }) {
  const img = useImagesPro(f.id);
  useEffect(() => {
    if (ouverte && !apercu) compterPro(f.id, "visites");
  }, [ouverte, f.id, apercu]);
  return (
    <article className={"pp-bloc" + (f.activiteRS ? " pp-fiche-rs" : "")} style={{ padding: 12 }}>
      <button type="button" onClick={onOuvrir} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", width: "100%" }} aria-expanded={ouverte}>
        {img.logo || (f.activiteRS && LOGOS_RS[prestationDeFiche(f)]) ? <img src={img.logo || LOGOS_RS[prestationDeFiche(f)]} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: f.activiteRS ? "50%" : 12 }} /> : <span style={{ fontSize: 40 }}>{(categories.find((c) => c.id === f.categorie) || {}).icone || "✨"}</span>}
        <span style={{ flex: 1 }}>
          <strong style={{ fontSize: "1.1em" }}><bdi>{f.nomCommercial}</bdi></strong>
          {f.verifie && <span title={t.verifieTitre} style={{ marginInlineStart: 6 }}>{t.verifie}</span>}
          {f.activiteRS && <small className="pp-badge-rs">{t.activiteRS}</small>}
          <br />
          <small>{[nomMetier(categories.find((c) => c.id === f.categorie), langue) || nomCategorie(categories, f.categorie), f.metier].filter(Boolean).map((x, i) => <Fragment key={i}>{i > 0 && " · "}<bdi>{x}</bdi></Fragment>)}</small>
          <br />
          <small>📍 <bdi>{Array.isArray(f.villes) ? f.villes.join(", ") : f.villes}</bdi>{f.zone ? <> · <bdi>{f.zone}</bdi></> : ""}</small>
        </span>
      </button>
      {ouverte && (
        <div style={{ marginTop: 10 }}>
          {(img.photos || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0" }}>
              {img.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 130, borderRadius: 10 }} />)}
            </div>
          )}
          {f.description && <p dir="auto" style={{ whiteSpace: "pre-line" }}>{f.description}</p>}
          {f.prestations && <p style={{ whiteSpace: "pre-line" }}><b>{t.prestations}</b> <bdi style={{ whiteSpace: "pre-line" }}>{f.prestations}</bdi></p>}
          <p><b>{t.tarifs}</b> {f.tarifs === "Sur devis" ? t.surDevis : <bdi>{f.tarifs}</bdi>}</p>
          {f.horaires && <p>🕒 <bdi>{f.horaires}</bdi></p>}
          {(f.langues || []).length > 0 && <p>🗣️ {f.langues.map((l) => (t.nomsLangues && t.nomsLangues[l]) || l).join(", ")}</p>}
          {f.siteDigital && <p><a className="lien" href={f.siteDigital} target="_blank" rel="noopener noreferrer">{t.voirPage} ({libelleFormule(f.formule)})</a></p>}
          {(f.instagram || f.facebook || f.siteWeb) && (
            <p>{t.reseaux}{" "}
              {[["instagram", t.instagram], ["facebook", t.facebook], ["siteWeb", t.siteWeb]].filter(([k]) => f[k]).map(([k, l], i) => <Fragment key={k}>{i > 0 && " · "}<a className="lien" href={f[k]} target="_blank" rel="noopener noreferrer">{l}</a></Fragment>)}
            </p>
          )}
          {f.activiteRS && <p><a className="pp-bouton" href={prestationDeFiche(f) ? `#/rs/${prestationDeFiche(f)}` : "https://rebeccaservices.com"}>{prestationDeFiche(f) ? "Voir les prestations, les tarifs et réserver" : t.voirSiteRS}</a></p>}
          <Contact fiche={f} t={t} onClic={() => !apercu && compterPro(f.id, "whatsapp")} />
          <ReserverPro f={f} apercu={apercu} t={t} langue={langue} />
          <p className="tb-note" style={{ marginTop: 8 }}>
            {f.activiteRS ? <><b>{t.activiteRS}.</b> {t.activiteRSTexte}</> : <><b>{t.independant}</b> {t.independantTexte}</>}
            {f.verifie ? ` ${t.verifieTexte}` : ""}
          </p>
        </div>
      )}
    </article>
  );
}

export default function ProsAnnuaire({ onAccueil, apercu = false, fichesApercu = null }) {
  const publiques = useAnnuairePros();
  // Aperçu de Rebecca : calculé depuis ses dossiers privés (l'annuaire public reste vide tant que la page est cachée)
  const fiches = fichesApercu || publiques;
  const categories = useCategoriesPros();
  const [filtre, setFiltre] = useState({ categorie: "", ville: "", texte: "" });
  const [langue, setLangue] = useState(langueDepart);
  const hebreu = useHebreuPros(); // 26 nov. 2026 : hébreu caché tant que Rebecca ne l'active pas
  const langueVue = hebreu ? langue : "fr";
  const t = traduction(langueVue);
  const changerLangue = (l) => {
    setLangue(l);
    memoriserLangue(l);
  };
  const [ouverte, setOuverte] = useState(() => idDansLien(window.location.hash));
  useEffect(() => {
    if (apercu) return undefined;
    const suivre = () => setOuverte(idDansLien(window.location.hash));
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, [apercu]);
  const cats = categoriesVisibles(categories || []);
  // une fiche d'un metier cache n'apparait jamais, meme si la liste publique n'est pas encore a jour
  const visibles = useMemo(() => (fiches || []).filter((f) => cats.some((c) => c.id === f.categorie)), [fiches, cats]);
  const accueil = useAccueilV2();
  const liste = rechercherPros(visibles, filtre, accueil ? accueil.prioriteRS : []);
  const villes = villesDesFiches(visibles);
  const ouvrir = (id) => {
    const suite = ouverte === id ? "" : id;
    setOuverte(suite);
    if (!apercu) window.history.replaceState(null, "", suite ? `#/pros/${suite}` : "#/pros");
  };
  return (
    <section dir={sens(langueVue)} lang={langueVue}>
      <div className="pp-bloc">
        <div className="tb-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          {onAccueil ? <button type="button" className="tdb-retour" onClick={onAccueil}>{t.accueil}</button> : <span />}
          <span className="tb-actions">
            {(hebreu ? LANGUES_SITE : []).map((l) => <button key={l.v} type="button" className={langueVue === l.v ? "pp-bouton" : "bouton-secondaire"} onClick={() => changerLangue(l.v)}>{l.l}</button>)}
          </span>
        </div>
        <h2>{t.titre}</h2>
        <p>{t.intro}</p>
        <label className="champ">
          <span>{t.metier}</span>
          <select value={filtre.categorie} onChange={(e) => setFiltre({ ...filtre, categorie: e.target.value })}>
            <option value="">{t.tousMetiers}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {nomMetier(c, langueVue)}</option>)}
          </select>
        </label>
        <label className="champ">
          <span>{t.ville}</span>
          <input list="pros-villes" value={filtre.ville} placeholder={t.exVille} onChange={(e) => setFiltre({ ...filtre, ville: e.target.value })} />
          <datalist id="pros-villes">{villes.map((v) => <option key={v} value={v} />)}</datalist>
        </label>
        <label className="champ">
          <span>{t.recherche}</span>
          <input value={filtre.texte} placeholder={t.exRecherche} onChange={(e) => setFiltre({ ...filtre, texte: e.target.value })} />
        </label>
        {!fiches && <p className="tb-note">{t.chargement}</p>}
        {fiches && !liste.length && <p className="tb-note">{visibles.length ? t.aucunResultat : t.bientot}</p>}
      </div>
      {liste.map((f) => <Fiche key={f.id} f={f} categories={cats} ouverte={ouverte === f.id} onOuvrir={() => ouvrir(f.id)} apercu={apercu} t={t} langue={langueVue} />)}
      {!apercu && (
        <div className="pp-bloc">
          <p><b>{t.vousEtesPro}</b> {t.rejoindre}</p>
          <a className="bouton-secondaire" href="#/pro">{t.decouvrir}</a>
        </div>
      )}
    </section>
  );
}
