import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes } from "./accesDemandes.js";
import { avisADemander, rappelsDemain, recusAFaire, relancesClientes } from "./pricing/finCourse.js";
import { rappelsRdvDemain } from "./pricing/suiteClient.js";

// COMPTEURS DU MENU (15 nov. 2026, demande de Rebecca) : a cote de chaque rubrique, le nombre de choses a traiter,
// pour savoir ou aller voir sans ouvrir chaque onglet.
// - Demandes et missions : demandes en attente (Rebecca : toutes ; un coequipier : ses services) ;
// - Ramassage scolaire : demandes du site encore en cours (devis modifiables) ;
// - Commandes Epoxy : commandes en attente ; Equipe : demandes d'acces ; Clients : recharges de credit a confirmer.
function useCompte(actif, fabrique, filtre = () => true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!actif) {
      setN(0);
      return undefined;
    }
    return onSnapshot(fabrique(), (s) => setN(s.docs.filter((d) => filtre(d.data())).length), () => setN(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);
  return n;
}

export function useCompteurs(role) {
  const admin = role === "admin";
  const equipe = role === "admin" || role === "equipe";
  const demandes = useCompte(equipe, () => refDemandes(), (d) => d.statut === "en attente");
  const ramassage = useCompte(admin, () => query(collection(db, "trajetsPartages"), where("statut", "==", "en cours")));
  const epoxy = useCompte(admin, () => query(collection(db, "commandes"), where("statut", "==", "en attente")));
  const acces = useCompte(admin, () => query(collection(db, "demandesEquipe"), where("statut", "==", "en_attente")));
  const recharges = useCompte(admin, () => query(collection(db, "recharges"), where("statut", "==", "en attente")));
  // 17 nov. 2026 : rappels, avis, relances et recus a faire (onglet Aujourd'hui du Tableau de bord)
  const [aFaire, setAFaire] = useState(0);
  useEffect(() => {
    if (!admin) return undefined;
    return onSnapshot(refDemandes(), (s) => {
      const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
      const toutes = s.docs.map((x) => ({ id: x.id, ...x.data() }));
      const ids = new Set([...rappelsDemain(toutes, jour), ...avisADemander(toutes, jour), ...recusAFaire(toutes), ...relancesClientes(toutes, jour), ...rappelsRdvDemain(toutes, jour)].map((d) => d.id));
      setAFaire(ids.size);
    }, () => setAFaire(0));
  }, [admin]);
  // 17 nov. 2026, 16h31 : paiements annonces par les clientes, a confirmer
  const [declares, setDeclares] = useState(0);
  useEffect(() => {
    if (!admin) return undefined;
    return onSnapshot(query(collection(db, "paiementsDeclares"), where("statut", "==", "a confirmer")), (s) => setDeclares(s.size), () => setDeclares(0));
  }, [admin]);
  return { tableau: aFaire + declares, demandes, ramassage, "commandes-epoxy": epoxy, equipe: acces, clients: recharges };
}
