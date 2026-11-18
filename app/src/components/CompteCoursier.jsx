import { useMemo, useState } from "react";
import { tableauCoursier, bornesMois, messageReleve } from "../pricing/coursiers.js";
import "../coursiers.css";

// TABLEAU DE BORD D'UN COURSIER PARTENAIRE (Rebecca, 18 nov. 2026, 12h27)
// Le même écran pour le coursier (son espace) et pour Rebecca (elle clique sur un coursier) :
// chaque course avec son prix et son moyen de paiement, ce qu'il a déjà en main (espèces),
// ce que Rebecca a encaissé pour lui, sa part et celle de Rebecca, et ce qui reste à payer.
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const libelleMois = (m) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const decaler = (m, n) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default function CompteCoursier({ nom = "", telephone = "", courses = [], reglements = [], vueAdmin = false, moisDepart }) {
  const [mois, setMois] = useState(moisDepart || new Date().toISOString().slice(0, 7));
  const [ouverte, setOuverte] = useState("");
  const t = useMemo(() => tableauCoursier({ courses, reglements, ...bornesMois(mois) }), [courses, reglements, mois]);
  const toi = vueAdmin ? nom || "le coursier" : "toi";
  const reste = t.resteAPayer;
  const texteReste = reste > 0 ? (vueAdmin ? `Tu dois lui verser ${shekels(reste)}` : `Rebecca te doit ${shekels(reste)}`) : reste < 0 ? (vueAdmin ? `Il te doit ${shekels(-reste)}` : `Tu dois ${shekels(-reste)} à Rebecca`) : "Tout est réglé";
  const tel = String(telephone).replace(/\D/g, "").replace(/^0/, "972");
  const lienWhatsApp = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(messageReleve({ nom, periode: "de " + libelleMois(mois), compte: t }))}` : "";

  return (
    <div className="cc">
      <div className="cc-mois">
        <button className="cc-fleche" onClick={() => setMois(decaler(mois, -1))} aria-label="Mois précédent">‹</button>
        <strong>{libelleMois(mois)}</strong>
        <button className="cc-fleche" onClick={() => setMois(decaler(mois, 1))} aria-label="Mois suivant">›</button>
      </div>

      <div className={`cc-reste ${reste > 0 ? "a-payer" : reste < 0 ? "doit" : "ok"}`}>
        <span>Reste à payer</span>
        <strong>{texteReste}</strong>
      </div>

      <div className="cc-tuiles">
        <div className="cc-tuile"><span>Courses</span><strong>{t.nombre}</strong><em>{shekels(t.totalBrut)} au total</em></div>
        <div className="cc-tuile"><span>Déjà en main ({vueAdmin ? "lui" : "toi"})</span><strong>{shekels(t.gardeEnMain)}</strong><em>payé en espèces</em></div>
        <div className="cc-tuile"><span>Encaissé par Rebecca</span><strong>{shekels(t.encaisseParRebecca)}</strong><em>Bit, Revolut, PayPal, carte</em></div>
        <div className="cc-tuile"><span>Pourboires</span><strong>{shekels(t.pourboires)}</strong><em>100 % pour {toi}</em></div>
      </div>

      <section className="cc-bloc">
        <h3>Partage de l'argent</h3>
        <div className="cc-barre" aria-hidden="true">
          <i style={{ width: `${t.pctCoursier}%` }} />
        </div>
        <div className="cc-parts">
          <p><span className="cc-pastille coursier" />Part de {vueAdmin ? nom || "coursier" : "toi"} : <strong>{shekels(t.partCoursier)}</strong> ({t.pctCoursier.toLocaleString("fr-FR")} %)</p>
          <p><span className="cc-pastille rebecca" />Commission Rebecca : <strong>{shekels(t.partRebecca)}</strong> ({t.pctRebecca.toLocaleString("fr-FR")} %)</p>
        </div>
        {(t.versesAuCoursier > 0 || t.payesParCoursier > 0) && (
          <p className="cc-note">Déjà réglé ce mois-ci : {t.versesAuCoursier > 0 && `${shekels(t.versesAuCoursier)} versés par Rebecca`}{t.versesAuCoursier > 0 && t.payesParCoursier > 0 && " · "}{t.payesParCoursier > 0 && `${shekels(t.payesParCoursier)} payés à Rebecca`}</p>
        )}
      </section>

      {t.parMoyen.length > 0 && (
        <section className="cc-bloc">
          <h3>Par moyen de paiement</h3>
          {t.parMoyen.map((m) => (
            <div key={m.id} className="cc-moyen">
              <span>{m.label}</span>
              <span className="cc-gris">{m.nombre} course{m.nombre > 1 ? "s" : ""}</span>
              <strong>{shekels(m.montant)}</strong>
            </div>
          ))}
        </section>
      )}

      <section className="cc-bloc">
        <h3>Détail des courses</h3>
        {t.lignes.length === 0 && <p className="cc-gris">Aucune course terminée ce mois-ci.</p>}
        {t.lignes.map((l, i) => {
          const cle = l.id || String(i);
          const vu = ouverte === cle;
          return (
            <button key={cle} className={`cc-course ${vu ? "ouverte" : ""}`} onClick={() => setOuverte(vu ? "" : cle)}>
              <span className="cc-ligne">
                <span className="cc-date">{jj(l.date)}</span>
                <span className={`cc-badge ${l.parRebecca ? "rebecca" : "especes"}`}>{l.moyenLabel}</span>
                <strong>{shekels(l.total)}</strong>
              </span>
              {vu && (
                <span className="cc-detail">
                  <span>Prix de la course : {shekels(l.prix)}</span>
                  {l.pourboire > 0 && <span>Pourboire : {shekels(l.pourboire)}</span>}
                  <span>Commission Rebecca : − {shekels(l.partRebecca)}</span>
                  <span>Part de {vueAdmin ? nom || "coursier" : "toi"} : <strong>{shekels(l.partCoursier)}</strong></span>
                  <span className="cc-gris">{l.argent}</span>
                </span>
              )}
            </button>
          );
        })}
      </section>

      {vueAdmin && lienWhatsApp && (
        <a className="tdb-bouton cc-whatsapp" href={lienWhatsApp} target="_blank" rel="noopener noreferrer">Envoyer le relevé par WhatsApp</a>
      )}
    </div>
  );
}
