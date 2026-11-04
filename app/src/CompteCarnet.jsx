import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import AddressField from "./components/AddressField.jsx";
import { NOMS_ADRESSES, construireAdresseNommee, construireEnfant, validerAdresseNommee, validerEnfant } from "./profil.js";
import { rafraichir } from "./client.js";

// Carnet du client : adresses enregistrees (Maison, Travail, ...), enfants (ramassage scolaire), trajets favoris.
// Chaque liste est enregistree en entier dans la fiche du client.

async function enregistrerListe(user, champ, liste) {
  await updateDoc(doc(db, "clients", user.uid), { [champ]: liste, majLe: serverTimestamp() });
  await rafraichir();
}

/* ---------- Adresses ---------- */

function Adresses({ user, profil }) {
  const liste = profil.adresses || [];
  const [edition, setEdition] = useState(null); // { index, nom, adresse: {label, lat, lon} }
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => setErreur(""), [edition]);

  const ouvrir = (index) => {
    const a = index === null ? null : liste[index];
    setEdition({ index, nom: a ? a.nom : "", adresse: a ? { label: a.label, lat: a.lat, lon: a.lon } : null });
  };
  const sauver = async () => {
    const a = { nom: edition.nom, label: edition.adresse ? edition.adresse.label : "", lat: edition.adresse ? edition.adresse.lat : undefined, lon: edition.adresse ? edition.adresse.lon : undefined };
    const e = validerAdresseNommee(a);
    if (Object.keys(e).length) return setErreur(e.nom || e.label);
    const propre = construireAdresseNommee(a);
    if (liste.some((x, i) => i !== edition.index && x.nom.toLowerCase() === propre.nom.toLowerCase())) return setErreur("Une adresse porte déjà ce nom.");
    const nouvelle = edition.index === null ? [...liste, propre] : liste.map((x, i) => (i === edition.index ? propre : x));
    setEnCours(true);
    try {
      await enregistrerListe(user, "adresses", nouvelle);
      setEdition(null);
    } catch {
      setErreur("Enregistrement impossible. Réessayez.");
    }
    setEnCours(false);
  };
  const supprimer = async (index) => {
    setEnCours(true);
    try {
      await enregistrerListe(user, "adresses", liste.filter((_, i) => i !== index));
    } catch {
      setErreur("Suppression impossible. Réessayez.");
    }
    setEnCours(false);
  };

  return (
    <div className="bloc">
      <h3>Mes adresses</h3>
      <p className="aide">Maison, travail, chez un proche… Elles se choisissent en un clic dans vos demandes.</p>
      {liste.length > 0 && (
        <ul className="carnet-liste">
          {liste.map((a, i) => (
            <li key={a.nom}>
              <div>
                <strong>{a.nom}</strong>
                <span>{a.label}</span>
                {typeof a.lat !== "number" && <small>Adresse non localisée : choisissez une suggestion en la modifiant.</small>}
              </div>
              {!edition && (
                <div className="compte-boutons">
                  <button type="button" className="lien" onClick={() => ouvrir(i)}>Modifier</button>
                  <button type="button" className="lien compte-danger" disabled={enCours} onClick={() => supprimer(i)}>Supprimer</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!edition && liste.length < TARIFS.clients.adressesMax && (
        <button type="button" className="bouton" onClick={() => ouvrir(null)}>
          Ajouter une adresse
        </button>
      )}
      {!edition && liste.length >= TARIFS.clients.adressesMax && <p className="aide">Vous avez atteint les {TARIFS.clients.adressesMax} adresses : supprimez-en une pour en ajouter.</p>}
      {edition && (
        <div className="compte-alerte">
          <div className="champ">
            <label htmlFor="a-nom">Nom de l'adresse *</label>
            <div className="pourboire-boutons">
              {NOMS_ADRESSES.map((n) => (
                <button key={n} type="button" className={edition.nom === n ? "actif" : ""} onClick={() => setEdition({ ...edition, nom: n })}>
                  {n}
                </button>
              ))}
            </div>
            <input id="a-nom" type="text" maxLength={30} placeholder="ou un autre nom (ex : Chez maman)" value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
          </div>
          <div className="champ">
            <label htmlFor="a-adr">Adresse *</label>
            <AddressField id="a-adr" valeur={edition.adresse} onChange={(a) => setEdition((x) => ({ ...x, adresse: a }))} />
          </div>
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
          <div className="compte-boutons">
            <button type="button" className="bouton" disabled={enCours} onClick={sauver}>Enregistrer</button>
            <button type="button" className="lien" onClick={() => setEdition(null)}>Annuler</button>
          </div>
        </div>
      )}
      {!edition && erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  );
}

/* ---------- Enfants ---------- */

const ENFANT_VIDE = { prenom: "", age: "", classe: "", ecole: "", adresse: "", telephoneUrgence: "", horaires: "", personnesAutorisees: "" };

function Enfants({ user, profil }) {
  const liste = profil.enfants || [];
  const [edition, setEdition] = useState(null); // { index, ...champs }
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    setErreurs({});
    setErreur("");
  }, [edition]);

  const ouvrir = (index) => setEdition({ index, ...(index === null ? ENFANT_VIDE : { ...ENFANT_VIDE, ...liste[index], age: String(liste[index].age) }) });
  const maj = (champ, val) => setEdition((x) => ({ ...x, [champ]: val }));
  const sauver = async () => {
    const e = validerEnfant(edition);
    if (Object.keys(e).length) return setErreurs(e);
    const propre = construireEnfant(edition);
    const nouvelle = edition.index === null ? [...liste, propre] : liste.map((x, i) => (i === edition.index ? propre : x));
    setEnCours(true);
    try {
      await enregistrerListe(user, "enfants", nouvelle);
      setEdition(null);
    } catch {
      setErreur("Enregistrement impossible. Réessayez.");
    }
    setEnCours(false);
  };
  const supprimer = async (index) => {
    setEnCours(true);
    try {
      await enregistrerListe(user, "enfants", liste.filter((_, i) => i !== index));
    } catch {
      setErreur("Suppression impossible. Réessayez.");
    }
    setEnCours(false);
  };
  const champ = (id, label, nom, extra = {}) => (
    <div className="champ">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={edition[nom]} onChange={(e) => maj(nom, e.target.value)} aria-invalid={!!erreurs[nom]} {...extra} />
      {erreurs[nom] && <span className="erreur">{erreurs[nom]}</span>}
    </div>
  );

  return (
    <div className="bloc">
      <h3>Mes enfants (ramassage scolaire)</h3>
      <p className="aide">Enregistrez vos enfants une fois : vous les choisirez en un clic pour le ramassage. En ajoutant un enfant, vous confirmez être son parent ou son représentant légal.</p>
      {liste.length > 0 && (
        <ul className="carnet-liste">
          {liste.map((en, i) => (
            <li key={en.prenom + i}>
              <div>
                <strong>{en.prenom}, {en.age} ans · {en.classe}</strong>
                <span>{en.ecole ? en.ecole + " · " : ""}{en.adresse}</span>
                <small>Urgence : {en.telephoneUrgence}{en.horaires ? " · " + en.horaires : ""}</small>
                {en.personnesAutorisees && <small>Autorisés : {en.personnesAutorisees}</small>}
              </div>
              {!edition && (
                <div className="compte-boutons">
                  <button type="button" className="lien" onClick={() => ouvrir(i)}>Modifier</button>
                  <button type="button" className="lien compte-danger" disabled={enCours} onClick={() => supprimer(i)}>Supprimer</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!edition && liste.length < TARIFS.clients.enfantsMax && (
        <button type="button" className="bouton" onClick={() => ouvrir(null)}>
          Ajouter un enfant
        </button>
      )}
      {edition && (
        <div className="compte-alerte">
          {champ("e-prenom", "Prénom *", "prenom", { maxLength: 40 })}
          {champ("e-age", "Âge *", "age", { inputMode: "numeric", maxLength: 2 })}
          {champ("e-classe", "Classe *", "classe", { maxLength: 30, placeholder: "ex : CE2" })}
          {champ("e-ecole", "École (facultatif)", "ecole", { maxLength: 80 })}
          {champ("e-adresse", "Adresse du domicile *", "adresse", { maxLength: 300 })}
          {champ("e-urgence", "Téléphone en cas d'urgence *", "telephoneUrgence", { type: "tel", inputMode: "tel" })}
          {champ("e-horaires", "Horaires habituels (facultatif)", "horaires", { maxLength: 120, placeholder: "ex : 8h00 - 13h30, vendredi 11h50" })}
          {champ("e-autorisees", "Personnes autorisées à récupérer l'enfant (facultatif)", "personnesAutorisees", { maxLength: 200, placeholder: "ex : Sarah (maman) 054…, David (papa) 052…" })}
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
          <div className="compte-boutons">
            <button type="button" className="bouton" disabled={enCours} onClick={sauver}>Enregistrer</button>
            <button type="button" className="lien" onClick={() => setEdition(null)}>Annuler</button>
          </div>
        </div>
      )}
      {!edition && erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  );
}

/* ---------- Trajets favoris ---------- */

function Favoris({ user, profil }) {
  const liste = profil.favoris || [];
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  if (liste.length === 0) return null;
  const supprimer = async (index) => {
    setEnCours(true);
    setErreur("");
    try {
      await enregistrerListe(user, "favoris", liste.filter((_, i) => i !== index));
    } catch {
      setErreur("Suppression impossible. Réessayez.");
    }
    setEnCours(false);
  };
  return (
    <div className="bloc">
      <h3>Mes trajets favoris</h3>
      <p className="aide">Ils apparaissent sur l'accueil : un clic ouvre le formulaire déjà rempli. Pour en ajouter, utilisez « ⭐ Favori » dans votre historique.</p>
      <ul className="carnet-liste">
        {liste.map((f, i) => (
          <li key={f.nom + i}>
            <div>
              <strong>{f.nom}</strong>
            </div>
            <button type="button" className="lien compte-danger" disabled={enCours} onClick={() => supprimer(i)}>Supprimer</button>
          </li>
        ))}
      </ul>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  );
}

export default function CompteCarnet({ client }) {
  return (
    <>
      <Adresses user={client.user} profil={client.profil} />
      <Enfants user={client.user} profil={client.profil} />
      <Favoris user={client.user} profil={client.profil} />
    </>
  );
}
