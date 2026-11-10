import { lazy, Suspense, useEffect, useState } from "react";
import ServiceForm from "./components/ServiceForm.jsx";
import FavoriBouton from "./components/FavoriBouton.jsx";
import { ACTIVITES, SERVICES, activitesVisibles, servicesDe } from "./services.js";
import { prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";
import { etatDisponibilite } from "./pricing/disponibilite.js";
import { useFermetures } from "./fermetures.js";
import { compteOuvert, demarrer, useClient } from "./client.js";
import { TARIFS } from "./pricing/config.js";
import { INSTAGRAM, LIEN_INSTAGRAM, NOM, SIGNATURE, WHATSAPP } from "./contact.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import IconeService from "./components/IconeService.jsx";
import CatalogueNails from "./components/CatalogueNails.jsx";
import CatalogueRegenX from "./components/CatalogueRegenX.jsx";
import BoutonsFlottants from "./components/BoutonsFlottants.jsx";
import "./client-commun.css";
import "./theme-site.css";

// Espace prive et espace client : charges seulement quand on les ouvre (un visiteur ne telecharge rien de plus)
const Admin = lazy(() => import("./Admin.jsx"));
const Compte = lazy(() => import("./Compte.jsx"));
const Legal = lazy(() => import("./Legal.jsx"));
const enAdmin = () => window.location.hash.startsWith("#/admin");

// Mise en page des espaces (sans toucher aux fichiers CSS deja en place)
const ESPACE = { margin: "0 0 24px" };
const TITRE = { fontSize: 22, margin: 0 };
const BIENTOT_STYLE = { opacity: 0.8, cursor: "default" };
const ENTETE = { display: "flex", alignItems: "center", gap: 12, margin: "0 0 6px" };
const MARQUES = { display: "flex", gap: 6, marginTop: 6 };

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

// Medaillon Rebecca Services
const MEDAILLON = "/icon-512.png";
const ROND = { borderRadius: "50%", objectFit: "cover" };

// Textes des espaces sur l'accueil
const TEXTES_ACCUEIL = {
  coursier: { titre: "Services coursier", texte: "Livraisons, courses et petits déménagements", logo: MEDAILLON },
};

// Espaces bientot ouverts
const BIENTOT = [
  {
    id: "beaute",
    logo: "/brand/logo-prestige-beautys.png",
    titre: "Beauté & bien-être",
    texte: "Ongles, coiffure, reconstruction du cheveu et du poil, soins et beauté de la silhouette",
    marques: ["/brand/logo-nails-prestige.png", "/brand/logo-prestige-hair.png", "/brand/logo-prestige-slim-lift.png", "/brand/logo-regenx.png"],
  },
  { id: "epoxy", logo: "/brand/logo-epoxy.png", titre: "Boutique Epoxy", texte: "Créations personnalisées en résine" },
  { id: "digital", logo: "/brand/logo-digital-applications.png", titre: "DIGITAL & APPLICATIONS", texte: "Création de sites et d'applications web professionnelles" },
];

const Logo = ({ src, taille = 44 }) => (
  <img src={src} alt="" width={taille} height={taille} style={ROND} loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
);

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
      <span className="icone" aria-hidden="true"><IconeService id={s.id} /></span>
      <span className="corps">
        <strong>{s.titre}</strong>
        <small>{s.texte}</small>
      </span>
      <span className="prix">{s.prix}</span>
    </button>
  );
}

const MESSAGE_ACCES = "Bonjour Rebecca, je souhaite réserver un service de Transport privé.";
function SurDemande({ a }) {
  return (
    <section className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
      <div style={ENTETE}>
        <span className="espace-icone" aria-hidden="true"><IconeService id={servicesDe(a.id)[0].id} /></span>
        <h2 id={"titre-" + a.id} style={TITRE}>{a.titre}</h2>
      </div>
      <div className="sur-demande">
        <ul className="sur-demande-liste">
          {servicesDe(a.id).map((s) => (
            <li key={s.id}><IconeService id={s.id} taille={26} />{s.titre}</li>
          ))}
        </ul>
        <p className="sur-demande-message">Service disponible sur demande. Contactez-moi sur WhatsApp.</p>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, MESSAGE_ACCES)} target="_blank" rel="noopener noreferrer">Me contacter sur WhatsApp</a>
      </div>
    </section>
  );
}

function Accueil({ client, acces, onChoix, onCompte, onFavori, onNails }) {
  const aujourdhui = utcVersLocal(Date.now()).date;
  const fermetures = prochainesFermetures(aujourdhui, 3);
  const dispo = etatDisponibilite();
  const ouvert = compteOuvert(client);
  const favoris = ouvert && Array.isArray(client.profil.favoris) ? client.profil.favoris.filter((f) => SERVICES.some((s) => s.id === f.service && activitesVisibles(acces).some((a) => a.id === s.activite))) : [];

  return (
    <>
      <section className="hero">
        <img className="hero-logo" src={MEDAILLON} alt="" width="112" height="112" style={ROND} onError={(e) => (e.currentTarget.style.display = "none")} />
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

      {Object.values(ACTIVITES).sort((x, y) => x.ordre - y.ordre).map((a) => {
        const t = TEXTES_ACCUEIL[a.id] || a;
        if (!activitesVisibles(acces).some((v) => v.id === a.id)) return <SurDemande key={a.id} a={a} />;
        if (a.id === "nails") {
          return (
            <section key={a.id} className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
              <div style={ENTETE}>
                <Logo src={a.logo || "/brand/logo-nails-prestige.png"} taille={52} />
                <h2 id={"titre-" + a.id} style={TITRE}>{a.titre}</h2>
              </div>
              <p className="consigne">{a.texte}. Choisissez une prestation pour réserver.</p>
              <button className="bouton" onClick={onNails}>Voir les prestations et réserver</button>
            </section>
          );
        }
        if (a.id === "regenx") {
          return (
            <section key={a.id} className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
              <div style={ENTETE}>
                <Logo src={a.logo || "/brand/logo-regenx.png"} taille={52} />
                <h2 id={"titre-" + a.id} style={TITRE}>{a.titre}</h2>
              </div>
              <p className="consigne">{a.texte}</p>
              <button className="bouton" onClick={() => onRegenX && onRegenX()}>Voir les prestations</button>
            </section>
          );
        }
        return (
          <section key={a.id} className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
            <div style={ENTETE}>
              {t.logo ? <Logo src={t.logo} taille={52} /> : <span className="espace-icone" aria-hidden="true"><IconeService id={servicesDe(a.id)[0]?.id} /></span>}
              <h2 id={"titre-" + a.id} style={TITRE}>{t.titre}</h2>
            </div>
            <p className="consigne">{t.texte.replace(/\.$/, "")}. Le devis s'affiche en direct.</p>
            <div className="services">
              {servicesDe(a.id).map((s) => (
                <Carte key={s.id} s={s} onClick={() => onChoix(s.id)} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="espace" style={ESPACE} aria-labelledby="titre-bientot">
        <h2 id="titre-bientot" style={TITRE}>Bientôt sur {NOM}</h2>
        <div className="services">
          {BIENTOT.map((b) => (
            <div key={b.id} className="carte-service bientot" style={BIENTOT_STYLE} aria-disabled="true">
              <span className="icone" aria-hidden="true"><Logo src={b.logo} /></span>
              <span className="corps">
                <strong>{b.titre}</strong>
                <small>{b.texte}</small>
                {b.marques && (
                  <span style={MARQUES}>
                    {b.marques.map((m) => (
                      <Logo key={m} src={m} taille={30} />
                    ))}
                  </span>
                )}
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
  useFermetures();

  useEffect(() => {
    const suivre = () => setAdmin(enAdmin());
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);

  useEffect(() => {
    if (!enAdmin()) demarrer();
  }, []);

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
    const s = SERVICES.find((x) => x.id === service);
    if (!s || !activitesVisibles(acces).some((a) => a.id === s.activite)) return aller({ nom: "accueil" });
    aller({ nom: "form", service, depart, cle: Date.now() });
  };

  if (admin) {
    return <Suspense fallback={chargement}><Admin /></Suspense>;
  }

  return (
    <div className="appli theme-site">
      <main>
        {ecran.nom === "accueil" && (
          <Accueil client={client} acces={acces} onChoix={(id) => versFormulaire(id)} onCompte={() => versCompte()} onFavori={(f) => versFormulaire(f.service, { details: f.details })} onNails={() => aller({ nom: "catalogue-nails" })} onRegenX={() => aller({ nom: "catalogue-regenx" })} />
        )}
        {ecran.nom === "catalogue-nails" && (
          <CatalogueNails onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-regenx" && (
          <CatalogueRegenX onRetour={() => aller({ nom: "accueil" })} />
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
        <a className="lien" href={LIEN_INSTAGRAM} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
          Instagram @{INSTAGRAM}
        </a>
        <br />
        <button type="button" className="lien" onClick={() => aller({ nom: "legal" })}>
          Confidentialité et conditions
        </button>
      </footer>
      <BoutonsFlottants />
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
