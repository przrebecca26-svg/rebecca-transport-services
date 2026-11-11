import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { CATALOGUE_DEPART, ACTIVITES_DEPART, avecAjustement, libellePrix, libelleDuree } from "../pricing/catalogue.js";
import { creneauxDuJour, cellulesDe, cellulesLibres, idAgenda } from "../pricing/rendezvous.js";
import { TARIFS } from "../pricing/config.js";
import { enregistrerDemande, messageEchec } from "../demandes.js";
import { ecouterCatalogue, ecouterPhotos } from "../catalogueClient.js";
import Galerie from "./Galerie.jsx";
import { lienWhatsApp } from "../pricing/navigation.js";
import { VISUELS } from "../visuels.js";
import { WHATSAPP } from "../contact.js";

// Mapping temporaire des photos générées (remplaçables dans l'admin)
const PHOTOS = VISUELS.nails;

// Catalogue et réservation pour Nails Prestige
export default function CatalogueNails({ onRetour }) {
  const [prestations, setPrestations] = useState([]);
  const [activite, setActivite] = useState(null);
  const [selection, setSelection] = useState(null);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [occupes, setOccupes] = useState([]);
  const [client, setClient] = useState({ nom: "", telephone: "", moyenPaiement: "Espèces" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  const [photos, setPhotos] = useState({});
  const [galerie, setGalerie] = useState([]);
  useEffect(() => ecouterPhotos("nails", (par, g) => { setPhotos(par); setGalerie(g); }), []);

  useEffect(() => {
    const unsubCat = ecouterCatalogue("nails", (liste) => setPrestations(liste));
    const unsubAct = onSnapshot(
      collection(db, "activites"),
      (s) => {
        const a = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.id === "nails") || ACTIVITES_DEPART.find((x) => x.id === "nails");
        setActivite(a);
      },
      () => setActivite(ACTIVITES_DEPART.find((x) => x.id === "nails"))
    );
    const unsubOcc = onSnapshot(collection(db, "creneauxOccupes"), (s) => setOccupes(s.docs.map((d) => d.data())), () => {});
    return () => {
      unsubCat();
      unsubAct();
      unsubOcc();
    };
  }, []);

  // Agenda du jour choisi : quarts d'heure deja retenus (demandes en attente comprises)
  const [prises, setPrises] = useState({});
  useEffect(() => {
    if (!date) return setPrises({});
    return onSnapshot(doc(db, "agendaJours", idAgenda(date)), (x) => setPrises(x.exists() ? x.data().cells || {} : {}), () => setPrises({}));
  }, [date]);
  const margeRdv = Math.max(0, Number(activite?.margeMinutes) || 0);

  useEffect(() => {
    if (!selection || !date || !activite) return;
    const duree = selection.dureeMinutes || 60;
    const slots = creneauxDuJour({
      activite,
      dureeMinutes: duree,
      date,
      occupes,
      service: "nails",
    }).map((c) => (c.libre && !cellulesLibres(cellulesDe(c.heure, duree, margeRdv), prises) ? { ...c, libre: false } : c));
    setCreneaux(slots);
    // On garde l'heure choisie tant qu'elle reste libre ; sinon on revient au choix du creneau
    setHeure((h) => (slots.some((c) => c.heure === h && c.libre) ? h : ""));
  }, [selection, date, activite, occupes, prises, margeRdv]);

  const categories = [...new Set(prestations.map((p) => p.categorie))];
  const photoDe = (p) => {
    if (p && p.id && photos[p.id] && photos[p.id][0]) return photos[p.id][0];
    return PHOTOS[p.nom] || null;
  };

  const envoyer = async () => {
    if (!user || !user.emailVerified) {
      setEnvoi({ enCours: false, ok: false, erreur: "Connecte-toi avec un compte vérifié pour réserver." });
      return;
    }
    if (!client.nom.trim() || !client.telephone.trim()) {
      setEnvoi({ enCours: false, ok: false, erreur: "Nom et téléphone obligatoires." });
      return;
    }
    setEnvoi({ enCours: true, ok: false, erreur: "" });
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const message = `Bonjour Rebecca,\n\nNouvelle demande Nails Prestige :\n- Prestation : ${p.nom}\n- Date : ${date}\n- Heure : ${heure}\n- Prix : ${libellePrix(p)}${libelleDuree(p) ? "\n- Durée : " + libelleDuree(p) : ""}\n\nNom : ${client.nom}\nTéléphone : ${client.telephone}\nPaiement : ${client.moyenPaiement}\n\nMerci de me confirmer.`;
    const cellules = cellulesDe(heure, p.dureeMinutes || 60, margeRdv);
    const demande = {
      service: "nails",
      serviceTitre: "Nails Prestige – " + p.nom,
      date,
      heure,
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      moyenPaiement: client.moyenPaiement,
      prixEstime: p.prix || null,
      surDevis: false,
      details: { prestation: p.nom, duree: p.dureeMinutes, cellules },
      message,
      statut: "en attente",
      source: "site",
      kmEstime: null,
      minutesEstimees: p.dureeMinutes || null,
      uid: user.uid,
    };
    try {
      await enregistrerDemande(demande, { verrou: { date, cellules } });
      const url = lienWhatsApp(WHATSAPP, message);
      window.open(url, "_blank", "noopener");
      setEnvoi({ enCours: false, ok: true, erreur: "" });
    } catch (e) {
      setEnvoi({ enCours: false, ok: false, erreur: messageEchec(e, demande) });
      if (e && e.code === "creneau-pris") setHeure("");
    }
  };

  if (envoi.ok) {
    return (
      <section className="catalogue-nails">
        <h2>Demande envoyée</h2>
        <p>Votre demande pour <strong>{selection?.nom}</strong> le {date} à {heure} a été enregistrée. Ce créneau est retenu pour vous en attendant la confirmation de Rebecca.</p>
        <p>WhatsApp s'est ouvert pour prévenir Rebecca. Elle vous confirmera selon ses disponibilités.</p>
        <button className="bouton" onClick={onRetour}>Retour à l'accueil</button>
      </section>
    );
  }

  if (selection && heure) {
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const photo = photoDe(p);
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setHeure("")}>← Changer le créneau</button>
        <h2>Finaliser la réservation</h2>
        {photo && <img src={photo} alt={p.nom} style={{ width: "100%", maxWidth: 320, borderRadius: 12, marginBottom: 12 }} />}
        <p><strong>{p.nom}</strong> · {date} à {heure}</p>
        <p>{libellePrix(p)}{libelleDuree(p) ? " · " + libelleDuree(p) : ""}</p>
        <label>Votre nom<br /><input type="text" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} required /></label>
        <label>Votre téléphone<br /><input type="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} required /></label>
        <label>Moyen de paiement<br />
          <select value={client.moyenPaiement} onChange={(e) => setClient({ ...client, moyenPaiement: e.target.value })}>
            {(TARIFS.moyensPaiement || ["Espèces", "Carte", "Bit"]).map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        {envoi.erreur && <p className="erreur">{envoi.erreur}</p>}
        <button className="bouton" onClick={envoyer} disabled={envoi.enCours}>
          {envoi.enCours ? "Envoi…" : "Envoyer ma demande"}
        </button>
        <p className="mention">Rien n'est réservé tant que Rebecca n'a pas confirmé.</p>
      </section>
    );
  }

  if (selection) {
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const photo = photoDe(p);
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setSelection(null)}>← Retour au catalogue</button>
        <h2>{p.nom}</h2>
        {photo && <img src={photo} alt={p.nom} style={{ width: "100%", maxWidth: 360, borderRadius: 12, margin: "8px 0" }} />}
        {p.id && photos[p.id] && photos[p.id].length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {photos[p.id].slice(1).map((src, i) => <img key={i} src={src} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, flex: "none" }} />)}
          </div>
        )}
        <p>{p.description}</p>
        <p><strong>{libellePrix(p)}</strong>{libelleDuree(p) ? " · " + libelleDuree(p) : ""}</p>
        <label>
          Date
          <br /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </label>
        {envoi.erreur && <p className="erreur">{envoi.erreur}</p>}
        {date && (
          <div className="creneaux">
            <p>Créneaux disponibles :</p>
            {creneaux.filter((c) => c.libre).length === 0 && <p>Aucun créneau libre ce jour.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {creneaux.map((c) => (
                <button
                  key={c.heure}
                  disabled={!c.libre}
                  className={heure === c.heure ? "actif" : ""}
                  onClick={() => setHeure(c.heure)}
                  style={{ opacity: c.libre ? 1 : 0.4 }}
                >
                  {c.heure}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-nails-prestige.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Nails Prestige</h2>
      </div>
      <p>Prestations d'onglerie. Choisissez une prestation pour réserver.</p>
      <Galerie photos={galerie} titre={"Avant / après et réalisations"} />
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {prestations.filter((p) => p.categorie === cat).map((p) => {
            const aff = avecAjustement(p, activite?.ajustementPourcent || 0);
            const photo = photoDe(aff);
            return (
              <div key={p.id} className="carte-service" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setSelection(p)} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  {photo && <img src={photo} alt="" width={64} height={64} style={{ borderRadius: 8, objectFit: "cover" }} />}
                  <span className="corps">
                    <strong>{aff.nom}</strong>
                    <small>{aff.description || libelleDuree(aff)}</small>
                  </span>
                </button>
                <span className="prix">{libellePrix(aff)}</span>
                <a
                  href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je souhaite des informations sur : ${aff.nom} (${libellePrix(aff)})`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lien"
                  style={{ fontSize: 20 }}
                  title="Partager sur WhatsApp"
                >
                  💬
                </a>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
