// SAUVEGARDE : fichiers d'export (copie complete + journal financier) - Rebecca Transport & Services
// Logique pure (aucun acces internet ni base de donnees) : elle se teste seule.

const SEP = ";"; // separateur des colonnes (Excel et Numbers en francais)

// Les dates Firebase (horodatages) deviennent du texte lisible ; le reste est copie tel quel.
export function nettoyer(v) {
  if (v && typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v.map(nettoyer);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = nettoyer(v[k]);
    return o;
  }
  return v;
}

// Les lettres accentuees et l'hebreu sont ecrits en \uXXXX : le fichier ne contient que des caracteres simples,
// donc aucun logiciel ne peut mal lire les accents. Une fois relu, le texte est identique.
const enAscii = (json) => json.replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

// Copie complete (format JSON) : demandes, mouvements d'argent, depenses
export function sauvegardeJson({ demandes, mouvements, depenses }, maintenant = new Date()) {
  return enAscii(JSON.stringify(
    {
      application: "Rebecca Transport & Services",
      exporteLe: maintenant.toISOString(),
      nombre: { demandes: demandes.length, mouvements: mouvements.length, depenses: depenses.length },
      demandes: nettoyer(demandes),
      mouvements: nettoyer(mouvements),
      depenses: nettoyer(depenses),
    },
    null,
    2
  ));
}

const cellule = (v) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
// Texte libre : une formule (=, +, -, @) ne doit jamais s'executer dans le tableur
const texte = (v) => {
  const s = v == null ? "" : String(v);
  return cellule(/^[=+\-@\t\r]/.test(s) ? "'" + s : s);
};
// Nombre avec virgule decimale (tableur francais)
const nombre = (n) => cellule(String(Math.round(n * 100) / 100).replace(".", ","));

const CAS = { client: "client annule", tardive: "annulation tardive", absence: "client absent", rebecca: "annulation par Rebecca" };

export const ENTETE_JOURNAL = ["Date", "Type", "Montant (₪)", "Moyen", "Catégorie", "Course", "Client", "Détail"];

// Journal financier trie par date (format CSV, pour le comptable ou un tableur)
// Montant : + = argent reçu, - = argent sorti (remboursement, dépense)
export function journalCsv({ demandes, mouvements, depenses }) {
  const parId = {};
  for (const d of demandes) parId[d.id] = d;
  const lignes = [];
  for (const m of mouvements) {
    const d = parId[m.resId];
    const course = d ? texte((d.serviceTitre || "") + " - " + (d.date || "")) : "";
    const client = d ? texte(d.nom) : "";
    let type = "";
    let montant = "";
    let detail = "";
    if (m.kind === "paiement") {
      type = "Paiement";
      montant = nombre(Number(m.montant));
    } else if (m.kind === "correction") {
      type = "Correction de paiement";
      montant = nombre(Number(m.montant));
      detail = texte(m.motif);
    } else if (m.kind === "remboursement_effectue") {
      type = "Remboursement effectué";
      montant = nombre(-Number(m.montant));
      detail = texte(m.ref);
    } else if (m.kind === "annulation") {
      type = "Annulation validée";
      detail = texte(
        (CAS[m.cas] || m.cas) + " ; gardé " + m.fraisRetenus + " ₪ ; remboursement validé " + m.remboursementValide + " ₪ ; validé par " + m.validePar + (m.motif ? " ; " + m.motif : "")
      );
    } else {
      continue;
    }
    lignes.push({ date: m.date, cols: [cellule(m.date), cellule(type), montant, texte(m.moyen), "", course, client, detail] });
  }
  for (const x of depenses) {
    const negatif = Number(x.montant) < 0;
    lignes.push({
      date: x.date,
      cols: [cellule(x.date), negatif ? "Correction de dépense" : "Dépense", nombre(-Number(x.montant)), "", texte(x.categorie), "", "", texte(x.motif)],
    });
  }
  lignes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const tout = [ENTETE_JOURNAL.map(cellule).join(SEP), ...lignes.map((l) => l.cols.join(SEP))];
  return "\ufeff" + tout.join("\r\n") + "\r\n"; // \ufeff : accents et ₪ bien lus par Excel
}

export const nomFichier = (prefixe, dateIso, extension) => "rebecca-" + prefixe + "-" + dateIso + "." + extension;

// Nombre de jours entre deux dates "AAAA-MM-JJ" (b - a)
export function joursEntre(a, b) {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
}
