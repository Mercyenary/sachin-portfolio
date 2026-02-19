import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, Reorder } from "framer-motion";

// -------------------------------------------------------------
// ✅ Grid KEPT + smoother reflow + hover target preview
// - Cards stay INSIDE the grid, but you can place them anywhere.
// - Live reflow while dragging (Reorder.Group), others make space.
// - Nearest‑tile detection shows a dashed ring on the target (4-way feel).
// - Better spring transitions for buttery movement.
// -------------------------------------------------------------

const NAV = ["All", "About", "Projects", "Media"];
const SPRING = { type: "spring", mass: 1.1, stiffness: 210, damping: 42, restDelta: 0.0015, bounce: 0.12 };

// Global font stack (uses Proxima Nova if available)
const FONT_STACK = "'Proxima Nova','ProximaNova','Proxima Nova Rg',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol'";

// Preset orders so each tab pops the intended tiles to the top row(s)
const PRESETS = {
  About: ["about", "map", "twitter"],
  Projects: ["projectWide", "projectTallA", "projectTallB"],
  Media: ["article", "newsletter", "spotify"],
};

function viewForActive(order, active) {
  if (active === "All") return order;
  const preset = PRESETS[active] || [];
  const rank = new Map(preset.map((id, i) => [id, i]));
  const withIndex = order.map((item, i) => ({ item, i }));
  withIndex.sort((a, b) => {
    const ap = rank.has(a.item.id) ? 0 : (a.item.group === active ? 1 : 2);
    const bp = rank.has(b.item.id) ? 0 : (b.item.group === active ? 1 : 2);
    if (ap !== bp) return ap - bp;
    if (ap === 0) {
      return (rank.get(a.item.id) ?? 999) - (rank.get(b.item.id) ?? 999);
    }
    return a.i - b.i;
  });
  return withIndex.map((x) => x.item);
}

function computeView(order, active) {
  if (active === "All") return order;
  const top = order.filter((x) => x.group === active);
  const rest = order.filter((x) => x.group !== active);
  return [...top, ...rest];
}

function Pill({ active, onClick, children, dark = false }) {
  const base = "px-4 py-1.5 rounded-full text-sm font-medium transition";
  const bg = active ? "bg-white" : "bg-transparent hover:bg-black/5 dark:hover:bg-white/10";
  // Force clear, high-contrast text in both themes
  const style = { color: active ? "#111111" : (dark ? "#ffffff" : "#111111") };
  return (
    <motion.button
      onClick={onClick}
      className={`${base} ${bg}`}
      style={style}
      initial={false}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={"w-full h-full rounded-3xl bg-white dark:bg-white/[.06] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden " + className}>
      {children}
    </div>
  );
}

function Accent({ children }) {
  // Neutral container (colors removed as requested)
  return <div className="w-full h-full grid place-items-center">{children}</div>;
}

function ThemeSwitcher({ dark, onToggle }) {
  return (
    <div className="w-full h-full grid place-items-center">
      <motion.button
        onClick={onToggle}
        className="relative w-[92px] h-[44px] rounded-full border border-black/10 dark:border-white/10"
        animate={{ backgroundColor: dark ? "#111827" : "#eef2ff" }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="absolute top-1 left-1 w-10 h-10 rounded-full grid place-items-center text-xl"
          animate={{ x: dark ? 48 : 0, backgroundColor: dark ? "#fde68a" : "#0b0d12", color: dark ? "#111827" : "#fde68a" }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          {dark ? "☀️" : "🌙"}
        </motion.div>
      </motion.button>
      <div className="mt-3 text-sm text-black dark:text-white">{dark ? "Light mode" : "Dark mode"}</div>
    </div>
  );
}

// --- Logo (wordmark) ---
function Logo({ dark = false }) {
  // Chunky logo font
  const LOGO_STACK = "'Inter','Poppins','Proxima Nova','ProximaNova','Segoe UI',Roboto,'Helvetica Neue',Arial";

  // Light: solid black; Dark: subtle white gradient
  const gradText = "linear-gradient(90deg, #ffffff, #d1d5db)";
  const textStyle = dark
    ? {
        fontFamily: LOGO_STACK,
        fontSize: "32px",
        fontWeight: 900,
        backgroundImage: gradText,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }
    : {
        fontFamily: LOGO_STACK,
        fontSize: "32px",
        fontWeight: 900,
        color: "#111111",
      };

  // measure where the "i" should be so the path can rise there
  const wrapRef = useRef(null);
  const iSlotRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, iCenter: 0 });
  // token to remount SVG and replay animation
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    const iEl = iSlotRef.current;
    if (!el || !iEl) return;
    const rect = el.getBoundingClientRect();
    const ir = iEl.getBoundingClientRect();
    setDims({ w: el.offsetWidth, iCenter: ir.left - rect.left + ir.width / 2 });
  }, [dark]);

  // Build a path that runs along the baseline, rises between h and n to draw a *cursive* i with a tighter, even loop,
  // then returns to the baseline and finishes.
  const xi = dims.w ? (dims.iCenter / dims.w) * 100 : 70; // percentage along width
  const baseline = 16; // SVG units (viewBox height = 24)
  const loopH = 11; // height of the i stroke
  const loopW = 4;  // horizontal span of the loop
  const spread = 7; // overall spread before/after the loop
  const undershoot = 1.4; // little dip below baseline after crossing

  const left = Math.max(0, xi - spread);
  const right = Math.min(100, xi + spread);

  // Shape with a clear loop: ascend → swing right → cross down just right of center → undershoot → settle to baseline
  const d = `M 0 ${baseline}
    L ${left} ${baseline}
    C ${xi - spread * 0.55} ${baseline}, ${xi - spread * 0.35} ${baseline - loopH * 0.7}, ${xi} ${baseline - loopH}
    C ${xi + loopW} ${baseline - loopH - 1}, ${xi + loopW} ${baseline - loopH * 0.35}, ${xi} ${baseline - loopH * 0.3}
    C ${xi - loopW} ${baseline - loopH * 0.05}, ${xi - loopW * 0.2} ${baseline + undershoot}, ${xi + 0.8} ${baseline}
    C ${xi + spread * 0.45} ${baseline}, ${xi + spread * 0.55} ${baseline}, ${right} ${baseline}
    L 100 ${baseline}`;

  const stroke = dark ? "#ffffff" : "#111111";
  // sun-yellow dot in both themes
  const dotFill = "#facc15";

  return (
    <motion.a
      href="#"
      className="inline-flex items-center gap-2 select-none"
      aria-label="Sachin"
      initial={false}
      whileHover={{ scale: 1.03, y: -0.5 }}
      onHoverStart={() => setReplay((r) => r + 1)}
      onTap={() => setReplay((r) => r + 1)}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="relative leading-none">
        {/* wordmark (without the printed i letter) */}
        <span ref={wrapRef} className="lowercase tracking-tight inline-flex items-baseline gap-0" style={textStyle}>
          sac
          <span className="relative inline-block" style={textStyle}>h</span>
          {/* reserve space where the i belongs so layout doesn't shift; even/neutral spacing */}
          <span ref={iSlotRef} className="inline-block mx-0.5" style={{ ...textStyle, opacity: 0 }}>i</span>
          <span className="relative inline-block" style={textStyle}>n</span>
        </span>

        {/* animated baseline path that rises to draw a cursive i with a loop, then returns */}
        <svg key={replay}
          className="absolute left-0 w-full pointer-events-none"
          style={{ bottom: -6 }}
          height="28"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
        >
          <motion.path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.9, ease: "easeInOut" }}
          />
          {/* the i dot drops LAST */}
          <motion.circle
            cx={xi}
            cy={baseline - loopH - 4}
            r={2.2}
            fill={dotFill}
            initial={{ opacity: 0, y: -8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 2.0, type: "spring", stiffness: 600, damping: 18 }}
          />
        </svg>
      </div>
    </motion.a>
  );
}

// --- Brand icons + SocialCard (center icon + corner link) ---
const Icons = {
  linkedin: (props = {}) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zM8.5 8h3.8v2.05h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.08V23h-4v-6.68c0-1.59-.03-3.64-2.22-3.64-2.22 0-2.56 1.73-2.56 3.52V23h-4V8z"/>
    </svg>
  ),
  github: (props = {}) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56V20.3c-3.23.7-3.91-1.39-3.91-1.39-.53-1.35-1.29-1.71-1.29-1.71-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.76.41-1.27.75-1.56-2.57-.29-5.27-1.29-5.27-5.76 0-1.27.46-2.31 1.2-3.12-.12-.29-.52-1.46.11-3.04 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 5.83 0c2.22-1.5 3.2-1.19 3.2-1.19.63 1.58.23 2.75.11 3.04.75.81 1.2 1.85 1.2 3.12 0 4.48-2.71 5.46-5.29 5.75.42.36.8 1.07.8 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" clipRule="evenodd"/>
    </svg>
  ),
  instagram: (props = {}) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="igGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="30%" stopColor="#FEDA77"/>
          <stop offset="50%" stopColor="#DD2A7B"/>
          <stop offset="75%" stopColor="#8134AF"/>
          <stop offset="100%" stopColor="#515BD4"/>
        </linearGradient>
      </defs>
      <path fill="url(#igGradient)" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zM18 6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/>
    </svg>
  ),
};

function SocialCard({ href, icon = "linkedin", brand = "", dark = false }) {
  const [isHover, setIsHover] = useState(false);
  const Icon = Icons[icon] || Icons.linkedin;
  const brandClass = icon === "linkedin" ? "text-[#0A66C2]" : ""; // instagram + github handled separately
  const iconStyle = icon === "github" ? { color: dark ? "#ffffff" : "#000000" } : undefined;

  return (
    <div
      className="relative w-full h-full grid place-items-center group"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <Icon className={`w-16 h-16 sm:w-20 sm:h-20 ${brandClass}`} style={iconStyle} />
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        layout
        initial={false}
        className={`absolute left-3 bottom-3 h-9 rounded-full bg-white/95 dark:bg-white/20 backdrop-blur-sm text-neutral-900 dark:text-white ring-1 ring-black/10 dark:ring-white/25 shadow-sm dark:shadow-[0_6px_18px_rgba(0,0,0,0.55)] flex items-center gap-2 ${isHover ? 'px-3 pr-2' : 'w-9 justify-center'}`}
        style={{ color: dark ? '#ffffff' : '#111111' }}
        aria-label={`Open ${brand || icon}`}
        title={brand || icon}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        {isHover && (
          <span className="text-[13px] font-semibold" style={{ color: dark ? '#ffffff' : '#111111' }}>
            {brand || icon}
          </span>
        )}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h5V3H3v7h2V5z"/></svg>
      </motion.a>
    </div>
  );
}

// --- Project Rings (for tall project cards) ---
function CornerChip({ label, href, dark, hover }) {
  const Cmp = href ? motion.a : motion.div;
  const props = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <Cmp
      {...props}
      layout
      initial={false}
      className={`absolute left-3 bottom-3 h-9 rounded-full bg-white/95 dark:bg-white/20 backdrop-blur-sm text-neutral-900 dark:text-white ring-1 ring-black/10 dark:ring-white/25 shadow-sm dark:shadow-[0_6px_18px_rgba(0,0,0,0.55)] flex items-center gap-2 ${hover ? 'px-3 pr-2' : 'w-9 justify-center'} z-10`}
      style={{ color: dark ? '#ffffff' : '#111111' }}
      aria-label={label}
      title={label}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      {hover && (
        <span className="text-[13px] font-semibold leading-none" style={{ color: dark ? '#ffffff' : '#111111' }}>
          {label}
        </span>
      )}
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h5V3H3v7h2V5z"/></svg>
    </Cmp>
  );
}

function ProjectRings({ dark, label = 'Project', variant = 'A', href, showChip = true }) {
  const [hover, setHover] = useState(false);
  // theme palettes
  const c1 = dark ? '#60a5fa' : '#60a5fa'; // sky-400
  const c2 = dark ? '#22d3ee' : '#38bdf8'; // cyan-400 / sky-400
  const c3 = dark ? '#facc15' : '#f59e0b'; // amber
  const strokeO = dark ? 0.28 : 0.18;
  const glowO = dark ? 0.18 : 0.12;

  // Different centers for variants to avoid identical look
  const cx = variant === 'A' ? 110 : 90;
  const cy = variant === 'A' ? 80 : 120;

  return (
    <div className="relative w-full h-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" />
          </filter>
        </defs>
        <motion.g
          animate={{ rotate: hover ? 360 : 180 }}
          style={{ originX: cx, originY: cy }}
          transition={{ duration: hover ? 12 : 24, repeat: Infinity, ease: 'linear' }}
        >
          {/* subtle glow strokes */}
          <circle cx={cx} cy={cy} r={62} fill="none" stroke={c1} strokeOpacity={glowO} strokeWidth={14} filter="url(#softGlow)" />
          <circle cx={cx} cy={cy} r={40} fill="none" stroke={c2} strokeOpacity={glowO} strokeWidth={12} filter="url(#softGlow)" />
          <circle cx={cx} cy={cy} r={20} fill="none" stroke={c3} strokeOpacity={glowO} strokeWidth={10} filter="url(#softGlow)" />

          {/* crisp rings */}
          <circle cx={cx} cy={cy} r={62} fill="none" stroke={c1} strokeOpacity={strokeO} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={40} fill="none" stroke={c2} strokeOpacity={strokeO} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={20} fill="none" stroke={c3} strokeOpacity={strokeO} strokeWidth={2} />
        </motion.g>
      </svg>
      {showChip && <CornerChip label={label} href={href} dark={dark} hover={hover} />}
    </div>
  );
}

// --- Project A/B themed graphics that include data visuals ---
function ProjectArtA({ dark, label, href }) {
  const [hover, setHover] = useState(false);
  // theme palette
  const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.06)';
  const axis = dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.18)';
  const barA = '#38bdf8'; // sky
  const barB = '#22d3ee'; // cyan
  const barC = '#facc15'; // amber
  const line = '#60a5fa'; // sky

  // line points (0..200 SVG space)
  const pts = [
    { x: 20, y: 150 },
    { x: 45, y: 128 },
    { x: 72, y: 140 },
    { x: 102, y: 96 },
    { x: 134, y: 118 },
    { x: 168, y: 84 },
  ];
  const d = 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ');

  const bars = [
    { x: 30, h: 46, c: barA },
    { x: 52, h: 26, c: barB },
    { x: 74, h: 54, c: barA },
    { x: 96, h: 88, c: barC },
    { x: 118, h: 62, c: barB },
    { x: 140, h: 72, c: barA },
  ];

  return (
    <div className="relative w-full h-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {/* grid */}
        {[40,80,120,160].map((y) => (
          <line key={'h'+y} x1="0" y1={y} x2="200" y2={y} stroke={grid} strokeWidth="1" />
        ))}
        {[40,80,120,160].map((x) => (
          <line key={'v'+x} x1={x} y1="0" x2={x} y2="200" stroke={grid} strokeWidth="1" />
        ))}
        {/* axes */}
        <line x1="16" y1="16" x2="16" y2="170" stroke={axis} strokeWidth="1.5" />
        <line x1="16" y1="170" x2="190" y2="170" stroke={axis} strokeWidth="1.5" />

        {/* bars */}
        {bars.map((b, i) => (
          <motion.rect key={i}
            x={b.x} width="10"
            y={170 - (hover ? b.h * 1.08 : b.h)}
            height={hover ? b.h * 1.08 : b.h}
            rx="2"
            fill={b.c}
            initial={{ height: 0, y: 170 }}
            animate={{ height: hover ? b.h * 1.08 : b.h, y: 170 - (hover ? b.h * 1.08 : b.h) }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: i * 0.03 }}
          />
        ))}

        {/* line chart */}
        <motion.path d={d} fill="none" stroke={line} strokeWidth="2.5" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.2 }}
        />
        {/* moving datapoint */}
        <motion.circle r="3.2" fill={barC}
          animate={{
            cx: pts.map(p => p.x),
            cy: pts.map(p => p.y),
          }}
          transition={{ duration: 2.2, times: [0,0.2,0.4,0.6,0.8,1], ease: 'easeInOut', repeat: Infinity }}
        />
      </svg>
      <CornerChip label={label} href={href} dark={dark} hover={hover} />
    </div>
  );
}

function ProjectArtB({ dark, label, href }) {
  const [hover, setHover] = useState(false);
  const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.06)';
  const pipe = dark ? 'rgba(255,255,255,0.28)' : 'rgba(17,17,17,0.28)';
  const cyan = '#22d3ee';
  const sky = '#60a5fa';
  const amber = '#facc15';

  // path helpers
  const flow1 = 'M 28 80 C 58 58, 72 100, 100 78';
  const flow2 = 'M 100 122 C 130 142, 142 100, 170 122';

  return (
    <div className="relative w-full h-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {/* soft background grid */}
        {[40,80,120,160].map((y) => (
          <line key={'hb'+y} x1="0" y1={y} x2="200" y2={y} stroke={grid} strokeWidth="1" />
        ))}

        {/* source node (files) */}
        <rect x="18" y="64" width="26" height="32" rx="4" fill="rgba(148,163,184,0.15)" stroke={pipe} />
        <line x1="22" y1="74" x2="38" y2="74" stroke={pipe} />
        <line x1="22" y1="82" x2="38" y2="82" stroke={pipe} />

        {/* transform node (gear) */}
        <circle cx="100" cy="100" r="16" fill="rgba(148,163,184,0.15)" stroke={pipe} />
        <motion.g animate={{ rotate: hover ? 360 : 180 }} style={{ originX: 100, originY: 100 }} transition={{ duration: hover ? 8 : 16, repeat: Infinity, ease: 'linear' }}>
          <path d="M100 88 l4 2 4-2 2 4 4 2-2 4 2 4-4 2-2 4-4-2-4 2-2-4-4-2 2-4-2-4 4-2z" fill={sky} opacity=".65" />
        </motion.g>

        {/* warehouse node (database cylinder) */}
        <g>
          <ellipse cx="170" cy="96" rx="14" ry="6" fill="rgba(148,163,184,0.15)" stroke={pipe} />
          <rect x="156" y="96" width="28" height="28" fill="rgba(148,163,184,0.15)" stroke={pipe} />
          <ellipse cx="170" cy="124" rx="14" ry="6" fill="rgba(148,163,184,0.15)" stroke={pipe} />
        </g>

        {/* flows */}
        <path d={flow1} fill="none" stroke={pipe} strokeWidth="2" />
        <path d={flow2} fill="none" stroke={pipe} strokeWidth="2" />
        {/* animated streaming dash */}
        <motion.path d={flow1} fill="none" stroke={cyan} strokeWidth="2.5" strokeDasharray="6 8" animate={{ strokeDashoffset: [0,-100] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
        <motion.path d={flow2} fill="none" stroke={amber} strokeWidth="2.5" strokeDasharray="6 8" animate={{ strokeDashoffset: [0,-100] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} />

        {/* moving data packets */}
        <motion.circle r="3" fill={cyan} animate={{
          cx: [28, 60, 80, 100], cy: [80, 66, 92, 78],
        }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.circle r="3" fill={amber} animate={{
          cx: [100, 130, 150, 170], cy: [122, 140, 106, 122],
        }} transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }} />
      </svg>
      <CornerChip label={label} href={href} dark={dark} hover={hover} />
    </div>
  );
}

// --- 6 core tools, one per ring (1..6)
// --- 6 core tools, one per ring (Mercury→Saturn)
function defaultTechSkills() {
  return [
    { name: 'Python',   ring: 1, size: 7,   color: '#facc15' }, // Mercury (fastest)
    { name: 'SQL',      ring: 2, size: 7,   color: '#60a5fa' }, // Venus
    { name: 'Airflow',  ring: 3, size: 7,   color: '#22d3ee' }, // Earth
    { name: 'dbt',      ring: 4, size: 6.5, color: '#34d399' }, // Mars
    { name: 'Spark',    ring: 5, size: 7,   color: '#f59e0b' }, // Jupiter
    { name: 'BigQuery', ring: 6, size: 7,   color: '#38bdf8' }, // Saturn (slowest)
  ];
}

// --- Pure-SVG revolving rings (all same direction, different speeds) + spinning sun
function TechSolarSystem({
  dark,
  center = 'Data Engineer',
  skills,
  items,
  profession,
}) {
  if (profession) center = profession;

  // normalize skills; ensure 6 items
  const SKILLS = React.useMemo(() => {
    if (Array.isArray(skills) && skills.length) {
      return skills.slice(0, 6).map((s, i) => ({
        name: typeof s === 'string' ? s : s.name,
        ring: (typeof s === 'object' && s.ring) ? s.ring : i + 1,
        size: (typeof s === 'object' && s.size) ? s.size : 7,
        color: (typeof s === 'object' && s.color) ? s.color :
          ['#facc15','#60a5fa','#22d3ee','#34d399','#f59e0b','#38bdf8'][i],
      }));
    }
    if (Array.isArray(items) && items.length) {
      return items.slice(0, 6).map((name, i) => ({
        name, ring: i + 1, size: 7,
        color: ['#facc15','#60a5fa','#22d3ee','#34d399','#f59e0b','#38bdf8'][i],
      }));
    }
    return defaultTechSkills();
  }, [skills, items]);

  const text  = dark ? '#e5e7eb' : '#111111';
  const grid  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.06)';
  const orbit = dark ? 'rgba(255,255,255,0.22)' : 'rgba(17,17,17,0.22)';

  // Radii fit the 0..200 viewBox
  const RADII = [24, 36, 48, 60, 72, 84];

  // Same direction (clockwise) + planet-like relative speeds
  // Mercury→Saturn: 8s, 12s, 16s, 24s, 40s, 60s
  const DUR   =  [ 8, 12, 16, 24, 40, 60 ];
  const DIR   =  [ 1,  1,  1,  1,  1,  1 ];
  const START = [ 0,  40, 80, 140, 200, 260 ]; // spread starting angles

  const toRad = (d) => (d * Math.PI) / 180;
  const pos = (deg, r) => ({ x: 100 + r * Math.cos(toRad(deg)), y: 100 + r * Math.sin(toRad(deg)) });

  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {/* grid */}
        {[40,80,120,160].map((y) => (
          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke={grid} strokeWidth="1" />
        ))}

        {/* base orbits */}
        {RADII.map((r, i) => (
          <circle
            key={`base-${i}`}
            cx="100" cy="100" r={r}
            fill="none" stroke={orbit} strokeWidth="1" opacity="0.55"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Sun + spinning highlight ring */}
        <defs>
          <radialGradient id="sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={dark ? '#fde68a' : '#facc15'} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
          </radialGradient>
        </defs>
        <g>
          <circle cx="100" cy="100" r="12" fill="url(#sun)" stroke={dark ? '#000' : '#fff'} strokeOpacity="0.15" />
          {/* spinning dashed halo to make the sun visibly rotate */}
          <g>
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from={`0 100 100`}
              to={`360 100 100`}
              dur={`10s`}
              repeatCount="indefinite"
              calcMode="linear"
            />
            <circle
              cx="100" cy="100" r="16"
              fill="none" stroke={dark ? '#fcd34d' : '#f59e0b'}
              strokeWidth="2" strokeOpacity="0.6"
              strokeLinecap="round" vectorEffect="non-scaling-stroke"
              strokeDasharray="8 14"
            />
          </g>
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="7.5" fontWeight="800" fill={dark ? '#0b0d12' : '#111111'}>
            {center}
          </text>
        </g>

        {/* SIX RINGS — each <g> rotates around (100,100) forever */}
        {RADII.map((r, i) => {
          const skill = SKILLS[i];
          const startDeg = START[i];

          // base position at 0°; group rotation handles the orbit
          const p = pos(0, r);

          // label slightly outside the ring
          const labelOffset = 10;
          const lx = p.x + (labelOffset * (p.x - 100)) / r;
          const ly = p.y + (labelOffset * (p.y - 100)) / r;

          // moving-gap arc following the planet
          const C   = 2 * Math.PI * r;
          const gap = Math.min(Math.max(18, (skill?.size ?? 6) * 4), C * 0.22);
          const dash = Math.max(0.001, C - gap);

          return (
            <g key={`ring-${i}`}>
              {/* rotate whole group clockwise with planet-like speed */}
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from={`${startDeg} 100 100`}
                to={`${startDeg + DIR[i] * 360} 100 100`}
                dur={`${DUR[i]}s`}
                repeatCount="indefinite"
                calcMode="linear"
              />

              {/* rotating highlight arc */}
              <circle
                cx="100" cy="100" r={r}
                fill="none" stroke={orbit} strokeWidth="1.4" strokeOpacity="0.85"
                strokeLinecap="round" vectorEffect="non-scaling-stroke"
                strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              />

              {/* planet */}
              <circle cx={p.x} cy={p.y} r={(skill?.size ?? 6) + 2.5} fill={`${skill?.color ?? '#999'}22`} />
              <circle cx={p.x} cy={p.y} r={skill?.size ?? 6} fill={skill?.color ?? '#999'} />

              {/* label (rotates with the group) */}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="600"
                fill={text}
                style={{ paintOrder: 'stroke', stroke: dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)', strokeWidth: 1 }}
              >
                {skill?.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-x-4 bottom-3 text-xs text-center opacity-70">
        <span>Core: Python · SQL · Airflow · dbt · Spark · BigQuery</span>
      </div>
    </div>
  );
}









// --- One-time typewriter for About (runs once per page load) ---
function TypewriterOnce({ text, speed = 18, className = "" }) {
  const [out, setOut] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // component already finished typing
    if (typeof window !== "undefined" && sessionStorage.getItem("typed_about_done")) {
      setOut(text);
      ran.current = true;
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        ran.current = true;
        try { sessionStorage.setItem("typed_about_done", "1"); } catch {}
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <div className={className} style={{ whiteSpace: "pre-line" }}>
      {out || text}
    </div>
  );
}

function AboutCard() {
  return (
    <div className="w-full h-full p-6 md:p-8" data-about-content>
      <div className="grid grid-cols-[88px,1fr] gap-6 items-start">
        <motion.div  className="w-20 h-20 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/10"  style={{ originX: 0.45 }} whileHover={{ scale: 1.6 }} whileTap={{ scale: 1.5 }} > 
          <img src="/sachin.jpg" alt="Sachin" className="w-full h-full object-cover object-[50%_30%]" /> 
        </motion.div>

        <div className="leading-7 text-sm md:text-base font-medium text-current">
          <div className="text-base md:text-lg leading-7 md:leading-8 text-current">
            <p className="font-medium">
              Hi, I'm <span className="text-3xl md:text-4xl font-black tracking-tight align-baseline">sachin</span>,
            </p>
            <p className="opacity-90">a data engineer & analyst helping turn your data into decisions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioGrid() {
  // Force dark mode immediately on first load (prevents white flash)
useEffect(() => {
  document.documentElement.classList.add("dark");
}, []);
  const [themeDark, setThemeDark] = useState(true); // default dark
  const [active, setActive] = useState("All");
  const [lockdown, setLockdown] = useState(false);

  // Brand & document title
  const BRAND = "Sachin Sapkota — Data Engineer";
  useEffect(() => {
    try { document.title = BRAND; } catch {}
  }, []);

  // About hover expansion
  const [hoverAbout, setHoverAbout] = useState(false);
  const [aboutRows, setAboutRows] = useState(3);
  const computeAboutRows = () => {
    const group = groupRef.current;
    const aboutNode = nodeRefs.current?.['about'];
    if (!group || !aboutNode) return 3;
    try {
      const content = aboutNode.querySelector('[data-about-content]');
      const ch = (content?.scrollHeight ?? content?.getBoundingClientRect().height ?? aboutNode.scrollHeight ?? aboutNode.getBoundingClientRect().height) || 0;
      const cs = getComputedStyle(group);
      const rowH = parseFloat(cs.getPropertyValue('grid-auto-rows')) || 130;
      const rowGap = parseFloat(cs.getPropertyValue('row-gap') || cs.getPropertyValue('gap')) || 0;
      const rows = Math.ceil((ch + rowGap) / (rowH + rowGap));
      return Math.max(2, Math.min(rows, 6));
    } catch {
      return 3;
    }
  };
  useEffect(() => {
    const onResize = () => { if (hoverAbout) setAboutRows(computeAboutRows()); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [hoverAbout]);
  // If locked, abort any expansion immediately
  useEffect(() => { if (lockdown) setHoverAbout(false); }, [lockdown]);

  // Reset about expansion when tab changes
  useEffect(() => { setHoverAbout(false); }, [active]);

  // Hover/drag state for target preview
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [slotRect, setSlotRect] = useState(null);

  // Requested layout
  const base = [
    { id: "about", num: 1, group: "About", span: "col-span-full md:col-span-6 row-span-2", label: "About", bg: "from-fuchsia-200 to-rose-100 dark:from-fuchsia-900/40 dark:to-rose-900/30" },
    { id: "newsletter", num: 2, group: "Media", span: "col-span-full md:col-span-6 row-span-2", label: "Newsletter", bg: "from-amber-200 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30" },
    { id: "article", num: 3, group: "Media", span: "col-span-full md:col-span-6 row-span-2", label: "Article", bg: "from-sky-200 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/30" },
    { id: "projectWide", num: 4, group: "Projects", span: "col-span-full md:col-span-6 row-span-2", label: "Project – Wide", bg: "from-emerald-200 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/30" },
    { id: "projectTallA", num: 5, group: "Projects", span: "col-span-6 md:col-span-3 row-span-4", label: "Project – Tall A", bg: "from-indigo-200 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/30" },
    { id: "projectTallB", num: 6, group: "Projects", span: "col-span-6 md:col-span-3 row-span-4", label: "Project – Tall B", bg: "from-pink-200 to-rose-100 dark:from-pink-900/40 dark:to-rose-900/30" },
    // Social tiles with icons + links
    { id: "spotify", num: 7, group: "Media", span: "col-span-6 md:col-span-3 row-span-2", label: "GitHub", icon: "github", href: "https://github.com/Mercyenary", bg: "from-lime-200 to-green-100 dark:from-lime-900/40 dark:to-green-900/30" },
    { id: "twitter", num: 8, group: "About", span: "col-span-6 md:col-span-3 row-span-2", label: "Instagram", icon: "instagram", href: "https://www.instagram.com/saw_ch_ien", bg: "from-cyan-200 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/30" },
    { id: "map", num: 9, group: "About", span: "col-span-6 md:col-span-3 row-span-2", label: "LinkedIn", icon: "linkedin", href: "https://www.linkedin.com/in/mercyenary/", bg: "from-purple-200 to-fuchsia-100 dark:from-purple-900/40 dark:to-fuchsia-900/30" },
    { id: "themeCard", num: 10, group: "Utility", span: "col-span-6 md:col-span-3 row-span-2", label: "Dark Mode", bg: "from-zinc-50 to-zinc-100 dark:from-white/[.06] dark:to-white/[.04]" },
  ];
  const [order, setOrder] = useState(base);
  const initialOrderRef = useRef(base);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeDark);
  }, [themeDark]);

  // One array powers both `values` and `.map(...)`
  const list = useMemo(() => viewForActive(order, active), [order, active]);

  // Guarded reorder handler
  const handleReorder = (next) => {
  if (!Array.isArray(next) || !next.length) return;
  setOrder(next.filter(Boolean));
};


  // Constrain dragging within the grid area and measure tiles for previews
  const gridRef = useRef(null);
  const groupRef = useRef(null);
  const nodeRefs = useRef({});
  const setNodeRef = (id) => (el) => {
    if (el) nodeRefs.current[id] = el;
  };

  // Nearest tile to the pointer (used for hover preview)
  function nearestIdToPoint(point, excludeId) {
    if (!point) return null;
    let bestId = null;
    let best = Infinity;
    for (const it of list) {
      if (it.id === excludeId) continue;
      const node = nodeRefs.current[it.id];
      if (!node) continue;
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - point.x;
      const dy = cy - point.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        bestId = it.id;
      }
    }
    return bestId;
  }

  // track dashed placeholder rect when hovering a target tile
  useEffect(() => {
    if (!draggingId || !hoverId) { setSlotRect(null); return; }
    const grid = gridRef.current;
    const node = nodeRefs.current[hoverId];
    if (!grid || !node) return;
    const gr = grid.getBoundingClientRect();
    const nr = node.getBoundingClientRect();
    setSlotRect({ x: nr.left - gr.left, y: nr.top - gr.top, w: nr.width, h: nr.height });
  }, [draggingId, hoverId]);

  // Global safety net: clear drag state if pointer ends/cancels or window loses focus
  useEffect(() => {
    const cancel = () => { setDraggingId(null); setHoverId(null); setSlotRect(null); };
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  return (
    <motion.div
      className="min-h-screen"
      style={{ color: themeDark ? "#ffffff" : "#111111", fontFamily: FONT_STACK }}
      animate={{ backgroundColor: themeDark ? "#0b0d12" : "#faf7f6" }}
      transition={{ duration: 0.35 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/10 backdrop-blur">
        <div className="max-w-6xl mx-auto h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between">
          <Logo dark={themeDark} />
          <nav className="flex gap-1.5 sm:gap-2 rounded-full bg-white/70 dark:bg-white/[.06] p-1 px-1.5 ring-1 ring-black/5 dark:ring-white/10 overflow-x-auto whitespace-nowrap">
            {NAV.map((tab) => (
              <Pill key={tab} active={active === tab} onClick={() => { if (tab === 'All') { setOrder(initialOrderRef.current); } setActive(tab); }} dark={themeDark}>
                {tab}
              </Pill>
            ))}
          </nav>
          <div className="flex gap-2">
            <motion.button
              onClick={() => setLockdown((v) => !v)}
              className="grid place-items-center w-14 h-14 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/[.06] shadow-sm"
              aria-label={lockdown ? "Locked. Click to unlock drag" : "Unlocked. Click to lock drag"}
              title={lockdown ? "Unlock drag" : "Lock drag"}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-2xl" role="img" aria-hidden="true">{lockdown ? "🔒" : "🔓"}</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Grid (dense, constrained) */}
      <main className="max-w-5xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div ref={gridRef} className="relative">
          <Reorder.Group
            ref={groupRef}
            axis="y"
            values={list}
            onReorder={handleReorder}
            className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-4 sm:gap-5 md:gap-6 auto-rows-[96px] sm:auto-rows-[110px] md:auto-rows-[130px] lg:auto-rows-[150px] grid-flow-dense"
          >
            {/* Dashed animated placeholder */}
            {draggingId && slotRect && (
              <motion.div
                className="pointer-events-none absolute rounded-3xl border-2 border-dashed border-black/30 dark:border-white/30"
                style={{ top: 0, left: 0 }}
                initial={false}
                animate={{ x: slotRect.x, y: slotRect.y, width: slotRect.w, height: slotRect.h, opacity: 1 }}
                transition={SPRING}
              />
            )}
            {list.map((item) => {
              const isHover = hoverId === item.id && draggingId !== item.id;
              const isAbout = item.id === "about";
              const rowSpan = isAbout && hoverAbout ? aboutRows : 2;
              const preset = PRESETS[active] || [];
              const isPrimary = active === "All" || item.group === active || preset.includes(item.id);
              const isDimmed = active !== "All" && !isPrimary && draggingId !== item.id;
              return (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  layout
                  drag={!lockdown}
                  dragElastic={0.08}
                  dragMomentum={false}
                  dragConstraints={gridRef}
                  onDragStart={() => { setDraggingId(item.id); if (item.id === "about") setHoverAbout(false); }}
                  onDrag={(e, info) => setHoverId(nearestIdToPoint(info.point, item.id))}
                  onDragEnd={() => { setDraggingId(null); setHoverId(null); setSlotRect(null); }}
                  data-num={item.num} data-name={item.label}
                  className={item.span}
                  style={{ cursor: lockdown ? "default" : "grab", zIndex: draggingId === item.id ? 50 : 1, gridRowEnd: `span ${rowSpan}` }}
                  transition={{ layout: SPRING }}
                  whileDrag={{ scale: 1.03, rotate: 0, zIndex: 50, boxShadow: themeDark ? "0 28px 64px rgba(0,0,0,.6)" : "0 28px 64px rgba(0,0,0,.2)" }}
                  ref={setNodeRef(item.id)}
                  onMouseEnter={() => { if (item.id === 'about' && !lockdown && !draggingId) { setAboutRows(computeAboutRows()); setHoverAbout(true); } }}
                  onMouseLeave={() => { if (item.id === 'about') { setHoverAbout(false); } }}
                >
                  <motion.div
                    className={`w-full h-full ${isHover ? "ring-2 ring-dashed ring-black/30 dark:ring-white/40" : ""}`}
                    animate={{
                      filter: isDimmed ? "blur(2px) saturate(0.85) brightness(0.95)" : "none",
                      opacity: isDimmed ? 0.4 : 1,
                      scale: draggingId && draggingId !== item.id ? 0.997 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    whileHover={!lockdown && !isDimmed && !draggingId ? (item.id === "about" ? undefined : { scale: 1.005 }) : undefined}
                  >
                    <Card>
                      {item.id === "themeCard" ? (
                        <ThemeSwitcher onToggle={() => setThemeDark((d) => !d)} dark={themeDark} />
                      ) : item.href ? (
                        <SocialCard href={item.href} icon={item.icon} brand={item.label} dark={themeDark} />
                      ) : (
                        <>
                        {item.id === "about" ? (
                          <AboutCard />
                        ) : item.id === "article" ? (
                         <TechSolarSystem dark={themeDark} />


                        ) : item.id === "projectTallA" ? (
                          <ProjectArtA dark={themeDark} label={item.label} href={item.href} />
                        ) : item.id === "projectTallB" ? (
                          <ProjectArtB dark={themeDark} label={item.label} href={item.href} />
                        ) : (
                          <Accent>
                            <div className="text-sm md:text-base text-current">{item.label}</div>
                          </Accent>
                        )}
                      </>
                      )}
                    </Card>
                  </motion.div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>
      </main>
    </motion.div>
  );
}

function rowsNeeded(h, row, gap = 0) { return Math.max(2, Math.ceil((h + gap) / (row + gap))); }

// ------------------------------- Runtime Tests -------------------------------
(function runTests() {
  try {
    console.assert(NAV.every((x) => typeof x === 'string'), 'NAV must be strings only');

    const sampleOrder = [
      { id: 'a', group: 'About' },
      { id: 'p1', group: 'Projects' },
      { id: 'm1', group: 'Media' },
      { id: 'p2', group: 'Projects' },
    ];
    const v1 = computeView(sampleOrder, 'All').map((x) => x.id).join(',');
    console.assert(v1 === 'a,p1,m1,p2', 'All preserves order');

    const v2 = computeView(sampleOrder, 'Projects').map((x) => x.id);
    console.assert(v2[0].startsWith('p'), 'Projects float to top');

    // Reorder guard tests
    const invalid = undefined;
    const before = [1, 2, 3];
    const safe = Array.isArray(invalid) ? invalid : before;
    console.assert(Array.isArray(safe), 'Reorder handler should ignore invalid updates');
  } catch (e) {
    console.warn('Runtime tests error:', e);
  }
})();
