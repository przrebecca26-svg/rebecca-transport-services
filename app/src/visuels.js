// VISUELS DU SITE (11 nov. 2026) - Rebecca Services
// Une seule liste des images livrees avec le site, par activite puis par nom exact de prestation ou d'article.
// Elle sert aux pages client ET a l'admin (Reglages > Catalogue), pour que Rebecca voie la meme image que ses clientes.
// Une vraie photo ajoutee dans l'admin passe toujours avant le visuel ci-dessous.
const E = (n) => "/epoxy/" + n + ".jpg";

export const VISUELS = {
  nails: {
    "Semi-permanent (VSP)": "/nails/01_Semi-permanent.jpg",
    "Beauté des mains": "/nails/02_Beaute-des-mains.jpg",
    "Mivne anatomie (gainage)": "/nails/03_Gainage.jpg",
    "Renforcement": "/nails/04_Renforcement.jpg",
    "Extensions gel + VSP": "/nails/05_Extensions-gel.jpg",
    "Remplissage gel": "/nails/06_Remplissage-gel.jpg",
    "Flash Gel-X": "/nails/07_Flash-Gel-X.jpg",
    "Gel de construction": "/nails/08_Gel-de-construction.jpg",
    "Remplissage gel de construction": "/nails/09_Remplissage-gel-de-construction.jpg",
    "Pose acrylique + VSP": "/nails/10_Pose-acrylique.jpg",
    "Remplissage acrylique": "/nails/11_Remplissage-acrylique.jpg",
    "Dépose Gel-X / gel": "/nails/12_Depose-Gel-X-gel.jpg",
    "Dépose acrylique / gel de construction": "/nails/13_Depose-acrylique.jpg",
    "Nail art (par ongle)": "/nails/14_Nail-art.jpg",
    "Réparation ou rajout (par ongle)": "/nails/15_Reparation-ongle.jpg",
    "Semi-permanent enfant (12 ans minimum)": "/nails/16_Semi-permanent-enfant.jpg",
  },
  hair: {
    "Brushing cheveux courts": "/hair/brushing_cheveux_courts.jpg",
    "Brushing cheveux mi-longs": "/hair/brushing_cheveux_mi_longs.jpg",
    "Brushing cheveux longs": "/hair/brushing_cheveux_longs.jpg",
    "Coupe cheveux longs + shampoing + brushing": "/hair/coupe_cheveux_longs_shampoing_brushing.jpg",
    "Coupe enfant (-12 ans)": "/hair/coupe_enfant_moins_12_ans.jpg",
    "Coupe homme": "/hair/coupe_homme.jpg",
    "Shampoing + coupe + brushing": "/hair/shampoing_coupe_brushing.jpg",
    "Couleur racines + shampoing + brushing": "/hair/couleur_racines_shampoing_brushing.jpg",
    "Couleur tête entière + shampoing + brushing": "/hair/couleur_tete_entiere_shampoing_brushing.jpg",
    "Mèches papier aluminium": "/hair/meches_papier_aluminium.jpg",
    "Patine / gloss + shampoing + brushing": "/hair/patine_gloss_shampoing_brushing.jpg",
    "Chignon soirée élaboré": "/hair/chignon_soiree_elabore.jpg",
    "Coiffure soirée": "/hair/coiffure_soiree.jpg",
    "Coiffure mariée, jour J": "/hair/coiffure_mariee_jour_j.jpg",
    "Essai coiffure mariée (facultatif)": "/hair/essai_coiffure_mariee_facultatif.jpg",
  },
  slim: {
    "Radiofréquence visage ou cou": "/slim/radiofrequence_visage_ou_cou.jpg",
    "Radiofréquence corps (1 zone)": "/slim/radiofrequence_corps_1_zone.jpg",
    "Cavitation ultrasonique (1 zone)": "/slim/cavitation_ultrasonique_1_zone.jpg",
    "Cavitation + radiofréquence (1 zone)": "/slim/cavitation_plus_radiofrequence_1_zone.jpg",
    "Forfait radiofréquence ventre & taille": "/slim/forfait_radiofrequence_ventre_taille.jpg",
    "Forfait radiofréquence fesses & cuisses": "/slim/forfait_radiofrequence_fesses_cuisses.jpg",
    "Anti-cellulite cuisses & fesses, séance unique": "/slim/anti_cellulite_cuisses_fesses_seance_unique.jpg",
    "Anti-cellulite, cure 8 séances": "/slim/anti_cellulite_cure_8_seances.jpg",
    "Anti-cellulite, cure 10 séances": "/slim/anti_cellulite_cure_10_seances.jpg",
    "Bilan personnalisé (facultatif)": "/slim/bilan_personnalise.jpg",
  },
  regenx: {
    "Diagnostic (obligatoire)": "/regenx/diagnostic.jpg",
    "Sourcils": "/regenx/sourcils.jpg",
    "Barbe, 1 zone": "/regenx/appareil.jpg",
    "Barbe, plusieurs zones": "/regenx/appareil.jpg",
    "Barbe entière": "/regenx/appareil.jpg",
    "Cheveux, 1 zone": "/regenx/stylo.jpg",
    "Cheveux, plusieurs zones": "/regenx/stylo.jpg",
    "Cheveux, tête entière": "/regenx/stylo.jpg",
  },
  // 12 nov. 2026 (20h26) : Rebecca retire toutes les images Epoxy du site ; elle met elle-meme ses photos
  // (photo principale + galerie de chaque article) dans Reglages > Catalogue.
  epoxy: {},

  digital: {
    "Formule Essentielle": "/digital/essentielle.jpg",
    "Formule Business": "/digital/business.jpg",
    "Formule Sur mesure": "/digital/surmesure.jpg",
    "Sérénité": "/digital/maintenance-serenite.svg",
    "Confort": "/digital/maintenance-confort.svg",
    "Premium": "/digital/maintenance-premium.svg",
  },
};

// Visuel du site pour une prestation (null s'il n'y en a pas)
export function visuelDe(activite, nom) {
  const liste = VISUELS[activite];
  return (liste && liste[nom]) || null;
}
