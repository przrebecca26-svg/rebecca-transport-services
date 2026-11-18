import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { motDePasseRobot } from "./pricing/rappelsAuto.js";
import { VAPID_PUBLIQUE, etatTelephone, idAbonnement } from "./pricing/notifications.js";

// RAPPELS ENVOYES TOUT SEULS (17 nov. 2026) - reglage a faire une seule fois.
// Chaque soir vers 19h, Netlify envoie par e-mail les rappels de demain (retours d'aller-retour, rendez-vous beaute).
// Netlify se connecte avec un compte « robot » cree ici : il ne peut que lire les demandes et noter « e-mail parti ».
const CLE_API = "AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg"; // cle publique du site
const EMAIL_ROBOT = "robot.rappels@rebecca-services-netanya.netlify.app";

// 18 nov. 2026 (suggestion validée) : e-mail à Rebecca à chaque nouvelle demande du site (toutes les 5 minutes)
function AlerteDemandes() {
  const [a, setA] = useState(null);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  useEffect(() => onSnapshot(doc(db, "reglages", "alerteDemandes"), (s) => {
    const v = s.exists() ? s.data() : {};
    setA(v);
    setEmail((e) => e || v.email || "rebecca.services.transport@gmail.com");
  }, () => setA({})), []);
  if (!a) return null;
  const enregistrer = (actif) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setInfo("Adresse e-mail invalide.");
    setDoc(doc(db, "reglages", "alerteDemandes"), { actif, email: email.trim().slice(0, 120), majLe: serverTimestamp() }, { merge: true }).then(() => setInfo(actif ? "Activée ✓" : "Coupée.")).catch(() => setInfo("Enregistrement impossible."));
  };
  return (
    <div className="tb-bloc">
      <h3>🔔 Me prévenir à chaque nouvelle demande</h3>
      <p className="tb-note">Toutes les 5 minutes, s'il y a une nouvelle demande sur le site, un e-mail part vers cette adresse : ton iPhone sonne (active les notifications de Mail ou Gmail pour cette adresse). Même compte robot que les rappels du soir.</p>
      <label className="pm-champ">Adresse qui reçoit l'alerte<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="rg-case">
        <input type="checkbox" checked={a.actif === true} onChange={() => enregistrer(!(a.actif === true))} />
        <span>{a.actif === true ? "Activée" : "Désactivée"}</span>
      </label>
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}

// 18 nov. 2026 (soir) : NOTIFICATION sur l'iPhone à chaque nouvelle demande (icône « Rebecca admin »)
const enOctets = (t) => {
  const b = atob((t + "=".repeat((4 - (t.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const enTexte = (buf) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");
function infosTelephone() {
  const ua = navigator.userAgent || "";
  return {
    ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
    standalone: navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches),
    push: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    permission: "Notification" in window ? Notification.permission : "default",
    appareil: /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : "Ordinateur",
  };
}

function NotificationsTelephone() {
  const [a, setA] = useState(null);
  const [nb, setNb] = useState(0);
  const [ceTel, setCeTel] = useState(false);
  const [info, setInfo] = useState("");
  const [occupe, setOccupe] = useState(false);
  const t = infosTelephone();
  const etat = etatTelephone(t);
  useEffect(() => onSnapshot(doc(db, "reglages", "alerteDemandes"), (s) => setA(s.exists() ? s.data() : {}), () => setA({})), []);
  useEffect(() => onSnapshot(collection(db, "notificationsPush"), (s) => setNb(s.size), () => setNb(0)), []);
  useEffect(() => {
    if (!t.push) return;
    navigator.serviceWorker.getRegistration("/").then((r) => (r ? r.pushManager.getSubscription() : null)).then((s) => setCeTel(!!s)).catch(() => {});
  }, []);
  if (!a) return null;

  const activer = async () => {
    setInfo(""); setOccupe(true);
    try {
      const permission = await Notification.requestPermission(); // en premier : l'iPhone exige un toucher
      if (permission !== "granted") throw new Error("refus");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const ancien = await reg.pushManager.getSubscription();
      const abo = ancien || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: enOctets(VAPID_PUBLIQUE) }));
      await setDoc(doc(db, "notificationsPush", idAbonnement(abo.endpoint)), {
        endpoint: abo.endpoint, p256dh: enTexte(abo.getKey("p256dh")), auth: enTexte(abo.getKey("auth")), appareil: t.appareil, creeLe: serverTimestamp(),
      });
      await setDoc(doc(db, "reglages", "alerteDemandes"), { notifications: true, majLe: serverTimestamp() }, { merge: true });
      setCeTel(true);
      setInfo("Activées ✓ Touche « Envoyer un test » pour vérifier.");
    } catch (e) {
      setInfo(e.message === "refus" ? "Tu as refusé les notifications. Pour les autoriser : Réglages de l'iPhone → Notifications → Rebecca admin." : "Activation impossible (règles Firebase v23 collées ?).");
    }
    setOccupe(false);
  };
  const retirer = async () => {
    setInfo("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const abo = reg && (await reg.pushManager.getSubscription());
      if (abo) { await deleteDoc(doc(db, "notificationsPush", idAbonnement(abo.endpoint))); await abo.unsubscribe(); }
      setCeTel(false); setInfo("Ce téléphone ne reçoit plus les notifications.");
    } catch { setInfo("Impossible de retirer ce téléphone."); }
  };
  const basculer = () => setDoc(doc(db, "reglages", "alerteDemandes"), { notifications: !(a.notifications === true), majLe: serverTimestamp() }, { merge: true }).catch(() => setInfo("Enregistrement impossible."));
  const tester = () => setDoc(doc(db, "reglages", "alerteDemandes"), { testDemande: new Date().toISOString(), majLe: serverTimestamp() }, { merge: true })
    .then(() => setInfo("Test demandé : la notification arrive dans 2 minutes maximum (même téléphone verrouillé).")).catch(() => setInfo("Enregistrement impossible."));

  return (
    <div className="tb-bloc">
      <h3>📲 Notifications sur mon téléphone</h3>
      <p className="tb-note">À chaque nouvelle demande du site, une notification arrive sur l'écran verrouillé (2 minutes maximum). Tu la touches : ton espace s'ouvre.</p>
      {etat === "icone" && <p className="tb-note">Sur iPhone, les notifications marchent seulement depuis l'icône : dans Safari, ouvre rebeccaservices.com/admin, touche Partager → « Sur l'écran d'accueil », puis ouvre l'icône « Rebecca admin » et reviens ici.</p>}
      {etat === "impossible" && <p className="tb-note">Ce navigateur ne permet pas les notifications. Sur iPhone : iOS 16.4 ou plus récent, depuis l'icône de l'écran d'accueil.</p>}
      {etat === "refuse" && <p className="tb-note">Les notifications sont refusées sur ce téléphone : Réglages de l'iPhone → Notifications → Rebecca admin → Autoriser.</p>}
      {etat === "pret" && !ceTel && <button className="tb-bouton" disabled={occupe} onClick={activer}>🔔 Recevoir les notifications sur ce téléphone</button>}
      {etat === "pret" && ceTel && <p className="tb-note">✓ Ce téléphone reçoit les notifications. <button className="tb-bouton tb-clair" onClick={retirer}>Retirer ce téléphone</button></p>}
      <label className="rg-case">
        <input type="checkbox" checked={a.notifications === true} onChange={basculer} />
        <span>{a.notifications === true ? `Activées (${nb} téléphone${nb > 1 ? "s" : ""})` : "Désactivées"}</span>
      </label>
      {a.notifications === true && nb > 0 && <button className="tb-bouton tb-clair" onClick={tester}>Envoyer un test</button>}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}

export default function ReglagesAuto() {
  const [r, setR] = useState(null);
  const [robot, setRobot] = useState(null);
  const [info, setInfo] = useState("");
  const [cree, setCree] = useState(null);
  useEffect(() => onSnapshot(doc(db, "reglages", "rappelsAuto"), (s) => setR(s.exists() ? s.data() : {}), () => setR({})), []);
  useEffect(() => onSnapshot(doc(db, "reglages", "robot"), (s) => setRobot(s.exists() ? s.data() : {}), () => setRobot({})), []);

  const basculer = () => setDoc(doc(db, "reglages", "rappelsAuto"), { actif: !(r && r.actif === true), majLe: serverTimestamp() }, { merge: true }).catch(() => setInfo("Enregistrement impossible (règles Firebase v19 ?)."));
  const creerRobot = async () => {
    setInfo("");
    const mdp = motDePasseRobot();
    try {
      // Compte cree par l'API (Rebecca reste connectee) : seulement e-mail + mot de passe, jamais ecrit dans le code
      const rep = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CLE_API}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL_ROBOT, password: mdp, returnSecureToken: true }),
      });
      const data = await rep.json();
      if (!rep.ok) throw new Error(data && data.error && data.error.message === "EMAIL_EXISTS" ? "existe" : "refus");
      await setDoc(doc(db, "robots", data.localId), { actif: true, email: EMAIL_ROBOT, creeLe: serverTimestamp() });
      await setDoc(doc(db, "reglages", "robot"), { uid: data.localId, email: EMAIL_ROBOT, creeLe: serverTimestamp() });
      setCree({ email: EMAIL_ROBOT, mdp });
    } catch (e) {
      setInfo(e.message === "existe" ? "Le compte robot existe déjà. Si tu as perdu son mot de passe, supprime-le dans Firebase → Authentication, puis recommence." : "Création impossible. Vérifie la connexion et les règles Firebase v19.");
    }
  };
  if (!r || !robot) return null;
  const passage = r.dernierPassage ? new Date(r.dernierPassage).toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <>
    <NotificationsTelephone />
    <AlerteDemandes />
    <div className="tb-bloc">
      <h3>Rappels envoyés tout seuls</h3>
      <p className="tb-note">Chaque soir vers 19h, un e-mail part tout seul aux clientes qui ont un retour d'aller-retour ou un rendez-vous beauté le lendemain. WhatsApp reste à envoyer toi-même dans « Aujourd'hui » : il ne peut pas partir sans toi. L'e-mail n'est jamais envoyé deux fois.</p>
      <label className="rg-case">
        <input type="checkbox" checked={r.actif === true} onChange={basculer} />
        <span>{r.actif === true ? "Activés" : "Désactivés"}</span>
      </label>
      {passage ? <p className="tb-note">Dernier passage : {passage} · {r.detail || ""}</p> : <p className="tb-note">Pas encore de passage.</p>}

      <p className="aj-sous-titre">Réglage à faire une seule fois</p>
      <ol className="tb-note" style={{ paddingLeft: 18 }}>
        <li>
          {robot.uid ? `✅ Compte robot créé (${robot.email}).` : "Crée le compte robot :"}{" "}
          {!robot.uid && <button className="tb-bouton" onClick={creerRobot}>Créer le compte robot</button>}
        </li>
        {cree && (
          <li>
            <strong>Copie ces deux valeurs maintenant</strong> (le mot de passe ne sera plus affiché) :<br />
            ROBOT_EMAIL = <code style={{ userSelect: "all" }}>{cree.email}</code><br />
            ROBOT_MDP = <code style={{ userSelect: "all" }}>{cree.mdp}</code>
          </li>
        )}
        <li>Sur emailjs.com → Account → Security : coche « Allow EmailJS API for non-browser applications ». Puis Account → API keys : copie la « Private Key ».</li>
        <li>Sur Netlify → rebecca-services-netanya → Project configuration → Environment variables → Add a variable, trois fois : ROBOT_EMAIL, ROBOT_MDP et EMAILJS_PRIVEE (la Private Key).</li>
        <li>Publie le site une fois (Deploys → Trigger deploy), puis coche « Activés » ci-dessus.</li>
      </ol>
      {info && <p className="tb-note">{info}</p>}
    </div>
    </>
  );
}
