/**
 * Decorative TWR artwork: mountain imagery (from the TWR design, in /public/brand) and abstract market charts.
 * Everything is aria-hidden and never intercepts pointer input.
 */

/* eslint-disable @next/next/no-img-element -- small decorative images; plain <img> avoids layout wrappers. */

const FADE_LEFT_BOTTOM = "[mask-image:linear-gradient(to_right,transparent,black_42%),linear-gradient(to_bottom,black_70%,transparent)] [mask-composite:intersect]";

/** Page backdrop: the TWR mountain range with light beams across the top-right, plus a soft blue glow. */
export function Backdrop({ className = "h-[150px] sm:h-[132px]" }: { className?: string }) {
  return (
    <div className="twr-art absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_60%_80%_at_80%_-10%,rgb(0_110_255/0.14),transparent_70%)]" />
      <img src="/brand/art-header.webp" alt="" width={1396} height={158} decoding="async"
        className={`absolute top-0 right-0 w-auto max-w-none object-cover object-right max-sm:opacity-50 ${FADE_LEFT_BOTTOM} ${className}`} />
    </div>
  );
}

/** The lit mountain peak at the foot of the sidebar. */
export function SidebarPeak({ className = "" }: { className?: string }) {
  return (
    <img src="/brand/art-sidebar.webp" alt="" width={384} height={410} decoding="async" aria-hidden
      className={`twr-art w-full [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_85%,transparent)] ${className}`} />
  );
}

/** Diagonal light beam in the bottom-right corner of the viewport. */
export function CornerBeam() {
  return (
    <div className="twr-art fixed right-0 bottom-0 -z-10 h-72 w-72 overflow-hidden max-md:hidden" aria-hidden>
      <div className="absolute right-[-30%] bottom-[18%] h-[3px] w-[150%] -rotate-45 bg-linear-to-r from-transparent via-[#1e8fff] to-[#7cc8ff] shadow-[0_0_18px_4px_rgb(0_130_255/0.6)]" />
      <div className="absolute right-[-30%] bottom-[26%] h-10 w-[150%] -rotate-45 bg-linear-to-r from-transparent via-[#0a5cd6]/30 to-[#1e8fff]/40 blur-xl" />
    </div>
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

/** A rising run of candlesticks climbing out of the top-right corner. */
function Candles({ seed }: { seed: number }) {
  const r = rng(seed);
  const n = 16;
  let price = 92;
  const candles = Array.from({ length: n }, (_, i) => {
    const open = price;
    const drift = 5.5 + r() * 2;
    price = Math.max(4, price - drift + (r() < 0.3 ? drift * 1.4 : 0) * r());
    const close = price;
    const hi = Math.min(open, close) - 2 - r() * 5;
    const lo = Math.max(open, close) + 2 + r() * 5;
    return { x: 6 + i * 11.5, open, close, hi, lo, up: close < open };
  });
  return (
    <svg viewBox="0 0 190 100" className="h-full w-full drop-shadow-[0_0_5px_rgb(0_150_255/0.8)]" preserveAspectRatio="xMaxYMin meet">
      {candles.map((c, i) => {
        const fade = 0.45 + (0.55 * i) / n;
        const color = c.up ? "#4fb6ff" : "#1a74e8";
        return (
          <g key={c.x} stroke={color} fill={color} opacity={fade}>
            <line x1={c.x} x2={c.x} y1={c.hi} y2={c.lo} strokeWidth="1.1" />
            <rect x={c.x - 3} y={Math.min(c.open, c.close)} width="6" height={Math.max(2.5, Math.abs(c.open - c.close))} rx="0.8" />
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal volume-at-price bars hanging off the right edge of the card. */
function VolumeProfile({ seed }: { seed: number }) {
  const r = rng(seed);
  const rows = 22;
  const poc = 5 + Math.floor(r() * 4);
  return (
    <svg viewBox="0 0 120 132" className="h-full w-full drop-shadow-[0_0_6px_rgb(0_150_255/0.7)]" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id={`vp-${seed}`} x1="0" x2="1">
          <stop offset="0" stopColor="#0a5cd6" stopOpacity="0.1" />
          <stop offset="1" stopColor="#3aa8ff" stopOpacity="1" />
        </linearGradient>
      </defs>
      {Array.from({ length: rows }, (_, i) => {
        const w = Math.max(8, 112 * Math.exp(-((i - poc) ** 2) / 26) * (0.7 + r() * 0.4));
        return <rect key={i} x={120 - w} y={2 + i * 6} width={w} height="4.4" fill={i === poc ? "#8fd3ff" : `url(#vp-${seed})`} opacity={i === poc ? 1 : 0.9} />;
      })}
    </svg>
  );
}

/** A glowing code tile, for web and programming courses. */
function CodeTile() {
  return (
    <div className="absolute top-3 right-4 grid h-14 w-[4.5rem] place-items-center rounded-lg border border-[#2f86ea]/80 bg-linear-to-b from-[#0d2a52]/80 to-[#071a36]/80 shadow-[0_0_18px_-2px_rgb(0_130_255/0.65),inset_0_0_14px_rgb(0_120_255/0.25)]">
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#3aa2ff] drop-shadow-[0_0_6px_rgb(0_150_255/0.9)]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
      </svg>
    </div>
  );
}

const VARIANTS = ["candles", "peak", "candles", "volume"] as const;
type Variant = (typeof VARIANTS)[number] | "code";

function variantFor(id: string, title: string): Variant {
  const t = title.toLowerCase();
  if (/volume|profile|auction/.test(t)) return "volume";
  if (/\bweb\b|html|css|javascript|coding|programming|develop/.test(t)) return "code";
  if (/candle|price action|chart|trend|pattern/.test(t)) return "candles";
  return VARIANTS[hash(id) % VARIANTS.length];
}

/**
 * Artwork for the top-right corner of a course card. The variant follows the course title where it is
 * obviously about one topic (volume profiles, web/code), otherwise a stable pick from the course id.
 */
export function CourseArt({ id, title }: { id: string; title: string }) {
  const seed = hash(id);
  const variant = variantFor(id, title);
  if (variant === "code") return <div className="twr-art" aria-hidden><CodeTile /></div>;
  if (variant === "peak") {
    return (
      <img src="/brand/art-peak.webp" alt="" width={284} height={132} decoding="async" aria-hidden
        className="twr-art absolute top-0 right-0 h-[5.5rem] w-auto [mask-image:linear-gradient(to_right,transparent,black_35%),linear-gradient(to_bottom,black_60%,transparent)] [mask-composite:intersect]" />
    );
  }
  return (
    <div className={`twr-art absolute top-0 right-0 ${variant === "volume" ? "h-32 w-36" : "h-28 w-52"} [mask-image:linear-gradient(to_left,black_40%,transparent),linear-gradient(to_bottom,black_65%,transparent)] [mask-composite:intersect]`} aria-hidden>
      {variant === "candles" ? <Candles seed={seed} /> : <VolumeProfile seed={seed} />}
    </div>
  );
}
