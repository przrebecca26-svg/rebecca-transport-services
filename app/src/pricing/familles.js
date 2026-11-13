// FAMILLES ET ENFANTS - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// 12 nov. 2026, demande de Rebecca : remplir UNE fois, dans le Repertoire, la fiche de chaque enfant
// (ecole, adresse, jours, heure d'arrivee et de sortie, activites) ; la tournee scolaire se construit toute seule.
// - une famille = un parent (Rebecca elle-meme, une amie, une cliente ajoutee a la main) : nom, telephone, domicile,
//   et ses adresses favorites (travail, grands-parents...) ;
// - un enfant = prenom + ses rendez-vous reguliers : l'ecole, et autant d'activites que necessaire (basket...) ;
// - un rendez-vous = lieu, jours, heure d'arrivee, heure de sortie (heure differente possible chaque jour),
//   « je le depose » / « je le recupere », ou je le ramene, et s'il m'attend ailleurs (chez une amie) ;
// - de ces fiches sortent les trajets de la tournee (meme forme que les trajets saisis a la main).
// Prive : enregistre dans le document du repertoire (Rebecca et son equipe), jamais dans le programme.

import { JOURS, trajetVide } from "./tournee.js";
import { ecoleDe, heureDuJour, finDuMois } from "./ramassagePlanning.js";
import { ajouterJours } from "./calendrier.js";
import { lireForfait } from "./forfaitJour.js";

const HEURE_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const heure = (x) => (HEURE_OK.test(x || "") ? x : "");
const date = (x) => (DATE_OK.test(x || "") ? x : "");
const aCoord = (a) => !!a && typeof a.lat === "number" && typeof a.lon === "number";
const adresseLue = (x) => (x && typeof x === "object" && typeof x.label === "string" && x.label.trim() ? { label: x.label.slice(0, 300), ...(aCoord(x) ? { lat: x.lat, lon: x.lon } : {}), ...(x.approx === true ? { approx: true } : {}) } : null);

let compteur = 0;
export const nouvelIdFiche = () => `f${Date.now().toString(36)}${(compteur++).toString(36)}`;

export const rdvVide = (type = "ecole") => ({
  id: nouvelIdFiche(),
  type, // "ecole" ou "activite"
  nom: type === "ecole" ? "École" : "",
  lieu: null,
  depose: true, // je l'y emmene
  recupere: true, // je vais le chercher
  heurePrise: "", // facultatif : je le prends a la maison a partir de
  heureArrivee: "", // il doit y etre au plus tard a (heure habituelle)
  heureSortie: "", // il finit a (heure habituelle)
  jours: JOURS.map((_, w) => ({ actif: type === "ecole" ? w < 5 : false, arrivee: "", sortie: "" })),
  retour: null, // ou je le ramene (vide = son domicile)
  priseAilleurs: null, // il m'attend ailleurs qu'a l'ecole (chez une amie...) ; vide = sur place
  joursAilleurs: JOURS.map(() => true), // les jours ou il m'attend la-bas (les autres jours : je le prends sur place)
  attend: false, // il peut m'attendre sans limite
});
// Age du jour : exact avec la date de naissance ; sinon l'age donne + les annees passees depuis. null = inconnu.
export function ageDe(e, aujourdhui = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" })) {
  if (e && /^\d{4}-\d{2}-\d{2}$/.test(e.naissance || "")) {
    let a = Number(aujourdhui.slice(0, 4)) - Number(e.naissance.slice(0, 4));
    if (aujourdhui.slice(5) < e.naissance.slice(5)) a--;
    return Math.max(0, a);
  }
  if (e && e.ageAnnees > 0) return e.ageAnnees + Math.max(0, Number(aujourdhui.slice(0, 4)) - (e.ageNote || Number(aujourdhui.slice(0, 4))));
  return null;
}
export const texteAge = (e) => {
  const a = ageDe(e);
  return a == null ? "" : `${a} an${a > 1 ? "s" : ""}`;
};
// Enfant sans planning (pas de trajet regulier, ex. emmene de temps en temps a une activite)
export const enfantSansPlanning = () => ({ id: nouvelIdFiche(), prenom: "", age: "enfant", naissance: "", ageAnnees: 0, ageNote: 0, rdv: [] });

// age : "enfant" (mineur) ou "adulte" (18 ans et plus) - 12 nov. 2026, 22h52 : une case sur chaque fiche
export const enfantFicheVide = () => ({ id: nouvelIdFiche(), prenom: "", age: "enfant", naissance: "", ageAnnees: 0, ageNote: 0, rdv: [rdvVide("ecole")] });
// nom2 / telephone2 : l'autre parent (facultatif)
// forfaitJour : prix a la journee de cette famille (ex. Alexia 70 ₪), 0 = pas de forfait (13 nov. 2026)
export const familleVide = () => ({ id: nouvelIdFiche(), nom: "", telephone: "", nom2: "", telephone2: "", domicile: null, adresses: [], du: "", au: "", forfaitJour: 0, categorie: "clientes", membres: [], enfants: [enfantFicheVide()] });

// Nettoie ce qui vient de la base
export function lireFamilles(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((f) => f && typeof f === "object")
    .slice(0, 80)
    .map((f) => ({
      id: String(f.id || nouvelIdFiche()).slice(0, 40),
      nom: String(f.nom || "").slice(0, 60),
      telephone: String(f.telephone || "").slice(0, 20),
      nom2: String(f.nom2 || "").slice(0, 60),
      telephone2: String(f.telephone2 || "").slice(0, 20),
      domicile: adresseLue(f.domicile),
      adresses: (Array.isArray(f.adresses) ? f.adresses : [])
        .map((a) => ({ nom: String((a && a.nom) || "").slice(0, 40), adresse: adresseLue(a && a.adresse) }))
        .filter((a) => a.adresse)
        .slice(0, 20),
      du: date(f.du),
      au: date(f.au),
      forfaitJour: lireForfait(f.forfaitJour),
      // 13 nov. 2026 : categorie du Repertoire (moi, famille et amis, clientes) et autres membres (mari, mere, niece...)
      categorie: ["moi", "proches", "clientes"].includes(f.categorie) ? f.categorie : /\bmoi\b/i.test(String(f.nom || "")) ? "moi" : "clientes",
      membres: (Array.isArray(f.membres) ? f.membres : [])
        .filter((m) => m && typeof m === "object" && String(m.nom || "").trim())
        .slice(0, 20)
        .map((m) => ({ id: String(m.id || nouvelIdFiche()).slice(0, 40), nom: String(m.nom).slice(0, 60), lien: String(m.lien || "").slice(0, 30), telephone: String(m.telephone || "").slice(0, 20), age: m.age === "enfant" ? "enfant" : "adulte" })),
      enfants: (Array.isArray(f.enfants) ? f.enfants : [])
        .filter((e) => e && typeof e === "object")
        .slice(0, 8)
        .map((e) => ({
          id: String(e.id || nouvelIdFiche()).slice(0, 40),
          prenom: String(e.prenom || "").slice(0, 40),
          age: e.age === "adulte" ? "adulte" : "enfant",
          // 13 nov. 2026 : date de naissance si je l'ai, sinon l'age (note l'annee ou je l'ai donne : il monte tout seul)
          naissance: date(e.naissance),
          ageAnnees: Number.isFinite(Number(e.ageAnnees)) && Number(e.ageAnnees) > 0 && Number(e.ageAnnees) < 120 ? Math.round(Number(e.ageAnnees)) : 0,
          ageNote: Number.isFinite(Number(e.ageNote)) && Number(e.ageNote) > 2000 ? Math.round(Number(e.ageNote)) : 0,
          rdv: (Array.isArray(e.rdv) ? e.rdv : [])
            .filter((r) => r && typeof r === "object")
            .slice(0, 8)
            .map((r) => ({
              id: String(r.id || nouvelIdFiche()).slice(0, 40),
              type: r.type === "activite" ? "activite" : "ecole",
              nom: String(r.nom || "").slice(0, 40),
              lieu: adresseLue(r.lieu),
              depose: r.depose !== false,
              recupere: r.recupere !== false,
              heurePrise: heure(r.heurePrise),
              heureArrivee: heure(r.heureArrivee),
              heureSortie: heure(r.heureSortie),
              jours: JOURS.map((_, w) => ({ actif: !!(r.jours && r.jours[w] && r.jours[w].actif), arrivee: heure(r.jours && r.jours[w] && r.jours[w].arrivee), sortie: heure(r.jours && r.jours[w] && r.jours[w].sortie) })),
              retour: adresseLue(r.retour),
              priseAilleurs: adresseLue(r.priseAilleurs),
              joursAilleurs: JOURS.map((_, w) => !Array.isArray(r.joursAilleurs) || r.joursAilleurs[w] !== false),
              attend: r.attend === true,
            })),
        })),
    }));
}

/* ---------- Depuis le Calendrier : « + Ajouter une tache » de type Ramassage scolaire (12 nov. 2026, 22h52) ---------- */

// Tous les enfants des fiches, pour les choisir en un clic : { famille, enfant, prenom, parent, ecole, sortie }
export function listeEnfants(familles) {
  const liste = [];
  for (const f of familles || []) {
    for (const e of f.enfants || []) {
      const ecole = (e.rdv || []).find((r) => r.type === "ecole") || null;
      liste.push({ famille: f.id, enfant: e.id, prenom: String(e.prenom || "").trim() || "Enfant", parent: String(f.nom || "").trim(), age: e.age === "adulte" ? "adulte" : "enfant", ecole: ecole ? ecole.lieu : null, entree: ecole ? ecole.heureArrivee : "", sortie: ecole ? ecole.heureSortie : "" });
    }
  }
  return liste.sort((a, b) => a.prenom.localeCompare(b.prenom, "fr"));
}

// Ramassage ponctuel d'un enfant du Repertoire pour UNE date (13 nov. 2026) : heure et adresses tirees de sa fiche.
// sens "recuperer" : heure de sortie de l'ecole ce jour-la, de l'ecole (ou la ou il m'attend) vers chez lui ;
// sens "deposer" : heure d'arrivee a l'ecole ce jour-la, de chez lui vers l'ecole. Tout reste modifiable.
export function preRemplirRamassage(familles, ref, date, sens = "recuperer") {
  const f = (familles || []).find((x) => x.id === (ref && ref.famille));
  const e = f && f.enfants.find((x) => x.id === ref.enfant);
  if (!f || !e) return null;
  const r = (e.rdv || []).find((x) => x.type === "ecole") || (e.rdv || [])[0] || null;
  const w = new Date(`${date}T12:00:00Z`).getUTCDay();
  const prenom = String(e.prenom || "").trim() || "Enfant";
  if (!r) return { heure: "", de: sens === "deposer" ? f.domicile : null, a: sens === "deposer" ? null : f.domicile, nom: prenom, famille: f.id };
  if (sens === "deposer") return { heure: arriveeDuJour(r, w), de: f.domicile, a: r.lieu, nom: `${prenom} · ${nomRdv(r)} (aller)`, famille: f.id };
  const ailleurs = r.priseAilleurs && r.joursAilleurs[w] !== false ? r.priseAilleurs : null;
  return { heure: sortieDuJour(r, w), de: ailleurs || r.lieu, a: r.retour || f.domicile, nom: `${prenom} · ${nomRdv(r)} (retour)`, famille: f.id };
}

// Nouvel enfant saisi depuis le Calendrier : il rejoint la famille choisie (famille = id) ou une nouvelle famille.
// n = { famille, parent, telephone, parent2, telephone2, prenom, age, ecole (adresse), entree, sortie, jours: [w...] }
// Renvoie { familles, ref: { famille, enfant } } ; null si le prenom manque (ou le nom du parent pour une nouvelle famille)
export function ajouterEnfantDepuisTache(familles, n) {
  const prenom = String((n && n.prenom) || "").trim().slice(0, 40);
  if (!prenom) return null;
  const existante = (familles || []).find((f) => f.id === n.famille) || null;
  if (!existante && !String(n.parent || "").trim()) return null;
  const ecole = {
    ...rdvVide("ecole"),
    lieu: adresseLue(n.ecole),
    heureArrivee: heure(n.entree),
    heureSortie: heure(n.sortie),
    ...(Array.isArray(n.jours) ? { jours: JOURS.map((_, w) => ({ actif: n.jours.includes(w), arrivee: "", sortie: "" })) } : {}),
  };
  const enfant = { id: nouvelIdFiche(), prenom, age: n.age === "adulte" ? "adulte" : "enfant", rdv: [ecole] };
  if (existante) {
    return { familles: familles.map((f) => (f.id === existante.id ? { ...f, enfants: [...f.enfants, enfant] } : f)), ref: { famille: existante.id, enfant: enfant.id } };
  }
  const f = {
    ...familleVide(),
    nom: String(n.parent).trim().slice(0, 60),
    telephone: String(n.telephone || "").trim().slice(0, 20),
    nom2: String(n.parent2 || "").trim().slice(0, 60),
    telephone2: String(n.telephone2 || "").trim().slice(0, 20),
    enfants: [enfant],
  };
  return { familles: [...(familles || []), f], ref: { famille: f.id, enfant: enfant.id } };
}

export const nomRdv = (r) => String(r.nom || "").trim() || (r.type === "ecole" ? "École" : "Activité");
export const arriveeDuJour = (r, w) => (r.jours[w] && r.jours[w].arrivee) || r.heureArrivee || "";
export const sortieDuJour = (r, w) => (r.jours[w] && r.jours[w].sortie) || r.heureSortie || "";

// Ce qui manque a un rendez-vous pour entrer dans la tournee ("" = complet)
export function manqueRdv(famille, r) {
  if (!r.depose && !r.recupere) return "";
  if (!aCoord(famille.domicile)) return "domicile de la famille à choisir dans la liste";
  if (!aCoord(r.lieu)) return "adresse à choisir dans la liste";
  const actifs = JOURS.map((_, w) => w).filter((w) => r.jours[w].actif);
  if (actifs.length === 0) return "aucun jour coché";
  if (r.depose && !r.heurePrise && actifs.some((w) => !arriveeDuJour(r, w))) return "heure d'arrivée manquante";
  if (r.recupere && actifs.some((w) => !sortieDuJour(r, w))) return "heure de sortie manquante";
  return "";
}

// Les trajets de la tournee qui sortent des fiches (un aller et un retour par rendez-vous, selon les cases cochees)
export function trajetsDesFamilles(familles) {
  const liste = [];
  for (const f of familles) {
    for (const e of f.enfants) {
      const prenom = String(e.prenom || "").trim() || "Enfant";
      for (const r of e.rdv) {
        const base = { places: 1, du: f.du, au: f.au, client: true, fiche: { famille: f.id, enfant: e.id, rdv: r.id } };
        const qui = `${prenom} · ${nomRdv(r)}`;
        if (r.depose) {
          liste.push(trajetVide({ ...base, id: `fiche-${r.id}-aller`, nom: `${qui} (aller)`, type: "matin", de: f.domicile, a: r.lieu, heurePrise: r.heurePrise, heure: r.heureArrivee, jours: r.jours.map((j) => ({ actif: j.actif, heure: j.arrivee })) }));
        }
        if (r.recupere) {
          // Certains jours il m'attend ailleurs (chez une amie) : ces jours-la je le prends la-bas, les autres sur place
          const ailleurs = (w) => !!r.priseAilleurs && (!r.joursAilleurs || r.joursAilleurs[w] !== false);
          const retour = { ...base, type: "sortie", a: r.retour || f.domicile, heure: r.heureSortie };
          const surPlace = r.jours.map((j, w) => ({ actif: j.actif && !ailleurs(w), heure: j.sortie }));
          const laBas = r.jours.map((j, w) => ({ actif: j.actif && ailleurs(w), heure: j.sortie }));
          if (surPlace.some((j) => j.actif) || !laBas.some((j) => j.actif)) liste.push(trajetVide({ ...retour, id: `fiche-${r.id}-retour`, nom: `${qui} (retour)`, de: r.lieu, peutAttendre: r.attend && !r.priseAilleurs, jours: surPlace }));
          if (laBas.some((j) => j.actif)) liste.push(trajetVide({ ...retour, id: `fiche-${r.id}-retour-ailleurs`, nom: `${qui} (retour, m'attend ailleurs)`, de: r.priseAilleurs, peutAttendre: r.attend, jours: laBas }));
        }
      }
    }
  }
  return liste;
}

// Une cliente accepte un devis de ramassage : sa famille et ses enfants deviennent des fiches
export function familleDuDevis(plan, nomCliente = "", telephone = "") {
  const jourUnique = plan.periode === "jour" && DATE_OK.test(plan.date || "") ? new Date(`${plan.date}T12:00:00Z`).getUTCDay() : null;
  const du = DATE_OK.test(plan.date || "") ? plan.date : "";
  const au = !du ? "" : plan.periode === "jour" ? du : plan.periode === "mois" ? finDuMois(du) : ajouterJours(du, 6);
  return {
    ...familleVide(),
    nom: String(nomCliente || "").trim().slice(0, 60) || "Cliente",
    telephone: String(telephone || "").trim().slice(0, 20),
    domicile: plan.domicile,
    du,
    au,
    enfants: plan.enfants.map((e, i) => ({
      id: nouvelIdFiche(),
      prenom: String(e.prenom || "").trim() || `Enfant ${i + 1}`,
      rdv: [{
        ...rdvVide("ecole"),
        lieu: ecoleDe(plan, i),
        depose: e.sens !== "sortie",
        recupere: e.sens !== "matin",
        heurePrise: e.sens !== "sortie" ? e.heureMatin || "" : "",
        heureSortie: e.heureSortie || "",
        jours: JOURS.map((_, w) => ({ actif: jourUnique === null ? !!e.jours[w].actif : w === jourUnique, arrivee: "", sortie: e.sens !== "matin" ? heureDuJour(e, w) : "" })),
      }],
    })),
  };
}

/* ---------- Doublons ---------- */

const simple = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u05d0-\u05ea]+/g, " ").trim();
const cle = (a) => (aCoord(a) ? `${a.lat.toFixed(4)},${a.lon.toFixed(4)}` : "");
const tel = (x) => String(x || "").replace(/\D/g, "").replace(/^972/, "0");

// Familles probablement saisies deux fois : meme telephone, meme nom (ou l'un contient l'autre : « Alexia » et
// « Alexia Dahan »), ou meme domicile avec un enfant du meme prenom. Renvoie [{ a, b, texte }] (b = null : enfant en double dans la famille a).
export function doublonsFamilles(familles) {
  const alertes = [];
  for (let i = 0; i < familles.length; i++) {
    for (let j = i + 1; j < familles.length; j++) {
      const [a, b] = [familles[i], familles[j]];
      const [na, nb] = [simple(a.nom), simple(b.nom)];
      const memeNom = !!na && !!nb && (na === nb || ` ${na} `.includes(` ${nb} `) || ` ${nb} `.includes(` ${na} `));
      const memeTel = tel(a.telephone).length >= 9 && tel(a.telephone) === tel(b.telephone);
      const prenoms = a.enfants.map((e) => simple(e.prenom)).filter((p) => p && b.enfants.some((e) => simple(e.prenom) === p));
      const memeMaison = !!cle(a.domicile) && cle(a.domicile) === cle(b.domicile);
      if (memeNom || memeTel || (prenoms.length > 0 && memeMaison)) {
        const raison = memeTel ? "même téléphone" : memeNom ? "même nom" : "même domicile et même enfant";
        alertes.push({ a: a.id, b: b.id, texte: `« ${a.nom || "Sans nom"} » et « ${b.nom || "Sans nom"} » : ${raison}${prenoms.length ? `, enfant(s) en commun : ${prenoms.join(", ")}` : ""}.` });
      }
    }
    // Le meme enfant deux fois dans la meme famille
    const vus = new Set();
    for (const e of familles[i].enfants) {
      const p = simple(e.prenom);
      if (p && vus.has(p)) alertes.push({ a: familles[i].id, b: null, texte: `« ${familles[i].nom || "Sans nom"} » : l'enfant « ${e.prenom} » est saisi deux fois.` });
      vus.add(p);
    }
  }
  return alertes;
}

// Trajets ajoutes a la main qui font double emploi avec un trajet venu d'une fiche (memes adresses, meme sens)
export function doublonsTrajets(manuels, desFiches) {
  const signature = (r) => `${r.type}|${cle(r.de)}|${cle(r.a)}`;
  const connus = new Set(desFiches.filter((r) => cle(r.de) && cle(r.a)).map(signature));
  return manuels.filter((r) => cle(r.de) && cle(r.a) && connus.has(signature(r)));
}

/* ---------- Fusion de deux fiches en double : on garde la plus complete et on recupere ce qui lui manque ---------- */

const pointsRdv = (r) => (aCoord(r.lieu) ? 3 : r.lieu ? 1 : 0) + (r.heureArrivee ? 1 : 0) + (r.heureSortie ? 1 : 0) + (r.heurePrise ? 1 : 0) + r.jours.filter((j) => j.actif).length + r.jours.filter((j) => j.arrivee || j.sortie).length + (r.retour ? 1 : 0) + (r.priseAilleurs ? 1 : 0) + (String(r.nom || "").trim() ? 1 : 0);
const pointsEnfant = (e) => e.rdv.reduce((n, r) => n + pointsRdv(r), 0) + (simple(e.prenom) ? 1 : 0);
const pointsFamille = (f) => f.enfants.reduce((n, e) => n + pointsEnfant(e), 0) + (aCoord(f.domicile) ? 3 : f.domicile ? 1 : 0) + (f.telephone ? 1 : 0) + (f.adresses || []).length;
const meilleureAdresse = (x, y) => (aCoord(x) ? x : aCoord(y) ? y : x || y || null);
const cleRdv = (r) => `${r.type}|${r.type === "ecole" ? "" : simple(r.nom)}`;

// Deux rendez-vous du meme genre : le plus complet, complete par l'autre
function fusionnerRdv(x, y) {
  const [g, p] = pointsRdv(x) >= pointsRdv(y) ? [x, y] : [y, x];
  return {
    ...g,
    nom: String(g.nom || "").trim() ? g.nom : p.nom,
    lieu: meilleureAdresse(g.lieu, p.lieu),
    heurePrise: g.heurePrise || p.heurePrise,
    heureArrivee: g.heureArrivee || p.heureArrivee,
    heureSortie: g.heureSortie || p.heureSortie,
    jours: g.jours.some((j) => j.actif) ? g.jours.map((j, w) => ({ ...j, arrivee: j.arrivee || (p.jours[w].actif ? p.jours[w].arrivee : ""), sortie: j.sortie || (p.jours[w].actif ? p.jours[w].sortie : "") })) : p.jours,
    retour: g.retour || p.retour,
    priseAilleurs: g.priseAilleurs || p.priseAilleurs,
    attend: g.attend || p.attend,
  };
}

function fusionnerEnfants(liste) {
  const sortie = [];
  for (const e of liste) {
    const deja = sortie.findIndex((x) => simple(x.prenom) && simple(x.prenom) === simple(e.prenom));
    if (deja < 0) {
      sortie.push(e);
      continue;
    }
    const [g, p] = pointsEnfant(sortie[deja]) >= pointsEnfant(e) ? [sortie[deja], e] : [e, sortie[deja]];
    const rdv = g.rdv.map((r) => {
      const autre = p.rdv.find((x) => cleRdv(x) === cleRdv(r));
      return autre ? fusionnerRdv(r, autre) : r;
    });
    for (const r of p.rdv) if (!g.rdv.some((x) => cleRdv(x) === cleRdv(r))) rdv.push(r);
    sortie[deja] = { ...g, rdv };
  }
  return sortie;
}

// Une seule fiche a partir de deux : la plus complete sert de base, l'autre comble ce qui manque
export function fusionnerDeuxFamilles(x, y) {
  const [g, p] = pointsFamille(x) >= pointsFamille(y) ? [x, y] : [y, x];
  const adresses = [...(g.adresses || [])];
  for (const a of p.adresses || []) if (!adresses.some((z) => (cle(z.adresse) && cle(z.adresse) === cle(a.adresse)) || z.adresse.label === a.adresse.label)) adresses.push(a);
  return {
    ...g,
    nom: String(g.nom || "").trim().length >= String(p.nom || "").trim().length ? g.nom : p.nom,
    telephone: g.telephone || p.telephone,
    domicile: meilleureAdresse(g.domicile, p.domicile),
    adresses,
    du: g.du || p.du,
    au: g.au || p.au,
    enfants: fusionnerEnfants([...g.enfants, ...p.enfants]),
    membres: [...(g.membres || []), ...(p.membres || []).filter((m) => !(g.membres || []).some((n) => n.nom.toLowerCase() === m.nom.toLowerCase()))],
  };
}

// Applique une fusion a la liste : a et b deviennent une seule fiche (b = null : enfants en double dans a)
export function fusionnerDoublon(familles, a, b) {
  const fa = familles.find((f) => f.id === a);
  const fb = b ? familles.find((f) => f.id === b) : null;
  if (!fa || (b && !fb)) return familles;
  const fusion = fb ? fusionnerDeuxFamilles(fa, fb) : { ...fa, enfants: fusionnerEnfants(fa.enfants) };
  return familles.filter((f) => f.id !== (fb ? fb.id : "")).map((f) => (f.id === fa.id ? { ...fusion, id: fa.id } : f));
}

/* ---------- MES TRAJETS CHOISIS (12 nov. 2026, 14h45) ----------
   Rebecca : « c'est moi qui choisis tous les trajets ». La fiche de l'enfant n'est que son AGENDA (ecole, activites,
   jours, heures). Dans la tournee, elle touche « + Ajouter un trajet », choisit l'enfant, puis Aller ou Retour :
   l'agenda est propose tout coche, elle decoche les jours qu'elle ne fait pas, change une heure ou l'endroit ou
   elle recupere l'enfant ce jour-la (chez une amie), et valide. Rien n'entre dans la tournee sans ce choix.
   choix = { id, famille, enfant, rdv, sens: "aller" | "retour", jours: [{ actif, heure, lieu }] }
   (heure vide = celle de l'agenda ; lieu vide = sur place, sinon l'endroit ou l'enfant m'attend ce jour-la). */

export function trouverFiche(familles, c) {
  const f = familles.find((x) => x.id === c.famille);
  const e = f && f.enfants.find((x) => x.id === c.enfant);
  const r = e && e.rdv.find((x) => x.id === c.rdv);
  return r ? { f, e, r } : null;
}

// Nouveau choix : les jours de l'agenda, tous coches
export const choixPour = (f, e, r, sens) => ({ id: nouvelIdFiche(), famille: f.id, enfant: e.id, rdv: r.id, sens: sens === "retour" ? "retour" : "aller", jours: r.jours.map((j) => ({ actif: j.actif, heure: "", lieu: null })) });

export function lireChoix(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((c) => c && typeof c === "object" && c.famille && c.enfant && c.rdv)
    .slice(0, 200)
    .map((c) => ({
      id: String(c.id || nouvelIdFiche()).slice(0, 40),
      famille: String(c.famille).slice(0, 40),
      enfant: String(c.enfant).slice(0, 40),
      rdv: String(c.rdv).slice(0, 40),
      sens: c.sens === "retour" ? "retour" : "aller",
      jours: JOURS.map((_, w) => ({ actif: !!(c.jours && c.jours[w] && c.jours[w].actif), heure: heure(c.jours && c.jours[w] && c.jours[w].heure), lieu: adresseLue(c.jours && c.jours[w] && c.jours[w].lieu) })),
    }));
}

// Heure d'un jour pour un choix : celle que Rebecca a mise, sinon celle de l'agenda de l'enfant
export const heureChoix = (r, c, w) => c.jours[w].heure || (c.sens === "aller" ? arriveeDuJour(r, w) : sortieDuJour(r, w));

export function titreChoix(familles, c) {
  const x = trouverFiche(familles, c);
  if (!x) return "Fiche supprimée du Répertoire";
  return `${String(x.e.prenom || "").trim() || "Enfant"} · ${nomRdv(x.r)} · ${c.sens === "aller" ? "Aller" : "Retour"}`;
}

// Les trajets de la tournee qui sortent des choix (un choix dont la fiche a disparu ne donne rien)
export function trajetsDesChoix(familles, choix) {
  const liste = [];
  for (const c of choix) {
    const x = trouverFiche(familles, c);
    if (!x) continue;
    const { f, e, r } = x;
    const qui = `${String(e.prenom || "").trim() || "Enfant"} · ${nomRdv(r)}`;
    const base = { places: 1, du: f.du, au: f.au, client: true, choix: c.id, famille: f.id };
    if (c.sens === "aller") {
      liste.push(trajetVide({ ...base, id: `choix-${c.id}`, nom: `${qui} (aller)`, type: "matin", de: f.domicile, a: r.lieu, heurePrise: r.heurePrise, heure: "", jours: c.jours.map((j, w) => ({ actif: j.actif, heure: j.actif ? heureChoix(r, c, w) : "" })) }));
      continue;
    }
    // Retour : un trajet par endroit de prise (sur place, ou la ou l'enfant m'attend certains jours)
    const endroits = new Map();
    c.jours.forEach((j, w) => {
      if (!j.actif) return;
      const k = cle(j.lieu);
      if (!endroits.has(k)) endroits.set(k, { lieu: j.lieu, jours: [] });
      endroits.get(k).jours.push(w);
    });
    let n = 0;
    for (const [k, v] of endroits) {
      liste.push(trajetVide({ ...base, id: `choix-${c.id}-${n++}`, nom: `${qui} (retour${k ? ", m'attend ailleurs" : ""})`, type: "sortie", de: k ? v.lieu : r.lieu, a: r.retour || f.domicile, heure: "", peutAttendre: !!k, jours: c.jours.map((j, w) => ({ actif: v.jours.includes(w), heure: v.jours.includes(w) ? heureChoix(r, c, w) : "" })) }));
    }
  }
  return liste;
}

// Une cliente accepte un devis : en plus de sa fiche, ses trajets sont choisis d'office (elle les a demandes)
export function choixDeLaFamille(f) {
  const liste = [];
  for (const e of f.enfants) {
    for (const r of e.rdv) {
      if (r.depose) liste.push(choixPour(f, e, r, "aller"));
      if (r.recupere) liste.push(choixPour(f, e, r, "retour"));
    }
  }
  return liste;
}
