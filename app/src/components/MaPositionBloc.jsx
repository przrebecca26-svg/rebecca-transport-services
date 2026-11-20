import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { calculerTrajetSur, dureeAvecTrafic, googleActif } from "../routing.js";
import { arrondir, bilanArrivee, dejaSurPlace, etapeIci, messageRetardCliente, ouSuisJe, PRECISION_MAX_M, prochaineEtape } from "../pricing/maPosition.js";
import { champsEtape, parentsAPrevenir } from "../pricing/finCourse.js";
import { messageRetard } from "../pricing/suiteClient.js";
import { lienWazePoint, lienWhatsApp } from "../pricing/navigation.js";
import { useRepertoire } from "../repertoireBase.js";
import { sansAttendre } from "../ecritureRapide.js";
import { boutonsEtape, boutonSuivant, messageEtape } from "../pricing/etapesEnfants.js";

// OÙ JE SUIS (19 nov. 2026, 15h42) - Calendrier, vue Jour, aujourd'hui (Rebecca seule).
// - « 🏠 Je suis rentrée » / « 🚗 Je sors » : le robot le sait ; si je suis dehors, son rappel 15 min avant une
//   course me propose « 📍 Localise-toi » (le lien ouvre l'appli et me localise).
// - À l'ouverture de l'appli (localisation déjà autorisée) : position prise toute seule, à 150 m de la maison =
//   à la maison ; position approximative -> « 📍 Préciser ma position ».
// - Dehors : temps de route jusqu'à la prochaine étape, à l'heure ou retard (« 💬 Prévenir du retard »).
// - « Tu es arrivée ? » : près de l'adresse d'une étape, « ✓ Oui, c'est fait » en un geste.
// La position exacte reste dans le téléphone ; en ligne il n'y a que « à la maison » ou « dehors ».
const REF = () => doc(db, "reglages", "alerteDemandes");
const CLE_ICI = "rs-ici";
const heureIsrael = () => new Date().toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
const dateIsrael = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const minutesMaintenant = () => { const [h, m] = heureIsrael().split(":").map(Number); return h * 60 + m; };
const enHeure = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}h${String(Math.max(0, min) % 60).padStart(2, "0")}`;
const lireIci = () => { try { const x = JSON.parse(localStorage.getItem(CLE_ICI) || "null"); return x && Date.now() - x.t < 45 * 60000 ? x : null; } catch { return null; } };
const garderIci = (x) => { try { localStorage.setItem(CLE_ICI, JSON.stringify(x)); } catch { /* navigation privée */ } };

async function minutesRoute(de, vers) {
  if (googleActif()) {
    try { return Math.round((await dureeAvecTrafic(de, vers)).avecTrafic / 60); } catch { /* calcul gratuit */ }
  }
  return (await calculerTrajetSur(de, vers)).minutes;
}

export function useIci() {
  const [ici, setIci] = useState(lireIci);
  useEffect(() => {
    const f = () => setIci(lireIci());
    window.addEventListener("rs-ici", f);
    return () => window.removeEventListener("rs-ici", f);
  }, []);
  return ici;
}

// « maison », « dehors » ou "" (pas encore dit aujourd'hui)
export function useOu() {
  const [r, setR] = useState({});
  useEffect(() => onSnapshot(REF(), (s) => setR(s.exists() ? s.data() : {}), () => {}), []);
  return String(r.ouLe || "").slice(0, 10) === dateIsrael() ? r.ou || "" : "";
}

export default function MaPositionBloc({ fil = [], domicile = null, journee = null, courses = [], jour = "" }) {
  const rep = useRepertoire();
  const [reglage, setReglage] = useState({});
  const ici = useIci();
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [route, setRoute] = useState(null); // { cle, minutes }
  const deja = useRef(false);
  useEffect(() => onSnapshot(REF(), (s) => setReglage(s.exists() ? s.data() : {}), () => {}), []);
  // 20 nov. 2026 (Rebecca : « À la maison depuis 12h44 » alors qu'elle venait de toucher « Je sors ») :
  // la localisation automatique ne contredit pas un bouton touché il y a moins de 10 minutes
  const reglageRef = useRef({});
  reglageRef.current = reglage;

  const noterOu = (ou) => sansAttendre(setDoc(REF(), { ou, ouLe: `${dateIsrael()}T${heureIsrael()}`, ouMs: Date.now(), majLe: serverTimestamp() }, { merge: true })).catch(() => setInfo("Enregistrement impossible."));

  const localiser = (silencieux = false) => new Promise((fini) => {
    if (!navigator.geolocation) { if (!silencieux) setInfo("Ce téléphone ne donne pas sa position."); return fini(null); }
    if (!silencieux) { setEnCours(true); setInfo("Recherche de ta position…"); }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const x = { lat: p.coords.latitude, lon: p.coords.longitude, precision: Math.round(p.coords.accuracy || 0), t: Date.now() };
        garderIci(x);
        window.dispatchEvent(new Event("rs-ici"));
        const ou = ouSuisJe(x, domicile);
        const r = reglageRef.current || {};
        const boutonRecent = silencieux && r.ouMs && Date.now() - r.ouMs < 10 * 60000 && r.ou && r.ou !== ou;
        if (ou && !boutonRecent) noterOu(ou);
        // 19 nov. 2026, 19h : le bouton répond toujours quelque chose (avant : rien ne s'affichait à la maison)
        if (x.precision > PRECISION_MAX_M) setInfo(`Position approximative (à ${x.precision} m près) : touche « 📍 Préciser ma position ».`);
        else if (silencieux) setInfo("");
        else setInfo(ou === "maison" ? "📍 Position trouvée : tu es à la maison." : `📍 Position trouvée (à ${x.precision} m près).`);
        setEnCours(false);
        fini(x);
      },
      () => { if (!silencieux) setInfo("Position refusée : Réglages de l'iPhone → Rebecca admin → Position → « Lorsque l'app est active »."); setEnCours(false); fini(null); },
      { enableHighAccuracy: true, maximumAge: silencieux ? 30000 : 0, timeout: 20000 }
    );
  });

  // À l'ouverture : position prise toute seule si déjà autorisée ; « ?localiser=1 » (notification) -> tout de suite
  useEffect(() => {
    if (deja.current) return;
    deja.current = true;
    const demande = /[?&]localiser=1/.test(window.location.hash);
    if (demande) {
      localiser(false);
      try { history.replaceState(null, "", window.location.pathname + window.location.hash.replace(/[?&]localiser=1/, "")); } catch { /* */ }
      return;
    }
    const auto = () => {
      if (!navigator.permissions || !navigator.permissions.query) return;
      navigator.permissions.query({ name: "geolocation" }).then((r) => { if (r.state === "granted") localiser(true); }).catch(() => {});
    };
    auto();
    const visible = () => { if (document.visibilityState === "visible") auto(); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aujourdhui = dateIsrael();
  const ou = String(reglage.ouLe || "").slice(0, 10) === aujourdhui ? reglage.ou : "";
  const quand = String(reglage.ouLe || "").slice(11, 16).replace(":", "h");
  const now = minutesMaintenant();
  const dehors = ou === "dehors";
  const ici2 = dehors ? arrondir(ici) : null;
  const prochaine = dehors && ici2 ? prochaineEtape(fil, now) : null;
  // 20 nov. 2026 : bouton Waze vers la prochaine étape, même sans position (pas besoin de descendre dans la liste)
  const suivante = dehors ? prochaine || prochaineEtape(fil, now) : null;
  const waze = suivante && suivante.adresse ? lienWazePoint(suivante.adresse) : "";
  const surAdresse = !!(prochaine && dejaSurPlace(ici, prochaine));
  const cleProchaine = prochaine && !surAdresse ? `${prochaine.cle || prochaine.texte}@${prochaine.min}@${ici2.lat},${ici2.lon}` : "";

  // Temps de route depuis ici jusqu'à la prochaine étape (une fois par position / étape)
  useEffect(() => {
    if (!prochaine || !ici2 || surAdresse) return undefined;
    let fini = false;
    minutesRoute(ici2, prochaine.adresse).then((m) => { if (!fini) setRoute({ cle: cleProchaine, minutes: m }); }).catch(() => {});
    return () => { fini = true; };
  }, [cleProchaine]); // eslint-disable-line react-hooks/exhaustive-deps

  const bilan = surAdresse ? { retard: 0, aLHeure: true, arrivee: now, partirAvant: now } : prochaine && route && route.cle === cleProchaine ? bilanArrivee(prochaine, route.minutes, now) : null;
  const ouiFait = ici ? etapeIci(fil, ici, now) : null;
  const surPlace = surAdresse || !!(ouiFait && prochaine && (ouiFait.cle || ouiFait.texte) === (prochaine.cle || prochaine.texte) && ouiFait.min === prochaine.min);

  // Liens « Prévenir du retard »
  const liensRetard = (() => {
    if (!bilan || !bilan.retard || !prochaine) return [];
    if (prochaine.tel) {
      const wa = lienWhatsApp(prochaine.tel, messageRetardCliente(prochaine.nom, bilan.retard));
      return wa ? [{ cle: "c", texte: prochaine.nom || "la cliente", wa }] : [];
    }
    return parentsAPrevenir(rep.familles || [], prochaine.texte).map((p) => ({ cle: p.famille, texte: p.nom || "les parents", wa: lienWhatsApp(p.telephone, messageRetard(p.prenoms, bilan.retard)) })).filter((x) => x.wa);
  })();

  // 20 nov. 2026 (Rebecca) : à un arrêt de la tournée, Arrivée -> Récupérés -> Je pars (ou Arrivée -> Déposés),
  // avec un message pour la maman à chaque moment. Gardé dans ce téléphone pour la journée.
  const CLE_ET = `rs-etapes-${jour || aujourdhui}`;
  const [etapes, setEtapes] = useState(() => { try { return JSON.parse(localStorage.getItem(CLE_ET) || "{}"); } catch { return {}; } });
  const arret = (() => {
    const e = ouiFait || (dehors ? suivante : null);
    return e && e.ids && !e.demandeId && (e.sorte === "prise" || e.sorte === "depose") ? e : null;
  })();
  const cleArret = arret ? `${arret.texte}@${arret.min}` : "";
  const faitsArret = (cleArret && etapes[cleArret]) || {};
  const parentsArret = arret ? parentsAPrevenir(rep.familles || [], arret.texte) : [];
  const apresArret = arret ? [...fil].filter((x) => x.min > arret.min && !x.fait && x.genre === "arret").sort((a, b) => a.min - b.min)[0] : null;
  const toucherEtape = async (b) => {
    const suite = { ...etapes, [cleArret]: { ...faitsArret, [b.id]: heureIsrael().replace(":", "h") } };
    setEtapes(suite);
    try { localStorage.setItem(CLE_ET, JSON.stringify(suite)); } catch { /* */ }
    if (b.valide) await cocher(arret);
  };
  const dernierFait = arret ? [...boutonsEtape(arret.sorte)].reverse().find((b) => faitsArret[b.id]) : null;

  const cocherIci = () => cocher(ouiFait);
  const cocher = async (e) => {
    if (!e) return;
    try {
      if (e.demandeId && e.sorte) {
        const d = courses.find((x) => x.id === e.demandeId);
        const champs = d ? champsEtape(d, e.sorte, heureIsrael()) : null;
        if (!champs) return setInfo("Ouvre la course dans le Calendrier pour la cocher.");
        await sansAttendre(updateDoc(doc(db, "demandes", d.id), { ...champs, majLe: serverTimestamp() }));
      } else if (journee && journee.valider && e.ids) {
        const msg = await journee.valider(jour, e);
        setInfo(msg || "");
      } else return;
      setInfo((x) => x || "✓ Noté.");
    } catch {
      setInfo("Enregistrement impossible. Vérifie la connexion.");
    }
  };

  return (
    <div className="tb-bloc">
      <p>
        📍 <strong>{ou === "maison" ? "🏠 À la maison" : ou === "dehors" ? "🚗 Dehors" : "Où es-tu ?"}</strong>
        {quand && ou ? <small> · depuis {quand}</small> : null}
        {ici && ici.precision > PRECISION_MAX_M ? <small> · position approximative</small> : null}
      </p>
      <div className="tb-actions">
        <button type="button" className={"tb-bouton" + (ou === "maison" ? "" : " tb-clair")} onClick={() => noterOu("maison")}>🏠 Je suis rentrée</button>
        <button type="button" className={"tb-bouton" + (ou === "dehors" ? "" : " tb-clair")} onClick={() => noterOu("dehors")}>🚗 Je sors</button>
        <button type="button" className="ag-modifier" disabled={enCours} onClick={() => localiser(false)}>{ici && ici.precision > PRECISION_MAX_M ? "📍 Préciser ma position" : "📍 Me localiser"}</button>
      </div>

      {arret && (
        <div className="ag-etape-actions">
          <p>🚸 <strong>{arret.texte}</strong>{arret.lieu ? ` · ${arret.lieu}` : ""} ({enHeure(arret.min)})</p>
          {boutonsEtape(arret.sorte).filter((b) => faitsArret[b.id]).map((b) => <p key={b.id} className="tb-note">✓ {b.l.replace(/^\S+\s/, "")} à {faitsArret[b.id]}</p>)}
          {dernierFait && parentsArret.length > 0 && (
            <div className="tb-actions">
              {parentsArret.map((pa) => {
                const wa = lienWhatsApp(pa.telephone, messageEtape(dernierFait.id, pa.prenoms, arret.lieu, faitsArret[dernierFait.id], dernierFait.id === "depart" && apresArret ? enHeure(apresArret.min) : ""));
                return wa ? <a key={pa.famille} className="tb-bouton tb-clair" href={wa} target="_blank" rel="noopener noreferrer">💬 Prévenir {pa.nom || "la maman"}</a> : null;
              })}
            </div>
          )}
          {boutonSuivant(arret.sorte, faitsArret) && (() => {
            const b = boutonSuivant(arret.sorte, faitsArret);
            return <button type="button" className="tb-bouton" onClick={() => toucherEtape(b)}>{b.l}</button>;
          })()}
        </div>
      )}

      {ouiFait && !arret && (
        <div className="ag-etape-actions">
          <p>📍 <strong>Tu es arrivée {ouiFait.lieu ? `à ${ouiFait.lieu}` : ""} ?</strong> {ouiFait.texte} ({enHeure(ouiFait.min)})</p>
          <button type="button" className="tb-bouton" onClick={cocherIci}>✓ Oui, c'est fait</button>
        </div>
      )}

      {dehors && !ici2 && <p className="tb-note">Touche « 📍 Me localiser » : ton trajet jusqu'à la prochaine étape se calcule depuis là où tu es.</p>}
      {suivante && !bilan && waze && (
        <div className="tb-actions">
          <span className="tb-note">🧭 {suivante.texte}{suivante.lieu ? ` · ${suivante.lieu}` : ""} à {enHeure(suivante.min)}</span>
          <a className="tb-bouton" href={waze} target="_blank" rel="noopener noreferrer">Waze</a>
        </div>
      )}
      {dehors && ici2 && !prochaine && <p className="tb-note">Pas d'autre étape aujourd'hui.</p>}
      {prochaine && !bilan && <p className="tb-note">Calcul du trajet depuis ta position…</p>}
      {bilan && (
        <div className="ag-etape-actions">
          <p>🧭 Prochaine : <strong>{prochaine.texte}</strong>{prochaine.lieu ? ` · ${prochaine.lieu}` : ""} à {enHeure(prochaine.min)}</p>
          {!surPlace && <p className="tb-note">Depuis ta position : {route.minutes} min de route → arrivée vers {enHeure(bilan.arrivee)}.</p>}
          {!surPlace && waze && <div className="tb-actions"><a className="tb-bouton" href={waze} target="_blank" rel="noopener noreferrer">Waze</a></div>}
          {surPlace ? (
            <p>📍 Tu es sur place.</p>
          ) : bilan.aLHeure && bilan.partirAvant <= now ? (
            <p>✅ À l'heure : pars maintenant.</p>
          ) : bilan.aLHeure ? (
            <p>✅ À l'heure : pars au plus tard à <strong>{enHeure(bilan.partirAvant)}</strong> (5 min de marge).</p>
          ) : (
            <>
              <p className="fm-erreur">⚠️ Tu seras en retard d'environ {bilan.retard} min.</p>
              <div className="tb-actions">
                {liensRetard.map((l) => <a key={l.cle} className="tb-bouton" href={l.wa} target="_blank" rel="noopener noreferrer">💬 Prévenir {l.texte} du retard</a>)}
              </div>
            </>
          )}
        </div>
      )}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
