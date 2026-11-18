import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";

// SAUVEGARDES AUTOMATIQUES (18 nov. 2026) : copie complete faite par le robot chaque dimanche vers 21h,
// les 8 dernieres semaines. Un appui = le fichier complet (.json) se telecharge.
const dateFr = (d) => String(d || "").split("-").reverse().join("/");

export default function SauvegardesAuto() {
  const [liste, setListe] = useState(null);
  const [info, setInfo] = useState("");
  useEffect(() => {
    getDocs(query(collection(db, "sauvegardes"), where("partie", "==", 0)))
      .then((s) => setListe(s.docs.map((x) => x.data()).sort((a, b) => String(b.date).localeCompare(String(a.date)))))
      .catch(() => setListe([]));
  }, []);
  const telecharger = async (date) => {
    setInfo("Préparation…");
    try {
      const s = await getDocs(query(collection(db, "sauvegardes"), where("date", "==", date)));
      const json = s.docs.map((x) => x.data()).sort((a, b) => a.partie - b.partie).map((x) => x.json).join("");
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `sauvegarde-complete-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setInfo("");
    } catch {
      setInfo("Téléchargement impossible (règles Firebase v26 ?).");
    }
  };
  if (!liste) return null;
  return (
    <div className="tb-bloc">
      <h3>💾 Sauvegardes automatiques</h3>
      <p className="tb-note">Chaque dimanche vers 21h, une copie complète de tes données est faite toute seule (les 8 dernières semaines sont gardées). Tu reçois une notification et un e-mail.</p>
      {liste.length === 0 && <p className="tb-note">Pas encore de sauvegarde automatique : la première sera faite dimanche soir.</p>}
      {liste.map((x) => (
        <button key={x.date} className="tb-bouton tb-clair" onClick={() => telecharger(x.date)}>
          ⬇️ {dateFr(x.date)} · {Math.round((Number(x.taille) || 0) / 1024)} Ko
        </button>
      ))}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
