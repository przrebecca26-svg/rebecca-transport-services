// CRÉNEAUX RÉSERVÉS DES RESTAURANTS (formule B) - 20 nov. 2026, décision de Rebecca - règles pures
// Un créneau dure 2 heures au moins. Minimum facturé : 75 ₪ par heure (réglable) -> 2 h = 150 ₪, 3 h = 225 ₪...
// Les livraisons faites pendant le créneau comptent dans ce minimum à leur vrai prix ; on ne facture que la
// différence, jamais minimum + livraisons. Créneau annulé au moins 24 h avant : rien n'est dû (Rebecca ne facture pas).
export const MIN_HEURES = 2;
export const PAR_HEURE_DEFAUT = 75;
const cents = (x) => Math.round(x * 100) / 100;

const JOURS = [
  ["dimanche", "dim"], ["lundi", "lun"], ["mardi", "mar"], ["mercredi", "mer"], ["jeudi", "jeu"], ["vendredi", "ven"], ["samedi", "sam"],
];
export const NOMS_JOURS = JOURS.map((j) => j[0]);
const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const indexJour = (mot) => JOURS.findIndex(([long, court]) => mot === long || mot === court || mot.startsWith(court));

// « 18h », « 18h30 », « 18:30 », « 18 » -> « 18:30 »
const heureNette = (h, m) => {
  const hh = Number(h);
  const mm = Number(m || 0);
  if (!(hh >= 0 && hh <= 24 && mm >= 0 && mm < 60)) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const enMinutes = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

// Lit le texte des créneaux : « jeudi 18h-21h, dim-jeu 19h30-21h30 » -> [{ texte, jours: [4], debut, fin, heures }]
export function lireCreneaux(texte) {
  return String(texte || "")
    .split(/[,;\n]|\bet\b/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((morceau) => {
      const s = sansAccent(morceau);
      const plage = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|–|à|a|jusqu'?a)\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/.exec(s);
      const debut = plage ? heureNette(plage[1], plage[2]) : null;
      const fin = plage ? heureNette(plage[3], plage[4]) : null;
      let jours = [];
      if (/tous les jours|chaque jour/.test(s)) jours = [0, 1, 2, 3, 4, 5];
      const inter = /\b([a-z]{3,9})\s*(?:-|–|au|a)\s*([a-z]{3,9})\b/.exec(s.replace(/\d.*$/, ""));
      if (!jours.length && inter && indexJour(inter[1]) >= 0 && indexJour(inter[2]) >= 0) {
        for (let i = indexJour(inter[1]); ; i = (i + 1) % 7) {
          jours.push(i);
          if (i === indexJour(inter[2]) || jours.length > 7) break;
        }
      }
      if (!jours.length) for (const mot of s.split(/[^a-z]+/)) if (mot.length >= 3 && indexJour(mot) >= 0 && !jours.includes(indexJour(mot))) jours.push(indexJour(mot));
      const heures = debut && fin && enMinutes(fin) > enMinutes(debut) ? cents((enMinutes(fin) - enMinutes(debut)) / 60) : 0;
      return { texte: morceau, jours: jours.sort((a, b) => a - b), debut, fin, heures };
    });
}

// 20 nov. 2026 (Rebecca) : une commande prête à cette heure, ce jour-là, tombe-t-elle dans un créneau réservé ?
// (formule B ou A + B : dans un créneau -> prix B ; en dehors -> prix A). Début inclus, fin exclue.
export function dansCreneau(texte, jour, heure) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour || "") || !/^\d{2}:\d{2}$/.test(heure || "")) return false;
  const j = new Date(jour + "T12:00:00Z").getUTCDay();
  const m = enMinutes(heure);
  return lireCreneaux(texte).some((x) => x.debut && x.fin && x.jours.includes(j) && m >= enMinutes(x.debut) && m < enMinutes(x.fin));
}

// 20 nov. 2026 (Rebecca) : choisir les créneaux et les horaires avec des listes déroulantes (jour de… à…, de telle
// heure à telle heure). Les lignes deviennent le même texte qu'avant (« jeudi 19h-21h, dim-jeu 19h30-22h »).
export const HEURES_LISTE = Array.from({ length: 37 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 06:00 -> 24:00
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
const heureTexte = (hm) => `${Number(hm.slice(0, 2))}h${hm.slice(3, 5) === "00" ? "" : hm.slice(3, 5)}`;
export function texteLigne(l) {
  if (!l || !(l.de >= 0 && l.de <= 6) || !(l.a >= 0 && l.a <= 6) || !l.debut || !l.fin) return "";
  const jours = l.de === l.a ? NOMS_JOURS[l.de] : `${JOURS[l.de][1]}-${JOURS[l.a][1]}`;
  return `${jours} ${heureTexte(l.debut)}-${heureTexte(l.fin)}`;
}
export const texteDepuisLignes = (lignes = []) => lignes.map(texteLigne).filter(Boolean).join(", ");
// Le texte déjà enregistré -> des lignes (jours consécutifs : de… à…)
export function lignesDepuisTexte(texte) {
  return lireCreneaux(texte)
    .filter((x) => x.jours.length && x.debut && x.fin)
    .map((x) => {
      const j = x.jours;
      // suite de jours qui peut passer par samedi -> dimanche (ex. ven-dim)
      let de = j[0];
      for (let i = 1; i < j.length; i++) if (j[i] !== j[i - 1] + 1) { de = j[i]; break; }
      const a = (de + j.length - 1) % 7;
      return { de, a, debut: x.debut, fin: x.fin };
    });
}
// Erreur d'une ligne ("" = bonne) ; minHeures : 2 pour un créneau B, 0 pour des horaires d'ouverture
export function erreurLigne(l, minHeures = MIN_HEURES) {
  if (!l.debut || !l.fin) return "Choisissez l'heure de début et de fin.";
  const d = enMinutes(l.fin) - enMinutes(l.debut);
  if (d <= 0) return "L'heure de fin doit être après l'heure de début.";
  if (minHeures && d < minHeures * 60) return `Un créneau dure ${MIN_HEURES} heures au moins.`;
  return "";
}

// Minimum facturé pour un créneau de cette durée (2 h au moins)
export const minimumCreneau = (heures, parHeure = PAR_HEURE_DEFAUT) => cents(Math.max(MIN_HEURES, Number(heures) || 0) * (Number(parHeure) || 0));

// Ce qui ne va pas dans le texte des créneaux ([] = bon)
export function erreursCreneaux(texte) {
  const c = lireCreneaux(texte);
  if (!c.length) return ["Indiquez vos créneaux réservés : le jour et les heures de début et de fin (ex. jeudi 18h-21h)."];
  const e = [];
  for (const x of c) {
    if (!x.debut || !x.fin || !x.heures) e.push(`« ${x.texte} » : indiquez l'heure de début et l'heure de fin (ex. 18h-21h).`);
    else if (!x.jours.length) e.push(`« ${x.texte} » : indiquez le jour (ex. jeudi).`);
    else if (x.heures < MIN_HEURES) e.push(`« ${x.texte} » : un créneau dure ${MIN_HEURES} heures au moins.`);
  }
  return e;
}

// Tableau pour la page et le contrat : durée -> minimum
export const tableauMinimums = (parHeure = PAR_HEURE_DEFAUT, jusqua3 = 30) =>
  [2, 3, 4, 5].map((h) => {
    const minimum = minimumCreneau(h, parHeure);
    const nb = jusqua3 > 0 ? Math.floor(minimum / jusqua3) + 1 : 0;
    return { heures: h, minimum, livraisons: jusqua3 > 0 ? cents(minimum / jusqua3) : 0, auDela: nb, auDelaMontant: cents(nb * jusqua3) };
  });

const plusJours = (jour, n) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const cleOccurrence = (date, debut) => `${date}|${debut}`;

// Les créneaux d'une semaine et leur minimum.
// livraisons : demandes du restaurant (on compte les vraies livraisons terminées, pas les compléments déjà facturés)
// -> [{ cle, date, debut, fin, heures, minimum, nb, livre, complement, facture }]
export function minimumsSemaine(texte, livraisons = [], semaine, parHeure = PAR_HEURE_DEFAUT) {
  if (!semaine) return [];
  const creneaux = lireCreneaux(texte).filter((x) => x.debut && x.fin && x.heures && x.jours.length);
  const factures = new Set(livraisons.filter((d) => d && d.details && d.details.minimumCreneau).map((d) => d.details.minimumCreneau));
  const vraies = livraisons.filter((d) => d && d.statut === "terminee" && !(d.details && d.details.minimumCreneau));
  const res = [];
  for (let i = 0; i < 7; i++) {
    const date = plusJours(semaine.debut, i);
    const jour = new Date(date + "T12:00:00Z").getUTCDay();
    // 20 nov. 2026 (décision de Rebecca) : créneaux du même jour qui se touchent ou se chevauchent = un seul créneau
    const duJour = creneaux.filter((x) => x.jours.includes(jour)).map((x) => ({ debut: x.debut, fin: x.fin })).sort((a, b) => enMinutes(a.debut) - enMinutes(b.debut));
    const joints = [];
    for (const x of duJour) {
      const der = joints[joints.length - 1];
      if (der && enMinutes(x.debut) <= enMinutes(der.fin)) { if (enMinutes(x.fin) > enMinutes(der.fin)) der.fin = x.fin; }
      else joints.push({ ...x });
    }
    for (const x of joints.map((j) => ({ ...j, heures: cents((enMinutes(j.fin) - enMinutes(j.debut)) / 60) }))) {
      const dedans = vraies.filter((d) => d.date === date && /^\d{2}:\d{2}$/.test(d.heure || "") && enMinutes(d.heure) >= enMinutes(x.debut) && enMinutes(d.heure) < enMinutes(x.fin));
      const livre = cents(dedans.reduce((s, d) => s + (Number(d.prixFinal) || Number(d.prixEstime) || 0), 0));
      const minimum = minimumCreneau(x.heures, parHeure);
      const cle = cleOccurrence(date, x.debut);
      res.push({ cle, date, debut: x.debut, fin: x.fin, heures: x.heures, minimum, nb: dedans.length, livre, complement: cents(Math.max(0, minimum - livre)), facture: factures.has(cle) });
    }
  }
  return res.sort((a, b) => a.cle.localeCompare(b.cle));
}

// 20 nov. 2026 : le complement du minimum d'un creneau B devient une course « ajoutee a la main », terminee,
// rattachee a la fiche du restaurant (details.famille) : elle arrive toute seule dans le releve et dans le message.
// null si rien a facturer ou deja facture.
export function demandeComplement(fiche, occ, moyen) {
  const tel = String((fiche && (fiche.telephone || (fiche.membres && fiche.membres[0] && fiche.membres[0].telephone))) || "").trim();
  if (!fiche || !occ || occ.facture || !(occ.complement > 0) || tel.length < 3) return null;
  const jjmm = `${occ.date.slice(8, 10)}/${occ.date.slice(5, 7)}`;
  const h = (x) => x.replace(":", "h");
  return {
    service: "livraison",
    serviceTitre: "Livraison",
    date: occ.date,
    heure: occ.debut,
    nom: String(fiche.nom || "Restaurant").trim().slice(0, 100) || "Restaurant",
    telephone: tel.slice(0, 30),
    moyenPaiement: String(moyen || "Espèces").slice(0, 40),
    prixEstime: null,
    prixFinal: occ.complement,
    surDevis: false,
    kmEstime: null,
    minutesEstimees: null,
    details: { minimumCreneau: occ.cle, commandeResto: "minimum", famille: String(fiche.id || "").slice(0, 40) },
    message: `Complément du minimum garanti · créneau du ${jjmm} ${h(occ.debut)}-${h(occ.fin)} (${occ.heures} h, minimum ${occ.minimum} ₪, livré ${occ.livre} ₪) · ${occ.complement} ₪`,
    statut: "terminee",
    source: "manuel",
  };
}
