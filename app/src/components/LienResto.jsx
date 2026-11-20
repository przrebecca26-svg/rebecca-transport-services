import { useState } from "react";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { SITE } from "../site.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { contratDe } from "../pricing/commercants.js";
import { validerContratResto } from "../contratsRestosBase.js";
import { lienResto, messageLienResto, nouvelleCleResto, restoDepuisFiche } from "../pricing/restos.js";
import { envoyerEmailA } from "../mailClient.js";

// LIEN PRIVÉ DU RESTAURANT (V2, 19 nov. 2026) - dans le contrat de la fiche « Commerçant partenaire ».
// La clé du lien est l'accès du restaurant (pas de compte). Le document restos/CLE contient seulement
// son nom, son téléphone, son adresse (« Adresse de la maison » de la fiche) et ses tarifs.
export default function LienResto({ f, changer }) {
  const c = contratDe(f);
  const cle = c.lienResto || "";
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const lien = cle ? lienResto(cle, SITE) : "";
  // 20 nov. 2026 : le lien part aussi par e-mail (sécurité : une copie écrite chez le restaurant)
  const emailResto = String(f.email || (f.resto && f.resto.email) || "").trim();
  const envoyerParMail = async (l) => {
    if (!emailResto) return "Pas d'e-mail dans la fiche : envoie le lien par WhatsApp.";
    const ok = await envoyerEmailA(emailResto, f.nom, "Votre espace livraison - Rebecca Services", `${messageLienResto(f.nom, l)}\n\n(Pas reçu ce message dans la boîte principale ? Regardez dans les spams.)`);
    return ok ? `📧 Lien envoyé par e-mail à ${emailResto}.` : `📧 L'e-mail à ${emailResto} n'est pas parti : envoie le lien par WhatsApp.`;
  };

  const publier = async (nouvelle) => {
    setInfo("");
    if (!String(f.nom || "").trim() || !String(f.telephone || "").trim()) return setInfo("Mets d'abord le nom et le téléphone du restaurant.");
    if (!f.domicile) return setInfo("Mets d'abord l'adresse du restaurant (« Adresse du restaurant » ci-dessus) : c'est là que tu récupères les commandes.");
    setEnCours(true);
    try {
      const k = nouvelle ? nouvelleCleResto() : cle;
      if (nouvelle && cle) await updateDoc(doc(db, "restos", cle), { actif: false, majLe: serverTimestamp() }).catch(() => {});
      await setDoc(doc(db, "restos", k), { ...restoDepuisFiche(f), majLe: serverTimestamp() });
      if (nouvelle) changer({ ...f, contratPro: { ...c, lienResto: k } });
      // 19 nov. 2026 : restaurant inscrit par le lien -> créer son espace = contresigner son contrat
      if (nouvelle && f.resto && f.resto.contratId) await validerContratResto(f.resto.contratId).catch(() => {});
      const mail = nouvelle ? await envoyerParMail(lienResto(k, SITE)) : "";
      setInfo(nouvelle ? `✓ Lien créé. ${mail} Touche « Enregistrer » en bas de la fiche pour le garder, puis touche « 💬 Envoyer le lien » pour l'envoyer aussi sur son WhatsApp.` : "✓ Lien mis à jour (nom, adresse, tarifs).");
    } catch {
      setInfo("Impossible pour l'instant : vérifie la connexion et les règles Firebase v29.");
    }
    setEnCours(false);
    return undefined;
  };
  const desactiver = async () => {
    if (!window.confirm("Désactiver ce lien ? Le restaurant ne pourra plus envoyer de commande avec.")) return;
    try {
      await updateDoc(doc(db, "restos", cle), { actif: false, majLe: serverTimestamp() });
      changer({ ...f, contratPro: { ...c, lienResto: "" } });
      setInfo("Lien désactivé. Touche « Enregistrer » en bas de la fiche.");
    } catch {
      setInfo("Impossible pour l'instant.");
    }
  };

  return (
    <div className="bloc">
      <p className="rp-type">🔗 Espace du restaurant (lien privé)</p>
      {!cle ? (
        <>
          <p className="tdb-note">Le restaurant t'envoie ses commandes avec ce lien, voit ta réponse en direct et son relevé de la semaine.</p>
          <button type="button" className="tb-bouton" disabled={enCours} onClick={() => publier(true)}>Créer le lien du restaurant</button>
        </>
      ) : (
        <>
          <p className="tdb-note" style={{ wordBreak: "break-all" }}>{lien}</p>
          <div className="tb-actions">
            {f.telephone && <a className="tb-bouton" href={lienWhatsApp(f.telephone, messageLienResto(f.nom, lien))} target="_blank" rel="noopener noreferrer">💬 Envoyer le lien</a>}
            {emailResto && <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={async () => { setEnCours(true); setInfo(await envoyerParMail(lien)); setEnCours(false); }}>📧 Renvoyer par e-mail</button>}
            <a className="tb-bouton tb-clair" href={lien} target="_blank" rel="noopener noreferrer">Voir sa page</a>
            <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => publier(false)}>🔄 Mettre à jour</button>
            <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => (window.confirm("Faire un nouveau lien ? L'ancien ne marchera plus.") ? publier(true) : null)}>Nouveau lien</button>
            <button type="button" className="tb-bouton ag-danger" disabled={enCours} onClick={desactiver}>Désactiver</button>
          </div>
          <p className="tdb-note">Après un changement de nom, d'adresse ou de tarifs : touche « 🔄 Mettre à jour ».</p>
        </>
      )}
      {info && <p className="tdb-note" role="status">{info}</p>}
    </div>
  );
}
