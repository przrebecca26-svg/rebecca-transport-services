import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { repertoireCourant } from "../pricing/repertoire.js";
import { enregistrerRepertoire } from "../repertoireBase.js";
import { contratDe } from "../pricing/commercants.js";
import { restoDepuisFiche } from "../pricing/restos.js";
import { EMAIL_REBECCA, libelleFormuleResto, numeroContrat, tarifsStandard } from "../pricing/contratResto.js";
import { ajouterHistorique, contratApresAvenant, ligneHistorique, texteAvenant } from "../pricing/avenantResto.js";
import { envoyerEmailA } from "../mailClient.js";

// CHANGEMENTS DE FORMULE DEMANDÉS PAR LES RESTAURANTS (20 nov. 2026) - Partenaires -> Restaurants partenaires.
// Accepter : la fiche du Répertoire, l'espace du restaurant et ses prix changent tout de suite, et l'avenant
// part par e-mail au restaurant et à Rebecca. Refuser : le restaurant le voit dans son espace.
const jourJ = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function AvenantsRestoAdmin() {
  const [liste, setListe] = useState([]);
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState("");
  useEffect(() => onSnapshot(query(collection(db, "avenantsResto"), where("statut", "==", "demandee")), (s) => setListe(s.docs.map((d) => ({ cle: d.id, ...d.data() }))), () => setListe([])), []);
  if (!liste.length) return info ? <p className="tdb-note" role="status">{info}</p> : null;

  const accepter = async (av) => {
    setEnCours(av.cle);
    setInfo("");
    try {
      const resto = await getDoc(doc(db, "restos", av.cle));
      const ficheId = resto.exists() ? resto.data().ficheId : "";
      const rep = repertoireCourant();
      const familles = rep.familles || [];
      const fiche = familles.find((f) => f.id === ficheId);
      if (!fiche) throw new Error("Fiche du restaurant introuvable dans le Répertoire.");
      const reglage = await getDoc(doc(db, "reglages", "restos")).catch(() => null);
      const standard = tarifsStandard(reglage && reglage.exists() ? reglage.data() : null);
      const contrat = ajouterHistorique(contratApresAvenant(contratDe(fiche), av, standard.B), ligneHistorique({ jour: jourJ(), ancienne: av.ancienne, formule: av.formule, creneaux: av.creneaux, statut: "acceptee", par: "restaurant", signataire: av.signataire }));
      const nouvelle = { ...fiche, contratPro: contrat };
      await enregistrerRepertoire(rep.lieux, rep.corrections, familles.map((f) => (f.id === fiche.id ? nouvelle : f)));
      await setDoc(doc(db, "restos", av.cle), { ...restoDepuisFiche(nouvelle), majLe: serverTimestamp() });
      await updateDoc(doc(db, "avenantsResto", av.cle), { statut: "acceptee", reponduLe: serverTimestamp() });
      let numero = "";
      const contratId = fiche.resto && fiche.resto.contratId;
      if (contratId) {
        const c = await getDoc(doc(db, "contratsRestos", contratId)).catch(() => null);
        if (c && c.exists()) {
          const s = c.data().signeLe;
          numero = numeroContrat(contratId, s && s.toDate ? s.toDate().toISOString() : "");
        }
      }
      const texte = texteAvenant({ nom: fiche.nom || av.nom, numero, av, contrat, jour: jourJ() });
      const email = String((fiche.resto && fiche.resto.email) || fiche.email || "").trim();
      const sujet = `Avenant à votre contrat - ${fiche.nom || av.nom} - Rebecca Services`;
      const okResto = email ? await envoyerEmailA(email, fiche.nom, sujet, `${texte}\n\n(Pas reçu dans la boîte principale ? Regardez dans les spams.)`) : false;
      await envoyerEmailA(EMAIL_REBECCA, "Rebecca", sujet, texte).catch(() => false);
      setInfo(`✓ ${fiche.nom} passe en formule ${libelleFormuleResto(av.formule)}. ${okResto ? `Avenant envoyé à ${email}.` : "L'e-mail au restaurant n'est pas parti : envoie-lui l'avenant sur WhatsApp."}`);
    } catch (e) {
      setInfo(`Impossible pour l'instant : ${e && e.message ? e.message : "vérifie la connexion et les règles Firebase v32"}.`);
    }
    setEnCours("");
  };
  const refuser = async (av) => {
    const motif = window.prompt(`Refuser la demande de ${av.nom} ? Raison (le restaurant la voit) :`, "Créneaux pas disponibles, appelez-moi pour en choisir d'autres.");
    if (motif === null) return;
    setEnCours(av.cle);
    try {
      await updateDoc(doc(db, "avenantsResto", av.cle), { statut: "refusee", reponduLe: serverTimestamp(), motif: String(motif).slice(0, 200) });
      // 20 nov. 2026 : le refus est gardé dans l'historique de la fiche (onglet « Formule et contrat »)
      const resto = await getDoc(doc(db, "restos", av.cle)).catch(() => null);
      const ficheId = resto && resto.exists() ? resto.data().ficheId : "";
      const rep = repertoireCourant();
      const fiche = (rep.familles || []).find((f) => f.id === ficheId);
      if (fiche) {
        const ligne = ligneHistorique({ jour: jourJ(), ancienne: av.ancienne, formule: av.formule, creneaux: av.creneaux, statut: "refusee", par: "restaurant", signataire: av.signataire, motif });
        await enregistrerRepertoire(rep.lieux, rep.corrections, rep.familles.map((f) => (f.id === fiche.id ? { ...f, contratPro: ajouterHistorique(contratDe(f), ligne) } : f))).catch(() => {});
      }
      setInfo(`Demande de ${av.nom} refusée.`);
    } catch {
      setInfo("Impossible pour l'instant : vérifie la connexion et les règles Firebase v32.");
    }
    setEnCours("");
  };

  return (
    <div className="rp-correction">
      <p className="rp-type">📝 Changements de formule demandés ({liste.length})</p>
      {liste.map((av) => (
        <div key={av.cle} className="bloc">
          <p><b>{av.nom}</b> · {libelleFormuleResto(av.ancienne)} → <b>{libelleFormuleResto(av.formule)}</b></p>
          {av.creneaux && <p className="tdb-note">Créneaux demandés : {av.creneaux}</p>}
          <p className="tdb-note">Signé par {av.signataire}. Vérifie que ces créneaux te vont (tournée, Chabbat) avant d'accepter.</p>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={enCours === av.cle} onClick={() => accepter(av)}>✓ Accepter et envoyer l'avenant</button>
            <button type="button" className="tb-bouton ag-danger" disabled={enCours === av.cle} onClick={() => refuser(av)}>Refuser</button>
          </div>
        </div>
      ))}
      {info && <p className="tdb-note" role="status">{info}</p>}
    </div>
  );
}
