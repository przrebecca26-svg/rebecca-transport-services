import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { annuairePublic, candidatureVersDossier, lireAnnuaire, lireCategories, lireDossiers, normaliserDossier } from "./pricing/pros.js";
import { lireAgenda, normaliserRdv, quartsDe, quartsOccupes } from "./pricing/prosAgenda.js";
import { lireParams } from "./pricing/livraisonPartenaire.js";

// RESEAU DE PROFESSIONNELS PARTENAIRES - lecture et ecriture Firebase (25 nov. 2026). Voir pricing/pros.js.
// Avec les regles v36 (deja publiees) : tout ce qui est admin/... et reglages/... marche tout de suite.
// Avec les regles v37 : inscription en ligne (prosCandidatures) et compteurs (prosStats).

export const aujourdhuiIsrael = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

function useDocJson(chemin, lire) {
  const [v, setV] = useState(null);
  useEffect(() => onSnapshot(doc(db, ...chemin), (s) => setV(lire(s.exists() ? s.data().json : null)), () => setV(lire(null))), [chemin.join("/")]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}
export const useCategoriesPros = () => useDocJson(["reglages", "prosCategories"], lireCategories);
export const useAnnuairePros = () => useDocJson(["reglages", "prosAnnuaire"], lireAnnuaire);
export const useDossiersPros = () => useDocJson(["admin", "prosDossiers"], lireDossiers);

// Logo et photos publiques d'une fiche (reglages/prosImg_ID : 1 Mo maximum, 4 photos reduites)
export function useImagesPro(id) {
  const [img, setImg] = useState({});
  useEffect(() => (id ? onSnapshot(doc(db, "reglages", "prosImg_" + id), (s) => setImg(s.exists() ? s.data() : {}), () => setImg({})) : undefined), [id]);
  return img;
}
export const enregistrerImagesPro = (id, img) => setDoc(doc(db, "reglages", "prosImg_" + id), { logo: img.logo || "", photos: (img.photos || []).slice(0, 4), majLe: serverTimestamp() });
export const supprimerImagesPro = (id) => deleteDoc(doc(db, "reglages", "prosImg_" + id));

// Photo d'un justificatif (PRIVE : admin/prosDoc_ID_type, Rebecca seule)
export function useJustifPhoto(id, type, actif) {
  const [p, setP] = useState(null);
  useEffect(() => (actif && id && type ? onSnapshot(doc(db, "admin", `prosDoc_${id}_${type}`), (s) => setP(s.exists() ? s.data().photo || "" : ""), () => setP("")) : undefined), [id, type, actif]);
  return p;
}
export const enregistrerJustifPhoto = (id, type, photo) => setDoc(doc(db, "admin", `prosDoc_${id}_${type}`), { photo, majLe: serverTimestamp() });
export const supprimerJustifPhoto = (id, type) => deleteDoc(doc(db, "admin", `prosDoc_${id}_${type}`));

// Enregistre TOUS les dossiers (prives) et republie l'annuaire public dans la foulee :
// seules les fiches acceptees, actives, d'un metier visible, avec leurs champs publics, sortent d'admin/.
// 25 nov. 2026, 19h52 (Rebecca : « vérifier que les pages cachées sont aussi protégées au niveau des données ») :
// tant que la page « Annuaire » est cachée, reglages/prosAnnuaire reste VIDE ; l'aperçu de Rebecca est calculé
// directement depuis ses dossiers privés. Quand elle ouvre la page, « Publier l'annuaire » le remplit.
export async function publierAnnuaire(dossiers, categories) {
  const visible = await pageProsVisible().catch(() => false);
  const liste = visible ? annuairePublic(dossiers, categories, aujourdhuiIsrael()) : [];
  await setDoc(doc(db, "reglages", "prosAnnuaire"), { json: JSON.stringify(liste), majLe: serverTimestamp() });
  return { visible, nombre: liste.length };
}
export async function enregistrerDossiers(liste, categories) {
  const propres = (liste || []).map(normaliserDossier).filter((d) => d.id);
  await setDoc(doc(db, "admin", "prosDossiers"), { json: JSON.stringify(propres), majLe: serverTimestamp() });
  await publierAnnuaire(propres, categories);
}
export async function enregistrerCategories(cats, dossiers) {
  await setDoc(doc(db, "reglages", "prosCategories"), { json: JSON.stringify(cats), majLe: serverTimestamp() });
  // un metier cache retire tout de suite ses fiches de l'annuaire
  if (dossiers) await publierAnnuaire(dossiers, cats);
}

/* ---------- Avec les regles v37 ---------- */
// Inscription en ligne : la candidature (deja au statut « soumis ») attend la decision de Rebecca
export async function envoyerCandidature(form) {
  const d = candidatureVersDossier(form);
  await addDoc(collection(db, "prosCandidatures"), { json: JSON.stringify(d), creeLe: serverTimestamp() });
  return d;
}
export function useCandidaturesPros(actif) {
  const [l, setL] = useState(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    if (!actif) return undefined;
    return onSnapshot(
      collection(db, "prosCandidatures"),
      (s) => { setErreur(false); setL(s.docs.map((x) => ({ cle: x.id, dossier: lireDossiers(JSON.stringify([JSON.parse(x.data().json || "null")]))[0] })).filter((x) => x.dossier)); },
      () => { setErreur(true); setL([]); },
    );
  }, [actif]);
  return { liste: l, erreur };
}
export const supprimerCandidature = (cle) => deleteDoc(doc(db, "prosCandidatures", cle));

// Compteurs d'une fiche (visites, clics WhatsApp) : +1 seulement ; sans les regles v37, rien ne se passe
export function compterPro(id, champ) {
  if (!id || !["visites", "whatsapp"].includes(champ)) return;
  setDoc(doc(db, "prosStats", id), { [champ]: increment(1) }, { merge: true }).catch(() => {});
}
export function useStatsPros(actif) {
  const [s, setS] = useState({});
  useEffect(() => (actif ? onSnapshot(collection(db, "prosStats"), (q) => setS(Object.fromEntries(q.docs.map((x) => [x.id, x.data()]))), () => setS({})) : undefined), [actif]);
  return s;
}

/* ---------- Espace des professionnels (regles v37) ---------- */
// Invitation : Rebecca cree un code lie a l'e-mail du pro ; le pro se connecte avec CET e-mail et lie son compte.
export const enregistrerInvitation = (code, { proId, email, nom }) => setDoc(doc(db, "prosInvitations", code), { proId, email: String(email).toLowerCase(), nom: nom || "", creeLe: serverTimestamp() });
export const supprimerInvitation = (code) => deleteDoc(doc(db, "prosInvitations", code));
export function useComptesPros(actif) {
  const [l, setL] = useState([]);
  useEffect(() => (actif ? onSnapshot(collection(db, "prosComptes"), (s) => setL(s.docs.map((x) => ({ uid: x.id, ...x.data() }))), () => setL([])) : undefined), [actif]);
  return l;
}
export const changerStatutCompte = (uid, statut) => setDoc(doc(db, "prosComptes", uid), { statut }, { merge: true });
// Compte pro de la personne connectee (undefined = chargement, null = aucun)
export function useComptePro(uid) {
  const [c, setC] = useState(undefined);
  useEffect(() => {
    if (!uid) {
      setC(null);
      return undefined;
    }
    return onSnapshot(doc(db, "prosComptes", uid), (s) => setC(s.exists() ? s.data() : null), () => setC(null));
  }, [uid]);
  return c;
}
export async function lierComptePro(user, code) {
  const { getDoc } = await import("firebase/firestore");
  const inv = await getDoc(doc(db, "prosInvitations", code));
  if (!inv.exists()) throw new Error("Lien d'invitation inconnu ou retiré. Demande un nouveau lien à Rebecca.");
  await setDoc(doc(db, "prosComptes", user.uid), { proId: inv.data().proId, nom: String(inv.data().nom || "").slice(0, 80), code, email: user.email || "", statut: "actif", creeLe: serverTimestamp() });
}

// Agenda d'un pro (reglages) : prosAgenda/{proId}
export function useAgendaPro(proId) {
  const [a, setA] = useState(undefined);
  useEffect(() => (proId ? onSnapshot(doc(db, "prosAgenda", proId), (s) => setA(s.exists() ? { ...lireAgenda(s.data().json), nom: s.data().nom || "" } : null), () => setA(null)) : undefined), [proId]);
  return a;
}
export const enregistrerAgendaPro = (proId, agenda, nom) => setDoc(doc(db, "prosAgenda", proId), { json: JSON.stringify(lireAgenda(agenda)), nom: String(nom || "").slice(0, 80), majLe: serverTimestamp() });

// Rendez-vous d'un pro (le pro et Rebecca seulement)
export function useRdvPro(proId) {
  const [l, setL] = useState(null);
  useEffect(() => {
    if (!proId) return undefined;
    return onSnapshot(query(collection(db, "prosRdv"), where("proId", "==", proId)), (s) => setL(s.docs.map((x) => ({ ...normaliserRdv({ ...x.data(), id: x.id }), rappelEnvoye: x.data().rappelEnvoye === true }))), () => setL([]));
  }, [proId]);
  return l;
}
// Les quarts d'heure pris d'un jour sont recalcules a partir des rendez-vous du pro (verrou public anti double reservation)
async function recalculerCellules(proId, date, rdvs, pause) {
  const cells = Object.fromEntries([...quartsOccupes(rdvs, date, pause)].map((q) => [q, true]));
  const ref = doc(db, "prosCreneaux", `${proId}__${date}`);
  if (Object.keys(cells).length) await setDoc(ref, { proId, cells, majLe: serverTimestamp() });
  else await deleteDoc(ref).catch(() => {});
}
// Rendez-vous ajoute ou modifie par le pro (ou Rebecca). Les jours touches sont recalcules.
export async function enregistrerRdvPro(proId, rdv, rdvs, agenda) {
  const r = normaliserRdv({ ...rdv, proId });
  const ref = r.id ? doc(db, "prosRdv", r.id) : doc(collection(db, "prosRdv"));
  const ancien = (rdvs || []).find((x) => x.id === r.id);
  const { id, ...donnees } = { ...r, id: ref.id };
  await setDoc(ref, { ...donnees, rappelEnvoye: rdv.rappelEnvoye === true, majLe: serverTimestamp(), ...(ancien ? {} : { creeLe: serverTimestamp() }) }, { merge: true });
  const suite = [...(rdvs || []).filter((x) => x.id !== id), { ...r, id }];
  const pause = agenda ? agenda.pause : 0;
  await recalculerCellules(proId, r.date, suite, pause);
  if (ancien && ancien.date !== r.date) await recalculerCellules(proId, ancien.date, suite, pause);
  return id;
}
export async function supprimerRdvPro(proId, rdv, rdvs, agenda) {
  await deleteDoc(doc(db, "prosRdv", rdv.id));
  await recalculerCellules(proId, rdv.date, (rdvs || []).filter((x) => x.id !== rdv.id), agenda ? agenda.pause : 0);
}
export const marquerRappel = (id) => setDoc(doc(db, "prosRdv", id), { rappelEnvoye: true, majLe: serverTimestamp() }, { merge: true });

// Cote cliente : quarts d'heure pris un jour (sans aucun nom)
export function useCellulesPro(proId, date) {
  const [c, setC] = useState(null);
  useEffect(() => (proId && date ? onSnapshot(doc(db, "prosCreneaux", `${proId}__${date}`), (s) => setC(s.exists() ? s.data().cells || {} : {}), () => setC({})) : undefined), [proId, date]);
  return c;
}
// Demande de rendez-vous d'une cliente : la demande et le verrou de son creneau dans la meme operation
export async function demanderRdvPro(proId, f, prestation, agenda) {
  const refRdv = doc(collection(db, "prosRdv"));
  const refCells = doc(db, "prosCreneaux", `${proId}__${f.date}`);
  const quarts = quartsDe(f.heure, prestation.duree + (agenda ? agenda.pause : 0));
  await runTransaction(db, async (tx) => {
    const s = await tx.get(refCells);
    const avant = s.exists() ? s.data().cells || {} : {};
    if (quarts.some((q) => avant[q] === true)) throw new Error("pris");
    const cells = { ...avant, ...Object.fromEntries(quarts.map((q) => [q, true])) };
    tx.set(refRdv, { proId, date: f.date, heure: f.heure, duree: prestation.duree, prestation: prestation.nom, client: { nom: String(f.nom).trim().slice(0, 80), telephone: String(f.telephone).trim().slice(0, 20) }, note: String(f.note || "").trim().slice(0, 500), statut: "demande", source: "client", creeLe: serverTimestamp(), majLe: serverTimestamp() });
    tx.set(refCells, { proId, cells, majLe: serverTimestamp(), rdv: refRdv.id });
  });
  return refRdv.id;
}

// Rebecca : tous les rendez-vous (statistiques individuelles), toutes les demandes et tous les paiements (revenus)
export function useTousRdvPros(actif) {
  const [l, setL] = useState([]);
  useEffect(() => (actif ? onSnapshot(collection(db, "prosRdv"), (s) => setL(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setL([])) : undefined), [actif]);
  return l;
}
export function useCollectionAdmin(nom, actif) {
  const [l, setL] = useState(null);
  useEffect(() => (actif ? onSnapshot(collection(db, nom), (s) => setL(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setL([])) : undefined), [nom, actif]);
  return l;
}
// 25 nov. 2026 (21h42) : formule « Livraison partenaire » - reglages prives de Rebecca (admin/livraisonPartenaire)
export const useParamsLivraisonPartenaire = () => useDocJson(["admin", "livraisonPartenaire"], lireParams);
export const enregistrerParamsLivraisonPartenaire = (p) => setDoc(doc(db, "admin", "livraisonPartenaire"), { json: JSON.stringify(lireParams(p)), majLe: serverTimestamp() });
export const rattacherLivraison = (demandeId, proId) => setDoc(doc(db, "demandes", demandeId), { proPartenaire: proId || null }, { merge: true });

// L'annuaire public n'est rempli QUE si la page est ouverte au public (protection des donnees quand elle est cachee)
export async function pageProsVisible() {
  const { getDoc } = await import("firebase/firestore");
  const s = await getDoc(doc(db, "reglages", "pages"));
  return !!(s.exists() && s.data().pages && s.data().pages.pros && s.data().pages.pros.visible === true);
}
