import { useEffect, useState } from "react";
import { arrayUnion, collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { WHATSAPP } from "./contact.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { detailsRefaire, lirePourboire, nomFavoriValide, nettoyer, peutAnnuler, statutSuivi } from "./profil.js";
import { dateFr } from "./CompteChamps.jsx";
import Pourboire from "./Pourboire.jsx";
import { rafraichir } from "./client.js";

// "Mon historique" : demandes, statuts, paiements. Refaire / modifier / annuler une demande. Avis, etoiles et pourboire apres chaque course.

const millis = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
const prixAffiche = (d) => {
  if (typeof d.prixFinal === "number") return d.prixFinal + " ₪";
  if (d.surDevis) return "Sur devis";
  return typeof d.prixEstime === "number" ? d.prixEstime + " ₪ (estimation)" : "Prix à confirmer";
};

function Avis({ suivi, onFait }) {
  const [etoiles, setEtoiles] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [pourboire, setPourboire] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => setErreur(""), [etoiles, commentaire, pourboire]);

  const envoyer = async () => {
    const tip = lirePourboire(pourboire, TARIFS.pourboire.max);
    if (!etoiles) return setErreur("Choisissez une note de 1 à 5 étoiles.");
    if (tip.erreur) return setErreur(tip.erreur);
    setEnCours(true);
    try {
      await setDoc(doc(db, "avis", suivi.id), { uid: suivi.uid, etoiles, commentaire: nettoyer(commentaire, 600), pourboire: tip.montant, creeLe: serverTimestamp() });
      setFait(true);
      onFait(suivi.id);
    } catch {
      setErreur("Envoi impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };

  if (fait) {
    return (
      <div className="compte-info" role="status">
        Merci pour votre avis !{" "}
        {etoiles >= 4 && TARIFS.avisGoogleUrl && (
          <a href={TARIFS.avisGoogleUrl} target="_blank" rel="noopener noreferrer">
            Laissez-le aussi sur Google
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="hist-avis">
      <h4>Votre avis sur cette course</h4>
      <div className="hist-etoiles" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={etoiles === n} aria-label={n + " étoile" + (n > 1 ? "s" : "")} className={n <= etoiles ? "actif" : ""} onClick={() => setEtoiles(n)}>
            ★
          </button>
        ))}
      </div>
      <div className="champ">
        <label htmlFor={"avis-" + suivi.id}>Commentaire (facultatif)</label>
        <textarea id={"avis-" + suivi.id} rows={3} maxLength={600} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        <span className="aide">Visible par Rebecca seule.</span>
      </div>
      <Pourboire id={"tip-" + suivi.id} valeur={pourboire} onChange={setPourboire} />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <button type="button" className="bouton" disabled={enCours} onClick={envoyer}>
        Envoyer mon avis
      </button>
    </div>
  );
}

export default function CompteHistorique({ client, onRefaire, onModifier }) {
  const { user, profil } = client;
  const [suivis, setSuivis] = useState(null); // null = chargement
  const [avisFaits, setAvisFaits] = useState(() => new Set());
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [annulation, setAnnulation] = useState(""); // id en cours de confirmation
  const [favori, setFavori] = useState(null); // { id, nom }
  const [enCours, setEnCours] = useState(false);

  const charger = async () => {
    try {
      const [s, a] = await Promise.all([
        getDocs(query(collection(db, "suivi"), where("uid", "==", user.uid))),
        getDocs(query(collection(db, "avis"), where("uid", "==", user.uid))),
      ]);
      setSuivis(s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((p, q) => millis(q.creeLe) - millis(p.creeLe)));
      setAvisFaits(new Set(a.docs.map((x) => x.id)));
    } catch {
      setSuivis([]);
      setErreur("Lecture de votre historique impossible. Vérifiez la connexion puis réessayez.");
    }
  };
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const annuler = (d) => {
    // WhatsApp d'abord (le navigateur exige l'ouverture au moment du clic)
    const msg = `Bonjour Rebecca, j'annule ma demande : ${d.serviceTitre} du ${dateFr(d.date)} à ${d.heure}. Merci.`;
    window.open(lienWhatsApp(WHATSAPP, msg), "_blank", "noopener");
    setEnCours(true);
    setErreur("");
    updateDoc(doc(db, "suivi", d.id), { statut: "annulée par le client", majLe: serverTimestamp() })
      .then(() => {
        setSuivis((l) => l.map((x) => (x.id === d.id ? { ...x, statut: "annulée par le client" } : x)));
        setAnnulation("");
        setInfo("Votre demande est annulée. Rebecca a été prévenue par WhatsApp.");
      })
      .catch(() => setErreur("Annulation impossible pour le moment. Rebecca a reçu votre message WhatsApp."))
      .finally(() => setEnCours(false));
  };

  const enregistrerFavori = async () => {
    const d = suivis.find((x) => x.id === favori.id);
    if (!nomFavoriValide(favori.nom)) return setErreur("Donnez un nom d'au moins 2 lettres à ce trajet.");
    if ((profil.favoris || []).length >= TARIFS.clients.favorisMax) return setErreur("Vous avez déjà " + TARIFS.clients.favorisMax + " trajets favoris : supprimez-en un dans « Mes informations ».");
    setEnCours(true);
    setErreur("");
    try {
      await updateDoc(doc(db, "clients", user.uid), { favoris: arrayUnion({ nom: nettoyer(favori.nom, 40), service: d.service, details: detailsRefaire(d.details) }), majLe: serverTimestamp() });
      await rafraichir();
      setFavori(null);
      setInfo("Trajet ajouté à vos favoris.");
    } catch {
      setErreur("Enregistrement impossible. Réessayez.");
    }
    setEnCours(false);
  };

  if (suivis === null) return <p className="consigne">Chargement…</p>;

  return (
    <div className="hist">
      {info && <p className="compte-info" role="status">{info}</p>}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {suivis.length === 0 && !erreur && (
        <div className="bloc">
          <p>Vous n'avez pas encore de demande. Elles apparaîtront ici dès que vous en enverrez une en étant connecté.</p>
        </div>
      )}
      {suivis.map((d) => {
        const st = statutSuivi(d.statut);
        const paye = typeof d.dejaPaye === "number" ? d.dejaPaye : null;
        return (
          <article key={d.id} className="bloc hist-carte">
            <div className="hist-tete">
              <strong>{d.serviceTitre}</strong>
              <span className={"hist-statut " + st.classe}>{st.texte}</span>
            </div>
            <p className="hist-quand">
              {dateFr(d.date)} à {d.heure}
            </p>
            <p className="hist-prix">
              {prixAffiche(d)}
              {d.remise > 0 && <small> · code {d.codePromo} (−{d.remise} ₪)</small>}
            </p>
            {paye !== null && (
              <p className="hist-paye">
                Payé : {paye} ₪{typeof d.reste === "number" ? " · Reste à payer : " + d.reste + " ₪" : ""}
              </p>
            )}
            {d.pourboire > 0 && <p className="hist-paye">Pourboire prévu : {d.pourboire} ₪</p>}
            {d.messageClient && <p className="compte-info">{d.messageClient}</p>}

            <div className="compte-boutons">
              <button type="button" className="bouton hist-bouton" onClick={() => onRefaire({ service: d.service, details: d.details })}>
                Refaire ce trajet
              </button>
              {peutAnnuler(d.statut) && (
                <button type="button" className="lien" onClick={() => onModifier({ service: d.service, details: d.details, remplace: d.id })}>
                  Modifier
                </button>
              )}
              {peutAnnuler(d.statut) && annulation !== d.id && (
                <button type="button" className="lien compte-danger" onClick={() => setAnnulation(d.id)}>
                  Annuler
                </button>
              )}
              <button type="button" className="lien" onClick={() => setFavori({ id: d.id, nom: "" })}>
                ⭐ Favori
              </button>
            </div>

            {annulation === d.id && (
              <div className="compte-alerte">
                <p>Annuler cette demande ? Rebecca sera prévenue par WhatsApp.</p>
                <div className="compte-boutons">
                  <button type="button" className="bouton compte-supprimer" disabled={enCours} onClick={() => annuler(d)}>
                    Oui, annuler
                  </button>
                  <button type="button" className="lien" onClick={() => setAnnulation("")}>
                    Non
                  </button>
                </div>
              </div>
            )}

            {favori && favori.id === d.id && (
              <div className="compte-alerte">
                <div className="champ">
                  <label htmlFor={"fav-" + d.id}>Nom du trajet favori (ex : Maison → Aéroport)</label>
                  <input id={"fav-" + d.id} type="text" maxLength={40} value={favori.nom} onChange={(e) => { setFavori({ ...favori, nom: e.target.value }); setErreur(""); }} />
                </div>
                <div className="compte-boutons">
                  <button type="button" className="bouton" disabled={enCours} onClick={enregistrerFavori}>
                    Enregistrer
                  </button>
                  <button type="button" className="lien" onClick={() => setFavori(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {d.statut === "terminée" && !avisFaits.has(d.id) && <Avis suivi={d} onFait={() => {}} />}
          </article>
        );
      })}
    </div>
  );
}
