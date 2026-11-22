// TOURNEE RESTAURANT GROUPEE (22 nov. 2026, Rebecca) - regles pures (aucun acces internet ni base de donnees)
// « Je dois récupérer les deux commandes au même endroit à 10 minutes d'intervalle et livrer à deux adresses
// différentes sur le même trajet. À chaque fois je suis obligée de marquer arrivée, partie… Si je suis arrivée au
// resto, je suis arrivée pour les deux commandes ; je pars avec les deux. Ensuite ça doit me mettre la première qui
// est sur la route, pas me faire faire un détour ; celle qui est le plus près de chez moi, je termine par celle-là. »
// Regles :
//  - meme restaurant, meme jour, meme personne, pretes a 10 min au plus l'une de l'autre (a la suite) = une tournee ;
//  - 7 commandes au plus (contrat : 4 en principe, jusqu'a 7 sur le meme trajet) ;
//  - Partie / Arrivee au restaurant / Recuperees : UNE fois pour toutes les commandes de la tournee ;
//  - ordre des livraisons : le moins de km du restaurant jusqu'a la maison (on finit par la plus proche de chez moi) ;
//  - distances a vol d'oiseau x 1,3 (aucun cout Google), comme les courses groupees.
import { kmEntre, MIN_PAR_KM } from "./coursesGroupees.js";
import { chronoDe, faitDe } from "./finCourse.js";
import { attribueA } from "./equipe.js";

export const ECART_TOURNEE_MIN = 10;
export const MAX_TOURNEE = 7;

const ok = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
const enMin = (h) => {
  const m = /^(\d{1,2})[:h](\d{2})/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const enHeure = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
export const estCommandeResto = (d) => !!(d && d.details && d.details.commandeResto && d.details.commandeResto.cle);
const groupable = (d) => estCommandeResto(d) && !d.estRetour && (d.statut === "acceptee" || d.statut === "terminee") && enMin(d.heure) != null;

// Coupe les courses d'une journee : { tournees: [[d, d…]], seules: [d…] } (une tournee = au moins 2 commandes)
export function tourneesResto(demandes = [], ecart = ECART_TOURNEE_MIN, max = MAX_TOURNEE) {
  const parCle = new Map();
  const seules = [];
  for (const d of demandes) {
    if (!groupable(d)) {
      seules.push(d);
      continue;
    }
    const k = [d.date, d.details.commandeResto.cle, attribueA(d)].join("#");
    if (!parCle.has(k)) parCle.set(k, []);
    parCle.get(k).push(d);
  }
  const tournees = [];
  for (const liste of parCle.values()) {
    liste.sort((a, b) => enMin(a.heure) - enMin(b.heure) || String(a.id).localeCompare(String(b.id)));
    let courant = [];
    for (const d of liste) {
      const dernier = courant[courant.length - 1];
      if (dernier && enMin(d.heure) - enMin(dernier.heure) <= ecart && courant.length < max) courant.push(d);
      else {
        if (courant.length) tournees.push(courant);
        courant = [d];
      }
    }
    if (courant.length) tournees.push(courant);
  }
  return {
    tournees: tournees.filter((t) => t.length >= 2),
    seules: [...seules, ...tournees.filter((t) => t.length < 2).flat()],
  };
}

const lieuLivraison = (d) => (d.details || {}).livraison;
const lieuResto = (t) => (t[0].details || {}).recuperation;

// Ordre des livraisons : le moins de km restaurant -> livraisons -> maison (si la maison est connue)
export function ordreLivraisons(tournee = [], domicile = null) {
  const depart = tournee.length ? lieuResto(tournee) : null;
  if (tournee.length < 2 || !ok(depart) || tournee.some((d) => !ok(lieuLivraison(d)))) {
    return [...tournee].sort((a, b) => enMin(a.heure) - enMin(b.heure));
  }
  let meilleur = null;
  let best = Infinity;
  const essayer = (faits, reste, km, p) => {
    if (km >= best) return;
    if (!reste.length) {
      const total = km + (ok(domicile) ? kmEntre(p, domicile) : 0);
      if (total < best) {
        best = total;
        meilleur = faits;
      }
      return;
    }
    for (const d of reste) essayer([...faits, d], reste.filter((x) => x !== d), km + kmEntre(p, lieuLivraison(d)), lieuLivraison(d));
  };
  essayer([], tournee, 0, depart);
  return meilleur || [...tournee];
}

// Ou en est la tournee (etapes communes) : depart, arrivee, prise = cochees pour TOUTES les commandes
export function etatTournee(tournee = []) {
  const ch = tournee.map(chronoDe);
  const fait = (i) => !!faitDe(tournee[i]);
  const chacune = (test) => ch.length > 0 && ch.every((c, i) => test(c) || fait(i));
  const deposees = tournee.filter((d, i) => ch[i].depose || fait(i));
  return {
    partie: chacune((c) => c.depart || c.arrivee || c.prise || c.depose),
    arrivee: chacune((c) => c.arrivee || c.prise || c.depose),
    prise: chacune((c) => c.prise || c.depose),
    deposees: deposees.map((d) => d.id),
    toutesDeposees: deposees.length === tournee.length,
    rentree: ch.length > 0 && ch.every((c) => c.maison),
  };
}

// Quelle etape annuler (« Annuler la derniere etape ») : { ids, etape } ou null
export function derniereEtapeTournee(tournee = []) {
  const e = etatTournee(tournee);
  if (e.rentree) return { ids: tournee.map((d) => d.id), etape: "maison" };
  const deposees = tournee.filter((d) => chronoDe(d).depose);
  if (deposees.length) {
    const derniere = [...deposees].sort((a, b) => String(chronoDe(b).depose).localeCompare(String(chronoDe(a).depose)))[0];
    return { ids: [derniere.id], etape: "depose" };
  }
  for (const k of ["prise", "arrivee", "depart"]) {
    const ids = tournee.filter((d) => chronoDe(d)[k]).map((d) => d.id);
    if (ids.length) return { ids, etape: k };
  }
  return null;
}

// Etapes pour le trafic et « Prochaine » : une recuperation au restaurant (a l'heure de la derniere commande prete),
// puis les livraisons dans l'ordre, l'une apres l'autre. Meme forme que etapesCourses (traficMatin.js).
export function etapesTournee(tournee = [], domicile = null) {
  const actives = tournee.filter((d) => d.statut === "acceptee");
  if (!actives.length) return [];
  const resto = lieuResto(tournee);
  const ordre = ordreLivraisons(tournee, domicile).filter((d) => actives.includes(d));
  const e = etatTournee(tournee);
  const pret = Math.max(...tournee.map((d) => enMin(d.heure)));
  const premier = actives[0];
  const sortie = [];
  const nomResto = premier.nom || "restaurant";
  const plus = (d) => ({ demandeId: d.id, tel: (d.details || {}).telDestinataire || "", nom: (d.details || {}).destinataire || "", partie: e.partie });
  if (ok(resto)) sortie.push({ min: pret, genre: "arret", adresse: resto, lieu: nomResto, texte: `Récupérer ${tournee.length} commandes (${nomResto})`, cle: "c:" + premier.id + ":prise", fait: e.prise, sorte: "prise", ...plus(premier) });
  let t = pret;
  let p = ok(resto) ? resto : null;
  for (const d of ordre) {
    const vers = lieuLivraison(d);
    if (!ok(vers)) continue;
    t += p ? Math.max(3, Math.round(kmEntre(p, vers) * MIN_PAR_KM)) : 5;
    p = vers;
    const qui = (d.details || {}).destinataire ? ` (${d.details.destinataire})` : "";
    sortie.push({ min: t, genre: "arret", adresse: vers, lieu: String(vers.label || "").split(",")[0], texte: `Livrer${qui}`, cle: "c:" + d.id + ":depose", fait: !!chronoDe(d).depose, sorte: "depose", ...plus(d) });
    t += 2; // remise de la commande
  }
  return sortie;
}

export const heureTexte = enHeure;
