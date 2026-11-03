import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienAppel, lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours, joursADecider, localVersUtc, periodesFermees, prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";

// Agenda de Rebecca : jour, semaine, mois. Lecture seule : Chabbat, fetes, creneaux personnels et courses.

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  terminee: { label: "Terminée", classe: "terminee" },
};
const NOMS_JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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
  const periodes = useMemo(() => periodesFermees(premier, nbJours), [premier, nbJours]);
  const jours = useMemo(() => Array.from({ length: nbJours }, (_, i) => ajouterJours(premier, i)), [premier, nbJours]);
  const creneauxParJour = useMemo(() => {
    const m = {};
    for (const j of jours) m[j] = creneauxDuJour(periodes, j);
    return m;
  }, [jours, periodes]);

  const prochaines = useMemo(() => prochainesFermetures(aujourdhui, 4), [aujourdhui]);
  const adecider = useMemo(() => joursADecider(aujourdhui, 60).slice(0, 6), [aujourdhui]);

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
          <h3>Jours à décider (Hol Hamoed)</h3>
          {adecider.map((x) => (
            <p key={x.date}>
              <strong>{libelleJour(x.date)}</strong> · {x.nom}
            </p>
          ))}
          <p className="tb-note">Ces jours restent ouverts tant que tu ne les fermes pas. Tu pourras décider jour par jour à l'étape suivante.</p>
        </div>
      )}
    </section>
  );
}
