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
  attend: false, // il peut m'attendre sans limite
});
export const enfantFicheVide = () => ({ id: nouvelIdFiche(), prenom: "", rdv: [rdvVide("ecole")] });
export const familleVide = () => ({ id: nouvelIdFiche(), nom: "", telephone: "", domicile: null, adresses: [], du: "", au: "", enfants: [enfantFicheVide()] });

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
      domicile: adresseLue(f.domicile),
      adresses: (Array.isArray(f.adresses) ? f.adresses : [])
        .map((a) => ({ nom: String((a && a.nom) || "").slice(0, 40), adresse: adresseLue(a && a.adresse) }))
        .filter((a) => a.adresse)
        .slice(0, 20),
      du: date(f.du),
      au: date(f.au),
      enfants: (Array.isArray(f.enfants) ? f.enfants : [])
        .filter((e) => e && typeof e === "object")
        .slice(0, 8)
        .map((e) => ({
          id: String(e.id || nouvelIdFiche()).slice(0, 40),
          prenom: String(e.prenom || "").slice(0, 40),
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
              attend: r.attend === true,
            })),
        })),
    }));
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
          liste.push(trajetVide({ ...base, id: `fiche-${r.id}-retour`, nom: `${qui} (retour)`, type: "sortie", de: r.priseAilleurs || r.lieu, a: r.retour || f.domicile, heure: r.heureSortie, peutAttendre: r.attend, jours: r.jours.map((j) => ({ actif: j.actif, heure: j.sortie })) }));
        }
      }
    }
  }
  return liste;
}

// Une cliente accepte un devis de ramassage : sa famille et ses enfants deviennent des fiches
export function familleDuDevis(plan, nomCliente = "") {
  const jourUnique = plan.periode === "jour" && DATE_OK.test(plan.date || "") ? new Date(`${plan.date}T12:00:00Z`).getUTCDay() : null;
  const du = DATE_OK.test(plan.date || "") ? plan.date : "";
  const au = !du ? "" : plan.periode === "jour" ? du : plan.periode === "mois" ? finDuMois(du) : ajouterJours(du, 6);
  return {
    ...familleVide(),
    nom: String(nomCliente || "").trim().slice(0, 60) || "Cliente",
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
