import { kmEntre, MIN_PAR_KM } from "./pricing/coursesGroupees.js";
import { useEffect, useMemo, useRef } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { ajouterLigne, courseDuCompte } from "./pricing/comptesEntreNous.js";
import { enregistrerComptes, useComptes } from "./comptesBase.js";
import { compteDansForfait, courseForfait, famillesDeLEtape, familleEncoreFaite, idForfait, lireForfait, telephoneFamille } from "./pricing/forfaitJour.js";
import { vacancesDuJour } from "./pricing/calendrier.js";
import { avecMoiDe, changerAvecMoi, ajoutsDesJours, ajouterTrajetCeJour, ajouterTache, annulerEtape, estPonctuel, retirerAjout, trajetPonctuel, changerHeureCeJour, cleEtape, faitA, validerEtape, enMin, filTournee, journeeDeLaDate, journeeNormale, modifierTache, nomDuLieu, remettreCeJour, retirerCeJour, retirerTache, tachesConfiees, tachesDuJour, trajetsDuJourDate, etapesPerso, etapesVol } from "./pricing/tournee.js";
import { lireChoix, trajetsDesChoix } from "./pricing/familles.js";
import { fusionnerLieux } from "./pricing/repertoire.js";
import { enregistrerJours, useDurees, useJoursTournee, useTournee } from "./tourneeBase.js";
import { useRepertoire } from "./repertoireBase.js";
import { confierAuCoequipier, confierTache, reprendreDuCoequipier, reprendreTache } from "./confierBase.js";

// MA JOURNEE DANS MON CALENDRIER (12 nov. 2026) - espace de Rebecca seulement.
// Lit sa tournee privee (admin/tournee) et renvoie, pour chaque date, les vraies etapes de sa journee
// (partir de la maison, deposer, recuperer, temps libre...) a la place de « Creneau deja reserve ».
// 16h29 : elle modifie UNE journee directement dans le Calendrier (retirer un trajet, changer une heure, ajouter une
// tache qui bloque un creneau) sans toucher a sa tournee de toutes les semaines (document prive admin/tourneeJours).
// Tout se relie tout seul : SyncTournee recalcule les creneaux bloques de cette date sur le site.
// etat : "sans" (pas de tournee : on garde l'ancien affichage), "calcul" (temps de route en cours), "ok"
export function useMaJournee(actif) {
  const base = useTournee();
  const jours = useJoursTournee(actif);
  const repertoire = useRepertoire();
  const comptes = useComptes();
  const d = base.donnees;
  const tous = useMemo(() => (actif ? [...trajetsDesChoix(repertoire.familles, lireChoix(d.choix)), ...d.trajets] : []), [actif, repertoire.familles, d.choix, d.trajets]);
  const ajouts = useMemo(() => ajoutsDesJours(jours), [jours]);
  const durees = useDurees(useMemo(() => [...tous, ...ajouts], [tous, ajouts]), d.domicile);
  const tousEtAjouts = useMemo(() => [...tous, ...ajouts], [tous, ajouts]);
  const lieux = useMemo(() => fusionnerLieux(repertoire.lieux, d.lieux), [repertoire.lieux, d.lieux]);
  const utilisee = actif && base.pret && !base.refuse;
  const etat = !utilisee ? "sans" : tousEtAjouts.length === 0 || durees.statut === "ok" ? "ok" : durees.statut === "erreur" ? "sans" : "calcul";
  const nomLieu = (a) => nomDuLieu(a, d.domicile, lieux);

  // Etapes de la tournee + mes taches du jour, dans l'ordre des heures
  const fil = (date) => {
    if (etat !== "ok") return [];
    const taches = tachesDuJour(jours, date).flatMap((x) => {
      // 25 nov. 2026, 22h30 : trajet personnel -> prendre la personne, les arrêts, la déposer (étapes privées)
      if (x.type === "perso") return etapesPerso(x).map((e) => ({ ...e, genre: "tache", tache: x, lieu: e.adresse ? nomLieu(e.adresse) || String(e.adresse.label || "").split(",")[0] : "" }));
      // 26 nov. 2026 (18h27) : transport aéroport avec un vol -> partir de la maison, prendre, déposer, de retour
      if (x.type === "transport" && x.vol) {
        const ev = etapesVol(x);
        if (ev.length) return ev.map((e) => ({ ...e, genre: "tache", tache: x, lieu: e.adresse ? nomLieu(e.adresse) || String(e.adresse.label || "").split(",")[0] : "" }));
      }
      const t = { min: enMin(x.debut), genre: "tache", heure: x.debut.replace(":", "h"), jusqua: x.fin.replace(":", "h"), texte: x.titre, tache: x, adresse: x.lieu, lieu: x.lieu ? nomLieu(x.lieu) || String(x.lieu.label).split(",")[0] : "" };
      // 25 nov. 2026 : « d'abord passer prendre Maman » -> une étape avant la tâche (trajet estimé, 5 min sur place)
      if (!x.prise || !Number.isFinite(x.prise.lat) || !x.lieu || !Number.isFinite(x.lieu.lat)) return [t];
      const route = Math.max(5, Math.round(kmEntre(x.prise, x.lieu) * MIN_PAR_KM));
      const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
      const lieuPrise = nomLieu(x.prise) || String(x.prise.label || "").split(",")[0];
      // 25 nov. 2026, 21h55 : Transport / aéroport -> l'heure de la tâche = l'heure où je prends la personne,
      // puis l'arrivée (trajet estimé) jusqu'à l'heure de fin (retour compris)
      if (x.type === "transport") {
        const arrivee = t.min + route;
        return [
          { min: t.min, genre: "tache", heure: t.heure, jusqua: hm(arrivee), texte: `Prendre${x.pour ? " " + x.pour : ""}`, tache: x, cle: "prise@" + x.id, adresse: x.prise, lieu: lieuPrise },
          { ...t, min: arrivee, heure: hm(arrivee), texte: `Déposer${x.pour ? " " + x.pour : ""} · ${x.titre}` },
        ];
      }
      const m = t.min - route - 5;
      return [{ min: m, genre: "tache", heure: hm(m), jusqua: t.heure, texte: `Passer prendre${x.pour ? " " + x.pour : ""}`, tache: x, cle: "prise@" + x.id, adresse: x.prise, lieu: lieuPrise }, t];
    });
    if (vacancesDuJour(date) || !(tous.length || ((jours[date] || {}).ajouts || []).length)) return taches;
    const j = journeeDeLaDate(tous, date, d.transferts, durees.duree, d.domicile, TARIFS, jours);
    if (!j || j.statut === "inconnu") return taches;
    const etapes = filTournee(j, nomLieu, d.domicile).map((e) => ({ ...e, alerte: e.genre === "arret" && e.coince ? j.probleme : "" }));
    return [...etapes, ...taches].sort((a, b) => a.min - b.min);
  };
  // Trajets retires ce jour-la (pour pouvoir les remettre)
  const retires = (date) => {
    const ids = ((jours[date] || {}).retires) || [];
    return trajetsDuJourDate(tous, date).filter((r) => ids.includes(r.id));
  };
  const heureChangee = (date, ids) => ids.some((id) => ((jours[date] || {}).heures || {})[id]);
  const sauver = (suite) => enregistrerJours(suite);

  // « ✓ Fait » (13 nov. 2026) : cocher une etape pour CE jour. Si la famille a un forfait a la journee (Alexia 70 ₪),
  // la journee part dans Finances une seule fois (course terminee, reste a encaisser tant qu'elle n'a pas paye).
  // Renvoie un petit message a afficher sous l'etape (ou "").
  const familleDe = (id) => repertoire.familles.find((f) => f.id === id) || null;
  const valider = async (date, e) => {
    const cle = cleEtape(e);
    if (!cle) return "";
    const heure = new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
    await sauver(validerEtape(jours, date, cle, heure));
    return assurerForfaits(date, e);
  };
  // Le forfait de la journee pour une etape cochee (une seule course par famille et par jour)
  const assurerForfaits = async (date, e) => {
    const notes = [];
    for (const id of compteDansForfait(e) ? famillesDeLEtape(e, tousEtAjouts) : []) {
      const f = familleDe(id);
      if (!f) continue;
      if (!lireForfait(f.forfaitJour)) {
        // 13 nov. 2026, 12h56 : sans forfait dans la fiche, rien ne partait et rien ne le disait
        if (f.categorie !== "moi") notes.push(`Pas de forfait à la journée dans la fiche de ${f.nom || "cette famille"} : mets le montant dans Répertoire → Fiche → Enfants, « Forfait à la journée ».`);
        continue;
      }
      if (telephoneFamille(f).length < 3) {
        notes.push(`Ajoute le téléphone de ${f.nom || "la famille"} dans sa fiche (Répertoire) pour que son forfait parte dans Finances.`);
        continue;
      }
      const ref = doc(db, "demandes", idForfait(id, date));
      if ((await getDoc(ref)).exists()) continue; // deja comptee aujourd'hui (un autre trajet coche)
      const premier = fil(date).find((x) => compteDansForfait(x) && famillesDeLEtape(x, tousEtAjouts).includes(id));
      const course = courseForfait(f, date, premier && premier.heure ? premier.heure.replace("h", ":") : "");
      if (!course) continue;
      await setDoc(ref, { ...course, creeLe: serverTimestamp(), majLe: serverTimestamp() });
      notes.push(`Journée de ${f.nom} comptée dans Finances : ${course.prixFinal} ₪ à encaisser.`);
    }
    return notes.join(" ");
  };
  // Rattrapage (13 nov. 2026, 12h56) : une sortie deja cochee aujourd'hui ou hier dont la journee n'est pas encore
  // comptee (forfait ajoute apres coup, connexion coupee...) est comptee toute seule a l'ouverture du Calendrier.
  const rattrapes = useRef(new Set());
  useEffect(() => {
    if (!actif || etat !== "ok") return;
    const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
    const hier = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
    for (const date of [hier, auj]) {
      const faits = (jours[date] || {}).faits || {};
      for (const e of fil(date)) {
        if (!compteDansForfait(e) || !faits[cleEtape(e)]) continue;
        const cleR = date + "|" + cleEtape(e) + "|" + famillesDeLEtape(e, tousEtAjouts).map((id) => lireForfait((familleDe(id) || {}).forfaitJour)).join(",");
        if (rattrapes.current.has(cleR)) continue;
        rattrapes.current.add(cleR);
        assurerForfaits(date, e).catch(() => rattrapes.current.delete(cleR));
      }
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // Course pour un compte (gg...) : le prix est note quand elle est faite, et ce qu'il a paye (facultatif)
  const compteDe = (e) => (e && e.genre === "tache" && e.tache && e.tache.compte ? comptes.comptes.find((c) => c.id === e.tache.compte) || null : null);
  const courseFaite = async (date, e, { prix, paye = 0, moyen = TARIFS.moyensPaiement[0] }) => {
    const c = compteDe(e);
    const d = c && courseDuCompte(c, { date, heure: e.tache.debut, titre: e.tache.titre, prix, de: e.tache.lieu, a: e.tache.livraison });
    if (!d) throw new Error("prix");
    await setDoc(doc(db, "demandes", "tache-" + e.tache.id), { ...d, creeLe: serverTimestamp(), majLe: serverTimestamp() });
    if (Number(paye) > 0) await enregistrerComptes(ajouterLigne(comptes.comptes, c.id, { type: "paye", date, montant: Number(paye), moyen, libelle: e.tache.titre }));
    const heure = new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
    await sauver(validerEtape(jours, date, cleEtape(e), heure));
    return `${d.prixFinal} ₪ notés pour ${c.nom}${Number(paye) > 0 ? `, ${Number(paye)} ₪ encaissés` : ", à encaisser"} : c'est dans Finances et dans son compte.`;
  };
  const annuler = async (date, e) => {
    const cle = cleEtape(e);
    if (!cle) return "";
    const suite = annulerEtape(jours, date, cle);
    await sauver(suite);
    if (compteDe(e)) {
      const ref = doc(db, "demandes", "tache-" + e.tache.id);
      if ((await getDoc(ref)).exists()) {
        const payes = await getDocs(query(collection(db, "mouvements"), where("resId", "==", ref.id)));
        if (!payes.empty) return "Un paiement est déjà placé sur cette course : elle reste dans Finances (corrige dans Comptes entre nous si besoin).";
        await deleteDoc(ref);
        return "Course retirée de Finances.";
      }
    }
    const faits = ((suite[date] || {}).faits) || {};
    const etapes = fil(date);
    const notes = [];
    for (const id of compteDansForfait(e) ? famillesDeLEtape(e, tousEtAjouts) : []) {
      if (familleEncoreFaite(id, etapes, faits, tousEtAjouts, cleEtape)) continue;
      const ref = doc(db, "demandes", idForfait(id, date));
      if (!(await getDoc(ref)).exists()) continue;
      const payes = await getDocs(query(collection(db, "mouvements"), where("resId", "==", ref.id)));
      if (!payes.empty) {
        notes.push("Un paiement est déjà enregistré pour cette journée : elle reste dans Finances.");
        continue;
      }
      await deleteDoc(ref);
      notes.push(`Journée de ${(familleDe(id) || {}).nom || "la famille"} retirée de Finances.`);
    }
    return notes.join(" ");
  };
  return {
    etat,
    fil,
    domicile: d.domicile, // 17 nov. 2026 : trafic de ce matin (depart de la maison)
    retires,
    heureChangee,
    faitA: (date, e) => faitA(jours, date, cleEtape(e)),
    valider,
    annuler,
    compteDe,
    courseFaite,
    comptes: comptes.comptes,
    modifie: (date) => !!(jours[date] && ((jours[date].retires || []).length || Object.keys(jours[date].heures || {}).length)),
    // Un ramassage ponctuel (ajoute pour ce jour) s'efface ; un trajet de la tournee est seulement retire ce jour-la
    retirer: (date, ids) => {
      let suite = retirerAjout(jours, date, ids.filter(estPonctuel));
      const autres = ids.filter((x) => !estPonctuel(x));
      if (autres.length) suite = retirerCeJour(suite, date, autres);
      return sauver(suite);
    },
    // infos = un trajet, ou une liste (deposer puis recuperer : les deux sont enregistres ensemble)
    ajouterRamassage: (date, infos) => {
      const liste = (Array.isArray(infos) ? infos : [infos]).map((x) => trajetPonctuel({ date, ...x }));
      if (!liste.length || liste.some((r) => !r)) return Promise.reject(new Error("incomplet"));
      return sauver(ajouterTrajetCeJour(jours, date, liste));
    },
    remettre: (date, ids) => sauver(remettreCeJour(jours, date, ids)),
    // 19 nov. 2026 (Rebecca : Shyrel sort plus tot) : les trajets d'une etape, pour choisir l'enfant concerne
    heureDuJour: (date, id) => (((jours[date] || {}).heures || {})[id]) || "",
    trajetsDe: (ids) => (ids || []).map((id) => tousEtAjouts.find((r) => r.id === id)).filter(Boolean),
    // « Sort plus tôt → je la ramène à la maison » : ce jour-la, l'enfant quitte son trajet habituel et un trajet
    // ecole -> maison est cree a la nouvelle heure. Le reste de la journee se recalcule tout seul.
    ramenerMaison: (date, id, heure) => {
      const r = tousEtAjouts.find((x) => x.id === id);
      // 19 nov. 2026, 14h10 : si l'enfant m'attend d'habitude ailleurs (chez Alexia), ce jour-la je la prends A L'ECOLE
      const de = r && r.ecole && r.ecole.label ? r.ecole : r && r.de;
      const nom = String((r && r.nom) || "").replace(/, m'attend ailleurs\)/, ")");
      const p = r ? trajetPonctuel({ date, sens: "recuperer", heure, de, a: d.domicile, nom, famille: r.famille || "" }) : null;
      if (!p) return Promise.reject(new Error("incomplet"));
      const suite = estPonctuel(id) ? retirerAjout(jours, date, [id]) : retirerCeJour(jours, date, [id]);
      return sauver(ajouterTrajetCeJour(suite, date, [p]));
    },
    // 25 nov. 2026 : depuis le Calendrier, confier des trajets de CE jour a Jeremy (ou un autre coequipier)
    confier: (date, ids, membre) => confierAuCoequipier({ donnees: d, tous, ids, date, duree: durees.duree, nomLieu, membre, jours }),
    confierTache: (date, tache, membre) => confierTache({ jours, date, tache, membre, nomLieu }),
    // Trajets et taches confies ce jour-la (pour « Je le reprends ») ; id = id de la mission du coequipier
    confies: (date) => [...(d.transferts || []).filter((x) => x.date === date), ...tachesConfiees(jours, date).map((x) => ({ id: x.mission, membre: x.membre }))],
    reprendre: (id) => {
      const x = (d.transferts || []).find((y) => y.id === id);
      if (x) return reprendreDuCoequipier({ donnees: d, transfert: x });
      for (const date of Object.keys(jours)) {
        const t = tachesConfiees(jours, date).find((y) => y.mission === id);
        if (t) return reprendreTache({ jours, date, tache: t.tache, mission: t.mission, membre: t.membre });
      }
      return Promise.resolve();
    },
    // 19 nov. 2026, 14h10 : « avec ou sans Shyrel » dans la voiture (enfants de ma fiche « Moi » du Repertoire)
    enfantsMoi: [...new Set(repertoire.familles.filter((f) => f.categorie === "moi").flatMap((f) => (f.enfants || []).map((e) => String(e.prenom || "").trim())).filter(Boolean))],
    avecMoi: (date, cle) => avecMoiDe(jours, date, cle),
    changerAvecMoi: (date, cle, prenoms) => sauver(changerAvecMoi(jours, date, cle, prenoms)),
    changerHeure: (date, ids, heure) => sauver(changerHeureCeJour(jours, date, ids, heure)),
    normale: (date) => sauver(journeeNormale(jours, date)),
    ajouterTache: (date, tache) => sauver(ajouterTache(jours, date, tache)),
    retirerTache: (date, id) => sauver(retirerTache(jours, date, id)),
    modifierTache: (date, id, tache) => sauver(modifierTache(jours, date, id, tache)),
  };
}
