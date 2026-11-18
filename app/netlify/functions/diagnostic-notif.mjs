// DIAGNOSTIC DES NOTIFICATIONS (18 nov. 2026) - Rebecca Services
// Page a ouvrir sur l'iPhone : rebeccaservices.com/diag-notif
// Elle dit, etape par etape, ou ca bloque (aucun secret affiche) et envoie une notification de test.
import { documentRest } from "../../src/pricing/rappelsAuto.js";
import { messageTest } from "../../src/pricing/notifications.js";
import { envoyerNotification } from "../outils/webPush.mjs";

export const config = { path: "/diag-notif" };

const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg";
const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const env = (k) => process.env[k] || (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || "";

export default async function diagnostic() {
  const l = [];
  const ok = (b) => (b ? "✅" : "❌");
  l.push(`${ok(env("ROBOT_EMAIL"))} ROBOT_EMAIL présent`);
  l.push(`${ok(env("ROBOT_MDP"))} ROBOT_MDP présent`);
  l.push(`${ok(env("VAPID_PRIVEE"))} VAPID_PRIVEE présent`);
  try {
    const brut = await fetch(`${BASE}/reglages/alerteDemandes?key=${CLE_API}`);
    const r = brut.ok ? documentRest(await brut.json()) || {} : {};
    l.push(`${ok(brut.ok)} Réglage lu (${brut.status}) · notifications=${r.notifications} · e-mail=${r.actif} · test demandé=${r.testDemande || "-"} · test fait=${r.testFait || "-"}`);
    const c = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLE_API}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env("ROBOT_EMAIL"), password: env("ROBOT_MDP"), returnSecureToken: true }),
    });
    const cj = await c.json();
    l.push(`${ok(c.ok)} Connexion du robot (${c.status}${c.ok ? "" : " " + ((cj.error && cj.error.message) || "")})`);
    if (!c.ok) return fin(l);
    const h = { Authorization: `Bearer ${cj.idToken}`, "Content-Type": "application/json" };
    const t = await fetch(`${BASE}/notificationsPush?pageSize=20`, { headers: h });
    const tj = await t.json();
    const abonnes = ((tj && tj.documents) || []).map(documentRest).filter(Boolean);
    l.push(`${ok(t.ok)} Lecture des téléphones (${t.status}) · ${abonnes.length} téléphone(s)${t.ok ? "" : " " + JSON.stringify(tj).slice(0, 150)}`);
    for (const a of abonnes) {
      const host = (() => { try { return new URL(a.endpoint).host; } catch { return "?"; } })();
      try {
        const res = await envoyerNotification(a, messageTest(), env("VAPID_PRIVEE"));
        l.push(`${ok(res.ok)} Envoi vers ${a.appareil} (${host}) : ${res.statut} ${res.raison || ""}`);
      } catch (e) {
        l.push(`❌ Envoi vers ${a.appareil} (${host}) : ${e.message}`);
      }
    }
    const p = await fetch(`${BASE}/reglages/rappelsAuto?updateMask.fieldPaths=detail`, {
      method: "PATCH", headers: h, body: JSON.stringify({ fields: { detail: { stringValue: "📲 Diagnostic ouvert" } } }),
    });
    l.push(`${ok(p.ok)} Écriture du robot dans Réglages (${p.status})`);
  } catch (e) {
    l.push(`❌ Erreur : ${e.message}`);
  }
  return fin(l);
}

function fin(l) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:16px;background:#141214;color:#faf6f2"><h2>Diagnostic notifications</h2>${l.map((x) => `<p>${x.replace(/</g, "&lt;")}</p>`).join("")}</body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
