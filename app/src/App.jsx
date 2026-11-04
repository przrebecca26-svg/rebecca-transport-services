import { lazy, Suspense, useEffect, useState } from "react";
import ServiceForm from "./components/ServiceForm.jsx";
import FavoriBouton from "./components/FavoriBouton.jsx";
import { SERVICES, activitesVisibles, servicesDe } from "./services.js";
import { prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";
import { etatDisponibilite } from "./pricing/disponibilite.js";
import { useFermetures } from "./fermetures.js";
import { compteOuvert, demarrer, useClient } from "./client.js";
import { TARIFS } from "./pricing/config.js";
import { NOM, SIGNATURE } from "./contact.js";
import "./client-commun.css";

// Espace prive et espace client : charges seulement quand on les ouvre (un visiteur ne telecharge rien de plus)
const Admin = lazy(() => import("./Admin.jsx"));
const Compte = lazy(() => import("./Compte.jsx"));
const Legal = lazy(() => import("./Legal.jsx"));
const enAdmin = () => window.location.hash.startsWith("#/admin");

// Mise en page des espaces (sans toucher aux fichiers CSS deja en place)
const ESPACE = { margin: "0 0 24px" };
const TITRE = { fontSize: 22, margin: "0 0 6px" };
const BIENTOT_STYLE = { opacity: 0.65, cursor: "default" };

const jourFr = (d) => d.split("-").reverse().join("/");
const POPUP = "rts_bienvenue_vue";
const lirePopup = () => {
  try {
    return window.localStorage.getItem(POPUP) === "1";
  } catch {
    return true;
  }
};
const fermerPopup = () => {
  try {
    window.localStorage.setItem(POPUP, "1");
  } catch {
    /* navigation privee */
  }
};

// Espaces bientot ouverts (catalogues en preparation) : affiches sans reservation possible
const BIENTOT = [
  { id: "beaute", icone: "💅", titre: "Services beauté", texte: "Nails Prestige, Prestige Hair, Prestige Slim & Lift et RegenX. À Netanya, sur rendez-vous." },
  { id: "epoxy", icone: "✨", titre: "Boutique Epoxy", texte: "Créations artisanales en résine époxy, réalisées à la main et sur commande." },
];

// Acces au Transport prive : accorde client par client par Rebecca (document autorisations/{uid}__transport).
// Tant que les regles v7 ne sont pas publiees, la lecture est refusee : le Transport reste invisible.
function useAcces(client) {
  const [acces, setAcces] = useState({});
  const ouvert = compteOuvert(client);
  const uid = client.user && client.user.uid;
  useEffect(() => {
    if (!ouvert) {
      setAcces({});
      return;
    }
    let actif = true;
    Promise.all([import("./firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { doc, getDoc }]) => getDoc(doc(db, "autorisations", uid + "__transport")))
      .then((s) => actif && setAcces({ transport: s.exists() && s.data().actif === true }))
      .catch(() => actif && setAcces({}));
    return () => {
      actif = false;
    };
  }, [ouvert, uid]);
  return acces;
}

function Carte({ s, onClick }) {
  return (
    <button className="carte-service" onClick={onClick}>
      <span className="icone" aria-hidden="true">{s.icone}</span>
      <span className="corps">
        <strong>{s.titre}</strong>
        <small>{s.texte}</small>
      </span>
      <span className="prix">{s.prix}</span>
    </button>
  );
}

function Accueil({ client, acces, onChoix, onCompte, onFavori }) {
  const aujourdhui = utcVersLocal(Date.now()).date;
  const fermetures = prochainesFermetures(aujourdhui, 3);
  const dispo = etatDisponibilite();
  const ouvert = compteOuvert(client);
  const favoris = ouvert && Array.isArray(client.profil.favoris) ? client.profil.favoris.filter((f) => SERVICES.some((s) => s.id === f.service && activitesVisibles(acces).some((a) => a.id === s.activite))) : [];

  return (
    <>
      <section className="hero">
        <img className="hero-logo" src="/brand/logo-medaillon.png" alt="" width="112" height="112" onError={(e) => (e.currentTarget.style.display = "none")} />
        <p className="surtitre">Netanya · toute Israël</p>
        <h1>{NOM}</h1>
        <p className="signature">« {SIGNATURE} »</p>
        <div className={"dispo-bandeau" + (dispo.ouvert ? "" : " ferme")} role="status">
          <span className="pastille" aria-hidden="true" />
          <span>
            <strong>{dispo.titre}</strong>
            <span>{dispo.detail}</span>
          </span>
        </div>
      </section>

      <div className="accueil-compte">
        <button type="button" className="lien" onClick={() => onCompte()}>
          👤 {ouvert ? "Bonjour " + client.profil.prenom : "Mon compte"}
        </button>
      </div>

      {favoris.length > 0 && (
        <section className="accueil-favoris">
          <h3>⭐ Mes trajets favoris</h3>
          <div>
            {favoris.map((f, i) => (
              <button key={i} type="button" onClick={() => onFavori(f)}>
                {f.nom}
              </button>
            ))}
          </div>
        </section>
      )}

      {activitesVisibles(acces).map((a) => (
        <section key={a.id} className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
          <h2 id={"titre-" + a.id} style={TITRE}>{a.titre}</h2>
          <p className="consigne">{a.texte} Le devis s'affiche en direct.</p>
          <div className="services">
            {servicesDe(a.id).map((s) => (
              <Carte key={s.id} s={s} onClick={() => onChoix(s.id)} />
            ))}
          </div>
        </section>
      ))}

      <section className="espace" style={ESPACE} aria-labelledby="titre-bientot">
        <h2 id="titre-bientot" style={TITRE}>Bientôt sur {NOM}</h2>
        <div className="services">
          {BIENTOT.map((b) => (
            <div key={b.id} className="carte-service bientot" style={BIENTOT_STYLE} aria-disabled="true">
              <span className="icone" aria-hidden="true">{b.icone}</span>
              <span className="corps">
                <strong>{b.titre}</strong>
                <small>{b.texte}</small>
              </span>
              <span className="prix">Bientôt</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dispo">
        <h3>Jours sans service</h3>
        <p>Aucune réservation pendant Chabbat et les fêtes juives.</p>
        <ul>
          {fermetures.map((f) => (
            <li key={f.debutUtc}>
              <strong>{f.label}</strong>
              <span>du {jourFr(f.debut.date)} {f.debut.heure} au {jourFr(f.fin.date)} {f.fin.heure}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Envoye({ info, onRetour, onCompte }) {
  return (
    <section className="envoye">
      <div className="coche" aria-hidden="true">✓</div>
      {info.enregistree ? (
        <>
          <h2>Votre demande est enregistrée</h2>
          <p>Elle apparaît dans « Mon compte », onglet Historique. <strong>Prévenez Rebecca sur WhatsApp</strong> pour une réponse plus rapide :</p>
          <a className="bouton" href={info.url} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>
        </>
      ) : (
        <>
          <h2>Votre demande est prête</h2>
          <p>WhatsApp s'est ouvert avec le résumé de votre demande ({info.service}). <strong>Appuyez sur « Envoyer »</strong> dans WhatsApp pour la transmettre à Rebecca.</p>
          <a className="bouton" href={info.url} target="_blank" rel="noopener noreferrer">Rouvrir WhatsApp</a>
        </>
      )}
      <p>Rebecca vérifie ses disponibilités puis vous confirme la réservation. Rien n'est réservé tant qu'elle n'a pas confirmé.</p>
      {info.serviceId && <FavoriBouton service={info.serviceId} valeurs={info.valeurs} />}
      {info.enregistree && (
        <button className="lien" onClick={() => onCompte("historique")}>Voir mon historique</button>
      )}
      <button className="lien" onClick={onRetour}>Faire une autre demande</button>
    </section>
  );
}

function Bienvenue({ onCreer, onFermer }) {
  return (
    <div className="popup-fond" role="dialog" aria-modal="true" aria-labelledby="popup-titre" onClick={onFermer}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2 id="popup-titre">Bienvenue !</h2>
        <p>Créez votre compte et recevez le code {TARIFS.clients.codeBienvenue} : -10 ₪ sur votre première demande.</p>
        <p>Vos adresses, vos trajets favoris et l'historique de vos demandes sont gardés pour la prochaine fois.</p>
        <button type="button" className="bouton" onClick={onCreer}>Créer mon compte</button>
        <button type="button" className="lien" onClick={onFermer}>Plus tard</button>
      </div>
    </div>
  );
}

const chargement = <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;

export default function App() {
  const [ecran, setEcran] = useState({ nom: "accueil" });
  const [admin, setAdmin] = useState(enAdmin());
  const [popup, setPopup] = useState(false);
  const client = useClient();
  const acces = useAcces(client);
  useFermetures(); // fermetures et creneaux fixes decides par Rebecca (redessine le site quand ils arrivent)

  useEffect(() => {
    const suivre = () => setAdmin(enAdmin());
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);

  // Suivi du compte client (seulement si un compte a deja ete utilise sur cet appareil)
  useEffect(() => {
    if (!enAdmin()) demarrer();
  }, []);

  // Fenetre de bienvenue : une seule fois, pour un visiteur sans compte, apres quelques secondes
  useEffect(() => {
    if (client.phase !== "anonyme" || lirePopup()) return;
    const id = setTimeout(() => setPopup(true), 2500);
    return () => clearTimeout(id);
  }, [client.phase]);

  const aller = (e) => {
    setEcran(e);
    window.scrollTo(0, 0);
  };
  const versCompte = (ongletInitial, vueInitiale) => aller({ nom: "compte", ongletInitial, vueInitiale });
  const versFormulaire = (service, depart) => {
    // un service d'un espace ferme (Transport sans autorisation) n'est jamais ouvert
    const s = SERVICES.find((x) => x.id === service);
    if (!s || !activitesVisibles(acces).some((a) => a.id === s.activite)) return aller({ nom: "accueil" });
    aller({ nom: "form", service, depart, cle: Date.now() });
  };

  if (admin) {
    return <Suspense fallback={chargement}><Admin /></Suspense>;
  }

  return (
    <div className="appli">
      <main>
        {ecran.nom === "accueil" && (
          <Accueil client={client} acces={acces} onChoix={(id) => versFormulaire(id)} onCompte={() => versCompte()} onFavori={(f) => versFormulaire(f.service, { details: f.details })} />
        )}
        {ecran.nom === "form" && (
          <ServiceForm
            key={ecran.service + ecran.cle}
            service={ecran.service}
            depart={ecran.depart}
            onRetour={() => aller({ nom: "accueil" })}
            onEnvoye={(info) => aller({ nom: "envoye", info })}
            onCompte={() => versCompte(undefined, "inscription")}
          />
        )}
        {ecran.nom === "envoye" && <Envoye info={ecran.info} onRetour={() => aller({ nom: "accueil" })} onCompte={(o) => versCompte(o)} />}
        {ecran.nom === "compte" && (
          <Suspense fallback={chargement}>
            <Compte
              ongletInitial={ecran.ongletInitial}
              vueInitiale={ecran.vueInitiale}
              onRetour={() => aller({ nom: "accueil" })}
              onRefaire={(d) => versFormulaire(d.service, { details: d.details })}
              onModifier={(d) => versFormulaire(d.service, { details: d.details, remplace: d.remplace })}
            />
          </Suspense>
        )}
        {ecran.nom === "legal" && (
          <Suspense fallback={chargement}>
            <Legal onRetour={() => aller({ nom: "accueil" })} />
          </Suspense>
        )}
      </main>
      <footer>
        <small>{NOM} · Aucun service pendant Chabbat et les fêtes</small>
        <br />
        <button type="button" className="lien" onClick={() => aller({ nom: "legal" })}>
          Confidentialité et conditions
        </button>
      </footer>
      {popup && ecran.nom === "accueil" && (
        <Bienvenue
          onFermer={() => {
            fermerPopup();
            setPopup(false);
          }}
          onCreer={() => {
            fermerPopup();
            setPopup(false);
            versCompte(undefined, "inscription");
          }}
        />
      )}
    </div>
  );
}
