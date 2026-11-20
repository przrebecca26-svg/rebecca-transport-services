// CHANGEMENT DE FORMULE D'UN RESTAURANT PARTENAIRE (avenant) - 20 nov. 2026, décision de Rebecca - règles pures
// « Le restaurant peut faire le contrat sous A, et après, dans son espace, choisir de rajouter l'option B ou
// changer de A à A + B ; je reçois un message, et il reçoit une annexe au contrat par mail. »
// Le restaurant demande (avenantsResto/{clé de son lien}, signé au doigt) ; Rebecca accepte ou refuse dans
// Partenaires. À l'acceptation : sa fiche, son espace et ses prix changent, et l'avenant part par e-mail aux deux.
import { avecCreneaux, grilleA, grilleKm, KM_MAX_GRILLE } from "./commercants.js";
import { erreursCreneaux, lireCreneaux, minimumCreneau } from "./creneauxResto.js";
import { libelleFormuleResto, signatureValide } from "./contratResto.js";

const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
export const FORMULES_AVENANT = ["A", "B", "AB"];

// Ce qui ne va pas dans la demande ([] = bon)
export function erreursAvenant(f, signature, actuel = {}) {
  const e = [];
  if (!FORMULES_AVENANT.includes(f.formule)) e.push("Choisissez une formule.");
  if (avecCreneaux(f.formule)) e.push(...erreursCreneaux(txt(f.creneaux, 200)));
  const memeCreneaux = txt(f.creneaux, 200) === txt(actuel.creneaux, 200);
  if (f.formule === actuel.formule && (!avecCreneaux(f.formule) || memeCreneaux)) e.push("Rien ne change : choisissez une autre formule ou d'autres créneaux.");
  if (txt(f.signataire, 60).length < 2) e.push("Écrivez le nom de la personne qui signe.");
  if (!signatureValide(signature)) e.push("Signez avec le doigt dans le cadre.");
  return e;
}

// Document envoyé à la base (avenantsResto/{clé}) : uniquement ces champs (règles v32)
export function avenantPropre(f, signature, actuel = {}, nom = "") {
  return {
    nom: txt(nom, 60) || "Restaurant",
    ancienne: FORMULES_AVENANT.includes(actuel.formule) ? actuel.formule : "A",
    formule: f.formule,
    creneaux: avecCreneaux(f.formule) ? txt(f.creneaux, 200) : "",
    signataire: txt(f.signataire, 60),
    signature,
    statut: "demandee",
  };
}

// Le contrat de la fiche après l'avenant (prix gardés quand c'est possible) :
//  A -> B / A + B : ses prix actuels deviennent ses prix A (hors créneaux), ses prix B = prix standard B ;
//  B / A + B -> A : ses prix A deviennent ses prix uniques ; B <-> A + B ou nouveaux créneaux : mêmes prix.
export function contratApresAvenant(contratPro, av, standardB) {
  const c = { ...(contratPro || {}) };
  const avant = avecCreneaux(c.formule);
  const apres = avecCreneaux(av.formule);
  if (!avant && apres) {
    const b = standardB || {};
    return { ...c, formule: av.formule, creneaux: av.creneaux, prixA: grilleA(c), jusqua3: b.jusqua3 ?? 30, de3a6: b.de3a6 ?? 40, enPlus: b.enPlus ?? 20, tresLourd: b.tresLourd ?? 5, parHeure: b.parHeure || c.parHeure || 75 };
  }
  if (avant && !apres) {
    const { prixA: _ancien, ...reste } = c; // eslint-disable-line no-unused-vars
    return { ...reste, formule: "A", creneaux: "", ...grilleA(c) };
  }
  return { ...c, formule: av.formule, creneaux: apres ? av.creneaux : "" };
}

const grilleTexte = (t) => `${grilleKm(t).map((x) => `${x.de ? `de ${x.de} à ${x.a} km` : `jusqu'à ${x.a} km`} : ${x.prix} ₪`).join(" · ")} · au-delà de ${KM_MAX_GRILLE} km : sur devis · commande en plus : ${t.enPlus} ₪ · article très lourd : ${t.tresLourd ?? 5} ₪`;
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || "") ? d.slice(0, 10).split("-").reverse().join("/") : "");

// Texte de l'avenant (e-mail au restaurant et à Rebecca, après l'acceptation)
export function texteAvenant({ nom, numero, av, contrat, jour }) {
  const lignes = [
    `Avenant au contrat de partenariat livraison${numero ? ` n° ${numero}` : ""} – ${nom}`,
    "",
    `À compter du ${jourFr(jour)}, la formule passe de « ${libelleFormuleResto(av.ancienne)} » à « ${libelleFormuleResto(av.formule)} ».`,
  ];
  if (avecCreneaux(av.formule)) {
    lignes.push(`Créneaux réservés : ${av.creneaux}.`);
    for (const x of lireCreneaux(av.creneaux).filter((y) => y.heures)) lignes.push(`• ${x.texte} : ${String(x.heures).replace(".", ",")} h, minimum ${minimumCreneau(x.heures, contrat.parHeure || 75)} ₪ par créneau.`);
    lignes.push(`Pendant les créneaux réservés (prix B) : ${grilleTexte(contrat)} ; minimum ${contrat.parHeure || 75} ₪ par heure de créneau, 2 heures au moins.`);
    lignes.push(`En dehors des créneaux (prix A) : ${grilleTexte(grilleA(contrat))}.`);
    lignes.push("Le prix applicable est déterminé par l'heure à laquelle la commande est prête. Un créneau annulé moins de 24 h avant son début reste dû au minimum.");
  } else {
    lignes.push(`Prix (formule A, à la demande) : ${grilleTexte(contrat)}.`);
  }
  lignes.push(
    "Toutes les autres conditions du contrat restent inchangées.",
    "",
    `Demandé et signé électroniquement par ${av.signataire} pour ${nom} ; accepté par Rebecca Perez pour Rebecca Services le ${jourFr(jour)}.`,
    "",
    "Rebecca Services · 054-738-0193 · rebeccaservices.com",
  );
  return lignes.join("\n");
}

// E-mail à Rebecca dès la demande
export const texteDemandeAvenant = (av) =>
  [
    `${av.nom} demande à changer de formule : « ${libelleFormuleResto(av.ancienne)} » → « ${libelleFormuleResto(av.formule)} ».`,
    avecCreneaux(av.formule) ? `Créneaux demandés : ${av.creneaux}.` : "",
    `Signé par ${av.signataire}.`,
    "",
    "Pour accepter ou refuser : espace privé → Partenaires → Restaurants partenaires.",
  ].filter((l, i) => l || i > 1).join("\n");
