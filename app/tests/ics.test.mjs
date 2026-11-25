import { test, egal, section } from "./outils.mjs";
import { lireIcs, rdvDuJour } from "../src/pricing/ics.js";
const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20261126T100000
DTEND;TZID=Asia/Jerusalem:20261126T113000
SUMMARY:Dentiste
LOCATION:Herzl 5\\, Netanya
END:VEVENT
BEGIN:VEVENT
DTSTART:20261126T150000Z
DTEND:20261126T160000Z
SUMMARY:Appel
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20261101T180000
DTEND;TZID=Asia/Jerusalem:20261101T190000
RRULE:FREQ=WEEKLY;BYDAY=SU
SUMMARY:Sport
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261127
SUMMARY:Anniversaire
END:VEVENT
END:VCALENDAR`;
section("Agenda iPhone (.ics)");
const ev = lireIcs(ICS);
test("4 rendez-vous lus", () => egal(ev.length, 4));
test("jeudi 26 : dentiste 10h-11h30 + appel 17h (UTC+2) + journée", () => egal(rdvDuJour(ev, "2026-11-26").map((r) => [r.titre, r.debut, r.fin, r.lieu]), [["Anniversaire", "", "", ""], ["Dentiste", "10:00", "11:30", "Herzl 5, Netanya"], ["Appel", "17:00", "18:00", ""]]));
test("répétition chaque dimanche", () => egal(rdvDuJour(ev, "2026-11-29").map((r) => r.titre + r.debut), ["Sport18:00"]));
test("pas le lundi", () => egal(rdvDuJour(ev, "2026-11-30").length, 0));
