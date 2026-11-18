// Réduit une photo dans le téléphone avant de l'enregistrer (pas de Firebase Storage : image en texte base64).
// 18 nov. 2026 : documents des coursiers et photos de preuve de livraison.
export function reduirePhoto(fichier, { cote = 1400, qualite = 0.8, maxOctets = 650000 } = {}) {
  return new Promise((ok, ko) => {
    if (!fichier || !/^image\//.test(fichier.type || "")) return ko(new Error("Ce fichier n'est pas une photo."));
    const lecteur = new FileReader();
    lecteur.onerror = () => ko(new Error("Lecture impossible."));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => ko(new Error("Photo illisible."));
      img.onload = () => {
        let r = Math.min(1, cote / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        const dessiner = () => {
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        };
        dessiner();
        let q = qualite;
        let d = c.toDataURL("image/jpeg", q);
        while (d.length > maxOctets && q > 0.4) {
          q -= 0.1;
          d = c.toDataURL("image/jpeg", q);
        }
        while (d.length > maxOctets && r > 0.2) {
          r *= 0.75;
          dessiner();
          d = c.toDataURL("image/jpeg", 0.6);
        }
        if (d.length > maxOctets) return ko(new Error("Photo trop lourde."));
        ok(d);
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}
