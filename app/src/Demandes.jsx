import { useEffect, useMemo, useState } from "react";
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { lienAppel, lienWaze, lienWhatsApp } from "./pricing/navigation.js";
import PaiementsCourse from "./PaiementsCourse.jsx";

// Liste et traitement des demandes (espace prive de Rebecca)

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  refusee: { label: "Refusée", classe: "refusee" },
  terminee: { label: "Terminée", classe: "terminee" },
  annulee: { label: "Annulée", classe: "annulee" },
};

const ORDRE_ADRESSES = ["depart", "recuperation", "domicile", "adresse", "arretH1", "arretH2", "arretH3", "arretL2", "arretL3", "arretL4", "arretL5", "arrivee", "livraison", "ecole"];
const NOMS_ADRESSES = { depart: "Départ", recuperation: "Récupération", domicile: "Domicile", adresse: "Adresse", arrivee: "Arrivée", livraison: "Livraison", ecole: "École" };

const nomAdresse = (cle) => {
  if (NOMS_ADRESSES[cle]) return NOMS_ADRESSES[cle];
  const h = /^arretH(\d)$/.exec(cle);
  if (h) return "Arrêt " + h[1];
  const l = /^arretL(\d)$/.exec(cle);
  if (l) return "Livraison " + l[1];
  return cle;
};

const jour = (d, long) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });
};

const recueLe = (d) => {
  const t = d.creeLe && d.creeLe.toDate ? d.creeLe.toDate() : null;
  return t ? t.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "à l'instant";
};

const prixActuel = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime);
const textePrix = (d) => {
  const p = prixActuel(d);
  if (typeof p === "number") return p + " ₪";
  return d.surDevis ? "Sur devis" : "À fixer";
};

function messageClient(d) {
  const quand = `${jour(d.date, true)} à ${d.heure}`;
  const p = prixActuel(d);
  const prix = typeof p === "number" ? ` Prix convenu : ${p} ₪.` : "";
  if (d.statut === "acceptee") return `Bonjour ${d.nom}, votre réservation (${d.serviceTitre}) est confirmée pour ${quand}.${prix} À bientôt, Rebecca.`;
  if (d.statut === "refusee") return `Bonjour ${d.nom}, merci pour votre demande (${d.serviceTitre}, ${quand}). Malheureusement je ne suis pas disponible à ce moment-là. Souhaitez-vous proposer un autre horaire ? Rebecca.`;
  return `Bonjour ${d.nom}, j'ai bien reçu votre demande (${d.serviceTitre}, ${quand}). Je vérifie mes disponibilités et je reviens vers vous très vite. Rebecca.`;
}

function adressesDe(d) {
  const det = d.details || {};
  const cles = Object.keys(det).filter((k) => det[k] && typeof det[k] === "object" && det[k].label);
  const rang = (k) => (ORDRE_ADRESSES.includes(k) ? ORDRE_ADRESSES.indexOf(k) : 99);
  return cles.sort((a, b) => rang(a) - rang(b)).map((k) => ({ cle: k, nom: nomAdresse(k), ...det[k] }));
}

function Detail({ d, onFermer }) {
  const [prix, setPrix] = useState(typeof prixActuel(d) === "number" ? String(prixActuel(d)) : "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const ref = doc(db, "demandes", d.id);

  const executer = async (champs) => {
    setErreur("");
    setEnCours(true);
    try {
      await updateDoc(ref, { ...champs, majLe: serverTimestamp() });
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  const changerStatut = (s) => executer({ statut: s });

  const enregistrerPrix = () => {
    const n = Number(String(prix).replace(",", "."));
    if (!isFinite(n) || n < 0 || n > 20000 || String(prix).trim() === "") {
      setErreur("Entrez un prix valide, en shekels.");
      return;
    }
    if (n === prixActuel(d)) return;
    const ancien = typeof prixActuel(d) === "number" ? prixActuel(d) : null;
    executer({ prixFinal: n, historiquePrix: arrayUnion({ de: ancien, vers: n, leMs: Date.now() }) });
  };

  const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
  const whatsapp = lienWhatsApp(d.telephone, messageClient(d));
  const appel = lienAppel(d.telephone);
  const historique = Array.isArray(d.historiquePrix) ? d.historiquePrix : [];

  return (
    <section className="tb-detail">
      <button className="tb-retour" onClick={onFermer}>← Toutes les demandes</button>
      <div className="tb-ligne">
        <h2>{d.serviceTitre}</h2>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </div>
      <p className="tb-quand">{jour(d.date, true)} à {d.heure}</p>

      <div className="tb-bloc">
        <h3>Client</h3>
        <p><strong>{d.nom}</strong></p>
        <p>{d.telephone} · Paiement prévu : {d.moyenPaiement}</p>
        <div className="tb-actions">
          {whatsapp ? <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <span className="tb-note">Numéro non reconnu pour WhatsApp</span>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
        </div>
      </div>

      <div className="tb-bloc">
        <h3>Statut</h3>
        <div className="tb-actions">
          {d.statut === "en attente" && (
            <>
              <button className="tb-bouton" disabled={enCours} onClick={() => changerStatut("acceptee")}>Accepter</button>
              <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => changerStatut("refusee")}>Refuser</button>
            </>
          )}
          {d.statut === "acceptee" && (
            <>
              <button className="tb-bouton" disabled={enCours} onClick={() => changerStatut("terminee")}>Course terminée</button>
            </>
          )}
          {d.statut !== "en attente" && d.statut !== "annulee" && (
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => changerStatut("en attente")}>Remettre en attente</button>
          )}
        </div>
        <p className="tb-note">Après avoir accepté ou refusé, utilisez le bouton WhatsApp : le message est prêt.</p>
        {d.statut === "acceptee" && <p className="tb-note">Pour annuler une course, utilisez le bloc « Paiements » plus bas : l'argent reçu y est calculé.</p>}
      </div>

      <div className="tb-bloc">
        <h3>Prix</h3>
        <p>Estimation du site : {typeof d.prixEstime === "number" ? d.prixEstime + " ₪" : d.surDevis ? "sur devis" : "aucune"}{typeof d.prixFinal === "number" && <> · <strong>Prix retenu : {d.prixFinal} ₪</strong></>}</p>
        <div className="tb-prix">
          <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix en ₪" aria-label="Prix en shekels" />
          <button className="tb-bouton" disabled={enCours} onClick={enregistrerPrix}>Enregistrer le prix</button>
        </div>
        {historique.length > 0 && (
          <ul className="tb-histo">
            {historique.map((h, i) => (
              <li key={i}>{h.de == null ? "—" : h.de + " ₪"} → {h.vers} ₪ <small>({new Date(h.leMs).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })})</small></li>
            ))}
          </ul>
        )}
      </div>

      <PaiementsCourse d={d} />

      <div className="tb-bloc">
        <h3>Itinéraires</h3>
        {adressesDe(d).length === 0 && <p className="tb-note">Aucune adresse enregistrée.</p>}
        {adressesDe(d).map((a) => (
          <div className="tb-adresse" key={a.cle}>
            <div>
              <small>{a.nom}</small>
              <p dir="auto">{a.label}</p>
            </div>
            <a className="tb-bouton tb-clair" href={lienWaze(typeof a.lat === "number" && typeof a.lon === "number" ? { lat: a.lat, lon: a.lon } : { adresse: a.label })} target="_blank" rel="noopener noreferrer">Waze</a>
          </div>
        ))}
        {typeof d.kmEstime === "number" && <p className="tb-note">Distance estimée : {Math.round(d.kmEstime * 10) / 10} km{typeof d.minutesEstimees === "number" ? ` · ${Math.round(d.minutesEstimees)} min` : ""}</p>}
      </div>

      <div className="tb-bloc">
        <h3>Demande complète</h3>
        <pre className="tb-message" dir="auto">{d.message}</pre>
        <p className="tb-note">Reçue le {recueLe(d)}</p>
      </div>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
    </section>
  );
}

export default function Demandes() {
  const [items, setItems] = useState(null); // null = chargement
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("en attente");
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "demandes"), orderBy("creeLe", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setErreur("Impossible de lire les demandes. Vérifiez la connexion et les règles Firebase.")
    );
  }, []);

  const compte = useMemo(() => {
    const c = { tout: 0 };
    for (const d of items || []) {
      c.tout += 1;
      c[d.statut] = (c[d.statut] || 0) + 1;
    }
    return c;
  }, [items]);

  if (erreur) return <p className="admin-erreur tb-pad" role="alert">{erreur}</p>;
  if (items === null) return <p className="admin-texte tb-pad">Chargement des demandes…</p>;

  const courante = ouvert && items.find((d) => d.id === ouvert);
  if (courante) return <Detail key={courante.id} d={courante} onFermer={() => setOuvert(null)} />;

  const visibles = filtre === "tout" ? items : items.filter((d) => d.statut === filtre);

  return (
    <section className="tb-liste">
      <div className="tb-filtres" role="tablist" aria-label="Filtrer les demandes">
        {Object.entries(STATUTS).map(([id, s]) => (
          <button key={id} role="tab" aria-selected={filtre === id} className={"tb-filtre" + (filtre === id ? " actif" : "")} onClick={() => setFiltre(id)}>
            {s.label} <span>{compte[id] || 0}</span>
          </button>
        ))}
        <button role="tab" aria-selected={filtre === "tout"} className={"tb-filtre" + (filtre === "tout" ? " actif" : "")} onClick={() => setFiltre("tout")}>
          Toutes <span>{compte.tout}</span>
        </button>
      </div>

      {visibles.length === 0 && <p className="admin-texte tb-pad">Aucune demande dans cette catégorie.</p>}

      {visibles.map((d) => {
        const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
        return (
          <button key={d.id} className="tb-carte" onClick={() => setOuvert(d.id)}>
            <span className="tb-ligne">
              <strong>{d.serviceTitre}</strong>
              <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
            </span>
            <span className="tb-quand">{jour(d.date)} · {d.heure}</span>
            <span className="tb-ligne">
              <span>{d.nom}</span>
              <strong>{textePrix(d)}</strong>
            </span>
          </button>
        );
      })}
    </section>
  );
}
