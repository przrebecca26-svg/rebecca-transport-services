// Icones des services : rond noir, pictogramme fin or rose (validees par Rebecca le 5 novembre 2026)
const NOIR = "#141214";
const OR = "#D9AE94";
const CERCLE = "#B98B73";

const DESSINS = {
  livraison: (
    <>
      <path d="M50 30 L70 40 L50 50 L30 40 Z" />
      <path d="M30 40 V60 L50 70 L70 60 V40" />
      <path d="M50 50 V70" />
      <path d="M40 35 L60 45" />
    </>
  ),
  courses: (
    <>
      <path d="M33 43 H67 L64 71 H36 Z" />
      <path d="M42 43 V38 A8 8 0 0 1 58 38 V43" />
    </>
  ),
  demenagement: (
    <>
      <rect x="28" y="52" width="22" height="18" rx="1.5" />
      <rect x="50" y="52" width="22" height="18" rx="1.5" />
      <rect x="39" y="34" width="22" height="18" rx="1.5" />
      <path d="M36 52 V57 M61 52 V57 M47 34 V39" />
    </>
  ),
  transport: (
    <>
      <path d="M26 60 V53 Q26 48 32 47 L38 40 Q40 38 43 38 H57 Q60 38 62 40 L68 47 Q74 48 74 53 V60 Z" />
      <path d="M42 47 L45 42 H55 L58 47 Z" />
      <circle cx="37" cy="61" r="5" fill={NOIR} />
      <circle cx="63" cy="61" r="5" fill={NOIR} />
    </>
  ),
  aeroport: (
    <g transform="rotate(45 50 50)">
      <path d="M50 26 C52 26 53 28 53 31 V44 L72 54 V58 L53 52 V64 L59 69 V72 L50 70 L41 72 V69 L47 64 V52 L28 58 V54 L47 44 V31 C47 28 48 26 50 26 Z" />
    </g>
  ),
  hatan_kala: (
    <>
      <circle cx="43" cy="55" r="11" />
      <circle cx="57" cy="55" r="11" />
      <path d="M53 39 L57 35 L61 39 L57 43.5 Z" />
    </>
  ),
  ramassage: (
    <>
      <path d="M35 42 Q35 31 50 31 Q65 31 65 42 V70 Q65 72 63 72 H37 Q35 72 35 70 Z" />
      <rect x="41" y="54" width="18" height="12" rx="3" />
      <path d="M41 59 H59" />
      <path d="M46 31 V28 Q46 26 48 26 H52 Q54 26 54 28 V31" />
    </>
  ),
  attente: (
    <>
      <circle cx="50" cy="50" r="20" />
      <path d="M50 50 V38 M50 50 L59 55" />
      <circle cx="50" cy="50" r="1.6" fill={OR} />
    </>
  ),
};

export default function IconeService({ id, taille = 44 }) {
  const dessin = DESSINS[id];
  return (
    <svg width={taille} height={taille} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <circle cx="50" cy="50" r="49" fill={NOIR} />
      <circle cx="50" cy="50" r="45" fill="none" stroke={CERCLE} strokeWidth="1.2" opacity="0.7" />
      {dessin && (
        <g fill="none" stroke={OR} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          {dessin}
        </g>
      )}
    </svg>
  );
}
