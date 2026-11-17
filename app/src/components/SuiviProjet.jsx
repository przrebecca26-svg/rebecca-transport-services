import { useEffect, useState } from "react";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { lienPaye } from "../pricing/suiteClient.js";
import {
  DOSSIER, ETAPES_CLIENT, MAX_REPONSE, aFournir, avancement, cahierPropre, dossierPropre, enHeures, etapeAtteinte, finGarantie, libelleStatut,
  lignesPropres, maintenanceDuMois, texteStatutClient, totalDevis,
} from "../pricing/digital.js";
import "../digital.css";

// SUIVI D'UN PROJET DIGITAL, COTE CLIENT (17 nov. 2026) - lien personnel #/projet/ID
// Le client voit : le statut, son devis (et l'accepte), ses paiements 40 / 30 / 30, le cahier des charges coche par
// Rebecca (fait = barre et grise), la garantie, la maintenance, et il remplit son dossier de lancement.
// Il ne peut rien changer d'autre (regles Firebase v19). Les notes privees de Rebecca sont ailleurs.
const charger = () => Promise.all([import("../firebase.js"), import("firebase/firestore")]);
const shekels = (x) => `${String(Math.round((Number(x) || 0) * 100) / 100).replace(".", ",")} ₪`;
const jourFr = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const STATUTS_DOSSIER = ["devis_envoye", "devis_accepte", "en_cours", "a_valider"];

export default function SuiviProjet({ id, onAccueil }) {
  const [p, setP] = useState(undefined);
  const [reponses, setReponses] = useState(null);
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [section, setSection] = useState("");

  useEffect(() => {
    let arreter = () => {};
    charger()
      .then(([{ db }, { doc, onSnapshot }]) => {
        arreter = onSnapshot(doc(db, "projetsDigital", id), (s) => setP(s.exists() ? { id: s.id, ...s.data() } : null), () => setP(null));
      })
      .catch(() => setP(null));
    return () => arreter();
  }, [id]);
  useEffect(() => {
    if (p && reponses === null) setReponses(dossierPropre(p.dossier));
  }, [p, reponses]);

  if (p === undefined) return <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;
  if (p === null)
    return (
      <div className="bloc" style={{ maxWidth: 560, margin: "24px auto", padding: 20 }}>
        <h2>Projet introuvable</h2>
        <p>Ce lien n'est pas valable. Écrivez-moi sur WhatsApp et je vous renvoie le bon lien.</p>
        <button type="button" className="bouton" onClick={onAccueil}>Voir le site</button>
      </div>
    );

  const lignes = lignesPropres(p.lignesDevis);
  const total = totalDevis(lignes);
  const montrerDevis = lignes.length > 0 && etapeAtteinte(p.statut, "devis_envoye") && !["refuse", "abandonne"].includes(p.statut);
  const cahier = cahierPropre(p.cahier);
  const av = avancement(cahier);
  const echeances = Array.isArray(p.echeances) ? p.echeances : [];
  const mois = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }).slice(0, 7);
  const maint = p.maintenance && p.maintenance.niveau ? maintenanceDuMois(p.maintenance, mois) : null;
  const manque = reponses ? aFournir(reponses, p.formule) : [];
  const dossierOuvert = STATUTS_DOSSIER.includes(p.statut);

  const ecrire = async (champs, message) => {
    setEnCours(true);
    setInfo("");
    try {
      const [{ db }, { doc, updateDoc, serverTimestamp }] = await charger();
      const valeurs = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v === "__heure__" ? serverTimestamp() : v]));
      await updateDoc(doc(db, "projetsDigital", id), valeurs);
      setInfo(message);
    } catch {
      setInfo("L'enregistrement n'a pas marché. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
  };
  const accepter = () => ecrire({ statut: "devis_accepte", devisAccepteLe: "__heure__" }, "Merci ! Votre accord est enregistré. Je vous envoie le lien de l'acompte de 40 %.");
  const enregistrerDossier = () => ecrire({ dossier: dossierPropre(reponses), dossierMajLe: "__heure__" }, "Dossier enregistré ✓ Vous pouvez le compléter quand vous voulez.");

  return (
    <div className="dg-suivi" style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/brand/logo-digital-applications.png" alt="" width={44} height={44} style={{ borderRadius: "50%" }} />
        <div>
          <h2 style={{ margin: 0 }}>Votre projet</h2>
          <small>{p.entreprise || p.nom}{p.formule ? ` · Formule ${p.formule}` : ""}</small>
        </div>
      </div>

      <div className="bloc dg-bloc">
        <p className="dg-statut">{libelleStatut(p.statut)}</p>
        <p>{texteStatutClient(p.statut)}</p>
        {!["refuse", "abandonne"].includes(p.statut) && (
          <ol className="dg-frise">
            {ETAPES_CLIENT.map((e) => (
              <li key={e} className={etapeAtteinte(p.statut, e) ? "dg-fait" : ""}>{libelleStatut(e)}</li>
            ))}
          </ol>
        )}
        {p.consultation && p.consultation.date && (
          <p>📞 Consultation gratuite : <strong>{jourFr(p.consultation.date)}{p.consultation.heure ? ` à ${p.consultation.heure.replace(":", "h")}` : ""}</strong></p>
        )}
        {p.messageClient && <p className="dg-note">💬 {p.messageClient}</p>}
      </div>

      {montrerDevis && (
        <div className="bloc dg-bloc">
          <h3>Devis{p.formule ? ` – formule ${p.formule}` : ""}</h3>
          <table className="dg-table">
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}><td>{l.libelle}</td><td className="dg-montant">{shekels(l.montant)}</td></tr>
              ))}
              <tr className="dg-total"><td>Total</td><td className="dg-montant">{shekels(total)}</td></tr>
            </tbody>
          </table>
          {p.devisNote && <p className="aide" style={{ whiteSpace: "pre-line" }}>{p.devisNote}</p>}
          <p className="aide">Paiement en trois fois : 40 % à la commande, 30 % à la validation de la version fonctionnelle, 30 % avant la livraison définitive. Garantie corrective gratuite de 60 jours après la livraison.</p>
          {p.statut === "devis_envoye" && (
            <button type="button" className="bouton" disabled={enCours} onClick={accepter}>J'accepte le devis</button>
          )}
          {p.devisAccepteLe && <p>✅ Devis accepté.</p>}
        </div>
      )}

      {echeances.length > 0 && (
        <div className="bloc dg-bloc">
          <h3>Paiements</h3>
          {echeances.map((e, i) => {
            const lien = e.demandeId && !e.payeLe ? lienPaye({ id: e.demandeId, nom: p.nom }, Number(e.montant), i === 0 ? "acompte" : "solde") : "";
            return (
              <div key={i} className="dg-echeance">
                <div>
                  <strong>{e.libelle} ({e.pourcent} %)</strong>
                  <small>{shekels(e.montant)}</small>
                </div>
                {e.payeLe ? <span className="dg-paye">Payé ✓</span> : lien ? <a className="bouton" href={lien.replace(/^https?:\/\/[^/]+/, "")}>Payer</a> : <span className="aide">À venir</span>}
              </div>
            );
          })}
        </div>
      )}

      {cahier.length > 0 && (
        <div className="bloc dg-bloc">
          <h3>Cahier des charges · {av.faits} / {av.total} ({av.pourcent} %)</h3>
          <div className="dg-barre"><span style={{ width: `${av.pourcent}%` }} /></div>
          <ul className="dg-cahier">
            {cahier.map((x, i) => (
              <li key={i} className={x.fait ? "dg-coche" : ""}>{x.fait ? "☑" : "☐"} {x.texte}</li>
            ))}
          </ul>
        </div>
      )}

      {(p.livraisonLe || maint) && (
        <div className="bloc dg-bloc">
          {p.livraisonLe && (
            <p>📦 Livré le <strong>{jourFr(p.livraisonLe)}</strong>. Garantie corrective gratuite jusqu'au <strong>{jourFr(finGarantie(p.livraisonLe))}</strong>.</p>
          )}
          {maint && (
            <>
              <h3>Maintenance {p.maintenance.niveau}</h3>
              <p>Ce mois-ci : {enHeures(maint.utilise)} utilisées sur {enHeures(maint.inclus)} incluses.{maint.depassement > 0 ? ` Dépassement de ${enHeures(maint.depassement)} : facturé seulement après votre accord.` : ""}</p>
              {maint.interventions.length > 0 && (
                <ul>{maint.interventions.map((x, i) => <li key={i}>{jourFr(x.date)} · {enHeures(x.minutes)} · {x.texte}</li>)}</ul>
              )}
            </>
          )}
        </div>
      )}

      {dossierOuvert && reponses && (
        <div className="bloc dg-bloc">
          <h3>Votre dossier de lancement</h3>
          <p className="aide">Pour que je démarre avec tout ce qu'il faut. Remplissez à votre rythme et enregistrez : vous pouvez revenir le compléter. Les fichiers (logo, photos) s'envoient par WhatsApp ou par e-mail.</p>
          {manque.length > 0 ? <p className="aide">Encore à fournir : {manque.length} point{manque.length > 1 ? "s" : ""}.</p> : <p>✅ Dossier complet, merci !</p>}
          {DOSSIER.filter((s) => !(s.id === "gestion" && p.formule === "Essentielle")).map((s) => (
            <div key={s.id} className="dg-section">
              <button type="button" className="lien" onClick={() => setSection(section === s.id ? "" : s.id)} aria-expanded={section === s.id}>
                {s.titre} {s.questions.every((q) => reponses[q.id]) ? "✓" : ""} {section === s.id ? "▲" : "▼"}
              </button>
              {section === s.id &&
                s.questions.map((q) => (
                  <div key={q.id} className="champ">
                    <label>{q.l}
                      <textarea rows={3} maxLength={MAX_REPONSE} value={reponses[q.id] || ""} onChange={(e) => setReponses({ ...reponses, [q.id]: e.target.value })} />
                    </label>
                  </div>
                ))}
            </div>
          ))}
          <button type="button" className="bouton" disabled={enCours} onClick={enregistrerDossier}>Enregistrer mon dossier</button>
        </div>
      )}

      {info && <p className="dg-note" role="status">{info}</p>}
      <a className="lien" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, c'est ${p.nom} au sujet de mon projet Digital & Applications.`)} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12 }}>
        Écrire à Rebecca sur WhatsApp
      </a>
      <button type="button" className="lien" onClick={onAccueil} style={{ marginTop: 8 }}>Voir le site Rebecca Services</button>
    </div>
  );
}
