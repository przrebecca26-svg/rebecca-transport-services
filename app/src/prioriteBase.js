import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { useTournee, enregistrerTournee } from "./tourneeBase.js";
import { statutDevis } from "./pricing/tournee.js";
import { planDuPartage, nomPartage } from "./pricing/partageRamassage.js";
import { planVide, enfantVide } from "./pricing/ramassagePlanning.js";
import { classerDemandes, demandesExpirees } from "./pricing/prioriteRamassage.js";
import { changerStatutPartage } from "./partageBase.js";

// TOUTES LES DEMANDES DE RAMASSAGE EN ATTENTE, CLASSEES PAR PRIORITE (15 nov. 2026, espace de Rebecca)
// Devis rapides gardes, demandes du site et trajets partages. Au bout de 2 semaines sans reponse, une demande
// est annulee automatiquement (a l'ouverture de l'espace de Rebecca).

const planDuSite = (d) => {
  const p = d.details && d.details.plan;
  if (!p || !Array.isArray(p.enfants) || !p.enfants.length) return null;
  return { ...planVide(), ...p, enfants: p.enfants.map((e) => ({ ...enfantVide(), ...e })) };
};

export function useDemandesRamassage() {
  const base = useTournee();
  const [site, setSite] = useState([]);
  const [partages, setPartages] = useState([]);
  useEffect(() => onSnapshot(query(collection(db, "demandes"), where("service", "==", "ramassage")), (s) => setSite(s.docs.map((x) => ({ id: x.id, ...x.data() })).filter((d) => d.source !== "manuel")), () => {}), []);
  useEffect(() => onSnapshot(collection(db, "trajetsPartages"), (s) => setPartages(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => {}), []);

  const demandes = useMemo(() => [
    ...(base.donnees.devis || []).map((d) => ({ cle: "r" + d.id, id: d.id, origine: "rapide", nom: d.nom, arrivee: d.arriveeLe || d.creeLe, enAttente: d.statut === "attente", plan: d.plan })),
    // une demande du site qui vient d'un trajet partage : c'est le trajet partage qui compte (pas de doublon)
    ...site.filter((d) => !(d.details && d.details.partageId)).map((d) => ({ cle: "s" + d.id, id: d.id, uid: d.uid || "", origine: "site", nom: d.nom, arrivee: d.creeLe, enAttente: d.statut === "en attente", plan: planDuSite(d) })),
    ...partages.map((d) => ({ cle: "p" + d.id, id: d.id, origine: "partage", nom: d.familles.map((_, i) => nomPartage(d, i)).join(" + "), arrivee: d.prioriteDepuis || d.creeLe, enAttente: d.statut === "en cours", plan: planDuPartage(d).plan })),
  ], [base.donnees.devis, site, partages]);

  // Annulation automatique a 2 semaines (une seule fois par demande)
  const faites = useRef(new Set());
  useEffect(() => {
    if (base.refuse) return;
    const aAnnuler = demandesExpirees(demandes).filter((d) => !faites.current.has(d.cle));
    if (!aAnnuler.length) return;
    aAnnuler.forEach((d) => faites.current.add(d.cle));
    const rapides = aAnnuler.filter((d) => d.origine === "rapide");
    if (rapides.length) enregistrerTournee(rapides.reduce((doc, d) => statutDevis(doc, d.id, "annule"), base.donnees)).catch(() => {});
    for (const d of aAnnuler.filter((x) => x.origine === "site")) {
      updateDoc(doc(db, "demandes", d.id), { statut: "annulee", majLe: serverTimestamp() }).catch(() => {});
      // cliente avec un compte : son historique montre « annulée » ; sa fiche et sa demande restent pour « Refaire »
      if (d.uid) updateDoc(doc(db, "suivi", d.id), { statut: "annulée", majLe: serverTimestamp() }).catch(() => {});
    }
    for (const d of aAnnuler.filter((x) => x.origine === "partage")) changerStatutPartage(d.id, "annulee").catch(() => {});
  }, [demandes, base.refuse, base.donnees]);

  const classees = useMemo(() => classerDemandes(demandes), [demandes]);
  return { demandes, classees };
}
