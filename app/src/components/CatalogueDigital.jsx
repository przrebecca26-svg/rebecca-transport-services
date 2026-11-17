import { useEffect, useState } from "react";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { ecouterCatalogue, ecouterPhotos } from "../catalogueClient.js";
import { libellePrix } from "../pricing/catalogue.js";
import { VISUELS } from "../visuels.js";
import { CONDITIONS_COMMUNES, FICHES_FORMULES, FICHES_MAINTENANCE, messageConsultation } from "../pricing/digital.js";

// PAGE DIGITAL & APPLICATIONS (17 nov. 2026)
// Les prix viennent du catalogue (Reglages → Catalogue → Digital) : un seul endroit pour les changer.
// Une fiche depliable par formule et par maintenance (contenu valide le 5 nov.), le questionnaire de devis,
// la consultation gratuite de 30 min, et toujours le bouton WhatsApp.
const demander = (quoi) => lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je souhaite des informations sur : ${quoi} (Digital & Applications).`);

// 17 nov. 2026 : carte comme les autres activites (photo a gauche, nom + detail au milieu, prix a droite).
// Photo : celle mise dans Reglages → Catalogue, sinon l'image du site.
function Fiche({ p, photo, ouvert, basculer, children }) {
  return (
    <div className="carte-service" style={{ cursor: "default" }}>
      {photo && <img src={photo} alt="" />}
      <span className="corps">
        <strong>{p.nom}</strong>
        {p.description && <small>{p.description.replace(/^Par mois\.\s*/, "")}</small>}
        {ouvert && <span style={{ display: "block", marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{children}</span>}
        <span style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
          <button type="button" className="lien" onClick={basculer} aria-expanded={ouvert} style={{ padding: 0, fontSize: 13 }}>{ouvert ? "Fermer le détail ▲" : "Voir le détail ▼"}</button>
          <a className="lien" href={demander(p.nom)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>WhatsApp</a>
        </span>
      </span>
      <span className="prix">{p.typePrix === "devis" ? "Sur devis" : libellePrix(p).replace("À partir de", "dès")}{p.categorie === "Maintenance" ? " / mois" : ""}</span>
    </div>
  );
}

export default function CatalogueDigital({ onRetour, onDevis }) {
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState("");
  useEffect(() => ecouterCatalogue("digital", (l) => setListe(l)), []);
  const [photos, setPhotos] = useState({});
  useEffect(() => ecouterPhotos("digital", (par) => setPhotos(par)), []);
  const photoDe = (p) => (photos[p.id] && photos[p.id][0]) || VISUELS.digital[p.nom] || "";
  const de = (cat) => liste.filter((p) => p.categorie === cat);
  const basculer = (id) => setOuvert((o) => (o === id ? "" : id));
  const consultation = lienWhatsApp(WHATSAPP, messageConsultation());

  return (
    <section className="catalogue-nails">
      <button className="lien" onClick={onRetour}>← Accueil</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-digital-applications.png" alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
        <h2>Digital & Applications</h2>
      </div>
      <img src="/digital/hero.jpg" alt="Digital & Applications" style={{ width: "100%", maxWidth: 480, borderRadius: 12, margin: "12px 0" }} />
      <p>Création de sites web et d'applications professionnelles, sur mesure, pour les indépendants et les entreprises.</p>

      <div className="bloc" style={{ padding: 14 }}>
        <p style={{ marginTop: 0 }}><strong>Parlons de votre projet.</strong> Chaque projet est étudié individuellement : les tarifs affichés sont indicatifs, un devis personnalisé est établi après analyse de vos besoins.</p>
        <button type="button" className="bouton" onClick={onDevis}>Demander un devis</button>
        <a className="bouton bouton-secondaire" href={consultation} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
          Réserver ma consultation gratuite (30 min)
        </a>
      </div>

      <h3>Formules</h3>
      {de("Formules").map((p) => {
        const f = FICHES_FORMULES[p.nom];
        return (
          <Fiche key={p.id} p={p} photo={photoDe(p)} ouvert={ouvert === p.id} basculer={() => basculer(p.id)}>
            {f ? (
              <>
                <p><strong>Pour qui :</strong> {f.pourQui}</p>
                <p><strong>Délai indicatif :</strong> {f.delai}</p>
                <p><strong>{f.inclusTitre || "Ce qui est inclus"} :</strong></p>
                <ul>{f.inclus.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            ) : (
              <p>{p.description}</p>
            )}
          </Fiche>
        );
      })}

      <h3>Forfaits de maintenance</h3>
      <p style={{ fontSize: 14, color: "var(--gris)" }}>Facultatifs et distincts de la garantie corrective gratuite de 60 jours.</p>
      {de("Maintenance").map((p) => {
        const f = FICHES_MAINTENANCE[p.nom];
        return (
          <Fiche key={p.id} p={p} photo={photoDe(p)} ouvert={ouvert === p.id} basculer={() => basculer(p.id)}>
            {f ? (
              <>
                <p><strong>Pour qui :</strong> {f.pourQui}</p>
                <p><strong>Temps de travail inclus :</strong> {f.temps}</p>
                <p><strong>Délai :</strong> {f.delai}</p>
                <p><strong>Interventions :</strong> {f.interventions}</p>
                <p>Chaque mois, un court résumé : ce qui a été fait et le temps utilisé. Un dépassement n'est facturé qu'après votre accord.</p>
              </>
            ) : (
              <p>{p.description}</p>
            )}
          </Fiche>
        );
      })}

      {de("Études").length > 0 && <h3>Consultation et études</h3>}
      {de("Études").map((p) => (
        <div key={p.id} className="carte-service" style={{ cursor: "default" }}>
          {photoDe(p) && <img src={photoDe(p)} alt="" />}
          <span className="corps">
            <strong>{p.nom}</strong>
            <small>{p.description}</small>
          </span>
          <span className="prix">{p.prix === 0 ? "Gratuite" : libellePrix(p)}</span>
        </div>
      ))}

      {de("Options").length > 0 && <h3>Options</h3>}
      {de("Options").length > 0 && <p style={{ fontSize: 14, color: "var(--gris)" }}>Chaque option est évaluée et chiffrée dans le devis.</p>}
      {de("Options").map((p) => (
        <div key={p.id} className="carte-service" style={{ cursor: "default" }}>
          {photoDe(p) && <img src={photoDe(p)} alt="" />}
          <span className="corps">
            <strong>{p.nom}</strong>
            <small>{p.description}</small>
          </span>
          <span className="prix">{libellePrix(p).replace("À partir de", "dès")}</span>
        </div>
      ))}

      <h3>Conditions</h3>
      <ul style={{ fontSize: 14, lineHeight: 1.5 }}>
        {CONDITIONS_COMMUNES.map((x) => <li key={x}>{x}</li>)}
      </ul>

      <button type="button" className="bouton" onClick={onDevis}>Demander un devis</button>
      <a className="lien" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite discuter d'un projet Digital & Applications.")} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 10 }}>
        Discuter du projet sur WhatsApp
      </a>
    </section>
  );
}
