import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { annuairePublic, candidatureVersDossier, lireAnnuaire, lireCategories, lireDossiers, normaliserDossier } from "./pricing/pros.js";

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
export async function enregistrerDossiers(liste, categories) {
  const propres = (liste || []).map(normaliserDossier).filter((d) => d.id);
  await setDoc(doc(db, "admin", "prosDossiers"), { json: JSON.stringify(propres), majLe: serverTimestamp() });
  await setDoc(doc(db, "reglages", "prosAnnuaire"), { json: JSON.stringify(annuairePublic(propres, categories, aujourdhuiIsrael())), majLe: serverTimestamp() });
}
export async function enregistrerCategories(cats, dossiers) {
  await setDoc(doc(db, "reglages", "prosCategories"), { json: JSON.stringify(cats), majLe: serverTimestamp() });
  // un metier cache retire tout de suite ses fiches de l'annuaire
  if (dossiers) await setDoc(doc(db, "reglages", "prosAnnuaire"), { json: JSON.stringify(annuairePublic(dossiers, cats, aujourdhuiIsrael())), majLe: serverTimestamp() });
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
