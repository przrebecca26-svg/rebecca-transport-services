import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { cleClient } from "./pricing/clients.js";

// E-MAIL AUTOMATIQUE AUX CLIENTES (17 nov. 2026, 11h35) - Rebecca Services
// Chaque message (merci, rappel de la veille, en route, avis) part AUSSI par e-mail, tout seul,
// quand la cliente a donne son adresse (compte du site ou fiche client).
// Envoi par EmailJS (deja utilise pour les demandes) avec un 2e modele « message a une cliente » :
// son identifiant se colle dans Reglages → « E-mails aux clientes » (reglages/emails.modeleClient).
// Variables du modele : {{to_email}}, {{to_name}}, {{sujet}}, {{message}}.

const EMAILJS = { service: "service_apqztvn", cle: "bdJTayNK-YJyKZ79V" };
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let modeleEnCache = null;
async function modeleClient() {
  if (modeleEnCache) return modeleEnCache;
  const s = await getDoc(doc(db, "reglages", "emails"));
  const m = s.exists() ? String(s.data().modeleClient || "").trim() : "";
  if (m) modeleEnCache = m;
  return m;
}
export const oublierModele = () => {
  modeleEnCache = null;
};

// Adresse e-mail de la cliente : sur la demande, sinon son compte, sinon sa fiche client
export async function emailDuClient(d) {
  if (d && EMAIL_OK.test(String(d.email || "").trim())) return String(d.email).trim();
  try {
    if (d && d.uid) {
      const c = await getDoc(doc(db, "clients", d.uid));
      const e = c.exists() ? String(c.data().email || "").trim() : "";
      if (EMAIL_OK.test(e)) return e;
    }
    const cle = cleClient(d);
    if (cle) {
      const f = await getDoc(doc(db, "clientsAdmin", cle));
      const e = f.exists() ? String(f.data().email || "").trim() : "";
      if (EMAIL_OK.test(e)) return e;
    }
  } catch {
    // lecture impossible : pas d'e-mail
  }
  return "";
}

// Envoie le message par e-mail. Renvoie un petit texte pour Rebecca (ou "" s'il n'y a pas d'e-mail).
export async function envoyerMailClient(d, sujet, message) {
  const email = await emailDuClient(d);
  if (!email) return "";
  const modele = await modeleClient().catch(() => "");
  if (!modele) return "📧 E-mail pas envoyé : ajoute le modèle EmailJS dans Réglages → « E-mails aux clientes ».";
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: modele,
        user_id: EMAILJS.cle,
        template_params: { to_email: email, to_name: String(d.nom || "").slice(0, 100), sujet: String(sujet).slice(0, 150), message: String(message).slice(0, 3000) },
      }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return `📧 E-mail envoyé à ${email}`;
  } catch {
    return `📧 L'e-mail à ${email} n'est pas parti (connexion ou modèle EmailJS).`;
  }
}

export const SUJETS = {
  merci: "Merci pour votre confiance - Rebecca Services",
  rappel: "Petit rappel pour votre retour - Rebecca Services",
  enRoute: "Je suis en route - Rebecca Services",
  avis: "Votre avis compte - Rebecca Services",
};
