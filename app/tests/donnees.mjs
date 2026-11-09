// DONNEES DE TEST - Rebecca Services
// Adresses fictives (avec position) et trajets fixes, pour des calculs toujours identiques.
// Aucune donnee reelle de client.

export const ADRESSES = {
  netanya: { label: "Rue Herzl 10, Netanya", lat: 32.3286, lon: 34.8569 },
  netanya2: { label: "Kiryat Nordau, Netanya", lat: 32.3400, lon: 34.8650 },
  hadera: { label: "Rue Hanassi 5, Hadera", lat: 32.4340, lon: 34.9196 },
  herzliya_raanana: { label: "Rue Ahuza 100, Raanana", lat: 32.1848, lon: 34.8713 },
  tel_aviv: { label: "Boulevard Rothschild 1, Tel Aviv", lat: 32.0636, lon: 34.7741 },
  haifa: { label: "Rue Hanevi'im 2, Haifa", lat: 32.8150, lon: 34.9900 },
  jerusalem: { label: "Rue Jaffa 30, Jerusalem", lat: 31.7830, lon: 35.2170 },
  hors_grille: { label: "Rue Principale 3, Ariel", lat: 32.1050, lon: 35.1880 },
};

// Trajets depuis Netanya (km, minutes) par zone de destination
export const TRAJETS = {
  netanya: { km: 6, minutes: 14 },
  netanya2: { km: 4, minutes: 10 },
  hadera: { km: 26, minutes: 25 },
  herzliya_raanana: { km: 21, minutes: 24 },
  tel_aviv: { km: 33, minutes: 42 },
  ben_gurion: { km: 46, minutes: 45 },
  haifa: { km: 80, minutes: 70 },
  jerusalem: { km: 96, minutes: 88 },
  hors_grille: { km: 52, minutes: 50 },
};

// Dates de reference (heure locale Israel)
export const MARDI = "2026-11-10";
export const VENDREDI = "2026-11-13";
export const SAMEDI = "2026-11-14";
export const MAINTENANT = Date.UTC(2026, 10, 9, 8, 0); // 9 nov. 2026, 10h00 en Israel
