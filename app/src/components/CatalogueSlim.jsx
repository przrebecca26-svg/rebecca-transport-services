import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { CATALOGUE_DEPART, ACTIVITES_DEPART, avecAjustement, libellePrix, libelleDuree } from "../pricing/catalogue.js";
import { creneauxDuJour } from "../pricing/rendezvous.js";
import { TARIFS } from "../pricing/config.js";
import { enregistrerDemande } from "../demandes.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

// Photos à ajouter plus tard
const PHOTOS = {
  "Radiofréquence visage ou cou": "/slim/radio.jpg",
  "Radiofréquence corps (1 zone)": "/slim/radio.jpg",
  "Cavitation ultrasonique (1 zone)": "/slim/radio.jpg",
};

// Catalogue et réservation pour Prestige Slim & Lift
export default function CatalogueSlim({ onRetour }) {
  const [prestations, setPrestations] = useState([]);
  const [activite, setActivite] = useState(null);
  const [selection, setSelection] = useState(null);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [occupes, setOccupes] = useState([]);
  const [client, setClient] = useState({ nom: "", telephone: "", moyenPaiement: "Espèces" });
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: "" });

  useEffect(() => {
    const unsubCat = onSnapshot(
      query(collection(db, "catalogue"), where("activite", "==", "slim")),
      (s) => {
        const items = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.publiee);
        setPrestations(CATALOGUE_DEPART.filter((p) => p.activite === "slim")); // force affichage des prestations par défaut
      },
      () => setPrestations(CATALOGUE_DEPART.filter((p) => p.activite === "slim"))
    );
    const unsubAct = onSnapshot(
      collection(db, "activites"),
      (s) => {
        const a = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.id === "slim") || ACTIVITES_DEPART.find((x) => x.id === "slim");
        setActivite(a);
      },
      () => setActivite(ACTIVITES_DEPART.find((x) => x.id === "slim"))
    );
    const unsubOcc = onSnapshot(collection(db, "creneauxOccupes"), (s) => setOccupes(s.docs.map((d) => d.data())), () => {});
    return () => {
      unsubCat();
      unsubAct();
      unsubOcc();
    };
  }, []);

  useEffect(() => {
    if (!selection || !date || !activite) return;
    const slots = creneauxDuJour({
      activite,
      dureeMinutes: selection.dureeMinutes || 60,
      date,
      occupes,
      service: "slim",
    });
    setCreneaux(slots);
    setHeure("");
  }, [selection, date, activite, occupes]);

  const categories = [...new Set(prestations.map((p) => p.categorie))];
  const photoDe = (nom) => PHOTOS[nom] || null;

  const envoyer = async () => {
    if (!client.nom.trim() || !client.telephone.trim()) {
      setEnvoi({ enCours: false, ok: false, erreur: "Nom et téléphone obligatoires." });
      return;
    }
    setEnvoi({ enCours: true, ok: false, erreur: "" });
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const message = `Bonjour Rebecca,\n\nNouvelle demande Prestige Slim & Lift :\n- Prestation : ${p.nom}\n- Date : ${date}\n- Heure : ${heure}\n- Prix : ${libellePrix(p)}\n- Durée : ${libelleDuree(p)}\n\nNom : ${client.nom}\nTéléphone : ${client.telephone}\nPaiement : ${client.moyenPaiement}\n\nMerci de me confirmer.`;
    const demande = {
      service: "slim",
      serviceTitre: "Prestige Slim & Lift – " + p.nom,
      date,
      heure,
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      moyenPaiement: client.moyenPaiement,
      prixEstime: p.prix || null,
      surDevis: false,
      details: { prestation: p.nom, duree: p.dureeMinutes },
      message,
      statut: "en attente",
      source: "site",
      kmEstime: null,
      minutesEstimees: null,
    };
    try {
      await enregistrerDemande(demande);
      const url = lienWhatsApp(WHATSAPP, message);
      window.open(url, "_blank", "noopener");
      setEnvoi({ enCours: false, ok: true, erreur: "" });
    } catch (e) {
      setEnvoi({ enCours: false, ok: false, erreur: "Impossible d'enregistrer pour le moment. Contactez Rebecca sur WhatsApp." });
    }
  };

  if (envoi.ok) {
    return (
      <section className="catalogue-nails">
        <h2>Demande envoyée</h2>
        <p>Votre demande pour <strong>{selection?.nom}</strong> le {date} à {heure} a été enregistrée.</p>
        <p>WhatsApp s'est ouvert pour prévenir Rebecca. Elle vous confirmera selon ses disponibilités.</p>
        <button className="bouton" onClick={onRetour}>Retour à l'accueil</button>
      </section>
    );
  }

  if (selection && heure) {
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const photo = photoDe(p.nom);
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setHeure("")}>← Changer le créneau</button>
        <h2>Finaliser la réservation</h2>
        {photo && <img src={photo} alt={p.nom} style={{ width: "100%", maxWidth: 320, borderRadius: 12, marginBottom: 12 }} />}
        <p><strong>{p.nom}</strong> · {date} à {heure}</p>
        <p>{libellePrix(p)} · {libelleDuree(p)}</p>
        <label>Votre nom<br /><input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} required /></label>
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
    const photo = photoDe(p.nom);
    return (
      <section className="catalogue-nails">
        <button className="lien" onClick={() => setSelection(null)}>← Retour au catalogue</button>
        <h2>{p.nom}</h2>
        {photo && <img src={photo} alt={p.nom} style={{ width: "100%", maxWidth: 360, borderRadius: 12, margin: "8px 0" }} />}
        <p>{p.description}</p>
        <p><strong>{libellePrix(p)}</strong> · {libelleDuree(p)}</p>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </label>
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
        <img src="/brand/logo-prestige-slim-lift.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Prestige Slim & Lift</h2>
      </div>
      <p>Choisissez une prestation pour réserver.</p>
      <div style={{ background: "#191518", padding: 12, borderRadius: 8, margin: "12px 0", fontSize: 14 }}>
        <strong>Important :</strong> Ces soins ne remplacent pas un avis médical. 
        Des précautions s'appliquent (grossesse, problèmes de santé, etc.). Merci de les signaler avant le rendez-vous.
      </div>
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {prestations.filter((p) => p.categorie === cat).map((p) => {
            const aff = avecAjustement(p, activite?.ajustementPourcent || 0);
            const photo = photoDe(aff.nom);
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
