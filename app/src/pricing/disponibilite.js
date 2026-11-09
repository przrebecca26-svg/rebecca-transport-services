// DISPONIBILITE AFFICHEE AU CLIENT - Rebecca Transport & Services
// Deux petites fonctions, sans rien de nouveau a regler :
//  - etatDisponibilite : "Reservations ouvertes / fermees" pour l'accueil (Chabbat, fetes, fermetures de Rebecca)
//  - horairesRapides   : boutons "Dans 1 h", "Ce soir", "Demain" qui sautent les moments fermes
// Elles s'appuient sur le calendrier existant : aucune regle n'est dupliquee.

import { TARIFS } from "./config.js";
import { ajouterJours, localVersUtc, periodesFermees, utcVersLocal, verifierDisponibilite } from "./calendrier.js";

const MINUTE = 60000;
const HEURE_MS = 60 * MINUTE;

const joursFr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
const jourLisible = (date) => {
  const [a, m, j] = date.split("-").map(Number);
  const nom = joursFr.format(new Date(Date.UTC(a, m - 1, j, 12)));
  return `${nom} ${String(j).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

// Les creneaux personnels (trajets deja pris) ne sont jamais annonces : seulement Chabbat, fetes et fermetures de Rebecca
// J4b : une fermeture « seulement moi » de Rebecca n'est pas annoncee quand un autre membre travaille
const annonces = (maintenantMs, t) => periodesFermees(utcVersLocal(maintenantMs).date, 4, t).filter((p) => p.type !== "personnel" && !(p.seulementRebecca && (t.calendrier.equipe || []).length));

export function etatDisponibilite(maintenantMs = Date.now(), t = TARIFS) {
  const periodes = annonces(maintenantMs, t);
  const actuelle = periodes.find((p) => p.debutUtc <= maintenantMs && p.finUtc > maintenantMs);
  if (actuelle) {
    // Fermetures qui se suivent (fete + Chabbat) : on annonce la vraie reprise
    let fin = actuelle.finUtc;
    let avance = true;
    while (avance) {
      avance = false;
      for (const p of periodes) {
        if (p.debutUtc <= fin && p.finUtc > fin) {
          fin = p.finUtc;
          avance = true;
        }
      }
    }
    const reprise = utcVersLocal(fin);
    return {
      ouvert: false,
      titre: "Réservations fermées : " + actuelle.label,
      detail: `Reprise ${jourLisible(reprise.date)} à ${reprise.heure}`,
    };
  }
  const prochaine = periodes.find((p) => p.debutUtc > maintenantMs);
  if (prochaine && prochaine.debutUtc - maintenantMs <= 36 * HEURE_MS) {
    return {
      ouvert: true,
      titre: "Réservations ouvertes",
      detail: `Pause à partir de ${jourLisible(prochaine.debut.date)} ${prochaine.debut.heure} (${prochaine.label})`,
    };
  }
  return { ouvert: true, titre: "Réservations ouvertes", detail: "Rebecca valide chaque demande puis vous répond sur WhatsApp" };
}

// Heure du jour la plus proche (arrondie aux 5 minutes suivantes) a partir de maintenant + decalage
const arrondi5 = (ms) => Math.ceil(ms / (5 * MINUTE)) * 5 * MINUTE;

export function horairesRapides(maintenantMs = Date.now(), t = TARIFS) {
  const liste = [];
  const ajouter = (id, prefixe, date, heure) => {
    const bloque = verifierDisponibilite(date, heure, 0, t);
    liste.push({ id, libelle: `${prefixe} · ${heure}`, date, heure, indisponible: !!bloque, motif: bloque ? bloque.label : "" });
  };
  const dansUneHeure = utcVersLocal(arrondi5(maintenantMs + HEURE_MS));
  ajouter("dans1h", "Dans 1 h", dansUneHeure.date, dansUneHeure.heure);
  const aujourdhui = utcVersLocal(maintenantMs).date;
  if (localVersUtc(aujourdhui, "19:00") > maintenantMs + 30 * MINUTE) ajouter("soir", "Ce soir", aujourdhui, "19:00");
  ajouter("demain", "Demain", ajouterJours(aujourdhui, 1), "09:00");
  return liste;
}
