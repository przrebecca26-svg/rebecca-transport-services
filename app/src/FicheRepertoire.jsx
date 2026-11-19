import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import ChoixAge from "./components/ChoixAge.jsx";
import { Adresse, Famille } from "./Familles.jsx";
import { Compte } from "./ComptesEntreNous.jsx";
import { enregistrerComptes, useComptes } from "./comptesBase.js";
import { enregistrerRepertoire, useRepertoire } from "./repertoireBase.js";
import { familleVide, texteAge } from "./pricing/familles.js";
import { CATEGORIES, LIENS, comptesDeLEntree, demandesDeLEntree, faiteParDe, nouveauMembre, pourQui, resumeFiche, telsEntree } from "./pricing/fichesRepertoire.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { nomDe } from "./pricing/quiFait.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import SuiviBeaute from "./SuiviBeaute.jsx";
import LienResto from "./components/LienResto.jsx";
import { nouvelIdCompte, soldeCompte } from "./pricing/comptesEntreNous.js";
import { releveDuMois } from "./pricing/suiteClient.js";
import { SUJETS, envoyerMailClient } from "./mailClient.js";
import { encaisseBrut } from "./pricing/comptes.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import { addDoc, serverTimestamp } from "firebase/firestore";
import { clientsDuResto, ficheMaCliente, FORMULES, contratDe, messageReleve, paiementsSemaine, prixPro, releveSemaine, semaineDe, semaineDecalee } from "./pricing/commercants.js";
import { validerMouvement } from "./pricing/comptes.js";
import { champOperateur } from "./pricing/reverser.js";
import { TARIFS } from "./pricing/config.js";

// FICHE DU REPERTOIRE (13 nov. 2026, 09h13) : une fiche par famille ou par cliente, 4 onglets.
// Membres (qui je veux : mari, mere, niece...), Enfants (ecoles, activites, horaires -> tournee), Historique (tout ce
// que j'ai fait, dates, montants), Finances (paye, reste a payer, comptes entre nous ; Rebecca seule).
const ONGLETS = [
  { id: "membres", l: "Membres" },
  { id: "enfants", l: "Enfants" },
  { id: "historique", l: "Historique" },
  { id: "finances", l: "Finances" },
  { id: "suivi", l: "Suivi beauté", admin: true }, // 13 nov. 2026 : seances, cures, produits, prochain RDV
];
// 19 nov. 2026 (Rebecca) : la fiche d'un restaurant n'est pas celle d'une famille -> Infos, Livraisons, Finances
const ONGLETS_RESTO = [
  { id: "membres", l: "Infos" },
  { id: "historique", l: "Livraisons" },
  { id: "clientsResto", l: "Ses clients" },
  { id: "finances", l: "Finances" },
];
const LIENS_RESTO = ["Responsable", "Caisse", "Cuisine", "Livreur", "Autre"];
const STATUTS = { terminee: "faite", acceptee: "à venir", "en attente": "en attente", refusee: "refusée", annulee: "annulée" };
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "");

export default function FicheRepertoire({ entree, demandes, mouvements, estAdmin, moi = ADMIN_ID, categorie, changerCategorie, retour, ouvrirFicheCliente, connues }) {
  const rep = useRepertoire();
  const { membres } = useEquipeContexte();
  const { comptes } = useComptes();
  // 19 nov. 2026 : cartes cadeaux offertes ou reçues par cette fiche (même téléphone)
  const [cartes, setCartes] = useState([]);
  useEffect(() => onSnapshot(collection(db, "cartesCadeaux"), (s) => setCartes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setCartes([])), []);
  const [onglet, setOnglet] = useState("membres");
  const [f, setF] = useState(entree.famille);
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const changer = (n) => {
    setF(n);
    setModifie(true);
    setMessage("");
  };
  const enregistrer = async () => {
    try {
      const existe = rep.familles.some((x) => x.id === f.id);
      await enregistrerRepertoire(rep.lieux, rep.corrections, existe ? rep.familles.map((x) => (x.id === f.id ? f : x)) : [...rep.familles, f]);
      setModifie(false);
      setMessage("C'est enregistré.");
      // 19 nov. 2026 (Rebecca) : une fois enregistrée, la fiche se referme et on revient au Répertoire
      retour(`✓ Fiche « ${String(f.nom || "").trim() || "sans nom"} » enregistrée.`);
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
    }
  };
  // Cliente du site sans famille : on lui cree sa fiche famille (pour ajouter des membres et des enfants)
  const creerFamille = () => {
    const c = entree.clients[0];
    changer({ ...familleVide(), nom: entree.nom, telephone: entree.telephone, categorie, enfants: [], domicile: (c && c.profil && c.profil.adresse && typeof c.profil.adresse === "object" ? c.profil.adresse : null) });
  };
  const e = { ...entree, famille: f };
  // 13 nov. 2026, 09h39 : Rebecca voit tout, avec le nom de qui a fait la course ; Jeremy ne voit que les siennes
  const liste = pourQui(demandesDeLEntree(e, demandes || [], estAdmin ? comptes : []), moi, estAdmin, ADMIN_ID);
  const qui = (d) => nomDe(membres, faiteParDe(d, ADMIN_ID));
  const estResto = !!f && f.categorie === "commercants";
  const onglets = estResto ? ONGLETS_RESTO : ONGLETS.filter((o) => !o.admin || estAdmin);
  const ongletVu = onglets.some((o) => o.id === onglet) ? onglet : "membres";
  const resume = resumeFiche(liste, mouvements || [], new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), cartes, telsEntree(e));

  return (
    <div className="tdb devis-rapide">
      <button type="button" className="tdb-retour" onClick={() => (modifie && !window.confirm("Quitter sans enregistrer ?") ? null : retour())}>← Répertoire</button>
      <div className="tdb-tete">
        <h1>{(f && f.nom) || entree.nom}</h1>
        {entree.telephone && <p className="tdb-sous"><a className="rp-waze" href={lienWhatsApp(entree.telephone)} target="_blank" rel="noopener noreferrer">WhatsApp {entree.telephone}</a></p>}
      </div>
      <label className="champ">Catégorie
        <select value={f ? f.categorie || "clientes" : categorie} onChange={(x) => (f ? changer({ ...f, categorie: x.target.value }) : changerCategorie(x.target.value))}>
          {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </label>

      <ResumeFiche r={resume} />

      <div className="tb-filtres" role="tablist" aria-label="Fiche">
        {onglets.map((o) => (
          <button key={o.id} role="tab" aria-selected={ongletVu === o.id} className={"tb-filtre" + (ongletVu === o.id ? " actif" : "")} onClick={() => setOnglet(o.id)}>{o.l}</button>
        ))}
      </div>

      {ongletVu === "membres" && (
        <section className="tdb-bloc">
          {!f ? (
            <>
              <p>{entree.nom} · {entree.telephone}</p>
              <p className="tdb-note">Cliente du site. Crée sa fiche famille pour ajouter son mari, ses enfants, ses proches.</p>
              <button type="button" className="tdb-bouton" onClick={creerFamille}>Créer sa fiche famille</button>
            </>
          ) : (
            <>
              {estResto ? <InfosResto f={f} changer={changer} connues={connues} /> : <Membres f={f} changer={changer} connues={connues} />}
              {f.categorie === "commercants" && <ContratPro f={f} changer={changer} />}
              {f.categorie === "commercants" && estAdmin && <LienResto f={f} changer={changer} />}
              <div className="bloc">
                <p className="rp-type">Contact et relances</p>
                <label className="champ">Comment la contacter de préférence
                  <select value={f.contactPref || ""} onChange={(x) => changer({ ...f, contactPref: x.target.value })}>
                    <option value="">Pas précisé</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="appel">Appel téléphonique</option>
                    <option value="email">E-mail</option>
                  </select>
                </label>
                <label className="champ">D'accord pour recevoir des relances et des offres
                  <select value={f.relances || ""} onChange={(x) => changer({ ...f, relances: x.target.value })}>
                    <option value="">Pas encore demandé</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non, ne pas relancer</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {entree.clients.length > 0 && (
            <div className="bloc">
              <p className="rp-type">Compte sur le site</p>
              {entree.clients.map((c) => (
                <div key={c.cle} className="rp-forfait">
                  <span>{c.nom} · {c.avecCompte ? "avec compte" : "sans compte"}{c.bloque ? " · bloquée" : ""}</span>
                  {ouvrirFicheCliente && <button type="button" className="rp-waze" onClick={() => ouvrirFicheCliente(c.cle)}>Crédit, accès, notes…</button>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {ongletVu === "enfants" && (
        f ? (
          <div className="formulaire dr-formulaire">
            <Famille f={f} connues={connues} ouvert ouvrir={() => {}} changer={changer} supprimer={() => window.confirm("Supprimer toute la fiche de cette famille ?") && enregistrerRepertoire(rep.lieux, rep.corrections, rep.familles.filter((x) => x.id !== f.id)).then(retour)} />
          </div>
        ) : (
          <section className="tdb-bloc"><p className="tdb-note">Crée d'abord sa fiche famille (onglet Membres).</p></section>
        )
      )}

      {ongletVu === "historique" && (
        <section className="tdb-bloc">
          {liste.length === 0 && <p className="tdb-note">Rien pour l'instant.</p>}
          <ul className="ag-fil">
            {liste.map((d) => {
              const prix = typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime;
              const recu = encaisseBrut(mouvements || [], d.id);
              return (
                <li key={d.id} className="ag-etape">
                  <div className="ag-etape-ligne">
                    <b>{jj(d.date)}</b>
                    <span>
                      {estAdmin && <small>[{qui(d)}] </small>}{d.serviceTitre || d.service}{d.details && d.details.enfants ? ` · ${d.details.enfants}` : ""}{d.details && d.details.quoi ? ` · ${d.details.quoi}` : ""} · {STATUTS[d.statut] || d.statut}
                      {typeof prix === "number" && <strong> · {shekels(prix)}</strong>}
                      {d.statut === "terminee" && typeof prix === "number" && <small>{recu >= prix ? " · payée" : ` · reste ${shekels(prix - recu)}`}</small>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ongletVu === "suivi" && estAdmin && <SuiviBeaute cle={entree.cle} />}
      {ongletVu === "clientsResto" && estResto && <ClientsResto f={f} liste={liste} rep={rep} changer={changer} />}
      {ongletVu === "finances" && <FinancesFiche e={e} liste={liste} mouvements={mouvements || []} comptes={estAdmin ? comptes : []} familles={rep.familles} estAdmin={estAdmin} qui={qui} membres={membres} />}

      {f && (
        <div className="rp-enregistrer">
          <button type="button" className="tdb-bouton" onClick={enregistrer} disabled={!modifie}>{modifie ? "Enregistrer la fiche" : "Tout est enregistré"}</button>
          <button type="button" className="dr-secondaire" onClick={() => (modifie && !window.confirm("Quitter sans enregistrer ?") ? null : retour())}>← Retour au Répertoire</button>
          {message && <p className="tdb-note" role="status">{message}</p>}
        </div>
      )}
    </div>
  );
}

// 19 nov. 2026 (Rebecca) : les clients du restaurant restent chez le restaurant ; la case « Aussi dans mes clientes »
// crée sa fiche dans mes clientes (quand elle me demande un autre service). Décochée : sa fiche repart, si elle a été
// créée ici et qu'elle n'a rien d'autre.
function ClientsResto({ f, liste, rep, changer }) {
  const habitudes = f.habitudes || {};
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState("");
  const clients = clientsDuResto(liste);
  const basculer = async (c, oui) => {
    setEnCours(c.cle);
    setInfo("");
    try {
      if (oui) {
        const nouvelle = { ...familleVide(), enfants: [], nom: c.nom || "Cliente", telephone: c.telephone, categorie: "clientes", domicile: c.adresse || null, depuisResto: f.id };
        await enregistrerRepertoire(rep.lieux, rep.corrections, [...rep.familles, nouvelle]);
        setInfo(`✓ ${c.nom || "Elle"} est aussi dans tes clientes (Répertoire → Clientes).`);
      } else {
        const fiche = ficheMaCliente(c, rep.familles);
        if (!fiche || fiche.depuisResto !== f.id || (fiche.membres || []).length || (fiche.enfants || []).length) {
          setInfo("Sa fiche dans tes clientes a été complétée : retire-la depuis le Répertoire si tu veux vraiment l'effacer.");
        } else {
          await enregistrerRepertoire(rep.lieux, rep.corrections, rep.familles.filter((x) => x.id !== fiche.id));
          setInfo(`${c.nom || "Elle"} reste seulement cliente du restaurant.`);
        }
      }
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours("");
  };
  return (
    <section className="tdb-bloc">
      <p className="tdb-note">Les clients de {f.nom || "ce restaurant"}, d'après ses livraisons. Ils ne sont pas mélangés avec tes clientes. Coche « Aussi dans mes clientes » si l'une d'elles te demande un autre service (aéroport, transport…) : elle apparaît alors des deux côtés.</p>
      {clients.length === 0 && <p className="tdb-note">Aucun client pour l'instant : ils apparaissent ici après la première livraison.</p>}
      {clients.map((c) => {
        const aussi = !!ficheMaCliente(c, rep.familles);
        return (
          <details key={c.cle} className="rp-journee">
            <summary>
              <span><strong>{c.nom || "Sans nom"}</strong><small> · {c.telephone || "pas de téléphone"}{c.derniere ? ` · dernière le ${jj(c.derniere)}` : ""}</small></span>
              <b>{c.nb} livraison{c.nb > 1 ? "s" : ""}</b>
            </summary>
            <label className="champ">
              <input type="checkbox" checked={aussi} disabled={enCours === c.cle || (!aussi && c.telephone.length < 9)} onChange={(x) => basculer(c, x.target.checked)} /> Aussi dans mes clientes
            </label>
            <div className="champ"><label>Ses habitudes (ce qu'elle commande, ce qu'elle aime, code de l'immeuble…)
              <input type="text" maxLength={300} value={habitudes[c.cle] || ""} onChange={(x) => changer({ ...f, habitudes: { ...habitudes, [c.cle]: x.target.value } })} />
            </label></div>
            <ul className="ag-fil">
              {c.livraisons.map((l) => (
                <li key={l.id} className="ag-etape">
                  <div className="ag-etape-ligne">
                    <b>{jj(l.date)} {l.heure.replace(":", "h")}</b>
                    <span>
                      {l.adresse || "adresse ?"}{typeof l.prix === "number" ? <strong> · {shekels(l.prix)}</strong> : null} · {STATUTS[l.statut] || l.statut}
                      {l.note ? <><br /><small>📝 {l.note}</small></> : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      {info && <p className="tdb-note" role="status">{info}</p>}
      {clients.length > 0 && <p className="tdb-note">Les habitudes se gardent avec « Enregistrer la fiche ».</p>}
    </section>
  );
}

// 19 nov. 2026 : onglet « Infos » d'un restaurant ou commerce partenaire (pas d'autre parent, d'enfants ni d'âge)
function InfosResto({ f, changer, connues }) {
  const set = (cle, v) => changer({ ...f, [cle]: v });
  const r = f.resto || {};
  const setR = (cle, v) => set("resto", { ...r, [cle]: v });
  const setM = (id, cle, v) => set("membres", f.membres.map((m) => (m.id === id ? { ...m, [cle]: v } : m)));
  return (
    <>
      <div className="champ"><label>Nom du restaurant / commerce<input type="text" maxLength={60} value={f.nom} onChange={(x) => set("nom", x.target.value)} /></label></div>
      <div className="champ"><label>Téléphone du restaurant<input type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(x) => set("telephone", x.target.value)} /></label></div>
      <div className="champ"><label>Responsable (nom)<input type="text" maxLength={60} value={f.nom2 || ""} onChange={(x) => set("nom2", x.target.value)} /></label></div>
      <div className="champ"><label>Portable du responsable<input type="tel" inputMode="tel" maxLength={20} value={f.telephone2 || ""} onChange={(x) => set("telephone2", x.target.value)} /></label></div>
      <Adresse id={"md" + f.id} label="Adresse du restaurant" valeur={f.domicile} changer={(v) => set("domicile", v)} connues={connues} />
      <p className="tdb-note">C'est là que tu récupères les commandes (point de départ des livraisons).</p>
      <div className="champ"><label>Où récupérer les commandes (comptoir, porte de derrière, parking…)<input type="text" maxLength={200} value={r.recuperation || ""} onChange={(x) => setR("recuperation", x.target.value)} /></label></div>
      <div className="champ"><label>Horaires d'ouverture et jours de fermeture<input type="text" maxLength={200} value={r.horaires || ""} placeholder="Ex. : dim-jeu 11h-23h, vendredi 11h-14h, fermé Chabbat" onChange={(x) => setR("horaires", x.target.value)} /></label></div>
      <div className="champ"><label>Nom légal (pour les relevés et reçus)<input type="text" maxLength={200} value={r.nomLegal || ""} onChange={(x) => setR("nomLegal", x.target.value)} /></label></div>
      <div className="champ"><label>N° d'entreprise (ח.פ / עוסק)<input type="text" inputMode="numeric" maxLength={20} value={r.numero || ""} onChange={(x) => setR("numero", x.target.value)} /></label></div>
      <p className="rp-type">Autres contacts</p>
      {(f.membres || []).map((m) => (
        <div key={m.id} className="rp-correction">
          <div className="champ"><label>Nom<input type="text" maxLength={60} value={m.nom} onChange={(x) => setM(m.id, "nom", x.target.value)} /></label></div>
          <div className="champ"><label>Rôle
            <select value={m.lien} onChange={(x) => setM(m.id, "lien", x.target.value)}>
              <option value="">Choisir…</option>
              {[...LIENS_RESTO, ...(m.lien && !LIENS_RESTO.includes(m.lien) ? [m.lien] : [])].map((l) => <option key={l}>{l}</option>)}
            </select>
          </label></div>
          <div className="champ"><label>Téléphone<input type="tel" inputMode="tel" maxLength={20} value={m.telephone} onChange={(x) => setM(m.id, "telephone", x.target.value)} /></label></div>
          <button type="button" className="dr-secondaire" onClick={() => set("membres", f.membres.filter((x) => x.id !== m.id))}>Retirer {m.nom || "ce contact"}</button>
        </div>
      ))}
      <button type="button" className="dr-secondaire" onClick={() => set("membres", [...(f.membres || []), nouveauMembre()])}>+ Ajouter un contact (caisse, cuisine…)</button>
    </>
  );
}

function Membres({ f, changer, connues }) {
  const set = (cle, v) => changer({ ...f, [cle]: v });
  const setM = (id, cle, v) => set("membres", f.membres.map((m) => (m.id === id ? { ...m, [cle]: v } : m)));
  return (
    <>
      <div className="champ"><label>Nom de la fiche (la personne principale)<input type="text" maxLength={60} value={f.nom} onChange={(x) => set("nom", x.target.value)} /></label></div>
      <div className="champ"><label>Téléphone<input type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(x) => set("telephone", x.target.value)} /></label></div>
      <div className="champ"><label>Autre parent (facultatif)<input type="text" maxLength={60} value={f.nom2 || ""} onChange={(x) => set("nom2", x.target.value)} /></label></div>
      <div className="champ"><label>Téléphone de l'autre parent<input type="tel" inputMode="tel" maxLength={20} value={f.telephone2 || ""} onChange={(x) => set("telephone2", x.target.value)} /></label></div>
      {/* 15 nov. 2026 : l'adresse de la maison se met ici, dans la fiche de la famille ; les enfants la reprennent seuls */}
      <Adresse id={"md" + f.id} label="Adresse de la maison" valeur={f.domicile} changer={(v) => set("domicile", v)} connues={connues} />
      <p className="tdb-note">Ses enfants partent de cette adresse et y reviennent (inutile de la remettre dans l'onglet Enfants, sauf si un enfant habite ailleurs).</p>
      <p className="rp-type">Adresses favorites</p>
      {(f.adresses || []).map((x, k) => (
        <div className="rp-correction" key={k}>
          <div className="champ"><label>Nom (travail, grands-parents…)<input type="text" maxLength={40} value={x.nom} onChange={(e) => set("adresses", f.adresses.map((y, i) => (i === k ? { ...y, nom: e.target.value } : y)))} /></label></div>
          <Adresse id={"ma" + f.id + k} label="Adresse" valeur={x.adresse} changer={(v) => set("adresses", f.adresses.map((y, i) => (i === k ? { ...y, adresse: v } : y)))} connues={connues} />
          <button type="button" className="dr-secondaire" onClick={() => set("adresses", f.adresses.filter((_, i) => i !== k))}>Supprimer cette adresse</button>
        </div>
      ))}
      <button type="button" className="dr-secondaire" onClick={() => set("adresses", [...(f.adresses || []), { nom: "", adresse: null }])}>+ Ajouter une adresse favorite</button>
      <p className="rp-type">Autres membres</p>
      {(f.membres || []).map((m) => (
        <div key={m.id} className="rp-correction">
          <div className="champ"><label>Nom<input type="text" maxLength={60} value={m.nom} onChange={(x) => setM(m.id, "nom", x.target.value)} /></label></div>
          <div className="champ"><label>Lien
            <select value={m.lien} onChange={(x) => setM(m.id, "lien", x.target.value)}>
              <option value="">Choisir…</option>
              {LIENS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label></div>
          <div className="champ"><label>Téléphone (facultatif)<input type="tel" inputMode="tel" maxLength={20} value={m.telephone} onChange={(x) => setM(m.id, "telephone", x.target.value)} /></label></div>
          <ChoixAge valeur={m.age} changer={(v) => setM(m.id, "age", v)} />
          <button type="button" className="dr-secondaire" onClick={() => set("membres", f.membres.filter((x) => x.id !== m.id))}>Retirer {m.nom || "cette personne"}</button>
        </div>
      ))}
      <button type="button" className="dr-secondaire" onClick={() => set("membres", [...(f.membres || []), nouveauMembre()])}>+ Ajouter une personne (mari, mère, nièce…)</button>
      {(f.enfants || []).length > 0 && <p className="tdb-note">Enfants : {f.enfants.map((x) => `${x.prenom || "sans prénom"}${texteAge(x) ? " (" + texteAge(x) + ")" : ""}`).join(", ")} (onglet Enfants).</p>}
    </>
  );
}

function Totaux({ titre, faites, mouvements }) {
  const total = faites.reduce((s, d) => s + (Number(d.prixFinal) || 0), 0);
  const recu = faites.reduce((s, d) => s + Math.min(Number(d.prixFinal) || 0, encaisseBrut(mouvements, d.id)), 0);
  return (
    <>
      {titre && <p className="rp-type">{titre}</p>}
      <ul className="pm-resume">
        <li><span>Courses faites</span><strong>{shekels(total)}</strong></li>
        <li><span>Encaissé</span><strong>{shekels(recu)}</strong></li>
        <li><span>Reste à encaisser</span><strong className={total - recu > 0 ? "bl-neg" : undefined}>{shekels(total - recu)}</strong></li>
      </ul>
    </>
  );
}

// 17 nov. 2026, 12h03 : releve du mois (courses terminees, deja regle, reste + comptes entre nous) par WhatsApp et e-mail
function Releve({ e, liste, mouvements, lies }) {
  const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const [mois, setMois] = useState(jour.slice(0, 7));
  const [info, setInfo] = useState("");
  const soldeComptes = lies.reduce((t, c) => t + Math.max(0, soldeCompte(c, liste, mouvements)), 0);
  const nom = (e.famille && e.famille.nom) || e.nom || "";
  const telephone = (e.famille && e.famille.telephone) || e.telephone || "";
  const r = releveDuMois(nom, liste, mouvements, mois, soldeComptes);
  const wa = lienWhatsApp(telephone, r.texte);
  const moisPrec = (() => { const [a, m] = mois.split("-").map(Number); const t = a * 12 + m - 2; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; })();
  return (
    <div className="bloc">
      <p className="tdb-note">📄 Relevé de {new Date(`${mois}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })} : {r.nb} course{r.nb > 1 ? "s" : ""}, {r.total} ₪, reste {r.reste} ₪</p>
      <div className="tb-actions">
        {wa && <a className="tb-bouton" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => envoyerMailClient({ nom, telephone, uid: e.uid || (e.cle && !String(e.cle).startsWith("tel_") ? e.cle : undefined) }, SUJETS.releve, r.texte).then((x) => x && setInfo(x)).catch(() => {})}>Envoyer le relevé</a>}
        <button type="button" className="dr-secondaire" onClick={() => setMois(mois === jour.slice(0, 7) ? moisPrec : jour.slice(0, 7))}>{mois === jour.slice(0, 7) ? "Mois dernier" : "Ce mois-ci"}</button>
      </div>
      {info && <p className="tdb-note">{info}</p>}
    </div>
  );
}

function FinancesFiche({ e, liste, mouvements, comptes, familles, estAdmin, qui }) {
  const faites = liste.filter((d) => d.statut === "terminee");
  const personnesQuiOntFait = [...new Set(faites.map(qui))];
  const lies = comptesDeLEntree(e, comptes);
  const [message, setMessage] = useState("");
  const sauver = async (suite) => {
    setMessage("");
    try {
      await enregistrerComptes(suite);
      return true;
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
      return false;
    }
  };
  const personnes = e.famille ? [{ nom: e.famille.nom, telephone: e.famille.telephone }, ...(e.famille.nom2 ? [{ nom: e.famille.nom2, telephone: e.famille.telephone2 || "" }] : []), ...(e.famille.membres || []).filter((m) => m.age === "adulte").map((m) => ({ nom: m.nom, telephone: m.telephone }))] : [{ nom: e.nom, telephone: e.telephone }];
  const sansCompte = personnes.filter((p) => p.nom && !lies.some((c) => c.nom.toLowerCase() === p.nom.toLowerCase()));
  return (
    <section className="tdb-bloc">
      <Totaux titre={estAdmin && personnesQuiOntFait.length > 1 ? "Total" : ""} faites={faites} mouvements={mouvements} />
      {estAdmin && personnesQuiOntFait.length > 1 && personnesQuiOntFait.map((n) => <Totaux key={n} titre={n} faites={faites.filter((d) => qui(d) === n)} mouvements={mouvements} />)}
      {!estAdmin && <p className="tdb-note">Seulement les courses que tu as faites pour cette cliente.</p>}
      {estAdmin && e.famille && e.famille.categorie === "commercants" && <ReleveCommercant e={e} liste={liste} mouvements={mouvements} />}
      {estAdmin && <Releve e={e} liste={liste} mouvements={mouvements} lies={lies} />}
      {lies.map((c) => (
        <div key={c.id} className="bloc">
          <Compte c={c} comptes={comptes} demandes={liste} mouvements={mouvements} sauver={sauver} familles={familles} retour={null} message={message} />
        </div>
      ))}
      {estAdmin && sansCompte.length > 0 && (
        <div className="bloc">
          <p className="tdb-note">Comptes entre nous (paiements plus tard, avances, troc, dettes) :</p>
          {sansCompte.map((p) => (
            <button key={p.nom} type="button" className="dr-secondaire" onClick={() => sauver([...comptes, { id: nouvelIdCompte(), nom: p.nom, telephone: p.telephone || "", famille: e.famille ? e.famille.id : "", note: "", lignes: [] }])}>+ Ouvrir un compte pour {p.nom}</button>
          ))}
        </div>
      )}
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </section>
  );
}

// RÉSUMÉ (19 nov. 2026) : l'essentiel de la cliente d'un coup d'œil, calculé avec ce qui est déjà enregistré
const dFr = (d) => (d ? d.split("-").reverse().join("/") : "");
function ResumeFiche({ r }) {
  if (!r.nbPrestations && !r.cartes.length) return null;
  return (
    <section className="tdb-bloc">
      <p className="tdb-note">
        {r.fidele && <strong>⭐ Cliente fidèle · </strong>}
        {r.inactive && <strong>💤 Plus de nouvelles depuis {r.depuisJours} jours · </strong>}
        {r.nbPrestations} prestation(s) terminée(s){r.derniere ? `, la dernière le ${dFr(r.derniere)}` : ""}
        {r.frequenceJours ? (r.frequenceJours <= 1 ? " · environ tous les jours" : ` · environ tous les ${r.frequenceJours} jours`) : ""}
      </p>
      {r.nbPrestations > 0 && <p className="tdb-note">Panier moyen {r.panierMoyen} ₪ · total payé {Math.round(r.depenses)} ₪{r.resteAPayer > 0 ? ` · reste à payer ${Math.round(r.resteAPayer)} ₪` : ""}</p>}
      {r.cartes.length > 0 && <p className="tdb-note">🎁 Cartes cadeaux : {r.cartesOffertes} offerte(s), {r.cartesRecues} reçue(s){r.cartes.filter((c) => c.statut === "active").length ? ` · solde actif ${r.cartes.filter((c) => c.statut === "active").reduce((t, c) => t + (Number(c.solde) || 0), 0)} ₪` : ""}</p>}
    </section>
  );
}

// RESTAURANTS ET COMMERÇANTS PARTENAIRES, version simple (19 nov. 2026) : contrat (Annexe 1) dans la fiche
function ContratPro({ f, changer }) {
  const c = contratDe(f);
  const [km, setKm] = useState("");
  const maj = (k, v) => changer({ ...f, contratPro: { ...c, [k]: v } });
  const nombre = (k, label) => (
    <label className="champ">{label}
      <input inputMode="decimal" value={c[k]} onChange={(x) => maj(k, Number(x.target.value.replace(/[^0-9.]/g, "")) || 0)} />
    </label>
  );
  const conseil = prixPro(c, km);
  return (
    <div className="bloc">
      <p className="rp-type">🍕 Contrat de livraison (commerçant partenaire)</p>
      <label className="champ">Formule
        <select value={c.formule} onChange={(x) => maj("formule", x.target.value)}>{FORMULES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      </label>
      {nombre("jusqua3", "Livraison jusqu'à 3 km (₪)")}
      {nombre("de3a6", "Livraison de 3 à 6 km (₪)")}
      {nombre("enPlus", "Commande en plus dans la même tournée (₪)")}
      {c.formule === "B" && nombre("minimumCreneau", "Minimum de livraisons payées par créneau")}
      {c.formule === "B" && (
        <label className="champ">Créneaux réservés
          <input value={c.creneaux} maxLength={120} placeholder="Ex. : jeudi 18h-21h, samedi soir" onChange={(x) => maj("creneaux", x.target.value)} />
        </label>
      )}
      <label className="champ">Il paie chaque dimanche par
        <select value={c.moyen} onChange={(x) => maj("moyen", x.target.value)}>{["Bit", "Revolut", "Espèces", "Virement"].map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label className="champ">Prix conseillé : km de la course
        <input inputMode="decimal" value={km} onChange={(x) => setKm(x.target.value.replace(/[^0-9.]/g, ""))} placeholder="ex. 2.5" />
      </label>
      {km && <p className="tdb-note">{conseil != null ? `Prix pro : ${conseil} ₪ (commande en plus : ${c.enPlus} ₪).` : "Au-delà de 6 km : sur devis."}</p>}
      <p className="tdb-note">Ses livraisons : envoyées par son lien privé (ci-dessous) ou saisies par toi (« 🍕 Commande WhatsApp » en haut de l'espace privé). Elles arrivent dans son relevé de la semaine (onglet Finances).</p>
    </div>
  );
}

const jourJ = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const dfr = (d) => d.split("-").reverse().join("/");
function ReleveCommercant({ e, liste, mouvements }) {
  const { moi } = useEquipeContexte();
  const [semaine, setSemaine] = useState(() => semaineDecalee(semaineDe(jourJ()), new Date().getDay() === 0 ? -1 : 0));
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const c = contratDe(e.famille);
  const r = releveSemaine(liste, mouvements, semaine);
  const nom = (e.famille && e.famille.nom) || e.nom;
  const payer = async () => {
    const lignes = paiementsSemaine(r, c.moyen, jourJ()).map((m) => ({ ...m, ...champOperateur(moi) }));
    const err = lignes.map((m) => validerMouvement(m, TARIFS)).find(Boolean);
    if (err) return setInfo(err);
    if (!window.confirm(`Noter ${r.reste} ₪ reçus de ${nom} par ${c.moyen} pour la semaine du ${dfr(r.debut)} ?`)) return undefined;
    setEnCours(true);
    try {
      for (const m of lignes) await addDoc(collection(db, "mouvements"), { ...m, creeLe: serverTimestamp() });
      setInfo("✓ Semaine payée : c'est noté dans Finances.");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
    return undefined;
  };
  return (
    <div className="bloc">
      <p className="rp-type">🍕 Relevé de la semaine</p>
      <div className="tb-actions">
        <button type="button" className="tb-bouton tb-clair" onClick={() => setSemaine(semaineDecalee(semaine, -1))}>←</button>
        <span className="tdb-note">du {dfr(r.debut)} au {dfr(r.fin)} · paiement le {dfr(r.paiementLe)}</span>
        <button type="button" className="tb-bouton tb-clair" onClick={() => setSemaine(semaineDecalee(semaine, 1))}>→</button>
      </div>
      {r.lignes.length === 0 ? <p className="tdb-note">Aucune livraison terminée cette semaine.</p> : (
        <ul className="pm-resume">
          {r.lignes.map((l) => (
            <li key={l.d.id}><span>{dfr(l.d.date)}{l.d.heure ? ` ${l.d.heure.replace(":", "h")}` : ""} · {l.d.nom || "livraison"}</span><strong>{l.du} ₪ <small>{l.reste === 0 ? "· payé" : `· reste ${l.reste} ₪`}</small></strong></li>
          ))}
        </ul>
      )}
      <p className="tdb-note"><b>{r.nb} livraison{r.nb > 1 ? "s" : ""} · dû {r.du} ₪ · payé {r.paye} ₪ · reste {r.reste} ₪</b></p>
      <div className="tb-actions">
        {e.telephone && r.nb > 0 && <a className="tb-bouton" href={lienWhatsApp(e.telephone, messageReleve(nom, r, c))} target="_blank" rel="noopener noreferrer">💬 Envoyer le relevé</a>}
        {r.reste > 0 && <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={payer}>✓ Semaine payée ({r.reste} ₪ · {c.moyen})</button>}
      </div>
      {info && <p className="tdb-note" role="status">{info}</p>}
    </div>
  );
}
