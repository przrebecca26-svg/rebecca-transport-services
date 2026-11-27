import { useEffect, useMemo, useState } from "react";
import {
  annoncesActives, bannieresActives, categoriesAffichees, nombreParCategorie, misEnAvantListe, nouveauxListe, partenairesDeCategorie,
  partenairesDepuis, PRESTATIONS_REBECCA, rechercher, specialitesAffichees, texteUnivers, UNIVERS_REBECCA, villesDesPartenaires,
} from "../pricing/accueilV2.js";
import { useAccueilV2 } from "../accueilV2Base.js";
import { useAnnuairePros, useImagesPro } from "../prosBase.js";
import { useVitrineRestos } from "../vitrineRestosBase.js";
import { usePhoto } from "../pagesProBase.js";
import { SERVICES, servicesDe } from "../services.js";
import { NOM, SIGNATURE, WHATSAPP } from "../contact.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { etatDisponibilite } from "../pricing/disponibilite.js";
import { prochainesFermetures, utcVersLocal } from "../pricing/calendrier.js";
import IconeService from "./IconeService.jsx";
import IconeCategorie from "./IconeCategorie.jsx";
import AvisPublics from "./AvisPublics.jsx";
import "../nouvel-accueil.css";

// NOUVEL ACCUEIL « DEUX UNIVERS » (lot P1, 27 nov. 2026) - VERSION CACHÉE : #/nouvel-accueil
// L'accueil actuel reste en place tant que Rebecca n'a pas donné son accord. Tous les anciens liens, QR codes,
// formulaires et réservations restent les mêmes : cette page ne fait qu'y mener.
const CLE_VUE = "rs_nouvel_accueil_vue";
const lireVue = () => {
  try {
    return { onglet: "accueil", ...JSON.parse(window.sessionStorage.getItem(CLE_VUE) || "{}") };
  } catch {
    return { onglet: "accueil" };
  }
};
const LOGOS = { nails: "/brand/logo-nails-prestige.png", hair: "/brand/logo-prestige-hair.png", regenx: "/brand/logo-regenx.png", slim: "/brand/logo-prestige-slim-lift.png", epoxy: "/brand/logo-epoxy.png", digital: "/brand/logo-digital-applications.png" };
const SERVICES_PUBLICS = ["ramassage"];
const jourFr = (d) => d.split("-").reverse().join("/");

function Photo({ id, defaut, alt = "", className }) {
  const p = usePhoto(id || "");
  const src = p || defaut;
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : null;
}

/* ---------- Petites pièces ---------- */
function Etiquette({ type }) {
  if (type === "rebecca") return <span className="na-etiq na-etiq-rs">Rebecca Services</span>;
  if (type === "resto") return <span className="na-etiq">Restaurant partenaire</span>;
  return <span className="na-etiq">Partenaire indépendant</span>;
}
function CartePartenaire({ p, image = false, nouveau = false }) {
  const img = useImagesPro(image && p.type === "pro" ? p.id : "");
  return (
    <a className="na-part" href={p.lien}>
      <span className="na-part-logo">{img.logo ? <img src={img.logo} alt="" /> : <span aria-hidden="true">{p.type === "resto" ? p.icone : p.nom.slice(0, 1).toUpperCase()}</span>}</span>
      <span className="na-part-corps">
        <strong>{p.nom}</strong>
        <small>{[p.metier, String(p.villes).split(/[,;]/)[0]].filter(Boolean).join(" · ")}</small>
        <span className="na-part-etiq"><Etiquette type={p.type} />{p.verifie && <span className="na-etiq na-etiq-ok">✓ Vérifié</span>}{nouveau && <span className="na-etiq na-etiq-new">Nouveau</span>}</span>
      </span>
      <span className="na-fleche" aria-hidden="true">›</span>
    </a>
  );
}
function TuileCategorie({ c, n, onClick }) {
  return (
    <button type="button" className="na-cat" onClick={onClick}>
      {c.photo ? <Photo id={c.photo} className="na-cat-photo" /> : <span className="na-cat-icone"><IconeCategorie nom={c.icone} /></span>}
      <span className="na-cat-nom">{c.nom}</span>
      {n > 0 && <span className="na-cat-n">{n}</span>}
    </button>
  );
}
function Bannieres({ liste }) {
  if (!liste.length) return null;
  return (
    <div className="na-bannieres" role="region" aria-label="À la une">
      {liste.map((b) => {
        const corps = (
          <>
            <Photo id={b.photo} className="na-ban-photo" />
            <span className="na-ban-texte">
              {b.titre && <strong>{b.titre}</strong>}
              {b.texte && <small>{b.texte}</small>}
              {b.lien && <span className="na-ban-bouton">{b.bouton || "Découvrir"}</span>}
            </span>
          </>
        );
        return b.lien ? <a key={b.id} className="na-ban" href={b.lien} target={/^https/.test(b.lien) ? "_blank" : undefined} rel="noopener noreferrer">{corps}</a> : <div key={b.id} className="na-ban">{corps}</div>;
      })}
    </div>
  );
}
function Annonces({ liste }) {
  if (!liste.length) return null;
  return (
    <div className="na-annonces">
      {liste.map((a) => {
        const t = <><span aria-hidden="true">{a.type === "offre" ? "🎁" : "📣"}</span> {a.texte}</>;
        return a.lien ? <a key={a.id} className={"na-annonce" + (a.type === "offre" ? " offre" : "")} href={a.lien}>{t} ›</a> : <p key={a.id} className={"na-annonce" + (a.type === "offre" ? " offre" : "")}>{t}</p>;
      })}
    </div>
  );
}
function Section({ titre, sous, children, action }) {
  return (
    <section className="na-section">
      <div className="na-section-tete">
        <div><h2>{titre}</h2>{sous && <p>{sous}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------- Univers Rebecca : services de chaque univers (mêmes formulaires qu'aujourd'hui) ---------- */
function Bientot({ nom }) {
  return (
    <div className="na-bientot">
      <span><strong>{nom}</strong> · bientôt disponible</span>
      <a href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, prévenez-moi dès que ${nom} est disponible, merci !`)} target="_blank" rel="noopener noreferrer">🔔 Me prévenir</a>
    </div>
  );
}
function ServiceLigne({ s, onClick }) {
  return (
    <button type="button" className="na-service" onClick={onClick}>
      <span className="na-service-icone"><IconeService id={s.id} taille={40} /></span>
      <span className="na-service-corps"><strong>{s.titre}</strong><small>{s.texte}</small></span>
      <span className="na-service-prix">{s.prix}</span>
    </button>
  );
}
function MarqueLigne({ p, onClick }) {
  return (
    <button type="button" className="na-service" onClick={onClick}>
      <span className="na-service-icone"><img src={LOGOS[p.id]} alt="" /></span>
      <span className="na-service-corps"><strong>{p.nom}</strong><small>{p.texte}</small></span>
      <span className="na-service-prix">{p.id === "epoxy" ? "Voir" : p.id === "digital" ? "Découvrir" : "Réserver"}</span>
    </button>
  );
}
function ContenuUnivers({ id, pages, onChoix, ouvrirMarque }) {
  const voit = (x) => pages.etat(x) === "ouverte";
  const bientot = (x) => pages.etat(x) === "bientot";
  if (id === "transport") {
    const blocs = [["coursier", "Services coursier"], ["transport", "Transport privé"]];
    return blocs.map(([a, nom]) => {
      if (bientot(a)) return <Bientot key={a} nom={nom} />;
      if (voit(a)) return <div key={a} className="na-groupe"><h3>{nom}</h3>{servicesDe(a).map((s) => <ServiceLigne key={s.id} s={s} onClick={() => onChoix(s.id)} />)}</div>;
      if (a === "transport" && pages.etat(a) === "cachee" && pages.reglage(a).visible) {
        return (
          <div key={a} className="na-groupe">
            <h3>{nom}</h3>
            {servicesDe(a).filter((s) => SERVICES_PUBLICS.includes(s.id)).map((s) => <ServiceLigne key={s.id} s={s} onClick={() => onChoix(s.id)} />)}
            <p className="na-note">Les autres trajets ({servicesDe(a).filter((s) => !SERVICES_PUBLICS.includes(s.id)).map((s) => s.titre.toLowerCase()).join(", ")}) sont disponibles sur demande.</p>
            <a className="na-bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, je souhaite réserver un service de Transport privé.")} target="_blank" rel="noopener noreferrer">Me contacter sur WhatsApp</a>
          </div>
        );
      }
      return null;
    });
  }
  const marques = PRESTATIONS_REBECCA.filter((p) => p.univers === id);
  return (
    <div className="na-groupe">
      {marques.map((p) => (bientot(p.page) ? <Bientot key={p.id} nom={p.nom} /> : voit(p.page) ? <MarqueLigne key={p.id} p={p} onClick={() => ouvrirMarque(p.id)} /> : null))}
      {!marques.some((p) => voit(p.page) || bientot(p.page)) && <p className="na-note">Bientôt disponible.</p>}
    </div>
  );
}
function TuileUnivers({ u, onClick }) {
  return (
    <button type="button" className="na-univers" onClick={onClick}>
      <Photo id={u.photo} defaut={u.illustration} className="na-univers-photo" />
      <span className="na-univers-voile" />
      <span className="na-univers-texte"><img src={u.image} alt="" /><strong>{u.titre}</strong><small>{u.texte}</small></span>
    </button>
  );
}

/* ---------- Page ---------- */
export default function NouvelAccueil({ client, pages, onChoix, onCompte, onMarque, onQuitter }) {
  const config = useAccueilV2();
  const fiches = useAnnuairePros();
  const restos = useVitrineRestos();
  const [vue, setVueBrute] = useState(lireVue);
  const [texte, setTexte] = useState("");
  const [ville, setVille] = useState("");
  // Version de test : Rebecca peut aussi voir les catégories encore vides (les clientes ne les verront pas)
  const [vides, setVides] = useState(() => { try { return window.sessionStorage.getItem("rs_na_vides") === "1"; } catch { return false; } });
  const setVue = (v) => {
    setVueBrute(v);
    try { window.sessionStorage.setItem(CLE_VUE, JSON.stringify(v)); } catch { /* navigation privée */ }
    window.scrollTo(0, 0);
  };
  useEffect(() => { document.title = `${NOM} — Accueil`; }, []);

  const partenaires = useMemo(() => partenairesDepuis(fiches || [], restos || []), [fiches, restos]);
  const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const dispo = etatDisponibilite();
  const ouvert = !!(client && client.user && client.profil);
  const visibleRS = (id) => pages.etat(id) === "ouverte";
  const ouvrirMarque = (id) => onMarque(id);

  if (!config) return <p className="na-chargement">Chargement…</p>;
  const cats = vides ? config.categories.filter((c) => c.visible) : categoriesAffichees(config, partenaires);
  const nb = nombreParCategorie(config, partenaires);
  const univers = UNIVERS_REBECCA.map((u) => texteUnivers(config, u.id)).filter((u) => u.pages.some((p) => ["ouverte", "bientot"].includes(pages.etat(p)) || (p === "transport" && pages.etat(p) === "cachee" && pages.reglage(p).visible)));
  const categorie = vue.categorie && config.categories.find((c) => c.id === vue.categorie);

  const barre = (
    <nav className="na-barre" aria-label="Navigation principale">
      {[["accueil", "Accueil", "maison"], ["rebecca", "Rebecca", "etoile"], ["partenaires", "Partenaires", "grille"], ["recherche", "Recherche", null], ["compte", ouvert && client.profil.prenom ? client.profil.prenom : "Mon compte", null]].map(([id, l, ic]) => (
        <button key={id} type="button" className={vue.onglet === id ? "actif" : ""} aria-current={vue.onglet === id ? "page" : undefined} onClick={() => (id === "compte" ? onCompte() : setVue({ onglet: id }))}>
          {ic ? <IconeCategorie nom={ic} taille={22} /> : id === "recherche" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>}
          <span>{l}</span>
        </button>
      ))}
    </nav>
  );
  const enTete = (
    <header className="na-entete">
      <button type="button" className="na-marque" onClick={() => setVue({ onglet: "accueil" })}>
        <img src="/icon-512.png" alt="" />
        <span><strong>{NOM}</strong><small>Netanya · toute Israël</small></span>
      </button>
      <span className={"na-dispo" + (dispo.ouvert ? "" : " ferme")} title={dispo.detail}><span aria-hidden="true" />{dispo.ouvert ? "Disponible" : "Fermé"}</span>
    </header>
  );
  const champRecherche = (auto = false) => (
    <form className="na-recherche" role="search" onSubmit={(e) => { e.preventDefault(); if (vue.onglet !== "recherche") setVue({ onglet: "recherche" }); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input type="text" inputMode="search" enterKeyHint="search" value={texte} autoFocus={auto} placeholder="Coiffeuse, livraison, sushi, plombier…" aria-label="Rechercher un service, un professionnel, une ville" onChange={(e) => setTexte(e.target.value)} onFocus={() => vue.onglet === "accueil" && setVue({ onglet: "recherche" })} />
      {texte && <button type="button" aria-label="Effacer" onClick={() => setTexte("")}>✕</button>}
    </form>
  );
  const bandeauTest = (
    <div className="na-test" role="status">
      <span>👁️ Nouvel accueil — version de test, invisible pour les clientes
        <button type="button" className="na-test-vides" onClick={() => { const v = !vides; setVides(v); try { window.sessionStorage.setItem("rs_na_vides", v ? "1" : "0"); } catch { /* navigation privée */ } }}>{vides ? "Masquer les catégories vides (comme les clientes)" : "Voir aussi les catégories encore vides"}</button>
      </span>
      <button type="button" onClick={onQuitter}>Quitter</button>
    </div>
  );

  /* ----- Onglet Accueil ----- */
  const accueil = (
    <>
      <section className="na-hero">
        <img className="na-hero-logo" src="/icon-512.png" alt="Rebecca Services" />
        <h1>{NOM}</h1>
        <p className="na-signature">« {SIGNATURE} »</p>
        {champRecherche()}
      </section>
      <Bannieres liste={bannieresActives(config, jour)} />
      <Annonces liste={annoncesActives(config, jour)} />
      <Section titre="Rebecca Services" sous="Mes prestations, réalisées par moi et mon équipe" action={<button type="button" className="na-voir" onClick={() => setVue({ onglet: "rebecca" })}>Tout voir ›</button>}>
        <div className="na-univers-grille">
          {univers.map((u) => <TuileUnivers key={u.id} u={u} onClick={() => setVue({ onglet: "rebecca", univers: u.id })} />)}
        </div>
      </Section>
      <Section titre="Nos partenaires" sous="Professionnels, restaurants et boutiques indépendants" action={<button type="button" className="na-voir" onClick={() => setVue({ onglet: "partenaires" })}>Tout voir ›</button>}>
        <div className="na-cats">
          {cats.map((c) => <TuileCategorie key={c.id} c={c} n={nb[c.id]} onClick={() => setVue({ onglet: "partenaires", categorie: c.id })} />)}
        </div>
        {!cats.length && <p className="na-note">Les premiers partenaires arrivent bientôt.</p>}
      </Section>
      {misEnAvantListe(config, partenaires).length > 0 && (
        <Section titre="À la une" sous="Partenaires mis en avant">
          <div className="na-liste">{misEnAvantListe(config, partenaires).map((p) => <CartePartenaire key={p.cle} p={p} image />)}</div>
        </Section>
      )}
      {nouveauxListe(config, partenaires).length > 0 && (
        <Section titre="Nouveaux partenaires">
          <div className="na-liste">{nouveauxListe(config, partenaires).map((p) => <CartePartenaire key={p.cle} p={p} image nouveau />)}</div>
        </Section>
      )}
      <Section titre="Jours sans service" sous="Rebecca Services ne travaille pas pendant Chabbat et les fêtes juives">
        <ul className="na-fermetures">
          {prochainesFermetures(utcVersLocal(Date.now()).date, 3).map((f) => <li key={f.debutUtc}><strong>{f.label}</strong><span>du {jourFr(f.debut.date)} {f.debut.heure} au {jourFr(f.fin.date)} {f.fin.heure}</span></li>)}
        </ul>
      </Section>
      <div className="na-liens">
        <a href="#/cadeau">🎁 Offrir une carte cadeau</a>
        {pages.etat("restoPartenaire") === "ouverte" && <a href="#/restaurant-partenaire">🍽️ Restaurants : devenez partenaire</a>}
        {pages.etat("proInscription") === "ouverte" && <a href="#/pro">💼 Professionnels : rejoignez le réseau</a>}
        {pages.etat("coursierPartenaire") === "ouverte" && <a href="#/partenaire">🛵 Devenez coursier partenaire</a>}
      </div>
      <AvisPublics />
    </>
  );

  /* ----- Onglet Rebecca ----- */
  const uSel = vue.univers && texteUnivers(config, vue.univers);
  const rebecca = uSel ? (
    <>
      <button type="button" className="na-retour" onClick={() => setVue({ onglet: "rebecca" })}>‹ Rebecca Services</button>
      <div className="na-univers-tete">
        <Photo id={uSel.photo} defaut={uSel.illustration} className="na-univers-photo" />
        <span className="na-univers-voile" />
        <span className="na-univers-texte"><img src={uSel.image} alt="" /><strong>{uSel.titre}</strong><small>{uSel.texte}</small></span>
      </div>
      <p className="na-mention-rs">✦ Prestation réalisée par Rebecca Services</p>
      <ContenuUnivers id={uSel.id} pages={pages} onChoix={onChoix} ouvrirMarque={ouvrirMarque} />
    </>
  ) : (
    <>
      <div className="na-titre-page"><h1>Rebecca Services</h1><p>Les prestations que je réalise moi-même, avec mon équipe. Devis en direct, réservation confirmée par moi.</p></div>
      <div className="na-univers-grille large">
        {univers.map((u) => <TuileUnivers key={u.id} u={u} onClick={() => setVue({ onglet: "rebecca", univers: u.id })} />)}
      </div>
    </>
  );

  /* ----- Onglet Partenaires ----- */
  const villes = villesDesPartenaires(partenaires);
  const listeCat = categorie ? partenairesDeCategorie(config, partenaires, categorie.id, { specialite: vue.specialite || "", ville }) : [];
  const partenairesVue = categorie ? (
    <>
      <button type="button" className="na-retour" onClick={() => setVue({ onglet: "partenaires" })}>‹ Toutes les catégories</button>
      <div className="na-titre-page na-titre-cat">
        <span className="na-cat-icone grand">{categorie.photo ? <Photo id={categorie.photo} className="na-cat-photo" /> : <IconeCategorie nom={categorie.icone} taille={34} />}</span>
        <div><h1>{categorie.nom}</h1>{categorie.texte && <p>{categorie.texte}</p>}</div>
      </div>
      {(vides ? categorie.specialites.filter((s) => s.visible) : specialitesAffichees(config, partenaires, categorie)).length > 0 && (
        <div className="na-puces" role="group" aria-label="Spécialités">
          <button type="button" className={!vue.specialite ? "actif" : ""} onClick={() => setVue({ ...vue, specialite: "" })}>Tout</button>
          {(vides ? categorie.specialites.filter((s) => s.visible) : specialitesAffichees(config, partenaires, categorie)).map((s) => <button key={s.id} type="button" className={vue.specialite === s.id ? "actif" : ""} onClick={() => setVue({ ...vue, specialite: s.id })}>{s.nom}</button>)}
        </div>
      )}
      {villes.length > 1 && (
        <label className="na-ville"><span>Ville</span>
          <select value={ville} onChange={(e) => setVille(e.target.value)}><option value="">Toutes les villes</option>{villes.map((v) => <option key={v}>{v}</option>)}</select>
        </label>
      )}
      {categorie.rebecca.some((id) => visibleRS((PRESTATIONS_REBECCA.find((p) => p.id === id) || {}).page)) && (
        <div className="na-aussi">
          <h3>Aussi chez Rebecca Services</h3>
          {PRESTATIONS_REBECCA.filter((p) => categorie.rebecca.includes(p.id) && pages.etat(p.page) === "ouverte").map((p) => <MarqueLigne key={p.id} p={p} onClick={() => ouvrirMarque(p.id)} />)}
        </div>
      )}
      <p className="na-mention">Professionnels indépendants : chacun réalise ses prestations et fixe ses prix. Vous les contactez directement.</p>
      <div className="na-liste">{listeCat.map((p) => <CartePartenaire key={p.cle} p={p} image={listeCat.length <= 12} nouveau={config.nouveaux.includes(p.cle)} />)}</div>
      {!listeCat.length && <p className="na-note">Aucun partenaire {vue.specialite || ville ? "pour ce choix" : "pour le moment"}. <a href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je cherche un professionnel : ${categorie.nom}.`)} target="_blank" rel="noopener noreferrer">Demandez-moi conseil</a>.</p>}
    </>
  ) : (
    <>
      <div className="na-titre-page"><h1>Nos partenaires</h1><p>Des professionnels, restaurants et boutiques indépendants que je vous recommande. Chacun réalise lui-même ses prestations.</p></div>
      <div className="na-cats large">
        {cats.map((c) => <TuileCategorie key={c.id} c={c} n={nb[c.id]} onClick={() => setVue({ onglet: "partenaires", categorie: c.id })} />)}
      </div>
      {!cats.length && <p className="na-note">Les premiers partenaires arrivent bientôt.</p>}
    </>
  );

  /* ----- Onglet Recherche ----- */
  const res = rechercher(texte, { config, partenaires, services: SERVICES, visible: visibleRS, ville });
  const exemples = ["Coiffeuse", "Livraison", "Aéroport", "Restaurant", "Ongles", "Plombier", "Site web"];
  const recherche = (
    <>
      <div className="na-titre-page"><h1>Recherche</h1></div>
      {champRecherche(true)}
      {villes.length > 1 && (
        <label className="na-ville"><span>Ville</span>
          <select value={ville} onChange={(e) => setVille(e.target.value)}><option value="">Toutes les villes</option>{villes.map((v) => <option key={v}>{v}</option>)}</select>
        </label>
      )}
      {!texte && !ville && <div className="na-puces">{exemples.map((x) => <button key={x} type="button" onClick={() => setTexte(x)}>{x}</button>)}</div>}
      {(texte || ville) && (
        <>
          {res.rebecca.length > 0 && (
            <div className="na-resultats">
              <h3><span className="na-etiq na-etiq-rs">Rebecca Services</span> Mes prestations</h3>
              {res.rebecca.map((r) => (r.type === "service"
                ? <ServiceLigne key={r.id} s={SERVICES.find((s) => s.id === r.id)} onClick={() => onChoix(r.id)} />
                : <MarqueLigne key={r.id} p={PRESTATIONS_REBECCA.find((p) => p.id === r.id)} onClick={() => ouvrirMarque(r.id)} />))}
            </div>
          )}
          {res.categories.length > 0 && (
            <div className="na-resultats">
              <h3>Catégories partenaires</h3>
              <div className="na-puces">
                {res.categories.map((c) => <button key={c.id} type="button" onClick={() => setVue({ onglet: "partenaires", categorie: c.id, specialite: (res.specialites.find((s) => s.categorie === c.id) || {}).id || "" })}>{c.nom}{res.specialites.find((s) => s.categorie === c.id) ? ` · ${res.specialites.find((s) => s.categorie === c.id).nom}` : ""}</button>)}
              </div>
            </div>
          )}
          {res.partenaires.length > 0 && (
            <div className="na-resultats">
              <h3><span className="na-etiq">Partenaires indépendants</span></h3>
              <div className="na-liste">{res.partenaires.slice(0, 30).map((p) => <CartePartenaire key={p.cle} p={p} />)}</div>
            </div>
          )}
          {!res.rebecca.length && !res.partenaires.length && !res.categories.length && (
            <p className="na-note">Rien trouvé pour « {texte} ». <a href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, je cherche : ${texte}`)} target="_blank" rel="noopener noreferrer">Écrivez-moi</a>, je vous oriente.</p>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="na">
      {bandeauTest}
      {enTete}
      {barre}
      <div className="na-contenu">
        {vue.onglet === "rebecca" ? rebecca : vue.onglet === "partenaires" ? partenairesVue : vue.onglet === "recherche" ? recherche : accueil}
      </div>
    </div>
  );
}
