import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { lireComptes, nouvelIdCompte, planAllocation } from "./pricing/comptesEntreNous.js";
import { enregistrerRepertoire, useRepertoire } from "./repertoireBase.js";

// COMPTES ENTRE NOUS - lecture, enregistrement et placement automatique (13 nov. 2026)
// Document PRIVE admin/comptes (Rebecca seule). Ses courses et paiements restent dans demandes / mouvements :
// Finances les voit comme toutes les autres courses.
const REF = () => doc(db, "admin", "comptes");

export function useComptes() {
  const [etat, setEtat] = useState({ pret: false, comptes: [], amorce: false, amorce2: false });
  useEffect(() => onSnapshot(REF(), (s) => setEtat({ pret: true, comptes: lireComptes(s.exists() ? s.data().json : "[]"), amorce: s.exists() && s.data().amorce === true, amorce2: s.exists() && s.data().amorce2 === true }), () => setEtat({ pret: true, comptes: [], amorce: true, amorce2: true })), []);
  return etat;
}
export const enregistrerComptes = (comptes) => setDoc(REF(), { json: JSON.stringify(comptes), majLe: serverTimestamp() }, { merge: true });

// Courses terminees et mouvements (pour les soldes)
export function useCoursesEtMouvements(actif = true) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  useEffect(() => {
    if (!actif) return undefined;
    const a = onSnapshot(query(collection(db, "demandes"), where("statut", "==", "terminee")), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setDemandes([]));
    const b = onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setMouvements([]));
    return () => {
      a();
      b();
    };
  }, [actif]);
  return { demandes, mouvements };
}

// Monte dans l'espace de Rebecca, n'affiche rien : ce qu'une personne m'a paye (ou ce que je lui dois en troc) se
// place tout seul sur ses courses encore dues -> paiement (ou deduction) dans Finances.
// Depart (13 nov. 2026, 08h54, demande de Rebecca) : une seule fois, les comptes d'Alexia (a jour) et de gg Dahan
// (son mari, compte a part, meme domicile) sont crees, avec la dette de gg : 450 ₪ (course « Anciennes courses »).
async function amorcer(comptes, familles, rep) {
  const fam = familles.find((f) => /alexia|dahan/i.test(f.nom || "")) || null;
  const suite = [...comptes];
  const existe = (re) => suite.some((c) => re.test(c.nom));
  if (!existe(/alexia/i)) suite.push({ id: nouvelIdCompte(), nom: "Alexia", telephone: fam ? fam.telephone || "" : "", famille: fam ? fam.id : "", note: "", lignes: [] });
  let gg = suite.find((c) => /gg|g[ée]g[ée]/i.test(c.nom));
  if (!gg) {
    gg = { id: nouvelIdCompte(), nom: "gg Dahan", telephone: "", famille: fam ? fam.id : "", note: "Mari d'Alexia, même domicile", lignes: [] };
    suite.push(gg);
  }
  // 09h04 : la dette n'entre dans Finances que quand il paie -> une ligne « il me doit », pas une course
  const avecDette = suite.map((c) => (c.id === gg.id && !c.lignes.some((l) => l.type === "dette") ? { ...c, lignes: [...c.lignes, { id: nouvelIdCompte(), date: "2026-11-13", type: "dette", montant: 450, libelle: "Anciennes courses", moyen: "", affecte: 0 }] } : c));
  await setDoc(REF(), { json: JSON.stringify(avecDette), amorce: true, amorce2: true, majLe: serverTimestamp() }, { merge: true });
  // 08h54 : « dans la famille d'Alexia, tu marques mari, meme adresse ; j'aurai juste le telephone a remettre »
  if (fam && !String(fam.nom2 || "").trim()) await enregistrerRepertoire(rep.lieux, rep.corrections, familles.map((f) => (f.id === fam.id ? { ...f, nom2: "gg Dahan (mari)" } : f)));
}

// 09h04 : la premiere version avait mis la dette de 450 ₪ dans Finances (course « compte-gg-dette-depart ») alors que gg
// n'a pas encore paye -> une fois : la course est retiree (si aucun paiement) et remplacee par une ligne « il me doit ».
async function corrigerDetteDepart(comptes) {
  const ref = doc(db, "demandes", "compte-gg-dette-depart");
  const payes = await getDocs(query(collection(db, "mouvements"), where("resId", "==", ref.id)));
  if (!payes.empty) {
    await setDoc(REF(), { amorce2: true }, { merge: true });
    return;
  }
  await deleteDoc(ref).catch(() => {});
  const gg = comptes.find((c) => /gg|g[ée]g[ée]/i.test(c.nom));
  const suite = comptes.map((c) => (gg && c.id === gg.id && !c.lignes.some((l) => l.type === "dette") ? { ...c, lignes: [...c.lignes, { id: nouvelIdCompte(), date: "2026-11-13", type: "dette", montant: 450, libelle: "Anciennes courses", moyen: "", affecte: 0 }] } : c));
  await setDoc(REF(), { json: JSON.stringify(suite), amorce2: true, majLe: serverTimestamp() }, { merge: true });
}

export default function SyncComptes() {
  const { pret, comptes, amorce, amorce2 } = useComptes();
  const correction = useRef(false);
  useEffect(() => {
    if (!pret || !amorce || amorce2 || correction.current) return;
    correction.current = true;
    corrigerDetteDepart(comptes).catch(() => {
      correction.current = false;
    });
  }, [pret, amorce, amorce2, comptes]);
  const rep = useRepertoire();
  const amorcage = useRef(false);
  useEffect(() => {
    if (!pret || amorce || amorcage.current || !rep.charge) return;
    amorcage.current = true;
    amorcer(comptes, rep.familles, rep).catch(() => {
      amorcage.current = false;
    });
  }, [pret, amorce, rep.charge, comptes, rep.familles]);
  const { demandes, mouvements } = useCoursesEtMouvements(true);
  const enCours = useRef(false);
  const plan = pret && demandes && mouvements && comptes.length ? planAllocation(comptes, demandes, mouvements, TARIFS.moyensPaiement) : null;
  const cle = plan && (plan.mouvements.length || plan.courses.length) ? JSON.stringify([plan.mouvements, plan.courses]) : "";
  useEffect(() => {
    if (!cle) return undefined;
    const minuteur = setTimeout(async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const lot = writeBatch(db);
        for (const x of plan.courses) lot.set(doc(db, "demandes", x.id), { ...x.demande, creeLe: serverTimestamp(), majLe: serverTimestamp() });
        for (const m of plan.mouvements) lot.set(doc(collection(db, "mouvements")), { ...m, creeLe: serverTimestamp() });
        lot.set(REF(), { json: JSON.stringify(plan.comptes), majLe: serverTimestamp() }, { merge: true });
        await lot.commit();
      } catch {
        /* on reessaiera au prochain changement */
      }
      enCours.current = false;
    }, 2500);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return null;
}
