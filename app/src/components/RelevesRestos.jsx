import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { useRepertoire } from "../repertoireBase.js";
import { attenteRestos, messageReleveResto, releveResto, semaineFinie } from "../pricing/restos.js";
import { lienWhatsApp } from "../pricing/navigation.js";
import { utcVersLocal, ajouterJours } from "../pricing/calendrier.js";

// 22 nov. 2026 (Rebecca) : en bas de « Commandes restaurants »
//  - 📋 relevé de la semaine finie, prêt à envoyer à chaque restaurant (WhatsApp, e-mail), avec chaque numéro ;
//    le dimanche matin il part aussi tout seul par e-mail (robot) ;
//  - ⏱ temps d'attente au restaurant (arrivée -> récupérée) sur 30 jours, par restaurant.
export default function RelevesRestos({ restos, commandes }) {
  const rep = useRepertoire();
  const [demandes, setDemandes] = useState([]);
  const jour = utcVersLocal(Date.now()).date;
  useEffect(() => {
    getDocs(query(collection(db, "demandes"), where("date", ">=", ajouterJours(jour, -30)))).then((s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() })))).catch(() => {});
  }, [jour]);
  const semaine = semaineFinie(jour);
  const fiche = (r) => (rep.familles || []).find((f) => f.id === r.ficheId) || null;
  const attentes = attenteRestos(demandes);
  return (
    <>
      <section className="tdb-bloc" style={{ marginTop: 24 }}>
        <h2>📋 Relevés de la semaine</h2>
        <p className="tdb-note">Semaine du {semaine.debut.split("-").reverse().join("/")} au {semaine.fin.split("-").reverse().join("/")}, à payer le {semaine.paiementLe.split("-").reverse().join("/")}. Le dimanche matin, le relevé part aussi tout seul par e-mail aux restaurants qui ont une adresse.</p>
        {restos.map((r) => {
          const rel = releveResto(commandes.filter((c) => c.cle === r.cle), semaine);
          const f = fiche(r);
          const email = f && f.resto && f.resto.email;
          const texte = messageReleveResto(r.nom, rel, r.moyen);
          return (
            <div key={r.cle} className="bloc">
              <p><strong>{r.nom}</strong> · {rel.nb} livraison{rel.nb > 1 ? "s" : ""} · dû {rel.du} ₪ · payé {rel.paye} ₪ · reste {rel.reste} ₪</p>
              <div className="rp-boutons">
                {r.telephone && <a className="rp-waze" href={lienWhatsApp(r.telephone, texte)} target="_blank" rel="noopener noreferrer">💬 Envoyer par WhatsApp</a>}
                {email && <a className="rp-waze" href={`mailto:${email}?subject=${encodeURIComponent(`Relevé Rebecca Services du ${semaine.debut.split("-").reverse().join("/")} au ${semaine.fin.split("-").reverse().join("/")}`)}&body=${encodeURIComponent(texte)}`}>✉️ Par e-mail</a>}
              </div>
              {!email && <p className="tdb-note">Pas d'e-mail dans sa fiche : l'envoi automatique du dimanche ne peut pas partir.</p>}
            </div>
          );
        })}
      </section>
      <section className="tdb-bloc">
        <h2>⏱ Attente au restaurant (30 jours)</h2>
        {attentes.length === 0 && <p className="tdb-note">Pas encore de mesure : elle se fait quand tu touches « Arrivée au restaurant » puis « Récupérée ».</p>}
        {attentes.map((a) => (
          <p key={a.cle}>{a.nom} : en moyenne <strong>{a.moyenne} min</strong> · au plus {a.max} min · {a.fois} fois{a.longues ? ` · ${a.longues} fois 10 min ou plus` : ""}</p>
        ))}
      </section>
    </>
  );
}
