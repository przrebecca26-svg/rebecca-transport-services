// Icônes des catégories partenaires (lot P1) : dessins fins, couleur rose poudré (currentColor)
const D = {
  couverts: <><path d="M7 3v8a2 2 0 0 0 2 2v8" /><path d="M5 3v5M9 3v5M7 8h0" /><path d="M5 8a2 2 0 0 0 4 0" /><path d="M17 21V3c-2 1.5-3 4-3 7 0 2 1 3 3 3" /></>,
  chariot: <><path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.4-1l2-6.3H6.2" /><circle cx="9.5" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>,
  cle: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.6 1.6 0 0 0 2.3 2.3l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.1-.4-.4-2.1z" /></>,
  ciseaux: <><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.2 7.6 20 17M8.2 16.4 20 7M12.5 12h.01" /></>,
  sac: <><path d="M5 8h14l-1 12.5a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  maison: <><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></>,
  bebe: <><circle cx="12" cy="12" r="8.5" /><path d="M9 11h.01M15 11h.01" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0" /><path d="M12 3.5c-1.5 1.5-1 3 .5 3" /></>,
  coeur: <><path d="M12 20s-7.5-4.3-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.7-7.5 10-7.5 10z" /><path d="M5 12h3.5l1.5-2.5 2 5 1.5-2.5H19" /></>,
  mallette: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" /><path d="M3.5 12.5h17M11 12.5v1.5h2v-1.5" /></>,
  fete: <><path d="M4 20 8.5 8l7.5 7.5z" /><path d="M13 4.5c.8.8.8 2 0 2.8M17.5 9c.8-.8 2-.8 2.8 0M15 3l.5 1.5M20 6.5 21 7M18 3.5l-.8 2" /></>,
  voiture: <><path d="M4 16.5V13l1.8-4.2A2 2 0 0 1 7.6 7.5h8.8a2 2 0 0 1 1.8 1.3L20 13v3.5a1 1 0 0 1-1 1h-1.5" /><path d="M6.5 17.5H5a1 1 0 0 1-1-1M4 13h16M9.5 17.5h5" /><circle cx="8" cy="17.5" r="1.7" /><circle cx="16" cy="17.5" r="1.7" /></>,
  chapeau: <><path d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5v4.2c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8v-4.2M21.5 9.5V15" /></>,
  grille: <><circle cx="7.5" cy="7.5" r="3" /><circle cx="16.5" cy="7.5" r="3" /><circle cx="7.5" cy="16.5" r="3" /><circle cx="16.5" cy="16.5" r="3" /></>,
  etoile: <><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" /></>,
  fleur: <><circle cx="12" cy="10" r="2.2" /><path d="M12 7.8c-1.5-3.3 1.5-4.5 0-4.5s1.5 1.2 0 4.5zM9.9 10.6C6.4 11.5 5.6 8.4 6.6 9.5s3.8-.1 3.3 1.1z" /><path d="M12 12.2V21M12 17c-2 0-3.5-1-4-2.5 2 0 3.5 1 4 2.5zM12 15.5c2 0 3.5-1 4-2.5-2 0-3.5 1-4 2.5zM14.1 10.6c3.5.9 4.3-2.2 3.3-1.1s-3.8-.1-3.3 1.1z" /></>,
  appareil: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7 10 4.5h4L15.5 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  cadeau: <><rect x="3.5" y="9" width="17" height="4" rx="1" /><path d="M5 13v7h14v-7M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" /></>,
  livre: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
  telephone: <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M11 18.5h2" /></>,
  colis: <><path d="M12 3 20 7v10l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4M12 11v10M8 5l8 4" /></>,
  bijou: <><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4 8 9l4 11 4-11-1-5" /></>,
  pinceau: <><path d="M18.5 3.5a2 2 0 0 1 2.8 2.8L12 15.5 8.5 12z" /><path d="M8.5 12c-2.5 0-4 1.5-4 4 0 1.5-1 2.5-2 3 3.5 1 7.5 0 8.5-3.5" /></>,
};
export default function IconeCategorie({ nom, taille = 30, titre }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden={titre ? undefined : "true"} role={titre ? "img" : undefined}>
      {titre && <title>{titre}</title>}
      {D[nom] || D.grille}
    </svg>
  );
}
