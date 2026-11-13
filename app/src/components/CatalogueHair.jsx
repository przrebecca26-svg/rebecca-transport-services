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
import AddressField from "./AddressField.jsx";
import { calculerTrajet } from "../routing.js";
import { NETANYA, fraisDeplacement, pourMariee } from "../pricing/deplacementMariee.js";

// Photos à ajouter plus tard
const PHOTOS = VISUELS.hair;

// Catalogue et réservation pour Prestige Hair
export default function CatalogueHair({ onRetour }) {
  const [prestations, setPrestations] = useState([]);
  const [activite, setActivite] = useState(null);
  const [selection, setSelection] = useState(null);
  // 13 nov. 2026 : mariee chez Rebecca ou a domicile ; hors Netanya, frais de deplacement (grille Transport)
  const [lieu, setLieu] = useState("rebecca");
  const [adresse, setAdresse] = useState(null);
  const [route, setRoute] = useState(null);
  useEffect(() => {
    setRoute(null);
    if (!adresse || typeof adresse.lat !== "number") return undefined;
    const ctrl = new AbortController();
    calculerTrajet(NETANYA, adresse, ctrl.signal).then(setRoute).catch(() => {});
    return () => ctrl.abort();
  }, [adresse]);
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
  useEffect(() => ecouterPhotos("hair", (par, g) => { setPhotos(par); setGalerie(g); }), []);

  useEffect(() => {
    const unsubCat = ecouterCatalogue("hair", (liste) => setPrestations(liste));
    const unsubAct = onSnapshot(
      collection(db, "activites"),
      (s) => {
        const a = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.id === "hair") || ACTIVITES_DEPART.find((x) => x.id === "hair");
        setActivite(a);
      },
      () => setActivite(ACTIVITES_DEPART.find((x) => x.id === "hair"))
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
  const mariee = pourMariee(selection);
  const depl = mariee && lieu === "domicile" ? fraisDeplacement(adresse, route, date, heure) : { statut: "ok", frais: 0, minutes: 0 };
  const dureeTotale = (selection?.dureeMinutes || 60) + (depl.minutes || 0);
  const lieuOk = !mariee || lieu === "rebecca" || (depl.statut === "ok" || depl.statut === "devis");

  useEffect(() => {
    if (!selection || !date || !activite) return;
    const duree = dureeTotale;
    const slots = creneauxDuJour({
      activite,
      dureeMinutes: duree,
      date,
      occupes,
      service: "hair",
    }).map((c) => (c.libre && !cellulesLibres(cellulesDe(c.heure, duree, margeRdv), prises) ? { ...c, libre: false } : c));
    setCreneaux(slots);
    // On garde l'heure choisie tant qu'elle reste libre ; sinon on revient au choix du creneau
    setHeure((h) => (slots.some((c) => c.heure === h && c.libre) ? h : ""));
  }, [selection, date, activite, occupes, prises, margeRdv, dureeTotale]);

  const categories = [...new Set(prestations.map((p) => p.categorie))];
  const photoDe = (p) => {
    if (p && p.id && photos[p.id] && photos[p.id][0]) return photos[p.id][0];
    return PHOTOS[p.nom] || null;
  };

  const envoyer = async () => {
    if (!client.nom.trim() || !client.telephone.trim()) {
      setEnvoi({ enCours: false, ok: false, erreur: "Nom et téléphone obligatoires." });
      return;
    }
    setEnvoi({ enCours: true, ok: false, erreur: "" });
    const p = avecAjustement(selection, activite?.ajustementPourcent || 0);
    const txtLieu = mariee ? (lieu === "rebecca" ? "\n- Lieu : chez Rebecca" : `\n- Lieu : à domicile, ${adresse ? adresse.label : "?"}${depl.statut === "ok" && depl.frais ? `\n- Déplacement hors Netanya : ${depl.frais} ₪ (aller-retour)\n- Total : ${(p.prix || 0) + depl.frais} ₪` : depl.statut === "devis" ? "\n- Déplacement : prix à confirmer par Rebecca" : ""}`) : "";
    const message = `Bonjour Rebecca,\n\nNouvelle demande Prestige Hair :\n- Prestation : ${p.nom}\n- Date : ${date}\n- Heure : ${heure}\n- Prix : ${libellePrix(p)}${libelleDuree(p) ? "\n- Durée : " + libelleDuree(p) : ""}${txtLieu}\n\nNom : ${client.nom}\nTéléphone : ${client.telephone}\nPaiement : ${client.moyenPaiement}\n\nMerci de me confirmer.`;
    const cellules = cellulesDe(heure, dureeTotale, margeRdv);
    const demande = {
      service: "hair",
      serviceTitre: "Prestige Hair – " + p.nom,
      date,
      heure,
      nom: client.nom.trim(),
      telephone: client.telephone.trim(),
      moyenPaiement: client.moyenPaiement,
      prixEstime: p.prix ? p.prix + (depl.statut === "ok" ? depl.frais || 0 : 0) : null,
      surDevis: false,
      details: { prestation: p.nom, duree: dureeTotale, cellules, ...(mariee ? { lieu: lieu === "rebecca" ? "chez Rebecca" : "à domicile", ...(lieu === "domicile" && adresse ? { adresse, fraisDeplacement: depl.statut === "ok" ? depl.frais : null } : {}) } : {}) },
      message,
      statut: "en attente",
      source: "site",
      kmEstime: null,
      minutesEstimees: dureeTotale || null,
      // 13 nov. 2026 : sans compte aussi (le compte verifie ajoute seulement le suivi dans « Mon espace »)
      ...(user && user.emailVerified ? { uid: user.uid } : {}),
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
        {mariee && <p>{lieu === "rebecca" ? "Chez Rebecca" : `À domicile : ${adresse ? adresse.label : ""}`}{depl.frais ? ` · déplacement ${depl.frais} ₪ · total ${(p.prix || 0) + depl.frais} ₪` : ""}</p>}
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
        {mariee && (
          <div className="lieu-mariee">
            <p><strong>Où ?</strong></p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={lieu === "rebecca" ? "actif" : ""} onClick={() => setLieu("rebecca")}>Chez Rebecca (Netanya)</button>
              <button type="button" className={lieu === "domicile" ? "actif" : ""} onClick={() => setLieu("domicile")}>À domicile ou dans la salle</button>
            </div>
            {lieu === "domicile" && (
              <>
                <AddressField id="adresse-mariee" valeur={adresse} onChange={setAdresse} position={false} />
                {depl.statut === "calcul" && <p><small>Calcul du déplacement…</small></p>}
                {depl.statut === "ok" && <p>{depl.frais ? <>Déplacement hors Netanya (aller-retour) : <strong>{depl.frais} ₪</strong> · total <strong>{(p.prix || 0) + depl.frais} ₪</strong></> : "À Netanya : pas de frais de déplacement."}</p>}
                {depl.statut === "devis" && <p><small>Déplacement : prix confirmé par Rebecca.</small></p>}
              </>
            )}
          </div>
        )}
        {!lieuOk && <p><small>Indiquez l'adresse pour voir les créneaux.</small></p>}
        {lieuOk && <label>
          Date
          <br /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </label>}
        {envoi.erreur && <p className="erreur">{envoi.erreur}</p>}
        {date && lieuOk && (
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
        <img src="/brand/logo-prestige-hair.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Prestige Hair</h2>
      </div>
      <p>Coiffure, coupe, couleur et brushing. Choisissez une prestation pour réserver.</p>
      <Galerie photos={galerie} titre={"Avant / après et réalisations"} />
      {categories.map((cat) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {prestations.filter((p) => p.categorie === cat).map((p) => {
            const aff = avecAjustement(p, activite?.ajustementPourcent || 0);
            const photo = photoDe(aff);
            return (
              <div key={p.id} className="carte-service" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {photo && <img src={photo} alt="" width={64} height={64} style={{ borderRadius: 8, objectFit: "cover" }} />}
                <button onClick={() => setSelection(p)} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  
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
