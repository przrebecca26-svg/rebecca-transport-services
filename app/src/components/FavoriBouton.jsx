import { useState } from "react";
import { compteOuvert, rafraichir, useClient } from "../client.js";
import { TARIFS } from "../pricing/config.js";
import { champsVisibles } from "../services.js";
import { detailsRefaire, nettoyer, nomFavoriValide } from "../profil.js";
import "../client-commun.css";

// BOUTON "ENREGISTRER CE TRAJET EN FAVORI" (formulaire et confirmation d'envoi).
// Garde le service et les reponses du formulaire (adresses, options), sans date, heure ni code promo.
// Le client le retrouve sur l'accueil et dans "Mes informations" ; un clic remplit le formulaire.
// Visible seulement pour un compte ouvert (e-mail verifie). Limite : TARIFS.clients.favorisMax.

// Valeur simple pour la base (Firestore refuse "undefined")
function simple(val) {
  if (val && typeof val === "object") {
    const r = { label: String(val.label || "").slice(0, 300) };
    if (typeof val.lat === "number" && typeof val.lon === "number") {
      r.lat = val.lat;
      r.lon = val.lon;
    }
    return r;
  }
  if (typeof val === "number" || typeof val === "boolean") return val;
  return String(val ?? "").slice(0, 1000);
}

// Nom propose : "Herzl 10 → Dizengoff 50" a partir des deux premieres adresses
function nomPropose(service, v) {
  const adresses = champsVisibles(service, v)
    .filter((c) => c.type === "adresse" && v[c.name] && v[c.name].label)
    .map((c) => String(v[c.name].label).split(",")[0].trim());
  return adresses.length >= 2 ? (adresses[0] + " → " + adresses[1]).slice(0, 40) : (adresses[0] || "").slice(0, 40);
}

export default function FavoriBouton({ service, valeurs }) {
  const client = useClient();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  if (!compteOuvert(client)) return null;
  if (fait) return <p className="promo-ok" role="status">⭐ Trajet ajouté à vos favoris.</p>;

  const favoris = Array.isArray(client.profil.favoris) ? client.profil.favoris : [];
  const plein = favoris.length >= TARIFS.clients.favorisMax;

  const enregistrer = async () => {
    if (!nomFavoriValide(nom)) return setErreur("Donnez un nom d'au moins 2 lettres à ce trajet.");
    if (plein) return setErreur("Vous avez déjà " + TARIFS.clients.favorisMax + " favoris : supprimez-en un dans « Mes informations ».");
    const details = {};
    for (const c of champsVisibles(service, valeurs)) details[c.name] = simple(valeurs[c.name]);
    setEnCours(true);
    setErreur("");
    try {
      const [{ db }, { arrayUnion, doc, serverTimestamp, updateDoc }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
      await updateDoc(doc(db, "clients", client.user.uid), {
        favoris: arrayUnion({ nom: nettoyer(nom, 40), service, details: detailsRefaire(details) }),
        majLe: serverTimestamp(),
      });
      await rafraichir();
      setFait(true);
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        className="lien"
        onClick={() => {
          setNom(nomPropose(service, valeurs));
          setErreur(plein ? "Vous avez déjà " + TARIFS.clients.favorisMax + " favoris : supprimez-en un dans « Mes informations »." : "");
          setOuvert(true);
        }}
      >
        ⭐ Enregistrer ce trajet en favori
      </button>
    );
  }

  return (
    <div className="promo-bloc">
      <label htmlFor="f-favori">Nom du favori (ex : Maison → Aéroport)</label>
      <div className="promo-ligne">
        <input id="f-favori" type="text" maxLength={40} value={nom} onChange={(e) => { setNom(e.target.value); setErreur(""); }} />
        <button type="button" className="bouton" disabled={enCours || plein} onClick={enregistrer}>
          {enCours ? "…" : "Enregistrer"}
        </button>
      </div>
      <button type="button" className="lien" onClick={() => setOuvert(false)}>
        Annuler
      </button>
      {erreur && <span className="erreur" role="alert">{erreur}</span>}
    </div>
  );
}
