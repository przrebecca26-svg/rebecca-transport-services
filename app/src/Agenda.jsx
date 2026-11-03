import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { appliquerCreneaux, appliquerFermetures, CRENEAUX_PAR_DEFAUT, creneauValide, lireCreneaux } from "./fermetures.js";
import "./agenda.css";
import { lienAppel, lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours, joursADecider, localVersUtc, periodesFermees, prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";

// Agenda de Rebecca : jour, semaine, mois, avec Chabbat, fetes, creneaux personnels, courses et fermetures gerees par Rebecca.

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  terminee: { label: "Terminée", classe: "terminee" },
};
const NOMS_JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const texteJours = (jours) => {
  const j = [...jours].sort();
  const suite = j.length > 2 && j.every((x, i) => i === 0 || x === j[i - 1] + 1);
  return suite ? `${NOMS_JOURS[j[0]]} → ${NOMS_JOURS[j[j.length - 1]]}` : j.map((x) => NOMS_JOURS[x]).join(", ");
};

const deuxChiffres = (x) => String(x).padStart(2, "0");
const dateUtc = (d) => {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
};
const jourSemaine = (d) => dateUtc(d).getUTCDay(); // 0 = dimanche
const libelleJour = (d, court) => dateUtc(d).toLocaleDateString("fr-FR", { weekday: court ? "short" : "long", day: "numeric", month: court ? "short" : "long", timeZone: "UTC" });
const jourFr = (d) => d.split("-").reverse().join("/");
const debutSemaine = (d) => ajouterJours(d, -jourSemaine(d));
const debutMois = (d) => d.slice(0, 8) + "01";
const decalerMois = (d, n) => {
  const [a, m] = d.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 + n, 1, 12));
  return `${x.getUTCFullYear()}-${deuxChiffres(x.getUTCMonth() + 1)}-01`;
};
const nbJoursDuMois = (d) => {
  const [a, m] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};
const titreMois = (d) => dateUtc(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

const prixActuel = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime);
const textePrix = (d) => {
  const p = prixActuel(d);
  if (typeof p === "number") return p + " ₪";
  return d.surDevis ? "Sur devis" : "À fixer";
};

// Periodes de fermeture decoupees sur une journee : { label, type, texte }
function creneauxDuJour(periodes, jour) {
  const debutJ = localVersUtc(jour, "00:00");
  const finJ = localVersUtc(ajouterJours(jour, 1), "00:00");
  const res = [];
  for (const p of periodes) {
    if (p.finUtc <= debutJ || p.debutUtc >= finJ) continue;
    const commence = p.debutUtc > debutJ;
    const finit = p.finUtc < finJ;
    let texte = "Toute la journée";
    if (commence && finit) texte = `de ${p.debut.heure} à ${p.fin.heure}`;
    else if (commence) texte = `à partir de ${p.debut.heure}`;
    else if (finit) texte = `jusqu'à ${p.fin.heure}`;
    const minutes = Math.round((Math.min(p.finUtc, finJ) - Math.max(p.debutUtc, debutJ)) / 60000);
    res.push({ label: p.label, type: p.type, texte, minutes, debutUtc: p.debutUtc });
  }
  return res.sort((a, b) => a.debutUtc - b.debutUtc);
}

// "ferme" = toute la journee, "partiel" = une partie de la journee (Chabbat/fetes et fermetures exceptionnelles)
function etatJour(creneaux) {
  const importantes = creneaux.filter((c) => c.type !== "personnel");
  if (importantes.some((c) => c.minutes >= 12 * 60)) return "ferme";
  if (importantes.length > 0) return "partiel";
  return "libre";
}
// ---- fin des fonctions de calcul ----

// Ajout d'une fermeture (vacances, jour de repos...)
function AjoutFermeture({ aujourdhui }) {
  const [dateDebut, setDateDebut] = useState(aujourdhui);
  const [heureDebut, setHeureDebut] = useState("00:00");
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [heureFin, setHeureFin] = useState("23:59");
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ok, setOk] = useState("");

  const changerDebut = (v) => {
    setDateDebut(v);
    if (!dateFin || dateFin < v) setDateFin(v);
  };

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur("");
    setOk("");
    if (!dateDebut || !heureDebut || !dateFin || !heureFin) return setErreur("Remplissez les dates et les heures.");
    const debut = `${dateDebut}T${heureDebut}`;
    const fin = `${dateFin}T${heureFin}`;
    if (fin <= debut) return setErreur("La fin doit être après le début.");
    setEnCours(true);
    try {
      await addDoc(collection(db, "fermetures"), { debut, fin, motif: motif.trim().slice(0, 60), creeLe: serverTimestamp() });
      setMotif("");
      setOk("Fermeture ajoutée. Les clients ne pourront plus réserver sur ces horaires.");
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion.");
    }
    setEnCours(false);
  };

  return (
    <form className="fm-form" onSubmit={ajouter}>
      <div className="fm-ligne">
        <label className="fm-champ">Début : date<input type="date" value={dateDebut} onChange={(e) => changerDebut(e.target.value)} /></label>
        <label className="fm-champ">Heure<input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} /></label>
      </div>
      <div className="fm-ligne">
        <label className="fm-champ">Fin : date<input type="date" value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} /></label>
        <label className="fm-champ">Heure<input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} /></label>
      </div>
      <label className="fm-champ">
        Motif (visible par les clients)
        <input type="text" maxLength={60} value={motif} placeholder="Ex : Indisponible" onChange={(e) => setMotif(e.target.value)} />
      </label>
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
      {ok && <p className="fm-ok">{ok}</p>}
      <button className="tb-bouton" type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Ajouter cette fermeture"}</button>
    </form>
  );
}

// Une fermeture a venir, avec suppression en deux touches
function LigneFermeture({ f }) {
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const supprimer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await deleteDoc(doc(db, "fermetures", f.id));
    } catch {
      setErreur("Suppression impossible.");
      setEnCours(false);
      setConfirmer(false);
    }
  };
  const [d1, h1] = f.debut.split("T");
  const [d2, h2] = f.fin.split("T");
  return (
    <div className="fm-item">
      <div>
        <p><strong>{f.motif || "Fermeture exceptionnelle"}</strong></p>
        <small>du {jourFr(d1)} {h1} au {jourFr(d2)} {h2}</small>
        {erreur && <p className="fm-erreur">{erreur}</p>}
      </div>
      {confirmer ? (
        <button className="fm-petit alerte" onClick={supprimer} disabled={enCours}>Confirmer ?</button>
      ) : (
        <button className="fm-petit clair" onClick={() => setConfirmer(true)}>Supprimer</button>
      )}
    </div>
  );
}

// Un jour de Hol Hamoed : ouvert par defaut, Rebecca le ferme ou le rouvre
function LigneHolHamoed({ x, fermeture }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const basculer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      if (fermeture) await deleteDoc(doc(db, "fermetures", fermeture.id));
      else
        await addDoc(collection(db, "fermetures"), {
          debut: `${x.date}T00:00`,
          fin: `${x.date}T23:59`,
          motif: "Hol Hamoed : jour fermé",
          holHamoed: x.date,
          creeLe: serverTimestamp(),
        });
    } catch {
      setErreur("Modification impossible.");
    }
    setEnCours(false);
  };
  return (
    <div className="fm-item">
      <div>
        <p><strong>{libelleJour(x.date)}</strong></p>
        <small>{x.nom} · {fermeture ? <span className="fm-ferme">Fermé</span> : "Ouvert"}</small>
        {erreur && <p className="fm-erreur">{erreur}</p>}
      </div>
      <button className={"fm-petit" + (fermeture ? " clair" : "")} onClick={basculer} disabled={enCours}>
        {fermeture ? "Rouvrir" : "Fermer"}
      </button>
    </div>
  );
}

// Un creneau fixe (ecole, trajets reguliers) : actif = bloque les clients, libre = ne bloque plus
function LigneCreneau({ c, onChanger }) {
  const [edition, setEdition] = useState(false);
  const [jours, setJours] = useState(c.jours);
  const [debut, setDebut] = useState(c.debut);
  const [fin, setFin] = useState(c.fin);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async (nouveau) => {
    setEnCours(true);
    setErreur("");
    try {
      await onChanger(nouveau);
      setEdition(false);
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion.");
    }
    setEnCours(false);
  };
  const basculer = () => enregistrer({ ...c, actif: !c.actif });
  const sauver = () => {
    const nouveau = { ...c, jours: [...jours].sort(), debut, fin };
    if (!creneauValide(nouveau)) return setErreur("Choisissez au moins un jour et une heure de fin après le début.");
    enregistrer(nouveau);
  };
  const cocher = (n) => setJours((j) => (j.includes(n) ? j.filter((x) => x !== n) : [...j, n]));

  return (
    <div className="cf-item">
      <div className="fm-item">
        <div>
          <p><strong>{c.debut} – {c.fin}</strong></p>
          <small>{texteJours(c.jours)} · {c.actif ? "Actif (bloque les clients)" : <span className="fm-ferme">Libre (ne bloque plus)</span>}</small>
        </div>
        <button className={"fm-petit" + (c.actif ? "" : " clair")} onClick={basculer} disabled={enCours}>
          {c.actif ? "Me libérer" : "Réactiver"}
        </button>
      </div>
      <button className="cf-modifier" onClick={() => setEdition(!edition)}>{edition ? "Fermer" : "Modifier les jours et les heures"}</button>
      {edition && (
        <div className="fm-form">
          <div className="cf-jours">
            {NOMS_JOURS.map((nom, n) => (
              <button key={n} type="button" className={"cf-jour" + (jours.includes(n) ? " actif" : "")} onClick={() => cocher(n)} aria-pressed={jours.includes(n)}>
                {nom}
              </button>
            ))}
          </div>
          <div className="fm-ligne">
            <label className="fm-champ">De<input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} /></label>
            <label className="fm-champ">À<input type="time" value={fin} onChange={(e) => setFin(e.target.value)} /></label>
          </div>
          <button className="tb-bouton" onClick={sauver} disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

function Fermeture({ c }) {
  return (
    <div className={"ag-ferme-ligne" + (c.type === "personnel" ? " perso" : "")}>
      <strong>{c.label}</strong>
      <span>{c.texte}</span>
    </div>
  );
}

function Evenement({ d }) {
  const [ouvert, setOuvert] = useState(false);
  const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
  const whatsapp = lienWhatsApp(d.telephone);
  const appel = lienAppel(d.telephone);
  const adresses = Object.values(d.details || {}).filter((x) => x && typeof x === "object" && x.label);
  return (
    <div className={"ag-event ag-" + st.classe}>
      <button className="ag-event-tete" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span className="ag-heure">{d.heure}</span>
        <span className="ag-corps">
          <strong>{d.serviceTitre}</strong>
          <small>{d.nom} · {textePrix(d)}</small>
        </span>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </button>
      {ouvert && (
        <div className="ag-detail">
          <p>{d.telephone} · Paiement prévu : {d.moyenPaiement}</p>
          {adresses.map((a, i) => (
            <p key={i} dir="auto" className="ag-adresse">{a.label}</p>
          ))}
          <div className="tb-actions">
            {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
          </div>
          <p className="tb-note">Pour accepter, refuser ou changer le prix : onglet Demandes.</p>
        </div>
      )}
    </div>
  );
}

function JourListe({ jour, creneaux, evenements, aujourdhui, titre }) {
  return (
    <div className={"ag-jour" + (jour === aujourdhui ? " aujourdhui" : "")}>
      {titre && <h3>{libelleJour(jour)}</h3>}
      {creneaux.map((c, i) => (
        <Fermeture key={i} c={c} />
      ))}
      {evenements.map((d) => (
        <Evenement key={d.id} d={d} />
      ))}
      {creneaux.length === 0 && evenements.length === 0 && <p className="ag-libre">Libre</p>}
    </div>
  );
}

export default function Agenda() {
  const aujourdhui = utcVersLocal(Date.now()).date;
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState("");
  const [vue, setVue] = useState("semaine");
  const [ref, setRef] = useState(aujourdhui);
  const [fermetures, setFermetures] = useState([]); // fermetures enregistrees par Rebecca
  const [creneaux, setCreneaux] = useState(CRENEAUX_PAR_DEFAUT); // creneaux fixes (actifs ou libres)

  // Creneaux fixes : en direct, et appliques au calendrier du site
  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "creneaux"),
        (snap) => {
          const liste = (snap.exists() && lireCreneaux(snap.data().json)) || CRENEAUX_PAR_DEFAUT;
          appliquerCreneaux(liste, true);
          setCreneaux(liste);
        },
        () => {}
      ),
    []
  );
  const changerCreneau = (index, nouveau) => {
    const liste = creneaux.map((c, i) => (i === index ? nouveau : c));
    return setDoc(doc(db, "reglages", "creneaux"), { json: JSON.stringify(liste), majLe: serverTimestamp() });
  };

  // Fermetures de Rebecca : en direct, et appliquees au calendrier du site
  useEffect(() => {
    const q = query(collection(db, "fermetures"), orderBy("debut"));
    return onSnapshot(
      q,
      (snap) => {
        const liste = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
        appliquerFermetures(liste, true);
        setFermetures(liste);
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, "demandes"), orderBy("creeLe", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setErreur("Impossible de lire les demandes. Vérifiez la connexion.")
    );
  }, []);

  // Courses visibles, regroupees par date
  const parDate = useMemo(() => {
    const m = {};
    for (const d of items || []) {
      if (!STATUTS[d.statut] || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) continue;
      (m[d.date] = m[d.date] || []).push(d);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => String(a.heure).localeCompare(String(b.heure)));
    return m;
  }, [items]);

  // Plage de jours affichee
  const premier = vue === "jour" ? ref : vue === "semaine" ? debutSemaine(ref) : debutSemaine(debutMois(ref));
  const nbJours = vue === "jour" ? 1 : vue === "semaine" ? 7 : Math.ceil((jourSemaine(debutMois(ref)) + nbJoursDuMois(ref)) / 7) * 7;
  const periodes = useMemo(() => periodesFermees(premier, nbJours), [premier, nbJours, fermetures, creneaux]);
  const jours = useMemo(() => Array.from({ length: nbJours }, (_, i) => ajouterJours(premier, i)), [premier, nbJours]);
  const creneauxParJour = useMemo(() => {
    const m = {};
    for (const j of jours) m[j] = creneauxDuJour(periodes, j);
    return m;
  }, [jours, periodes]);

  const prochaines = useMemo(() => prochainesFermetures(aujourdhui, 4), [aujourdhui, fermetures]);
  const adecider = useMemo(() => joursADecider(aujourdhui, 60), [aujourdhui]);
  const maintenant = `${aujourdhui}T00:00`;
  const aVenir = fermetures.filter((f) => typeof f.fin === "string" && f.fin >= maintenant && !f.holHamoed);
  const holFermes = {};
  for (const f of fermetures) if (f.holHamoed) holFermes[f.holHamoed] = f;

  const pas = (sens) => {
    if (vue === "jour") setRef(ajouterJours(ref, sens));
    else if (vue === "semaine") setRef(ajouterJours(ref, 7 * sens));
    else setRef(decalerMois(ref, sens));
  };
  const titre =
    vue === "jour" ? libelleJour(ref) : vue === "semaine" ? `${libelleJour(premier, true)} – ${libelleJour(ajouterJours(premier, 6), true)}` : titreMois(ref);

  if (erreur) return <p className="admin-erreur tb-pad" role="alert">{erreur}</p>;
  if (items === null) return <p className="admin-texte tb-pad">Chargement de l'agenda…</p>;

  return (
    <section className="ag">
      <div className="tb-filtres" role="tablist" aria-label="Type de vue">
        {[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={vue === id} className={"tb-filtre" + (vue === id ? " actif" : "")} onClick={() => setVue(id)}>
            {nom}
          </button>
        ))}
      </div>

      <div className="ag-nav">
        <button className="ag-fleche" onClick={() => pas(-1)} aria-label="Précédent">‹</button>
        <button className="ag-titre" onClick={() => setRef(aujourdhui)} title="Revenir à aujourd'hui">
          <strong>{titre}</strong>
          <small>Aujourd'hui</small>
        </button>
        <button className="ag-fleche" onClick={() => pas(1)} aria-label="Suivant">›</button>
      </div>

      {vue === "jour" && <JourListe jour={ref} creneaux={creneauxParJour[ref] || []} evenements={parDate[ref] || []} aujourdhui={aujourdhui} />}

      {vue === "semaine" && jours.map((j) => <JourListe key={j} titre jour={j} creneaux={creneauxParJour[j] || []} evenements={parDate[j] || []} aujourdhui={aujourdhui} />)}

      {vue === "mois" && (
        <>
          <div className="ag-grille">
            {NOMS_JOURS.map((n) => (
              <span key={n} className="ag-entete">{n}</span>
            ))}
            {jours.map((j) => {
              const etat = etatJour(creneauxParJour[j] || []);
              const dansMois = j.slice(0, 7) === ref.slice(0, 7);
              const nb = (parDate[j] || []).length;
              return (
                <button
                  key={j}
                  className={"ag-case " + etat + (dansMois ? "" : " hors") + (j === aujourdhui ? " aujourdhui" : "")}
                  onClick={() => {
                    setRef(j);
                    setVue("jour");
                  }}
                  aria-label={libelleJour(j)}
                >
                  <span>{Number(j.slice(8))}</span>
                  {nb > 0 && <em>{nb}</em>}
                </button>
              );
            })}
          </div>
          <p className="ag-legende">
            <span className="ferme">Fermé</span> <span className="partiel">Fermé en partie</span> <em>1</em> = courses prévues. Touchez un jour pour le détail.
          </p>
        </>
      )}

      <div className="tb-bloc">
        <h3>Prochaines périodes sans service</h3>
        {prochaines.map((f) => (
          <p key={f.debutUtc}>
            <strong>{f.label}</strong>
            <br />
            <small>du {jourFr(f.debut.date)} {f.debut.heure} au {jourFr(f.fin.date)} {f.fin.heure}</small>
          </p>
        ))}
      </div>

      {adecider.length > 0 && (
        <div className="tb-bloc">
          <h3>Hol Hamoed : à décider</h3>
          <p className="tb-note">Ces jours restent ouverts tant que tu ne les fermes pas.</p>
          {adecider.map((x) => (
            <LigneHolHamoed key={x.date} x={x} fermeture={holFermes[x.date]} />
          ))}
        </div>
      )}

      <div className="tb-bloc">
        <h3>Mes créneaux fixes</h3>
        <p className="tb-note">Ces horaires reviennent chaque semaine et bloquent les clients. Touche « Me libérer » quand tu es disponible (par exemple si ta copine a une voiture).</p>
        {creneaux.map((c, i) => (
          <LigneCreneau key={i + c.debut + c.fin + c.jours.join("") + c.actif} c={c} onChanger={(nouveau) => changerCreneau(i, nouveau)} />
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Mes fermetures</h3>
        <p className="tb-note">Vacances, jour de repos, rendez-vous : les clients ne peuvent plus réserver sur ces horaires.</p>
        {aVenir.length === 0 && <p className="tb-note">Aucune fermeture à venir.</p>}
        {aVenir.map((f) => (
          <LigneFermeture key={f.id} f={f} />
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Ajouter une fermeture</h3>
        <AjoutFermeture aujourdhui={aujourdhui} />
      </div>
    </section>
  );
}
