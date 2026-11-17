import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { ETAPES_COMMANDE, messageCommande } from "../pricing/suiteClient.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { SUJETS, envoyerMailClient } from "../mailClient.js";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

// Commandes de la Boutique Epoxy : visibles et modifiables par Rebecca seulement (règles v12).

const STATUTS = ["en attente", "acceptée", "refusée", "terminée", "annulée"];

export default function CommandesEpoxy({ onRetour }) {
  const [commandes, setCommandes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  useEffect(() => {
    const q = query(collection(db, "commandes"), orderBy("creeLe", "desc"));
    const unsub = onSnapshot(q, (s) => {
      setCommandes(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setErreur("Impossible de lire les commandes."));
    return unsub;
  }, []);

  const changerStatut = async (id, statut) => {
    try {
      await updateDoc(doc(db, "commandes", id), { statut, majLe: serverTimestamp() });
    } catch (e) {
      setErreur("Impossible de modifier le statut.");
    }
  };

  // 17 nov. 2026 : prete -> en livraison -> livree, chaque etape avec son message WhatsApp (+ e-mail automatique)
  const [infoMail, setInfoMail] = useState("");
  const etape = (c, id) => {
    const champs = { etapeCommande: id, majLe: serverTimestamp(), ...(id === "livree" ? { statut: "terminée", livreeLe: aujourdhui() } : {}) };
    updateDoc(doc(db, "commandes", c.id), champs).catch(() => setErreur("Impossible de modifier la commande."));
    envoyerMailClient(c, SUJETS.commande, messageCommande(c, id)).then((x) => x && setInfoMail(x)).catch(() => {});
  };

  if (erreur) return <p className="admin-texte">{erreur}</p>;
  if (!commandes) return <p className="admin-texte">Chargement des commandes…</p>;

  return (
    <section>
      <button className="lien" onClick={onRetour}>← Retour</button>
      <h2>Commandes Epoxy</h2>
      <label>
        Afficher<br />
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="tous">Toutes les commandes</option>
          {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {commandes.length === 0 && <p>Aucune commande.</p>}
      {infoMail && <p className="tb-note">{infoMail}</p>}
      {commandes.filter((c) => filtreStatut === "tous" || c.statut === filtreStatut).map((c) => (
        <div key={c.id} className="carte-service" style={{ marginBottom: 12 }}>
          <strong>{c.produit}{c.varianteNom ? " (" + c.varianteNom + ")" : ""}</strong> × {c.quantite}
          <div>{c.surDevis ? "Sur devis" : (c.prixUnitaire + " ₪")}</div>
          <div>{c.nom} — {c.telephone}</div>
          {c.messageClient && <div><em>{c.messageClient}</em></div>}
          <div>Statut : {c.statut}{c.etapeCommande ? ` · ${ETAPES_COMMANDE.find((x) => x.id === c.etapeCommande)?.titre || ""}` : ""}</div>
          {c.statut !== "refusée" && c.statut !== "annulée" && (
            <div className="tb-actions" style={{ marginTop: 8 }}>
              {ETAPES_COMMANDE.map((x) => {
                const wa = lienWhatsApp(c.telephone, messageCommande(c, x.id));
                return wa ? <a key={x.id} className={"tb-bouton" + (c.etapeCommande === x.id ? "" : " tb-clair")} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => etape(c, x.id)}>{x.bouton}</a> : null;
              })}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            {STATUTS.map((s) => (
              <button key={s} onClick={() => changerStatut(c.id, s)} disabled={c.statut === s} style={{ marginRight: 6 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
