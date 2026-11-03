// BASE TARIFAIRE CENTRALE - Rebecca Transport & Services
// Un seul endroit pour tous les prix et toutes les regles.
// Plus tard, ces valeurs seront lues depuis la base de donnees (modifiables dans l'espace admin).

export const TARIFS = {
  version: "2026-11-02",
  devise: "₪",

  // Cout du vehicule et du temps (formule de travail)
  carburant: { prixLitre: 8.03, consommationLitres100km: 9, usureVehiculeParKm: 1.1 },
  tempsParHeure: 120,
  marge: 1.2,

  // TROIS SCENARIOS conserves pour comparer avant de valider les prix.
  // partRetourAVide = part du retour a vide facturee sur un ALLER SIMPLE (0 = aucun, 0.5 = moitie).
  // L'aller-retour n'a pas de retour a vide : les deux trajets sont payes.
  scenarios: {
    A: { nom: "A - formule simple (proche du taxi)", partRetourAVide: 0 },
    B: { nom: "B - équilibre", partRetourAVide: 0.35 },
    C: { nom: "C - plein tarif", partRetourAVide: 0.5 },
  },
  scenarioActif: "B",

  // Alerte de rentabilite : en dessous de ce gain net par heure, Rebecca est prevenue
  rentabilite: { seuilAlerteGainNetHeure: 60 },

  // Tous les prix sont arrondis au multiple de 5 superieur
  arrondi: 5,

  // Attente pendant un trajet + mise a disposition
  attente: { toleranceMinutes: 10, tarifHeure: 100, pasMinutes: 15, miseADispositionMinHeures: 1 },

  // Supplements de nuit selon l'heure de prise en charge (heures locales Israel)
  nuit: [
    { de: "22:00", a: "24:00", pourcentage: 0.15 },
    { de: "00:00", a: "06:00", pourcentage: 0.2 },
  ],

  // Urgence : +30 NIS, ou +50 NIS si la prise en charge est dans l'heure
  urgence: { standard: 30, immediate: 50, seuilImmediatMinutes: 60 },

  // CALENDRIER JUIF : Chabbat et fetes (Yom Tov) bloques automatiquement.
  // Horaires calcules a partir du coucher du soleil a Netanya, fuseau Asia/Jerusalem.
  calendrier: {
    latitude: 32.3215,
    longitude: 34.8532,
    allumageMinutesAvantCoucher: 20, // allumage des bougies
    havdalaMinutesApresCoucher: 40, // sortie de Chabbat / fete
    margeAvantMinutes: 120, // aucune prestation ne doit se terminer dans les 2 h avant l'entree
    margeApresMinutes: 15, // petite marge apres la sortie
    // Hol Hamoed (jours intermediaires de Souccot et Pessah) : Rebecca decide JOUR PAR JOUR.
    // Par defaut ces jours restent ouverts ; elle peut en fermer un depuis l'admin
    // (fermeture exceptionnelle). Si bloquer = true, tous ces jours sont fermes d'office.
    holHamoed: { bloquer: false, decisionParJour: true },
    // Fermetures exceptionnelles saisies dans l'espace admin
    // Exemple : { debut: "2026-12-24T18:00", fin: "2026-12-26T08:00", motif: "Vacances" }
    fermeturesExceptionnelles: [],
  },

  // AGENDA : une seule course a la fois. Apres chaque mission confirmee, un tampon est reserve.
  // Un aller simple occupe aussi le temps du RETOUR A VIDE vers Netanya.
  agenda: { tamponMinutes: 15 },

  // Categories de depenses enregistrables par Rebecca (par course ou generales)
  categoriesDepenses: ["Carburant", "Péages", "Stationnement", "Entretien", "Autres frais"],

  // Duree d'occupation supposee quand elle n'est pas connue (pour verifier les fermetures)
  dureeParDefautMinutes: { courses: 90, hatan_kala: 120, demenagement: 180, livraison: 45 },

  // Grille officielle = prix MINIMUM par destination (trajets depuis/vers Netanya).
  // minimum = grille de départ ; grilleB = grille B validée : minimum d'un aller simple,
  // et minimum PAR TRAJET en aller-retour (Tel-Aviv : 2 x 175 = 350).
  zones: {
    netanya: {
      nom: "Netanya et alentours",
      minimum: 50,
      grilleB: { simple: 75, parTrajetAR: 55 },
      alias: ["netanya", "natanya", "netania", "nethanya", "natania", "נתניה"],
    },
    hadera: { nom: "Hadera", minimum: 120, grilleB: { simple: 155, parTrajetAR: 120 }, alias: ["hadera", "hedera", "חדרה"] },
    herzliya_raanana: {
      nom: "Herzliya / Ra'anana",
      minimum: 130,
      grilleB: { simple: 150, parTrajetAR: 130 },
      alias: ["herzliya", "herzlia", "hertzliya", "raanana", "ra anana", "הרצליה", "רעננה"],
    },
    tel_aviv: {
      nom: "Tel-Aviv",
      minimum: 170,
      grilleB: { simple: 235, parTrajetAR: 175 },
      alias: ["tel aviv", "telaviv", "tel aviv yafo", "תל אביב"],
    },
    ben_gurion: {
      nom: "Aéroport Ben Gourion",
      minimum: 250,
      grilleB: { simple: 290, parTrajetAR: 250 },
      alias: [
        "ben gurion airport",
        "ben gourion airport",
        "aeroport ben gurion",
        "aeroport ben gourion",
        "aeroport de tel aviv",
        "airport tlv",
        "tlv airport",
        "aeroport",
        "airport",
        "נתב",
      ],
    },
    haifa: { nom: "Haïfa", minimum: 280, grilleB: { simple: 365, parTrajetAR: 280 }, alias: ["haifa", "חיפה"] },
    jerusalem: { nom: "Jérusalem", minimum: 400, grilleB: { simple: 540, parTrajetAR: 400 }, alias: ["jerusalem", "yerushalayim", "ירושלים"] },
  },

  // Courses a l'interieur de Netanya : plafond 100 NIS (si trajet court)
  netanyaPlafond: { prix: 100, kmMax: 15 },

  livraison: { minimum: 60, plafondAvantDevis: 250, urgence: 30 },

  courses: {
    // nombre d'articles maximum -> prix de la prestation
    achatsDejaPayes: [
      { max: 5, prix: 60 },
      { max: 10, prix: 80 },
    ],
    courseFaiteParRebecca: [
      { max: 5, prix: 100 },
      { max: 10, prix: 120 },
    ],
    fraisAvanceAchats: 0.1, // 10 % du ticket si Rebecca avance l'argent
  },

  // Bagages : petit sac et valise cabine gratuits ; supplement par bagage en soute (grande valise)
  bagages: { supplementParSoute: 10 },

  // Arrets supplementaires (livraison, Hatan & Kala) : dans Netanya = forfait ; ailleurs = prix de la grille B de la ville
  arretsSupplementaires: { netanya: 20 },

  // Hatan & Kala : 220 minimum ; hors Netanya = trajet + prestation mariage
  hatanKala: { base: 220, decoration: 150, prestationHorsNetanya: 70 },
  // Demenagement : prestation de base + trajet hors Netanya + etages sans ascenseur (a partir du 2e)
  demenagement: { valises: 130, cartons: 180, parEtageSansAscenseur: 10 },

  // CODES PROMO : pourcentage OU montant fixe, appliques sur la prestation seulement (pas sur peages/frais annonces)
  // Exemples a remplacer par tes vrais codes. Ecris le code en MAJUSCULES.
  codesPromo: {
    BIENVENUE: { type: "pourcentage", valeur: 10, libelle: "-10 %" },
    FIDELE15: { type: "pourcentage", valeur: 15, libelle: "-15 %" },
    VIP20: { type: "pourcentage", valeur: 20, libelle: "-20 %" },
    AMI10: { type: "montant", valeur: 10, libelle: "-10 ₪" },
    MERCI20: { type: "montant", valeur: 20, libelle: "-20 ₪" },
    CADEAU30: { type: "montant", valeur: 30, libelle: "-30 ₪" },
  },

  // Pas de paiement en ligne au lancement : on enregistre seulement le moyen et les sommes
  moyensPaiement: ["Espèces", "Carte bancaire", "Revolut", "Bit"],
};

// Cout du kilometre = carburant + usure du vehicule
export const coutParKm = (t = TARIFS) =>
  (t.carburant.consommationLitres100km / 100) * t.carburant.prixLitre + t.carburant.usureVehiculeParKm;

// Part du retour a vide selon le scenario (A, B ou C) ; par defaut le scenario actif
export const partRetourAVide = (scenario, t = TARIFS) => {
  const cle = scenario && t.scenarios[scenario] ? scenario : t.scenarioActif;
  return t.scenarios[cle].partRetourAVide;
};

// Cout du carburant seul par kilometre (consommation x prix du litre)
export const carburantParKm = (t = TARIFS) => (t.carburant.consommationLitres100km / 100) * t.carburant.prixLitre;
