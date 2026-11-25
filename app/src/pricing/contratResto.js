// DEVENIR RESTAURANT PARTENAIRE (19 nov. 2026, Rebecca) - regles pures (aucun acces internet ni base de donnees)
// « Un seul lien, le même pour tous les restaurants : je l'envoie par WhatsApp, le restaurant voit une page
// professionnelle avec les conditions, accepte, remplit le formulaire, choisit sa formule, signe ; il reçoit le
// contrat par e-mail, moi aussi, et il se met tout seul dans mon répertoire des restaurants. »
// Texte repris du modèle « Contrat de partenariat livraison – Restaurants et commerçants » (doc du projet).
// PROVISOIRE : à faire relire par un juriste avant de l'utiliser largement.
import { A4, couper, fabriquerPdfPages } from "./pdfSimple.js";
import { MIN_HEURES, erreursCreneaux, lireCreneaux, minimumCreneau, tableauMinimums } from "./creneauxResto.js";
import { KM_MAX_GRILLE, avecCreneaux, grilleKm } from "./commercants.js";

export const VERSION_CONTRAT = "2026-11-25-1"; // 25 nov. : palier volume en formule B (validé par Rebecca) ; 20 nov. 11h : formule A + B (Rebecca) ; // 20 nov. 9h33 : décisions de Rebecca après la 3e relecture ChatGPT (demi-heures, créneaux joints, > 6 km, commande en plus, essai, créneau non assuré) ; 20 nov. : créneaux, minimum garanti, clients, moyens de paiement (relecture ChatGPT)
import { PALIER_VOLUME } from "./restos.js";
export const EMAIL_REBECCA = "rebecca.services.transport@gmail.com";
export const LIEN_INSCRIPTION = "#/restaurant-partenaire";

// Tarifs standard (Réglages → « Restaurants partenaires » ; ceux-ci si rien n'est réglé)
export const TARIFS_STANDARD = {
  // 20 nov. 2026 (Rebecca) : B = minimum 75 ₪ par heure de créneau, 2 h au moins ; +5 ₪ par article très lourd
  // 25 nov. 2026 (refonte) : A 30/40, B 25/35, commande en plus 15 ₪ (avant A 35/45, B 30/40, 20 ₪)
  A: { jusqua3: 30, de3a6: 40, enPlus: 15, minimumCreneau: 0, parHeure: 0, tresLourd: 5 },
  B: { jusqua3: 25, de3a6: 35, enPlus: 15, minimumCreneau: 5, parHeure: 75, tresLourd: 5 },
};
const entier = (x, d, max = 1000) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : d;
};
export function tarifsStandard(reglage) {
  const r = reglage && typeof reglage === "object" ? reglage : {};
  const lire = (k) => {
    const s = r[k] && typeof r[k] === "object" ? r[k] : {};
    const d = TARIFS_STANDARD[k];
    return { jusqua3: entier(s.jusqua3, d.jusqua3), de3a6: entier(s.de3a6, d.de3a6), enPlus: entier(s.enPlus, d.enPlus), minimumCreneau: entier(s.minimumCreneau, d.minimumCreneau, 50), parHeure: k === "B" ? entier(s.parHeure, d.parHeure) : 0, tresLourd: entier(s.tresLourd, d.tresLourd) };
  };
  return { A: lire("A"), B: lire("B") };
}

export const FORMULES_RESTO = [
  { v: "A", titre: "Formule A · À la demande, sans engagement de volume", resume: "Vous m'envoyez une livraison quand vous en avez besoin. Sans engagement de volume, aucun minimum de livraisons, sous réserve de disponibilité et d'acceptation de chaque demande." },
  { v: "B", titre: "Formule B · Créneaux réservés, avec engagement", resume: "Pendant les créneaux que vous réservez (jour et heures), j'organise la disponibilité d'un livreur pour vos commandes. En échange d'un prix réduit, vous vous engagez sur ces créneaux : un minimum de facturation par créneau. Une commande en dehors de vos créneaux est au prix de la formule A." },
  { v: "AB", titre: "Formule A + B · Créneaux réservés et à la demande", resume: "Vos créneaux réservés au prix B (par exemple le jeudi soir), et le reste de la semaine à la demande au prix A. Le bon prix s'applique tout seul selon l'heure où la commande est prête." },
];
export const libelleFormuleResto = (v) => (v === "AB" ? "A + B (créneaux réservés et à la demande)" : v === "B" ? "B (créneaux réservés)" : "A (à la demande)");
export const FORMES = [
  { v: "patur", l: "Osek patur (עוסק פטור)" },
  { v: "murshe", l: "Osek murshe (עוסק מורשה)" },
  { v: "societe", l: "Société (חברה בע״מ)" },
];
export const MOYENS = ["Bit", "Revolut", "Espèces", "Virement"];

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const tel = (t) => String(t || "").replace(/\D/g, "");
const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);

// Formulaire vide
export const formulaireVide = () => ({
  formule: "A", creneaux: "", moyen: "Bit",
  nom: "", nomLegal: "", forme: "patur", numero: "", adresse: null, recuperation: "", horaires: "",
  responsable: "", fonction: "", telephone: "", portable: "", email: "", signataire: "",
});

// Erreurs à corriger avant de signer ([] = tout est bon)
export function erreursFormulaire(f, signature = "") {
  const e = [];
  if (!["A", "B", "AB"].includes(f.formule)) e.push("Choisissez une formule.");
  if (avecCreneaux(f.formule)) e.push(...erreursCreneaux(txt(f.creneaux, 200)));
  if (!MOYENS.includes(f.moyen)) e.push("Choisissez un moyen de paiement.");
  if (txt(f.nom, 60).length < 2) e.push("Indiquez le nom du restaurant.");
  if (txt(f.nomLegal, 120).length < 2) e.push("Indiquez le nom légal (celui de l'osek ou de la société).");
  if (!FORMES.some((x) => x.v === f.forme)) e.push("Choisissez la forme de l'entreprise.");
  if (!/^\d{8,10}$/.test(tel(f.numero))) e.push("Indiquez le numéro de l'entreprise (ח.פ / עוסק, 8 à 10 chiffres).");
  if (!f.adresse || !txt(f.adresse.label, 300)) e.push("Indiquez l'adresse du restaurant (choisissez-la dans la liste).");
  if (txt(f.responsable, 60).length < 2) e.push("Indiquez le nom du responsable.");
  if (tel(f.telephone).length < 9) e.push("Indiquez le téléphone du restaurant.");
  if (tel(f.portable).length < 9) e.push("Indiquez le portable du responsable.");
  if (!EMAIL_OK.test(String(f.email || "").trim())) e.push("Indiquez une adresse e-mail valide : le contrat y sera envoyé.");
  if (txt(f.signataire, 60).length < 2) e.push("Écrivez le nom de la personne qui signe.");
  if (!signatureValide(signature)) e.push("Signez avec le doigt dans le cadre.");
  return e;
}

/* ---------- Signature au doigt : des traits (pas une image), pour le PDF et l'écran ---------- */
// Format : « x,y,x,y|x,y,... » ; coordonnées entières de 0 à 999 (cadre 1000 x 400)
export const SIG_L = 1000;
export const SIG_H = 400;
export function encoderSignature(traits = []) {
  return traits
    .filter((t) => Array.isArray(t) && t.length >= 1)
    .map((t) => t.map(([x, y]) => `${Math.max(0, Math.min(SIG_L - 1, Math.round(x)))},${Math.max(0, Math.min(SIG_H - 1, Math.round(y)))}`).join(","))
    .join("|")
    .slice(0, 12000);
}
export function decoderSignature(s) {
  if (typeof s !== "string" || !s) return [];
  return s.split("|").map((t) => {
    const n = t.split(",").map(Number);
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) pts.push([n[i], n[i + 1]]);
    return pts;
  }).filter((t) => t.length);
}
// Une vraie signature : au moins 15 points, et pas un simple point
export function signatureValide(s) {
  if (typeof s !== "string" || !/^[0-9,|]{1,12000}$/.test(s)) return false;
  const pts = decoderSignature(s).flat();
  if (pts.length < 15) return false;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(...xs) - Math.min(...xs) > 60 || Math.max(...ys) - Math.min(...ys) > 40;
}

// Document envoyé à la base (contratsRestos/{id}) : uniquement ces champs (règles v30)
export function contratPropre(f, tarifs, signature) {
  const b = avecCreneaux(f.formule);
  const t = (tarifs && tarifs[b ? "B" : "A"]) || TARIFS_STANDARD[b ? "B" : "A"];
  const ta = (tarifs && tarifs.A) || TARIFS_STANDARD.A;
  const a = f.adresse || {};
  const adresse = { label: txt(a.label, 300) };
  if (typeof a.lat === "number" && typeof a.lon === "number") {
    adresse.lat = a.lat;
    adresse.lon = a.lon;
  }
  return {
    version: VERSION_CONTRAT,
    statut: "signe",
    formule: f.formule,
    tarifs: { jusqua3: t.jusqua3, de3a6: t.de3a6, enPlus: t.enPlus, minimumCreneau: b ? t.minimumCreneau : 0, parHeure: b ? t.parHeure ?? 75 : 0, tresLourd: t.tresLourd ?? 5 },
    // 20 nov. 2026 : B ou A + B -> prix A pour les commandes hors créneaux (règles v32)
    ...(b ? { tarifsA: { jusqua3: ta.jusqua3, de3a6: ta.de3a6, enPlus: ta.enPlus, tresLourd: ta.tresLourd ?? 5 } } : {}),
    creneaux: b ? txt(f.creneaux, 200) : "",
    moyen: f.moyen,
    nom: txt(f.nom, 60),
    nomLegal: txt(f.nomLegal, 120),
    forme: f.forme,
    numero: tel(f.numero).slice(0, 10),
    adresse,
    recuperation: txt(f.recuperation, 200),
    horaires: txt(f.horaires, 200),
    responsable: txt(f.responsable, 60),
    fonction: txt(f.fonction, 60),
    telephone: txt(f.telephone, 20),
    portable: txt(f.portable, 20),
    email: txt(f.email, 120).toLowerCase(),
    signataire: txt(f.signataire, 60),
    signature,
  };
}

// Numéro lisible du contrat : RSR-AAAAMMJJ-XXXX
export const numeroContrat = (id, jour) => `RSR-${String(jour || "").replace(/-/g, "").slice(0, 8)}-${String(id || "").slice(0, 4).toUpperCase()}`;

const shek = (n) => `${n} ₪`;
// Ancien contrat (19 nov., « 5 livraisons par créneau ») : 75 ₪ par heure par défaut
const parHeureDe = (t) => (t && t.parHeure > 0 ? t.parHeure : 75);
const formeTexte = (v) => (FORMES.find((x) => x.v === v) || {}).l || "";
const jourFr = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || "") ? d.slice(0, 10).split("-").reverse().join("/") : "");

// Le contrat complet, rempli : [{ titre, lignes: [texte] }]
export function articlesContrat(c) {
  const t = c.tarifs || {};
  return [
    { titre: "Entre les soussignés", lignes: [
      "Le prestataire : Rebecca Perez, exerçant sous le nom commercial « Rebecca Services », Netanya, téléphone et WhatsApp 054-738-0193, rebecca.services.transport@gmail.com, site rebeccaservices.com, ci-après « Rebecca Services ».",
      `Le partenaire : ${c.nom} (${c.nomLegal}), ${formeTexte(c.forme)} n° ${c.numero}, adresse de récupération ${c.adresse && c.adresse.label}, représenté par ${c.responsable}${c.fonction ? ", " + c.fonction : ""}, téléphone ${c.telephone}, portable ${c.portable}, e-mail ${c.email}, ci-après « le Partenaire ».`,
    ] },
    { titre: "Article 1 – Objet", lignes: ["Rebecca Services livre, pour le compte du Partenaire, les commandes que le Partenaire a reçues directement de ses clients (téléphone, WhatsApp, son propre site, sur place). Le Partenaire reste le seul vendeur de ses produits ; Rebecca Services facture uniquement le service de livraison. Les commandes passées par d'autres plateformes de livraison ne sont pas concernées. Le contrat n'est pas exclusif : chacun reste libre de travailler avec d'autres."] },
    { titre: "Article 2 – Zone et horaires", lignes: [
      "Zone : Netanya et alentours, jusqu'à 12 km du point de récupération (prix de l'Annexe 1) ; au-delà de 12 km, sur devis.",
      "Aucune livraison pendant Chabbat et les fêtes juives (Yom Tov) : arrêt 2 h avant l'entrée, reprise 1 h après la sortie, selon les horaires officiels d'Israël.",
      "Formule A : sans engagement de volume ; chaque demande est livrée sous réserve de disponibilité et de son acceptation par Rebecca Services, sans garantie de délai.",
      "Formule B : les créneaux réservés sont acceptés et enregistrés avec leur jour, leur heure de début et leur heure de fin (Annexe 1). Pendant les créneaux réservés et confirmés, Rebecca Services organise la disponibilité d'un livreur pour les commandes du Partenaire, dans les limites de la zone desservie et des capacités convenues. La réservation d'un créneau garantit cette organisation, mais ni un nombre illimité de livraisons simultanées ni un délai absolu : les heures de prise en charge sont confirmées selon le volume de commandes et la circulation.",
      "Formule A + B : les créneaux réservés suivent les règles de la formule B ; en dehors de ces créneaux, les commandes suivent les règles et les prix de la formule A. En formule B seule, une commande prête en dehors des créneaux réservés est aussi livrée au prix de la formule A, sous réserve de disponibilité. Le prix applicable est déterminé par l'heure à laquelle la commande est prête.",
      "Tournées : plusieurs commandes peuvent être livrées dans la même tournée, en principe jusqu'à 4, et jusqu'à 7 quand elles sont sur le même trajet (une possibilité, selon la compatibilité des adresses, la capacité, les délais et la qualité, et non une garantie) ; une commande qui arrive pendant une tournée peut y être ajoutée si elle se trouve sur le chemin. Pour un volume plus important, les parties conviennent d'un deuxième livreur ou d'un créneau supplémentaire.",
    ] },
    { titre: "Article 3 – Demande de livraison", lignes: ["Le Partenaire envoie chaque demande depuis son espace Rebecca Services (ou par WhatsApp) avec : nom et téléphone du client, adresse complète (étage, code, instructions), heure à laquelle la commande sera prête. La demande n'est engagée qu'une fois acceptée dans l'application ; sans acceptation dans les 5 minutes, elle est refusée automatiquement et le Partenaire en est prévenu."] },
    { titre: "Article 4 – Livreurs", lignes: ["La livraison est faite par Rebecca Perez ou, si elle n'est pas disponible, par un livreur de l'équipe Rebecca Services (Jérémy ou un coursier partenaire validé par Rebecca Services). Rebecca Services reste l'interlocuteur et la responsable vis-à-vis du Partenaire."] },
    { titre: "Article 5 – Obligations du Partenaire", lignes: [
      "Remettre une commande prête à l'heure indiquée, fermée, emballée pour le transport (boissons calées, sauces fermées).",
      "Donner des informations exactes sur le client ; rester joignable pendant la livraison ; payer les relevés dans les délais de l'article 8.",
    ] },
    { titre: "Article 6 – Obligations de Rebecca Services", lignes: [
      "Transporter les commandes dans un sac isotherme propre, sans les ouvrir ; livrer par le trajet le plus direct (plusieurs commandes peuvent être livrées dans la même tournée si cela ne retarde pas anormalement le client) ; prévenir le Partenaire et le client de tout retard important.",
      "Utiliser les coordonnées des clients exclusivement pour l'exécution, le suivi et la résolution des incidents liés à leurs livraisons. Rebecca Services s'interdit de démarcher commercialement les clients du Partenaire pour ses propres activités, même avec leur accord ; seule exception : un client qui contacte lui-même Rebecca Services pour un autre service. Cette obligation s'applique aussi à tous les livreurs qui interviennent pour Rebecca Services.",
      "Faire une photo de preuve de remise quand le client est absent ou le demande.",
    ] },
    { titre: "Article 7 – Prix", lignes: [
      "Les prix sont ceux de l'Annexe 1, en shekels. Rebecca Services étant osek patur, aucune TVA n'est facturée. Les prix peuvent être revus avec un préavis écrit de 15 jours.",
      "Attente au restaurant : 10 minutes de tolérance après l'heure annoncée, puis 5 ₪ par tranche de 5 minutes. Client absent ou injoignable : appel au client et au Partenaire, attente de 10 minutes, puis retour de la commande ; livraison facturée + 50 % pour le retour. Annulation par le Partenaire : gratuite avant le départ du livreur, 50 % après le départ, 100 % une fois la commande récupérée. Erreur d'adresse : trajet supplémentaire facturé selon la grille.",
      `Article très lourd (pack d'eau, carton lourd, caisse de boissons) : ${shek(t.tresLourd ?? 5)} par article, indiqué par le Partenaire dans sa demande. Les sacs ordinaires ne donnent lieu à aucun supplément, quel que soit leur nombre. Aucun pourcentage n'est jamais pris sur le montant des commandes : le prix de la livraison est le même quelle que soit la valeur de la commande.`,
      "Commande en plus dans la même tournée : commande du même restaurant, prête à 10 minutes près, livrée dans la même tournée ; la livraison la plus chère compte comme principale, chaque autre au tarif « commande en plus ». De 6 à 12 km : prix de l'Annexe 1 (le même écart que de 0-3 km à 3-6 km, par tranche de 3 km). Au-delà de 12 km : prix sur devis, accepté par le Partenaire avant le départ.",
      "Formule B : chaque créneau comporte un minimum de facturation (Annexe 1), calculé à la demi-heure ; deux créneaux du même jour qui se touchent ou se chevauchent comptent comme un seul créneau. Les livraisons réellement faites pendant le créneau, y compris celles de plus de 6 km, comptent dans ce minimum et le minimum n'est jamais ajouté une seconde fois. Une annulation du créneau moins de 24 heures avant son début (heure d'Israël) entraîne la facturation du minimum ; annulé 24 heures ou plus avant, rien n'est dû. Si Rebecca Services ne peut pas assurer tout ou partie d'un créneau, elle prévient le Partenaire dès que possible et le minimum de ce créneau n'est pas facturé : seules les livraisons faites sont dues.",
      "Tous les frais supplémentaires (attente, retour, annulation, minimum de créneau) sont détaillés ligne par ligne dans le relevé de la semaine.",
    ] },
    { titre: "Article 8 – Relevé et paiement chaque semaine", lignes: [
      "Semaine du dimanche 00h00 au samedi 23h59 (heure d'Israël). Chaque samedi à minuit, le relevé de la semaine est arrêté ; il est visible à tout moment dans l'espace du Partenaire et dans celui de Rebecca Services, avec les mêmes chiffres.",
      `Paiement le lendemain de l'arrêt du compte, soit le dimanche, par ${c.moyen} (ou par un autre moyen accepté par Rebecca Services : Bit, Revolut, espèces ou virement). Toute erreur est signalée dans les 48 h ; passé ce délai, le relevé est accepté. Sans paiement sous 7 jours, Rebecca Services peut suspendre les livraisons jusqu'au règlement.`,
    ] },
    { titre: "Article 9 – Responsabilité", lignes: ["Le Partenaire est seul responsable de la qualité, de la composition, des allergènes et de la conformité de ses produits. Rebecca Services est responsable d'une commande perdue ou abîmée par sa faute pendant le transport, dans la limite de la valeur de la commande et au maximum 200 ₪ par commande, sur justificatif. Aucune responsabilité en cas de retard dû à un événement extérieur (circulation exceptionnelle, alerte de sécurité, météo, accident)."] },
    { titre: "Article 10 – Durée et fin du contrat", lignes: [
      "Le partenariat débute, à la validation par Rebecca Services, par une période d'essai d'un mois, puis se renouvelle automatiquement de mois en mois. Pendant l'essai, les livraisons effectuées restent facturables selon la formule choisie ; pour la formule B, les créneaux réservés restent soumis aux conditions financières convenues (minimum garanti, annulation), y compris pendant le mois d'essai.",
      "Pendant le mois d'essai, chaque partie peut arrêter à tout moment, par message écrit, sans préavis ; les créneaux B déjà réservés restent dus s'ils sont annulés moins de 24 heures avant leur début. Après l'essai, chaque partie peut mettre fin au partenariat par message écrit (WhatsApp ou e-mail) avec un préavis de sept jours ; en cas de manquement grave ou de non-paiement, sans préavis. Le dernier relevé est arrêté et payé dans les conditions de l'article 8.",
    ] },
    { titre: "Article 11 – Litiges et signature électronique", lignes: ["Les parties cherchent d'abord un accord amiable. À défaut, le droit israélien s'applique et le tribunal compétent est celui de Netanya. Les parties acceptent la signature électronique de ce contrat ; chacune en reçoit une copie par e-mail."] },
    { titre: "Annexe 1 – Formule et prix choisis", lignes: [
      `Formule choisie : ${libelleFormuleResto(c.formule)}.`,
      `${avecCreneaux(c.formule) ? "Prix pendant les créneaux réservés (formule B) : livraison" : "Livraison"} ${grilleKm(t).map((x) => `${x.de ? `de ${x.de} à ${x.a} km` : `jusqu'à ${x.a} km`} : ${shek(x.prix)}`).join(" · ")} · au-delà de ${KM_MAX_GRILLE} km : sur devis · commande en plus dans la même tournée : ${shek(t.enPlus)} · article très lourd : ${shek(t.tresLourd ?? 5)}.`,
      ...(avecCreneaux(c.formule) ? [
        `Prix en dehors des créneaux réservés (formule A) : livraison ${grilleKm(c.tarifsA || TARIFS_STANDARD.A).map((x) => `${x.de ? `de ${x.de} à ${x.a} km` : `jusqu'à ${x.a} km`} : ${shek(x.prix)}`).join(" · ")} · au-delà de ${KM_MAX_GRILLE} km : sur devis · commande en plus : ${shek((c.tarifsA || TARIFS_STANDARD.A).enPlus)} · article très lourd : ${shek((c.tarifsA || TARIFS_STANDARD.A).tresLourd ?? 5)}.`,
        `Créneaux réservés (jours, heures de début et de fin) : ${c.creneaux}.`,
        ...lireCreneaux(c.creneaux).filter((x) => x.heures).map((x) => `• ${x.texte} : ${String(x.heures).replace(".", ",")} h, minimum ${shek(minimumCreneau(x.heures, parHeureDe(t)))} par créneau.`),
        ...(String(c.version || VERSION_CONTRAT) >= "2026-11-25" ? [`Palier volume (créneaux réservés) : dans un même créneau, le même jour, à partir de la ${PALIER_VOLUME.aPartirDe}e livraison acceptée, chaque livraison est facturée ${shek(PALIER_VOLUME.jusqua3)} jusqu'à 3 km et ${shek(PALIER_VOLUME.de3a6)} de 3 à 6 km (au-delà de 6 km : prix de la grille). Ce palier s'applique uniquement quand les livraisons sont regroupables en tournées (adresses compatibles, commandes prêtes à des heures proches) ; il ne s'ajoute à aucune autre remise et n'est jamais plus cher que le prix de la grille.`] : []),
        `Minimum garanti : ${shek(parHeureDe(t))} par heure de créneau, ${MIN_HEURES} heures au moins (${tableauMinimums(parHeureDe(t), t.jusqua3).map((l) => `${l.heures} h = ${shek(l.minimum)}`).join(" · ")}). Les livraisons réellement faites pendant le créneau comptent dans ce minimum, à leur tarif réel (par exemple ${shek(t.de3a6)} pour 3 à 6 km) ; si leur total est inférieur au minimum, seule la différence est facturée, jamais en plus des livraisons. Le minimum s'applique dès le premier créneau, y compris pendant le mois d'essai. Un créneau annulé moins de 24 h à l'avance reste dû au minimum ; annulé au moins 24 h avant, rien n'est dû.`,
      ] : []),
      `Moyen de paiement choisi : ${c.moyen}.`,
      `Adresse de récupération : ${(c.adresse && c.adresse.label) || ""}${c.recuperation ? " (" + c.recuperation + ")" : ""}.`,
      `Début du partenariat : ${c.valideLe ? jourFr(c.valideLe) : "à la validation par Rebecca Services (contresignature)"}.`,
      ...(c.horaires ? [`Horaires du restaurant : ${c.horaires}.`] : []),
    ] },
  ];
}

// Ligne de signature (texte) pour l'écran, l'e-mail et le PDF
export function lignesSignatures(c, id) {
  const signe = c.signeLe ? jourFr(c.signeLe) : "";
  const heure = typeof c.signeLe === "string" ? c.signeLe.slice(11, 16).replace(":", "h") : "";
  return [
    `Contrat n° ${numeroContrat(id, c.signeLe)} · conditions version ${c.version || VERSION_CONTRAT}.`,
    `Pour le Partenaire : ${c.signataire}, signé électroniquement le ${signe}${heure ? " à " + heure : ""}.`,
    c.statut === "valide" ? `Pour Rebecca Services : Rebecca Perez, contresigné électroniquement le ${jourFr(c.valideLe)}.` : "Pour Rebecca Services : en attente de validation par Rebecca Perez.",
  ];
}

// E-mail (texte) envoyé au restaurant et à Rebecca juste après la signature
export function emailContrat(c, id, lien) {
  return [
    `Bonjour ${c.responsable},`,
    "",
    `Merci ! Le contrat de partenariat livraison entre ${c.nom} et Rebecca Services est signé.`,
    `Formule ${libelleFormuleResto(c.formule)}${avecCreneaux(c.formule) ? ` · créneaux réservés : ${c.creneaux} · prix pendant les créneaux` : ""} · jusqu'à 3 km : ${c.tarifs.jusqua3} ₪ · de 3 à 6 km : ${c.tarifs.de3a6} ₪ · 6 à 9 km : ${grilleKm(c.tarifs)[2].prix} ₪ · 9 à 12 km : ${grilleKm(c.tarifs)[3].prix} ₪ · commande en plus : ${c.tarifs.enPlus} ₪ · paiement le dimanche par ${c.moyen}.`,
    "",
    ...(avecCreneaux(c.formule) ? [`En dehors des créneaux : prix de la formule A · jusqu'à 3 km : ${(c.tarifsA || TARIFS_STANDARD.A).jusqua3} ₪ · de 3 à 6 km : ${(c.tarifsA || TARIFS_STANDARD.A).de3a6} ₪ · 6 à 9 km : ${grilleKm(c.tarifsA || TARIFS_STANDARD.A)[2].prix} ₪ · 9 à 12 km : ${grilleKm(c.tarifsA || TARIFS_STANDARD.A)[3].prix} ₪.`] : []),
    "",
    `Votre contrat complet (à garder, et en PDF) : ${lien}`,
    "",
    "Prochaine étape : je valide votre inscription et je vous envoie sur WhatsApp le lien de votre espace, pour m'envoyer vos livraisons.",
    "",
    "Rebecca Services · 054-738-0193 · rebeccaservices.com",
    `Contrat n° ${numeroContrat(id, c.signeLe)}`,
  ].join("\n");
}

/* ---------- PDF du contrat (plusieurs pages A4, aux couleurs de Rebecca Services) ---------- */
const NOIR = "#141214";
const ROSE = "#e7a9b4";
const OR = "#c9967a";
const CREME = "#faf6f2";
const GRIS = "#6b5d60";
export function contratPdf(c, id) {
  const L = A4.largeur;
  const H = A4.hauteur;
  const m = 50;
  const pages = [];
  let el = [];
  let y = 0;
  const nouvellePage = (premiere) => {
    if (el.length) pages.push(el);
    el = [];
    if (premiere) {
      el.push({ t: "rect", x: 0, y: 0, w: L, h: 104, fond: NOIR });
      el.push({ t: "texte", x: m, y: 48, texte: "Rebecca Services", taille: 22, gras: true, couleur: CREME });
      el.push({ t: "texte", x: m, y: 74, texte: "Contrat de partenariat livraison – Restaurants et commerçants", taille: 11, couleur: ROSE });
      el.push({ t: "trait", x1: 0, y1: 104, x2: L, y2: 104, couleur: OR, epaisseur: 3 });
      y = 136;
    } else {
      el.push({ t: "texte", x: m, y: 40, texte: `Rebecca Services · contrat n° ${numeroContrat(id, c.signeLe)} · ${c.nom}`, taille: 9, couleur: GRIS });
      el.push({ t: "trait", x1: m, y1: 48, x2: L - m, y2: 48, couleur: OR });
      y = 72;
    }
  };
  const place = (h) => {
    if (y + h > H - 50) nouvellePage(false);
  };
  // La police du PDF n'a pas l'hébreu (« עוסק פטור » sortait en « ???? ») : on le retire, le français suffit
  const sansHebreu = (t) => String(t).replace(/\s*\([\u0590-\u05FF\s״׳"'.]+\)/g, "").replace(/[\u0590-\u05FF]+/g, "");
  const ecrire = (texte, taille = 10, gras = false, couleur = NOIR, ecart = 4) => {
    for (const l of couper(sansHebreu(texte), taille, L - 2 * m, gras)) {
      place(taille + 4);
      el.push({ t: "texte", x: m, y, texte: l, taille, gras, couleur });
      y += taille + 4;
    }
    y += ecart;
  };
  nouvellePage(true);
  ecrire(`Contrat n° ${numeroContrat(id, c.signeLe)} · version des conditions ${c.version || VERSION_CONTRAT}`, 10, true, GRIS, 10);
  for (const a of articlesContrat(c)) {
    place(30);
    y += 6;
    ecrire(a.titre, 12, true, NOIR, 2);
    for (const l of a.lignes) ecrire(l, 10, false, NOIR, 4);
  }
  // Signatures (la sienne dessinée en traits, celle de Rebecca en texte)
  place(190);
  y += 10;
  ecrire("Signatures", 12, true, NOIR, 4);
  for (const l of lignesSignatures(c, id)) ecrire(l, 10, false, NOIR, 2);
  const bx = m;
  const by = y + 6;
  const bw = 220;
  const bh = bw * (SIG_H / SIG_L);
  el.push({ t: "rect", x: bx, y: by, w: bw, h: bh, bord: "#e3d6d2" });
  for (const t of decoderSignature(c.signature)) {
    for (let i = 1; i < t.length; i++) {
      el.push({ t: "trait", x1: bx + (t[i - 1][0] / SIG_L) * bw, y1: by + (t[i - 1][1] / SIG_H) * bh, x2: bx + (t[i][0] / SIG_L) * bw, y2: by + (t[i][1] / SIG_H) * bh, couleur: NOIR, epaisseur: 1.2 });
    }
  }
  el.push({ t: "texte", x: bx, y: by + bh + 14, texte: `Signature de ${c.signataire}`, taille: 9, couleur: GRIS });
  y = by + bh + 30;
  pages.push(el);
  // pied de page sur chaque page
  pages.forEach((p, i) => p.push({ t: "texte", x: L / 2, y: H - 24, texte: `rebeccaservices.com · page ${i + 1} / ${pages.length}`, taille: 8, couleur: OR, align: "centre" }));
  return fabriquerPdfPages({ fond: CREME, pages, titre: `Contrat ${numeroContrat(id, c.signeLe)}` });
}

// Fiche du Répertoire créée toute seule pour un restaurant qui a signé (catégorie « Commerçant partenaire »)
export function ficheDepuisContrat(c, id, base) {
  return {
    ...base,
    nom: c.nom,
    telephone: c.telephone,
    nom2: c.responsable,
    telephone2: c.portable,
    domicile: c.adresse && c.adresse.label ? c.adresse : null,
    categorie: "commercants",
    enfants: [],
    resto: { recuperation: c.recuperation || "", horaires: c.horaires || "", nomLegal: c.nomLegal || "", numero: c.numero || "", email: c.email || "", contratId: id },
    contratPro: { formule: c.formule, jusqua3: c.tarifs.jusqua3, de3a6: c.tarifs.de3a6, enPlus: c.tarifs.enPlus, minimumCreneau: c.tarifs.minimumCreneau || 5, parHeure: c.tarifs.parHeure ?? (avecCreneaux(c.formule) ? 75 : 0), tresLourd: c.tarifs.tresLourd ?? 5, moyen: c.moyen, creneaux: c.creneaux || "", ...(avecCreneaux(c.formule) ? { prixA: { ...(c.tarifsA || TARIFS_STANDARD.A) } } : {}) },
  };
}

// Les tarifs signés sont-ils bien les tarifs standard ? (sinon, Rebecca est prévenue avant d'activer)
export const tarifsConformes = (c, standard) => {
  const b = avecCreneaux(c.formule);
  const s = standard && standard[b ? "B" : "A"];
  const sa = standard && standard.A;
  const aOk = !b || !c.tarifsA || (!!sa && ["jusqua3", "de3a6", "enPlus"].every((k) => sa[k] === c.tarifsA[k]));
  return !!s && aOk && ["jusqua3", "de3a6", "enPlus"].every((k) => s[k] === c.tarifs[k]) && (c.tarifs.tresLourd === undefined || s.tresLourd === c.tarifs.tresLourd) && (!b || (c.tarifs.parHeure === undefined ? s.minimumCreneau === c.tarifs.minimumCreneau : s.parHeure === c.tarifs.parHeure));
};
