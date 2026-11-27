import { useEffect, useMemo, useState } from "react";
import "../pages-pro.css";
import {
  lienPolices, lienReseauPage, lienWhatsAppPage, messageParDefaut, messageProduit, nomSection, police,
} from "../pricing/pagesPro.js";
import { useMenuFicheResto, usePhoto } from "../pagesProBase.js";
import { Panier } from "./RestosVitrine.jsx";
import { lireCarte } from "../pricing/carteResto.js";

// MOTEUR D'AFFICHAGE DES PAGES PROFESSIONNELLES (lot 1, 27 nov. 2026)
// Une seule composante dessine TOUTES les pages : le modele choisit la structure (en-tete, menu, titres, produits,
// galerie, largeur, fond, boutons), Rebecca peut tout changer. L'identite du pro (ses couleurs, ses polices, son logo)
// remplace completement celle de Rebecca Services. Mention discrete « Page réalisée par Rebecca Services » en bas.
// page = version publique (pricing/pagesPro.js pagePublique) ; largeur = largeur d'apercu (admin), sinon l'ecran.

function Img({ id, alt = "", className = "", onClick }) {
  const src = usePhoto(id);
  if (!id) return null;
  if (!src) return <div className={`pv-img-attente ${className}`} aria-hidden="true" />;
  return <img src={src} alt={alt} className={className} loading="lazy" onClick={onClick} />;
}

function Zoom({ photos, depart, onFermer }) {
  const [i, setI] = useState(depart);
  const p = photos[i];
  useEffect(() => {
    const t = (e) => { if (e.key === "Escape") onFermer(); if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length); if (e.key === "ArrowLeft") setI((x) => (x + photos.length - 1) % photos.length); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [photos.length, onFermer]);
  if (!p) return null;
  return (
    <div className="pv-zoom" role="dialog" aria-modal="true" onClick={onFermer}>
      <Img id={p.photo} alt={p.legende || ""} className="pv-zoom-img" />
      {p.legende && <p className="pv-zoom-legende">{p.legende}</p>}
      <div className="pv-zoom-boutons" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 && <button type="button" onClick={() => setI((i + photos.length - 1) % photos.length)} aria-label="Photo précédente">‹</button>}
        <span>{i + 1} / {photos.length}</span>
        {photos.length > 1 && <button type="button" onClick={() => setI((i + 1) % photos.length)} aria-label="Photo suivante">›</button>}
        <button type="button" onClick={onFermer} aria-label="Fermer">✕</button>
      </div>
    </div>
  );
}

const paragraphes = (t) => String(t || "").split(/\n{2,}|\n/).filter((x) => x.trim()).map((x, i) => <p key={i}>{x}</p>);

export default function PageProVue({ page, largeur = 0, apercu = false }) {
  const [zoom, setZoom] = useState(null);
  const [panier, setPanier] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const ficheMenu = useMenuFicheResto(page && page.type === "restaurant" ? page.restoId : "");
  const carte = page && page.carteEnLigne !== false ? lireCarte(ficheMenu.carteTexte) : [];
  const p = page || {};
  const d = p.disposition || {};
  const c = p.couleurs || {};
  const sections = p.sections || [];
  const titre = police(p.policeTitre);
  const texte = police(p.policeTexte);
  useEffect(() => {
    const id = "pv-polices";
    let l = document.getElementById(id);
    if (!l) { l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; document.head.appendChild(l); }
    l.href = lienPolices([p.policeTitre, p.policeTexte]);
  }, [p.policeTitre, p.policeTexte]);
  useEffect(() => {
    if (apercu || !p.seo) return undefined;
    const avant = document.title;
    document.title = p.seo.titre || p.nom || avant;
    return () => { document.title = avant; };
  }, [apercu, p.seo, p.nom]);

  const wa = lienWhatsAppPage(p.whatsapp || p.telephone, p.messageWhatsApp || messageParDefaut(p.nom));
  const insta = lienReseauPage("instagram", p.instagram);
  const reseaux = [
    insta && { l: "Instagram", u: insta },
    lienReseauPage("facebook", p.facebook) && { l: "Facebook", u: lienReseauPage("facebook", p.facebook) },
    lienReseauPage("tiktok", p.tiktok) && { l: "TikTok", u: lienReseauPage("tiktok", p.tiktok) },
    lienReseauPage("site", p.siteWeb) && { l: "Site web", u: lienReseauPage("site", p.siteWeb) },
    ...(p.autresLiens || []).map((x) => ({ l: x.titre, u: x.url })),
  ].filter(Boolean);
  const style = useMemo(() => ({
    "--pv-fond": c.fond, "--pv-surface": c.surface, "--pv-texte": c.texte, "--pv-doux": c.doux, "--pv-accent": c.accent, "--pv-accent2": c.accent2,
    "--pv-titre": titre.famille, "--pv-police": texte.famille,
  }), [c.fond, c.surface, c.texte, c.doux, c.accent, c.accent2, titre.famille, texte.famille]);
  const [ecran, setEcran] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1000));
  useEffect(() => {
    const t = () => setEcran(window.innerWidth);
    window.addEventListener("resize", t);
    return () => window.removeEventListener("resize", t);
  }, []);
  const etroit = (largeur || ecran) < 700;
  const classes = ["pv", `pv-entete-${d.entete}`, `pv-titres-${d.titres}`, `pv-produits-${d.produits}`, `pv-galerie-${d.galerie}`, `pv-largeur-${d.largeur}`, `pv-fond-${d.fond}`, `pv-boutons-${d.boutons}`, etroit ? "pv-mobile" : "", apercu ? "pv-apercu" : ""].join(" ");

  const boutonWa = (label = p.boutonWhatsApp, message) => (wa ? <a className="pv-bouton" href={message ? lienWhatsAppPage(p.whatsapp || p.telephone, message) : wa} target="_blank" rel="noopener noreferrer">{label}</a> : null);
  const boutonInsta = insta ? <a className="pv-bouton pv-bouton-2" href={insta} target="_blank" rel="noopener noreferrer">{p.boutonInstagram}</a> : null;
  const titreSection = (id, n) => <h2 className="pv-h2">{d.titres === "numeros" && <span className="pv-num">{String(n).padStart(2, "0")}</span>}<span>{nomSection(id)}</span></h2>;

  const resto = p.type === "restaurant";
  const contenus = {
    // Restaurants (lot R1) : A site du restaurant, B carte en ligne (panier envoye au restaurant), C menu PDF / photos
    commander: resto && (p.lienCommande || carte.length || wa) ? (
      <div>
        <div className="pv-actions">
          {p.lienCommande && <a className="pv-bouton" href={p.lienCommande} target="_blank" rel="noopener noreferrer">{p.boutonCommande} ↗</a>}
          {carte.length > 0 && wa && <button type="button" className="pv-bouton" onClick={() => setPanier(!panier)}>{panier ? "Fermer la commande" : "Commander en ligne"}</button>}
          {wa && <a className="pv-bouton pv-bouton-2" href={wa} target="_blank" rel="noopener noreferrer">{p.boutonWhatsApp}</a>}
        </div>
        <p className="pv-note">Vous commandez et payez votre repas directement au restaurant. La livraison peut être assurée par Rebecca Services selon le restaurant.</p>
        {panier && <div className="pv-panier"><Panier r={{ nom: p.nom, whatsapp: p.whatsapp || p.telephone }} carte={carte} onFermer={() => setPanier(false)} /></div>}
      </div>
    ) : null,
    menu: resto && (p.menuPdf || ficheMenu.pages.length) ? (
      <div>
        <div className="pv-actions">
          {p.menuPdf && <a className="pv-bouton pv-bouton-2" href={p.menuPdf} target="_blank" rel="noopener noreferrer">Menu (PDF)</a>}
          {ficheMenu.pages.length > 0 && <button type="button" className="pv-bouton pv-bouton-2" onClick={() => setMenuOuvert(!menuOuvert)}>{menuOuvert ? "Fermer le menu" : "Voir le menu"}</button>}
        </div>
        {menuOuvert && ficheMenu.pages.map((src, i) => <img key={i} src={src} alt={`Menu, page ${i + 1}`} className="pv-menu-page" />)}
      </div>
    ) : null,
    presentation: p.presentation ? <>{paragraphes(p.presentation)}</> : null,
    galerie: (p.galerie || []).length ? (
      <div className="pv-galerie">
        {p.galerie.map((g, i) => (
          <figure key={g.photo} className={`pv-g-item pv-g-${i % 5}`}>
            <button type="button" onClick={() => setZoom(i)} aria-label={g.legende || "Agrandir la photo"}><Img id={g.photo} alt={g.legende || ""} /></button>
            {g.legende && d.galerie === "polaroid" && <figcaption>{g.legende}</figcaption>}
          </figure>
        ))}
      </div>
    ) : null,
    produits: (p.produits || []).length ? (
      <div className="pv-produits">
        {p.produits.map((x, i) => (
          <article key={i} className="pv-produit">
            {x.photo && d.produits !== "menu" && d.produits !== "liste" && <Img id={x.photo} alt={x.nom} className="pv-produit-photo" />}
            <div className="pv-produit-texte">
              <div className="pv-produit-ligne"><h3>{x.nom}</h3>{d.produits === "menu" && <span className="pv-points" aria-hidden="true" />}{x.prix && <span className="pv-prix">{x.prix}</span>}</div>
              {x.description && <p>{x.description}</p>}
              {wa && x.nom && d.produits !== "menu" && <a className="pv-lien-produit" href={lienWhatsAppPage(p.whatsapp || p.telephone, messageProduit(x.nom))} target="_blank" rel="noopener noreferrer">Demander sur WhatsApp →</a>}
            </div>
            {x.photo && d.produits === "liste" && <Img id={x.photo} alt={x.nom} className="pv-produit-vignette" />}
          </article>
        ))}
      </div>
    ) : null,
    tarifs: p.tarifsTexte ? <div className="pv-pre">{paragraphes(p.tarifsTexte)}</div> : null,
    reservation: p.lienRdv || wa ? <div className="pv-actions">{p.lienRdv ? <a className="pv-bouton" href={p.lienRdv} target="_blank" rel="noopener noreferrer">Réserver en ligne</a> : boutonWa("Demander un rendez-vous sur WhatsApp", `Bonjour ${p.nom}, je souhaite prendre rendez-vous.`)}</div> : null,
    horaires: p.horaires ? <div className="pv-pre">{paragraphes(p.horaires)}</div> : null,
    zone: p.adressePostale || p.zone ? (
      <div>
        {p.adressePostale && <p><b>📍 {p.adressePostale}</b> · <a href={`https://waze.com/ul?q=${encodeURIComponent(p.adressePostale)}`} target="_blank" rel="noopener noreferrer">Itinéraire Waze</a></p>}
        {p.zone && <p>{p.zone}</p>}
      </div>
    ) : null,
    livraison: p.livraison ? <div className="pv-pre">{paragraphes(p.livraison)}</div> : null,
    infos: p.infos ? <div className="pv-pre">{paragraphes(p.infos)}</div> : null,
    avis: (p.avis || []).length ? (
      <div className="pv-avis">
        {p.avis.map((a, i) => <blockquote key={i}>{a.note > 0 && <span className="pv-etoiles" aria-label={`${a.note} sur 5`}>{"★".repeat(a.note)}{"☆".repeat(5 - a.note)}</span>}<p>« {a.texte} »</p>{a.nom && <cite>— {a.nom}</cite>}</blockquote>)}
      </div>
    ) : null,
    contact: (
      <div className="pv-contact">
        <div className="pv-actions">{boutonWa()}{p.telephone && <a className="pv-bouton pv-bouton-2" href={`tel:${p.telephone.replace(/[^\d+]/g, "")}`}>Appeler</a>}</div>
        {reseaux.length > 0 && <div className="pv-reseaux">{reseaux.map((r) => <a key={r.u} href={r.u} target="_blank" rel="noopener noreferrer">{r.l}</a>)}</div>}
      </div>
    ),
  };
  const visibles = sections.filter((id) => contenus[id]);

  const entete = (
    <header className="pv-entete">
      {p.couverture && <div className="pv-couverture"><Img id={p.couverture} alt="" /></div>}
      <div className="pv-entete-texte">
        {p.logo && <Img id={p.logo} alt={`Logo ${p.nom}`} className="pv-logo" />}
        {(p.specialite || p.cacherout) && <p className="pv-specialite">{[p.specialite, p.cacherout].filter(Boolean).join(" · ")}</p>}
        <h1 className="pv-h1">{p.nom}</h1>
        {p.accroche && <p className="pv-accroche">{p.accroche}</p>}
        <div className="pv-actions">
          {resto && p.lienCommande ? <a className="pv-bouton" href={p.lienCommande} target="_blank" rel="noopener noreferrer">{p.boutonCommande} ↗</a> : boutonWa()}
          {resto ? p.lienCommande && wa && <a className="pv-bouton pv-bouton-2" href={wa} target="_blank" rel="noopener noreferrer">{p.boutonWhatsApp}</a> : boutonInsta}
        </div>
      </div>
    </header>
  );

  return (
    <div className={classes} style={style} lang="fr">
      {d.menu === "ancres" && visibles.length > 2 && (
        <nav className="pv-menu" aria-label="Sections">
          <span className="pv-menu-nom">{p.nom}</span>
          <div>{visibles.filter((id) => id !== "contact").slice(0, 5).map((id) => <a key={id} href={`#pv-${id}`} onClick={(e) => { e.preventDefault(); const el = e.currentTarget.closest(".pv").querySelector(`[data-section="${id}"]`); if (el) el.scrollIntoView({ behavior: "smooth" }); }}>{nomSection(id)}</a>)}</div>
        </nav>
      )}
      {entete}
      <main className="pv-corps">
        {visibles.map((id, n) => (
          <section key={id} className={`pv-section pv-s-${id}`} data-section={id}>
            <div className="pv-section-int">
              {titreSection(id, n + 1)}
              {contenus[id]}
            </div>
          </section>
        ))}
      </main>
      <footer className="pv-pied">
        <p>© {new Date().getFullYear()} {p.nom}</p>
        <p className="pv-signature">{resto ? "Restaurant partenaire de " : "Page réalisée par "}<a href="https://rebeccaservices.com" target="_blank" rel="noopener noreferrer">Rebecca Services</a> · {resto ? "établissement indépendant" : "Prestataire indépendant"}</p>
      </footer>
      {d.flottant === "oui" && wa && <a className="pv-flottant" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WhatsApp</a>}
      {zoom !== null && <Zoom photos={p.galerie || []} depart={zoom} onFermer={() => setZoom(null)} />}
    </div>
  );
}
