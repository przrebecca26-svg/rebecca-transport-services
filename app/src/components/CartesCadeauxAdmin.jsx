import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { MOYENS_CADEAU, STATUTS_CADEAU, champsActivation, dateFrCadeau, finValidite, lienCarte, statutAffiche, utiliserCarte } from "../pricing/cartesCadeaux.js";
import { lienWhatsApp } from "../pricing/navigation.js";

// CARTES CADEAUX - espace de Rebecca (18 nov. 2026) : confirmer le paiement, envoyer la carte, voir le solde.
// L'utilisation se fait surtout depuis l'agenda (💰 Encaissé → « Carte cadeau » + code), ou ici à la main.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const ORDRE = { paiement_annonce: 0, a_payer: 1, active: 2, expiree: 3, utilisee: 4, annulee: 5 };

export default function CartesCadeauxAdmin() {
  const [cartes, setCartes] = useState(null);
  const [usage, setUsage] = useState({});
  const [moyens, setMoyens] = useState({}); // 19 nov. 2026 (test C5) : Rebecca corrige le moyen reellement recu
  const [info, setInfo] = useState("");
  useEffect(() => onSnapshot(collection(db, "cartesCadeaux"), (s) => setCartes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setCartes([])), []);
  if (!cartes) return <p className="admin-texte tb-pad">Chargement…</p>;
  const maj = (id, champs) => updateDoc(doc(db, "cartesCadeaux", id), { ...champs, majLe: serverTimestamp() }).catch(() => setInfo("Enregistrement impossible (règles Firebase v26 ?)."));
  const utiliser = (c) => {
    const r = utiliserCarte(c, String(usage[c.id] || "").replace(",", "."), aujourdhui(), "manuel");
    if (r.erreur) return setInfo(r.erreur);
    maj(c.id, r);
    setUsage({ ...usage, [c.id]: "" });
    setInfo("");
  };
  const jour = aujourdhui();
  const tri = [...cartes].sort((a, b) => (ORDRE[statutAffiche(a, jour)] ?? 9) - (ORDRE[statutAffiche(b, jour)] ?? 9));
  const encours = cartes.filter((c) => statutAffiche(c, jour) === "active").reduce((s, c) => s + (Number(c.solde) || 0), 0);
  return (
    <section className="tb-liste">
      <p className="tb-note">🎁 Les clientes offrent une carte depuis l'accueil du site (lien direct : rebeccaservices.com/#/cadeau). Soldes encore à utiliser : {Math.round(encours)} ₪. Toutes les activités, valable 1 an, non remboursable.</p>
      {tri.length === 0 && <p className="admin-texte tb-pad">Aucune carte cadeau pour l'instant.</p>}
      {tri.map((c) => {
        const msgAcheteur = `Bonjour ${c.acheteurNom}, merci pour votre paiement ! 🎁 La carte cadeau pour ${c.pourNom} est active : ${lienCarte(c.id)}\nValable jusqu'au ${dateFrCadeau(finValidite(c) || champsActivation(aujourdhui()).expireLe)}, sur toutes les activités (non remboursable).\nVous pouvez l'envoyer depuis ce lien. Rebecca`;
        return (
          <div key={c.id} className="tb-bloc">
            <h3>{c.montant} ₪ · pour {c.pourNom} <small>({STATUTS_CADEAU[statutAffiche(c, jour)] || c.statut})</small></h3>
            <p className="tb-note">De {c.acheteurNom} · {c.acheteurTel} · {c.idee} · paiement : {c.moyen}{c.statut === "active" || c.statut === "utilisee" ? ` · code ${c.code} · solde ${c.solde} ₪` : ""}</p>
            {finValidite(c) && <p className="tb-note">Valable jusqu'au {dateFrCadeau(finValidite(c))}</p>}
            {c.message && <p className="tb-note">« {c.message} »</p>}
            {(c.utilisations || []).length > 0 && <p className="tb-note">Utilisée : {(c.utilisations || []).map((u) => `${u.montant} ₪ le ${String(u.quand).split("-").reverse().join("/")}`).join(", ")}</p>}
            <div className="tb-actions">
              {(c.statut === "a_payer" || c.statut === "paiement_annonce") && (
                <>
                  <select aria-label="Moyen de paiement reçu" value={moyens[c.id] || c.moyen || "Bit"} onChange={(e) => setMoyens({ ...moyens, [c.id]: e.target.value })}>
                    {MOYENS_CADEAU.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <button className="tb-bouton" onClick={() => maj(c.id, { ...champsActivation(aujourdhui()), moyen: moyens[c.id] || c.moyen || "Bit" })}>✓ Paiement reçu : activer</button>
                </>
              )}
              {c.statut === "active" && (
                <select aria-label="Corriger le moyen de paiement" value={c.moyen || ""} onChange={(e) => maj(c.id, { moyen: e.target.value })}>
                  {MOYENS_CADEAU.map((m) => <option key={m}>{m}</option>)}
                </select>
              )}
              {c.statut === "active" && <a className="tb-bouton tb-clair" href={lienWhatsApp(c.acheteurTel, msgAcheteur) || "#"} target="_blank" rel="noreferrer">💬 Envoyer la carte à {c.acheteurNom}</a>}
              {c.statut !== "annulee" && c.statut !== "utilisee" && <button className="tb-bouton tb-clair" onClick={() => window.confirm(c.statut === "active" ? "Annuler cette carte cadeau ? (Elle n'est pas remboursable : à faire seulement en cas d'erreur.)" : "Annuler cette carte cadeau ?") && maj(c.id, { statut: "annulee" })}>Annuler</button>}
            </div>
            {statutAffiche(c, jour) === "active" && (
              <div className="tb-actions">
                <input type="text" inputMode="decimal" placeholder="Montant utilisé" value={usage[c.id] || ""} onChange={(e) => setUsage({ ...usage, [c.id]: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ maxWidth: 140 }} />
                <button className="tb-bouton tb-clair" onClick={() => utiliser(c)}>Déduire</button>
              </div>
            )}
          </div>
        );
      })}
      {info && <p className="tb-note">{info}</p>}
    </section>
  );
}
