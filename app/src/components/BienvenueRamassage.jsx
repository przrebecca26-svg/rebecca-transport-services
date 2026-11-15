import { useEffect, useMemo, useState } from "react";
import IconeService from "./IconeService.jsx";
import { compteOuvert, useClient, rafraichir } from "../client.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { planVide, libellePeriode, horairesEnfant, enfantVide, nomEnfant } from "../pricing/ramassagePlanning.js";
import { prixFr } from "../pricing/partage.js";
import { calculerPartage, nomPartage, enfantsPourLeCompte, STATUTS_PARTAGE } from "../pricing/partageRamassage.js";
import { useRoutes } from "./DemandeRamassage.jsx";
import "../client-commun.css";
import "../ramassage-site.css";

// LIEN DE BIENVENUE D'UNE FAMILLE (15 nov. 2026, etape 2) : #/bienvenue/<identifiant>/<numero de la famille>.
// Rebecca a accepte : la famille voit ses enfants et son prix, cree son compte, et ses enfants s'ajoutent
// dans « Mes enfants ». Ce lien est garde sur le telephone : sa prochaine demande la reconnait.

export const CLE_FAMILLE = "rs_ramassage_famille";
export const CLE_INVITATION = "rs_ramassage_invitation";
const garder = (cle, valeur) => {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* navigation privee */
  }
};

export default function BienvenueRamassage({ id, famille, onRetour, onCompte }) {
  const client = useClient();
  const ouvert = compteOuvert(client);
  const [doc, setDoc] = useState(null);
  const [etat, setEtat] = useState("chargement");
  const [info, setInfo] = useState("");
  const [ajoutes, setAjoutes] = useState(false);

  useEffect(() => {
    let actif = true;
    garder(CLE_FAMILLE, { id, famille });
    Promise.all([import("../firebase.js"), import("firebase/firestore")])
      .then(([{ db }, { doc: refDoc, getDoc }]) => getDoc(refDoc(db, "trajetsPartages", id)))
      .then((s) => {
        if (!actif) return;
        if (!s.exists()) return setEtat("introuvable");
        setDoc(s.data());
        setEtat("ok");
      })
      .catch(() => actif && setEtat("introuvable"));
    return () => {
      actif = false;
    };
  }, [id, famille]);

  const planRoutes = useMemo(() => (doc ? { ...planVide(), domicile: doc.commun.domicile, ecole: doc.commun.ecole, enfants: doc.familles.flatMap((f) => f.enfants) } : planVide()), [doc]);
  const { routes, statut } = useRoutes(planRoutes);
  const calcul = useMemo(() => (doc && statut === "ok" ? calculerPartage(doc, routes) : null), [doc, routes, statut]);

  // Compte deja ouvert : ses enfants dans « Mes enfants » (une fois)
  const enfantsCompte = ouvert && client.profil && Array.isArray(client.profil.enfants) ? client.profil.enfants : [];
  const aAjouter = doc && doc.familles[famille] ? enfantsPourLeCompte(doc, famille, enfantsCompte).slice(enfantsCompte.length) : [];
  const ajouter = async () => {
    try {
      const [{ db }, { doc: refDoc, updateDoc, serverTimestamp }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
      await updateDoc(refDoc(db, "clients", client.user.uid), { enfants: enfantsPourLeCompte(doc, famille, enfantsCompte), majLe: serverTimestamp() });
      await rafraichir();
      setAjoutes(true);
      try {
        window.localStorage.removeItem(CLE_INVITATION);
      } catch {
        /* sans importance */
      }
      setInfo("Vos enfants sont dans « Mes enfants ». Complétez leur âge et les personnes autorisées dans votre compte.");
    } catch {
      setInfo("Ajout impossible pour l'instant. Réessayez, ou ajoutez-les dans « Mes enfants » de votre compte.");
    }
  };

  if (etat === "chargement") return <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;
  if (etat !== "ok" || !doc.familles[famille]) {
    return (
      <div className="formulaire">
        <div className="bloc"><p>Ce lien n'est plus valable. Écrivez à Rebecca sur WhatsApp.</p></div>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, mon lien de ramassage scolaire ne marche pas.")} target="_blank" rel="noopener noreferrer">Écrire à Rebecca</a>
        <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
      </div>
    );
  }

  const fam = doc.familles[famille];
  const plan = { ...planVide(), ...doc.commun, enfants: fam.enfants.map((e) => ({ ...enfantVide(), ...e })) };
  const part = calcul && calcul.parFamille[famille] ? calcul.parFamille[famille].montant : null;
  const accepte = doc.statut === "acceptee";

  return (
    <div className="formulaire rs-form">
      <header className="titre-service">
        <span aria-hidden="true"><IconeService id="ramassage" taille={40} /></span>
        <h2>{accepte ? "Votre ramassage est confirmé" : "Votre ramassage scolaire"}</h2>
      </header>
      <div className="bloc">
        <p><strong>{nomPartage(doc, famille)}</strong> · {STATUTS_PARTAGE[doc.statut] || doc.statut}</p>
        {plan.enfants.map((e, i) => <p className="note" key={i}>• {nomEnfant(e, i)} : {horairesEnfant(plan, i)}</p>)}
        {calcul && calcul.resultat && calcul.resultat.ok && (
          <p><strong>Votre prix : {part != null ? `${prixFr(part)} ₪` : "—"}</strong> <small>({libellePeriode(calcul.plan, calcul.resultat)})</small></p>
        )}
        {!accepte && <p className="note">Rebecca ne l'a pas encore confirmé : elle vous répond sur WhatsApp.</p>}
      </div>

      <div className="bloc">
        <h3>Votre compte</h3>
        {!ouvert ? (
          <>
            <p className="note">Créez votre compte (1 minute) : vos enfants s'ajoutent tout seuls dans « Mes enfants », vous suivez vos demandes, et la prochaine sera déjà remplie.</p>
            <button
              type="button"
              className="bouton"
              onClick={() => {
                garder(CLE_INVITATION, { id, famille });
                onCompte();
              }}
            >
              Créer mon compte
            </button>
            <p className="note">Déjà un compte ? Le même bouton permet de vous connecter. Vous revenez ensuite ici tout seul.</p>
          </>
        ) : aAjouter.length > 0 && !ajoutes ? (
          <>
            <p className="note">Vous êtes connectée. Ajouter {aAjouter.map((e) => e.prenom).join(", ")} dans « Mes enfants » ?</p>
            <button type="button" className="bouton" onClick={ajouter}>Ajouter mes enfants à mon compte</button>
          </>
        ) : (
          <p className="note">✓ Vos enfants sont dans votre compte. Pour une prochaine demande : « Refaire » dans votre historique, ou le formulaire du site, déjà rempli.</p>
        )}
        {info && <p className="note" role="status">{info}</p>}
      </div>
      <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
    </div>
  );
}
