import { useState } from "react";

// SIMULATEUR WOLT / REBECCA SERVICES (25 nov. 2026) - pour le démarchage des restaurants.
// Wolt prend un pourcentage de chaque commande (taux selon le contrat du restaurant : modifiable ici) ;
// Rebecca Services prend un prix FIXE de livraison, quel que soit le montant. Le curseur montre l'écart qui grandit.
// Comparaison de frais seulement : Wolt apporte aussi des clients et la prise de commande.
export default function SimulateurWolt({ tarifs }) {
  const t = tarifs || { A: { jusqua3: 35, de3a6: 45 }, B: { jusqua3: 30, de3a6: 40 } };
  const formules = [
    ["A3", `À la demande · jusqu'à 3 km`, t.A.jusqua3],
    ["A6", `À la demande · 3 à 6 km`, t.A.de3a6],
    ["B3", `Créneaux réservés · jusqu'à 3 km`, t.B.jusqua3],
    ["B6", `Créneaux réservés · 3 à 6 km`, t.B.de3a6],
  ];
  const [montant, setMontant] = useState(150);
  const [taux, setTaux] = useState(27);
  const [tva, setTva] = useState(true);
  const [formule, setFormule] = useState("A3");
  const [parMois, setParMois] = useState(100);
  const prixRS = (formules.find((x) => x[0] === formule) || formules[0])[2];
  const wolt = Math.round(montant * (taux / 100) * (tva ? 1.18 : 1) * 100) / 100;
  const eco = Math.round((wolt - prixRS) * 100) / 100;
  const f = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (
    <section className="pp-bloc">
      <h3>Wolt ou Rebecca Services : combien vous reste-t-il ?</h3>
      <label className="champ">Montant de la commande : <b>{montant} ₪</b>
        <input type="range" min="50" max="400" step="10" value={montant} onChange={(e) => setMontant(Number(e.target.value))} style={{ width: "100%" }} />
      </label>
      <label className="champ">Commission Wolt de votre contrat : <b>{taux} %</b>
        <input type="range" min="15" max="35" step="1" value={taux} onChange={(e) => setTaux(Number(e.target.value))} style={{ width: "100%" }} />
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={tva} onChange={(e) => setTva(e.target.checked)} /> Ajouter la TVA (18 %) sur la commission</label>
      <label className="champ">Ma livraison
        <select value={formule} onChange={(e) => setFormule(e.target.value)}>{formules.map(([id, l, p]) => <option key={id} value={id}>{l} : {p} ₪</option>)}</select>
      </label>
      <div className="pp-avantages">
        <div className="pp-avantage"><span>🛵</span><div><b>Wolt : {f(wolt)} ₪</b><small>Il vous reste {f(montant - wolt)} ₪</small></div></div>
        <div className="pp-avantage"><span>💗</span><div><b>Rebecca Services : {prixRS} ₪</b><small>Il vous reste {f(montant - prixRS)} ₪ · même prix quel que soit le montant</small></div></div>
      </div>
      <p style={{ fontSize: "1.2rem" }}><b>{eco >= 0 ? `Vous gardez ${f(eco)} ₪ de plus par commande` : `Wolt revient ${f(-eco)} ₪ moins cher sur cette commande`}</b></p>
      <label className="champ">Commandes par mois : <b>{parMois}</b>
        <input type="range" min="10" max="500" step="10" value={parMois} onChange={(e) => setParMois(Number(e.target.value))} style={{ width: "100%" }} />
      </label>
      {eco > 0 && <p>Sur {parMois} commandes comme celle-ci : <b>{f(Math.round(eco * parMois))} ₪</b> de plus pour vous chaque mois.</p>}
      <p className="tb-note">Simulation indicative : le taux Wolt dépend de chaque contrat. Wolt apporte aussi des clients et la prise de commande ; Rebecca Services livre vos commandes directes (téléphone, WhatsApp, sur place).</p>
    </section>
  );
}
