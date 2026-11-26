import { lazy, Suspense, useEffect, useState } from "react";
import VoirPosition from "./components/VoirPosition.jsx";
import { lireLienPosition } from "./pricing/positionDirect.js";
import ServiceForm from "./components/ServiceForm.jsx";
import DemandeRamassage from "./components/DemandeRamassage.jsx";
import PartageRamassage from "./components/PartageRamassage.jsx";
import { lireLienPartage, lireLienBienvenue } from "./pricing/partageRamassage.js";
import BienvenueRamassage, { CLE_INVITATION } from "./components/BienvenueRamassage.jsx";
import FavoriBouton from "./components/FavoriBouton.jsx";
import { ACTIVITES, FORMULAIRES, SERVICES, servicesDe } from "./services.js";
import { trajetsHabituels } from "./pricing/habituels.js";
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
import CatalogueEpoxy from "./components/CatalogueEpoxy.jsx";
import CatalogueSlim from "./components/CatalogueSlim.jsx";
import CatalogueHair from "./components/CatalogueHair.jsx";
import CatalogueDigital from "./components/CatalogueDigital.jsx";
import BoutonsFlottants from "./components/BoutonsFlottants.jsx";
import AvisPublics from "./components/AvisPublics.jsx";
import PagePaiement from "./components/PagePaiement.jsx";
import { lireLienPaye } from "./pricing/suiteClient.js";
import { lireLienProjet } from "./pricing/digital.js";
import { lireLienPartenaire } from "./pricing/partenaires.js";
import InstallerAppli from "./components/InstallerAppli.jsx";
import { lireLienCarte } from "./pricing/cartesCadeaux.js";
import { lireLienResto } from "./pricing/restos.js";
const EspaceResto = lazy(() => import("./components/EspaceResto.jsx")); // 19 nov. 2026 (V2) : #/resto/CLE
import { useVitrineRestos } from "./vitrineRestosBase.js";
const RestosVitrine = lazy(() => import("./components/RestosVitrine.jsx")); // 25 nov. 2026 : #/restaurants
const ProsAnnuaire = lazy(() => import("./components/ProsAnnuaire.jsx")); // 25 nov. 2026 : #/pros (caché jusqu'à l'accord de Rebecca)
const ProInscription = lazy(() => import("./components/ProInscription.jsx"));
const LaisserAvis = lazy(() => import("./components/LaisserAvis.jsx")); // 26 nov. 2026 : #/avis (QR dans la voiture) // 25 nov. 2026 : #/pro
const DevenirRestoPartenaire = lazy(() => import("./components/DevenirRestoPartenaire.jsx")); // 19 nov. 2026 : #/restaurant-partenaire
const ContratRestoVue = lazy(() => import("./components/ContratRestoVue.jsx")); // 19 nov. 2026 : #/contrat-resto/ID
const lireContratResto = (h) => { const m = /^#\/contrat-resto\/([A-Za-z0-9]{10,40})$/.exec(h || ""); return m ? m[1] : ""; };
const Assistance = lazy(() => import("./components/Assistance.jsx")); // 19 nov. 2026 : #/assistance
import { lireLienAssistance } from "./pricing/assistance.js";
import { enApercu, usePagesSite } from "./pagesSiteBase.js";
const OffrirCarte = lazy(() => import("./components/CarteCadeau.jsx"));
const VoirCarte = lazy(() => import("./components/CarteCadeau.jsx").then((m) => ({ default: m.VoirCarte })));
import "./client-commun.css";
import "./theme-site.css";

// Espace prive et espace client : charges seulement quand on les ouvre (un visiteur ne telecharge rien de plus)
const Admin = lazy(() => import("./Admin.jsx"));
const Compte = lazy(() => import("./Compte.jsx"));
const Legal = lazy(() => import("./Legal.jsx"));
// 17 nov. 2026 : questionnaire de devis Digital, suivi d'un projet (#/projet/ID), inscription des partenaires (#/partenaire)
const DemandeDigital = lazy(() => import("./components/DemandeDigital.jsx"));
const SuiviProjet = lazy(() => import("./components/SuiviProjet.jsx"));
const DevenirPartenaire = lazy(() => import("./components/DevenirPartenaire.jsx"));
const SuiviPartenaire = lazy(() => import("./components/SuiviPartenaire.jsx"));
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
// 15 nov. 2026 : le ramassage scolaire est ouvert a tous, meme quand le Transport prive est sur autorisation
const SERVICES_PUBLICS = ["ramassage"];

function SurDemande({ a, onChoix }) {
  return (
    <section className="espace" style={ESPACE} aria-labelledby={"titre-" + a.id}>
      <div style={ENTETE}>
        <span className="espace-icone" aria-hidden="true"><IconeService id={servicesDe(a.id)[0].id} /></span>
        <h2 id={"titre-" + a.id} style={TITRE}>{a.titre}</h2>
      </div>
      {onChoix && a.id === "transport" && (
        <div className="services">
          {SERVICES.filter((s) => SERVICES_PUBLICS.includes(s.id)).map((s) => (
            <Carte key={s.id} s={s} onClick={() => onChoix(s.id)} />
          ))}
        </div>
      )}
      <div className="sur-demande">
        <ul className="sur-demande-liste">
          {servicesDe(a.id).filter((s) => !SERVICES_PUBLICS.includes(s.id)).map((s) => (
            <li key={s.id}><IconeService id={s.id} taille={26} />{s.titre}</li>
          ))}
        </ul>
        <p className="sur-demande-message">Service disponible sur demande. Contactez-moi sur WhatsApp.</p>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, MESSAGE_ACCES)} target="_blank" rel="noopener noreferrer">Me contacter sur WhatsApp</a>
      </div>
    </section>
  );
}

// 20 nov. 2026 : page en mode « Bientôt » (Réglages -> Pages du site) : on récolte les contacts sur WhatsApp
const NOMS_PAGES = { coursier: "Services coursier", transport: "Transport privé", nails: "Nails Prestige", regenx: "RegenX", hair: "Prestige Hair", slim: "Prestige Slim & Lift", epoxy: "Boutique Epoxy", digital: "Digital & Applications", restoPartenaire: "le partenariat restaurants", coursierPartenaire: "le partenariat coursiers" };
function Bientot({ id, seul = false }) {
  const nom = NOMS_PAGES[id] || "ce service";
  const bouton = <a className="bouton" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, prévenez-moi dès que ${nom} est disponible, merci !`)} target="_blank" rel="noopener noreferrer">🔔 Me prévenir</a>;
  if (seul) return <><p className="consigne"><strong>Bientôt disponible.</strong></p>{bouton}</>;
  return (
    <section className="espace" style={ESPACE}>
      <div style={ENTETE}><h2 style={TITRE}>{nom}</h2></div>
      <p className="consigne"><strong>Bientôt disponible.</strong> Laissez-moi un message, je vous préviens dès l'ouverture.</p>
      {bouton}
    </section>
  );
}

// 20 nov. 2026 : page fermée (Réglages -> Pages du site, lien direct désactivé) ou personne bloquée : message neutre
function PageIndisponible({ onAccueil }) {
  return (
    <section className="carte-service" style={{ margin: 16 }}>
      <h2>Page indisponible</h2>
      <p>Ce service n'est pas disponible pour le moment.</p>
      <p><a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, j'ai une question.")} target="_blank" rel="noopener noreferrer">💬 Écrire à Rebecca</a></p>
      <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
    </section>
  );
}

function Accueil({ client, acces, pages, onChoix, onCompte, onFavori, onNails, onRegenX, onEpoxy, onSlim, onHair, onDigital }) {
  const restosVitrine = useVitrineRestos();
  const aujourdhui = utcVersLocal(Date.now()).date;
  const fermetures = prochainesFermetures(aujourdhui, 3);
  const dispo = etatDisponibilite();
  const ouvert = compteOuvert(client);
  // 20 nov. 2026 : Réglages -> Pages du site (affichée, « bientôt », pour qui, personnes bloquées)
  const voit = (id) => pages.etat(id) === "ouverte";
  const bientot = (id) => pages.etat(id) === "bientot";
  const favoris = ouvert && Array.isArray(client.profil.favoris) ? client.profil.favoris.filter((f) => SERVICES.some((s) => s.id === f.service && voit(s.activite))) : [];
  // 18 nov. 2026 : trajets habituels tires de son historique (réserver en 2 touches)
  const uidClient = ouvert && client.user ? client.user.uid : "";
  const [suivis, setSuivis] = useState([]);
  useEffect(() => {
    if (!uidClient) return setSuivis([]);
    Promise.all([import("./firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { collection, getDocs, query, where }]) => getDocs(query(collection(db, "suivi"), where("uid", "==", uidClient))))
      .then((s) => setSuivis(s.docs.map((x) => ({ id: x.id, ...x.data() }))))
      .catch(() => setSuivis([]));
  }, [uidClient]);
  const habituels = trajetsHabituels(suivis, favoris, FORMULAIRES).filter((f) => SERVICES.some((s) => s.id === f.service && voit(s.activite)));

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

      {habituels.length > 0 && (
        <section className="accueil-favoris">
          <h3>🔁 Réserver à nouveau</h3>
          <div>
            {habituels.map((f, i) => (
              <button key={"h" + i} type="button" onClick={() => onFavori(f)}>
                {f.nom}
              </button>
            ))}
          </div>
        </section>
      )}

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

      {/* Services coursier */}
      {bientot("coursier") && <Bientot id="coursier" />}
      {voit("coursier") && (
        <section className="espace" style={ESPACE}>
          <div style={ENTETE}>
            <Logo src={MEDAILLON} taille={52} />
            <h2 style={TITRE}>Services coursier</h2>
          </div>
          <p className="consigne">Livraisons, courses et petits déménagements. Le devis s'affiche en direct.</p>
          <div className="services">
            {servicesDe("coursier").map((s) => (
              <Carte key={s.id} s={s} onClick={() => onChoix(s.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Transport privé */}
      {bientot("transport") && <Bientot id="transport" />}
      {voit("transport") ? (
        <section className="espace" style={ESPACE}>
          <div style={ENTETE}>
            <span className="espace-icone" aria-hidden="true"><IconeService id="transport" /></span>
            <h2 style={TITRE}>Transport privé</h2>
          </div>
          <p className="consigne">Trajets, aéroport, Hatan & Kala, ramassage scolaire et mise à disposition. Le devis s'affiche en direct.</p>
          <div className="services">
            {servicesDe("transport").map((s) => (
              <Carte key={s.id} s={s} onClick={() => onChoix(s.id)} />
            ))}
          </div>
        </section>
      ) : pages.etat("transport") === "cachee" && pages.reglage("transport").visible ? (
        <SurDemande onChoix={onChoix} a={{ id: "transport", titre: "Transport privé", texte: "Trajets, aéroport, Hatan & Kala, ramassage scolaire et mise à disposition." }} />
      ) : null}

      {/* Beauté & bien-être */}
      <section className="espace" style={ESPACE}>
        <div style={ENTETE}>
          <Logo src="/brand/logo-prestige-beautys.png" taille={52} />
          <h2 style={TITRE}>Beauté & bien-être</h2>
        </div>
        <p className="consigne">Ongles, coiffure, reconstruction du cheveu et du poil, soins et beauté de la silhouette.</p>
        <div className="services">
          {bientot("nails") && <Bientot id="nails" />}
      {voit("nails") && (
            <button className="carte-service" onClick={onNails}>
              <span className="icone"><Logo src="/brand/logo-nails-prestige.png" /></span>
              <span className="corps"><strong>Nails Prestige</strong><small>Onglerie : semi-permanent, extensions, nail art…</small></span>
              <span className="prix">Réserver</span>
            </button>
          )}
          {bientot("regenx") && <Bientot id="regenx" />}
      {voit("regenx") && (
            <button className="carte-service" onClick={onRegenX}>
              <span className="icone"><Logo src="/brand/logo-regenx.png" /></span>
              <span className="corps"><strong>RegenX</strong><small>Reconstruction du cheveu et du poil</small></span>
              <span className="prix">Voir</span>
            </button>
          )}
          {bientot("hair") && <Bientot id="hair" />}
      {voit("hair") && (
            <button className="carte-service" onClick={onHair}>
              <span className="icone"><Logo src="/brand/logo-prestige-hair.png" /></span>
              <span className="corps"><strong>Prestige Hair</strong><small>Coupe, couleur, brushing, soirée…</small></span>
              <span className="prix">Voir</span>
            </button>
          )}
          {bientot("slim") && <Bientot id="slim" />}
      {voit("slim") && (
            <button className="carte-service" onClick={onSlim}>
              <span className="icone"><Logo src="/brand/logo-prestige-slim-lift.png" /></span>
              <span className="corps"><strong>Prestige Slim & Lift</strong><small>Soins minceur et raffermissement</small></span>
              <span className="prix">Voir</span>
            </button>
          )}
        </div>
      </section>

      {/* Boutique Epoxy */}
      {bientot("epoxy") && <Bientot id="epoxy" />}
      {voit("epoxy") && (
        <section className="espace" style={ESPACE}>
          <div style={ENTETE}>
            <Logo src="/brand/logo-epoxy.png" taille={52} />
            <h2 style={TITRE}>Boutique Epoxy</h2>
          </div>
          <p className="consigne">Créations personnalisées en résine : décoration, rangement, Chabbat et fêtes, lampes, bougies…</p>
          <button className="bouton" onClick={onEpoxy}>Voir la boutique</button>
        </section>
      )}

      {/* Digital & Applications */}
      {bientot("digital") && <Bientot id="digital" />}
      {voit("digital") && (
        <section className="espace" style={ESPACE}>
          <div style={ENTETE}>
            <Logo src="/brand/logo-digital-applications.png" taille={52} />
            <h2 style={TITRE}>Digital & Applications</h2>
          </div>
          <p className="consigne">Création de sites web et d'applications professionnelles.</p>
          <button className="bouton" onClick={onDigital}>Découvrir</button>
        </section>
      )}



      {/* 25 nov. 2026 : nos restaurants partenaires (visible dès qu'un restaurant est ajouté dans l'admin) */}
      {restosVitrine && restosVitrine.length > 0 && (
        <section className="espace" style={ESPACE}>
          <div style={ENTETE}><span className="espace-icone" aria-hidden="true" style={{ fontSize: 30 }}>🍽️</span><h2 style={TITRE}>Nos restaurants partenaires</h2></div>
          <p className="consigne">Menus, horaires et contacts. Vous commandez au restaurant, je vous livre.</p>
          <a className="bouton" href="#/restaurants">Voir les restaurants</a>
        </section>
      )}

      {/* 20 nov. 2026 : pages partenaires affichées en carte sur l'accueil (Réglages -> Pages du site) */}
      {[["restoPartenaire", "🍕", "Restaurants : devenez partenaire", "Je livre vos commandes à vos clients, à prix fixe, sans commission sur vos ventes.", "#/restaurant-partenaire"], ["coursierPartenaire", "🛵", "Devenez coursier partenaire", "Livraisons et courses à Netanya, avec votre véhicule.", "#/partenaire"]]
        .filter(([id]) => pages.reglage(id).ou === "accueil" && (voit(id) || bientot(id)))
        .map(([id, icone, titre, texte, lien]) => (
          <section key={id} className="espace" style={ESPACE}>
            <div style={ENTETE}><span className="espace-icone" aria-hidden="true" style={{ fontSize: 30 }}>{icone}</span><h2 style={TITRE}>{titre}</h2></div>
            <p className="consigne">{texte}</p>
            {voit(id) ? <a className="bouton" href={lien}>Découvrir</a> : <Bientot id={id} seul />}
          </section>
        ))}

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
  const pages = usePagesSite(client, acces);
  useFermetures();

  const [lienPartage, setLienPartage] = useState(() => lireLienPartage(window.location.hash));
  // Etape 2 (15 nov. 2026) : lien de bienvenue d'une famille acceptee (prix, compte, enfants dans « Mes enfants »)
  const [lienBienvenue, setLienBienvenue] = useState(() => lireLienBienvenue(window.location.hash));
  // Lien direct du formulaire de ramassage (15 nov. 2026) : Rebecca l'envoie a une cliente sur WhatsApp
  const [lienRamassage, setLienRamassage] = useState(() => window.location.hash === "#/ramassage");
  // 17 nov. 2026 : page « Payer et me prevenir » (#/paye/...)
  const [lienPayeVu, setLienPayeVu] = useState(() => lireLienPaye(window.location.hash));
  const [lienProjetVu, setLienProjetVu] = useState(() => lireLienProjet(window.location.hash));
  const [lienPartenaire, setLienPartenaire] = useState(() => window.location.hash === "#/partenaire");
  const [suiviPartenaire, setSuiviPartenaire] = useState(() => lireLienPartenaire(window.location.hash));
  // 18 nov. 2026 : carte cadeau (#/cadeau = offrir, #/cadeau/ID = voir sa carte)
  // 19 nov. 2026 (V2) : suivi GPS en direct de la voiture (#/position/ID)
  const [lienPositionVu, setLienPositionVu] = useState(() => lireLienPosition(window.location.hash));
  const [lienResto, setLienResto] = useState(() => lireLienResto(window.location.hash));
  const [lienAssistance, setLienAssistance] = useState(() => lireLienAssistance(window.location.hash));
  const [lienAvis, setLienAvis] = useState(() => window.location.hash === "#/avis");
  const [lienInscriptionResto, setLienInscriptionResto] = useState(() => window.location.hash === "#/restaurant-partenaire");
  const [lienVitrine, setLienVitrine] = useState(() => window.location.hash === "#/restaurants");
  const lirePros = (h) => (/^#\/pros(\/[A-Za-z0-9_-]{2,30})?$/.test(h) ? "annuaire" : h === "#/pro" ? "inscription" : "");
  const [lienPros, setLienPros] = useState(() => lirePros(window.location.hash));
  const [lienContratResto, setLienContratResto] = useState(() => lireContratResto(window.location.hash));
  const [lienCadeau, setLienCadeau] = useState(() => (window.location.hash === "#/cadeau" ? "offrir" : lireLienCarte(window.location.hash)));
  useEffect(() => {
    const suivre = () => {
      setAdmin(enAdmin());
      setLienPartage(lireLienPartage(window.location.hash));
      setLienBienvenue(lireLienBienvenue(window.location.hash));
      setLienRamassage(window.location.hash === "#/ramassage");
      setLienPayeVu(lireLienPaye(window.location.hash));
      setLienProjetVu(lireLienProjet(window.location.hash));
      setLienPartenaire(window.location.hash === "#/partenaire");
      setSuiviPartenaire(lireLienPartenaire(window.location.hash));
      setLienCadeau(window.location.hash === "#/cadeau" ? "offrir" : lireLienCarte(window.location.hash));
      setLienPositionVu(lireLienPosition(window.location.hash));
      setLienResto(lireLienResto(window.location.hash));
      setLienInscriptionResto(window.location.hash === "#/restaurant-partenaire");
      setLienVitrine(window.location.hash === "#/restaurants");
      setLienPros(lirePros(window.location.hash));
      setLienAssistance(lireLienAssistance(window.location.hash));
      setLienAvis(window.location.hash === "#/avis");
      setLienContratResto(lireContratResto(window.location.hash));
    };
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);

  useEffect(() => {
    if (!enAdmin()) demarrer();
  }, []);

  // Compte cree (ou connexion) depuis un lien de bienvenue : on y revient pour ajouter ses enfants
  const ouvertCompte = compteOuvert(client);
  useEffect(() => {
    if (!ouvertCompte) return;
    try {
      const inv = JSON.parse(window.localStorage.getItem(CLE_INVITATION) || "null");
      if (inv && inv.id && /^#?$/.test(window.location.hash.replace(/^#\/?$/, ""))) window.location.hash = `#/bienvenue/${inv.id}/${inv.famille || 0}`;
    } catch {
      /* sans importance */
    }
  }, [ouvertCompte]);

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
    if (!s || (!SERVICES_PUBLICS.includes(s.id) && pages.etat(s.activite) !== "ouverte")) return aller({ nom: "accueil" });
    aller({ nom: "form", service, depart, cle: Date.now() });
  };

  if (admin) {
    return <Suspense fallback={chargement}><Admin /></Suspense>;
  }

  if (lienPayeVu && !admin)
    return (
      <div className="appli theme-site">
        <main>
          <PagePaiement lien={lienPayeVu} onAccueil={() => { window.location.hash = ""; setLienPayeVu(null); }} />
        </main>
      </div>
    );
  const quitterLien = () => {
    window.location.hash = "";
    setLienProjetVu(null);
    setLienPartenaire(false);
    setSuiviPartenaire("");
    aller({ nom: "accueil" });
  };
  if (lienProjetVu)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <SuiviProjet id={lienProjetVu} onAccueil={quitterLien} />
          </Suspense>
        </main>
      </div>
    );
  const quitterResto = () => { window.location.hash = ""; setLienInscriptionResto(false); setLienContratResto(""); aller({ nom: "accueil" }); };
  if (lienAvis)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <LaisserAvis onAccueil={() => { window.location.hash = ""; setLienAvis(false); aller({ nom: "accueil" }); }} onCompte={() => { window.location.hash = ""; setLienAvis(false); versCompte("historique"); }} />
          </Suspense>
        </main>
      </div>
    );
  if (lienAssistance)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <Assistance lien={lienAssistance} onAccueil={() => { window.location.hash = ""; setLienAssistance(null); aller({ nom: "accueil" }); }} />
          </Suspense>
        </main>
      </div>
    );
  if (lienVitrine)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <RestosVitrine onAccueil={() => { window.location.hash = ""; setLienVitrine(false); aller({ nom: "accueil" }); }} />
          </Suspense>
        </main>
      </div>
    );
  if (lienPros) {
    const quitterPros = () => { window.location.hash = ""; setLienPros(""); aller({ nom: "accueil" }); };
    const idPage = lienPros === "annuaire" ? "pros" : "proInscription";
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            {!pages.charge ? chargement : !pages.lienOk(idPage) ? <PageIndisponible onAccueil={quitterPros} /> : lienPros === "annuaire" ? <ProsAnnuaire onAccueil={quitterPros} /> : <ProInscription onAccueil={quitterPros} />}
          </Suspense>
        </main>
      </div>
    );
  }
  if (lienInscriptionResto || lienContratResto)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            {lienContratResto ? <ContratRestoVue id={lienContratResto} onAccueil={quitterResto} /> : !pages.charge ? chargement : !pages.lienOk("restoPartenaire") ? <PageIndisponible onAccueil={quitterResto} /> : <DevenirRestoPartenaire onAccueil={quitterResto} />}
          </Suspense>
        </main>
      </div>
    );
  if (lienResto && !admin)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <EspaceResto cle={lienResto} onAccueil={() => { window.location.hash = ""; setLienResto(""); aller({ nom: "accueil" }); }} />
          </Suspense>
        </main>
      </div>
    );
  if (lienPositionVu && !admin)
    return (
      <div className="appli theme-site">
        <main>
          <VoirPosition id={lienPositionVu} onAccueil={quitterLien} />
        </main>
      </div>
    );
  if (lienCadeau && !admin)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            {lienCadeau === "offrir" ? <OffrirCarte onAccueil={quitterLien} /> : <VoirCarte id={lienCadeau} onAccueil={quitterLien} />}
          </Suspense>
        </main>
      </div>
    );
  if (suiviPartenaire)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            <SuiviPartenaire id={suiviPartenaire} onAccueil={quitterLien} />
          </Suspense>
        </main>
      </div>
    );
  if (lienPartenaire)
    return (
      <div className="appli theme-site">
        <main>
          <Suspense fallback={chargement}>
            {!pages.charge ? chargement : !pages.lienOk("coursierPartenaire") ? <PageIndisponible onAccueil={quitterLien} /> : <DevenirPartenaire onAccueil={quitterLien} onLegal={() => { quitterLien(); aller({ nom: "legal" }); }} />}
          </Suspense>
        </main>
      </div>
    );
  return (
    <div className="appli theme-site">
      <main>
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "accueil" && (
          <>
          {enApercu() && <p className="consigne" role="status" style={{ background: "#3a2a2e", padding: 8, borderRadius: 8 }}>👁️ Aperçu : tu vois l'accueil comme une cliente sans compte.</p>}
          <Accueil client={enApercu() ? { phase: "anonyme", user: null, profil: null } : client} acces={enApercu() ? {} : acces} pages={pages} onChoix={(id) => versFormulaire(id)} onCompte={() => versCompte()} onFavori={(f) => versFormulaire(f.service, { details: f.details })} onNails={() => aller({ nom: "catalogue-nails" })} onRegenX={() => aller({ nom: "catalogue-regenx" })} onEpoxy={() => aller({ nom: "catalogue-epoxy" })} onSlim={() => aller({ nom: "catalogue-slim" })} onHair={() => aller({ nom: "catalogue-hair" })} onDigital={() => aller({ nom: "catalogue-digital" })} />
          </>
        )}
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "accueil" && (
          <section className="accueil-favoris">
            <h3>🎁 Une idée cadeau ?</h3>
            <div><button type="button" onClick={() => { window.location.hash = "#/cadeau"; }}>Offrir une carte cadeau</button></div>
          </section>
        )}
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "accueil" && <InstallerAppli />}
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "accueil" && <AvisPublics />}
        {ecran.nom === "catalogue-nails" && (
          <CatalogueNails onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-regenx" && (
          <CatalogueRegenX onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-epoxy" && (
          <CatalogueEpoxy onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-slim" && (
          <CatalogueSlim onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-hair" && (
          <CatalogueHair onRetour={() => aller({ nom: "accueil" })} />
        )}
        {ecran.nom === "catalogue-digital" && (
          <CatalogueDigital onRetour={() => aller({ nom: "accueil" })} onDevis={() => aller({ nom: "devis-digital" })} />
        )}
        {ecran.nom === "devis-digital" && (
          <Suspense fallback={chargement}>
            <DemandeDigital onRetour={() => aller({ nom: "catalogue-digital" })} onLegal={() => aller({ nom: "legal" })} />
          </Suspense>
        )}
        {lienBienvenue && (
          <BienvenueRamassage
            key={lienBienvenue.id + lienBienvenue.famille}
            id={lienBienvenue.id}
            famille={lienBienvenue.famille}
            onRetour={() => {
              window.location.hash = "";
              aller({ nom: "accueil" });
            }}
            onCompte={() => {
              window.location.hash = "";
              versCompte(undefined, "inscription");
            }}
          />
        )}
        {!lienBienvenue && lienPartage && (
          <PartageRamassage
            key={lienPartage.id + lienPartage.famille}
            id={lienPartage.id}
            famille={lienPartage.famille}
            onRetour={() => {
              window.location.hash = "";
              aller({ nom: "accueil" });
            }}
          />
        )}
        {!lienBienvenue && !lienPartage && lienRamassage && (
          <DemandeRamassage
            key="lien-ramassage"
            onRetour={() => {
              window.location.hash = "";
              aller({ nom: "accueil" });
            }}
          />
        )}
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "form" && ecran.service === "ramassage" && (
          <DemandeRamassage key={"ramassage" + ecran.cle} depart={ecran.depart} onRetour={() => aller({ nom: "accueil" })} />
        )}
        {!lienBienvenue && !lienPartage && !lienRamassage && ecran.nom === "form" && ecran.service !== "ramassage" && (
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
        <a className="lien" href="#/assistance" style={{ display: "inline-block", textDecoration: "none" }}>💬 Assistance</a>
        <br />
        <a className="lien" href={LIEN_INSTAGRAM} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
          Instagram @{INSTAGRAM}
        </a>
        <br />
        <button type="button" className="lien" onClick={() => aller({ nom: "legal" })}>
          Confidentialité et conditions
        </button>
        {/* 20 nov. 2026 : liens « Devenir partenaire » en bas de page (Réglages -> Pages du site) */}
        {[["restoPartenaire", "Restaurants : devenez partenaire livraison", "#/restaurant-partenaire"], ["coursierPartenaire", "Devenir coursier partenaire de Rebecca Services", "#/partenaire"], ["pros", "Professionnels partenaires (annuaire)", "#/pros"], ["proInscription", "Vous êtes professionnel ? Rejoignez l'annuaire", "#/pro"]]
          .filter(([id]) => pages.reglage(id).ou === "pied" && pages.etat(id) === "ouverte")
          .map(([id, texte, lien]) => <span key={id}><br /><a className="lien" href={lien}>{texte}</a></span>)}
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
