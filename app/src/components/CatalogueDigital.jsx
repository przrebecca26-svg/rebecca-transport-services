import { useEffect, useState } from "react";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { ecouterCatalogue } from "../catalogueClient.js";
import { libellePrix } from "../pricing/catalogue.js";
import { VISUELS } from "../visuels.js";
import { CONDITIONS_COMMUNES, FICHES_FORMULES, FICHES_MAINTENANCE, messageConsultation } from "../pricing/digital.js";

// PAGE DIGITAL & APPLICATIONS (17 nov. 2026)
// Les prix viennent du catalogue (Reglages → Catalogue → Digital) : un seul endroit pour les changer.
// Une fiche depliable par formule et par maintenance (contenu valide le 5 nov.), le questionnaire de devis,
// la consultation gratuite de 30 min, et toujours le bouton WhatsApp.
const demander = (quoi) => lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je souhaite des informations sur : ${quoi} (Digital & Applications).`);
const ICONES = { "Sérénité": "/digital/maintenance-serenite.svg", Confort: "/digital/maintenance-confort.svg", Premium: "/digital/maintenance-premium.svg" };

function Fiche({ p, ouvert, basculer, children }) {
  return (
    <div className="carte-service" style={{ cursor: "default", flexDirection: "column", alignItems: "stretch" }}>
      <button type="button" className="lien" onClick={basculer} aria-expanded={ouvert} style={{ textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
        <strong>{p.nom}</strong>
        <span className="prix">{libellePrix(p)}{p.categorie === "Maintenance" ? " / mois" : ""}</span>
      </button>
      {p.description && <small style={{ display: "block", marginTop: 4 }}>{p.description.replace(/^Par mois\.\s*/, "")}</small>}
      {ouvert && <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{children}</div>}
      <button type="button" className="lien" onClick={basculer} style={{ marginTop: 6, fontSize: 13 }}>{ouvert ? "Fermer le détail ▲" : "Voir le détail ▼"}</button>
      <a className="lien" href={demander(p.nom)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4 }}>
        Demander sur WhatsApp
      </a>
    </div>
  );
}

export default function CatalogueDigital({ onRetour, onDevis }) {
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState("");
  useEffect(() => ecouterCatalogue("digital", (l) => setListe(l)), []);
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
          <Fiche key={p.id} p={p} ouvert={ouvert === p.id} basculer={() => basculer(p.id)}>
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
          <Fiche key={p.id} p={p} ouvert={ouvert === p.id} basculer={() => basculer(p.id)}>
            {ICONES[p.nom] && <img src={ICONES[p.nom]} alt="" style={{ width: 56, height: 56, borderRadius: 8, float: "right", marginLeft: 8 }} />}
            {f ? (
              <>
                <p><strong>Pour qui :</strong> {f.pourQui}</p>
                <p><strong>Temps de travail inclus :</strong> {f.temps}</p>
                <p><strong>Délai :</strong> {f.delai}</p>
                <p><strong>Interventions :</strong> {f.interventions}</p>
                <p style={{ clear: "both" }}>Chaque mois, un court résumé : ce qui a été fait et le temps utilisé. Un dépassement n'est facturé qu'après votre accord.</p>
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
          {VISUELS.digital[p.nom] && <img src={VISUELS.digital[p.nom]} alt="" style={{ width: 64, height: 64, borderRadius: 8, marginRight: 8, flex: "none" }} />}
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
