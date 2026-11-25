import { useEffect, useMemo, useState } from "react";
import { categoriesVisibles, libelleFormule, lienContactPro, nomCategorie, rechercherPros, villesDesFiches } from "../pricing/pros.js";
import { fermetureEnCours } from "../pricing/assistance.js";
import { compterPro, demanderRdvPro, useAgendaPro, useAnnuairePros, useCategoriesPros, useCellulesPro, useImagesPro } from "../prosBase.js";
import { ajouterJoursDate, creneauxLibres, erreursDemandeClient } from "../pricing/prosAgenda.js";
import { LANGUES_SITE, erreursTraduites, langueDepart, locale, memoriserLangue, nomMetier, sens, traduction } from "../pricing/prosTextes.js";

// ANNUAIRE DES PROFESSIONNELS PARTENAIRES (25 nov. 2026) - #/pros et #/pros/ID
// Page cachée du public jusqu'à l'accord de Rebecca (Réglages -> Pages du site). Rebecca la voit en aperçu dans son
// espace (Professionnels -> Aperçu). Mention « Prestataire indépendant » sur chaque fiche ; aucune demande envoyée
// pendant Chabbat et les fêtes ; Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
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
    <article className="pp-bloc" style={{ padding: 12 }}>
      <button type="button" onClick={onOuvrir} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", width: "100%" }} aria-expanded={ouverte}>
        {img.logo ? <img src={img.logo} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} /> : <span style={{ fontSize: 40 }}>{(categories.find((c) => c.id === f.categorie) || {}).icone || "✨"}</span>}
        <span style={{ flex: 1 }}>
          <strong style={{ fontSize: "1.1em" }}>{f.nomCommercial}</strong>
          {f.verifie && <span title={t.verifieTitre} style={{ marginInlineStart: 6 }}>{t.verifie}</span>}
          <br />
          <small>{[nomMetier(categories.find((c) => c.id === f.categorie), langue) || nomCategorie(categories, f.categorie), f.metier].filter(Boolean).join(" · ")}</small>
          <br />
          <small>📍 {f.villes}{f.zone ? ` · ${f.zone}` : ""}</small>
        </span>
      </button>
      {ouverte && (
        <div style={{ marginTop: 10 }}>
          {(img.photos || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0" }}>
              {img.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 130, borderRadius: 10 }} />)}
            </div>
          )}
          {f.description && <p style={{ whiteSpace: "pre-line" }}>{f.description}</p>}
          {f.prestations && <p style={{ whiteSpace: "pre-line" }}><b>{t.prestations}</b> {f.prestations}</p>}
          <p><b>{t.tarifs}</b> {f.tarifs === "Sur devis" ? t.surDevis : f.tarifs}</p>
          {f.horaires && <p>🕒 {f.horaires}</p>}
          {(f.langues || []).length > 0 && <p>🗣️ {f.langues.join(", ")}</p>}
          {f.siteDigital && <p><a className="lien" href={f.siteDigital} target="_blank" rel="noopener noreferrer">{t.voirPage} ({libelleFormule(f.formule)})</a></p>}
          <Contact fiche={f} t={t} onClic={() => !apercu && compterPro(f.id, "whatsapp")} />
          <ReserverPro f={f} apercu={apercu} t={t} langue={langue} />
          <p className="tb-note" style={{ marginTop: 8 }}>
            <b>{t.independant}</b> {t.independantTexte}
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
  const t = traduction(langue);
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
  const liste = rechercherPros(visibles, filtre);
  const villes = villesDesFiches(visibles);
  const ouvrir = (id) => {
    const suite = ouverte === id ? "" : id;
    setOuverte(suite);
    if (!apercu) window.history.replaceState(null, "", suite ? `#/pros/${suite}` : "#/pros");
  };
  return (
    <section dir={sens(langue)} lang={langue}>
      <div className="pp-bloc">
        <div className="tb-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          {onAccueil ? <button type="button" className="tdb-retour" onClick={onAccueil}>{t.accueil}</button> : <span />}
          <span className="tb-actions">
            {LANGUES_SITE.map((l) => <button key={l.v} type="button" className={langue === l.v ? "pp-bouton" : "bouton-secondaire"} onClick={() => changerLangue(l.v)}>{l.l}</button>)}
          </span>
        </div>
        <h2>{t.titre}</h2>
        <p>{t.intro}</p>
        <label className="champ">
          <span>{t.metier}</span>
          <select value={filtre.categorie} onChange={(e) => setFiltre({ ...filtre, categorie: e.target.value })}>
            <option value="">{t.tousMetiers}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {nomMetier(c, langue)}</option>)}
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
      {liste.map((f) => <Fiche key={f.id} f={f} categories={cats} ouverte={ouverte === f.id} onOuvrir={() => ouvrir(f.id)} apercu={apercu} t={t} langue={langue} />)}
      {!apercu && (
        <div className="pp-bloc">
          <p><b>{t.vousEtesPro}</b> {t.rejoindre}</p>
          <a className="bouton-secondaire" href="#/pro">{t.decouvrir}</a>
        </div>
      )}
    </section>
  );
}
