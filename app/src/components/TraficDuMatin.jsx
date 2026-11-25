import { useEffect, useMemo, useState } from "react";
import { calculerTrajetSur, dureeAvecTrafic, googleActif } from "../routing.js";
import { jouerSon, useStylesNotif } from "../sons.js";
import { departConseille, departIso, enchainerDeparts, enHeure, trajetsDuJour } from "../pricing/traficMatin.js";

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
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const signature = (t) => t.filter((x) => !x.fait).map((x) => `${x.de.lat},${x.de.lon}>${x.vers.lat},${x.vers.lon}@${x.arriveeMin}`).join("|");

// 19 nov. 2026, 15h42 : ici = ma position quand je suis dehors (le prochain trajet part de là) ;
// appli ouverte : 2 clochettes (au choix) à l'heure de partir.
export default function TraficDuMatin({ jour, fil, domicile, ici = null, aLaMaison = false }) {
  const styles = useStylesNotif(true);
  const maintenant = () => {
    const [h, m] = new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
    return h * 60 + m;
  };
  const base = useMemo(() => trajetsDuJour(fil, domicile, 0), [fil, domicile]);
  const trajets = useMemo(() => {
    const t = base;
    if (!ici) return t;
    const now = maintenant();
    const i = t.findIndex((x) => !x.fait && x.arriveeMin > now);
    return i < 0 ? t : t.map((x, k) => (k === i ? { ...x, de: ici, nomDe: "📍 Ma position", cle: `${x.cle}@ici` } : x));
  }, [base, ici && ici.lat, ici && ici.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  // 20 nov. 2026 (erreur 429 de Google) : ma position ne relance plus tout le calcul, seulement un vrai changement de journée
  const sig = signature(base);
  const [res, setRes] = useState(() => lire(jour));
  const [etat, setEtat] = useState("");
  const [, setTic] = useState(0);
  // 22 nov. 2026, 15h51 (Rebecca au restaurant : « Me localiser » -> le Trafic disait encore « Maison → Basket,
  // partir 17h46 » alors que le bloc du haut disait 17h21 depuis le restaurant) : le trajet depuis ma position est
  // recalculé à part, seul (1 appel Google par vrai déplacement d'environ 500 m), sans relancer toute la journée.
  const depuisIci = trajets.find((x) => String(x.cle || "").endsWith("@ici")) || null;
  const [iciLigne, setIciLigne] = useState(null);
  const cleIci = depuisIci && ici ? `${depuisIci.cle}|${depuisIci.arriveeMin}|${Math.round(ici.lat * 200)}|${Math.round(ici.lon * 200)}` : "";
  useEffect(() => {
    if (!cleIci) { setIciLigne(null); return undefined; }
    let fini = false;
    const t = depuisIci;
    const base0 = { cle: t.cle, nomDe: t.nomDe, nomVers: t.nomVers, quoi: t.quoi, arriveeMin: t.arriveeMin, apresMin: t.apresMin, apresQuoi: t.apresQuoi };
    (async () => {
      try {
        if (!googleActif()) throw new Error("sans Google");
        const d = await dureeAvecTrafic(t.de, t.vers, departIso(jour, Math.max(maintenant() + 1, t.arriveeMin - 30)));
        if (!fini) setIciLigne({ ...base0, avec: Math.round(d.avecTrafic / 60), normal: Math.round(d.normal / 60), partir: departConseille(t.arriveeMin, d.avecTrafic) });
      } catch {
        try {
          const r = await calculerTrajetSur(t.de, t.vers);
          if (!fini) setIciLigne({ ...base0, avec: r.minutes, normal: r.minutes, sansTrafic: true, partir: departConseille(t.arriveeMin, r.minutes * 60) });
        } catch { /* on garde le calcul de la journée */ }
      }
    })();
    return () => { fini = true; };
  }, [cleIci]); // eslint-disable-line react-hooks/exhaustive-deps
  const sansIci = (c) => String(c || "").replace(/@ici$/, "");
  const lignesVues = (res && res.lignes ? res.lignes : []).map((l) => (iciLigne && sansIci(l.cle) === sansIci(iciLigne.cle) ? iciLigne : l));
  useEffect(() => {
    const maj = () => setTic((x) => x + 1);
    window.addEventListener("rs-etapes", maj);
    return () => window.removeEventListener("rs-etapes", maj);
  }, []);

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
        if (lignes.length) await pause(400);
        let d;
        try {
          d = await dureeAvecTrafic(t.de, t.vers, departIso(jour, estime));
        } catch (e1) {
          if (!/429/.test(String(e1 && e1.message))) throw e1;
          await pause(2500);
          d = await dureeAvecTrafic(t.de, t.vers, departIso(jour, estime));
        }
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
    const v = { sig, calculeMs: Date.now(), calculeA: new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }), lignes: enchainerDeparts(lignes), erreur };
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

  // Clochettes à l'heure de partir (une fois par trajet), appli ouverte
  useEffect(() => {
    const t = setInterval(() => {
      const r = lire(jour);
      const n = maintenant();
      for (const l of (r && r.lignes) || []) {
        if (l.partir !== n) continue;
        const cle = `rs-son-${jour}-${l.cle || l.nomDe + l.arriveeMin}`;
        try { if (sessionStorage.getItem(cle)) continue; sessionStorage.setItem(cle, "1"); } catch { /* */ }
        jouerSon(styles.partir.son);
      }
    }, 20000);
    return () => clearInterval(t);
  }, [jour, styles.partir.son]);

  if (!trajets.length) return null;
  const now = maintenant();
  // Trajet fait (etape cochee) ou arrivee passee : il disparait tout de suite, sans attendre le recalcul
  const faits = new Set(trajets.filter((t) => t.fait).map((t) => t.cle));
  // 22 nov. 2026 : « 📍 Je suis arrivée » touché sur une étape -> le trajet pour y aller disparaît
  try {
    const et = JSON.parse(localStorage.getItem(`rs-etapes-${jour}`) || "{}");
    for (const t of trajets) if (et[`${t.quoi}@${t.arriveeMin}`] && et[`${t.quoi}@${t.arriveeMin}`].arrivee) faits.add(t.cle);
  } catch { /* */ }
  // 20 nov. 2026 : déjà rentrée (« 🏠 À la maison ») -> le prochain « → Maison » ne s'affiche plus
  const prochainRetour = aLaMaison ? res && res.lignes && res.lignes.find((l) => l.arriveeMin > now && !faits.has(l.cle)) : null;
  if (prochainRetour && prochainRetour.nomVers === "Maison") faits.add(prochainRetour.cle);
  return (
    <div className="tb-bloc">
      <h3>🚦 Trafic de ma journée</h3>
      {res && res.lignes && res.lignes.length > 0 && (
        <>
          {enchainerDeparts(lignesVues).filter((l) => l.arriveeMin > now && !faits.has(l.cle)).map((l, i) => {
            const tard = l.partir < now && l.arriveeMin > now;
            return (
              <div key={i} className="tb-adresse">
                <div>
                  <p dir="ltr">{/* 20 nov. 2026 : noms en hébreu isolés, sinon la ligne s'affiche à l'envers (Alexia → Gan au lieu de Gan → Alexia) */}<bdi>{l.nomDe}</bdi> → <bdi>{l.nomVers}</bdi></p>
                  <small>{l.avec} min {l.sansTrafic ? "(sans le trafic)" : "avec le trafic"}{!l.sansTrafic && l.normal && l.avec > l.normal ? ` (normal ${l.normal} min, +${l.avec - l.normal})` : ""} · arrivée {l.enchaine ? `vers ${enHeure(l.arriveeVers)} (prévue ${enHeure(l.arriveeMin)})` : enHeure(l.arriveeMin)}</small>
                  {tard && (now + (l.avec || 0) > l.arriveeMin ? <small className="fm-erreur"> ⚠️ En partant maintenant : arrivée vers {enHeure(now + (l.avec || 0))}, environ {now + (l.avec || 0) - l.arriveeMin} min de retard.</small> : <small> · en partant maintenant : arrivée vers {enHeure(now + (l.avec || 0))}, à l'heure.</small>)}
                  {!tard && l.enchaine && (l.retardMin > 0 ? <small className="fm-erreur"> ⚠️ Pars dès ton arrivée : environ {l.retardMin} min de retard.</small> : <small> · tu pars dès ton arrivée (enchaîné)</small>)}
                  {l.apresMin != null && l.conflit && <small className="fm-erreur"> ⚠️ Tu dois partir avant la fin de « {l.apresQuoi || "ta tâche"} » ({enHeure(l.apresMin)}) : avance-la ou raccourcis-la.</small>}
                  {l.apresMin != null && !l.conflit && <small> · après « {l.apresQuoi || "ta tâche"} » (fini {enHeure(l.apresMin)})</small>}
                </div>
                {/* 22 nov. 2026, 14h11 (Rebecca, en route vers Alexia) : une heure de départ déjà passée (« Partir 13h56 » en
                    rouge à 14h03) ne sert à rien -> « Maintenant », avec l'heure d'arrivée réelle et le retard éventuel */}
                <strong style={tard && now + (l.avec || 0) > l.arriveeMin ? { color: "#e57373" } : undefined}>{tard ? "Maintenant" : `Partir ${enHeure(l.partir)}`}</strong>
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
