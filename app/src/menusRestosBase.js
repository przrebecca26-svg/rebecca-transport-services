import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";

// MENU PROPOSÉ PAR LE RESTAURANT (26 nov. 2026, 9h12 : Rebecca a dit oui, règles v38)
// - menusRestos/{cle} : le restaurant (lien #/resto/CLE) tape son menu et l'envoie « à valider » ;
// - Rebecca le reprend dans la fiche du site, le publie (reglages/vitrineCarte_ID) et le marque « publié ».
// - admin/vitrineLiens : quelle fiche du site correspond à quel espace restaurant (privé : la clé n'est jamais publique).
// - Offre de lancement : menu en ligne offert aux 10 premiers restaurants qui signent le contrat.
import { TARIFS } from "./pricing/config.js";
export const offreLancementMenu = () => (TARIFS.menuEnLigne && TARIFS.menuEnLigne.offertsLancement) || 10;
export const prixMenuMensuel = () => (TARIFS.menuEnLigne && TARIFS.menuEnLigne.prixMensuel) || 29;

export function useMenuPropose(cle) {
  const [m, setM] = useState(undefined);
  useEffect(() => (cle ? onSnapshot(doc(db, "menusRestos", cle), (s) => setM(s.exists() ? s.data() : null), () => setM(null)) : undefined), [cle]);
  return m;
}
export const proposerMenu = (cle, texte) => setDoc(doc(db, "menusRestos", cle), { texte: String(texte || "").slice(0, 20000), statut: "a_valider", majLe: serverTimestamp() });
export const marquerMenuPublie = (cle, texte) => setDoc(doc(db, "menusRestos", cle), { texte: String(texte || "").slice(0, 20000), statut: "publie", majLe: serverTimestamp() });

export function useLiensVitrine(actif = true) {
  const [l, setL] = useState({});
  useEffect(() => (actif ? onSnapshot(doc(db, "admin", "vitrineLiens"), (s) => { try { setL(JSON.parse((s.exists() && s.data().json) || "{}")); } catch { setL({}); } }, () => setL({})) : undefined), [actif]);
  return l;
}
export const enregistrerLiensVitrine = (l) => setDoc(doc(db, "admin", "vitrineLiens"), { json: JSON.stringify(l), majLe: serverTimestamp() });

// Espaces restaurants existants (Rebecca seule) et contrats signés (pour l'offre de lancement)
export function useRestosEtContrats() {
  const [r, setR] = useState({ restos: [], signes: 0 });
  useEffect(() => {
    let actif = true;
    Promise.all([getDocs(collection(db, "restos")), getDocs(query(collection(db, "contratsRestos"), where("statut", "in", ["signe", "valide"])))])
      .then(([a, b]) => actif && setR({ restos: a.docs.map((d) => ({ cle: d.id, nom: d.data().nom || d.id })), signes: b.size }))
      .catch(() => {});
    return () => { actif = false; };
  }, []);
  return r;
}
