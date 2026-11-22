import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useEquipeContexte } from "../equipeContexte.jsx";
import { chronoDe, champsAnnulerEtape, champsEtape, faitDe, prixDe } from "../pricing/finCourse.js";
import { derniereEtapeTournee, etatTournee, ordreLivraisons } from "../pricing/tourneeResto.js";
import { messageAideResto, messageAvisResto, messageEnRouteResto, messageMerciResto } from "../pricing/restos.js";
import { lienWazePoint, lienWhatsApp } from "../pricing/navigation.js";
import { synchroniserSuivi } from "../suiviClient.js";
import { apresChamps } from "../pricing/finCourse.js";

// TOURNEE RESTAURANT GROUPEE dans le Calendrier (22 nov. 2026, Rebecca) : plusieurs commandes du meme restaurant
// pretes a 10 min pres = UNE carte. Partie, arrivee au restaurant et recuperation : une seule fois pour toutes.
// Puis les livraisons dans le meilleur ordre (on finit par la plus proche de la maison), chacune « ✓ Déposée ».
const heureIsrael = () => new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
const h = (x) => String(x || "").replace(":", "h");

export default function TourneeResto({ tournee, domicile = null, seule = null, aujourdhui = "" }) {
  const { moi } = useEquipeContexte();
  const [aPart, setAPart] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const ordre = ordreLivraisons(tournee, domicile);
  const e = etatTournee(tournee);
  const premier = tournee[0];
  const nomResto = premier.nom || "Restaurant";
  const telResto = premier.telephone && premier.telephone !== "000" ? premier.telephone : "";
  const resto = (premier.details || {}).recuperation;
  const total = tournee.reduce((s, d) => s + prixDe(d), 0);
  const heures = tournee.map((d) => d.heure).sort();
  const visible = tournee.some((d) => d.date <= aujourdhui) || !aujourdhui;

  const ecrire = async (liste) => {
    setErreur("");
    setEnCours(true);
    try {
      for (const { d, champs } of liste) {
        if (!champs) continue;
        await updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() });
        synchroniserSuivi(apresChamps(d, champs));
      }
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  // Etape commune : seulement pour les commandes qui ne l'ont pas encore
  const commune = (etape) => {
    const heure = heureIsrael();
    return ecrire(tournee.filter((d) => !chronoDe(d)[etape] && !faitDe(d)).map((d) => ({ d, champs: champsEtape(d, etape, heure, moi) })));
  };
  const deposer = (d) => ecrire([{ d, champs: champsEtape(d, "depose", heureIsrael(), moi) }]);
  const rentrer = () => {
    const heure = heureIsrael();
    return ecrire(tournee.filter((d) => !chronoDe(d).maison).map((d) => ({ d, champs: champsEtape(d, "maison", heure, moi) })));
  };
  const annuler = () => {
    const x = derniereEtapeTournee(tournee);
    if (!x) return undefined;
    return ecrire(tournee.filter((d) => x.ids.includes(d.id)).map((d) => ({ d, champs: champsAnnulerEtape(d) })));
  };
  const avisDemande = tournee.some((d) => d.avisDemandeLe);
  const noterAvis = () => ecrire(tournee.map((d) => ({ d, champs: { avisDemandeLe: aujourdhui } })));
  const prochaine = e.prise ? ordre.find((d) => !e.deposees.includes(d.id)) : null;

  if (aPart && seule) {
    return (
      <div className="ag-tournee-resto">
        <button type="button" className="ag-modifier" onClick={() => setAPart(false)}>↩ Revoir en une seule tournée</button>
        {tournee.map((d) => <div key={d.id}>{seule(d)}</div>)}
      </div>
    );
  }
  return (
    <div className={"ag-event ag-" + (e.toutesDeposees ? "terminee" : "acceptee")} style={{ borderLeft: "4px solid #7b5cff" }}>
      <div className="ag-event-tete" style={{ cursor: "default" }}>
        <span className="ag-heure">{heures[0]}</span>
        <span className="ag-corps">
          <strong>🍕 Tournée {nomResto} · {tournee.length} commandes</strong>
          <small>Prêtes {heures.map(h).join(" et ")} · {Math.round(total * 100) / 100} ₪ (relevé de la semaine)</small>
        </span>
        <span className={"tb-badge tb-" + (e.toutesDeposees ? "terminee" : "acceptee")}>{e.toutesDeposees ? "Terminée" : "Acceptée"}</span>
      </div>
      {visible && (
        <div className="ag-fin">
          <div className="ag-fin-chrono">
            {e.partie && <span className="ag-fin-etape oui">Partie</span>}
            {e.arrivee && <span className="ag-fin-etape oui">Arrivée au resto</span>}
            {e.prise && <span className="ag-fin-etape oui">{tournee.length} récupérées</span>}
            {e.deposees.length > 0 && <span className="ag-fin-etape oui">{e.deposees.length}/{tournee.length} livrées</span>}
            {e.rentree && <span className="ag-fin-etape oui">Rentrée</span>}
          </div>
          <div className="tb-actions">
            {!e.partie && <button type="button" className="tb-bouton" disabled={enCours} onClick={() => commune("depart")}>🚗 Partie (pour les {tournee.length})</button>}
            {!e.arrivee && <button type="button" className={"tb-bouton" + (e.partie ? "" : " tb-clair")} disabled={enCours} onClick={() => commune("arrivee")}>📍 Arrivée au restaurant</button>}
            {!e.prise && <button type="button" className={"tb-bouton" + (e.arrivee ? "" : " tb-clair")} disabled={enCours} onClick={() => commune("prise")}>📦 Récupérées (les {tournee.length})</button>}
            {e.arrivee && !e.prise && telResto && <a className="tb-bouton tb-clair" href={lienWhatsApp(telResto, messageAideResto("attente", nomResto, { client: "", pretA: heures[heures.length - 1] }))} target="_blank" rel="noopener noreferrer">⏳ Pas prête ?</a>}
            {resto && resto.lat != null && !e.prise && <a className="tb-bouton tb-clair" href={lienWazePoint(resto)} target="_blank" rel="noopener noreferrer">Waze resto</a>}
          </div>
          <div className="ag-tournee-liste" style={{ margin: "8px 0" }}>
            {ordre.map((d, i) => {
              const v = d.details || {};
              const faite = e.deposees.includes(d.id);
              const estProchaine = prochaine && prochaine.id === d.id;
              const depose = chronoDe(d).depose;
              return (
                <div key={d.id} style={{ marginBottom: 10, opacity: faite ? 0.7 : 1 }}>
                  <strong>{i + 1}. {v.destinataire || "Client"}</strong> · {prixDe(d)} ₪{faite ? ` · ✓ livrée${depose ? " " + h(depose) : ""}` : estProchaine ? " · 👉 prochaine" : ""}
                  <br /><small dir="auto">{v.livraison ? v.livraison.label : ""}{v.instructions ? ` · 📝 ${v.instructions}` : ""}</small>
                  <div className="tb-actions">
                    {!faite && v.livraison && v.livraison.lat != null && <a className="tb-bouton tb-clair" href={lienWazePoint(v.livraison)} target="_blank" rel="noopener noreferrer">Waze</a>}
                    {!faite && estProchaine && v.telDestinataire && <a className="tb-bouton tb-clair" href={lienWhatsApp(v.telDestinataire, messageEnRouteResto(d))} target="_blank" rel="noopener noreferrer">💬 En route (au client)</a>}
                    {!faite && e.prise && <button type="button" className={"tb-bouton" + (estProchaine ? "" : " tb-clair")} disabled={enCours} onClick={() => deposer(d)}>✓ Déposée</button>}
                    {faite && telResto && <a className="tb-bouton tb-clair" href={lienWhatsApp(telResto, messageMerciResto(d, depose || ""))} target="_blank" rel="noopener noreferrer">💬 Merci au restaurant</a>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="tb-actions">
            {e.toutesDeposees && !e.rentree && <button type="button" className="tb-bouton" disabled={enCours} onClick={rentrer}>🏠 Rentrée</button>}
            {e.toutesDeposees && !avisDemande && telResto && <a className="tb-bouton tb-clair" href={lienWhatsApp(telResto, messageAvisResto(premier))} target="_blank" rel="noopener noreferrer" onClick={noterAvis}>⭐ Demander un avis au restaurant</a>}
            {derniereEtapeTournee(tournee) && <button type="button" className="ag-modifier" disabled={enCours} onClick={annuler}>Annuler la dernière étape</button>}
            {seule && <button type="button" className="ag-modifier" onClick={() => setAPart(true)}>Voir chaque commande à part</button>}
          </div>
          <p className="tb-note">📋 Livraisons de {nomResto} : payées avec son relevé de la semaine (le dimanche).</p>
          {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
