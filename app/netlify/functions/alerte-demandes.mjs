// TACHE PROGRAMMEE NETLIFY : ALERTE « NOUVELLE DEMANDE » (18 nov. 2026, suggestion validée) - Rebecca Services
// Toutes les 5 minutes : s'il y a de nouvelles demandes sur le site, UN e-mail part vers l'adresse de Rebecca
// (Réglages → Général → « Me prévenir à chaque nouvelle demande »). Son iPhone sonne avec Mail ou Gmail.
// Même compte robot et mêmes variables Netlify que les rappels du soir (ROBOT_EMAIL, ROBOT_MDP, EMAILJS_PRIVEE).
// 18 nov. 2026 (soir) : + NOTIFICATION sur l'iPhone (icone « Rebecca admin »), toutes les 2 minutes.
//   Les deux sont independantes : e-mail seul, notification seule, ou les deux (Réglages → Général).
//   Variable Netlify en plus pour la notification : VAPID_PRIVEE (cle secrete, deja posee par Claude).
// 18 nov. 2026 (22h) : notifications de TOUT ce qui se passe sur le site (demandes, rendez-vous, commandes Epoxy,
//   paiements annonces, devis Digital, ramassage, recharges, avis, candidatures coursiers), + 19h le resume de demain,
//   7h la journee du jour, et 15 minutes avant chaque course. Regles Firebase v24.
import { SUJET_ALERTE, demandesASignaler, documentRest, texteAlerte } from "../../src/pricing/rappelsAuto.js";
import { messageTest } from "../../src/pricing/notifications.js";
import { SOURCES_SITE, maintenantIsrael, messageMatin, messageSite, messageSoir, rappelsAvant, paiementsEnRetard, messageRetards, demandesSansReponse, nbEnAttente, volsASuivre, signalVol, messageVol, choisirVol, semainePassee, messageSemaine } from "../../src/pricing/planningNotif.js";
import { adresseRecherche } from "../../src/pricing/vols.js";
import { envoyerNotification } from "../outils/webPush.mjs";

export const config = { schedule: "*/2 * * * *" };

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site (non secrete)
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const SITE = "https://rebeccaservices.com"; // 18 nov. 2026 : nom de domaine
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enHtml = (t) => echapper(String(t || "").slice(0, 3000)).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

async function connecterRobot() {
  const connexion = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_MDP, returnSecureToken: true }),
  });
  if (!connexion.ok) return null;
  return { Authorization: `Bearer ${(await connexion.json()).idToken}`, "Content-Type": "application/json" };
}

async function envoyerEmail(liste, email) {
  const emails = await fetch(`${BASE}/reglages/emails?key=${CLE_API}`);
  const modele = emails.ok ? String((documentRest(await emails.json()) || {}).modeleClient || "").trim() : "";
  if (!modele || !process.env.EMAILJS_PRIVEE) return false;
  const texte = texteAlerte(liste, SITE);
  const envoi = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS.service,
      template_id: modele,
      user_id: EMAILJS.cle,
      accessToken: process.env.EMAILJS_PRIVEE,
      template_params: { to_email: email, to_name: "Rebecca", sujet: SUJET_ALERTE(liste.length), message: texte, message_html: enHtml(texte) },
    }),
  });
  return envoi.ok;
}

// Envoie chaque message a chaque telephone abonne ; un telephone desabonne est efface.
// Renvoie { envoyes, compte-rendu } (le compte-rendu du test s'affiche dans Réglages → Notifications).
async function notifier(entetes, messages) {
  const r = await fetch(`${BASE}/notificationsPush?pageSize=20`, { headers: entetes });
  if (!r.ok) return { envoyes: 0, rapport: `lecture des téléphones refusée (${r.status}) : règles v23 ?` };
  const abonnes = ((await r.json()).documents || []).map(documentRest).filter((a) => a && a.endpoint && a.p256dh && a.auth);
  if (!abonnes.length) return { envoyes: 0, rapport: "aucun téléphone abonné" };
  let envoyes = 0;
  const notes = [];
  for (const a of abonnes) {
    for (const m of messages) {
      try {
        const res = await envoyerNotification(a, m, process.env.VAPID_PRIVEE || Netlify.env.get("VAPID_PRIVEE"));
        if (res.ok) envoyes++;
        else notes.push(`${a.appareil || "?"} : refus ${res.statut} ${res.raison}`.trim());
        if (res.expire) { await fetch(`${BASE}/notificationsPush/${a.id}`, { method: "DELETE", headers: entetes }); break; }
      } catch (e) {
        notes.push(`${a.appareil || "?"} : ${e.message}`);
      }
    }
  }
  const rapport = `${envoyes} envoyée(s) sur ${abonnes.length} téléphone(s)${notes.length ? " · " + notes.join(" · ") : ""}`;
  console.log("Notifications :", rapport);
  return { envoyes, rapport };
}

// Lecture d'un document prive (json) par le robot
async function lireJson(entetes, chemin) {
  const r = await fetch(`${BASE}/${chemin}`, { headers: entetes });
  if (!r.ok) return "";
  return String((documentRest(await r.json()) || {}).json || "");
}
async function requete(entetes, structuredQuery) {
  const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: entetes, body: JSON.stringify({ structuredQuery }) });
  if (!r.ok) return null;
  return (await r.json()).map((x) => documentRest(x.document)).filter(Boolean);
}
const depuis = (collectionId, quand, limite = 20, champ = "creeLe") => ({
  from: [{ collectionId }],
  where: { fieldFilter: { field: { fieldPath: champ }, op: "GREATER_THAN", value: { timestampValue: quand } } },
  orderBy: [{ field: { fieldPath: champ }, direction: "ASCENDING" }],
  limit: limite,
});
const entreDates = (champ, du, au, collectionId = "demandes") => ({
  from: [{ collectionId }],
  where: { compositeFilter: { op: "AND", filters: [
    { fieldFilter: { field: { fieldPath: champ }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: du } } },
    { fieldFilter: { field: { fieldPath: champ }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: au } } },
  ] } },
});
async function noter(entetes, champs) {
  const masque = Object.keys(champs).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const fields = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, { stringValue: String(v) }]));
  await fetch(`${BASE}/reglages/alerteDemandes?${masque}`, { method: "PATCH", headers: entetes, body: JSON.stringify({ fields }) });
}
// Donnees de la journee (aujourd'hui et demain) : courses acceptees + tournee + mes changements du jour + repertoire
async function donneesJournee(entetes, aujourdhui, demain) {
  const [a, b, tourneeJson, joursJson, repertoireJson] = await Promise.all([
    requete(entetes, entreDates("date", aujourdhui, demain)),
    requete(entetes, entreDates("details.dateRetour", aujourdhui, demain)),
    lireJson(entetes, "admin/tournee"),
    lireJson(entetes, "admin/tourneeJours"),
    lireJson(entetes, "clientsAdmin/_repertoire"),
  ]);
  const vus = new Map();
  for (const d of [...(a || []), ...(b || [])]) vus.set(d.id, d);
  return { demandes: [...vus.values()], tourneeJson, joursJson, repertoireJson };
}

export default async function alerteDemandes() {
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_MDP) return new Response("non configuré");
  // 18 nov. 2026 (securite) : ce reglage n'est plus public (adresse e-mail) : le robot se connecte d'abord
  const entetes = await connecterRobot();
  if (!entetes) return new Response("connexion du robot refusée");
  const brut = await fetch(`${BASE}/reglages/alerteDemandes`, { headers: entetes });
  const reglage = (brut.ok ? documentRest(await brut.json()) : null) || {};
  const email = String(reglage.email || "").trim();
  const parEmail = reglage.actif === true && EMAIL_OK.test(email);
  const parNotif = reglage.notifications === true && !!(process.env.VAPID_PRIVEE || (globalThis.Netlify && Netlify.env && Netlify.env.get("VAPID_PRIVEE")));
  const testEnAttente = reglage.notifications === true && typeof reglage.testDemande === "string" && reglage.testDemande !== reglage.testFait;
  if (!parEmail && !parNotif && !testEnAttente) return new Response("désactivé");
  const journal = [];

  if (testEnAttente && !parNotif) {
    await fetch(`${BASE}/reglages/rappelsAuto?updateMask.fieldPaths=detail`, {
      method: "PATCH", headers: entetes, body: JSON.stringify({ fields: { detail: { stringValue: "📲 Test : clé VAPID_PRIVEE introuvable chez Netlify (republier le site)" } } }),
    });
  }

  if (parNotif) {
    const maintenant = Date.now();
    const { date: aujourdhui, min } = maintenantIsrael(maintenant);
    const messages = [];

    // Bouton « Envoyer un test »
    if (testEnAttente) {
      const { rapport } = await notifier(entetes, [messageTest()]);
      await noter(entetes, { testFait: reglage.testDemande });
      const quandTest = new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
      await fetch(`${BASE}/reglages/rappelsAuto?updateMask.fieldPaths=detail`, {
        method: "PATCH", headers: entetes, body: JSON.stringify({ fields: { detail: { stringValue: `📲 Test ${quandTest} : ${rapport}`.slice(0, 400) } } }),
      });
    }

    // 1. Tout ce qui est arrivé sur le site depuis le dernier passage
    if (reglage.notifSite !== false) {
      const vu = typeof reglage.vuJusqua === "string" && reglage.vuJusqua ? reglage.vuJusqua : "";
      if (!vu) {
        await noter(entetes, { vuJusqua: new Date(maintenant).toISOString() }); // 1er passage : on part de maintenant
      } else {
        let plusRecent = vu;
        for (const src of SOURCES_SITE) {
          const champ = src.champ || "creeLe";
          const docs = await requete(entetes, depuis(src.collection, vu, 20, champ));
          if (!docs) { journal.push(`${src.collection} illisible`); continue; }
          for (const d of docs) {
            const m = messageSite(src.collection, d, src.cle || "");
            if (m) messages.push(m);
            if (String(d[champ] || "") > plusRecent) plusRecent = String(d[champ]);
          }
        }
        if (plusRecent !== vu) await noter(entetes, { vuJusqua: plusRecent });
      }
    }

    // 2. Ma journée : 19h demain, 7h aujourd'hui, 15 minutes avant chaque course
    const veutSoir = reglage.notifSoir !== false && min >= 19 * 60 && min < 23 * 60 && reglage.soirFait !== aujourdhui;
    const veutMatin = reglage.notifMatin !== false && min >= 7 * 60 && min < 11 * 60 && reglage.matinFait !== aujourdhui;
    const veutAvant = reglage.notifAvant !== false;
    if (veutSoir || veutMatin || veutAvant || (reglage.notifVols !== false && min % 10 < 2)) {
      const demain = new Date(Date.parse(`${aujourdhui}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const donnees = await donneesJournee(entetes, aujourdhui, demain);
      if (veutSoir) { messages.push(messageSoir(aujourdhui, donnees)); await noter(entetes, { soirFait: aujourdhui }); }
      if (veutMatin) {
        const m = messageMatin(aujourdhui, donnees);
        const attente = await requete(entetes, { from: [{ collectionId: "demandes" }], where: { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "en attente" } } } });
        const n = nbEnAttente(attente || []);
        if (n) m.corps = `${m.corps}\n⏳ ${n} demande${n > 1 ? "s" : ""} en attente de ta réponse`;
        messages.push(m);
        await noter(entetes, { matinFait: aujourdhui });
      }
      if (veutAvant) messages.push(...rappelsAvant(maintenant, donnees));

      // 3. Vols en retard (toutes les 10 minutes) : alerte seulement quand l'état change
      if (reglage.notifVols !== false && min % 10 < 2) {
        let signales = {};
        try { signales = JSON.parse(reglage.volsSignales || "{}") || {}; } catch { signales = {}; }
        const suite = {};
        for (const x of volsASuivre(donnees.demandes, aujourdhui).slice(0, 6)) {
          try {
            const r = await fetch(adresseRecherche(x.vol.numero.numero));
            const lignes = r.ok ? (((await r.json()).result || {}).records || []) : [];
            const sig = signalVol(choisirVol(lignes, x.vol), x.vol);
            if (sig) {
              suite[x.cle] = sig.cle;
              if (signales[x.cle] !== sig.cle) messages.push(messageVol(x, sig));
            }
          } catch (e) {
            journal.push(`vol ${x.cle} : ${e.message}`);
            if (signales[x.cle]) suite[x.cle] = signales[x.cle];
          }
        }
        const texte = JSON.stringify(suite).slice(0, 2000);
        if (texte !== JSON.stringify(signales)) await noter(entetes, { volsSignales: texte });
      }
    }

    // 4. Demande sans réponse depuis 2 heures (une fois)
    if (reglage.notifAttente !== false) {
      const t0 = new Date(maintenant - 2 * 3600000 - 2 * 60000).toISOString();
      const t1 = new Date(maintenant - 2 * 3600000).toISOString();
      const recentes = await requete(entetes, { from: [{ collectionId: "demandes" }], where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "creeLe" }, op: "GREATER_THAN", value: { timestampValue: t0 } } },
        { fieldFilter: { field: { fieldPath: "creeLe" }, op: "LESS_THAN_OR_EQUAL", value: { timestampValue: t1 } } },
      ] } } });
      messages.push(...demandesSansReponse(recentes || [], maintenant));
    }

    // 5. Paiements en retard (une fois par jour, à partir de 10h)
    if (reglage.notifRetard !== false && min >= 10 * 60 && min < 20 * 60 && reglage.retardFait !== aujourdhui) {
      const du = new Date(Date.parse(`${aujourdhui}T12:00:00Z`) - 60 * 86400000).toISOString().slice(0, 10);
      const du90 = new Date(Date.parse(`${aujourdhui}T12:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
      const [a, b, mv] = await Promise.all([
        requete(entetes, entreDates("date", du, aujourdhui)),
        requete(entetes, entreDates("details.dateRetour", du, aujourdhui)),
        requete(entetes, entreDates("date", du90, aujourdhui, "mouvements")),
      ]);
      if (a && mv) {
        const vus = new Map([...(a || []), ...(b || [])].map((d) => [d.id, d]));
        const m = messageRetards(paiementsEnRetard([...vus.values()], mv, aujourdhui), aujourdhui);
        if (m) messages.push(m);
        await noter(entetes, { retardFait: aujourdhui });
      }
    }

    // 6. Bilan de la semaine : dimanche soir, à partir de 20h
    const dimanche = new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() === 0;
    if (reglage.notifSemaine !== false && dimanche && min >= 20 * 60 && min < 23 * 60 && reglage.semaineFait !== aujourdhui) {
      const p = semainePassee(aujourdhui);
      const avant = new Date(Date.parse(`${p.debut}T12:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
      const [a, b, mv, dep, wolt] = await Promise.all([
        requete(entetes, entreDates("date", avant, p.fin)),
        requete(entetes, entreDates("details.dateRetour", p.debut, p.fin)),
        requete(entetes, entreDates("date", p.debut, p.fin, "mouvements")),
        requete(entetes, entreDates("date", p.debut, p.fin, "depenses")),
        requete(entetes, entreDates("debut", p.debut, p.fin, "autresRevenus")),
      ]);
      if (a && mv) {
        const vus = new Map([...(a || []), ...(b || [])].map((d) => [d.id, d]));
        messages.push(messageSemaine(aujourdhui, { demandes: [...vus.values()], mouvements: mv, depenses: dep || [], autresRevenus: wolt || [] }));
        await noter(entetes, { semaineFait: aujourdhui });
      }
    }

    if (messages.length) {
      const { rapport } = await notifier(entetes, messages.slice(0, 15));
      journal.push(rapport);
    }
  }

  // 3. E-mail « nouvelle demande » (comme avant)
  if (parEmail) {
    const quand24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const demandes = await requete(entetes, { from: [{ collectionId: "demandes" }], where: { fieldFilter: { field: { fieldPath: "creeLe" }, op: "GREATER_THAN", value: { timestampValue: quand24 } } } });
    const liste = demandesASignaler(demandes || []);
    if (liste.length && (await envoyerEmail(liste, email))) {
      const quand = new Date().toISOString();
      for (const d of liste) {
        await fetch(`${BASE}/demandes/${d.id}?updateMask.fieldPaths=alerteRebeccaLe`, {
          method: "PATCH",
          headers: entetes,
          body: JSON.stringify({ fields: { alerteRebeccaLe: { stringValue: quand } } }),
        });
      }
      journal.push(`${liste.length} e-mail(s)`);
    }
  }
  return new Response(journal.join(" · ") || "rien de nouveau");
}
