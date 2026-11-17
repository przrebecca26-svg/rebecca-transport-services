import { CADEAU_PARRAINAGE, lienParrainage, messageParrainage } from "./pricing/suiteClient.js";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { etatCode, libelleLimite, libelleRemise, utilisationPossible } from "./pricing/promos.js";
import { dateFr } from "./CompteChamps.jsx";

// "Mes codes promo" : le code de bienvenue (une seule fois) et les codes offerts par Rebecca (fidelite...).
// Un code disparait de la liste quand il est utilise autant de fois que permis, ou quand il n'est plus valable.

async function lireCode(user, code) {
  const [p, u] = await Promise.all([getDoc(doc(db, "promos", code)), getDoc(doc(db, "utilisationsPromo", code + "__" + user.uid))]);
  if (!p.exists()) return null;
  const promo = p.data();
  const deja = u.exists() ? Number(u.data().nombre) || 0 : 0;
  return { ...promo, code, deja };
}

export default function ComptePromos({ client }) {
  const { user } = client;
  const [codes, setCodes] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const offerts = await getDocs(query(collection(db, "codesClient"), where("uid", "==", user.uid)));
        const liste = [{ code: TARIFS.clients.codeBienvenue, motif: "Code de bienvenue" }];
        for (const o of offerts.docs) {
          const d = o.data();
          if (!liste.some((x) => x.code === d.code)) liste.push({ code: d.code, motif: d.motif || "Offert par Rebecca" });
        }
        const lus = await Promise.all(liste.map(async (l) => ({ ...(await lireCode(user, l.code).catch(() => null)), motif: l.motif })));
        if (actif) setCodes(lus.filter((c) => c.code && etatCode(c) === "actif" && utilisationPossible(c, c.deja)));
      } catch {
        if (actif) {
          setCodes([]);
          setErreur("Lecture de vos codes impossible. Vérifiez la connexion puis réessayez.");
        }
      }
    })();
    return () => {
      actif = false;
    };
  }, [user.uid]);

  if (codes === null) return <p className="consigne">Chargement…</p>;
  // 17 nov. 2026 : parrainage — son lien a partager ; l'amie reserve avec, la cliente recoit du credit
  const lienP = lienParrainage(user.uid);
  const partager = `https://wa.me/?text=${encodeURIComponent(messageParrainage(user.uid))}`;
  return (
    <div className="promos">
      <div className="bloc">
        <h3>🎁 Parrainez une amie</h3>
        <p className="aide">Partagez votre lien : quand une amie réserve avec et que sa première course est faite, vous recevez {CADEAU_PARRAINAGE} ₪ de crédit sur votre compte.</p>
        <p dir="ltr" style={{ wordBreak: "break-all" }}><small>{lienP}</small></p>
        <div className="pourboire-boutons">
          {partager && <a className="actif" href={partager} target="_blank" rel="noopener noreferrer">Partager sur WhatsApp</a>}
          <button type="button" onClick={() => navigator.clipboard && navigator.clipboard.writeText(lienP).catch(() => {})}>Copier le lien</button>
        </div>
      </div>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {codes.length === 0 && !erreur && (
        <div className="bloc">
          <p>Vous n'avez pas de code valable pour le moment.</p>
          <p className="aide">Vous pouvez aussi saisir un code reçu d'un ami dans le formulaire de demande.</p>
        </div>
      )}
      {codes.map((c) => (
        <article key={c.code} className="bloc promo-carte">
          <p className="promo-motif">{c.motif}</p>
          <p className="promo-code">{c.code}</p>
          <p className="promo-remise">{libelleRemise(c)} sur le tarif de base</p>
          <p className="aide">
            {libelleLimite(c)}
            {c.utilisationsParCompte ? " · déjà utilisé " + c.deja + " fois" : ""}
            {c.finLe ? " · valable jusqu'au " + dateFr(c.finLe) : ""}
          </p>
          <p className="aide">Il s'applique automatiquement quand vous choisissez « Utiliser ce code » dans le formulaire. Jamais sur les suppléments (nuit, urgence, bagages, arrêts…).</p>
        </article>
      ))}
    </div>
  );
}
