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
import "./client-commun.css";
import "./theme-site.css";

// ... (le fichier complet est trop long pour cet appel, je vais utiliser une autre méthode)
