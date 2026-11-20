import { useEffect, useState } from "react";
import { PAGES, empreinte, etatPage, lienDirectOuvert, reglagePage, telPourEmpreinte } from "./pricing/pagesSite.js";

// PAGES DU SITE côté clientes (20 nov. 2026) : lit reglages/pages (public) une fois, et dit pour CE visiteur
// si chaque page est ouverte, « bientôt », cachée ou bloquée. Sans réglage : le site reste comme aujourd'hui.
let promesse = null;
function chargerReglages() {
  if (!promesse) {
    promesse = Promise.all([import("./firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { doc, getDoc }]) => Promise.all([getDoc(doc(db, "reglages", "pages")), getDoc(doc(db, "reglages", "partenaires"))]))
      .then(([p, anciens]) => {
        const r = p.exists() ? p.data() : { pages: {} };
        // Ancien interrupteur « Visible sur le site » des coursiers partenaires (Partenaires), tant que la page n'a pas son réglage
        if (!(r.pages && r.pages.coursierPartenaire) && anciens.exists() && anciens.data().ouvert === true) {
          r.pages = { ...(r.pages || {}), coursierPartenaire: { visible: true, ou: "pied" } };
        }
        return r;
      })
      .catch(() => null);
  }
  return promesse;
}
export const rechargerPagesSite = () => {
  promesse = null;
};

// Aperçu « Voir comme une cliente » : ?apercu=cliente dans l'adresse -> visiteur sans compte, sans autorisation
export const enApercu = () => /[?&]apercu=cliente\b/.test(window.location.search) || /[?&]apercu=cliente\b/.test(window.location.hash);

export function usePagesSite(client, acces = {}) {
  const [reglages, setReglages] = useState(undefined); // undefined = pas encore lu ; null = illisible (site comme avant)
  const [empreintes, setEmpreintes] = useState([]);
  const [autorises, setAutorises] = useState({});
  const apercu = enApercu();
  const connecte = !apercu && !!(client && client.user && client.profil);
  const uid = connecte ? client.user.uid : "";
  const tel = connecte ? telPourEmpreinte(client.profil.telephone) : "";
  useEffect(() => {
    let actif = true;
    chargerReglages().then((r) => actif && setReglages(r));
    return () => { actif = false; };
  }, []);
  useEffect(() => {
    let actif = true;
    if (!tel) setEmpreintes([]);
    else empreinte(tel).then((e) => actif && setEmpreintes([e])).catch(() => {});
    return () => { actif = false; };
  }, [tel]);
  // Pages « seulement les clientes que j'autorise » (autre que Transport, déjà connu) : on lit ses autorisations
  const aVerifier = PAGES.filter((p) => p.type === "activite" && p.id !== "transport" && reglagePage(reglages || null, p.id).pour === "autorisees").map((p) => p.id).join(",");
  useEffect(() => {
    if (!uid || !aVerifier) return setAutorises({});
    let actif = true;
    Promise.all([import("./firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { doc, getDoc }]) => Promise.all(aVerifier.split(",").map((a) => getDoc(doc(db, "autorisations", `${uid}__${a}`)).then((s) => [a, s.exists() && s.data().actif === true]).catch(() => [a, false]))))
      .then((l) => actif && setAutorises(Object.fromEntries(l)))
      .catch(() => {});
    return () => { actif = false; };
  }, [uid, aVerifier]);

  const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const visiteur = (id) => ({ connecte, autorise: !apercu && (id === "transport" ? acces.transport === true : autorises[id] === true), empreintes, jour });
  return {
    charge: reglages !== undefined,
    apercu,
    etat: (id) => etatPage(reglages || null, id, visiteur(id)),
    lienOk: (id) => lienDirectOuvert(reglages || null, id, visiteur(id)),
    reglage: (id) => reglagePage(reglages || null, id),
  };
}

// Pour un formulaire sans compte : ce téléphone est-il bloqué sur cette page ?
export async function telBloque(id, telephone) {
  const r = await chargerReglages();
  const t = telPourEmpreinte(telephone);
  if (!r || !t) return false;
  return etatPage(r, id, { empreintes: [await empreinte(t)] }) === "bloquee";
}
