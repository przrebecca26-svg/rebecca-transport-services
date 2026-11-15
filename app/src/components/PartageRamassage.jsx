import { useEffect, useMemo, useState } from "react";
import Devis from "./Devis.jsx";
import IconeService from "./IconeService.jsx";
import Enfant from "./EnfantRamassage.jsx";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { useFermetures } from "../fermetures.js";
import { MAX_ENFANTS, enfantVide, manquePlan, planVide, libellePeriode } from "../pricing/ramassagePlanning.js";
import { prixFr } from "../pricing/partage.js";
import { calculerPartage, lienPartage, messagePartage, nomPartage, remplirFamille, enfantPropre, STATUTS_PARTAGE } from "../pricing/partageRamassage.js";
import { useRoutes } from "./DemandeRamassage.jsx";
import "../client-commun.css";
import "../ramassage-site.css";

// LIEN PERSONNEL D'UNE FAMILLE (15 nov. 2026) : #/partage/<identifiant>/<numero de la famille>.
// La famille voit le trajet partage, complete ou corrige SES enfants et leurs horaires, et voit le nouveau devis.
// Ensuite, un bouton par famille pour prevenir les autres sur WhatsApp avec le nouveau devis.

const jourDeLaDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

export default function PartageRamassage({ id, famille, onRetour }) {
  const reglages = useFermetures();
  const [doc, setDoc] = useState(null);
  const [etat, setEtat] = useState("chargement");
  const [enfants, setEnfants] = useState([]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [info, setInfo] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    let actif = true;
    let arret = () => {};
    Promise.all([import("../firebase.js"), import("firebase/firestore")]).then(([{ db }, { doc: refDoc, onSnapshot }]) => {
      if (!actif) return;
      arret = onSnapshot(
        refDoc(db, "trajetsPartages", id),
        (s) => {
          if (!s.exists()) return setEtat("introuvable");
          const d = s.data();
          setDoc(d);
          setEtat("ok");
        },
        () => setEtat("introuvable")
      );
    });
    return () => {
      actif = false;
      arret();
    };
  }, [id]);

  // Premiere lecture : les enfants de MA famille dans le formulaire
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (!doc || pret || !doc.familles[famille]) return;
    const f = doc.familles[famille];
    setEnfants(f.enfants.length ? f.enfants.map((e) => ({ ...enfantVide(), ...e })) : [enfantVide()]);
    setNom(f.nom || "");
    setTelephone(f.telephone || "");
    setPret(true);
  }, [doc, famille, pret]);

  // Le devis avec MES enfants tels que je les saisis (les autres familles : ce qui est enregistre)
  const brouillon = useMemo(() => (doc && doc.familles[famille] ? { ...doc, familles: doc.familles.map((f, i) => (i === famille ? { ...f, nom, telephone, enfants, rempli: true } : f)) } : null), [doc, famille, enfants, nom, telephone]);
  const planRoutes = useMemo(() => (brouillon ? { ...planVide(), domicile: brouillon.commun.domicile, ecole: brouillon.commun.ecole, enfants: brouillon.familles.flatMap((f) => f.enfants) } : planVide()), [brouillon]);
  const { routes, statut } = useRoutes(planRoutes);
  const calcul = useMemo(() => (brouillon && statut === "ok" ? calculerPartage(brouillon, routes) : null), [brouillon, routes, statut, reglages]);

  if (etat === "chargement") return <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;
  if (etat !== "ok" || !doc.familles[famille]) {
    return (
      <div className="formulaire">
        <div className="bloc"><p>Ce lien n'est plus valable. Demandez un nouveau lien à la famille qui vous l'a envoyé, ou écrivez à Rebecca.</p></div>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, mon lien de trajet partagé ne marche pas.")} target="_blank" rel="noopener noreferrer">Écrire à Rebecca</a>
        <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
      </div>
    );
  }

  const enCours = doc.statut === "en cours";
  const monPlan = { ...planVide(), ...doc.commun, enfants };
  const manque = manquePlan(monPlan);
  const resultat = calcul && calcul.resultat && calcul.resultat.ok ? calcul.resultat : null;
  const origine = window.location.origin + window.location.pathname;
  const jourUnique = jourDeLaDate(doc.commun.date);

  const enregistrer = async () => {
    if (manque) return setInfo(manque);
    if (!String(nom).trim()) return setInfo("Indiquez le nom de votre famille.");
    try {
      const [{ db }, { doc: refDoc, updateDoc, serverTimestamp }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
      const maj = remplirFamille(doc, famille, { enfants: enfants.map(enfantPropre), nom: String(nom).trim().slice(0, 60), telephone: String(telephone).trim().slice(0, 20) });
      await updateDoc(refDoc(db, "trajetsPartages", id), { familles: maj.familles, majLe: serverTimestamp() });
      setEnregistre(true);
      setInfo("Enregistré ! Le devis est recalculé pour toutes les familles. Prévenez-les avec les boutons ci-dessous.");
    } catch {
      setInfo("Enregistrement impossible pour l'instant. Vérifiez votre connexion et réessayez.");
    }
  };

  const regler = (n) => setEnfants((l) => {
    const x = l.slice(0, n);
    while (x.length < n) x.push(enfantVide());
    return x;
  });

  return (
    <div className="formulaire rs-form">
      <header className="titre-service">
        <span aria-hidden="true"><IconeService id="ramassage" taille={40} /></span>
        <h2>Ramassage scolaire partagé</h2>
      </header>
      <div className="bloc">
        <p><strong>{doc.familles.length} familles</strong> partagent les trajets · {STATUTS_PARTAGE[doc.statut] || doc.statut}</p>
        {doc.commun.domicile && <p className="note">Domicile : {doc.commun.domicile.label}</p>}
        {doc.commun.ecole && <p className="note">École : {doc.commun.ecole.label}</p>}
        <p className="note">Partage de la note : {doc.modePartage === "egal" ? "parts égales" : "par enfant (chaque famille paie pour ses enfants)"}</p>
        <ul className="rs-familles">
          {doc.familles.map((f, i) => (
            <li key={i}>
              <span>{nomPartage(doc, i)}{i === famille ? " (vous)" : ""}</span>
              <b>{f.enfants.length ? `${f.enfants.length} enfant${f.enfants.length > 1 ? "s" : ""}` : "en attente"}{calcul && calcul.parFamille[i].montant != null ? ` · ${prixFr(calcul.parFamille[i].montant)} ₪` : ""}</b>
            </li>
          ))}
        </ul>
      </div>

      {enCours ? (
        <>
          <div className="bloc">
            <h3>Votre famille</h3>
            <label htmlFor="rs-p-nom">Nom</label>
            <input id="rs-p-nom" type="text" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
            <label htmlFor="rs-p-tel">Téléphone (WhatsApp)</label>
            <input id="rs-p-tel" type="tel" inputMode="tel" maxLength={20} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            <span className="indice">Nombre d'enfants</span>
            <div className="choix rs-quatre" role="group" aria-label="Nombre d'enfants">
              {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button" className={enfants.length === n ? "actif" : ""} aria-pressed={enfants.length === n} onClick={() => regler(n)}>{n}</button>
              ))}
            </div>
          </div>
          {enfants.map((e, i) => (
            <Enfant key={i} site enfant={e} index={i} periode={doc.commun.periode} jourUnique={jourUnique} changer={(n) => setEnfants((l) => l.map((x, j) => (j === i ? n : x)))} />
          ))}
        </>
      ) : (
        <div className="bloc"><p>Rebecca a {doc.statut === "acceptee" ? "accepté" : "répondu à"} ce trajet partagé : il ne se modifie plus ici. Pour un changement, écrivez-lui.</p></div>
      )}

      <Devis resultat={manque ? null : resultat} trajet={statut === "chargement" ? { statut: "chargement" } : null} pretPourCalcul={!manque} manque={manque} />
      {resultat && calcul && (
        <section className="devis attente">
          <p className="note">Devis {libellePeriode(calcul.plan, resultat)}.</p>
          <p className="note"><strong>Votre part : {calcul.parFamille[famille].montant != null ? `${prixFr(calcul.parFamille[famille].montant)} ₪` : "—"}</strong></p>
          {calcul.parFamille.filter((p) => p.montant == null).map((p, i) => <p className="note" key={i}>• {p.nom} : en attente de ses enfants (prix provisoire).</p>)}
        </section>
      )}

      {info && <p className="note" role="status">{info}</p>}
      {enCours && (
        <div className="barre-envoi">
          <div className="barre-prix">{calcul && calcul.parFamille[famille].montant != null ? <strong>{prixFr(calcul.parFamille[famille].montant)} ₪</strong> : <span>Devis</span>}</div>
          <button type="button" className="bouton" onClick={enregistrer}>Enregistrer mes enfants</button>
        </div>
      )}

      {(enregistre || !enCours) && (
        <div className="bloc">
          <h3>Prévenir les autres</h3>
          {brouillon.familles.map((f, i) => (i === famille || !f.telephone ? null : (
            <a key={i} className="bouton rs-whatsapp" href={lienWhatsApp(f.telephone, messagePartage({ ...brouillon, familles: brouillon.familles.map((x, j) => (j === i ? { ...x, rempli: x.rempli } : x)) }, i, lienPartage(origine, id, i), calcul, nom))} target="_blank" rel="noopener noreferrer">
              Envoyer le nouveau devis à {nomPartage(brouillon, i)}
            </a>
          )))}
          <a className="lien" href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, ${nom || "une famille"} a complété ses enfants pour le ramassage scolaire partagé.\n${lienPartage(origine, id, 0)}`)} target="_blank" rel="noopener noreferrer">Prévenir Rebecca</a>
        </div>
      )}
      <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
    </div>
  );
}
