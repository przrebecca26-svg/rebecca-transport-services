import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" : fonctionne aussi bien sur Netlify que dans un sous-dossier
export default defineConfig({ plugins: [react()], base: "./" });
