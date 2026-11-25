import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { MOYENS_CADEAU, STATUTS_CADEAU, champsActivation, genererCode, normaliserCode, dateFrCadeau, finValidite, lienCarte, statutAffiche, utiliserCarte } from "../pricing/cartesCadeaux.js";
import { lienWhatsApp } from "../pricing/navigation.js";

// CARTES CADEAUX - espace de Rebecca (18 nov. 2026) : confirmer le paiement, envoyer la carte, voir le solde.
// L'utilisation se fait surtout depuis l'agenda (💰 Encaissé → « Carte cadeau » + code), ou ici à la main.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const ORDRE = { paiement_annonce: 0, a_payer: 1, active: 2, expiree: 3, utilisee: 4, annulee: 5 };

export default function CartesCadeauxAdmin() {
  // 19 nov. 2026 : supprimer une carte de test (deux touches)
  const [suppr, setSuppr] = useState("");
  const [cartes, setCartes] = useState(null);
  const [usage, setUsage] = useState({});
  const [moyens, setMoyens] = useState({}); // 19 nov. 2026 (test C5) : Rebecca corrige le moyen reellement recu
  const [info, setInfo] = useState("");
  // 25 nov. 2026 (Rebecca : carte offerte pour une tombola, code RS100GAGNANT déjà imprimé) : créer / modifier une carte
  const [form, setForm] = useState(null); // null | { id?, montant, pourNom, pourTel, code, raison }
  const enregistrerForm = async () => {
    const montant = Number(String(form.montant || "").replace(",", "."));
    const code = normaliserCode(form.code || "") || genererCode();
    if (!(montant >= 1 && montant <= 5000)) return setInfo("Montant entre 1 et 5000 ₪.");
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) return setInfo("Code : 4 à 20 lettres ou chiffres.");
    if (cartes.some((c) => c.code === code && c.id !== form.id)) return setInfo(`Le code ${code} existe déjà.`);
    const pourNom = String(form.pourNom || "").trim().slice(0, 60) || "Gagnant(e)";
    try {
      if (form.id) {
        const c = cartes.find((x) => x.id === form.id) || {};
        const deja = (Number(c.montant) || 0) - (Number(c.solde) || 0);
        await maj(form.id, { code, montant, solde: Math.max(0, montant - deja), pourNom, pourTel: String(form.pourTel || "").slice(0, 30), message: String(form.raison || "").slice(0, 300) });
      } else {
        // les règles v26 exigent une création « à payer » au format RS-XXXX-XXXX : on crée puis on active tout de suite
        const ref = await addDoc(collection(db, "cartesCadeaux"), { statut: "a_payer", code: genererCode(), montant: Math.max(20, montant), solde: Math.max(20, montant), idee: "Au choix", acheteurNom: "Rebecca Services", acheteurTel: "0547380193", pourNom, pourTel: String(form.pourTel || "").slice(0, 30), message: String(form.raison || "").slice(0, 300), moyen: "Espèces", creeLe: serverTimestamp() });
        await updateDoc(ref, { ...champsActivation(aujourdhui()), code, montant, solde: montant, moyen: "Offerte", offerte: true, majLe: serverTimestamp() });
      }
      setForm(null);
      setInfo(`✓ Carte ${code} enregistrée.`);
    } catch {
      setInfo("Enregistrement impossible (connexion ou règles Firebase).");
    }
  };
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
      {!form && <div className="tb-actions"><button className="tb-bouton" onClick={() => setForm({ montant: "100", pourNom: "", pourTel: "", code: "", raison: "" })}>＋ Créer une carte cadeau (offerte, tombola…)</button></div>}
      {form && (
        <div className="tb-bloc">
          <h3>{form.id ? "Modifier la carte" : "Nouvelle carte cadeau"}</h3>
          <label className="champ">Montant (₪)<input inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} /></label>
          <label className="champ">Code (vide = code automatique)<input value={form.code} autoCapitalize="characters" placeholder="Ex : RS100GAGNANT" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
          <label className="champ">Pour qui (facultatif)<input value={form.pourNom} placeholder="Gagnant(e) de la tombola" onChange={(e) => setForm({ ...form, pourNom: e.target.value })} /></label>
          <label className="champ">Téléphone (facultatif)<input inputMode="tel" value={form.pourTel} onChange={(e) => setForm({ ...form, pourTel: e.target.value })} /></label>
          <label className="champ">Note (facultatif)<input value={form.raison} placeholder="Tombola solidaire" onChange={(e) => setForm({ ...form, raison: e.target.value })} /></label>
          <div className="tb-actions">
            <button className="tb-bouton" onClick={enregistrerForm}>Enregistrer</button>
            <button className="tb-bouton tb-clair" onClick={() => setForm(null)}>Fermer</button>
          </div>
          <p className="tb-note">La carte est active tout de suite, valable 1 an. À l'encaissement : « 💰 Encaissé » → Carte cadeau → ce code.</p>
        </div>
      )}
      {info && <p className="tb-note" role="status">{info}</p>}
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
              {suppr === c.id ? (
                <>
                  <button className="tb-bouton tb-danger" onClick={() => deleteDoc(doc(db, "cartesCadeaux", c.id)).then(() => setSuppr("")).catch(() => setInfo("Suppression impossible."))}>Oui, supprimer</button>
                  <button className="tb-bouton tb-clair" onClick={() => setSuppr("")}>Non</button>
                </>
              ) : <button className="tb-bouton tb-clair" onClick={() => setSuppr(c.id)}>Supprimer</button>}
              <button className="tb-bouton tb-clair" onClick={() => setForm({ id: c.id, montant: String(c.montant), pourNom: c.pourNom || "", pourTel: c.pourTel || "", code: c.code || "", raison: c.message || "" })}>Modifier</button>
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
    </section>
  );
}
