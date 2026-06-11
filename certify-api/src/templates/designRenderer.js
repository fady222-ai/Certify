/**
 * Renders a visual template's `design_data` (produced by the canvas editor)
 * into an absolutely-positioned HTML stage that Chrome turns into a PDF.
 *
 * design_data shape:
 * {
 *   width, height, background,
 *   elements: [
 *     { type: "text"|"variable", left, top, width, fontSize, fontFamily,
 *       fontWeight, fill, textAlign, text?, variableKey?, angle? },
 *     { type: "image", left, top, width, height, src, angle? },
 *     { type: "rect", left, top, width, height, fill, stroke, strokeWidth, rx, angle? },
 *   ]
 * }
 *
 * `vars` maps variable keys to their resolved values, e.g.
 *   { recipient_name, course_name, issue_date, org_name, verification_code }
 */
export function renderDesignToHtml(design, vars, qrSvg) {
  const width = design.width ?? 1123;
  const height = design.height ?? 794;
  const background = design.background ?? "#ffffff";
  const elements = Array.isArray(design.elements) ? design.elements : [];

  const body = elements.map((el) => renderElement(el, vars, qrSvg)).join("\n");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
  .stage {
    position: relative; width: ${width}px; height: ${height}px;
    background: ${escapeAttr(background)};
    font-family: "Cairo", "Noto Sans Arabic", "Arial", sans-serif;
    direction: rtl;
  }
  .el { position: absolute; }
  .el-text { white-space: pre-wrap; word-break: break-word; }
  .el-image { object-fit: contain; }
</style>
</head>
<body>
<div class="stage">
${body}
</div>
</body>
</html>`;
}

function renderElement(el, vars, qrSvg) {
  const base =
    `left:${num(el.left)}px;top:${num(el.top)}px;` +
    (el.width != null ? `width:${num(el.width)}px;` : "") +
    (el.angle ? `transform:rotate(${num(el.angle)}deg);transform-origin:top right;` : "");

  switch (el.type) {
    case "qr": {
      return `<div class="el" style="${base}width:${num(el.width ?? 90)}px;height:${num(el.width ?? 90)}px;">${qrSvg ?? ""}</div>`;
    }
    case "image": {
      const h = el.height != null ? `height:${num(el.height)}px;` : "";
      return `<img class="el el-image" style="${base}${h}" src="${escapeAttr(safeImageSrc(el.src))}" />`;
    }
    case "rect": {
      const style =
        base +
        `height:${num(el.height)}px;` +
        `background:${escapeAttr(el.fill ?? "transparent")};` +
        (el.stroke ? `border:${num(el.strokeWidth ?? 1)}px solid ${escapeAttr(el.stroke)};` : "") +
        (el.rx ? `border-radius:${num(el.rx)}px;` : "");
      return `<div class="el" style="${style}"></div>`;
    }
    case "line": {
      const style =
        base +
        `height:${num(el.strokeWidth ?? 2)}px;` +
        `background:${escapeAttr(el.stroke ?? "#000")};`;
      return `<div class="el" style="${style}"></div>`;
    }
    case "text":
    case "variable": {
      const raw =
        el.type === "variable"
          ? vars[el.variableKey] ?? `{${el.variableKey ?? ""}}`
          : el.text ?? "";
      const style =
        base +
        `font-size:${num(el.fontSize ?? 24)}px;` +
        `font-weight:${el.fontWeight ?? 400};` +
        `color:${escapeAttr(el.fill ?? "#111827")};` +
        `text-align:${el.textAlign ?? "center"};` +
        `line-height:${el.lineHeight ?? 1.3};` +
        (el.fontFamily ? `font-family:${escapeAttr(el.fontFamily)},"Cairo",sans-serif;` : "");
      return `<div class="el el-text" style="${style}">${escapeHtml(raw)}</div>`;
    }
    default:
      return "";
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// Hostnames headless Chrome must never fetch when rendering a user-supplied
// template image — prevents SSRF to internal services / cloud metadata.
const BLOCKED_HOST =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|metadata)/i;

/**
 * Sanitize a template image `src`. Allows inline data:image URIs and relative
 * paths; for absolute URLs, only public http(s) hosts are permitted. Anything
 * pointing at a private/internal/metadata host (SSRF) is dropped.
 */
function safeImageSrc(src) {
  const s = String(src ?? "").trim();
  if (!s) return "";
  if (/^data:image\//i.test(s)) return s; // inline raster — no network fetch
  if (/^https?:\/\//i.test(s)) {
    try {
      const host = new URL(s).hostname;
      return BLOCKED_HOST.test(host) ? "" : s;
    } catch {
      return "";
    }
  }
  if (/^[./]/.test(s) && !s.includes(":")) return s; // relative path on our origin
  return ""; // unknown scheme (javascript:, file:, etc.) — reject
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
