import { useState } from "react";
import ServiceForm from "./components/ServiceForm.jsx";
import { SERVICES } from "./services.js";
import { prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";
import { NOM, SIGNATURE } from "./contact.js";

const jourFr = (d) => d.split("-").reverse().join("/");

function Accueil({ onChoix }) {
  const aujourdhui = utcVersLocal(Date.now()).date;
  const fermetures = prochainesFermetures(aujourdhui, 3);
  return (
    <>
      <section className="hero">
        <p className="surtitre">Netanya · toute Israël</p>
        <h1>{NOM}</h1>
        <p className="signature">« {SIGNATURE} »</p>
      </section>

      <section aria-labelledby="titre-services">
        <h2 id="titre-services" className="sr-only">Choisissez votre service</h2>
        <p className="consigne">Choisissez votre service : le devis s'affiche en direct.</p>
        <div className="services">
          {SERVICES.map((s) => (
            <button key={s.id} className="carte-service" onClick={() => onChoix(s.id)}>
              <span className="icone" aria-hidden="true">{s.icone}</span>
              <span className="corps">
                <strong>{s.titre}</strong>
                <small>{s.texte}</small>
              </span>
              <span className="prix">{s.prix}</span>
            </button>
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

function Envoye({ info, onRetour }) {
  return (
    <section className="envoye">
      <div className="coche" aria-hidden="true">✓</div>
      <h2>Votre demande est prête</h2>
      <p>WhatsApp s'est ouvert avec le résumé de votre demande ({info.service}). <strong>Appuyez sur « Envoyer »</strong> dans WhatsApp pour la transmettre à Rebecca.</p>
      <p>Rebecca vérifie ses disponibilités puis vous confirme la réservation. Rien n'est réservé tant qu'elle n'a pas confirmé.</p>
      <a className="bouton" href={info.url} target="_blank" rel="noopener noreferrer">Rouvrir WhatsApp</a>
      <button className="lien" onClick={onRetour}>Faire une autre demande</button>
    </section>
  );
}

export default function App() {
  const [ecran, setEcran] = useState({ nom: "accueil" });
  const aller = (e) => {
    setEcran(e);
    window.scrollTo(0, 0);
  };
  return (
    <div className="appli">
      <main>
        {ecran.nom === "accueil" && <Accueil onChoix={(id) => aller({ nom: "form", service: id })} />}
        {ecran.nom === "form" && (
          <ServiceForm key={ecran.service} service={ecran.service} onRetour={() => aller({ nom: "accueil" })} onEnvoye={(info) => aller({ nom: "envoye", info })} />
        )}
        {ecran.nom === "envoye" && <Envoye info={ecran.info} onRetour={() => aller({ nom: "accueil" })} />}
      </main>
      <footer>
        <small>{NOM} · Aucun service pendant Chabbat et les fêtes</small>
      </footer>
    </div>
  );
}
