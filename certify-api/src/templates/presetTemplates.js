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
];

export const presetTemplates = designs.map((design, i) => ({
  id: ID(i + 1),
  name: `تصميم ${i + 1}`,
  design,
}));
