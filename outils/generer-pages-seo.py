import json, os, html, sys
pub = sys.argv[1]
BASE = "https://rebeccaservices.com"
WA = "https://wa.me/972547380193"
P = [
 ("livraison-coursier-netanya","Coursier et livraison à Netanya","Livraison de colis, clés, documents et achats, courses faites pour vous et petits déménagements, depuis Netanya vers toute Israël.","Services coursier",["Colis, clés et documents livrés en main propre","Vos achats récupérés ou vos courses faites pour vous","Petits déménagements : valises, cartons, petits objets","Devis immédiat sur le site, sans surprise"]),
 ("transport-prive-netanya","Transport privé et transfert aéroport depuis Netanya","Transfert aéroport Ben Gourion, trajets privés, Hatan & Kala et mise à disposition avec chauffeur, depuis Netanya.","Transport privé",["Transfert aéroport Ben Gourion, avec suivi de votre vol","Trajets privés partout en Israël","Hatan & Kala : voiture décorée pour le grand jour","Mise à disposition pour vos événements"]),
 ("onglerie-nails-prestige-netanya","Nails Prestige – onglerie à Netanya","Semi-permanent, gel, Gel-X, acrylique, nail art et beauté des mains à Netanya. Réservation en ligne.","Nails Prestige",["Semi-permanent et beauté des mains","Extensions gel, Gel-X et acrylique","Nail art et réparations","Réservation de votre créneau en ligne"]),
 ("regenx-netanya","RegenX – soin reconstructeur du cheveu à Netanya","RegenX, soin profond de reconstruction du cheveu à Netanya. Réservation en ligne.","RegenX",["Reconstruction en profondeur des cheveux abîmés","Conseils adaptés à votre type de cheveu","Réservation de votre créneau en ligne"]),
 ("prestige-hair-netanya","Prestige Hair – coiffure à Netanya","Coupe, couleur et soins des cheveux à Netanya avec Prestige Hair. Réservation en ligne.","Prestige Hair",["Coupe et coiffage","Couleur et soins","Réservation de votre créneau en ligne"]),
 ("slim-lift-netanya","Prestige Slim & Lift – soins minceur à Netanya","Soins minceur et raffermissement à Netanya avec Prestige Slim & Lift. Réservation en ligne.","Prestige Slim & Lift",["Soins minceur et raffermissement","Programme adapté à vos objectifs","Réservation de votre créneau en ligne"]),
 ("resine-epoxy-netanya","Boutique Epoxy – créations en résine à Netanya","Créations en résine époxy faites main à Netanya : décoration, cadeaux personnalisés et commandes sur mesure.","Boutique Epoxy",["Créations en résine faites main","Cadeaux personnalisés","Commandes sur mesure"]),
 ("creation-sites-applications","Digital & Applications – création de sites et d'applications","Création de sites internet et d'applications pour les indépendants et commerces en Israël, par Rebecca Services.","Digital & Applications",["Sites internet et applications sur mesure","Réservation en ligne pour votre activité","Accompagnement simple, en français"]),
]
ORG = {"@context":"https://schema.org","@type":"LocalBusiness","name":"Rebecca Services","url":BASE+"/","telephone":"+972547380193","image":BASE+"/icon-512.png","slogan":"Votre temps est précieux, je vous aide à en profiter.","address":{"@type":"PostalAddress","addressLocality":"Netanya","addressCountry":"IL"},"areaServed":{"@type":"Country","name":"Israël"},"sameAs":["https://www.instagram.com/rebecca_services/","https://www.referenceisrael.com/prestataire/rebecca-services"]}
CSS = "body{margin:0;background:#0d0a0b;color:#fbf7f2;font-family:Inter,Arial,sans-serif;line-height:1.5}main{max-width:680px;margin:auto;padding:28px 20px 60px}a{color:#f1aeb7}h1{font-family:Georgia,serif;font-weight:normal;color:#f3d3d8;font-size:30px}.m{color:#d9a48f;letter-spacing:3px;text-transform:uppercase;font-size:13px}li{margin:6px 0}.b{display:inline-block;background:#f1aeb7;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin:6px 6px 0 0}.s{background:transparent;color:#f1aeb7;border:1px solid #c9907a}nav a{margin-right:12px;font-size:14px}footer{margin-top:40px;color:#bfb2ae;font-size:13px;font-style:italic}"
def page(slug,titre,desc,nom,points):
    u=f"{BASE}/services/{slug}/"; e=html.escape
    ld=dict(ORG); ld=json.dumps([ORG,{"@context":"https://schema.org","@type":"Service","name":nom,"description":desc,"provider":{"@type":"LocalBusiness","name":"Rebecca Services"},"areaServed":"Israël","url":u}],ensure_ascii=False)
    autres="".join(f'<a href="/services/{s}/">{e(n)}</a>' for s,_,_,n,_ in P if s!=slug)
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(titre)} | Rebecca Services</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{u}">
<meta property="og:type" content="website"><meta property="og:title" content="{e(titre)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{u}"><meta property="og:image" content="{BASE}/icon-512.png"><meta property="og:locale" content="fr_FR">
<link rel="icon" href="/icon-512.png"><style>{CSS}</style><script type="application/ld+json">{ld}</script></head>
<body><main><p class="m">Rebecca Services · Netanya</p><h1>{e(titre)}</h1><p>{e(desc)}</p><ul>{"".join(f"<li>{e(x)}</li>" for x in points)}</ul>
<p><a class="b" href="/">Voir et réserver sur rebeccaservices.com</a><a class="b s" href="{WA}">WhatsApp</a></p>
<p>Départ de Netanya, partout en Israël selon disponibilités. Pas de service pendant Chabbat et les fêtes.</p>
<nav><p class="m">Autres services</p>{autres}</nav><footer>Votre temps est précieux, je vous aide à en profiter.</footer></main></body></html>'''
for s,t,d,n,pts in P:
    os.makedirs(f"{pub}/services/{s}",exist_ok=True); open(f"{pub}/services/{s}/index.html","w").write(page(s,t,d,n,pts))
idx="".join(f'<li><a href="/services/{s}/">{html.escape(t)}</a></li>' for s,t,_,_,_ in P)
os.makedirs(f"{pub}/services",exist_ok=True)
open(f"{pub}/services/index.html","w").write(f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nos services à Netanya | Rebecca Services</title><meta name="description" content="Tous les services de Rebecca Services à Netanya : coursier, transport, beauté, résine, création de sites."><link rel="canonical" href="{BASE}/services/"><style>{CSS}</style><script type="application/ld+json">{json.dumps(ORG,ensure_ascii=False)}</script></head><body><main><p class="m">Rebecca Services · Netanya</p><h1>Nos services</h1><ul>{idx}</ul><p><a class="b" href="/">Aller sur le site</a></p></main></body></html>')
urls=[BASE+"/",BASE+"/services/"]+[f"{BASE}/services/{s}/" for s,*_ in P]
open(f"{pub}/sitemap.xml","w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+"".join(f"  <url><loc>{u}</loc><lastmod>2026-11-26</lastmod></url>\n" for u in urls)+"</urlset>\n")
open(f"{pub}/robots.txt","w").write("User-agent: *\nDisallow: /admin\nAllow: /\n\nSitemap: https://rebeccaservices.com/sitemap.xml\n")
print(json.dumps(ORG,ensure_ascii=False))

# ---- Version hébreu (26 nov. 2026) ----
HE = {
 "livraison-coursier-netanya":("שליחויות ומשלוחים בנתניה","משלוח חבילות, מפתחות, מסמכים וקניות, סידורים וקניות בשבילכם והובלות קטנות – מנתניה לכל הארץ.",["חבילות, מפתחות ומסמכים עד היד","איסוף הקניות שלכם או ביצוע הקניות בשבילכם","הובלות קטנות: מזוודות, קרטונים וחפצים קטנים","הצעת מחיר מיידית באתר, בלי הפתעות"]),
 "transport-prive-netanya":("הסעות פרטיות והסעות לנמל התעופה מנתניה","הסעות לנתב״ג, נסיעות פרטיות, הסעות חתן וכלה ורכב עם נהגת לאירועים – מנתניה.",["הסעה לנתב״ג ובחזרה, עם מעקב אחרי הטיסה","נסיעות פרטיות לכל הארץ","חתן וכלה: רכב מקושט ליום הגדול","רכב עם נהגת לאירועים"]),
 "onglerie-nails-prestige-netanya":("Nails Prestige – ציפורניים בנתניה","לק ג׳ל, בניית ג׳ל, Gel-X, אקריליק, עיצוב ציפורניים וטיפוח ידיים בנתניה. הזמנת תור אונליין.",["לק ג׳ל וטיפוח ידיים","בניית ג׳ל, Gel-X ואקריליק","עיצוב ציפורניים ותיקונים","הזמנת תור אונליין"]),
 "regenx-netanya":("RegenX – טיפול שיקום לשיער בנתניה","RegenX, טיפול עומק לשיקום השיער בנתניה. הזמנת תור אונליין.",["שיקום עמוק לשיער פגום","התאמה לסוג השיער","הזמנת תור אונליין"]),
 "prestige-hair-netanya":("Prestige Hair – עיצוב שיער בנתניה","תספורת, צבע וטיפולי שיער בנתניה עם Prestige Hair. הזמנת תור אונליין.",["תספורת ועיצוב","צבע וטיפולים","הזמנת תור אונליין"]),
 "slim-lift-netanya":("Prestige Slim & Lift – טיפולי הרזיה בנתניה","טיפולי הרזיה ומיצוק בנתניה עם Prestige Slim & Lift. הזמנת תור אונליין.",["טיפולי הרזיה ומיצוק","תוכנית מותאמת אישית","הזמנת תור אונליין"]),
 "resine-epoxy-netanya":("Boutique Epoxy – יצירות אפוקסי בנתניה","יצירות אפוקסי בעבודת יד בנתניה: עיצוב לבית, מתנות אישיות והזמנות בהתאמה אישית.",["יצירות אפוקסי בעבודת יד","מתנות אישיות","הזמנות בהתאמה אישית"]),
 "creation-sites-applications":("Digital & Applications – בניית אתרים ואפליקציות","בניית אתרים ואפליקציות לעצמאים ולעסקים בישראל, על ידי Rebecca Services.",["אתרים ואפליקציות בהתאמה אישית","הזמנת תורים אונליין לעסק שלך","ליווי פשוט ואישי"]),
}
CSS_HE = CSS + "body{direction:rtl}"
def page_he(slug,titre,desc,points):
    u=f"{BASE}/he/services/{slug}/"; e=html.escape; fr=f"{BASE}/services/{slug}/"
    ld=json.dumps([ORG,{"@context":"https://schema.org","@type":"Service","name":titre,"description":desc,"provider":{"@type":"LocalBusiness","name":"Rebecca Services"},"areaServed":"ישראל","url":u,"inLanguage":"he"}],ensure_ascii=False)
    autres="".join(f'<a href="/he/services/{s}/">{e(HE[s][0])}</a> ' for s,*_ in P if s!=slug)
    return f'''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(titre)} | Rebecca Services</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{u}">
<link rel="alternate" hreflang="he" href="{u}"><link rel="alternate" hreflang="fr" href="{fr}">
<meta property="og:type" content="website"><meta property="og:title" content="{e(titre)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{u}"><meta property="og:image" content="{BASE}/icon-512.png"><meta property="og:locale" content="he_IL">
<link rel="icon" href="/icon-512.png"><style>{CSS_HE}</style><script type="application/ld+json">{ld}</script></head>
<body><main><p class="m">Rebecca Services · נתניה</p><h1>{e(titre)}</h1><p>{e(desc)}</p><ul>{"".join(f"<li>{e(x)}</li>" for x in points)}</ul>
<p><a class="b" href="/">לצפייה ולהזמנה באתר rebeccaservices.com</a><a class="b s" href="{WA}">וואטסאפ</a></p>
<p>יציאה מנתניה, לכל הארץ בהתאם לזמינות. אין שירות בשבת ובחגים.</p>
<p><a href="{fr}">Version française</a></p>
<nav><p class="m">שירותים נוספים</p>{autres}</nav><footer>הזמן שלכם יקר, אני עוזרת לכם ליהנות ממנו.</footer></main></body></html>'''
for s,*_ in P:
    t,d,pts=HE[s]; os.makedirs(f"{pub}/he/services/{s}",exist_ok=True); open(f"{pub}/he/services/{s}/index.html","w").write(page_he(s,t,d,pts))
    # lien vers l'hébreu sur la page française
    fp=f"{pub}/services/{s}/index.html"; c=open(fp).read()
    if 'hreflang' not in c:
        c=c.replace('<link rel="canonical"',f'<link rel="alternate" hreflang="fr" href="{BASE}/services/{s}/"><link rel="alternate" hreflang="he" href="{BASE}/he/services/{s}/"><link rel="canonical"',1)
        c=c.replace('<nav>',f'<p><a href="/he/services/{s}/">בעברית</a></p><nav>',1)
        open(fp,"w").write(c)
idx="".join(f'<li><a href="/he/services/{s}/">{html.escape(HE[s][0])}</a></li>' for s,*_ in P)
os.makedirs(f"{pub}/he/services",exist_ok=True)
open(f"{pub}/he/services/index.html","w").write(f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>השירותים שלנו בנתניה | Rebecca Services</title><meta name="description" content="כל השירותים של Rebecca Services בנתניה: שליחויות, הסעות, יופי, אפוקסי ובניית אתרים."><link rel="canonical" href="{BASE}/he/services/"><link rel="alternate" hreflang="fr" href="{BASE}/services/"><style>{CSS_HE}</style><script type="application/ld+json">{json.dumps(ORG,ensure_ascii=False)}</script></head><body><main><p class="m">Rebecca Services · נתניה</p><h1>השירותים שלנו</h1><ul>{idx}</ul><p><a class="b" href="/">לאתר</a></p></main></body></html>')
urls += [BASE+"/he/services/"]+[f"{BASE}/he/services/{s}/" for s,*_ in P]
open(f"{pub}/sitemap.xml","w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+"".join(f"  <url><loc>{u}</loc><lastmod>2026-11-26</lastmod></url>\n" for u in urls)+"</urlset>\n")
