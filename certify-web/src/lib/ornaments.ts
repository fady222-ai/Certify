// Mirror of certify-api/src/templates/ornaments.js so the preview matches the
// generated PDF exactly. Ornaments are referenced by name only.

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function gearPath(cx: number, cy: number, teeth: number, rOut: number, rIn: number) {
  const pts: string[] = [];
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

function starPath(cx: number, cy: number, points: number, rOut: number, rIn: number) {
  const pts: string[] = [];
  const steps = points * 2;
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

function medallion(cx: number, cy: number, r: number, id: string) {
  return `
  <defs>
    <radialGradient id="${id}" cx="50%" cy="36%" r="68%">
      <stop offset="0%" stop-color="#fdf1b8"/>
      <stop offset="46%" stop-color="#e7c34d"/>
      <stop offset="100%" stop-color="#9a7b1e"/>
    </radialGradient>
  </defs>
  <path d="${gearPath(cx, cy, 22, r, r * 0.88)}" fill="#b8902a"/>
  <circle cx="${cx}" cy="${cy}" r="${(r * 0.84).toFixed(1)}" fill="url(#${id})" stroke="#8a6d1b" stroke-width="1"/>
  <circle cx="${cx}" cy="${cy}" r="${(r * 0.66).toFixed(1)}" fill="none" stroke="#fff6cf" stroke-width="1.2" opacity="0.7"/>
  <path d="${starPath(cx, cy, 5, r * 0.42, r * 0.17)}" fill="#fffae0"/>`;
}

function leaf(cx: number, cy: number, rot: number, color: string) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="3.4" fill="${color}" transform="rotate(${rot} ${cx} ${cy})"/>`;
}

function laurelBranches(color: string) {
  const c = esc(color);
  let out = "";
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = 88 - t * 70;
    const xL = 50 - (22 - t * 14);
    const xR = 50 + (22 - t * 14);
    const rot = 30 + t * 35;
    out += leaf(xL, y, -rot, c);
    out += leaf(xR, y, rot, c);
  }
  return out;
}

function shade(hex: string, percent: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = percent / 100;
  const ch = (c: number) => {
    const v = Math.round(c + (f < 0 ? c * f : (255 - c) * f));
    return Math.max(0, Math.min(255, v));
  };
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const ORNAMENTS: Record<string, (color?: string, o?: string) => string> = {
  sealGold() {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${medallion(50, 50, 48, "sgSeal")}</svg>`;
  },
  ribbonSeal(color) {
    const c = esc(color || "#1e3a5f");
    const cd = esc(shade(color || "#1e3a5f", -18));
    return `<svg viewBox="0 0 100 138" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
      <path d="M38,52 L24,128 L41,114 L49,70 Z" fill="${c}"/>
      <path d="M62,52 L76,128 L59,114 L51,70 Z" fill="${cd}"/>
      ${medallion(50, 44, 42, "rsSeal")}
    </svg>`;
  },
  laurel(color) {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${laurelBranches(color || "#c9a227")}</svg>`;
  },
  corner(color, o = "TR") {
    const c = esc(color || "#1e3a5f");
    const tri = ({
      TR: "M100,0 L18,0 L100,82 Z",
      TL: "M0,0 L82,0 L0,82 Z",
      BR: "M100,100 L100,18 L18,100 Z",
      BL: "M0,100 L0,18 L82,100 Z",
    } as Record<string, string>)[o];
    const line = ({
      TR: "M8,0 L100,92",
      TL: "M92,0 L0,92",
      BR: "M100,8 L8,100",
      BL: "M0,8 L92,100",
    } as Record<string, string>)[o];
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${tri}" fill="${c}"/>
      <path d="${line}" stroke="#d4af37" stroke-width="2.5" fill="none"/>
    </svg>`;
  },
  diagonalLines() {
    return `<svg viewBox="0 0 220 130" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="dl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient></defs>
      <g fill="url(#dl)">
        <rect x="0" y="96" width="120" height="6" rx="3" transform="rotate(-24 0 96)"/>
        <rect x="6" y="112" width="86" height="6" rx="3" transform="rotate(-24 6 112)"/>
        <rect x="30" y="80" width="70" height="6" rx="3" transform="rotate(-24 30 80)"/>
        <rect x="60" y="120" width="150" height="6" rx="3" transform="rotate(-24 60 120)"/>
        <rect x="120" y="70" width="60" height="6" rx="3" transform="rotate(-24 120 70)"/>
      </g>
    </svg>`;
  },
  chip(color) {
    const c = esc(color || "#c7d2fe");
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="${c}" stroke-width="3">
        <rect x="28" y="28" width="44" height="44" rx="6"/>
        <rect x="40" y="40" width="20" height="20" rx="3"/>
        ${[36, 50, 64].map((x) => `<line x1="${x}" y1="16" x2="${x}" y2="28"/><line x1="${x}" y1="72" x2="${x}" y2="84"/>`).join("")}
        ${[36, 50, 64].map((y) => `<line x1="16" y1="${y}" x2="28" y2="${y}"/><line x1="72" y1="${y}" x2="84" y2="${y}"/>`).join("")}
      </g>
    </svg>`;
  },
  rosette() {
    let pleats = "";
    const teeth = 40;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      const ro = 49, ri = 39;
      const p = (a: number, r: number) => `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
      pleats += `<path d="M${p(a0, ro)} L${p(a1, ri)} L${p(a2, ro)} Z" fill="${i % 2 ? "#a8801f" : "#caa033"}"/>`;
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${pleats}${medallion(50, 50, 38, "rosSeal")}</svg>`;
  },
  guilloche(color) {
    const c = esc(color || "#b8860b");
    const N = 600;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = 46 * (0.6 + 0.22 * Math.cos(7 * t) + 0.16 * Math.cos(5 * t));
      pts.push(`${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`);
    }
    const d = `M${pts.join("L")}Z`;
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <path d="${d}" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.85"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.5" transform="rotate(9 50 50)"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.3" transform="rotate(18 50 50)"/>
    </svg>`;
  },
  artDecoCorner(color, o = "TR") {
    const c = esc(color || "#b8860b");
    const rot = ({ TR: 0, BR: 90, BL: 180, TL: 270 } as Record<string, number>)[o] ?? 0;
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${rot} 50 50)" fill="none" stroke="${c}" stroke-width="2.2">
        <polyline points="4,4 96,4 96,96"/>
        <polyline points="16,14 86,14 86,84"/>
        <polyline points="30,24 76,24 76,72"/>
      </g>
      <circle cx="${rot === 0 ? 86 : 50}" cy="14" r="2.6" fill="${c}" transform="rotate(${rot} 50 50)"/>
    </svg>`;
  },
  monogram(color) {
    const c = esc(color || "#000000");
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="${c}" stroke-width="1.4" opacity="0.07">
        <circle cx="50" cy="50" r="46"/>
        <circle cx="50" cy="50" r="37"/>
        <path d="${starPath(50, 50, 12, 40, 17)}"/>
      </g>
    </svg>`;
  },
  botanical(color, o = "TL") {
    const c = esc(color || "#94a3b8");
    const rot = ({ TL: 0, TR: 90, BR: 180, BL: 270 } as Record<string, number>)[o] ?? 0;
    let leaves = "";
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const x = 14 + t * 58;
      const y = 14 + t * 58;
      leaves += `<ellipse cx="${x.toFixed(1)}" cy="${(y - 9).toFixed(1)}" rx="7" ry="3" fill="${c}" transform="rotate(-30 ${x} ${y})"/>`;
      leaves += `<ellipse cx="${(x - 9).toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="3" fill="${c}" transform="rotate(60 ${x} ${y})"/>`;
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${rot} 50 50)">
        <path d="M12,12 Q40,34 74,74" fill="none" stroke="${c}" stroke-width="2"/>${leaves}
      </g>
    </svg>`;
  },
  wave(color) {
    const c = esc(color || "#0ea5e9");
    const c2 = esc(shade(color || "#0ea5e9", 28));
    return `<svg viewBox="0 0 400 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,40 C110,8 290,92 400,48 L400,120 L0,120 Z" fill="${c2}"/>
      <path d="M0,72 C130,42 280,112 400,76 L400,120 L0,120 Z" fill="${c}"/>
    </svg>`;
  },
};

export function ornamentSvg(name: string, opts: { color?: string; orientation?: string } = {}) {
  const fn = ORNAMENTS[name];
  if (!fn) return "";
  return fn(opts.color, opts.orientation);
}
