/**
 * Decorative TWR artwork: mountain silhouettes and abstract market charts.
 * Pure SVG (no network requests), aria-hidden, low contrast, and never intercepts pointer input.
 */

/** Layered mountain ridges with a faint blue rim light. Fills its positioned parent. */
export function Mountains({ className = "" }: { className?: string }) {
  return (
    <svg className={`twr-art ${className}`} viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="twr-m-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123b63" stopOpacity="0.55" />
          <stop offset="1" stopColor="#061526" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="twr-m-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2a49" stopOpacity="0.9" />
          <stop offset="1" stopColor="#020813" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 230 L90 170 L160 200 L260 110 L330 160 L420 80 L520 170 L600 120 L690 190 L780 95 L860 150 L950 70 L1040 160 L1120 120 L1200 160 V320 H0Z" fill="url(#twr-m-far)" />
      <path d="M0 230 L90 170 L160 200 L260 110 L330 160 L420 80 L520 170 L600 120 L690 190 L780 95 L860 150 L950 70 L1040 160 L1120 120 L1200 160" fill="none" stroke="#2f8fff" strokeOpacity="0.28" strokeWidth="1.2" />
      <path d="M0 280 L120 220 L210 250 L330 180 L430 240 L540 200 L640 260 L760 190 L880 250 L990 200 L1100 240 L1200 210 V320 H0Z" fill="url(#twr-m-near)" />
      <path d="M0 280 L120 220 L210 250 L330 180 L430 240 L540 200 L640 260 L760 190 L880 250 L990 200 L1100 240 L1200 210" fill="none" stroke="#00cfff" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic PRNG so each course gets stable, distinct artwork across renders. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Candles({ seed }: { seed: number }) {
  const r = rng(seed);
  let price = 70;
  const candles = Array.from({ length: 14 }, (_, i) => {
    const open = price;
    price = Math.max(12, Math.min(88, price - 1.5 - r() * 6 + r() * 3.2));
    const close = price;
    const hi = Math.min(open, close) - r() * 6;
    const lo = Math.max(open, close) + r() * 6;
    return { x: 8 + i * 13, open, close, hi, lo, up: close < open };
  });
  return (
    <svg viewBox="0 0 190 100" className="h-full w-full" preserveAspectRatio="xMaxYMin meet">
      {candles.map((c) => (
        <g key={c.x} stroke={c.up ? "#00cfff" : "#2f6fb0"} fill={c.up ? "#00cfff" : "#2f6fb0"}>
          <line x1={c.x} x2={c.x} y1={c.hi} y2={c.lo} strokeWidth="1" />
          <rect x={c.x - 3.5} y={Math.min(c.open, c.close)} width="7" height={Math.max(2, Math.abs(c.open - c.close))} rx="1" />
        </g>
      ))}
    </svg>
  );
}

function VolumeProfile({ seed }: { seed: number }) {
  const r = rng(seed);
  const rows = 18;
  const poc = 6 + Math.floor(r() * 6);
  return (
    <svg viewBox="0 0 120 108" className="h-full w-full" preserveAspectRatio="xMaxYMid meet">
      {Array.from({ length: rows }, (_, i) => {
        const w = Math.max(10, 110 * Math.exp(-((i - poc) ** 2) / 22) * (0.75 + r() * 0.35));
        return <rect key={i} x={120 - w} y={i * 6} width={w} height="4.2" rx="1" fill={i === poc ? "#00cfff" : "#1a7fe0"} opacity={i === poc ? 0.95 : 0.65} />;
      })}
    </svg>
  );
}

function MarketStructure({ seed }: { seed: number }) {
  const r = rng(seed);
  const pts = [[6, 82], [30, 58], [46, 70], [74, 40], [92, 54], [124, 22], [140, 34], [178, 8]].map(([x, y]) => [x, y + (r() - 0.5) * 8]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <svg viewBox="0 0 190 100" className="h-full w-full" preserveAspectRatio="xMaxYMin meet">
      {[20, 45, 70].map((y) => <line key={y} x1="0" x2="190" y1={y} y2={y} stroke="#183b59" strokeDasharray="3 4" />)}
      <path d={`${d} L178 100 L6 100Z`} fill="#008cff" opacity="0.12" />
      <path d={d} fill="none" stroke="#00cfff" strokeWidth="1.8" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill={i % 2 ? "#00cfff" : "#008cff"} />)}
    </svg>
  );
}

function Peaks() {
  return (
    <svg viewBox="0 0 190 100" className="h-full w-full" preserveAspectRatio="xMaxYMin meet">
      <path d="M0 100 L40 60 L62 74 L104 22 L132 52 L150 40 L190 72 V100Z" fill="#0f3e6e" opacity="0.8" />
      <path d="M0 100 L40 60 L62 74 L104 22 L132 52 L150 40 L190 72" fill="none" stroke="#00cfff" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M60 100 L104 60 L128 78 L160 56 L190 84 V100Z" fill="#082642" />
    </svg>
  );
}

const VARIANTS = ["candles", "structure", "volume", "peaks"] as const;

/**
 * Low-opacity chart art for the top-right corner of a course card. The variant follows the course
 * title where it is obviously about one topic (e.g. volume profiles), otherwise the course id.
 */
export function CourseArt({ id, title }: { id: string; title: string }) {
  const seed = hash(id);
  const t = title.toLowerCase();
  const variant = /volume|profile|auction/.test(t) ? "volume"
    : /structure|trend|swing/.test(t) ? "structure"
    : /candle|price action|chart/.test(t) ? "candles"
    : VARIANTS[seed % VARIANTS.length];
  return (
    <div className="twr-art absolute top-0 right-0 h-24 w-44 opacity-55 [mask-image:linear-gradient(to_left,black_35%,transparent),linear-gradient(to_bottom,black_55%,transparent)] [mask-composite:intersect] sm:w-48" aria-hidden>
      {variant === "candles" && <Candles seed={seed} />}
      {variant === "volume" && <VolumeProfile seed={seed} />}
      {variant === "structure" && <MarketStructure seed={seed} />}
      {variant === "peaks" && <Peaks />}
    </div>
  );
}

/** Page backdrop: soft blue glow, a faint light streak and low-contrast mountains behind the page header. */
export function Backdrop({ className = "h-80" }: { className?: string }) {
  return (
    <div className={`twr-art absolute inset-x-0 top-0 -z-10 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_85%_-10%,rgb(0_140_255/0.16),transparent_70%)]" />
      <div className="absolute -top-10 right-[8%] h-[140%] w-px rotate-[35deg] bg-linear-to-b from-transparent via-cyan/40 to-transparent shadow-[0_0_12px_rgb(0_207_255/0.6)] max-sm:hidden" />
      <Mountains className="absolute inset-0 h-full w-full opacity-60" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-canvas" />
    </div>
  );
}
