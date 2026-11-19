// IMPORTER UN FICHIER (19 nov. 2026, 16h03) - regles pures - Rebecca Services
// Rebecca : « tu me prépares le tableau, je le télécharge, je l'importe dans l'application et tout se met à jour,
// pour n'importe quelle catégorie : au moins il n'y a pas d'erreur ». Fichier texte (.csv) préparé par Claude,
// une ligne par élément, colonnes séparées par « ; ». Avant d'enregistrer, l'appli montre tout (aperçu) ;
// une ligne fausse est signalée et rien n'est importé tant qu'il reste une erreur.
//
//   remplacer;wolt;DU;AU          -> les lignes Wolt (de Rebecca) qui commencent entre DU et AU sont d'abord effacées
//   wolt;DU;AU;revenu;pourboires;caution;retenue;livraisons;km;numero;detail
//   depense;DATE;categorie;montant;detail          (catégorie Carburant -> va dans ⛽ Carburant comme un plein)
//   plein;DATE;montant;litres;compteur
// Dates : AAAA-MM-JJ ou JJ/MM/AAAA. Nombres : 12,5 ou 12.5. Lignes vides et lignes commençant par # ignorées.
import { validerAutreRevenu } from "./financesAnnee.js";
import { CATEGORIES } from "./depenses.js";

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
export function lireDate(x) {
  const t = String(x || "").trim();
  if (DATE_ISO.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
const nombre = (x) => {
  const t = String(x ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

export function lireFichier(texte) {
  const res = { remplacer: [], wolt: [], depenses: [], pleins: [], erreurs: [] };
  const lignes = String(texte || "").replace(/^﻿/, "").split(/\r?\n/);
  lignes.forEach((brut, i) => {
    const n = i + 1;
    const l = brut.trim();
    if (!l || l.startsWith("#")) return;
    const c = l.split(";").map((x) => x.trim());
    const type = c[0].toLowerCase();
    if (type === "type") return; // ligne d'en-tête
    if (type === "remplacer") {
      const du = lireDate(c[2]);
      const au = lireDate(c[3]);
      if (String(c[1]).toLowerCase() !== "wolt" || !du || !au || au < du) return res.erreurs.push(`Ligne ${n} : « remplacer » doit être : remplacer;wolt;du;au`);
      return res.remplacer.push({ source: "wolt", du, au });
    }
    if (type === "wolt") {
      const [, du, au, revenu, pourboire, caution, retenue, livraisons, km, numero, ...detail] = c;
      const kmN = nombre(km);
      const v = validerAutreRevenu({ source: "Wolt", periode: lireDate(du) === lireDate(au) ? "jour" : "semaine", debut: lireDate(du), fin: lireDate(au), revenu: String(nombre(revenu)), pourboire: String(nombre(pourboire)), caution: String(nombre(caution)), retenue: String(nombre(retenue)), livraisons: String(livraisons || "0").trim() || "0", numero: numero || "", detail: detail.join(";") });
      if (v.erreur) return res.erreurs.push(`Ligne ${n} (Wolt ${du} → ${au}) : ${v.erreur}`);
      if (!Number.isFinite(kmN) || kmN < 0 || kmN > 20000) return res.erreurs.push(`Ligne ${n} : km invalides.`);
      return res.wolt.push({ ligne: v.ligne, km: kmN });
    }
    if (type === "depense") {
      const date = lireDate(c[1]);
      const categorie = CATEGORIES.find((x) => x.toLowerCase() === String(c[2] || "").toLowerCase()) || "";
      const montant = nombre(c[3]);
      if (!date) return res.erreurs.push(`Ligne ${n} : date de la dépense invalide.`);
      if (!categorie) return res.erreurs.push(`Ligne ${n} : catégorie inconnue (${CATEGORIES.join(", ")}).`);
      if (!(montant > 0) || montant > 100000) return res.erreurs.push(`Ligne ${n} : montant invalide.`);
      const motif = c.slice(4).join(";").slice(0, 200);
      if (categorie === "Carburant") return res.pleins.push({ date, montant, litres: 0, compteur: 0 });
      return res.depenses.push({ date, categorie, montant, ...(motif ? { motif } : {}) });
    }
    if (type === "plein") {
      const date = lireDate(c[1]);
      const montant = nombre(c[2]);
      const litres = nombre(c[3]);
      const compteur = nombre(c[4]);
      if (!date || !(montant > 0) || montant > 5000 || !(litres >= 0) || !(compteur >= 0)) return res.erreurs.push(`Ligne ${n} : plein invalide (date;montant;litres;compteur).`);
      return res.pleins.push({ date, montant, litres, compteur });
    }
    res.erreurs.push(`Ligne ${n} : type inconnu « ${c[0]} » (wolt, depense, plein ou remplacer).`);
  });
  return res;
}

// Lignes Wolt existantes à effacer d'après les « remplacer » (seulement celles de Rebecca, sans opérateur)
export function aEffacer(existantes = [], remplacer = []) {
  return existantes.filter((l) => !l.operateur && /wolt/i.test(l.source || "Wolt") && remplacer.some((r) => String(l.debut) >= r.du && String(l.debut) <= r.au));
}

export const resumeImport = (r) => {
  const total = (a, k) => Math.round(a.reduce((s, x) => s + (Number(k(x)) || 0), 0) * 100) / 100;
  return {
    wolt: r.wolt.length,
    woltTotal: total(r.wolt, (x) => x.ligne.revenu + x.ligne.pourboire),
    livraisons: r.wolt.reduce((s, x) => s + (x.ligne.livraisons || 0), 0),
    km: total(r.wolt, (x) => x.km),
    depenses: r.depenses.length,
    depensesTotal: total(r.depenses, (x) => x.montant),
    pleins: r.pleins.length,
    pleinsTotal: total(r.pleins, (x) => x.montant),
  };
};
