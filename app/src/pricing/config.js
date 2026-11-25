// BASE TARIFAIRE CENTRALE - Rebecca Services
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
  // 25 nov. 2026 : coût réel du km (carburant ~0,70 + entretien/usure 0,50) et temps passé sur place par service
  rentabilite: { seuilAlerteGainNetHeure: 40, coutKmReel: 1.3, // 26 nov. 2026 : 🟢 60 objectif, 🟡 55 acceptable, 🟠 40-55 petit gain, 🔴 moins de 40 a refuser ; 1,30 ₪/km
    surPlaceMinutes: { livraison: 10, courses: 30, demenagement: 45, transport: 5, aeroport: 10, hatan_kala: 15 } },

  // Tous les prix sont arrondis au multiple de 5 superieur
  arrondi: 5,

  // Attente pendant un trajet + mise a disposition
  attente: { toleranceMinutes: 10, tarifHeure: 90, tarifHeureAttente: 60, pasMinutes: 15, miseADispositionMinHeures: 1 }, // 26 nov. 2026 : attente pendant un trajet 1 ₪/min apres 10 min offertes ; mise a disposition 90 ₪/h // 25 nov. 2026 : 100 -> 90 ₪/h (cahier des charges)

  // Supplements de nuit selon l'heure de prise en charge (heures locales Israel)
  nuit: [
    // 26 nov. 2026 (nouvelle grille) : nuit +10 %
    { de: "22:00", a: "24:00", pourcentage: 0.1 },
    { de: "00:00", a: "06:00", pourcentage: 0.1 },
  ],

  // Urgence : +30 NIS, ou +50 NIS si la prise en charge est dans l'heure
  urgence: { standard: 5, immediate: 10, seuilImmediatMinutes: 60 }, // 26 nov. 2026 : +5 / +10 ₪ // 25 nov. 2026 : 30/50 -> 15/20 ₪

  // CALENDRIER JUIF : Chabbat et fetes (Yom Tov) bloques automatiquement.
  // Horaires calcules a partir du coucher du soleil a Netanya, fuseau Asia/Jerusalem.
  calendrier: {
    latitude: 32.3215,
    longitude: 34.8532,
    allumageMinutesAvantCoucher: 20, // allumage des bougies
    havdalaMinutesApresCoucher: 40, // sortie de Chabbat / fete
    // Decision de Rebecca (19 nov. 2026, 9h01) : fermeture 2 h avant l'entree (allumage) et reouverture 1 h apres la sortie,
    // pour Chabbat comme pour les fetes (Yom Tov). Modifiable dans Reglages, groupe « Chabbat et fêtes ».
    margeAvantMinutes: 120, // aucune prestation ne doit se terminer dans les 2 h qui precedent l'entree
    margeApresMinutes: 60, // reouverture 1 h apres la sortie
    // Hol Hamoed (jours intermediaires de Souccot et Pessah) : Rebecca decide JOUR PAR JOUR.
    // Par defaut ces jours restent ouverts ; elle peut en fermer un depuis l'admin
    // (fermeture exceptionnelle). Si bloquer = true, tous ces jours sont fermes d'office.
    holHamoed: { bloquer: false, decisionParJour: true },
    // Fermetures exceptionnelles saisies dans l'espace admin
    // Exemple : { debut: "2026-12-24T18:00", fin: "2026-12-26T08:00", motif: "Vacances" }
    fermeturesExceptionnelles: [],
    // CRENEAUX PERSONNELS RECURRENTS (ecole des enfants, etc.) : bloques chaque semaine, pour tous les services.
    // jours : 0 = dimanche, 1 = lundi ... 5 = vendredi, 6 = samedi. Heures locales Israel.
    // Le client voit seulement "creneau deja reserve" (jamais le motif prive).
    // Pour des horaires differents un jour precis (ex : vendredi), ajoute une ligne avec ce jour seulement
    // et retire ce jour des autres lignes.
    creneauxPersonnels: [
      { jours: [0, 1, 2, 3, 4, 5], debut: "07:15", fin: "08:45", motif: "Créneau déjà réservé" }, // matin, dimanche a vendredi
      { jours: [0, 1, 2, 3, 4], debut: "13:15", fin: "14:45", motif: "Créneau déjà réservé" }, // sorties 13h30 et 14h, dimanche a jeudi
      { jours: [5], debut: "11:35", fin: "13:35", motif: "Créneau déjà réservé" }, // vendredi : sorties 11h50 et 12h50
    ],
    // JOURS LIBRES : dates ou tous les creneaux personnels sont leves (desistement, vacances, pas d'ecole...)
    // Exemple : ["2026-11-10", "2026-11-11"]
    joursLibres: [],
    // VACANCES SCOLAIRES D'ISRAEL (ecoles officielles juives, ministere de l'Education, annee 2026-2027) :
    // pendant ces dates, les creneaux personnels d'ecole sont leves (Chabbat et fetes restent fermes).
    // Dates inclusives. Mets actif: false sur une ligne si tu dois quand meme emmener tes enfants ce jour-la.
    // Les classes de college finissent le 20 juin 2027 ; verifie aussi la circulaire de l'ecole de ta fille.
    // Annee 2026-2027 (calendrier transmis par Rebecca le 12 nov. 2026, a verifier avec chaque ecole). Sert PARTOUT :
    // calendrier, tournee scolaire, devis de ramassage, forfaits au mois. Ete : gan et primaire (college et lycee :
    // 20 juin). Yom HaZikaron (11 mai, cours jusqu'a 12h) : jour d'ecole. Les vacances ajoutees par Rebecca dans sa
    // tournee s'y ajoutent (document public reglages/vacances -> vacancesAjoutees).
    vacancesScolaires: [
      { debut: "2026-12-06", fin: "2026-12-12", motif: "Vacances de Hanoucca", actif: true },
      { debut: "2027-03-23", fin: "2027-03-24", motif: "Vacances de Pourim", actif: true },
      { debut: "2027-04-13", fin: "2027-04-28", motif: "Vacances de Pessah", actif: true },
      { debut: "2027-05-12", fin: "2027-05-12", motif: "Yom Haatsmaout", actif: true },
      { debut: "2027-06-10", fin: "2027-06-11", motif: "Vacances de Chavouot", actif: true },
      { debut: "2027-07-01", fin: "2027-08-31", motif: "Grandes vacances", actif: true },
      // Annee 2027-2028 (19 nov. 2026) : le ministere n'a publie que la rentree (mercredi 1er septembre 2027).
      // Les lignes ci-dessous sont PROVISOIRES (calendrier habituel des fetes d'automne) : a remplacer par la
      // circulaire officielle des qu'elle sort. Hanoucca, Pourim, Pessah, Chavouot et ete 2028 : a ajouter a ce moment-la.
      { debut: "2027-10-01", fin: "2027-10-03", motif: "Vacances de Roch Hachana (provisoire)", actif: true, provisoire: true },
      { debut: "2027-10-10", fin: "2027-10-23", motif: "Vacances de Yom Kippour et Souccot (provisoire)", actif: true, provisoire: true },
      { debut: "2028-05-02", fin: "2028-05-02", motif: "Yom Haatsmaout (provisoire)", actif: true, provisoire: true },
    ],
    // CRENEAUX PONCTUELS : un horaire exceptionnel sur une date precise (changement d'horaire de l'ecole...)
    // Exemple : { date: "2026-11-12", debut: "11:45", fin: "13:15", motif: "Créneau déjà réservé" }
    creneauxPonctuels: [],
    vacancesAjoutees: [], // { debut, fin, motif } : jours sans ecole ajoutes par Rebecca (greve, journee pedagogique...)
    // Dates ou des trajets de ma tournee sont confies a Jeremy : ce jour-la, seuls ces creneaux me bloquent
    creneauxDates: {}, // { "AAAA-MM-JJ": [{ debut, fin }] }
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
      minimum: 30,
      axe: { sens: "centre", rang: 0 },
      // 25 nov. 2026 : petit trajet dans Netanya dès 35 ₪ (avant 75), ramassage 35 ₪ le trajet (avant 55)
      grilleB: { simple: 35, parTrajetAR: 35 },
      alias: ["netanya", "natanya", "netania", "nethanya", "natania", "נתניה"],
    },
    // 26 nov. 2026 (nouvelle grille, sous le taxi) : prix fixes au depart de Netanya ; aller-retour = 2 trajets a -10 %
    hadera: { nom: "Hadera", minimum: 110, axe: { sens: "nord", rang: 1 }, grilleB: { simple: 110, parTrajetAR: 100 }, alias: ["hadera", "hedera", "חדרה"] },
    herzliya_raanana: {
      nom: "Herzliya / Ra'anana",
      minimum: 115,
      axe: { sens: "sud", rang: 1 },
      grilleB: { simple: 115, parTrajetAR: 105 },
      alias: ["herzliya", "herzlia", "hertzliya", "raanana", "ra anana", "הרצליה", "רעננה"],
    },
    tel_aviv: {
      nom: "Tel-Aviv",
      minimum: 160,
      axe: { sens: "sud", rang: 2 },
      grilleB: { simple: 160, parTrajetAR: 145 },
      alias: ["tel aviv", "telaviv", "tel aviv yafo", "תל אביב"],
    },
    ben_gurion: {
      nom: "Aéroport Ben Gourion",
      minimum: 250,
      axe: { sens: "sud", rang: 3 },
      grilleB: { simple: 250, parTrajetAR: 230 },
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
    haifa: { nom: "Haïfa", minimum: 260, axe: { sens: "nord", rang: 2 }, grilleB: { simple: 260, parTrajetAR: 235 }, alias: ["haifa", "חיפה"] },
    jerusalem: { nom: "Jérusalem", minimum: 350, axe: { sens: "sud", rang: 4 }, grilleB: { simple: 350, parTrajetAR: 315 }, alias: ["jerusalem", "yerushalayim", "ירושלים"] },
  },

  // Courses a l'interieur de Netanya : plafond 100 NIS (si trajet court)
  netanyaPlafond: { prix: 100, kmMax: 15 },

  // 26 nov. 2026 (Rebecca : « si un taxi est moins cher, je prends le taxi ») : TRANSPORT par distance, sous le compteur
  // officiel. Sert dans Netanya et hors des villes de la grille ; au-dela de 50 km : 220 ₪ + auDelaParKm par km.
  // Aller-retour : chaque trajet a -10 % (remiseAllerRetour). Les villes de la grille gardent leur prix fixe.
  transport: {
    // 26 nov. 2026, 00h30 (Rebecca : « une moyenne, sans être plus chère qu'un taxi ») : milieu entre la grille ChatGPT et le compteur
    paliers: [{ kmMax: 2, prix: 35 }, { kmMax: 3, prix: 40 }, { kmMax: 5, prix: 50 }, { kmMax: 8, prix: 60 }, { kmMax: 10, prix: 70 }, { kmMax: 15, prix: 95 }, { kmMax: 20, prix: 120 }, { kmMax: 30, prix: 160 }, { kmMax: 40, prix: 205 }, { kmMax: 50, prix: 250 }],
    auDelaParKm: 4.5,
    remiseAllerRetour: 0.1,
  },

  // 25 nov. 2026 (Rebecca : « je suis trop chère, on me refuse ») : grille par distance, comme les coursiers du marché.
  // Le prix suit la distance récupération -> livraison ; au-delà du dernier palier = sur devis.
  // 26 nov. 2026 : nouvelle grille (30 ₪ jusqu'a 3 km, puis paliers ; au-dela de 8 km, au moins 45 ₪/h retour a vide compris ; au-dela de 50 km = sur devis)
  livraison: { minimum: 30, plafondAvantDevis: 250, urgence: 10,
    paliers: [{ kmMax: 3, prix: 30 }, { kmMax: 5, prix: 35 }, { kmMax: 8, prix: 45 }, { kmMax: 10, prix: 55 }, { kmMax: 15, prix: 80 }, { kmMax: 20, prix: 100 }, { kmMax: 30, prix: 130 }, { kmMax: 40, prix: 165 }, { kmMax: 50, prix: 205 }] },

  courses: {
    // nombre d'articles maximum -> prix de la prestation
    // 25 nov. 2026 (refonte) : récupérer des achats déjà payés dès 35 ₪ (avant 60/80) ; Rebecca fait les courses dès 60 ₪ (avant 100/120)
    // 26 nov. 2026 : retrait 30 / 35 / 45 ₪ ; courses faites par Rebecca selon le temps (5 articles ~ 15 min = 40 ₪,
    // 10 ~ 30 min = 60 ₪, 20 ~ 45 min = 75 ₪, 30 ~ 1 h = 90 ₪) ; au-dela = sur devis
    achatsDejaPayes: [
      { max: 5, prix: 30 },
      { max: 10, prix: 35 },
      { max: 20, prix: 45 },
    ],
    courseFaiteParRebecca: [
      { max: 5, prix: 40 },
      { max: 10, prix: 60 },
      { max: 20, prix: 75 },
      { max: 30, prix: 90 },
    ],
    fraisAvanceAchats: 0.1, // 10 % du ticket si Rebecca avance l'argent
  },

  // Bagages : petit sac et valise cabine gratuits ; supplement par bagage en soute (grande valise)
  bagages: { supplementParSoute: 0 }, // 26 nov. 2026 : bagages classiques inclus (0 = pas de ligne)

  // Arrets supplementaires (livraison, Hatan & Kala, mise a disposition) :
  // - dans Netanya ou SUR LA ROUTE (meme direction, pas plus loin que le point le plus eloigne deja atteint) = forfait
  // - plus loin = prix de la grille B de la ville
  arretsSupplementaires: { netanya: 10, surLaRoute: 10 }, // 26 nov. 2026 : 10 ₪ // 25 nov. 2026 : 20 -> 15 ₪

  // Ramassage scolaire : prix d'un trajet = prix par trajet de la grille B ; forfait semaine = reduction selon le nombre de jours
  // (de la plus forte a la plus faible). Exemple : 3 jours = -10 %, 5 jours ou plus = -15 %.
  // REGLE DE REBECCA (15 nov. 2026, remplace les paliers 3 jours / 5 jours) :
  // 1 enfant : un jour = prix normal, semaine -10 %, mois -15 % ;
  // 2 enfants ou plus (de la meme famille) : semaine -15 %, mois -20 %.
  // « reductions » n'est plus utilise (garde pour les anciens reglages).
  ramassage: { reductions: [{ minJours: 5, pourcentage: 0.15 }, { minJours: 3, pourcentage: 0.1 }], reductionSemaine: 0.1, reductionSemainePlusieurs: 0.15, reductionMois: 0.15, reductionPlusieursEnfants: 0.2,
    // 15 nov. 2026 : deux enfants de la meme ecole a 10 min d'ecart au plus (meme sens) = un seul trajet
    regroupementMinutes: 10,
    // Vacances scolaires : la liste du calendrier (TARIFS.calendrier.vacancesScolaires) sert partout (12 nov. 2026)
  },
  // Ma tournee scolaire (12 nov. 2026) : marge de route a chaque deplacement (petit probleme sur la route), temps
  // d'arret pour faire monter ou descendre les enfants, retard maximum accepte a une sortie d'ecole, places passagers.
  // retourMaisonMinutes : entre deux moments de la journee, retour a la maison seulement s'il reste au moins ce temps libre.
  // TRAJET PARTAGE (15 nov. 2026, regle de Rebecca) : jusqu'a « inclus » personnes = le prix normal du trajet ;
  // chaque personne en plus = un supplement en pourcentage du trajet. Ramassage : 50 % = chaque enfant paie sa place
  // (un enfant = la moitie d'un trajet des qu'ils sont au moins deux). Transport et aeroport : 25 % par passager en plus.
  // La note peut etre partagee : par enfant / par personne, ou en parts egales entre les familles.
  // 16 nov. 2026 : transport et aeroport, un ENFANT en plus ne paie qu'une part du supplement passager (0.5 = la moitie).
  partage: { inclus: 2, ramassage: 0.5, transport: 0.25, enfantTransport: 0.5, maxFamilles: 3 },
  // 17 nov. 2026 : duree du trajet aux heures de pointe (affichage seulement, le prix ne change pas).
  // Heures en nombre (9.5 = 9h30) ; dimanche a jeudi pour le matin et le soir ; pourcentages ajoutes a la duree.
  circulation: { matinDebut: 7, matinFin: 9.5, matin: 0.5, soirDebut: 15.5, soirFin: 18.5, soir: 0.4, vendrediDebut: 11, vendrediFin: 14.5, vendredi: 0.2 },
  tournee: { margeRouteMinutes: 0, arretMinutes: 5, retardMaxMinutes: 10, places: 4, retourMaisonMinutes: 30, libreMinutes: 20 },
  // libreMinutes (12 nov. 2026, 16h07) : pendant une activite (basket...), si j'attends au moins 20 min entre la depose
  // et la recuperation, ce temps est LIBRE (pas bloque) : je peux prendre une petite course aux alentours.

  // Hatan & Kala : 220 minimum ; hors Netanya = trajet + prestation mariage
  hatanKala: { base: 220, decoration: 150, prestationHorsNetanya: 70 },
  // Demenagement : prestation de base + trajet hors Netanya + etages sans ascenseur (a partir du 2e)
  demenagement: { valises: 130, cartons: 180, parEtageSansAscenseur: 10 },

  // CODES PROMO : ils ne sont plus ecrits ici (ce fichier est public).
  // Rebecca les cree dans son espace prive (onglet Codes promo) ; le formulaire lit le code saisi dans Firestore.
  codesPromo: {},

  // COMPTES CLIENTS : limites et code de bienvenue (donne automatiquement a l'inscription verifiee)
  clients: {
    codeBienvenue: "BIENVENUE10",
    adressesMax: 5,
    enfantsMax: 6,
    favorisMax: 10,
    demandesParJour: 10, // limite douce par compte (le code Firebase gratuit ne peut pas la garantir seul)
    rechargesEnAttenteMax: 3,
  },

  // Lien pour laisser un avis Google (Google Business Profile > "Demander des avis"). Vide = le lien n'est pas affiche.
  avisGoogleUrl: "",

  // POURBOIRE : 100 % pour Rebecca, jamais reduit par un code, jamais compte dans le chiffre d'affaires de la course
  pourboire: { montants: [5, 10, 15, 20, 50], max: 200 },

  // CREDIT PREPAYE : recharge declaree par le client, ajoutee seulement quand Rebecca confirme la reception.
  // Le bonus est du credit offert (pas de l'argent encaisse) : compte a part dans le bilan.
  credit: { rechargeMin: 50, rechargeMax: 5000, bonusSeuil: 300, bonusPourcentage: 0.05 },

  // Pas de paiement en ligne au lancement : on enregistre seulement le moyen et les sommes
  moyensPaiement: ["Espèces", "Carte bancaire", "Revolut", "Bit", "Virement"],
  // 17 nov. 2026 (regles v18) : moyens que Rebecca peut noter a l'encaissement (PayPal en plus des choix des clientes)
  moyensEncaissement: ["Espèces", "Carte bancaire", "Revolut", "Bit", "Virement", "PayPal", "Carte cadeau"], // 18 nov. 2026 : carte cadeau (code RS-XXXX-XXXX)
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
