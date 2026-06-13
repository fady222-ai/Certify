// Ready-made public certificate designs. Each design is purely a visual style
// (neutral title "شهادة") so it works for ANY certificate purpose — the user
// picks by look, not by type. Shared by prisma/seed.js and the preview tooling.
//
// design_data follows src/templates/designRenderer.js (gradient rects + named
// `ornament` elements from src/templates/ornaments.js).

const NAVY = "#14233f";
const GOLD = "#b8860b";
const GOLDSOFT = "#d4af37";
const INK = "#0f172a";
const MUTE = "#6b7280";
const SLATE = "#334155";
const SILVER = "#94a3b8";

const page = (background, elements) => ({ width: 1123, height: 794, background, elements });
const ID = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

// Shared content blocks ──────────────────────────────────────────────────────
function centeredCore({ title = NAVY, name = GOLD, course = INK, sub = MUTE, line = GOLD }) {
  return [
    { type: "text", left: 161, top: 150, width: 801, text: "شهادة", fontSize: 64, fontWeight: 800, fill: title, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 451, top: 248, width: 220, stroke: line, strokeWidth: 1 },
    { type: "text", left: 211, top: 282, width: 701, text: "تُمنح هذه الشهادة إلى", fontSize: 20, fontWeight: 500, fill: sub, textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 161, top: 322, width: 801, fontSize: 48, fontWeight: 800, fill: name, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 361, top: 402, width: 400, stroke: "#e5e7eb", strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 161, top: 428, width: 801, fontSize: 28, fontWeight: 700, fill: course, textAlign: "center", fontFamily: "Cairo" },
  ];
}

function footerCenter({ label = NAVY, sub = MUTE } = {}) {
  return [
    { type: "line", left: 130, top: 662, width: 240, stroke: label, strokeWidth: 1 },
    { type: "variable", variableKey: "org_name", left: 130, top: 670, width: 240, fontSize: 16, fontWeight: 700, fill: label, textAlign: "center" },
    { type: "text", left: 130, top: 696, width: 240, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: sub, textAlign: "center" },
    { type: "line", left: 753, top: 662, width: 240, stroke: label, strokeWidth: 1 },
    { type: "variable", variableKey: "issue_date", left: 753, top: 670, width: 240, fontSize: 16, fontWeight: 700, fill: label, textAlign: "center" },
    { type: "text", left: 753, top: 696, width: 240, text: "التاريخ", fontSize: 12, fontWeight: 500, fill: sub, textAlign: "center" },
    { type: "qr", left: 524, top: 596, width: 72 },
    { type: "variable", variableKey: "verification_code", left: 461, top: 676, width: 200, fontSize: 11, fontWeight: 600, fill: sub, textAlign: "center" },
  ];
}

const goldFrame = () => [
  { type: "rect", left: 28, top: 28, width: 1067, height: 738, fill: "transparent", stroke: GOLD, strokeWidth: 4 },
  { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: GOLDSOFT, strokeWidth: 1 },
];

const corners = (color) => ["TL", "TR", "BL", "BR"].map((o) => ({
  type: "ornament", name: "corner", color, orientation: o,
  left: o[1] === "R" ? 983 : 0, top: o[0] === "B" ? 654 : 0, width: 140, height: 140,
}));

const decoCorners = (color) => ["TL", "TR", "BL", "BR"].map((o) => ({
  type: "ornament", name: "artDecoCorner", color, orientation: o,
  left: o[1] === "R" ? 963 : 20, top: o[0] === "B" ? 614 : 20, width: 160, height: 160,
}));

const botanicalCorners = (color) => ["TL", "TR", "BL", "BR"].map((o) => ({
  type: "ornament", name: "botanical", color, orientation: o,
  left: o[1] === "R" ? 953 : 30, top: o[0] === "B" ? 624 : 30, width: 160, height: 160,
}));

const monoWatermark = (color) => ({ type: "ornament", name: "monogram", color, left: 311, top: 175, width: 500, height: 500 });

const pageP = (background, elements) => ({ width: 794, height: 1123, background, elements });

// Layout builders ─────────────────────────────────────────────────────────────
function headerBand({ from, to }) {
  return page("#ffffff", [
    { type: "rect", left: 0, top: 0, width: 1123, height: 180, gradient: { from, to, angle: 120 } },
    { type: "rect", left: 0, top: 778, width: 1123, height: 16, gradient: { from: to, to: from, angle: 120 } },
    { type: "text", left: 161, top: 60, width: 801, text: "شهادة", fontSize: 52, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
    { type: "ornament", name: "sealGold", left: 516, top: 122, width: 110, height: 110 },
    { type: "text", left: 211, top: 282, width: 701, text: "تُمنح هذه الشهادة إلى", fontSize: 20, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 161, top: 322, width: 801, fontSize: 46, fontWeight: 800, fill: from, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 361, top: 402, width: 400, stroke: "#e5e7eb", strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 161, top: 428, width: 801, fontSize: 28, fontWeight: 700, fill: INK, textAlign: "center", fontFamily: "Cairo" },
    ...footerCenter({ label: INK }),
  ]);
}

function sidePanel({ from, to, accent }) {
  return page("#f1f2f5", [
    { type: "rect", left: 793, top: 0, width: 330, height: 794, gradient: { from, to, angle: 160 } },
    { type: "ornament", name: "chip", color: "#ffffff", left: 893, top: 80, width: 130, height: 130 },
    { type: "variable", variableKey: "org_name", left: 793, top: 230, width: 330, fontSize: 20, fontWeight: 700, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
    { type: "variable", variableKey: "issue_date", left: 793, top: 480, width: 330, fontSize: 14, fontWeight: 600, fill: "#ffffff", textAlign: "center" },
    { type: "text", left: 60, top: 90, width: 680, text: "شهادة", fontSize: 60, fontWeight: 800, fill: INK, textAlign: "center", fontFamily: "Cairo" },
    { type: "text", left: 60, top: 210, width: 680, text: "تُمنح هذه الشهادة إلى", fontSize: 20, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 40, top: 250, width: 720, fontSize: 46, fontWeight: 800, fill: accent, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 170, top: 335, width: 460, stroke: accent, strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 40, top: 360, width: 720, fontSize: 26, fontWeight: 700, fill: INK, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 90, top: 505, width: 200, stroke: accent, strokeWidth: 1 },
    { type: "text", left: 90, top: 513, width: 200, text: "التوقيع", fontSize: 13, fontWeight: 600, fill: MUTE, textAlign: "center" },
    { type: "qr", left: 520, top: 470, width: 78 },
    { type: "variable", variableKey: "verification_code", left: 490, top: 556, width: 160, fontSize: 10, fontWeight: 600, fill: "#9ca3af", textAlign: "center" },
  ]);
}

function medallionPanel({ panel, ribbon, accent }) {
  return page("#faf7f0", [
    { type: "rect", left: 803, top: 0, width: 320, height: 794, fill: panel },
    { type: "ornament", name: "ribbonSeal", color: ribbon, left: 720, top: 70, width: 150, height: 200 },
    { type: "ornament", name: "laurel", color: ribbon, left: 110, top: 55, width: 80, height: 80 },
    { type: "variable", variableKey: "org_name", left: 200, top: 78, width: 320, fontSize: 18, fontWeight: 700, fill: accent, textAlign: "right", fontFamily: "Cairo" },
    { type: "text", left: 80, top: 210, width: 660, text: "شهادة", fontSize: 60, fontWeight: 800, fill: accent, textAlign: "center", fontFamily: "Cairo" },
    { type: "text", left: 80, top: 320, width: 660, text: "تُمنح هذه الشهادة إلى", fontSize: 19, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 60, top: 360, width: 700, fontSize: 46, fontWeight: 800, fill: accent, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 230, top: 440, width: 360, stroke: ribbon, strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 80, top: 462, width: 660, fontSize: 24, fontWeight: 700, fill: accent, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 110, top: 650, width: 220, stroke: accent, strokeWidth: 1 },
    { type: "text", left: 110, top: 658, width: 220, text: "التوقيع", fontSize: 13, fontWeight: 600, fill: MUTE, textAlign: "center" },
    { type: "variable", variableKey: "issue_date", left: 470, top: 622, width: 220, fontSize: 16, fontWeight: 700, fill: accent, textAlign: "center" },
    { type: "line", left: 470, top: 650, width: 220, stroke: accent, strokeWidth: 1 },
    { type: "text", left: 470, top: 658, width: 220, text: "التاريخ", fontSize: 13, fontWeight: 600, fill: MUTE, textAlign: "center" },
    { type: "qr", left: 705, top: 540, width: 78 },
    { type: "variable", variableKey: "verification_code", left: 670, top: 626, width: 150, fontSize: 10, fontWeight: 600, fill: "#a8895a", textAlign: "center" },
  ]);
}

function dark({ from, to, title, accent }) {
  return page(from, [
    { type: "rect", left: 0, top: 0, width: 1123, height: 794, gradient: { from, to, angle: 150 } },
    { type: "ornament", name: "sealGold", left: 975, top: 45, width: 78, height: 78 },
    { type: "variable", variableKey: "org_name", left: 600, top: 64, width: 360, fontSize: 18, fontWeight: 700, fill: "#e2e8f0", textAlign: "right", fontFamily: "Cairo" },
    { type: "text", left: 120, top: 215, width: 883, text: "شهادة", fontSize: 60, fontWeight: 800, fill: title, textAlign: "center", fontFamily: "Cairo" },
    { type: "text", left: 160, top: 330, width: 803, text: "تُمنح هذه الشهادة إلى", fontSize: 22, fontWeight: 500, fill: "#cbd5e1", textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 120, top: 372, width: 883, fontSize: 42, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 411, top: 452, width: 300, stroke: accent, strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 120, top: 476, width: 883, fontSize: 26, fontWeight: 700, fill: accent, textAlign: "center", fontFamily: "Cairo" },
    { type: "ornament", name: "diagonalLines", left: 0, top: 624, width: 360, height: 170 },
    { type: "rect", left: 974, top: 648, width: 104, height: 104, fill: "#ffffff", rx: 8 },
    { type: "qr", left: 982, top: 656, width: 88 },
    { type: "variable", variableKey: "issue_date", left: 430, top: 690, width: 280, fontSize: 14, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
    { type: "variable", variableKey: "verification_code", left: 430, top: 724, width: 280, fontSize: 11, fontWeight: 600, fill: "#475569", textAlign: "center" },
  ]);
}

// The 12 designs ──────────────────────────────────────────────────────────────
const designs = [
  // 1) classic navy + gold corners + seal
  page("#ffffff", [
    ...goldFrame(), ...corners(NAVY),
    { type: "ornament", name: "sealGold", left: 905, top: 78, width: 100, height: 100 },
    ...centeredCore({ title: NAVY, name: GOLD, course: INK, line: GOLD }),
    ...footerCenter({ label: NAVY }),
  ]),
  // 2) elegant gold double frame + laurel
  page("#fffdf5", [
    ...goldFrame(),
    { type: "ornament", name: "laurel", color: GOLD, left: 521, top: 64, width: 90, height: 90 },
    ...centeredCore({ title: "#5c3d0a", name: GOLD, course: "#5c3d0a", line: GOLDSOFT, sub: "#92722f" }),
    ...footerCenter({ label: "#5c3d0a", sub: "#a8895a" }),
  ]),
  // 3) silver / slate
  page("#ffffff", [
    { type: "rect", left: 28, top: 28, width: 1067, height: 738, fill: "transparent", stroke: SILVER, strokeWidth: 4 },
    { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#cbd5e1", strokeWidth: 1 },
    { type: "ornament", name: "laurel", color: SILVER, left: 521, top: 64, width: 90, height: 90 },
    ...centeredCore({ title: SLATE, name: "#1e293b", course: SLATE, line: SILVER, sub: "#64748b" }),
    ...footerCenter({ label: SLATE, sub: "#64748b" }),
  ]),
  // 4) minimal
  page("#ffffff", [
    { type: "rect", left: 0, top: 0, width: 1123, height: 12, gradient: { from: "#4f46e5", to: "#0ea5e9", angle: 90 } },
    { type: "rect", left: 0, top: 782, width: 1123, height: 12, gradient: { from: "#0ea5e9", to: "#4f46e5", angle: 90 } },
    { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#e5e7eb", strokeWidth: 2 },
    ...centeredCore({ title: INK, name: "#4f46e5", course: INK, line: "#4f46e5", sub: MUTE }),
    ...footerCenter({ label: INK }),
  ]),
  // 5) header band — indigo→sky
  headerBand({ from: "#4f46e5", to: "#0ea5e9" }),
  // 6) header band — rose→amber
  headerBand({ from: "#e11d48", to: "#f59e0b" }),
  // 7) side panel — purple
  sidePanel({ from: "#7c3aed", to: "#4f46e5", accent: "#6d28d9" }),
  // 8) side panel — teal
  sidePanel({ from: "#0d9488", to: "#0ea5e9", accent: "#0f766e" }),
  // 9) medallion side panel — navy + gold
  medallionPanel({ panel: NAVY, ribbon: GOLD, accent: NAVY }),
  // 10) medallion side panel — charcoal + gold
  medallionPanel({ panel: "#1f2937", ribbon: GOLD, accent: "#3f2d0a" }),
  // 11) dark — navy + teal accent
  dark({ from: "#0b2540", to: "#143a5e", title: "#5eead4", accent: "#5eead4" }),
  // 12) dark — charcoal + gold accent
  dark({ from: "#111827", to: "#1f2937", title: "#fcd34d", accent: "#fcd34d" }),

  // 13) guilloché luxe — security rosette + watermark + gold frame
  page("#ffffff", [
    monoWatermark(NAVY),
    ...goldFrame(),
    { type: "ornament", name: "guilloche", color: GOLD, left: 515, top: 50, width: 96, height: 96 },
    ...centeredCore({ title: NAVY, name: GOLD, course: INK, line: GOLD }),
    ...footerCenter({ label: NAVY }),
  ]),
  // 14) art-deco emerald
  page("#ffffff", [
    monoWatermark("#065f46"),
    ...decoCorners(GOLD),
    ...centeredCore({ title: "#065f46", name: GOLD, course: "#064e3b", line: GOLD }),
    ...footerCenter({ label: "#065f46" }),
  ]),
  // 15) royal blue + gold rosette
  page("#ffffff", [
    ...goldFrame(),
    { type: "ornament", name: "rosette", left: 905, top: 76, width: 104, height: 104 },
    ...centeredCore({ title: "#1e3a8a", name: GOLD, course: INK, line: GOLD }),
    ...footerCenter({ label: "#1e3a8a" }),
  ]),
  // 16) burgundy classic — laurel + rosette
  page("#fffaf7", [
    ...goldFrame(),
    { type: "ornament", name: "laurel", color: GOLD, left: 60, top: 60, width: 80, height: 80 },
    { type: "ornament", name: "rosette", left: 905, top: 70, width: 100, height: 100 },
    ...centeredCore({ title: "#7f1d1d", name: GOLD, course: "#7f1d1d", line: GOLD, sub: "#9b6b6b" }),
    ...footerCenter({ label: "#7f1d1d", sub: "#9b6b6b" }),
  ]),
  // 17) soft botanical
  page("#fdf6f4", [
    ...botanicalCorners("#5b6f5b"),
    ...centeredCore({ title: "#3f4a3f", name: "#5b6f5b", course: "#3f4a3f", line: "#c8b6a6", sub: "#8a857f" }),
    ...footerCenter({ label: "#3f4a3f", sub: "#8a857f" }),
  ]),
  // 18) modern wave
  page("#ffffff", [
    { type: "rect", left: 0, top: 0, width: 1123, height: 14, gradient: { from: "#06b6d4", to: "#0ea5e9", angle: 90 } },
    { type: "ornament", name: "wave", color: "#0ea5e9", left: 0, top: 712, width: 1123, height: 82 },
    { type: "ornament", name: "sealGold", left: 516, top: 64, width: 96, height: 96 },
    ...centeredCore({ title: "#0369a1", name: "#0ea5e9", course: INK, line: "#0ea5e9" }),
    { type: "line", left: 130, top: 640, width: 240, stroke: "#0369a1", strokeWidth: 1 },
    { type: "variable", variableKey: "org_name", left: 130, top: 648, width: 240, fontSize: 16, fontWeight: 700, fill: "#0369a1", textAlign: "center" },
    { type: "text", left: 130, top: 674, width: 240, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "line", left: 753, top: 640, width: 240, stroke: "#0369a1", strokeWidth: 1 },
    { type: "variable", variableKey: "issue_date", left: 753, top: 648, width: 240, fontSize: 16, fontWeight: 700, fill: "#0369a1", textAlign: "center" },
    { type: "text", left: 753, top: 674, width: 240, text: "التاريخ", fontSize: 12, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "qr", left: 524, top: 560, width: 72 },
    { type: "variable", variableKey: "verification_code", left: 461, top: 638, width: 200, fontSize: 11, fontWeight: 600, fill: MUTE, textAlign: "center" },
  ]),
  // 19) portrait — formal wall certificate
  pageP("#ffffff", [
    { type: "rect", left: 28, top: 28, width: 738, height: 1067, fill: "transparent", stroke: GOLD, strokeWidth: 4 },
    { type: "rect", left: 40, top: 40, width: 714, height: 1043, fill: "transparent", stroke: GOLDSOFT, strokeWidth: 1 },
    { type: "ornament", name: "rosette", left: 347, top: 80, width: 100, height: 100 },
    { type: "text", left: 47, top: 230, width: 700, text: "شهادة", fontSize: 60, fontWeight: 800, fill: NAVY, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 287, top: 330, width: 220, stroke: GOLD, strokeWidth: 1 },
    { type: "text", left: 97, top: 370, width: 600, text: "تُمنح هذه الشهادة إلى", fontSize: 20, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "variable", variableKey: "recipient_name", left: 47, top: 415, width: 700, fontSize: 46, fontWeight: 800, fill: GOLD, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 197, top: 500, width: 400, stroke: "#e5e7eb", strokeWidth: 1 },
    { type: "variable", variableKey: "course_name", left: 47, top: 535, width: 700, fontSize: 28, fontWeight: 700, fill: INK, textAlign: "center", fontFamily: "Cairo" },
    { type: "line", left: 120, top: 900, width: 220, stroke: NAVY, strokeWidth: 1 },
    { type: "variable", variableKey: "org_name", left: 120, top: 908, width: 220, fontSize: 15, fontWeight: 700, fill: NAVY, textAlign: "center" },
    { type: "text", left: 120, top: 932, width: 220, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "line", left: 454, top: 900, width: 220, stroke: NAVY, strokeWidth: 1 },
    { type: "variable", variableKey: "issue_date", left: 454, top: 908, width: 220, fontSize: 15, fontWeight: 700, fill: NAVY, textAlign: "center" },
    { type: "text", left: 454, top: 932, width: 220, text: "التاريخ", fontSize: 12, fontWeight: 500, fill: MUTE, textAlign: "center" },
    { type: "qr", left: 359, top: 700, width: 76 },
    { type: "variable", variableKey: "verification_code", left: 297, top: 786, width: 200, fontSize: 11, fontWeight: 600, fill: MUTE, textAlign: "center" },
  ]),
  // 20) minimal monogram watermark
  page("#ffffff", [
    { type: "ornament", name: "monogram", color: "#4f46e5", left: 261, top: 120, width: 600, height: 600 },
    { type: "rect", left: 481, top: 248, width: 160, height: 3, fill: "#4f46e5" },
    ...centeredCore({ title: INK, name: "#4f46e5", course: INK, line: "#4f46e5", sub: MUTE }),
    ...footerCenter({ label: INK }),
  ]),
];

// Per-design theme metadata for the lightweight customizer: the two identity
// colors a user may recolor, and a fixed box where an uploaded logo is placed.
const lb = (left, top, width, height) => ({ left, top, width, height });
const THEMES = [
  { accent: GOLD, accent2: NAVY, logoBox: lb(511, 55, 100, 90) },          // 1
  { accent: GOLD, accent2: "#5c3d0a", logoBox: lb(521, 60, 90, 90) },      // 2
  { accent: SLATE, accent2: SILVER, logoBox: lb(521, 60, 90, 90) },        // 3
  { accent: "#4f46e5", accent2: INK, logoBox: lb(511, 70, 100, 80) },      // 4
  { accent: "#4f46e5", accent2: "#0ea5e9", logoBox: lb(90, 40, 90, 90) },  // 5
  { accent: "#e11d48", accent2: "#f59e0b", logoBox: lb(90, 40, 90, 90) },  // 6
  { accent: "#7c3aed", accent2: "#6d28d9", logoBox: lb(893, 80, 130, 130) }, // 7
  { accent: "#0d9488", accent2: "#0f766e", logoBox: lb(893, 80, 130, 130) }, // 8
  { accent: NAVY, accent2: GOLD, logoBox: lb(110, 55, 90, 90) },           // 9
  { accent: "#1f2937", accent2: GOLD, logoBox: lb(110, 55, 90, 90) },      // 10
  { accent: "#5eead4", accent2: "#0b2540", logoBox: lb(120, 40, 90, 90) }, // 11
  { accent: "#fcd34d", accent2: "#111827", logoBox: lb(120, 40, 90, 90) }, // 12
  { accent: GOLD, accent2: NAVY, logoBox: lb(90, 70, 90, 90) },            // 13
  { accent: "#065f46", accent2: GOLD, logoBox: lb(511, 55, 100, 80) },     // 14
  { accent: "#1e3a8a", accent2: GOLD, logoBox: lb(511, 55, 100, 80) },     // 15
  { accent: "#7f1d1d", accent2: GOLD, logoBox: lb(511, 55, 100, 80) },     // 16
  { accent: "#5b6f5b", accent2: "#3f4a3f", logoBox: lb(511, 60, 100, 80) }, // 17
  { accent: "#0ea5e9", accent2: "#0369a1", logoBox: lb(110, 40, 90, 90) }, // 18
  { accent: GOLD, accent2: NAVY, logoBox: lb(347, 70, 100, 100) },         // 19 (portrait)
  { accent: "#4f46e5", accent2: INK, logoBox: lb(511, 70, 100, 80) },      // 20
];

export const presetTemplates = designs.map((design, i) => ({
  id: ID(i + 1),
  name: `تصميم ${i + 1}`,
  design: { ...design, theme: THEMES[i] },
}));
