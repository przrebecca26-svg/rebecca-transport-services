import { useEffect, useMemo, useState } from "react";
import { calculerTrajetSur, dureeAvecTrafic, googleActif } from "../routing.js";
import { departConseille, departIso, enHeure, trajetsDuJour } from "../pricing/traficMatin.js";

// TRAFIC DE CE MATIN (17 nov. 2026) - vue Jour du Calendrier, aujourd'hui seulement.
// A la premiere ouverture de la journee, chaque trajet est recalcule avec le trafic reel de Google ; le resultat
// est garde pour la journee sur ce telephone (aucun nouvel appel a chaque ouverture). « Actualiser » recalcule.
const CLE = "rs_trafic_";
const lire = (jour) => {
  try {
    return JSON.parse(window.localStorage.getItem(CLE + jour) || "null");
  } catch {
    return null;
  }
};
const ecrire = (jour, v) => {
  try {
    window.localStorage.setItem(CLE + jour, JSON.stringify(v));
  } catch {
    /* navigation privee */
  }
};
const signature = (t) => t.filter((x) => !x.fait).map((x) => `${x.de.lat},${x.de.lon}>${x.vers.lat},${x.vers.lon}@${x.arriveeMin}`).join("|");

export default function TraficDuMatin({ jour, fil, domicile }) {
  const maintenant = () => {
    const [h, m] = new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
    return h * 60 + m;
  };
  const trajets = useMemo(() => trajetsDuJour(fil, domicile, 0), [fil, domicile]);
  const sig = signature(trajets);
  const [res, setRes] = useState(() => lire(jour));
  const [etat, setEtat] = useState("");

  const calculer = async () => {
    if (!googleActif()) return setEtat("Ajoute ta clé Google (Répertoire) pour avoir le trafic réel.");
    setEtat("Calcul avec le trafic…");
    const lignes = [];
    const avant = (lire(jour) || {}).lignes || [];
    let erreur = "";
    // 19 nov. 2026 : seulement les trajets pas encore faits (moins d'appels Google, liste plus claire).
    // 14h33 : un trajet en erreur n'arrete plus tout ; on garde son ancien calcul s'il y en a un.
    for (const t of trajets.filter((x) => !x.fait && x.arriveeMin > maintenant())) {
      try {
        const estime = Math.max(maintenant() + 1, t.arriveeMin - 30);
        const d = await dureeAvecTrafic(t.de, t.vers, departIso(jour, estime));
        lignes.push({ cle: t.cle, nomDe: t.nomDe, nomVers: t.nomVers, quoi: t.quoi, arriveeMin: t.arriveeMin, avec: Math.round(d.avecTrafic / 60), normal: Math.round(d.normal / 60), partir: departConseille(t.arriveeMin, d.avecTrafic), apresMin: t.apresMin, apresQuoi: t.apresQuoi });
      } catch (e) {
        erreur = e && e.message ? e.message : "Trafic indisponible";
        const vieux = avant.find((l) => l.cle === t.cle && l.arriveeMin === t.arriveeMin && l.nomDe === t.nomDe);
        if (vieux) lignes.push({ ...vieux, cle: t.cle, apresMin: t.apresMin, apresQuoi: t.apresQuoi });
        else {
          // 15h05 : trajet nouveau ou heure changée -> temps de route sans trafic (calcul gratuit), pour ne rien perdre
          try {
            const r = await calculerTrajetSur(t.de, t.vers);
            lignes.push({ cle: t.cle, nomDe: t.nomDe, nomVers: t.nomVers, quoi: t.quoi, arriveeMin: t.arriveeMin, avec: r.minutes, normal: r.minutes, sansTrafic: true, partir: departConseille(t.arriveeMin, r.minutes * 60), apresMin: t.apresMin, apresQuoi: t.apresQuoi });
          } catch { /* rien */ }
        }
      }
    }
    const v = { sig, calculeMs: Date.now(), calculeA: new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }), lignes, erreur };
    ecrire(jour, v);
    setRes(v);
    setEtat(erreur ? `${erreur} (réseau ou Google) : certains trajets gardent le calcul précédent.` : "");
  };
  // Une fois par jour (ou si la journee a change) : calcul automatique a l'ouverture
  useEffect(() => {
    if (trajets.length && (!res || res.sig !== sig)) calculer();
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  // 19 nov. 2026 (Rebecca : « je dois actualiser, ce n'est pas à jour ») : recalcul tout seul toutes les 20 minutes
  useEffect(() => {
    const t = setInterval(() => {
      const r = lire(jour);
      if (trajets.length && (!r || !r.calculeMs || Date.now() - r.calculeMs > 20 * 60000)) calculer();
    }, 60000);
    return () => clearInterval(t);
  }, [jour, sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trajets.length) return null;
  const now = maintenant();
  // Trajet fait (etape cochee) ou arrivee passee : il disparait tout de suite, sans attendre le recalcul
  const faits = new Set(trajets.filter((t) => t.fait).map((t) => t.cle));
  return (
    <div className="tb-bloc">
      <h3>🚦 Trafic de ma journée</h3>
      {res && res.lignes && res.lignes.length > 0 && (
        <>
          {res.lignes.filter((l) => l.arriveeMin > now && !faits.has(l.cle)).map((l, i) => {
            const tard = l.partir < now && l.arriveeMin > now;
            return (
              <div key={i} className="tb-adresse">
                <div>
                  <p>{l.nomDe} → {l.nomVers}</p>
                  <small>{l.avec} min {l.sansTrafic ? "(sans le trafic)" : "avec le trafic"}{!l.sansTrafic && l.normal && l.avec > l.normal ? ` (normal ${l.normal} min, +${l.avec - l.normal})` : ""} · arrivée {enHeure(l.arriveeMin)}</small>
                  {l.apresMin != null && l.partir < l.apresMin && <small className="fm-erreur"> ⚠️ Tu dois partir avant la fin de « {l.apresQuoi || "ta tâche"} » ({enHeure(l.apresMin)}) : avance-la ou raccourcis-la.</small>}
                  {l.apresMin != null && l.partir >= l.apresMin && <small> · après « {l.apresQuoi || "ta tâche"} » (fini {enHeure(l.apresMin)})</small>}
                </div>
                <strong style={tard ? { color: "#e57373" } : undefined}>Partir {enHeure(l.partir)}</strong>
              </div>
            );
          })}
          <p className="tb-note">Calculé à {res.calculeA} avec le trafic réel de Google (5 min de marge comprises). Mis à jour tout seul toutes les 20 min et à chaque changement de ta journée.</p>
        </>
      )}
      {etat && <p className="tb-note">{etat}</p>}
      <button className="tb-retour aj-lien" onClick={calculer}>Actualiser</button>
    </div>
  );
}
