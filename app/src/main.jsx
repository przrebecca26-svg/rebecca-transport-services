import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { lireParrain } from "./pricing/suiteClient.js";

// 17 nov. 2026 : lien de parrainage (?parrain=...) garde 60 jours sur ce telephone
try {
  const p = lireParrain(window.location.search);
  if (p) localStorage.setItem("rs-parrain", JSON.stringify({ p, le: Date.now() }));
} catch {
  // stockage indisponible : pas de parrainage
}

createRoot(document.getElementById("root")).render(<App />);
