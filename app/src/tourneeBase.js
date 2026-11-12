import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { calculerDurees } from "./routing.js";
import { cleLieu, joursAVenir, lieuxDesTrajets, lireJours, lireTournee, tableDurees } from "./pricing/tournee.js";
import { ajouterJours } from "./pricing/calendrier.js";

// MA TOURNEE SCOLAIRE - lecture et enregistrement (12 nov. 2026)
// Document PRIVE admin/tournee (lisible et modifiable par Rebecca seule) : noms, adresses et horaires des enfants
// ne sont jamais publics.

const REF = () => doc(db, "admin", "tournee");

export function useTournee() {
  const [etat, setEtat] = useState({ pret: false, refuse: false, donnees: lireTournee("") });
  useEffect(
    () =>
      onSnapshot(
        REF(),
        (s) => setEtat({ pret: true, refuse: false, donnees: lireTournee(s.exists() ? s.data().json : "") }),
        () => setEtat({ pret: true, refuse: true, donnees: lireTournee("") })
      ),
    []
  );
  return etat;
}

export const enregistrerTournee = ({ trajets, forfaits, vacances, domicile, lieux, choix, devis, transferts }) =>
  setDoc(REF(), { json: JSON.stringify({ trajets, forfaits, vacances, lieux: lieux || [], choix: choix || [], devis: devis || [], transferts: transferts || [], domicile: domicile || null }), majLe: serverTimestamp() });

// Temps de route entre tous les lieux des trajets (un seul appel). Renvoie { duree(cleA, cleB), statut }.
export function useDurees(trajets, domicile = null) {
  const lieux = useMemo(() => lieuxDesTrajets(trajets, domicile), [trajets, domicile]);
  const cle = lieux.map(cleLieu).join("|");
  const [etat, setEtat] = useState({ cle: "", table: {}, statut: "vide" });
  useEffect(() => {
    if (lieux.length < 2) {
      setEtat({ cle, table: {}, statut: "vide" });
      return undefined;
    }
    const ctrl = new AbortController();
    setEtat((o) => ({ ...o, statut: "chargement" }));
    calculerDurees(lieux, ctrl.signal)
      .then((matrice) => setEtat({ cle, table: tableDurees(lieux, matrice), statut: "ok" }))
      .catch((e) => e.name !== "AbortError" && setEtat({ cle, table: {}, statut: "erreur" }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  const table = etat.cle === cle ? etat.table : {};
  return { statut: etat.cle === cle ? etat.statut : "chargement", duree: (a, b) => (a === b ? 0 : typeof table[`${a}>${b}`] === "number" ? table[`${a}>${b}`] : null) };
}

export const PASTILLES = {
  possible: { signe: "✅", texte: "Possible" },
  serre: { signe: "⚠️", texte: "Serré" },
  impossible: { signe: "❌", texte: "Impossible" },
  inconnu: { signe: "⏳", texte: "Calcul en cours" },
  vide: { signe: "•", texte: "Rien ce jour-là" },
};

// CHANGEMENTS D'UNE JOURNEE (12 nov. 2026, 16h29) : document PRIVE admin/tourneeJours. Un trajet retire ou une heure
// changee pour une date, et mes taches du jour, sans toucher a la tournee de toutes les semaines.
const REF_JOURS = () => doc(db, "admin", "tourneeJours");
export function useJoursTournee(actif = true) {
  const [jours, setJours] = useState({});
  useEffect(() => (actif ? onSnapshot(REF_JOURS(), (s) => setJours(lireJours(s.exists() ? s.data().json : "{}")), () => setJours({})) : undefined), [actif]);
  return jours;
}
export const enregistrerJours = (jours) => {
  const hier = ajouterJours(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), -1);
  return setDoc(REF_JOURS(), { json: JSON.stringify(joursAVenir(jours, hier)), majLe: serverTimestamp() });
};
