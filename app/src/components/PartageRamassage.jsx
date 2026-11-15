import { useEffect, useMemo, useState } from "react";
import Devis from "./Devis.jsx";
import Champ from "./Champ.jsx";
import IconeService from "./IconeService.jsx";
import Enfant from "./EnfantRamassage.jsx";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { useFermetures } from "../fermetures.js";
import { MAX_ENFANTS, PERIODES, enfantVide, manquePlan, planVide, libellePeriode } from "../pricing/ramassagePlanning.js";
import { prixFr } from "../pricing/partage.js";
import { calculerPartage, lienPartage, messagePartage, nomPartage, remplirFamille, enfantPropre, nouveauPartage, STATUTS_PARTAGE } from "../pricing/partageRamassage.js";
import { useRoutes } from "./DemandeRamassage.jsx";
import { etatAge } from "../pricing/prioriteRamassage.js";
import "../client-commun.css";
import "../ramassage-site.css";

// LIEN PERSONNEL D'UNE FAMILLE (15 nov. 2026) : #/partage/<identifiant>/<numero de la famille>.
// La famille voit le trajet partage, complete ou corrige SES enfants et leurs horaires, et voit le nouveau devis.
// Ensuite, un bouton par famille pour prevenir les autres sur WhatsApp avec le nouveau devis.

const jourDeLaDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
};

export default function PartageRamassage({ id, famille, onRetour }) {
  const reglages = useFermetures();
  const [doc, setDoc] = useState(null);
  const [etat, setEtat] = useState("chargement");
  const [enfants, setEnfants] = useState([]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [info, setInfo] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  // La 1re famille (celle qui a fait la demande) peut aussi changer les adresses, la periode et le partage
  const [commun, setCommun] = useState(null);
  const [mode, setMode] = useState("enfant");
  // 15 nov. 2026 : la 1re famille peut aussi corriger les enfants des autres familles (elle les a souvent remplis)
  const [autresEnfants, setAutresEnfants] = useState({});

  useEffect(() => {
    let actif = true;
    let arret = () => {};
    Promise.all([import("../firebase.js"), import("firebase/firestore")]).then(([{ db }, { doc: refDoc, onSnapshot }]) => {
      if (!actif) return;
      arret = onSnapshot(
        refDoc(db, "trajetsPartages", id),
        (s) => {
          if (!s.exists()) return setEtat("introuvable");
          const d = s.data();
          setDoc(d);
          setEtat("ok");
        },
        () => setEtat("introuvable")
      );
    });
    return () => {
      actif = false;
      arret();
    };
  }, [id]);

  // Premiere lecture : les enfants de MA famille dans le formulaire
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (!doc || pret || !doc.familles[famille]) return;
    const f = doc.familles[famille];
    setEnfants(f.enfants.length ? f.enfants.map((e) => ({ ...enfantVide(), ...e })) : [enfantVide()]);
    setNom(f.nom || "");
    setTelephone(f.telephone || "");
    setCommun({ ...doc.commun });
    setMode(doc.modePartage === "egal" ? "egal" : "enfant");
    if (famille === 0) setAutresEnfants(Object.fromEntries(doc.familles.map((x, i) => [i, x.enfants.map((e) => ({ ...enfantVide(), ...e }))]).filter(([i]) => Number(i) > 0)));
    setPret(true);
  }, [doc, famille, pret]);

  // Le devis avec MES enfants tels que je les saisis (les autres familles : ce qui est enregistre)
  const brouillon = useMemo(
    () =>
      doc && doc.familles[famille]
        ? {
            ...doc,
            ...(famille === 0 && commun ? { commun, modePartage: mode } : {}),
            familles: doc.familles.map((f, i) => (i === famille ? { ...f, nom, telephone, enfants, rempli: true } : famille === 0 && autresEnfants[i] ? { ...f, enfants: autresEnfants[i] } : f)),
          }
        : null,
    [doc, famille, enfants, nom, telephone, commun, mode, autresEnfants]
  );
  const planRoutes = useMemo(() => (brouillon ? { ...planVide(), domicile: brouillon.commun.domicile, ecole: brouillon.commun.ecole, enfants: brouillon.familles.flatMap((f) => f.enfants) } : planVide()), [brouillon]);
  const { routes, statut } = useRoutes(planRoutes);
  const calcul = useMemo(() => (brouillon && statut === "ok" ? calculerPartage(brouillon, routes) : null), [brouillon, routes, statut, reglages]);

  if (etat === "chargement") return <p className="consigne" style={{ padding: 24 }}>Chargement…</p>;
  if (etat !== "ok" || !doc.familles[famille]) {
    return (
      <div className="formulaire">
        <div className="bloc"><p>Ce lien n'est plus valable. Demandez un nouveau lien à la famille qui vous l'a envoyé, ou écrivez à Rebecca.</p></div>
        <a className="bouton" href={lienWhatsApp(WHATSAPP, "Bonjour Rebecca, mon lien de trajet partagé ne marche pas.")} target="_blank" rel="noopener noreferrer">Écrire à Rebecca</a>
        <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
      </div>
    );
  }

  // 15 nov. 2026 : au bout de 2 semaines sans reponse de Rebecca, le trajet partage est annule (il faut refaire la demande)
  const expire = doc.statut === "en cours" && etatAge(doc.creeLe).etat === "expiree";
  const enCours = doc.statut === "en cours" && !expire;
  const monPlan = { ...planVide(), ...(brouillon ? brouillon.commun : doc.commun), enfants };
  const manqueAutres = famille === 0 ? Object.entries(autresEnfants).map(([i, l]) => (l.length ? manquePlan({ ...monPlan, enfants: l }) && `${nomPartage(doc, Number(i))} : ${manquePlan({ ...monPlan, enfants: l })}` : "")).find(Boolean) : "";
  const manque = manquePlan(monPlan) || manqueAutres || "";
  const resultat = calcul && calcul.resultat && calcul.resultat.ok ? calcul.resultat : null;
  const origine = window.location.origin + window.location.pathname;
  const jourUnique = jourDeLaDate((brouillon ? brouillon.commun : doc.commun).date);
  const seule = doc.familles.length === 1;

  const enregistrer = async () => {
    if (manque) return setInfo(manque);
    if (!String(nom).trim()) return setInfo("Indiquez le nom de votre famille.");
    try {
      const [{ db }, { doc: refDoc, updateDoc, serverTimestamp }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
      const maj = remplirFamille(doc, famille, { enfants: enfants.map(enfantPropre), nom: String(nom).trim().slice(0, 60), telephone: String(telephone).trim().slice(0, 20) });
      if (famille === 0) maj.familles = maj.familles.map((f, i) => (i > 0 && autresEnfants[i] ? { ...f, enfants: autresEnfants[i].map(enfantPropre) } : f));
      const champs = { familles: maj.familles, majLe: serverTimestamp() };
      if (famille === 0 && commun) {
        const propre = nouveauPartage(commun, [], mode);
        champs.commun = propre.commun;
        champs.modePartage = propre.modePartage;
      }
      await updateDoc(refDoc(db, "trajetsPartages", id), champs);
      setEnregistre(true);
      setInfo(seule ? "Enregistré ! Votre demande est mise à jour, elle garde sa place. Prévenez Rebecca avec le bouton ci-dessous." : "Enregistré ! Le devis est recalculé pour toutes les familles. Prévenez-les avec les boutons ci-dessous.");
    } catch {
      setInfo("Enregistrement impossible pour l'instant. Vérifiez votre connexion et réessayez.");
    }
  };

  const regler = (n) => setEnfants((l) => {
    const x = l.slice(0, n);
    while (x.length < n) x.push(enfantVide());
    return x;
  });

  return (
    <div className="formulaire rs-form">
      <header className="titre-service">
        <span aria-hidden="true"><IconeService id="ramassage" taille={40} /></span>
        <h2>{seule ? "Ma demande de ramassage" : "Ramassage scolaire partagé"}</h2>
      </header>
      <div className="bloc">
        <p>{seule ? "Votre demande" : <><strong>{doc.familles.length} familles</strong> partagent les trajets</>} · {STATUTS_PARTAGE[doc.statut] || doc.statut}</p>
        {doc.commun.domicile && <p className="note">Domicile : {doc.commun.domicile.label}</p>}
        {doc.commun.ecole && <p className="note">École : {doc.commun.ecole.label}</p>}
        {!seule && <p className="note">Partage de la note : {doc.modePartage === "egal" ? "parts égales" : "par enfant (chaque famille paie pour ses enfants)"}</p>}
        <ul className="rs-familles">
          {doc.familles.map((f, i) => (
            <li key={i}>
              <span>{nomPartage(doc, i)}{i === famille ? " (vous)" : ""}</span>
              <b>{f.enfants.length ? `${f.enfants.length} enfant${f.enfants.length > 1 ? "s" : ""}` : "en attente"}{calcul && calcul.parFamille[i].montant != null ? ` · ${prixFr(calcul.parFamille[i].montant)} ₪` : ""}</b>
            </li>
          ))}
        </ul>
      </div>

      {enCours ? (
        <>
          {famille === 0 && commun && (
            <div className="bloc">
              <h3>Adresses et période</h3>
              <Champ champ={{ name: "domicile", label: "Adresse du domicile", type: "adresse", required: true }} valeurs={commun} onChange={(n, x) => setCommun((o) => ({ ...o, [n]: x }))} />
              <Champ champ={{ name: "ecole", label: "Adresse de l'école", type: "adresse", required: true }} valeurs={commun} onChange={(n, x) => setCommun((o) => ({ ...o, [n]: x }))} />
              <div className="choix rs-trois">
                {PERIODES.map((o) => (
                  <button key={o.v} type="button" className={commun.periode === o.v ? "actif" : ""} aria-pressed={commun.periode === o.v} onClick={() => setCommun((c) => ({ ...c, periode: o.v }))}>{o.l}</button>
                ))}
              </div>
              <label htmlFor="rs-p-date">{commun.periode === "jour" ? "Date *" : "Premier jour (facultatif)"}</label>
              <input id="rs-p-date" type="date" value={commun.date || ""} onChange={(e) => setCommun((c) => ({ ...c, date: e.target.value }))} />
              {!seule && (
                <div className="choix rs-deux">
                  <button type="button" className={mode === "enfant" ? "actif" : ""} aria-pressed={mode === "enfant"} onClick={() => setMode("enfant")}>Par enfant</button>
                  <button type="button" className={mode === "egal" ? "actif" : ""} aria-pressed={mode === "egal"} onClick={() => setMode("egal")}>Parts égales</button>
                </div>
              )}
            </div>
          )}
          <div className="bloc">
            <h3>Votre famille</h3>
            <label htmlFor="rs-p-nom">Nom</label>
            <input id="rs-p-nom" type="text" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
            <label htmlFor="rs-p-tel">Téléphone (WhatsApp)</label>
            <input id="rs-p-tel" type="tel" inputMode="tel" maxLength={20} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            <span className="indice">Nombre d'enfants</span>
            <div className="choix rs-quatre" role="group" aria-label="Nombre d'enfants">
              {Array.from({ length: MAX_ENFANTS }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button" className={enfants.length === n ? "actif" : ""} aria-pressed={enfants.length === n} onClick={() => regler(n)}>{n}</button>
              ))}
            </div>
          </div>
          {enfants.map((e, i) => (
            <Enfant key={i} site enfant={e} index={i} periode={(brouillon ? brouillon.commun : doc.commun).periode} jourUnique={jourUnique} changer={(n) => setEnfants((l) => l.map((x, j) => (j === i ? n : x)))} />
          ))}
          {famille === 0 && Object.keys(autresEnfants).map((k) => {
            const i = Number(k);
            const liste = autresEnfants[i] || [];
            const regler2 = (n) => setAutresEnfants((o) => {
              const x = (o[i] || []).slice(0, n);
              while (x.length < n) x.push(enfantVide());
              return { ...o, [i]: x };
            });
            return (
              <div key={"autre" + i}>
                <div className="bloc">
                  <h3>Enfants de {nomPartage(doc, i)}</h3>
                  <span className="indice">{doc.familles[i].rempli ? "Elle a déjà rempli ses enfants : ne changez que si elle vous l'a demandé." : "Elle ne les a pas encore remplis : vous pouvez le faire pour elle (0 = elle les remplira)."}</span>
                  <div className="choix rs-cinq" role="group" aria-label={`Nombre d'enfants de ${nomPartage(doc, i)}`}>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className={liste.length === n ? "actif" : ""} aria-pressed={liste.length === n} onClick={() => regler2(n)}>{n}</button>
                    ))}
                  </div>
                </div>
                {liste.map((e, j) => (
                  <Enfant key={j} site enfant={e} index={j} famille={nomPartage(doc, i)} periode={(brouillon ? brouillon.commun : doc.commun).periode} jourUnique={jourUnique} changer={(n) => setAutresEnfants((o) => ({ ...o, [i]: (o[i] || []).map((x, y) => (y === j ? n : x)) }))} />
                ))}
              </div>
            );
          })}
        </>
      ) : (
        <div className="bloc">
          {expire || doc.statut === "annulee" || doc.statut === "refusee" ? (
            <p>Cette demande n'est plus active (refusée ou annulée par Rebecca, ou plus de 2 semaines sans réponse). Si vous voulez toujours le ramassage, refaites le devis et la demande sur le site.</p>
          ) : (
            <p>Rebecca a {doc.statut === "acceptee" ? "accepté" : "répondu à"} ce trajet partagé : il ne se modifie plus ici. Pour un changement, écrivez-lui.</p>
          )}
          {(expire || doc.statut === "annulee" || doc.statut === "refusee") && <a className="bouton" href="#/ramassage">Refaire le devis</a>}
        </div>
      )}

      <Devis resultat={manque ? null : resultat} trajet={statut === "chargement" ? { statut: "chargement" } : null} pretPourCalcul={!manque} manque={manque} />
      {resultat && calcul && (
        <section className="devis attente">
          <p className="note">Devis {libellePeriode(calcul.plan, resultat)}.</p>
          <p className="note"><strong>Votre part : {calcul.parFamille[famille].montant != null ? `${prixFr(calcul.parFamille[famille].montant)} ₪` : "—"}</strong></p>
          {calcul.parFamille.filter((p) => p.montant == null).map((p, i) => <p className="note" key={i}>• {p.nom} : en attente de ses enfants (prix provisoire).</p>)}
        </section>
      )}

      {info && <p className="note" role="status">{info}</p>}
      {enCours && (
        <div className="barre-envoi">
          <div className="barre-prix">{calcul && calcul.parFamille[famille].montant != null ? <strong>{prixFr(calcul.parFamille[famille].montant)} ₪</strong> : <span>Devis</span>}</div>
          <button type="button" className="bouton" onClick={enregistrer}>{famille === 0 ? "Enregistrer les changements" : "Enregistrer mes enfants"}</button>
        </div>
      )}

      {(enregistre || doc.statut === "acceptee") && (
        <div className="bloc">
          <h3>{seule ? "Prévenir Rebecca" : "Prévenir les autres"}</h3>
          {brouillon.familles.map((f, i) => (i === famille || !f.telephone ? null : (
            <a key={i} className="bouton rs-whatsapp" href={lienWhatsApp(f.telephone, messagePartage({ ...brouillon, familles: brouillon.familles.map((x, j) => (j === i ? { ...x, rempli: x.rempli } : x)) }, i, lienPartage(origine, id, i), calcul, nom))} target="_blank" rel="noopener noreferrer">
              Envoyer le nouveau devis à {nomPartage(brouillon, i)}
            </a>
          )))}
          <a className={seule ? "bouton" : "lien"} href={lienWhatsApp(WHATSAPP, `Bonjour Rebecca, ${nom || "une famille"} a mis à jour sa demande de ramassage scolaire${seule ? "" : " partagé"}.${calcul && calcul.resultat && calcul.resultat.ok ? `\nNouveau devis : ${prixFr(calcul.resultat.total)} ₪` : ""}\n${lienPartage(origine, id, 0)}`)} target="_blank" rel="noopener noreferrer">Prévenir Rebecca</a>
        </div>
      )}
      <button type="button" className="retour" onClick={onRetour}>← Accueil</button>
    </div>
  );
}
