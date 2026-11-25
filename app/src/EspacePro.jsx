import { useState } from "react";
import {
  JOURS_SEMAINE, agendaVide, ajouterJoursDate, changerStatutRdv, conflitRdv, erreursAgenda, libelleStatutRdv, lienWhatsAppClient, lireAgenda,
  messageRdv, rappelsDeDemain, rdvDuJour, rdvVide, statsRdv, statutsRdvPossibles,
} from "./pricing/prosAgenda.js";
import { WHATSAPP } from "./contact.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { aujourdhuiIsrael, enregistrerAgendaPro, enregistrerRdvPro, marquerRappel, supprimerRdvPro, useAgendaPro, useRdvPro } from "./prosBase.js";

// ESPACE D'UN PROFESSIONNEL PARTENAIRE (Business avec agenda, Pack Pro) - 25 nov. 2026
// Sur son téléphone : son agenda (jour par jour), les demandes de ses clientes à confirmer, ses rendez-vous manuels,
// ses horaires, congés et prestations, les rappels de demain, et la livraison par Rebecca Services (« deux en un »).
// Il ne voit QUE ses propres données (règles v37). Rebecca Services n'encaisse pas le prix de ses prestations.
const jourCourt = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function FormRdv({ initial, agenda, rdvs, proId, nom, onFin }) {
  const [r, setR] = useState(initial);
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const deplace = initial.id && (initial.date !== r.date || initial.heure !== r.heure);
  const choisirPrestation = (nomP) => {
    const p = agenda.prestations.find((x) => x.nom === nomP);
    setR({ ...r, prestation: nomP, duree: p ? p.duree : r.duree });
  };
  const sauver = async () => {
    const c = conflitRdv(r, rdvs, agenda);
    if (c) return setInfo(c);
    setEnCours(true);
    try {
      await enregistrerRdvPro(proId, { ...r, statut: r.statut === "demande" ? "confirme" : r.statut }, rdvs, agenda);
      onFin(deplace && r.client.telephone ? lienWhatsAppClient(r.client.telephone, messageRdv("modification", r, nom)) : "");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
    return undefined;
  };
  return (
    <div className="pp-bloc">
      <h3>{initial.id ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</h3>
      <label className="champ"><span>Prestation</span>
        <select value={r.prestation} onChange={(e) => choisirPrestation(e.target.value)}>
          <option value="">Autre…</option>
          {agenda.prestations.map((p) => <option key={p.id} value={p.nom}>{p.nom} ({p.duree} min)</option>)}
        </select>
      </label>
      <div className="tb-actions">
        <label className="champ"><span>Jour</span><input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} /></label>
        <label className="champ"><span>Heure</span><input type="time" step="300" value={r.heure} onChange={(e) => setR({ ...r, heure: e.target.value })} /></label>
        <label className="champ"><span>Durée (min)</span><input type="number" min="5" step="5" value={r.duree} onChange={(e) => setR({ ...r, duree: Number(e.target.value) })} /></label>
      </div>
      <label className="champ"><span>Cliente</span><input value={r.client.nom} onChange={(e) => setR({ ...r, client: { ...r.client, nom: e.target.value } })} /></label>
      <label className="champ"><span>Téléphone</span><input type="tel" value={r.client.telephone} onChange={(e) => setR({ ...r, client: { ...r.client, telephone: e.target.value } })} /></label>
      <label className="champ"><span>Note</span><input value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} /></label>
      <div className="tb-actions">
        <button type="button" className="pp-bouton" disabled={enCours} onClick={sauver}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="bouton-secondaire" onClick={() => onFin("")}>Annuler</button>
      </div>
      {info && <p className="erreur" role="alert">{info}</p>}
    </div>
  );
}

function CarteRdv({ r, nom, agenda, rdvs, proId, onModifier, onLien }) {
  const [info, setInfo] = useState("");
  const [suppr, setSuppr] = useState(false);
  const changer = async (statut) => {
    const x = changerStatutRdv(r, statut);
    if (x.erreur) return setInfo(x.erreur);
    try {
      await enregistrerRdvPro(proId, x.rdv, rdvs, agenda);
      const sorte = { confirme: "confirmation", refuse: "refus", annule: "annulation" }[statut];
      if (sorte && r.client.telephone) onLien(lienWhatsAppClient(r.client.telephone, messageRdv(sorte, r, nom, sorte === "confirmation" ? agenda.messageConfirmation : "")));
    } catch {
      setInfo("Enregistrement impossible.");
    }
    return undefined;
  };
  const libelles = { confirme: "✓ Confirmer", refuse: "✗ Refuser", annule: "Annuler", termine: "Terminé", absent: "Absente" };
  return (
    <div style={{ borderTop: "1px solid #333", padding: "8px 0" }}>
      <p style={{ margin: 0 }}><b>{r.heure.replace(":", "h")}</b> · {r.prestation || "Rendez-vous"} · {r.duree} min · <i>{libelleStatutRdv(r.statut)}</i>{r.source === "client" ? " · 🌐 en ligne" : ""}</p>
      <p style={{ margin: 0 }}>{r.client.nom}{r.client.telephone ? ` · ${r.client.telephone}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
      <div className="tb-actions">
        {statutsRdvPossibles(r.statut).map((s) => <button key={s} type="button" className={s === "confirme" ? "pp-bouton" : "bouton-secondaire"} onClick={() => changer(s)}>{libelles[s]}</button>)}
        {["demande", "confirme"].includes(r.statut) && <button type="button" className="bouton-secondaire" onClick={() => onModifier(r)}>✏️ Modifier</button>}
        {r.client.telephone && <a className="bouton-secondaire" href={lienWhatsAppClient(r.client.telephone, `Bonjour ${r.client.nom}, `)} target="_blank" rel="noopener noreferrer">💬</a>}
        {suppr ? (
          <><button type="button" className="bouton-secondaire" onClick={() => supprimerRdvPro(proId, r, rdvs, agenda).catch(() => setInfo("Suppression impossible."))}>Oui, effacer</button><button type="button" className="bouton-secondaire" onClick={() => setSuppr(false)}>Non</button></>
        ) : <button type="button" className="bouton-secondaire" onClick={() => setSuppr(true)}>🗑</button>}
      </div>
      {info && <p className="erreur">{info}</p>}
    </div>
  );
}

function Reglages({ agenda, proId, nom }) {
  const [a, setA] = useState(() => lireAgenda(agenda || agendaVide()));
  const [info, setInfo] = useState("");
  const majPlage = (j, i, k, v) => setA({ ...a, horaires: { ...a.horaires, [j]: a.horaires[j].map((p, n) => (n === i ? { ...p, [k]: v } : p)) } });
  const sauver = async () => {
    const propre = lireAgenda(a);
    const e = erreursAgenda(propre);
    if (e.length) return setInfo(e.join(" "));
    try {
      await enregistrerAgendaPro(proId, propre, nom);
      setInfo("✓ Enregistré");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
    return undefined;
  };
  return (
    <div className="pp-bloc">
      <label className="case"><input type="checkbox" checked={a.actif} onChange={() => setA({ ...a, actif: !a.actif })} /><span>Mon agenda est actif</span></label>
      <label className="case"><input type="checkbox" checked={a.enLigne} onChange={() => setA({ ...a, enLigne: !a.enLigne })} /><span>Les clientes peuvent demander un rendez-vous en ligne (je confirme chaque demande)</span></label>
      <h4>Mes prestations</h4>
      {a.prestations.map((p, i) => (
        <div key={i} className="tb-actions" style={{ alignItems: "center" }}>
          <input value={p.nom} placeholder="Prestation" style={{ flex: 2 }} onChange={(e) => setA({ ...a, prestations: a.prestations.map((x, n) => (n === i ? { ...x, nom: e.target.value } : x)) })} />
          <input type="number" min="5" step="5" value={p.duree} style={{ width: 70 }} aria-label="Durée en minutes" onChange={(e) => setA({ ...a, prestations: a.prestations.map((x, n) => (n === i ? { ...x, duree: Number(e.target.value) } : x)) })} />
          <span>min</span>
          <input value={p.prix} placeholder="Prix (texte)" style={{ flex: 1 }} onChange={(e) => setA({ ...a, prestations: a.prestations.map((x, n) => (n === i ? { ...x, prix: e.target.value } : x)) })} />
          <button type="button" className="bouton-secondaire" aria-label="Retirer" onClick={() => setA({ ...a, prestations: a.prestations.filter((_, n) => n !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="bouton-secondaire" onClick={() => setA({ ...a, prestations: [...a.prestations, { id: `s${Date.now().toString(36)}`, nom: "", duree: 60, prix: "", enLigne: true }] })}>+ Prestation</button>
      <h4>Mes horaires</h4>
      {JOURS_SEMAINE.map((nomJour, j) => (
        <div key={j} style={{ marginBottom: 6 }}>
          <b>{nomJour}</b> {!a.horaires[j].length && <small>fermé</small>}
          {a.horaires[j].map((p, i) => (
            <div key={i} className="tb-actions" style={{ alignItems: "center" }}>
              <input type="time" step="900" value={p.debut} onChange={(e) => majPlage(j, i, "debut", e.target.value)} />
              <span>→</span>
              <input type="time" step="900" value={p.fin} onChange={(e) => majPlage(j, i, "fin", e.target.value)} />
              <button type="button" className="bouton-secondaire" aria-label="Retirer" onClick={() => setA({ ...a, horaires: { ...a.horaires, [j]: a.horaires[j].filter((_, n) => n !== i) } })}>✕</button>
            </div>
          ))}
          <button type="button" className="bouton-secondaire" onClick={() => setA({ ...a, horaires: { ...a.horaires, [j]: [...a.horaires[j], { debut: "09:00", fin: "13:00" }] } })}>+ plage</button>
        </div>
      ))}
      <h4>Congés et absences</h4>
      {a.conges.map((c, i) => (
        <div key={i} className="tb-actions" style={{ alignItems: "center" }}>
          <input type="date" value={c.du} onChange={(e) => setA({ ...a, conges: a.conges.map((x, n) => (n === i ? { ...x, du: e.target.value, au: x.au < e.target.value ? e.target.value : x.au } : x)) })} />
          <input type="date" value={c.au} onChange={(e) => setA({ ...a, conges: a.conges.map((x, n) => (n === i ? { ...x, au: e.target.value } : x)) })} />
          <input type="time" value={c.debut} aria-label="De (vide = toute la journée)" onChange={(e) => setA({ ...a, conges: a.conges.map((x, n) => (n === i ? { ...x, debut: e.target.value } : x)) })} />
          <input type="time" value={c.fin} aria-label="À" onChange={(e) => setA({ ...a, conges: a.conges.map((x, n) => (n === i ? { ...x, fin: e.target.value } : x)) })} />
          <input value={c.motif} placeholder="Motif" onChange={(e) => setA({ ...a, conges: a.conges.map((x, n) => (n === i ? { ...x, motif: e.target.value } : x)) })} />
          <button type="button" className="bouton-secondaire" aria-label="Retirer" onClick={() => setA({ ...a, conges: a.conges.filter((_, n) => n !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="bouton-secondaire" onClick={() => { const d = aujourdhuiIsrael(); setA({ ...a, conges: [...a.conges, { du: d, au: d, motif: "", debut: "", fin: "" }] }); }}>+ Congé ou absence</button>
      <p className="tb-note">Sans heures : toute la journée. Avec des heures : absence de quelques heures.</p>
      <h4>Réservation en ligne</h4>
      <label className="champ"><span>Pause entre deux rendez-vous (min)</span><input type="number" min="0" step="5" value={a.pause} onChange={(e) => setA({ ...a, pause: e.target.value })} /></label>
      <label className="champ"><span>Délai minimum avant un rendez-vous (heures)</span><input type="number" min="0" value={a.delaiHeures} onChange={(e) => setA({ ...a, delaiHeures: e.target.value })} /></label>
      <label className="champ"><span>Réservation possible jusqu'à (jours)</span><input type="number" min="1" value={a.joursMax} onChange={(e) => setA({ ...a, joursMax: e.target.value })} /></label>
      <label className="champ"><span>Phrase ajoutée à la confirmation (adresse, consignes…)</span><input value={a.messageConfirmation} onChange={(e) => setA({ ...a, messageConfirmation: e.target.value })} /></label>
      <p className="tb-note">Les demandes en ligne ne sont ni envoyées ni proposées pendant Chabbat et les fêtes (règle de Rebecca Services). Tes rendez-vous ajoutés toi-même ne sont pas bloqués.</p>
      <button type="button" className="pp-bouton" onClick={sauver}>Enregistrer</button>
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

export default function EspacePro({ compte, deconnecter }) {
  const proId = compte.proId;
  const agenda = useAgendaPro(proId);
  const rdvs = useRdvPro(proId);
  const [vue, setVue] = useState("agenda");
  const [jour, setJour] = useState(aujourdhuiIsrael);
  const [edition, setEdition] = useState(null);
  const [lien, setLien] = useState("");
  const nom = (agenda && agenda.nom) || compte.nom || "Votre professionnel";
  const a = agenda || lireAgenda(agendaVide());
  const auj = aujourdhuiIsrael();
  if (agenda === undefined || rdvs === null) return <main className="appli theme-site"><p className="tb-note">Chargement…</p></main>;
  const aConfirmer = rdvs.filter((r) => r.statut === "demande" && r.date >= auj).sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));
  const rappels = rappelsDeDemain(rdvs, auj);
  const mois = statsRdv(rdvs, `${auj.slice(0, 7)}-01`, `${auj.slice(0, 7)}-31`);
  return (
    <div className="appli theme-site">
      <main>
        <div className="pp-bloc">
          <h2>✨ {nom}</h2>
          <p className="tb-note">Espace professionnel · Rebecca Services</p>
          <div className="tb-actions">
            {[["agenda", `📅 Agenda${aConfirmer.length ? ` (${aConfirmer.length})` : ""}`], ["reglages", "⚙️ Horaires et prestations"], ["livraison", "📦 Livraison"]].map(([v, l]) => (
              <button key={v} type="button" className={vue === v ? "pp-bouton" : "bouton-secondaire"} onClick={() => { setVue(v); setEdition(null); }}>{l}</button>
            ))}
          </div>
          {!agenda && vue === "agenda" && <p className="tb-note">Commence par « Horaires et prestations » pour créer ton agenda.</p>}
          {lien && <p><a className="pp-bouton" href={lien} target="_blank" rel="noopener noreferrer" onClick={() => setLien("")}>💬 Prévenir la cliente sur WhatsApp</a></p>}
        </div>
        {vue === "reglages" && <Reglages agenda={agenda} proId={proId} nom={nom} />}
        {vue === "livraison" && (
          <div className="pp-bloc">
            <h3>📦 Une livraison avec Rebecca Services</h3>
            <p>Besoin de livrer une commande, des documents ou du matériel ? Rebecca Services s'en occupe, aux tarifs du site. Ces livraisons sont facturées à part, indépendamment de ton abonnement Digital.</p>
            <a className="pp-bouton" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${nom} (professionnel partenaire). J'ai besoin d'une livraison :\nRécupération : \nLivraison : \nQuand : `)} target="_blank" rel="noopener noreferrer">💬 Demander une livraison</a>
            <p className="tb-note">Ou fais une demande sur rebeccaservices.com → Services coursier.</p>
          </div>
        )}
        {vue === "agenda" && edition && <FormRdv initial={edition} agenda={a} rdvs={rdvs} proId={proId} nom={nom} onFin={(l) => { setEdition(null); if (l) setLien(l); }} />}
        {vue === "agenda" && !edition && (
          <>
            {aConfirmer.length > 0 && (
              <div className="pp-bloc">
                <h3>🔔 Demandes à confirmer ({aConfirmer.length})</h3>
                {aConfirmer.map((r) => <div key={r.id}><small>{jourCourt(r.date)}</small><CarteRdv r={r} nom={nom} agenda={a} rdvs={rdvs} proId={proId} onModifier={setEdition} onLien={setLien} /></div>)}
              </div>
            )}
            {rappels.length > 0 && (
              <div className="pp-bloc">
                <h3>⏰ Rappels pour demain</h3>
                {rappels.map((r) => (
                  <div key={r.id} className="tb-actions" style={{ alignItems: "center" }}>
                    <span style={{ flex: 1 }}>{r.heure.replace(":", "h")} · {r.client.nom}</span>
                    {r.client.telephone && <a className="bouton-secondaire" href={lienWhatsAppClient(r.client.telephone, messageRdv("rappel", r, nom))} target="_blank" rel="noopener noreferrer" onClick={() => marquerRappel(r.id).catch(() => {})}>💬 Envoyer le rappel</a>}
                  </div>
                ))}
              </div>
            )}
            <div className="pp-bloc">
              <div className="tb-actions" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <button type="button" className="bouton-secondaire" aria-label="Jour précédent" onClick={() => setJour(ajouterJoursDate(jour, -1))}>‹</button>
                <strong>{jourCourt(jour)}</strong>
                <button type="button" className="bouton-secondaire" aria-label="Jour suivant" onClick={() => setJour(ajouterJoursDate(jour, 1))}>›</button>
              </div>
              <div className="tb-actions">
                <input type="date" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} />
                {jour !== auj && <button type="button" className="bouton-secondaire" onClick={() => setJour(auj)}>Aujourd'hui</button>}
                <button type="button" className="pp-bouton" onClick={() => setEdition({ ...rdvVide(jour, "10:00"), proId })}>+ Rendez-vous</button>
              </div>
              {a.conges.some((c) => jour >= c.du && jour <= c.au) && <p className="tb-note">🌴 Congé ou absence ce jour-là.</p>}
              {!a.horaires[new Date(`${jour}T12:00:00Z`).getUTCDay()].length && <p className="tb-note">Jour fermé dans tes horaires.</p>}
              {rdvDuJour(rdvs, jour).map((r) => <CarteRdv key={r.id} r={r} nom={nom} agenda={a} rdvs={rdvs} proId={proId} onModifier={setEdition} onLien={setLien} />)}
              {!rdvDuJour(rdvs, jour).length && <p className="tb-note">Aucun rendez-vous.</p>}
            </div>
            <div className="pp-bloc">
              <p className="tb-note">Ce mois-ci : {mois.total} rendez-vous · {mois.termines} terminés · {mois.enLigne} demandés en ligne · {mois.annules} annulés ou refusés · {mois.absents} absences</p>
            </div>
          </>
        )}
        <div className="pp-bloc">
          <p className="tb-note">Tu es professionnel indépendant : Rebecca Services publie ta fiche et te fournit cet outil, mais ne réalise pas tes prestations et n'en encaisse pas le prix.</p>
          <button type="button" className="bouton-secondaire" onClick={deconnecter}>Se déconnecter</button>
        </div>
      </main>
    </div>
  );
}
