import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { avecDelai, messageErreurSuppression, supprimerCommandeResto } from "../suppression.js";
import { useRepertoire } from "../repertoireBase.js";
import { enregistrerRepertoire } from "../repertoireBase.js";

// MENAGE DES RESTAURANTS (22 nov. 2026, Rebecca) : « une fois les tests terminés, il n'y a aucun bouton pour supprimer
// toutes les fausses commandes ; pareil pour les contrats : un bouton pour tout remettre à zéro, ça efface tout. »
// Deux choix : effacer les commandes (avec leurs livraisons du Calendrier et leurs paiements), ou TOUT remettre à zéro
// (commandes, contrats, demandes de changement de formule, liens des restaurants, fiches restaurants du Répertoire).
// On coche les restaurants concernés (tous par défaut). Confirmation dans la page, en 2 appuis.
async function toutLire() {
  const restos = (await getDocs(collection(db, "restos"))).docs.map((x) => ({ cle: x.id, ...x.data() }));
  const commandes = [];
  for (const r of restos) {
    const s = await getDocs(collection(db, "restos", r.cle, "commandesResto"));
    commandes.push(...s.docs.map((x) => ({ id: x.id, cle: r.cle, ...x.data() })));
  }
  const contrats = (await getDocs(collection(db, "contratsRestos"))).docs.map((x) => ({ id: x.id, ...x.data() }));
  const avenants = (await getDocs(collection(db, "avenantsResto"))).docs.map((x) => ({ cle: x.id, ...x.data() }));
  return { restos, commandes, contrats, avenants };
}

export default function MenageRestos() {
  const rep = useRepertoire();
  const [ouvert, setOuvert] = useState(false);
  const [d, setD] = useState(null);
  const [coches, setCoches] = useState(null);
  const [confirmer, setConfirmer] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState("");
  const charger = () => avecDelai(toutLire()).then((x) => { setD(x); setCoches(new Set(x.restos.map((r) => r.cle))); }).catch((e) => setInfo(e && e.code === "delai" ? "Firebase ne répond pas : ferme l'appli complètement (et les autres onglets du site dans Safari), rouvre-la, puis réessaie." : "Lecture impossible" + (e && e.code ? ` (${e.code})` : "") + " : envoie-moi une capture."));
  useEffect(() => { if (ouvert && !d) charger(); }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ouvert) return <div className="tb-actions" style={{ marginTop: 24 }}><button type="button" className="tb-bouton tb-clair" onClick={() => setOuvert(true)}>🧹 Ménage des restaurants (tests)</button></div>;
  if (!d) return <section className="tdb-bloc"><p className="tdb-note">{info || "Chargement…"}</p>{info && <div className="tb-actions"><button type="button" className="tb-bouton tb-clair" onClick={() => { setInfo(""); charger(); }}>Réessayer</button><button type="button" className="tb-bouton tb-clair" onClick={() => { setInfo(""); setOuvert(false); }}>Fermer</button></div>}</section>;

  const choisis = d.restos.filter((r) => coches.has(r.cle));
  const cles = new Set(choisis.map((r) => r.cle));
  const commandes = d.commandes.filter((c) => cles.has(c.cle));
  const tousCoches = choisis.length === d.restos.length;
  // Contrats : tous si tout est coché, sinon ceux des restaurants cochés (retrouvés par leur fiche du Répertoire)
  const lienDe = (f) => (f.contratPro && f.contratPro.lienResto) || "";
  const fichesResto = (rep.familles || []).filter((f) => f.categorie === "commercants" && (lienDe(f) || (f.resto && f.resto.contratId)));
  const idsChoisis = new Set(fichesResto.filter((f) => cles.has(lienDe(f))).map((f) => f.resto && f.resto.contratId).filter(Boolean));
  const contrats = tousCoches ? d.contrats : d.contrats.filter((c) => idsChoisis.has(c.id));
  const idsContrats = new Set(contrats.map((c) => c.id));
  const fiches = fichesResto.filter((f) => cles.has(lienDe(f)) || (f.resto && idsContrats.has(f.resto.contratId)));
  const avenants = d.avenants.filter((a) => cles.has(a.cle));

  const basculer = (cle) => {
    const s = new Set(coches);
    if (s.has(cle)) s.delete(cle);
    else s.add(cle);
    setCoches(s);
    setConfirmer("");
  };
  const effacer = async (tout) => {
    setConfirmer("");
    setEnCours(true);
    setInfo("");
    let n = 0;
    let erreur = null;
    try {
      for (const c of commandes) {
        try {
          await avecDelai(supprimerCommandeResto(c));
          n++;
        } catch (e) {
          erreur = erreur || e;
        }
      }
      // 22 nov. 2026 : plus de « ✓ » si Firebase a refusé (avant, l'erreur était cachée)
      if (erreur) throw erreur;
      if (tout) {
        for (const c of contrats) await deleteDoc(doc(db, "contratsRestos", c.id)).catch(() => {});
        for (const a of avenants) await deleteDoc(doc(db, "avenantsResto", a.cle)).catch(() => {});
        for (const r of choisis) await deleteDoc(doc(db, "restos", r.cle)).catch(() => {});
        const ids = new Set(fiches.map((f) => f.id));
        if (ids.size) await enregistrerRepertoire(rep.lieux, rep.corrections, rep.familles.filter((f) => !ids.has(f.id)));
        setInfo(`✓ Remis à zéro : ${n} commande(s), ${contrats.length} contrat(s), ${choisis.length} lien(s) de restaurant, ${ids.size} fiche(s) du Répertoire.`);
      } else setInfo(`✓ ${n} commande(s) effacée(s), avec leurs livraisons du Calendrier et leurs paiements.`);
    } catch (e) {
      setInfo(`${n} commande(s) effacée(s), mais ${commandes.length - n} n'ont pas pu l'être. ${messageErreurSuppression(e)}`);
    }
    setEnCours(false);
    setD(null);
    charger();
  };

  return (
    <section className="tdb-bloc" style={{ marginTop: 24 }}>
      <h2>🧹 Ménage des restaurants</h2>
      <p className="tdb-note">Pour effacer les tests sans laisser de trace. Coche les restaurants concernés (tous par défaut).</p>
      {d.restos.length === 0 && <p className="tdb-note">Aucun lien de restaurant.</p>}
      {d.restos.map((r) => (
        <label key={r.cle} className="rp-forfait" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={coches.has(r.cle)} onChange={() => basculer(r.cle)} style={{ width: 22, height: 22 }} />
          <span>{r.nom || "Restaurant"} · {d.commandes.filter((c) => c.cle === r.cle).length} commande(s){r.actif ? "" : " · lien désactivé"}</span>
        </label>
      ))}
      <p className="tdb-note">Sélection : {commandes.length} commande(s) · {contrats.length} contrat(s) · {fiches.length} fiche(s) restaurant du Répertoire.</p>
      <div className="tb-actions">
        <button type="button" className="tb-bouton tb-clair" disabled={enCours || !commandes.length} onClick={() => setConfirmer("commandes")}>🗑 Effacer les commandes ({commandes.length})</button>
        <button type="button" className="tb-bouton ag-danger" disabled={enCours || (!choisis.length && !contrats.length)} onClick={() => setConfirmer("tout")}>♻️ Tout remettre à zéro</button>
        <button type="button" className="tb-bouton tb-clair" onClick={() => { setOuvert(false); setConfirmer(""); }}>Fermer</button>
      </div>
      {confirmer === "commandes" && (
        <div className="tb-actions">
          <span className="tdb-note">Effacer {commandes.length} commande(s), leurs livraisons du Calendrier et leurs paiements ? C'est définitif.</span>
          <button type="button" className="tb-bouton ag-danger" disabled={enCours} onClick={() => effacer(false)}>Oui, effacer</button>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setConfirmer("")}>Non</button>
        </div>
      )}
      {confirmer === "tout" && (
        <div className="tb-actions">
          <span className="tdb-note">Tout effacer : {commandes.length} commande(s), {contrats.length} contrat(s), les liens de {choisis.length} restaurant(s) (ils ne s'ouvriront plus) et {fiches.length} fiche(s) du Répertoire. C'est définitif.</span>
          <button type="button" className="tb-bouton ag-danger" disabled={enCours} onClick={() => effacer(true)}>Oui, tout remettre à zéro</button>
          <button type="button" className="tb-bouton tb-clair" onClick={() => setConfirmer("")}>Non</button>
        </div>
      )}
      {enCours && <p className="tdb-note">Ménage en cours…</p>}
      {info && <p className="tdb-note" role="status">{info}</p>}
    </section>
  );
}
