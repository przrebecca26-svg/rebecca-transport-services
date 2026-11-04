import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { soldeCredit } from "./pricing/credit.js";
import { compteOuvert, demarrer, useClient } from "./client.js";
import { CompleterFiche, Connexion, PorteVerification } from "./CompteAcces.jsx";
import CompteInfos from "./CompteInfos.jsx";
import CompteHistorique from "./CompteHistorique.jsx";
import ComptePromos from "./ComptePromos.jsx";
import CompteCredit from "./CompteCredit.jsx";
import Legal from "./Legal.jsx";
import "./compte.css";

// Espace "Mon compte" du client. Le compte reste facultatif pour envoyer une demande.
// Ecrans : connexion / creation -> verification de l'e-mail -> fin d'inscription -> espace (Historique, Codes, Credit, Infos).

const ONGLETS = [
  { id: "historique", titre: "Historique" },
  { id: "promos", titre: "Codes" },
  { id: "credit", titre: "Crédit" },
  { id: "infos", titre: "Infos" },
];

export default function Compte({ onRetour, onRefaire, onModifier, vueInitiale, ongletInitial }) {
  const c = useClient();
  const [legal, setLegal] = useState(false);
  const [onglet, setOnglet] = useState(ongletInitial || "historique");
  const [solde, setSolde] = useState(0);

  useEffect(() => demarrer(true), []);

  const ouvert = compteOuvert(c);
  useEffect(() => {
    if (!ouvert) return;
    let actif = true;
    getDocs(query(collection(db, "creditMouvements"), where("uid", "==", c.user.uid)))
      .then((s) => actif && setSolde(soldeCredit(s.docs.map((x) => x.data()))))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [ouvert, c.user && c.user.uid]);

  const retour = (
    <button type="button" className="retour" onClick={onRetour}>
      ← Retour
    </button>
  );

  if (legal) return <Legal onRetour={() => setLegal(false)} />;

  if (c.phase === "inconnu" || c.phase === "chargement") {
    return (
      <section className="compte">
        {retour}
        <p className="consigne">Chargement…</p>
      </section>
    );
  }

  const enveloppe = (contenu) => (
    <section className="compte">
      {retour}
      {contenu}
    </section>
  );

  if (!c.user) {
    return enveloppe(
      <>
        <header className="titre-service">
          <span aria-hidden="true">👤</span>
          <h2>Mon compte</h2>
        </header>
        <Connexion vueInitiale={vueInitiale} onLegal={() => setLegal(true)} />
      </>
    );
  }
  if (!c.user.emailVerified) return enveloppe(<PorteVerification />);
  if (!c.profil) return enveloppe(<CompleterFiche onLegal={() => setLegal(true)} />);

  return enveloppe(
    <>
      <header className="compte-entete">
        <div>
          <p className="compte-bonjour">Bonjour {c.profil.prenom}</p>
          {solde > 0 && (
            <button type="button" className="compte-credit-badge" onClick={() => setOnglet("credit")}>
              Crédit : {solde} ₪
            </button>
          )}
        </div>
        <button type="button" className="lien" onClick={() => signOut(auth)}>
          Me déconnecter
        </button>
      </header>
      <nav className="compte-onglets quatre" role="tablist" aria-label="Mon compte">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} className={onglet === o.id ? "actif" : ""} onClick={() => setOnglet(o.id)}>
            {o.titre}
          </button>
        ))}
      </nav>
      {onglet === "historique" && <CompteHistorique client={c} onRefaire={onRefaire} onModifier={onModifier} />}
      {onglet === "promos" && <ComptePromos client={c} />}
      {onglet === "credit" && <CompteCredit client={c} solde={solde} onSolde={(lignes) => setSolde(soldeCredit(lignes))} />}
      {onglet === "infos" && <CompteInfos client={c} onLegal={() => setLegal(true)} />}
    </>
  );
}
