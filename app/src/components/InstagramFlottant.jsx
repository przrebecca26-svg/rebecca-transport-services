import { LIEN_INSTAGRAM, INSTAGRAM } from "../contact.js";

export default function InstagramFlottant() {
  return (
    <a
      href={LIEN_INSTAGRAM}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Instagram @${INSTAGRAM}`}
      style={{
        position: "fixed",
        bottom: 88,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        zIndex: 1000,
        textDecoration: "none",
        fontSize: 26,
      }}
    >
      📷
    </a>
  );
}
