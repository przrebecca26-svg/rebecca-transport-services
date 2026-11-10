import { lienWhatsApp } from "../pricing/navigation.js";
import { WHATSAPP } from "../contact.js";

export default function WhatsAppFlottant() {
  const url = lienWhatsApp(WHATSAPP, "Bonjour Rebecca,");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter sur WhatsApp"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#25D366",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        zIndex: 1000,
        textDecoration: "none",
        fontSize: 28,
      }}
    >
      💬
    </a>
  );
}
