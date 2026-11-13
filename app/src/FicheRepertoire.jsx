import { useState } from "react";
import ChoixAge from "./components/ChoixAge.jsx";
import { Famille } from "./Familles.jsx";
import { Compte } from "./ComptesEntreNous.jsx";
import { enregistrerComptes, useComptes } from "./comptesBase.js";
import { enregistrerRepertoire, useRepertoire } from "./repertoireBase.js";
import { familleVide } from "./pricing/familles.js";
import { CATEGORIES, LIENS, comptesDeLEntree, demandesDeLEntree, nouveauMembre } from "./pricing/fichesRepertoire.js";
import { nouvelIdCompte } from "./pricing/comptesEntreNous.js";
import { encaisseBrut } from "./pricing/comptes.js";
import { lienWhatsApp } from "./pricing/navigation.js";

// FICHE DU REPERTOIRE (13 nov. 2026, 09h13) : une fiche par famille ou par cliente, 4 onglets.
// Membres (qui je veux : mari, mere, niece...), Enfants (ecoles, activites, horaires -> tournee), Historique (tout ce
// que j'ai fait, dates, montants), Finances (paye, reste a payer, comptes entre nous ; Rebecca seule).
const ONGLETS = [
  { id: "membres", l: "Membres" },
  { id: "enfants", l: "Enfants" },
  { id: "historique", l: "Historique" },
  { id: "finances", l: "Finances", admin: true },
];
const STATUTS = { terminee: "faite", acceptee: "à venir", "en attente": "en attente", refusee: "refusée", annulee: "annulée" };
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "");

export default function FicheRepertoire({ entree, demandes, mouvements, estAdmin, categorie, changerCategorie, retour, ouvrirFicheCliente, connues }) {
  const rep = useRepertoire();
  const { comptes } = useComptes();
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
  const liste = demandesDeLEntree(e, demandes || [], comptes);
  const onglets = ONGLETS.filter((o) => !o.admin || estAdmin);

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

      <div className="tb-filtres" role="tablist" aria-label="Fiche">
        {onglets.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id} className={"tb-filtre" + (onglet === o.id ? " actif" : "")} onClick={() => setOnglet(o.id)}>{o.l}</button>
        ))}
      </div>

      {onglet === "membres" && (
        <section className="tdb-bloc">
          {!f ? (
            <>
              <p>{entree.nom} · {entree.telephone}</p>
              <p className="tdb-note">Cliente du site. Crée sa fiche famille pour ajouter son mari, ses enfants, ses proches.</p>
              <button type="button" className="tdb-bouton" onClick={creerFamille}>Créer sa fiche famille</button>
            </>
          ) : (
            <Membres f={f} changer={changer} />
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

      {onglet === "enfants" && (
        f ? (
          <div className="formulaire dr-formulaire">
            <Famille f={f} connues={connues} ouvert ouvrir={() => {}} changer={changer} supprimer={() => window.confirm("Supprimer toute la fiche de cette famille ?") && enregistrerRepertoire(rep.lieux, rep.corrections, rep.familles.filter((x) => x.id !== f.id)).then(retour)} />
          </div>
        ) : (
          <section className="tdb-bloc"><p className="tdb-note">Crée d'abord sa fiche famille (onglet Membres).</p></section>
        )
      )}

      {onglet === "historique" && (
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
                      {d.serviceTitre || d.service}{d.details && d.details.enfants ? ` · ${d.details.enfants}` : ""}{d.details && d.details.quoi ? ` · ${d.details.quoi}` : ""} · {STATUTS[d.statut] || d.statut}
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

      {onglet === "finances" && estAdmin && <FinancesFiche e={e} liste={liste} mouvements={mouvements || []} comptes={comptes} familles={rep.familles} />}

      {f && (
        <div className="rp-enregistrer">
          <button type="button" className="tdb-bouton" onClick={enregistrer} disabled={!modifie}>{modifie ? "Enregistrer la fiche" : "Tout est enregistré"}</button>
          {message && <p className="tdb-note" role="status">{message}</p>}
        </div>
      )}
    </div>
  );
}

function Membres({ f, changer }) {
  const set = (cle, v) => changer({ ...f, [cle]: v });
  const setM = (id, cle, v) => set("membres", f.membres.map((m) => (m.id === id ? { ...m, [cle]: v } : m)));
  return (
    <>
      <div className="champ"><label>Nom de la fiche (la personne principale)<input type="text" maxLength={60} value={f.nom} onChange={(x) => set("nom", x.target.value)} /></label></div>
      <div className="champ"><label>Téléphone<input type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(x) => set("telephone", x.target.value)} /></label></div>
      <div className="champ"><label>Autre parent (facultatif)<input type="text" maxLength={60} value={f.nom2 || ""} onChange={(x) => set("nom2", x.target.value)} /></label></div>
      <div className="champ"><label>Téléphone de l'autre parent<input type="tel" inputMode="tel" maxLength={20} value={f.telephone2 || ""} onChange={(x) => set("telephone2", x.target.value)} /></label></div>
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
      {(f.enfants || []).length > 0 && <p className="tdb-note">Enfants : {f.enfants.map((x) => x.prenom || "sans prénom").join(", ")} (onglet Enfants).</p>}
    </>
  );
}

function FinancesFiche({ e, liste, mouvements, comptes, familles }) {
  const faites = liste.filter((d) => d.statut === "terminee");
  const total = faites.reduce((s, d) => s + (Number(d.prixFinal) || 0), 0);
  const recu = faites.reduce((s, d) => s + Math.min(Number(d.prixFinal) || 0, encaisseBrut(mouvements, d.id)), 0);
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
      <ul className="pm-resume">
        <li><span>Courses faites</span><strong>{shekels(total)}</strong></li>
        <li><span>Encaissé</span><strong>{shekels(recu)}</strong></li>
        <li><span>Reste à encaisser</span><strong className={total - recu > 0 ? "bl-neg" : undefined}>{shekels(total - recu)}</strong></li>
      </ul>
      {lies.map((c) => (
        <div key={c.id} className="bloc">
          <Compte c={c} comptes={comptes} demandes={liste} mouvements={mouvements} sauver={sauver} familles={familles} retour={null} message={message} />
        </div>
      ))}
      {sansCompte.length > 0 && (
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
