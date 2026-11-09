import { useState } from "react";
import { arrayUnion } from "firebase/firestore";
import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";
import { ADMIN_ID, peutFaire } from "../pricing/equipe.js";
import { attribueA, attribution, conseilPour, libelleType, messageTransfert, nomDe } from "../pricing/quiFait.js";
import { useEquipeContexte } from "../equipeContexte.jsx";

// Bloc « Qui fait la course » de la fiche d'une demande (Lot J, seance J3, 9 nov. 2026)
// - choisir ou changer la personne (transfert DIRECT, decision de Rebecca), message WhatsApp pret pour prevenir l'autre ;
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

  const changerPersonne = async (versId) => {
    const r = attribution(d, versId, moi, Date.now());
    if (r.erreur || !r.maj) return;
    const ok = await executer({ ...r.maj, historiqueAttribution: arrayUnion(r.trace) });
    if (ok && versId !== moi) {
      const vers = membres.find((m) => m.id === versId);
      const tel = versId === ADMIN_ID ? WHATSAPP : vers && vers.telephone;
      setPrevenir({ nom: nomDe(membres, versId), lien: lienWhatsApp(tel, messageTransfert(d, nomDe(membres, moi), nomDe(membres, versId))) });
    } else setPrevenir(null);
  };

  if (!enEquipe && choix.length <= 1) return null;

  return (
    <div className="tb-bloc qf-bloc">
      <h3>Qui fait la course</h3>
      {enEquipe && (
        <>
          <div className="tb-actions">
            {membres.filter((m) => peutFaireService(m, d.service)).map((m) => (
              <button key={m.id} className={"tb-filtre" + (m.id === qui ? " actif" : "")} disabled={!modifiable || enCours || m.id === qui} onClick={() => changerPersonne(m.id)}>
                {m.id === qui ? "✓ " : ""}{m.nom}
              </button>
            ))}
          </div>
          <p className="tb-note">{modifiable ? "Toucher l'autre nom transfère la course tout de suite." : "Course terminée ou fermée : elle ne change plus de main."}</p>
          {prevenir && (
            <p className="dm-verif dm-ok">
              Course transférée à {prevenir.nom}.{" "}
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
