import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { abonnerRepertoire, repertoireCourant } from "./pricing/repertoire.js";
import { enregistrerRepertoire } from "./repertoireBase.js";
import { familleVide } from "./pricing/familles.js";
import { ficheDepuisContrat } from "./pricing/contratResto.js";

// RESTAURANTS PARTENAIRES INSCRITS PAR LE LIEN (19 nov. 2026) - espace de Rebecca seulement.
// Un restaurant qui signe sur #/restaurant-partenaire crée contratsRestos/{id} (statut « signe »).
// Dès que l'admin de Rebecca est ouvert, la fiche « Commerçant partenaire » est ajoutée toute seule au Répertoire,
// puis le contrat est marqué « importe » (jamais deux fois : on vérifie aussi resto.contratId dans les fiches).
export function useImportContratsRestos(actif) {
  const [contrats, setContrats] = useState([]);
  const [pret, setPret] = useState(repertoireCourant().charge === true);
  const enCours = useRef(new Set());
  useEffect(() => abonnerRepertoire(() => setPret(repertoireCourant().charge === true)), []);
  useEffect(() => {
    if (!actif) return undefined;
    return onSnapshot(query(collection(db, "contratsRestos"), where("statut", "==", "signe")), (s) => setContrats(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setContrats([]));
  }, [actif]);
  useEffect(() => {
    if (!actif || !pret) return;
    const nouveaux = contrats.filter((c) => !c.importe && !enCours.current.has(c.id));
    if (!nouveaux.length) return;
    nouveaux.forEach((c) => enCours.current.add(c.id));
    (async () => {
      const rep = repertoireCourant();
      const familles = rep.familles || [];
      const ajouts = [];
      const marques = [];
      for (const c of nouveaux) {
        const deja = familles.find((f) => f.resto && f.resto.contratId === c.id);
        if (deja) marques.push([c.id, deja.id]);
        else {
          const fiche = ficheDepuisContrat(c, c.id, familleVide());
          ajouts.push(fiche);
          marques.push([c.id, fiche.id]);
        }
      }
      try {
        if (ajouts.length) await enregistrerRepertoire(rep.lieux, rep.corrections, [...familles, ...ajouts]);
        await Promise.all(marques.map(([id, ficheId]) => updateDoc(doc(db, "contratsRestos", id), { importe: true, ficheId, importeLe: serverTimestamp() })));
      } catch {
        nouveaux.forEach((c) => enCours.current.delete(c.id));
      }
    })();
  }, [actif, pret, contrats]);
}

// Tous les contrats (pour la section « Restaurants partenaires » de Partenaires)
export function useContratsRestos(actif = true) {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    if (!actif) return undefined;
    return onSnapshot(collection(db, "contratsRestos"), (s) => setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ((b.signeLe && b.signeLe.seconds) || 0) - ((a.signeLe && a.signeLe.seconds) || 0))), () => setListe([]));
  }, [actif]);
  return liste;
}

// Contresignature : quand Rebecca crée le lien de l'espace du restaurant, le contrat devient « valide »
export const validerContratResto = (id) => updateDoc(doc(db, "contratsRestos", id), { statut: "valide", valideLe: serverTimestamp() });
