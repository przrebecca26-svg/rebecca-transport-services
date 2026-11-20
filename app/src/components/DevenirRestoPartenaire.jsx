import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import AddressField from "./AddressField.jsx";
import SignatureDoigt from "./SignatureDoigt.jsx";
import ChoixJoursHeures from "./ChoixJoursHeures.jsx";
import { telBloque } from "../pagesSiteBase.js";
import { SITE } from "../site.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { envoyerEmailA } from "../mailClient.js";
import { partagerPdf } from "../pricing/pdfSimple.js";
import { MIN_HEURES, tableauMinimums } from "../pricing/creneauxResto.js";
import { grilleKm } from "../pricing/commercants.js";
import {
  EMAIL_REBECCA, FORMES, FORMULES_RESTO, MOYENS, articlesContrat, contratPdf, contratPropre, emailContrat, erreursFormulaire,
  formulaireVide, numeroContrat, tarifsStandard,
} from "../pricing/contratResto.js";
import "../partenariat.css";

// DEVENIR RESTAURANT PARTENAIRE (19 nov. 2026, Rebecca) - page publique #/restaurant-partenaire, le même lien pour
// tous les restaurants. 1) Présentation de Rebecca Services et de ses activités ; 2) le partenariat livraison
// (avantages, fonctionnement, formules et prix) ; 3) les conditions complètes ; 4) le formulaire, la formule, la
// signature au doigt ; 5) contrat envoyé par e-mail au restaurant et à Rebecca, fiche créée chez Rebecca.
const WHATSAPP = "972547380193";
const SERVICES = [
  { logo: null, icone: "🛵", titre: "Coursier et livraisons", texte: "Colis, documents, clés, courses, livraisons de restaurants." },
  { logo: null, icone: "🚗", titre: "Transport privé et aéroport", texte: "Trajets, transferts Ben Gourion, ramassage scolaire." },
  { logo: "/brand/logo-nails-prestige.png", titre: "Beauté", texte: "Nails Prestige, Prestige Hair, Slim & Lift, RegenX." },
  { logo: "/brand/logo-epoxy.png", titre: "Boutique Epoxy", texte: "Créations artisanales en résine." },
  { logo: "/brand/logo-digital-applications.png", titre: "Digital & Applications", texte: "Sites et applications pour les professionnels." },
];
const AVANTAGES = [
  ["💰", "Un prix fixe par livraison", "Aucun pourcentage sur vos commandes, aucun abonnement obligatoire."],
  ["📲", "Votre espace en ligne", "Vous envoyez une livraison en 30 secondes ; vous voyez ma réponse en direct."],
  ["📍", "Suivi et preuve", "Heure d'arrivée, suivi de la voiture, photo de remise si le client est absent."],
  ["🧾", "Un relevé clair chaque semaine", "Toutes les livraisons, le total et ce qui est payé : les mêmes chiffres des deux côtés."],
  ["🤝", "Vos clients restent les vôtres", "Je livre en votre nom et je ne démarche jamais vos clients."],
  ["🔓", "Un mois d'essai", "Pendant le mois d'essai, vous arrêtez quand vous voulez ; ensuite, résiliation possible avec 7 jours de préavis."],
];
const lienContrat = (id) => `${SITE}/#/contrat-resto/${id}`;
const maintenantIsrael = () => {
  const d = new Date();
  const jour = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const heure = d.toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
  return `${jour}T${heure}`;
};

export default function DevenirRestoPartenaire({ onAccueil }) {
  const [etape, setEtape] = useState("presentation");
  const [reglage, setReglage] = useState(null);
  const [lu, setLu] = useState(false);
  const [f, setF] = useState(formulaireVide());
  const [signature, setSignature] = useState("");
  const [erreurs, setErreurs] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [fini, setFini] = useState(null); // { id, c, mails }
  useEffect(() => onSnapshot(doc(db, "reglages", "restos"), (s) => setReglage(s.exists() ? s.data() : {}), () => setReglage({})), []);
  const tarifs = tarifsStandard(reglage);
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const aller = (e) => {
    setEtape(e);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signer = async () => {
    const e = erreursFormulaire(f, signature);
    setErreurs(e);
    if (e.length) return;
    // 20 nov. 2026 : numéro bloqué par Rebecca (Réglages -> Pages du site) : message neutre
    if ((await telBloque("restoPartenaire", f.telephone).catch(() => false)) || (await telBloque("restoPartenaire", f.portable).catch(() => false))) {
      setErreurs(["Ce service n'est pas disponible pour le moment. Écrivez à Rebecca sur WhatsApp."]);
      return;
    }
    setEnCours(true);
    try {
      const ref = doc(collection(db, "contratsRestos"));
      const c = contratPropre(f, tarifs, signature);
      await setDoc(ref, { ...c, signeLe: serverTimestamp() });
      const signe = { ...c, signeLe: maintenantIsrael() };
      // Notification tout de suite sur le téléphone de Rebecca
      fetch("/.netlify/functions/contrat-resto", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ref.id }) }).catch(() => {});
      // Le contrat par e-mail : au restaurant et à Rebecca
      const texte = emailContrat(signe, ref.id, lienContrat(ref.id));
      const sujet = `Contrat de partenariat livraison ${numeroContrat(ref.id, signe.signeLe)} - Rebecca Services`;
      // EmailJS refuse deux envois dans la même seconde (19 nov. : seul le double de Rebecca était parti) :
      // d'abord le restaurant, puis Rebecca 1,5 s plus tard
      const a = await envoyerEmailA(c.email, c.responsable, sujet, texte);
      await new Promise((r) => setTimeout(r, 1500));
      const b = await envoyerEmailA(EMAIL_REBECCA, "Rebecca", `🤝 ${c.nom} a signé · ${sujet}`, texte);
      setFini({ id: ref.id, c: signe, mails: a && b, mailResto: a });
      aller("merci");
    } catch {
      setErreurs(["L'envoi n'a pas marché. Vérifiez la connexion et réessayez, ou écrivez-moi sur WhatsApp."]);
    }
    setEnCours(false);
  };

  return (
    <div className="pp">
      <header className="pp-entete">
        <img src="/brand/logo-medaillon%20.png" alt="Rebecca Services" className="pp-logo" />
        <div>
          <h1>Rebecca Services</h1>
          <p>Votre temps est précieux, je vous aide à en profiter.</p>
        </div>
      </header>

      {etape === "presentation" && (
        <>
          <section className="pp-bloc pp-hero">
            <p className="pp-sur">Netanya et alentours</p>
            <h2>Devenez restaurant partenaire</h2>
            <p>Je livre vos commandes à vos clients, avec soin, à un prix fixe et sans commission sur vos ventes.</p>
            <button type="button" className="pp-bouton" onClick={() => document.getElementById("pp-partenariat").scrollIntoView({ behavior: "smooth" })}>Découvrir le partenariat</button>
          </section>

          <section className="pp-bloc">
            <h3>Qui suis-je ?</h3>
            <p>Je m'appelle Rebecca. Rebecca Services, c'est une entreprise de services basée à Netanya, qui vous fait gagner du temps au quotidien.</p>
            <div className="pp-services">
              {SERVICES.map((s) => (
                <div key={s.titre} className="pp-service">
                  {s.logo ? <img src={s.logo} alt="" /> : <span className="pp-icone">{s.icone}</span>}
                  <div><b>{s.titre}</b><small>{s.texte}</small></div>
                </div>
              ))}
            </div>
          </section>

          <section className="pp-bloc" id="pp-partenariat">
            <h3>Le partenariat livraison</h3>
            <div className="pp-avantages">
              {AVANTAGES.map(([i, t, d]) => (
                <div key={t} className="pp-avantage"><span>{i}</span><div><b>{t}</b><small>{d}</small></div></div>
              ))}
            </div>
          </section>

          <section className="pp-bloc">
            <h3>Comment ça marche</h3>
            <ol className="pp-etapes">
              <li><b>Vous recevez une commande</b> (téléphone, WhatsApp, sur place).</li>
              <li><b>Vous me l'envoyez</b> depuis votre espace : le client, l'adresse, l'heure où elle sera prête.</li>
              <li><b>Je l'accepte et je la livre</b> ; vous suivez tout en direct. Le dimanche, vous payez le relevé de la semaine.</li>
            </ol>
          </section>

          <section className="pp-bloc">
            <h3>Les formules</h3>
            <div className="pp-formules">
              {FORMULES_RESTO.filter((x) => x.v !== "AB").map((x) => (
                <div key={x.v} className="pp-formule">
                  <b>{x.titre}</b>
                  <p>{x.resume}</p>
                  <ul>
                    <li>Jusqu'à 3 km : <strong>{tarifs[x.v].jusqua3} ₪</strong></li>
                    <li>De 3 à 6 km : <strong>{tarifs[x.v].de3a6} ₪</strong></li>
                    <li>De 6 à 9 km : <strong>{grilleKm(tarifs[x.v])[2].prix} ₪</strong> · de 9 à 12 km : <strong>{grilleKm(tarifs[x.v])[3].prix} ₪</strong></li>
                    <li>Commande en plus dans la même tournée : <strong>{tarifs[x.v].enPlus} ₪</strong> <small>(même restaurant, prête à 10 minutes près ; la livraison la plus chère compte comme principale)</small></li>
                    <li>Article très lourd (pack d'eau, carton lourd) : <strong>+{tarifs[x.v].tresLourd} ₪</strong> · sacs ordinaires sans supplément</li>
                    {x.v === "B" && <li>Minimum : <strong>{tarifs.B.parHeure} ₪ par heure de créneau</strong>, créneau de {MIN_HEURES} h au moins ({MIN_HEURES * tarifs.B.parHeure} ₪)</li>}
                    <li>Au-delà de 12 km : sur devis, accepté avant le départ{x.v === "B" ? " (compte dans le minimum du créneau)" : ""}</li>
                  </ul>
                </div>
              ))}
              {FORMULES_RESTO.filter((x) => x.v === "AB").map((x) => (
                <div key={x.v} className="pp-formule">
                  <b>{x.titre}</b>
                  <p>{x.resume}</p>
                  <ul>
                    <li>Pendant vos créneaux réservés : <strong>prix B</strong> ({tarifs.B.jusqua3} ₪ jusqu'à 3 km…) et minimum de {tarifs.B.parHeure} ₪ par heure de créneau</li>
                    <li>En dehors de vos créneaux : <strong>prix A</strong> ({tarifs.A.jusqua3} ₪ jusqu'à 3 km…), sans minimum, sous réserve de disponibilité</li>
                    <li>Exemple : jeudi 19h-22h en B, le reste de la semaine à la demande en A</li>
                  </ul>
                </div>
              ))}
            </div>
            <div className="pp-formule" style={{ marginTop: 12 }}>
              <b>Formule B : le minimum par créneau</b>
              <p>Un créneau dure {MIN_HEURES} heures au moins. Chaque créneau réservé a un minimum de facturation de {tarifs.B.parHeure} ₪ par heure. Les livraisons faites pendant le créneau comptent dans ce minimum, à leur vrai prix ; si leur montant dépasse le minimum, seul leur montant réel est facturé.</p>
              <table className="pp-table">
                <thead><tr><th>Durée</th><th>Minimum</th><th>Équivaut à</th><th>Au-delà</th></tr></thead>
                <tbody>
                  {tableauMinimums(tarifs.B.parHeure, tarifs.B.jusqua3).map((l) => (
                    <tr key={l.heures}><td>{l.heures} h</td><td><strong>{l.minimum} ₪</strong></td><td>{Number.isInteger(l.livraisons) ? l.livraisons : `${Math.floor(l.livraisons)} ou ${Math.ceil(l.livraisons)}`} livraisons</td><td>dès {l.auDela} : {l.auDelaMontant} ₪</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="pp-note">Créneaux à la demi-heure possibles : 2 h 30 = {String(2.5 * tarifs.B.parHeure).replace(".", ",")} ₪. Deux créneaux qui se touchent ou se chevauchent le même jour comptent comme un seul créneau. Le tableau compte des livraisons à {tarifs.B.jusqua3} ₪ (jusqu'à 3 km) : ce sont des exemples, seul le minimum par heure compte. « Au-delà » : à partir de ce nombre de livraisons, vous payez simplement vos livraisons.</p>
              <p>Exemples pour un créneau de {MIN_HEURES} heures :</p>
              <ul>
                {[0, 2, 5].map((n) => <li key={n}>{n} livraison{n > 1 ? "s" : ""}{n ? ` à ${tarifs.B.jusqua3} ₪` : ""} : <strong>{Math.max(n * tarifs.B.jusqua3, MIN_HEURES * tarifs.B.parHeure)} ₪</strong></li>)}
                <li>5 livraisons à {tarifs.B.de3a6} ₪ : <strong>{Math.max(5 * tarifs.B.de3a6, MIN_HEURES * tarifs.B.parHeure)} ₪</strong></li>
                <li>6 livraisons à {tarifs.B.jusqua3} ₪ : <strong>{Math.max(6 * tarifs.B.jusqua3, MIN_HEURES * tarifs.B.parHeure)} ₪</strong></li>
              </ul>
              <p>Le minimum n'est jamais ajouté une seconde fois au montant des livraisons. Toute annulation d'un créneau réservé moins de 24 heures avant son début (heure d'Israël) entraîne la facturation du minimum garanti du créneau ; annulé 24 heures ou plus avant, rien n'est facturé. Si Rebecca Services ne peut pas assurer un créneau, elle vous prévient au plus vite et le minimum de ce créneau n'est pas facturé : vous ne payez que les livraisons faites.</p>
              <p>Pendant les créneaux réservés et confirmés, Rebecca Services organise la disponibilité d'un livreur pour vos commandes, dans les limites de la zone desservie et des capacités opérationnelles convenues. Les horaires de prise en charge sont confirmés selon le volume de commandes et les conditions de circulation.</p>
            </div>
            <p className="pp-note">Prix fixes, sans TVA (osek patur). Aucune livraison pendant Chabbat et les fêtes.</p>
          </section>

          <section className="pp-bloc pp-centre">
            <button type="button" className="pp-bouton" onClick={() => aller("conditions")}>Lire les conditions et devenir partenaire</button>
            <a className="pp-lien" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, j'ai une question sur le partenariat livraison pour mon restaurant.")} target="_blank" rel="noopener noreferrer">💬 Une question ? Écrivez-moi sur WhatsApp</a>
          </section>
        </>
      )}

      {etape === "conditions" && (
        <section className="pp-bloc">
          <button type="button" className="pp-retour" onClick={() => aller("presentation")}>← Retour à la présentation</button>
          <h2>Les conditions du partenariat</h2>
          <p className="pp-note">Voici le contrat complet. Vos informations (nom, numéro, formule, prix) y seront ajoutées à l'étape suivante, avant la signature.</p>
          {articlesContrat({ ...contratPropre({ ...f, nom: "[votre restaurant]", nomLegal: "[nom légal]", numero: "", responsable: "[responsable]", telephone: "[téléphone]", portable: "[portable]", email: "[e-mail]", adresse: { label: "[adresse du restaurant]" } }, tarifs, ""), numero: "[n°]" }).map((a) => (
            <details key={a.titre} className="pp-article">
              <summary>{a.titre}</summary>
              {a.lignes.map((l, i) => <p key={i}>{l}</p>)}
            </details>
          ))}
          <label className="pp-case">
            <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} /> J'ai lu les conditions et je les accepte.
          </label>
          <button type="button" className="pp-bouton" disabled={!lu} onClick={() => aller("formulaire")}>J'accepte, je deviens partenaire</button>
        </section>
      )}

      {etape === "formulaire" && (
        <section className="pp-bloc">
          <button type="button" className="pp-retour" onClick={() => aller("conditions")}>← Retour aux conditions</button>
          <h2>Votre inscription</h2>

          <p className="pp-note"><span className="pp-oblig">*</span> champ obligatoire</p>
          <h3>1. Votre formule</h3>
          <div className="pp-formules">
            {FORMULES_RESTO.map((x) => (
              <button key={x.v} type="button" className={"pp-formule pp-choix" + (f.formule === x.v ? " actif" : "")} aria-pressed={f.formule === x.v} onClick={() => maj("formule", x.v)}>
                <b>{f.formule === x.v ? "✓ " : ""}{x.titre}</b>
                <small>{x.v === "AB" ? `Créneaux au prix B (${tarifs.B.jusqua3} ₪ jusqu'à 3 km, minimum ${tarifs.B.parHeure} ₪ par heure) · hors créneaux au prix A (${tarifs.A.jusqua3} ₪ jusqu'à 3 km)` : `${tarifs[x.v].jusqua3} ₪ jusqu'à 3 km · ${tarifs[x.v].de3a6} ₪ de 3 à 6 km${x.v === "B" ? ` · minimum ${tarifs.B.parHeure} ₪ par heure de créneau (${MIN_HEURES} h au moins) · hors créneaux : prix A` : ""}`}</small>
              </button>
            ))}
          </div>
          {(f.formule === "B" || f.formule === "AB") && (
            <div className="pp-champ"><span>Vos créneaux réservés (2 h au moins) <span className="pp-oblig">*</span></span>
              <ChoixJoursHeures valeur={f.creneaux} onChange={(v) => maj("creneaux", v)} minHeures={2} />
            </div>
          )}
          <label className="pp-champ">Paiement du relevé, chaque dimanche, par
            <select value={f.moyen} onChange={(e) => maj("moyen", e.target.value)}>{MOYENS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>

          <h3>2. Votre restaurant</h3>
          <label className="pp-champ">Nom du restaurant <span className="pp-oblig">*</span><input type="text" maxLength={60} value={f.nom} onChange={(e) => maj("nom", e.target.value)} /></label>
          <label className="pp-champ">Nom légal (celui de l'osek ou de la société) <span className="pp-oblig">*</span><input type="text" maxLength={120} value={f.nomLegal} onChange={(e) => maj("nomLegal", e.target.value)} /></label>
          <label className="pp-champ">Forme de l'entreprise <span className="pp-oblig">*</span>
            <select value={f.forme} onChange={(e) => maj("forme", e.target.value)}>{FORMES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
          </label>
          <label className="pp-champ">Numéro de l'entreprise (ח.פ / עוסק) <span className="pp-oblig">*</span><input type="text" inputMode="numeric" maxLength={12} value={f.numero} onChange={(e) => maj("numero", e.target.value)} /></label>
          <div className="pp-champ"><span>Adresse du restaurant (où je récupère les commandes) <span className="pp-oblig">*</span></span>
            <AddressField id="pp-adresse" valeur={f.adresse} position={false} onChange={(v) => maj("adresse", v)} />
          </div>
          <label className="pp-champ">Où récupérer les commandes (comptoir, porte de derrière, parking…)<input type="text" maxLength={200} value={f.recuperation} onChange={(e) => maj("recuperation", e.target.value)} /></label>
          <div className="pp-champ"><span>Horaires d'ouverture (les jours non choisis = fermé)</span>
            <ChoixJoursHeures valeur={f.horaires} onChange={(v) => maj("horaires", v)} minHeures={0} ajout="+ Ajouter des horaires" defaut={{ de: 0, a: 4, debut: "11:00", fin: "23:00" }} />
          </div>
          <label className="pp-champ">Téléphone du restaurant <span className="pp-oblig">*</span><input type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} /></label>

          <h3>3. Le responsable</h3>
          <label className="pp-champ">Nom et prénom <span className="pp-oblig">*</span><input type="text" maxLength={60} value={f.responsable} onChange={(e) => maj("responsable", e.target.value)} /></label>
          <label className="pp-champ">Fonction (gérant, propriétaire…)<input type="text" maxLength={60} value={f.fonction} onChange={(e) => maj("fonction", e.target.value)} /></label>
          <label className="pp-champ">Portable <span className="pp-oblig">*</span><input type="tel" inputMode="tel" maxLength={20} value={f.portable} onChange={(e) => maj("portable", e.target.value)} /></label>
          <label className="pp-champ">E-mail (le contrat y sera envoyé) <span className="pp-oblig">*</span><input type="email" inputMode="email" maxLength={120} value={f.email} onChange={(e) => maj("email", e.target.value)} /></label>

          <h3>4. Signature</h3>
          <label className="pp-champ">Nom de la personne qui signe <span className="pp-oblig">*</span><input type="text" maxLength={60} value={f.signataire} onChange={(e) => maj("signataire", e.target.value)} /></label>
          <p className="pp-note">Signez avec le doigt dans le cadre :</p>
          <SignatureDoigt valeur={signature} onChange={setSignature} />
          <p className="pp-note">En signant, vous acceptez le contrat de partenariat livraison et ses conditions. Vous et Rebecca Services en recevez une copie par e-mail.</p>
          {erreurs.length > 0 && <ul className="pp-erreurs" role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>}
          <button type="button" className="pp-bouton" disabled={enCours} onClick={signer}>{enCours ? "Envoi…" : "✍️ Signer et envoyer"}</button>
        </section>
      )}

      {etape === "merci" && fini && (
        <section className="pp-bloc pp-centre">
          <h2>Merci, c'est signé ! 🤝</h2>
          <p>Bienvenue chez les partenaires de Rebecca Services, {fini.c.responsable}.</p>
          <p className="pp-note">Contrat n° {numeroContrat(fini.id, fini.c.signeLe)}. {fini.mailResto ? `Une copie vient d'être envoyée à ${fini.c.email}. Pas reçue dans quelques minutes ? Regardez dans les spams (courrier indésirable).` : "L'e-mail n'a pas pu partir : gardez une copie avec le bouton ci-dessous."}</p>
          <button type="button" className="pp-bouton" onClick={() => partagerPdf(contratPdf(fini.c, fini.id), `Contrat-${numeroContrat(fini.id, fini.c.signeLe)}.pdf`, "Contrat de partenariat")}>📄 Télécharger le contrat (PDF)</button>
          <a className="pp-lien" href={`#/contrat-resto/${fini.id}`}>Voir le contrat en ligne</a>
          <p>Prochaine étape : je valide votre inscription et je vous envoie sur WhatsApp le lien de votre espace, pour m'envoyer vos livraisons.</p>
        </section>
      )}

      <footer className="pp-pied">
        <button type="button" className="pp-lien" onClick={onAccueil}>rebeccaservices.com</button>
        <span>Rebecca Services · Netanya · 054-738-0193</span>
      </footer>
    </div>
  );
}
