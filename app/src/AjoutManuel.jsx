import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import AddressField from "./components/AddressField.jsx";
import { SERVICES } from "./services.js";
import { TARIFS } from "./pricing/config.js";
import { calculerTrajet } from "./routing.js";
import { construireFiches, estSansCompte, filtrer, telNormalise } from "./pricing/clients.js";
import { MARGE_DEFAUT, clePaire, datesDe, extremites, phrase, trajetsACalculer, verifier, voisins } from "./pricing/enchainement.js";
import {
  ORIGINES,
  champsAdresses,
  cleTel,
  construireDemande,
  donneesPreFiche,
  etatPropose,
  lienEmail,
  lireMontant,
  messageRemerciement,
  paiementCourse,
  prenomDe,
  repartirPaiement,
  validerClient,
  validerCourse,
} from "./pricing/ajoutManuel.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import "./demandes.css";

// Ajout a la main (espace prive de Rebecca) - Lot B, seance B7.
// mode "course" : un client (existant ou nouveau) + une course faite ou a faire + l'argent recu.
// mode "client" : seulement la pre-fiche d'un client (nouveau, ou modification d'une fiche).
// Tout est ecrit en une seule fois (demande + paiement + pre-fiche) : rien n'est enregistre a moitie.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const heureRonde = () => {
  const [h, m] = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).split(":").map(Number);
  const q = Math.round(m / 15) * 15;
  return String((h + (q === 60 ? 1 : 0)) % 24).padStart(2, "0") + ":" + String(q % 60).padStart(2, "0");
};
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const CLIENT_VIDE = { prenom: "", nom: "", telephone: "", email: "", adresse: "", notes: "" };

// Duree d'un trajet avec OSRM, abandonnee apres 8 secondes
async function trajetEntre(de, vers) {
  if (!de || !vers || typeof de.lat !== "number" || typeof vers.lat !== "number") return null;
  if (de.lat === vers.lat && de.lon === vers.lon) return { km: 0, minutes: 0 };
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await calculerTrajet(de, vers, ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

// Boutons de choix ; effacable : un second appui enleve le choix
function Choix({ options, valeur, onChoisir, label, effacable = false }) {
  return (
    <div className="am-choix" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valeur === o.id} className={"tb-filtre" + (valeur === o.id ? " actif" : "")} onClick={() => (valeur === o.id ? effacable && onChoisir("") : onChoisir(o.id))}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Remerciement({ prenom, telephone, email }) {
  const whatsapp = lienWhatsApp(telephone, messageRemerciement(prenom, window.location.origin.startsWith("http") ? window.location.origin : undefined));
  const mail = lienEmail(email, prenom, window.location.origin.startsWith("http") ? window.location.origin : undefined);
  if (!whatsapp && !mail) return null;
  return (
    <div className="tb-bloc">
      <h3>Message de remerciement</h3>
      <p className="tb-note">Le message s'ouvre déjà écrit (site, Instagram, code BIENVENUE10) : tu n'as plus qu'à appuyer sur « Envoyer ».</p>
      <div className="tb-actions">
        {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">Par WhatsApp</a>}
        {mail && <a className="tb-bouton tb-clair" href={mail}>Par e-mail</a>}
      </div>
    </div>
  );
}

export { Remerciement };

// D2a (9 nov. 2026) : prerempli = course venant du « Devis rapide » (service, date, heure, adresses, prix)
export default function AjoutManuel({ mode = "course", demandes = [], marge = MARGE_DEFAUT, cleInitiale = null, prerempli = null, onFermer, onOuvrirDemande, onOuvrirFiche }) {
  const [base, setBase] = useState({});
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState(null); // fiche existante choisie
  const [client, setClient] = useState(CLIENT_VIDE);
  const [origine, setOrigine] = useState("");
  const jour = aujourdhui();
  const [f, setF] = useState(() => ({ service: "livraison", date: jour, heure: heureRonde(), adresses: {}, direction: "vers", magasin: "", prix: "", etat: "afaire", recu: "", moyen: "", pourboireConfirme: true, notes: "", ...(prerempli || {}) }));
  const [verif, setVerif] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fini, setFini] = useState(null);

  // Comptes clients et fiches privees, pour retrouver un client existant
  useEffect(() => {
    const arrets = ["clients", "clientsAdmin"].map((nom) =>
      onSnapshot(
        collection(db, nom),
        (s) => setBase((avant) => ({ ...avant, [nom]: s.docs.map((x) => ({ id: x.id, ...x.data() })) })),
        () => setLectureImpossible(true)
      )
    );
    return () => arrets.forEach((a) => a());
  }, []);

  const pret = Array.isArray(base.clients) && Array.isArray(base.clientsAdmin);
  const fiches = useMemo(() => {
    if (!pret) return [];
    const admins = Object.fromEntries(base.clientsAdmin.map((x) => [x.id, x]));
    return construireFiches({ clients: base.clients, demandes, admins });
  }, [pret, base, demandes]);

  const choisir = (fiche) => {
    setChoisi(fiche);
    setRecherche("");
    const p = fiche.profil;
    const pf = fiche.preFiche || {};
    const [prenom, ...reste] = String(fiche.nom || "").split(" ");
    setClient({
      prenom: (p && p.prenom) || pf.prenom || prenom || "",
      nom: (p && p.nom) || pf.nom || reste.join(" "),
      telephone: fiche.telephone || "",
      email: fiche.email || "",
      adresse: (p && p.adresse) || pf.adresse || "",
      notes: "",
    });
    setOrigine(fiche.origine && fiche.origine !== "site" ? fiche.origine : "");
  };

  // Fiche a ouvrir directement (« Ajouter une course » ou « Modifier » depuis une fiche client)
  useEffect(() => {
    if (!pret || !cleInitiale || choisi) return;
    const fiche = fiches.find((x) => x.cle === cleInitiale) || (estSansCompte(cleInitiale) && fiches.find((x) => telNormalise(x.telephone) === cleInitiale.slice(4)));
    if (fiche) choisir(fiche);
  }, [pret, cleInitiale, fiches]);

  useEffect(() => {
    setErreur("");
    setVerif(null);
  }, [client, f, origine]);

  const changer = (k, v) =>
    setF((avant) => {
      const n = { ...avant, [k]: v };
      if (k === "date") n.etat = etatPropose(v, jour, avant.etat);
      if (k === "service") n.adresses = {};
      return n;
    });
  const changerClient = (k, v) => setClient((c) => ({ ...c, [k]: v }));

  // Le numero tape appartient deja a un client connu
  const dejaConnu = useMemo(() => {
    if (choisi) return null;
    const t = telNormalise(client.telephone);
    return t ? fiches.find((x) => telNormalise(x.telephone) === t) || null : null;
  }, [choisi, client.telephone, fiches]);

  const resultats = recherche.trim().length >= 2 ? filtrer(fiches, "tous", recherche).slice(0, 6) : [];

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture des clients impossible. Vérifie la connexion puis réessaie.</p>;

  // Ecran de fin : resume + message de remerciement
  if (fini) {
    return (
      <section className="tb-detail am">
        <button className="tb-retour" onClick={onFermer}>← Retour</button>
        <div className="dm-verif dm-ok" role="status">
          <p><strong>{fini.titre}</strong></p>
          {fini.lignes.map((l, i) => <p key={i} className="tb-note">{l}</p>)}
        </div>
        {!fini.avecCompte && <Remerciement prenom={fini.prenom} telephone={fini.telephone} email={fini.email} />}
        <div className="tb-actions am-fin">
          {fini.demandeId && onOuvrirDemande && <button className="tb-bouton tb-clair" onClick={() => onOuvrirDemande(fini.demandeId)}>Voir la course</button>}
          {onOuvrirFiche && <button className="tb-bouton tb-clair" onClick={() => onOuvrirFiche(fini.cle)}>Voir la fiche client</button>}
          <button className="tb-bouton tb-clair" onClick={onFermer}>Fermer</button>
        </div>
      </section>
    );
  }

  const prix = lireMontant(f.prix);
  const recu = lireMontant(f.recu) || 0;
  const repartition = f.etat === "faite" ? repartirPaiement(prix, recu, f.pourboireConfirme) : repartirPaiement(prix, recu, false);
  const enPlus = f.etat === "faite" && prix > 0 && recu > prix ? Math.round((recu - prix) * 100) / 100 : 0;
  const reste = f.etat === "faite" && prix > 0 && recu < prix ? Math.round((prix - recu) * 100) / 100 : 0;

  // Cle de la fiche ou ecrire la pre-fiche
  const cleFiche = () => (choisi ? choisi.cle : dejaConnu ? dejaConnu.cle : cleTel(client.telephone));

  // Verification d'enchainement (course a faire) avec les courses deja acceptees
  const verifierJournee = async (candidate) => {
    const liste = voisins(candidate, demandes.filter((x) => x.statut === "acceptee"), datesDe(candidate));
    const trajets = {};
    await Promise.all(
      trajetsACalculer(liste).map(async (p) => {
        const k = clePaire(p.de, p.vers);
        if (!k || k in trajets) return;
        trajets[k] = null;
        const t = await trajetEntre(p.de, p.vers);
        if (t) trajets[k] = t.minutes;
      })
    );
    for (const k of Object.keys(trajets)) if (trajets[k] == null) delete trajets[k];
    return verifier(liste, trajets, marge);
  };

  const enregistrer = async (forcer = false) => {
    const errClient = validerClient(client);
    const errCourse = mode === "course" ? validerCourse(f, jour) : "";
    if (errClient || errCourse) {
      setErreur(errClient || errCourse);
      return;
    }
    const cle = cleFiche();
    if (!cle) {
      setErreur("Numéro de téléphone introuvable.");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      const lot = writeBatch(db);
      const fiche = choisi || dejaConnu;
      // Pre-fiche : client avec compte -> seulement l'origine ; sinon les informations saisies
      const pf = fiche && !estSansCompte(fiche.cle) ? (origine ? { origine } : null) : donneesPreFiche(client, origine);
      const notes = String(client.notes || "").trim();
      if (pf && notes && !fiche) pf.notes = notes.slice(0, 3000);
      if (pf) lot.set(doc(db, "clientsAdmin", cle), { ...pf, majLe: serverTimestamp() }, { merge: true });

      let demandeId = null;
      const lignes = [];
      if (mode === "course") {
        // Duree du trajet si les deux adresses ont une position (agenda et enchainement plus justes)
        const ext = extremites({ service: f.service, details: { ...f.adresses, direction: f.direction } });
        const trajet = await trajetEntre(ext.debut, ext.fin);
        const d = construireDemande(client, f, origine, trajet);
        if (d.statut === "acceptee" && !forcer) {
          const res = await verifierJournee({ ...d, id: "__nouvelle" });
          if (!res.ok) {
            setVerif(res);
            setEnCours(false);
            return;
          }
        }
        const ref = doc(collection(db, "demandes"));
        demandeId = ref.id;
        lot.set(ref, { ...d, creeLe: serverTimestamp(), majLe: serverTimestamp() });
        const paiement = paiementCourse(f, ref.id, jour);
        if (paiement) lot.set(doc(collection(db, "mouvements")), { ...paiement, creeLe: serverTimestamp() });
        lignes.push(`${d.serviceTitre} · ${d.nom} · ${shekels(d.prixFinal)}`);
        lignes.push(d.statut === "terminee" ? "Marquée terminée : elle compte dans tes finances à sa date." : "Ajoutée à ton agenda et à « Aujourd'hui ».");
        if (paiement) lignes.push(`Paiement enregistré : ${shekels(paiement.montant)} (${paiement.moyen}).`);
        if (d.pourboire) lignes.push(`Pourboire : ${shekels(d.pourboire)}, compté à part.`);
        if (d.statut === "terminee" && reste > 0) lignes.push(`Reste à encaisser : ${shekels(reste)}.`);
      } else {
        lignes.push(`${`${client.prenom} ${client.nom}`.trim()} · ${client.telephone}`);
        lignes.push(fiche && !estSansCompte(fiche.cle) ? "Origine enregistrée sur son compte." : "Pré-fiche enregistrée. Si elle crée son compte avec ce numéro, tout se rattache à son compte.");
      }
      await lot.commit();
      setFini({
        titre: mode === "course" ? "Course enregistrée ✓" : "Client enregistré ✓",
        lignes,
        demandeId,
        cle,
        prenom: String(client.prenom || "").trim() || prenomDe(fiche && fiche.nom),
        telephone: client.telephone,
        email: client.email,
        avecCompte: !!(fiche && !estSansCompte(fiche.cle)),
      });
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const avecCompte = choisi && !estSansCompte(choisi.cle);

  return (
    <section className="tb-detail am">
      <button className="tb-retour" onClick={onFermer}>← Retour</button>
      <h2>{mode === "course" ? "Ajouter une course" : choisi ? "Modifier le client" : "Nouveau client"}</h2>
      {mode === "course" && <p className="tb-note">Pour une course hors du site (WhatsApp, pub Facebook, téléphone…), faite ou à faire.</p>}

      <div className="tb-bloc">
        <h3>Client</h3>
        {!pret && <p className="tb-note">Chargement des clients…</p>}
        {choisi ? (
          <div className="am-choisi">
            <p><strong>{choisi.nom}</strong> · {choisi.telephone}{avecCompte ? " · avec compte" : ""}</p>
            {!cleInitiale && <button className="tb-retour aj-lien" onClick={() => { setChoisi(null); setClient(CLIENT_VIDE); setOrigine(""); }}>Changer de client</button>}
          </div>
        ) : (
          pret && (
            <>
              <input className="am-champ" type="search" placeholder="Chercher un client existant" aria-label="Chercher un client existant" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              {resultats.map((x) => (
                <button key={x.cle} className="am-resultat" onClick={() => choisir(x)}>
                  <strong>{x.nom}</strong> <small>{x.telephone}{x.avecCompte ? " · compte" : ""}</small>
                </button>
              ))}
              {recherche.trim().length >= 2 && resultats.length === 0 && <p className="tb-note">Aucun client trouvé : remplis la fiche ci-dessous.</p>}
              <p className="tb-note">Ou nouveau client :</p>
            </>
          )
        )}

        {!avecCompte && (
          <div className="am-grille">
            <label>Prénom *<input className="am-champ" value={client.prenom} maxLength={60} onChange={(e) => changerClient("prenom", e.target.value)} /></label>
            <label>Nom<input className="am-champ" value={client.nom} maxLength={60} onChange={(e) => changerClient("nom", e.target.value)} /></label>
            <label>Téléphone *<input className="am-champ" type="tel" inputMode="tel" value={client.telephone} maxLength={20} onChange={(e) => changerClient("telephone", e.target.value)} /></label>
            <label>E-mail<input className="am-champ" type="email" inputMode="email" value={client.email} maxLength={120} onChange={(e) => changerClient("email", e.target.value)} /></label>
            <label className="am-large">Adresse<input className="am-champ" value={client.adresse} maxLength={300} onChange={(e) => changerClient("adresse", e.target.value)} /></label>
            {!choisi && (
              <label className="am-large">Notes privées<textarea className="am-champ" rows={2} maxLength={3000} value={client.notes} onChange={(e) => changerClient("notes", e.target.value)} placeholder="Ex : code de l'immeuble, préfère WhatsApp…" /></label>
            )}
          </div>
        )}
        {dejaConnu && (
          <p className="dm-verif dm-alerte">
            Ce numéro est déjà connu : <strong>{dejaConnu.nom}</strong>.{" "}
            <button className="tb-retour aj-lien" onClick={() => choisir(dejaConnu)}>Utiliser cette fiche</button>
          </p>
        )}

        <p className="am-titre">D'où vient ce client ?</p>
        <Choix options={ORIGINES} valeur={origine} onChoisir={setOrigine} label="Origine" effacable />
      </div>

      {mode === "course" && (
        <>
          <div className="tb-bloc">
            <h3>Course</h3>
            <Choix options={SERVICES.map((s) => ({ id: s.id, label: s.titre }))} valeur={f.service} onChoisir={(v) => changer("service", v)} label="Service" />
            <div className="am-grille">
              <label>Date<input className="am-champ" type="date" value={f.date} onChange={(e) => changer("date", e.target.value)} /></label>
              <label>Heure<input className="am-champ" type="time" value={f.heure} onChange={(e) => changer("heure", e.target.value)} /></label>
            </div>
            {f.service === "aeroport" && (
              <Choix options={[{ id: "vers", label: "Vers l'aéroport" }, { id: "depuis", label: "Depuis l'aéroport" }]} valeur={f.direction} onChoisir={(v) => changer("direction", v)} label="Sens" />
            )}
            {f.service === "courses" && (
              <label className="am-label">Magasin<input className="am-champ" value={f.magasin} maxLength={120} onChange={(e) => changer("magasin", e.target.value)} /></label>
            )}
            {champsAdresses(f.service).map((a) => (
              <div key={f.service + a.cle} className="am-label">
                <span>{a.label} (facultatif)</span>
                <AddressField id={"am-" + a.cle} valeur={f.adresses[a.cle] || null} position={false} onChange={(v) => changer("adresses", { ...f.adresses, [a.cle]: v })} />
              </div>
            ))}
            <label className="am-label">Détails (facultatif)<textarea className="am-champ" rows={2} maxLength={1000} value={f.notes} onChange={(e) => changer("notes", e.target.value)} placeholder="Ex : commande livrée chez moi, mot écrit pour la cliente…" /></label>
            <label className="am-label">Prix convenu (₪) *<input className="am-champ" inputMode="decimal" value={f.prix} onChange={(e) => changer("prix", e.target.value)} placeholder="Ex : 60" /></label>
            <p className="am-titre">État</p>
            <Choix options={[{ id: "afaire", label: "À faire" }, { id: "faite", label: "Déjà faite" }]} valeur={f.etat} onChoisir={(v) => changer("etat", v)} label="État" />
          </div>

          <div className="tb-bloc">
            <h3>Paiement</h3>
            <label className="am-label">{f.etat === "faite" ? "Argent reçu (₪)" : "Déjà reçu, acompte… (₪, facultatif)"}<input className="am-champ" inputMode="decimal" value={f.recu} onChange={(e) => changer("recu", e.target.value)} placeholder="0" /></label>
            {recu > 0 && (
              <>
                <p className="am-titre">Payé par</p>
                <Choix options={TARIFS.moyensPaiement.map((m) => ({ id: m, label: m }))} valeur={f.moyen} onChoisir={(v) => changer("moyen", v)} label="Moyen de paiement" />
              </>
            )}
            {enPlus > 0 && (
              <label className="am-case">
                <input type="checkbox" checked={f.pourboireConfirme} onChange={(e) => changer("pourboireConfirme", e.target.checked)} />
                <span>Les {shekels(enPlus)} en plus sont un pourboire</span>
              </label>
            )}
            {recu > 0 && prix > 0 && (
              <p className="tb-note">
                {repartition.pourboire > 0
                  ? `${shekels(recu)} reçus = ${shekels(repartition.paiement)} pour la course + ${shekels(repartition.pourboire)} de pourboire (compté à part, hors chiffre d'affaires).`
                  : `${shekels(repartition.paiement)} enregistrés comme paiement.`}
              </p>
            )}
            {reste > 0 && <p className="tb-note">Il restera {shekels(reste)} à encaisser.</p>}
          </div>
        </>
      )}

      {verif && (
        <div className="dm-verif dm-alerte" role="alert" ref={(el) => el && el.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <p><strong>Attention à l'enchaînement</strong></p>
          {verif.problemes.map((x, i) => <p key={i}>{phrase(x)}</p>)}
          <p className="tb-note">Calcul sans circulation en temps réel.</p>
          <div className="tb-actions">
            <button className="tb-bouton" disabled={enCours} onClick={() => enregistrer(true)}>Enregistrer quand même</button>
            <button className="tb-bouton tb-clair" onClick={() => setVerif(null)}>Modifier l'heure</button>
          </div>
        </div>
      )}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {!verif && (
        <div className="tb-actions am-fin">
          <button className="tb-bouton" disabled={enCours || !pret} onClick={() => enregistrer(false)}>
            {enCours ? "Enregistrement…" : mode === "course" ? "Enregistrer la course" : "Enregistrer le client"}
          </button>
          <button className="tb-bouton tb-clair" onClick={onFermer}>Annuler</button>
        </div>
      )}
    </section>
  );
}
