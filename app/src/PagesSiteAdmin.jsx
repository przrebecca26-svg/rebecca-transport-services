import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { repertoireCourant } from "./pricing/repertoire.js";
import { OU, PAGES, POUR, empreinte, reglagePage, resumePage, telPourEmpreinte } from "./pricing/pagesSite.js";
import { rechargerPagesSite } from "./pagesSiteBase.js";
import { enregistrerHebreuPros, useHebreuPros } from "./prosBase.js";

// RÉGLAGES -> PAGES DU SITE (20 nov. 2026, Rebecca) : un interrupteur par page (affichée / cachée) et un bouton
// ⚙️ Réglages : « Bientôt », ouverture programmée, pour qui, où (pages partenaires), lien direct, personnes bloquées.
// Le réglage (reglages/pages) est public : les numéros bloqués y sont seulement en empreinte (jamais en clair).
// Pour que la base suive aussi : Transport « tout le monde » -> activites/transport.public ; une activité beauté,
// Epoxy ou Digital « sur autorisation » -> activites/{id}.acces = "autorisation" ; coursiers partenaires -> reglages/partenaires.ouvert.
const ACT_REGLES = ["nails", "hair", "slim", "regenx", "epoxy", "digital"];

export default function PagesSiteAdmin() {
  const [reglages, setReglages] = useState(null);
  const [ouverte, setOuverte] = useState("");
  const [info, setInfo] = useState("");
  const [tel, setTel] = useState("");
  const [nomBloque, setNomBloque] = useState("");
  const hebreuPros = useHebreuPros();
  useEffect(() => onSnapshot(doc(db, "reglages", "pages"), (s) => setReglages(s.exists() ? s.data() : { pages: {} }), () => setReglages({ pages: {} })), []);
  if (!reglages) return <p className="tb-note tb-pad">Chargement…</p>;

  const enregistrer = async (id, r) => {
    setInfo("");
    try {
      const pages = { ...(reglages.pages || {}), [id]: r };
      await setDoc(doc(db, "reglages", "pages"), { pages, majLe: serverTimestamp() });
      // La base suit (les demandes sont aussi refusées par les règles Firebase, pas seulement cachées)
      if (id === "transport") await setDoc(doc(db, "activites", "transport"), { public: r.visible && r.pour === "tous" && !r.bientot }, { merge: true });
      if (ACT_REGLES.includes(id)) await setDoc(doc(db, "activites", id), { acces: r.pour === "autorisees" ? "autorisation" : "public" }, { merge: true });
      if (id === "coursierPartenaire") await setDoc(doc(db, "reglages", "partenaires"), { ouvert: r.visible && !r.bientot, majLe: serverTimestamp() }, { merge: true });
      rechargerPagesSite();
      setInfo("✓ Enregistré : le site le montre tout de suite (recharger la page côté cliente).");
    } catch {
      setInfo("Enregistrement impossible : vérifie la connexion.");
    }
  };
  const brut = (id) => {
    const r = reglagePage(reglages, id);
    return { visible: r.visible, bientot: r.bientot, pour: r.pour, ou: r.ou, lienDirect: r.lienDirect, ouvertureLe: r.ouvertureLe, bloques: r.bloques };
  };
  const maj = (id, k, v) => enregistrer(id, { ...brut(id), [k]: v });
  const bloquer = async (id, telephone, nom) => {
    const t = telPourEmpreinte(telephone);
    if (!t) return setInfo("Numéro de téléphone incomplet.");
    const e = await empreinte(t);
    const r = brut(id);
    if (r.bloques.some((b) => b.e === e)) return setInfo("Ce numéro est déjà bloqué sur cette page.");
    await enregistrer(id, { ...r, bloques: [...r.bloques, { e, nom: String(nom || t.slice(0, 3) + "…" + t.slice(-2)).slice(0, 60) }] });
    setTel("");
    setNomBloque("");
    return undefined;
  };
  const fiches = (repertoireCourant().familles || []).filter((f) => telPourEmpreinte(f.telephone)).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));

  return (
    <section className="tb-liste">
      <p className="tb-note tb-pad">Ce que les clientes voient sur le site. Fermer une page ne casse rien : les demandes déjà reçues, les liens déjà envoyés (espaces des restaurants, contrats, suivis) continuent de marcher.</p>
      {/* 26 nov. 2026 : l'hébreu du réseau de professionnels reste caché tant que Rebecca ne passe pas le site en deux langues */}
      <label className="tb-note tb-pad" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={hebreuPros} onChange={(e) => enregistrerHebreuPros(e.target.checked).then(() => setInfo(e.target.checked ? "✓ Hébreu affiché sur l'annuaire et l'inscription des pros." : "✓ Annuaire et inscription des pros en français seulement.")).catch(() => setInfo("Enregistrement impossible : vérifie la connexion."))} style={{ width: 22, height: 22 }} />
        Réseau de professionnels : proposer aussi l'hébreu (à activer quand la relecture sera faite)
      </label>
      <p className="tb-pad"><a className="tb-bouton tb-clair" href="/?apercu=cliente#/" target="_blank" rel="noopener noreferrer">👁️ Voir le site comme une cliente</a></p>
      {PAGES.map((p) => {
        const r = reglagePage(reglages, p.id);
        return (
          <div key={p.id} className="tb-carte" style={{ display: "block" }}>
            <span className="tb-ligne">
              <strong>{p.titre}</strong>
              <label className="tb-note" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={r.visible} onChange={(e) => maj(p.id, "visible", e.target.checked)} style={{ width: 22, height: 22 }} />
                {r.visible ? "Affichée" : "Cachée"}
              </label>
            </span>
            <span className="tb-quand">{resumePage(reglages, p.id)}</span>
            <div className="tb-actions">
              <button type="button" className="tb-filtre" onClick={() => setOuverte(ouverte === p.id ? "" : p.id)}>⚙️ Réglages</button>
              {p.lien && <a className="tb-filtre" href={p.lien} target="_blank" rel="noopener noreferrer">Voir la page</a>}
            </div>
            {ouverte === p.id && (
              <div className="bloc">
                <label className="pm-champ">Affichage
                  <select value={r.bientot ? "bientot" : "ouverte"} onChange={(e) => maj(p.id, "bientot", e.target.value === "bientot")}>
                    <option value="ouverte">Ouverte</option>
                    <option value="bientot">« Bientôt disponible » + bouton « Me prévenir » (WhatsApp)</option>
                  </select>
                </label>
                <label className="pm-champ">Ouverture programmée (facultatif) : « Bientôt » jusqu'à ce jour, puis ouverte toute seule
                  <input type="date" value={r.ouvertureLe} onChange={(e) => maj(p.id, "ouvertureLe", e.target.value)} />
                </label>
                <label className="pm-champ">Pour qui
                  <select value={r.pour} onChange={(e) => maj(p.id, "pour", e.target.value)}>{POUR.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                </label>
                {p.id === "transport" && <p className="tb-note">« Seulement les clientes que j'autorise » = comme aujourd'hui (Clients → fiche → autoriser le Transport). Le ramassage scolaire reste ouvert à tous.</p>}
                {p.id === "coursier" && r.pour !== "tous" && <p className="tb-note">⚠️ Les services coursier restent acceptés par la base pour tout le monde : ce réglage cache seulement la carte.</p>}
                {p.type === "partenaire" && (
                  <label className="pm-champ">Où elle apparaît
                    <select value={r.ou} onChange={(e) => maj(p.id, "ou", e.target.value)}>{OU.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                  </label>
                )}
                <label className="tb-note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={r.lienDirect} onChange={(e) => maj(p.id, "lienDirect", e.target.checked)} style={{ width: 22, height: 22 }} />
                  Lien direct toujours actif, même cachée (tu peux l'envoyer toi-même)
                </label>
                <p className="rp-type" style={{ marginTop: 10 }}>🚫 Personnes bloquées sur cette page</p>
                {r.bloques.length === 0 && <p className="tb-note">Personne.</p>}
                {r.bloques.map((b) => (
                  <p key={b.e} className="tb-note">{b.nom} <button type="button" className="tb-filtre" onClick={() => enregistrer(p.id, { ...brut(p.id), bloques: r.bloques.filter((x) => x.e !== b.e) })}>Débloquer</button></p>
                ))}
                <label className="pm-champ">Bloquer quelqu'un du Répertoire
                  <select value="" onChange={(e) => { const f = fiches.find((x) => x.id === e.target.value); if (f) bloquer(p.id, f.telephone, f.nom); }}>
                    <option value="">Choisir…</option>
                    {fiches.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </label>
                <div className="fi-deux">
                  <label className="pm-champ">Ou un numéro<input inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="05X-XXX-XXXX" /></label>
                  <label className="pm-champ">Nom (pour toi)<input value={nomBloque} onChange={(e) => setNomBloque(e.target.value)} /></label>
                </div>
                <button type="button" className="tb-bouton tb-clair" onClick={() => bloquer(p.id, tel, nomBloque)}>Bloquer ce numéro</button>
                <p className="tb-note">La personne voit seulement « Ce service n'est pas disponible pour le moment ». Je la reconnais quand elle est connectée à son compte ou quand elle tape ce numéro dans le formulaire ; une inconnue sans compte voit ce que voit tout le monde.</p>
              </div>
            )}
          </div>
        );
      })}
      {info && <p className="tb-note tb-pad" role="status">{info}</p>}
    </section>
  );
}
