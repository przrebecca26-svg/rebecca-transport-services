import { useState } from "react";
import { arrayUnion } from "firebase/firestore";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { ADMIN_ID, peutFaire } from "../pricing/equipe.js";
import { accepterProposition, annulerProposition, attribueA, conseilPour, libelleType, messageProposition, nomDe, proposer, refuserProposition } from "../pricing/quiFait.js";
import { useEquipeContexte } from "../equipeContexte.jsx";

// Bloc « Qui fait la course » de la fiche d'une demande (Lot J, seance J3, 9 nov. 2026)
// - 12 nov. 2026 (18h40) : transfert AVEC ACCEPTATION - toucher l'autre nom PROPOSE la course ; elle reste chez soi
//   tant que l'autre n'a pas accepte (rubrique « A accepter ») ; message WhatsApp pret pour le prevenir ;
// - conseil du vehicule le plus interessant pour cette personne (prix client inchange, seul le benefice change).

const peutFaireService = (m, service) => m.id === ADMIN_ID || peutFaire(m, service);

export default function QuiFait({ d, toutes, marge, executer, enCours }) {
  const { membres, vehicules, moi } = useEquipeContexte();
  const [prevenir, setPrevenir] = useState(null);
  const qui = attribueA(d);
  const personne = membres.find((m) => m.id === qui) || membres[0];
  const modifiable = d.statut !== "terminee" && d.statut !== "annulee" && d.statut !== "refusee";
  const choix = modifiable && d.statut === "acceptee" ? conseilPour(personne, d, { vehicules, demandes: toutes, marge }) : [];
  const enEquipe = membres.length > 1;

  // Proposer la course a l'autre (elle reste chez moi jusqu'a sa reponse)
  const changerPersonne = async (versId) => {
    const r = proposer(d, versId, moi, Date.now());
    if (r.erreur || !r.maj) return;
    const ok = await executer(r.maj);
    if (ok) {
      const vers = membres.find((m) => m.id === versId);
      const tel = versId === ADMIN_ID ? WHATSAPP : vers && vers.telephone;
      setPrevenir({ nom: nomDe(membres, versId), lien: lienWhatsApp(tel, messageProposition(d, nomDe(membres, moi), nomDe(membres, versId))) });
    } else setPrevenir(null);
  };
  const accepter = async () => {
    const r = accepterProposition(d, moi, Date.now());
    if (r.maj) await executer(r.trace ? { ...r.maj, historiqueAttribution: arrayUnion(r.trace) } : r.maj);
  };
  const refuser = async () => {
    const r = refuserProposition(d, moi, Date.now());
    if (r.maj) await executer(r.maj);
  };
  const proposeeA = modifiable && d.proposeA ? d.proposeA : null;
  const peutProposer = qui === moi || moi === ADMIN_ID;

  if (!enEquipe && choix.length <= 1) return null;

  return (
    <div className="tb-bloc qf-bloc">
      <h3>Qui fait la course</h3>
      {enEquipe && (
        <>
          {proposeeA === moi && (
            <div className="dm-verif">
              <p>{nomDe(membres, d.proposePar || qui)} te propose cette course. Elle reste chez {nomDe(membres, qui)} tant que tu n'as pas accepté.</p>
              <div className="tb-actions">
                <button type="button" className="tb-bouton" disabled={enCours} onClick={accepter}>Accepter</button>
                <button type="button" className="tb-bouton ag-danger" disabled={enCours} onClick={refuser}>Refuser</button>
              </div>
            </div>
          )}
          {proposeeA && proposeeA !== moi && (
            <div className="dm-verif">
              <p>Proposée à {nomDe(membres, proposeeA)} : en attente de sa réponse. Elle reste chez {nomDe(membres, qui)} en attendant.</p>
              {(d.proposePar === moi || moi === ADMIN_ID) && (
                <button type="button" className="tb-bouton tb-clair" disabled={enCours} onClick={() => executer(annulerProposition())}>Annuler la proposition</button>
              )}
            </div>
          )}
          {!proposeeA && (
            <div className="tb-actions">
              {membres.filter((m) => peutFaireService(m, d.service)).map((m) => (
                <button key={m.id} className={"tb-filtre" + (m.id === qui ? " actif" : "")} disabled={!modifiable || enCours || m.id === qui || !peutProposer} onClick={() => changerPersonne(m.id)}>
                  {m.id === qui ? "✓ " : ""}{m.nom}
                </button>
              ))}
            </div>
          )}
          {!proposeeA && (
            <p className="tb-note">
              {!modifiable ? "Course terminée ou fermée : elle ne change plus de main." : peutProposer ? "Toucher l'autre nom lui propose la course : elle reste chez toi tant qu'il n'a pas accepté." : `Cette course est chez ${nomDe(membres, qui)}.`}
            </p>
          )}
          {prevenir && (
            <p className="dm-verif dm-ok">
              Course proposée à {prevenir.nom}.{" "}
              {prevenir.lien ? <a className="tb-bouton" href={prevenir.lien} target="_blank" rel="noopener noreferrer">Prévenir {prevenir.nom} sur WhatsApp</a> : "Ajoute son téléphone dans sa fiche pour le prévenir sur WhatsApp."}
            </p>
          )}
        </>
      )}

      {choix.length > 0 && (
        <>
          <p className="am-titre">Avec quoi y aller ({personne.nom})</p>
          {choix.map((c, i) => {
            const actuel = (d.vehicule || "") === c.vehicule.id || (!d.vehicule && i === 0 && c.possible);
            return (
              <button key={c.vehicule.id} className={"qf-vehicule" + (actuel ? " actif" : "")} disabled={!c.possible || enCours} onClick={() => executer({ vehicule: c.vehicule.id })}>
                <span>
                  <strong>{c.vehicule.nom || libelleType(c.vehicule.type)}</strong>
                  {i === 0 && c.possible && <em> · conseillé</em>}
                  <small>{c.possible ? `Frais estimés ${c.cout} ₪ · bénéfice estimé ${c.beneficeEstime} ₪` : c.raison}</small>
                </span>
                {d.vehicule === c.vehicule.id && <span className="tb-badge tb-acceptee">Choisi</span>}
              </button>
            );
          })}
          <p className="tb-note">Le prix du client ne change pas selon le véhicule : seul ton bénéfice change.</p>
        </>
      )}
    </div>
  );
}
