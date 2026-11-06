/** The moonlit Gargoyle House: SVG art drawn for this page (no photos). Four gargoyles on the parapet with glowing green eyes. */

// One crouching gargoyle facing right, drawn in a 100 × 120 box with its plinth at the bottom.
const GARGOYLE = [
  "M36 70 C 22 56 14 34 12 4 C 26 14 40 18 56 22 L 47 28 L 53 34 L 44 38 L 49 46 L 41 50 L 44 58 Z",
  "M18 104 C 16 86 22 66 36 58 C 46 52 58 54 66 60 C 70 54 74 50 78 50 L 70 36 L 82 47 C 86 46 89 46 91 48 L 94 37 L 95 50 C 98 54 100 58 99 62 L 92 63 L 97 66 L 90 68 C 86 70 82 70 78 70 C 72 74 66 80 60 84 C 50 88 40 96 38 104 Z",
  "M30 104 C 32 90 42 82 54 84 C 64 86 68 96 66 104 Z",
  "M74 66 C 82 70 86 76 86 84 C 86 92 88 98 92 104 L 95 109 L 91 107 L 90 110 L 87 106 L 84 104 C 82 96 78 88 68 80 Z",
  "M19 100 C 8 99 3 90 7 82 C 9 89 14 93 21 93 Z",
  "M4 104 H96 V120 H4 Z"
];

function Gargoyle({ x, flip, delay }: { x: number; flip?: boolean; delay: number }) {
  // Placed so the plinth sits on the parapet (y 352); 0.62 scale → about 62 × 74 units.
  const t = flip ? `translate(${x + 62} 278) scale(-0.62 0.62)` : `translate(${x} 278) scale(0.62)`;
  return <g transform={t}>
    {GARGOYLE.map((d) => <path key={d.slice(0, 12)} d={d} />)}
    <g className="gg-eye" style={{ animationDelay: `${delay}s` }}>
      <circle cx="88" cy="53" r="5" fill="url(#gg-eyeglow)" />
      <circle cx="88" cy="53" r="1.6" fill="#b9ffdc" />
    </g>
  </g>;
}

const WINDOWS_UP = [360, 410, 460, 740, 790, 840];
const WINDOWS_DOWN = [360, 410, 460, 740, 790, 840];
const COLUMNS = [532, 566, 622, 656];

export default function Scene() {
  return <svg className="gg-house" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="gg-eyeglow"><stop offset="0" stopColor="#7dffc4" stopOpacity="1" /><stop offset=".45" stopColor="#2bf09a" stopOpacity=".55" /><stop offset="1" stopColor="#2bf09a" stopOpacity="0" /></radialGradient>
      <linearGradient id="gg-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d211a" /><stop offset="1" stopColor="#030a07" /></linearGradient>
      <linearGradient id="gg-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0a1a13" /><stop offset=".7" stopColor="#12352a" /><stop offset="1" stopColor="#1b4a39" /></linearGradient>
      <linearGradient id="gg-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ef0ab" stopOpacity=".55" /><stop offset="1" stopColor="#0f5a3a" stopOpacity=".35" /></linearGradient>
      <radialGradient id="gg-door" cx=".5" cy=".7" r=".7"><stop offset="0" stopColor="#7dffc4" stopOpacity=".75" /><stop offset="1" stopColor="#0b4a30" stopOpacity=".2" /></radialGradient>
      <linearGradient id="gg-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#04110b" /><stop offset="1" stopColor="#010604" /></linearGradient>
    </defs>

    {/* Distant hills and spruce */}
    <path d="M0 560 C 160 520 300 540 420 530 C 560 518 700 540 820 528 C 960 516 1080 530 1200 520 V700 H0 Z" fill="#03100b" />
    <g fill="#020b07">
      {[60, 120, 175, 1010, 1070, 1130, 1180].map((x, i) => <path key={x} d={`M${x} ${640 - (i % 2 ? 150 : 190)} L${x + 34} 640 H${x - 34} Z`} />)}
    </g>

    {/* Side wings */}
    <rect x="200" y="470" width="130" height="170" fill="url(#gg-stone)" />
    <rect x="870" y="470" width="130" height="170" fill="url(#gg-stone)" />
    <rect x="194" y="462" width="142" height="10" fill="#0f2a20" />
    <rect x="864" y="462" width="142" height="10" fill="#0f2a20" />
    {[225, 275, 905, 955].map((x) => <rect key={x} className="gg-win" x={x} y="510" width="24" height="56" rx="12" fill="url(#gg-win)" />)}

    {/* Main block, flat roof and parapet (the gargoyles' ledge) */}
    <rect x="330" y="360" width="540" height="280" fill="url(#gg-stone)" />
    <rect x="330" y="360" width="540" height="280" fill="url(#gg-rim)" opacity=".35" />
    <rect x="318" y="352" width="564" height="12" fill="#143628" />
    <rect x="322" y="364" width="556" height="5" fill="#081a12" />
    <rect x="330" y="496" width="540" height="6" fill="#0c241a" />

    {WINDOWS_UP.map((x, i) => <rect key={`u${x}`} className="gg-win" style={{ animationDelay: `${i * 1.7}s` }} x={x} y="398" width="28" height="66" fill="url(#gg-win)" />)}
    {WINDOWS_DOWN.map((x, i) => <path key={`d${x}`} className="gg-win" style={{ animationDelay: `${i * 1.3 + 0.8}s` }} d={`M${x} 600 V548 A14 14 0 0 1 ${x + 28} 548 V600 Z`} fill="url(#gg-win)" />)}

    {/* Neoclassical portico */}
    <path d="M500 392 L600 330 L700 392 Z" fill="#0f2a20" />
    <path d="M520 386 L600 340 L680 386 Z" fill="#06140e" />
    <rect x="496" y="392" width="208" height="16" fill="#143628" />
    {COLUMNS.map((x) => <g key={x}>
      <rect x={x} y="408" width="14" height="222" fill="#123226" />
      <rect x={x + 9} y="408" width="5" height="222" fill="#1d4d3b" opacity=".6" />
      <rect x={x - 3} y="408" width="20" height="6" fill="#174033" />
      <rect x={x - 3} y="624" width="20" height="8" fill="#174033" />
    </g>)}
    <path className="gg-door" d="M582 632 V560 A18 18 0 0 1 618 560 V632 Z" fill="url(#gg-door)" />
    <rect x="480" y="632" width="240" height="8" fill="#0f2a20" />

    {/* The four rooftop gargoyles */}
    <g fill="#010805">
      <Gargoyle x={326} flip delay={0} />
      <Gargoyle x={432} flip delay={2.3} />
      <Gargoyle x={706} delay={1.1} />
      <Gargoyle x={812} delay={3.4} />
    </g>

    {/* Ground */}
    <path d="M0 640 H1200 V700 H0 Z" fill="url(#gg-ground)" />
  </svg>;
}

/** A small bat for the night sky. */
export function Bat() {
  return <svg viewBox="0 0 40 16" aria-hidden="true" focusable="false"><path d="M20 6 C 18 3 16 3 15 5 C 12 2 6 1 0 4 C 4 5 6 8 7 11 C 9 9 12 9 14 11 C 16 9 18 10 20 13 C 22 10 24 9 26 11 C 28 9 31 9 33 11 C 34 8 36 5 40 4 C 34 1 28 2 25 5 C 24 3 22 3 20 6 Z" fill="#010604" /></svg>;
}
