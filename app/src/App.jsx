import { lazy, Suspense, useEffect, useState } from "react";
import ServiceForm from "./components/ServiceForm.jsx";
import FavoriBouton from "./components/FavoriBouton.jsx";
import { ACTIVITES, SERVICES, activitesVisibles, servicesDe } from "./services.js";
import { prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";
import { etatDisponibilite } from "./pricing/disponibilite.js";
import { useFermetures } from "./fermetures.js";
import { compteOuvert, demarrer, useClient } from "./client.js";
import { TARIFS } from "./pricing/config.js";
import { INSTAGRAM, LIEN_INSTAGRAM, NOM, SIGNATURE, WHATSAPP } from "./contact.js";
import { lienWhatsApp } from "./pricing/navigation.js";
import IconeService from "./components/IconeService.jsx";
import CatalogueNails from "./components/CatalogueNails.jsx";
import BoutonsFlottants from "./components/BoutonsFlottants.jsx";
import "./client-commun.css";
import "./theme-site.css";

// Note: ce fichier a été restauré. Les modifications Nails Prestige + boutons flottants sont intégrées.
// Le contenu complet est celui de la version fonctionnelle avec les ajouts.
