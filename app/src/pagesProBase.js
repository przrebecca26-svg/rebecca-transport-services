import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { reduirePhoto } from "./photoReduite.js";
import {
  ajouterVersion, jetonAleatoire, lirePagePublique, lireVersions, normaliserPage, pageHorsLigne, pagePublique, photosAEffacer, photosReferencees,
} from "./pricing/pagesPro.js";

// GENERATEUR DE PAGES PROFESSIONNELLES - lecture et ecriture Firebase (lot 1, 27 nov. 2026). Voir pricing/pagesPro.js.
// Regles v42 : pagesProAdmin et pagesProVersions = Rebecca seule ; pagesPubliques, pagesApercus, pagesPhotos =
// lecture d'UN document par son identifiant (jamais de liste), ecriture par Rebecca seule.

/* ---------- Pages (espace prive de Rebecca) ---------- */
export function usePagesAdmin() {
  const [l, setL] = useState(null);
  useEffect(() => onSnapshot(collection(db, "pagesProAdmin"), (s) => {
    const pages = [];
    s.forEach((d) => { try { pages.push(normaliserPage(JSON.parse(d.data().json || "{}"))); } catch { /* page illisible ignoree */ } });
    setL(pages.sort((a, b) => b.majLeMs - a.majLeMs));
  }, () => setL([])), []);
  return l;
}
export const enregistrerPageAdmin = (page) => setDoc(doc(db, "pagesProAdmin", page.id), { json: JSON.stringify(normaliserPage(page)), majLe: serverTimestamp() });

export function useVersionsPage(id) {
  const [v, setV] = useState([]);
  useEffect(() => (id ? onSnapshot(doc(db, "pagesProVersions", id), (s) => setV(s.exists() ? lireVersions(s.data().json) : []), () => setV([])) : undefined), [id]);
  return v;
}
// Version en ligne (lue par son adresse)
export async function lirePublique(adresse) {
  if (!adresse) return null;
  const s = await getDoc(doc(db, "pagesPubliques", adresse));
  return s.exists() ? lirePagePublique(s.data().json) : null;
}
export function usePagePublique(adresse) {
  const [p, setP] = useState(undefined);
  useEffect(() => (adresse ? onSnapshot(doc(db, "pagesPubliques", adresse), (s) => setP(s.exists() ? lirePagePublique(s.data().json) : null), () => setP(null)) : undefined), [adresse]);
  return p;
}
export function useApercu(jeton) {
  const [p, setP] = useState(undefined);
  useEffect(() => (jeton ? onSnapshot(doc(db, "pagesApercus", jeton), (s) => {
    if (!s.exists()) return setP(null);
    const d = s.data();
    return setP(Number(d.expireLeMs) < Date.now() ? null : lirePagePublique(d.json));
  }, () => setP(null)) : undefined), [jeton]);
  return p;
}

// Publier : version en ligne + version gardee (5 dernieres) ; si l'adresse a change, l'ancienne est retiree
export async function publierPage(page, dossier, versions, ancienneAdresse = "") {
  const maintenant = Date.now();
  const p = normaliserPage({ ...page, statut: "publiee", publieeLeMs: maintenant, majLeMs: maintenant });
  const lot = writeBatch(db);
  lot.set(doc(db, "pagesPubliques", p.adresse), { json: JSON.stringify(pagePublique(p, dossier)), majLe: serverTimestamp() });
  if (ancienneAdresse && ancienneAdresse !== p.adresse) lot.delete(doc(db, "pagesPubliques", ancienneAdresse));
  lot.set(doc(db, "pagesProVersions", p.id), { json: JSON.stringify(ajouterVersion(versions, p, maintenant)), majLe: serverTimestamp() });
  lot.set(doc(db, "pagesProAdmin", p.id), { json: JSON.stringify(p), majLe: serverTimestamp() });
  await lot.commit();
  return p;
}
// Suspendre / archiver / remettre en preparation : la page en ligne n'affiche plus que « momentanement indisponible »
export async function retirerPage(page, statut) {
  const p = normaliserPage({ ...page, statut, majLeMs: Date.now() });
  const lot = writeBatch(db);
  if (p.adresse) lot.set(doc(db, "pagesPubliques", p.adresse), { json: JSON.stringify(pageHorsLigne(p, statut === "archivee" ? "archivee" : "suspendue")), majLe: serverTimestamp() });
  lot.set(doc(db, "pagesProAdmin", p.id), { json: JSON.stringify(p), majLe: serverTimestamp() });
  await lot.commit();
  return p;
}
// Apercu prive pour le client : lien secret, expire au bout de 14 jours (ou quand Rebecca le retire)
export async function creerApercu(page, dossier) {
  const jeton = page.apercu && page.apercu.jeton && page.apercu.expireLeMs > Date.now() ? page.apercu.jeton : jetonAleatoire(28);
  const expireLeMs = Date.now() + 14 * 24 * 3600 * 1000;
  await setDoc(doc(db, "pagesApercus", jeton), { json: JSON.stringify(pagePublique(page, dossier)), expireLeMs, majLe: serverTimestamp() });
  return { jeton, expireLeMs };
}
export const supprimerApercu = (jeton) => (jeton ? deleteDoc(doc(db, "pagesApercus", jeton)) : Promise.resolve());

/* ---------- Photos : une photo par document, lue seulement par son numero ---------- */
const nouvelIdPhoto = () => `ph${Date.now().toString(36)}${jetonAleatoire(10)}`;
// type : logo (petit), photo (galerie, produits, couverture)
export async function ajouterPhoto(fichier, pageId, type = "photo") {
  const donnees = await reduirePhoto(fichier, type === "logo" ? { cote: 700, qualite: 0.85, maxOctets: 200000 } : { cote: 1200, qualite: 0.8, maxOctets: 330000 });
  const id = nouvelIdPhoto();
  await setDoc(doc(db, "pagesPhotos", id), { donnees, pageId, octets: donnees.length, majLe: serverTimestamp() });
  return { id, octets: donnees.length };
}
// Photo deja en texte (restauration d'une sauvegarde) : meme numero qu'avant, pour que la page la retrouve
export const remettrePhoto = (id, donnees, pageId) => setDoc(doc(db, "pagesPhotos", id), { donnees, pageId, octets: donnees.length, majLe: serverTimestamp() });
const cachePhotos = new Map();
export async function lirePhoto(id) {
  if (!id) return "";
  if (cachePhotos.has(id)) return cachePhotos.get(id);
  const promesse = getDoc(doc(db, "pagesPhotos", id)).then((s) => (s.exists() ? s.data().donnees || "" : "")).catch(() => "");
  cachePhotos.set(id, promesse);
  return promesse;
}
export function usePhoto(id) {
  const [d, setD] = useState("");
  useEffect(() => {
    let vivant = true;
    setD("");
    if (id) lirePhoto(id).then((x) => vivant && setD(x));
    return () => { vivant = false; };
  }, [id]);
  return d;
}
// Menage : efface les photos de la page qui ne servent plus (ni brouillon, ni en ligne, ni anciennes versions)
export async function rangerPhotos(page, versions, publiee) {
  const aEffacer = photosAEffacer(page, versions, publiee);
  if (!aEffacer.length) return page;
  await Promise.all(aEffacer.map((id) => deleteDoc(doc(db, "pagesPhotos", id)).catch(() => {})));
  const info = { ...page.photosInfo };
  for (const id of aEffacer) { delete info[id]; cachePhotos.delete(id); }
  return { ...page, photosInfo: info };
}

/* ---------- Sauvegarde sur le telephone (ZIP) : textes + photos, sans rien doubler dans Firebase ---------- */
export async function exporterPages(pages, versionsParPage = {}) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("LISEZMOI.txt", "Sauvegarde des pages professionnelles - Rebecca Services.\nPour restaurer : Admin > Pages des pros > Restaurer une sauvegarde, et choisir ce fichier.\n");
  for (const p of pages) {
    const dossier = zip.folder(p.adresse || p.id);
    dossier.file("page.json", JSON.stringify({ page: p, versions: versionsParPage[p.id] || [] }, null, 1));
    const ids = new Set([...photosReferencees(p), ...Object.keys(p.photosInfo || {})]);
    for (const id of ids) {
      const d = await lirePhoto(id);
      if (d) dossier.file(`photos/${id}.jpg`, d.split(",")[1] || "", { base64: true });
    }
  }
  return zip.generateAsync({ type: "blob" });
}
// Restaurer : remet les pages (et leurs photos) telles qu'elles etaient au moment de la sauvegarde
export async function restaurerSauvegarde(fichier) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(fichier);
  const restaurees = [];
  for (const nom of Object.keys(zip.files).filter((n) => /(^|\/)page\.json$/.test(n))) {
    const base = nom.replace(/page\.json$/, "");
    const { page, versions } = JSON.parse(await zip.file(nom).async("string"));
    const p = normaliserPage(page);
    for (const f of Object.keys(zip.files).filter((n) => n.startsWith(base + "photos/") && n.endsWith(".jpg"))) {
      const id = f.slice(base.length + 7, -4);
      const b64 = await zip.file(f).async("base64");
      await remettrePhoto(id, `data:image/jpeg;base64,${b64}`, p.id);
    }
    await enregistrerPageAdmin(p);
    if (Array.isArray(versions) && versions.length) await setDoc(doc(db, "pagesProVersions", p.id), { json: JSON.stringify(versions), majLe: serverTimestamp() });
    restaurees.push(p.nom || p.id);
  }
  return restaurees;
}

/* ---------- Grille Digital et dossier pro ---------- */
export { useGrilleDigitalPro, GRILLE_DEPART } from "./components/DigitalPro.jsx";
