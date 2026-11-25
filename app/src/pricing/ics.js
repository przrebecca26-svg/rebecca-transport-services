// LECTURE D'UN CALENDRIER .ics (25 nov. 2026) - règles pures, testées
// Rendez-vous de l'agenda iPhone d'un jour donné, à l'heure d'Israël. Répétitions simples prises en compte
// (tous les jours / toutes les semaines / tous les mois, avec fin ou nombre de fois).
const deplier = (t) => String(t || "").replace(/\r?\n[ \t]/g, "");
const ISR = "Asia/Jerusalem";
function enIsrael(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ISR, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}
// heure locale d'un fuseau -> instant (ms)
function local(a, m, j, h, mi, tz) {
  const approx = Date.UTC(a, m - 1, j, h, mi);
  const vu = new Date(new Date(approx).toLocaleString("en-US", { timeZone: tz || ISR }));
  const utc = new Date(new Date(approx).toLocaleString("en-US", { timeZone: "UTC" }));
  return approx - (vu - utc);
}
function lireDate(ligne) {
  const [tete, val] = [ligne.slice(0, ligne.indexOf(":")), ligne.slice(ligne.indexOf(":") + 1).trim()];
  const tz = (/TZID=([^;:]+)/.exec(tete) || [])[1];
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(val);
  if (!m) return null;
  if (!m[4]) return { jour: true, ms: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
  if (m[7]) return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) };
  try { return { ms: local(+m[1], +m[2], +m[3], +m[4], +m[5], tz) }; } catch { return { ms: local(+m[1], +m[2], +m[3], +m[4], +m[5]) }; }
}
const texte = (v) => String(v || "").replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\;/g, ";").trim();

export function lireIcs(ics) {
  const sortie = [];
  for (const bloc of deplier(ics).split("BEGIN:VEVENT").slice(1)) {
    const lignes = bloc.split(/\r?\n/);
    const champ = (nom) => lignes.find((l) => l.startsWith(nom + ":") || l.startsWith(nom + ";")) || "";
    const d = lireDate(champ("DTSTART"));
    if (!d) continue;
    const f = lireDate(champ("DTEND"));
    const val = (l) => l.slice(l.indexOf(":") + 1);
    const rrule = val(champ("RRULE"));
    const exdates = lignes.filter((l) => l.startsWith("EXDATE")).map((l) => lireDate(l)).filter(Boolean).map((x) => x.ms);
    if (/STATUS:CANCELLED/.test(bloc)) continue;
    sortie.push({ titre: texte(val(champ("SUMMARY"))) || "Rendez-vous", lieu: texte(val(champ("LOCATION"))), debut: d.ms, fin: f ? f.ms : d.ms + (d.jour ? 86400000 : 3600000), jour: !!d.jour, rrule, exdates });
  }
  return sortie;
}

// Rendez-vous d'une date (AAAA-MM-JJ) : { debut "HH:MM", fin "HH:MM", titre, lieu, journee }
export function rdvDuJour(evenements, date) {
  const res = [];
  const [a, m, j] = date.split("-").map(Number);
  for (const e of evenements) {
    const duree = e.fin - e.debut;
    const occurrences = [e.debut];
    if (e.rrule) {
      const r = Object.fromEntries(e.rrule.split(";").map((x) => x.split("=")));
      const pas = { DAILY: 1, WEEKLY: 7 }[r.FREQ];
      const inter = Number(r.INTERVAL) || 1;
      const fin = r.UNTIL ? (lireDate("X:" + r.UNTIL) || {}).ms : Infinity;
      const max = Number(r.COUNT) || 10000;
      const cible = Date.UTC(a, m - 1, j);
      if (pas) {
        const jours = r.BYDAY && r.FREQ === "WEEKLY" ? r.BYDAY.split(",").map((x) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(x.slice(-2))) : null;
        const ecartJ = Math.round((cible - Date.UTC(...enIsrael(e.debut).date.split("-").map((x, i) => (i === 1 ? +x - 1 : +x)))) / 86400000);
        if (ecartJ > 0) {
          const ok = jours ? jours.includes(new Date(cible).getUTCDay()) && Math.floor(ecartJ / 7) % inter === 0 : ecartJ % (pas * inter) === 0;
          const n = Math.floor(ecartJ / (pas * inter));
          if (ok && n < max) occurrences.push(e.debut + ecartJ * 86400000);
        }
      } else if (r.FREQ === "MONTHLY") {
        const d0 = enIsrael(e.debut).date.split("-").map(Number);
        const n = (a - d0[0]) * 12 + (m - d0[1]);
        if (n > 0 && j === d0[2] && n % inter === 0 && n < max) occurrences.push(e.debut + (cible - Date.UTC(d0[0], d0[1] - 1, d0[2])));
      }
      for (let i = occurrences.length - 1; i > 0; i--) if (occurrences[i] > fin) occurrences.splice(i, 1);
    }
    for (const o of occurrences) {
      if (e.exdates.includes(o)) continue;
      if (e.jour) {
        const d0 = new Date(o).toISOString().slice(0, 10);
        const d1 = new Date(o + duree - 1).toISOString().slice(0, 10);
        if (date >= d0 && date <= d1) res.push({ titre: e.titre, lieu: e.lieu, journee: true, debut: "", fin: "" });
        continue;
      }
      const s = enIsrael(o);
      const f = enIsrael(o + duree);
      if (s.date <= date && f.date >= date) res.push({ titre: e.titre, lieu: e.lieu, journee: false, debut: s.date < date ? "00:00" : s.heure, fin: f.date > date ? "23:59" : f.heure });
    }
  }
  return res.sort((x, y) => (x.debut || "").localeCompare(y.debut || ""));
}
