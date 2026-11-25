import { useEffect, useMemo, useState } from "react";
import { categoriesVisibles, libelleFormule, lienContactPro, nomCategorie, rechercherPros, villesDesFiches } from "../pricing/pros.js";
import { fermetureEnCours } from "../pricing/assistance.js";
import { compterPro, demanderRdvPro, useAgendaPro, useAnnuairePros, useCategoriesPros, useCellulesPro, useImagesPro } from "../prosBase.js";
import { ajouterJoursDate, creneauxLibres, erreursDemandeClient } from "../pricing/prosAgenda.js";

// ANNUAIRE DES PROFESSIONNELS PARTENAIRES (25 nov. 2026) - #/pros et #/pros/ID
// Page cachée du public jusqu'à l'accord de Rebecca (Réglages -> Pages du site). Rebecca la voit en aperçu dans son
// espace (Professionnels -> Aperçu). Mention « Prestataire indépendant » sur chaque fiche ; aucune demande envoyée
// pendant Chabbat et les fêtes ; Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
const idDansLien = (h) => (/^#\/pros\/([A-Za-z0-9_-]{2,30})$/.exec(h || "") || [])[1] || "";

// 25 nov. 2026, 20h23 (Rebecca) : pas de blocage Chabbat pour les pros (seul l'agenda de Rebecca Services est fermé)
function Contact({ fiche, onClic }) {
  const c = lienContactPro(fiche, null);
  const r = lienContactPro(fiche, null, { rdv: true });
  if (!c.lien) return <p className="tb-note" role="status">{c.message}</p>;
  return (
    <div className="tb-actions">
      <a className="pp-bouton" href={c.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>💬 Contacter</a>
      <a className="bouton-secondaire" href={r.lien} target="_blank" rel="noopener noreferrer" onClick={onClic}>📅 Demander un rendez-vous</a>
    </div>
  );
}

// Réservation en ligne (agenda Business ou Pack Pro) : la cliente DEMANDE, le professionnel confirme par WhatsApp.
// Jamais deux fois le même créneau. Chabbat et fêtes : seulement si le pro a choisi de fermer.
function ReserverPro({ f, apercu }) {
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
    const err = erreursDemandeClient(form);
    setE(err);
    if (Object.keys(err).length || !p) return;
    if (ferme) return setEtat(`Les demandes ne sont pas envoyées pendant ${ferme.label || "Chabbat et les fêtes"}.`);
    if (apercu) return setEtat("Aperçu : rien n'est envoyé d'ici.");
    setEtat("envoi");
    try {
      await demanderRdvPro(f.id, form, p, agenda);
      setEtat("ok");
    } catch (x) {
      setEtat(x && x.message === "pris" ? "Ce créneau vient d'être pris : choisissez-en un autre." : "Envoi impossible pour l'instant. Contactez le professionnel sur WhatsApp.");
      setForm({ ...form, heure: "" });
    }
    return undefined;
  };
  if (etat === "ok") return <p className="tb-note" role="status">✓ Demande envoyée à {f.nomCommercial}. Le rendez-vous n'est confirmé que lorsque le professionnel vous répond (WhatsApp).</p>;
  if (!ouvert) return <button type="button" className="bouton-secondaire" onClick={() => setOuvert(true)}>🗓️ Réserver en ligne</button>;
  return (
    <div className="pp-bloc" style={{ padding: 10 }}>
      <label className="champ"><span>Prestation</span>
        <select value={form.prestation} onChange={(x) => setForm({ ...form, prestation: x.target.value, heure: "" })}>
          <option value="">Choisir…</option>
          {prestations.map((x) => <option key={x.id} value={x.nom}>{x.nom} · {x.duree} min{x.prix ? ` · ${x.prix}` : ""}</option>)}
        </select>
        {e.prestation && <span className="erreur">{e.prestation}</span>}
      </label>
      <label className="champ"><span>Jour</span>
        <select value={form.date} onChange={(x) => setForm({ ...form, date: x.target.value, heure: "" })}>
          <option value="">Choisir…</option>
          {jours.map((d) => <option key={d} value={d}>{new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</option>)}
        </select>
      </label>
      {p && form.date && (
        <div className="champ">
          <span>Heure</span>
          {!cellules ? <span className="aide">Chargement…</span> : heures.length ? (
            <div className="tb-actions">{heures.map((h) => <button key={h} type="button" className={form.heure === h ? "pp-bouton" : "bouton-secondaire"} onClick={() => setForm({ ...form, heure: h })}>{h.replace(":", "h")}</button>)}</div>
          ) : <span className="aide">Aucun créneau libre ce jour-là.</span>}
          {e.heure && <span className="erreur">{e.heure}</span>}
        </div>
      )}
      <label className="champ"><span>Votre nom</span><input value={form.nom} onChange={(x) => setForm({ ...form, nom: x.target.value })} />{e.nom && <span className="erreur">{e.nom}</span>}</label>
      <label className="champ"><span>Votre téléphone</span><input type="tel" value={form.telephone} onChange={(x) => setForm({ ...form, telephone: x.target.value })} />{e.telephone && <span className="erreur">{e.telephone}</span>}</label>
      <label className="champ"><span>Message (facultatif)</span><input value={form.note} onChange={(x) => setForm({ ...form, note: x.target.value })} /></label>
      <button type="button" className="pp-bouton" disabled={etat === "envoi"} onClick={envoyer}>{etat === "envoi" ? "Envoi…" : "Envoyer ma demande"}</button>
      {etat && etat !== "envoi" && <p className="tb-note" role="status">{etat}</p>}
      <p className="tb-note">Vos nom et téléphone sont transmis uniquement à ce professionnel. Le rendez-vous et son paiement se règlent directement avec lui.</p>
    </div>
  );
}

function Fiche({ f, categories, ouverte, onOuvrir, apercu }) {
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
          {f.verifie && <span title="Documents contrôlés par Rebecca Services" style={{ marginLeft: 6 }}>✅ Partenaire vérifié</span>}
          <br />
          <small>{[nomCategorie(categories, f.categorie), f.metier].filter(Boolean).join(" · ")}</small>
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
          {f.prestations && <p style={{ whiteSpace: "pre-line" }}><b>Prestations :</b> {f.prestations}</p>}
          <p><b>Tarifs :</b> {f.tarifs}</p>
          {f.horaires && <p>🕒 {f.horaires}</p>}
          {(f.langues || []).length > 0 && <p>🗣️ {f.langues.join(", ")}</p>}
          {f.siteDigital && <p><a className="lien" href={f.siteDigital} target="_blank" rel="noopener noreferrer">🌐 Voir sa page ({libelleFormule(f.formule)})</a></p>}
          <Contact fiche={f} onClic={() => !apercu && compterPro(f.id, "whatsapp")} />
          <ReserverPro f={f} apercu={apercu} />
          <p className="tb-note" style={{ marginTop: 8 }}>
            <b>Prestataire indépendant.</b> Ce professionnel réalise lui-même ses prestations, sous sa responsabilité. Rebecca Services ne réalise pas ces prestations et n'en encaisse pas le prix.
            {f.verifie ? " Le label « Partenaire vérifié » indique que des documents ont été contrôlés ; ce n'est pas une garantie de résultat." : ""}
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
    <section>
      <div className="pp-bloc">
        {onAccueil && <button type="button" className="tdb-retour" onClick={onAccueil}>← Accueil</button>}
        <h2>✨ Professionnels partenaires</h2>
        <p>Des professionnels indépendants recommandés en Israël : beauté, ménage, travaux, traiteurs, événements… Contactez-les directement.</p>
        <label className="champ">
          <span>Métier</span>
          <select value={filtre.categorie} onChange={(e) => setFiltre({ ...filtre, categorie: e.target.value })}>
            <option value="">Tous les métiers</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
          </select>
        </label>
        <label className="champ">
          <span>Ville</span>
          <input list="pros-villes" value={filtre.ville} placeholder="ex. Netanya" onChange={(e) => setFiltre({ ...filtre, ville: e.target.value })} />
          <datalist id="pros-villes">{villes.map((v) => <option key={v} value={v} />)}</datalist>
        </label>
        <label className="champ">
          <span>Recherche</span>
          <input value={filtre.texte} placeholder="ex. manucure, plombier, gâteaux" onChange={(e) => setFiltre({ ...filtre, texte: e.target.value })} />
        </label>
        {!fiches && <p className="tb-note">Chargement…</p>}
        {fiches && !liste.length && <p className="tb-note">{visibles.length ? "Aucun professionnel ne correspond à votre recherche." : "Bientôt ici : nos professionnels partenaires."}</p>}
      </div>
      {liste.map((f) => <Fiche key={f.id} f={f} categories={cats} ouverte={ouverte === f.id} onOuvrir={() => ouvrir(f.id)} apercu={apercu} />)}
      {!apercu && (
        <div className="pp-bloc">
          <p><b>Vous êtes professionnel en Israël ?</b> Rejoignez l'annuaire.</p>
          <a className="bouton-secondaire" href="#/pro">Découvrir les formules</a>
        </div>
      )}
    </section>
  );
}
