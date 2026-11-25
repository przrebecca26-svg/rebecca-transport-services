// TESTS DU RESEAU DE PROFESSIONNELS PARTENAIRES (25 nov. 2026)
import { test, egal, vrai, section } from "./outils.mjs";
import * as P from "../src/pricing/pros.js";

section("Réseau de professionnels partenaires");
const AUJ = "2026-11-25";
const CATS = P.lireCategories(null);
const base = () => P.normaliserDossier({ id: "p1", nomCommercial: "Ongles de Lou", prenom: "Lou", nom: "Cohen", categorie: "beaute", villes: "Netanya, Hadera", whatsapp: "0541234567", description: "Pose d'ongles en gel à domicile", osek: "123456789" });

test("catégories : garde d'enfants cachée par défaut, lecture tolérante", () => {
  vrai(!P.categoriesVisibles(CATS).some((c) => c.id === "garde"));
  egal(P.lireCategories("pas du json").length, CATS.length);
  egal(P.lireCategories(JSON.stringify([{ id: "x1", nom: "Test" }, { id: "x1", nom: "doublon" }, { id: "MAUVAIS ID" }])).map((c) => c.id), ["x1"]);
});

test("statuts : pas de saut interdit, motif obligatoire pour refuser ou suspendre, journal", () => {
  const d = { ...base(), statut: "soumis" };
  egal(P.changerStatut(d, "suspendu").erreur.startsWith("Impossible"), true);
  vrai(P.changerStatut(d, "refuse", "").erreur.includes("motif"));
  const a = P.changerStatut(d, "accepte", "", 1000).dossier;
  egal([a.statut, a.actif, a.journal[0].texte], ["accepte", true, "Statut : Accepté"]);
  const s = P.changerStatut(a, "suspendu", "assurance expirée", 2000).dossier;
  egal([s.statut, s.actif, s.journal.length], ["suspendu", false, 2]);
});

test("fiche publique : seulement acceptée + active + métier visible, sans les champs privés", () => {
  const d = { ...base(), statut: "accepte", actif: true, notePrivee: "secret", osek: "123456789", email: "lou@x.com" };
  const f = P.fichePublique(d, CATS, AUJ);
  vrai(f && !("osek" in f) && !("notePrivee" in f) && !("email" in f) && !("journal" in f) && !("justificatifs" in f));
  egal(P.fichePublique({ ...d, statut: "soumis" }, CATS, AUJ), null);
  egal(P.fichePublique({ ...d, actif: false }, CATS, AUJ), null);
  egal(P.fichePublique({ ...d, categorie: "garde" }, CATS, AUJ), null);
  // numéro caché si le pro ne veut pas
  egal(P.fichePublique({ ...d, whatsappPublic: false }, CATS, AUJ).whatsapp, "");
  egal(P.fichePublique(d, CATS, AUJ).tarifs, "Sur devis");
});

test("badge : donné à la main ET pièces valides ; tombe quand une pièce expire", () => {
  const pieces = { identite: { recu: true, controle: true }, osek: { recu: true, controle: true }, assurance: { recu: true, controle: true, expire: "2027-06-01" } };
  const d = { ...base(), statut: "accepte", actif: true, badge: true, justificatifs: pieces };
  vrai(P.badgeActif(d, CATS, AUJ));
  vrai(!P.badgeActif({ ...d, badge: false }, CATS, AUJ));
  const expire = { ...d, justificatifs: { ...pieces, assurance: { ...pieces.assurance, expire: "2026-11-01" } } };
  vrai(!P.badgeActif(expire, CATS, AUJ));
  egal(P.manquePourBadge(expire, CATS, AUJ), ["Assurance professionnelle"]);
  egal(P.alertesJustificatifs([expire], AUJ).map((a) => a.etat), ["expire"]);
  egal(P.etatJustif({ recu: true, controle: true, expire: "2026-12-10" }, AUJ), "bientot");
  egal(P.etatJustif({ recu: true }, AUJ), "a_controler");
  // métier sensible : références en plus
  vrai(P.justificatifsDemandes(CATS.find((c) => c.id === "garde")).includes("references"));
});

test("recherche : métier, ville sans accent, texte ; vérifiés d'abord", () => {
  const f1 = { id: "a", nomCommercial: "Zoé Ménage", categorie: "menage", villes: "Netanya", zone: "", metier: "", description: "", prestations: "", verifie: false };
  const f2 = { id: "b", nomCommercial: "Ali Travaux", categorie: "travaux", villes: "Hadera", zone: "", metier: "plombier", description: "", prestations: "", verifie: false };
  const f3 = { id: "c", nomCommercial: "Bella Ménage", categorie: "menage", villes: "Ra'anana", zone: "Toute Israël", metier: "", description: "", prestations: "", verifie: true };
  egal(P.rechercherPros([f1, f2, f3], { categorie: "menage" }).map((f) => f.id), ["c", "a"]);
  egal(P.rechercherPros([f1, f2, f3], { ville: "netanya" }).map((f) => f.id), ["c", "a"]);
  egal(P.rechercherPros([f1, f2, f3], { texte: "PLOMBIER" }).map((f) => f.id), ["b"]);
  egal(P.villesDesFiches([f1, f2, f3]), ["Hadera", "Netanya", "Ra'anana"]);
});

test("contact WhatsApp : bloqué pendant Chabbat et les fêtes", () => {
  const f = P.fichePublique({ ...base(), statut: "accepte", actif: true }, CATS, AUJ);
  vrai(P.lienContactPro(f).lien.startsWith("https://wa.me/972541234567?text="));
  const ferme = P.lienContactPro(f, { label: "Chabbat", reprise: { date: "28/11", heure: "18h19" } });
  egal(ferme.lien, "");
  vrai(ferme.message.includes("Chabbat") && ferme.message.includes("18h19"));
});

test("inscription : contrôles, dossier soumis (jamais publié), message WhatsApp complet", () => {
  const f = { ...P.inscriptionVide(), ...base(), prenom: "Lou", nom: "Cohen", conditions: true, independant: true };
  egal(Object.keys(P.erreursInscription(f)), []);
  vrai(Object.keys(P.erreursInscription({ ...f, osek: "", conditions: false })).length === 2);
  const d = P.candidatureVersDossier(f, 5000);
  egal([d.statut, d.actif, d.badge, d.source], ["soumis", false, false, "inscription"]);
  egal(P.fichePublique(d, CATS, AUJ), null);
  const m = P.messageInscriptionWhatsApp(f, CATS);
  vrai(m.includes("Ongles de Lou") && m.includes("Beauté et bien-être") && m.includes("Osek : 123456789"));
});

test("une inscription piégée (statut accepté, badge) n'est jamais publiée à l'import", () => {
  const piege = { ...base(), id: "existant", statut: "accepte", actif: true, badge: true, justificatifs: { identite: { recu: true, controle: true } } };
  const d = P.importerCandidature(piege, 9000);
  egal([d.statut, d.actif, d.badge, Object.keys(d.justificatifs).length, d.id === "existant"], ["soumis", false, false, 0, false]);
  egal(P.fichePublique(d, CATS, AUJ), null);
});
