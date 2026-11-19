import { useEffect, useState } from "react";
import { useEnAttente } from "../ecritureRapide.js";

// Bandeau « ⏳ En attente de réseau » (19 nov. 2026) : tant qu'un envoi n'est pas confirmé par le serveur
export default function BandeauEnAttente() {
  const n = useEnAttente();
  const [enLigne, setEnLigne] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine !== false);
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => { window.removeEventListener("online", maj); window.removeEventListener("offline", maj); };
  }, []);
  if (!n && enLigne) return null;
  return (
    <p className="tr-bandeau" role="status" style={{ cursor: "default" }}>
      ⏳ {n ? `${n} enregistrement${n > 1 ? "s" : ""} en attente de réseau` : "Pas de réseau"} — c'est gardé dans le téléphone et envoyé dès que le réseau revient.
    </p>
  );
}
