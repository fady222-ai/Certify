// Canvas <-> design_data mapping for the template editor. Kept free of React so
// the conversion logic (build a Fabric object from an element, and serialize an
// object back to an element) can be reasoned about and unit-tested on its own.
import { type DesignElement, variableLabel } from "@/lib/templates";

export const STAGE_W = 1123;
export const STAGE_H = 794;

// Minimal typing for the bits of Fabric we use (kept loose to avoid version churn).
/* eslint-disable @typescript-eslint/no-explicit-any */
export type FabricNS = any;
export type FObj = any;

/** Horizontal offset to center an element of the given width on the stage. */
export const centerX = (w: number) => Math.round((STAGE_W - w) / 2);

export function lockVerticalScale(obj: FObj) {
  // Allow horizontal width resize only; font size is controlled via the panel.
  obj.setControlsVisibility({ mt: false, mb: false, tl: false, tr: false, bl: false, br: false, ml: true, mr: true });
}

export function normColor(c: unknown) {
  return typeof c === "string" && c.startsWith("#") ? c : "#000000";
}

/** Build a Fabric object from a stored design element. */
export function buildObject(fabric: FabricNS, el: DesignElement): FObj | Promise<FObj> {
  const common = { left: el.left, top: el.top, angle: el.angle ?? 0 };
  if (el.type === "text" || el.type === "variable") {
    const t = new fabric.Textbox(
      el.type === "variable" ? `«${variableLabel(el.variableKey)}»` : el.text ?? "نص",
      {
        ...common,
        width: el.width ?? 300,
        fontSize: el.fontSize ?? 28,
        fontWeight: el.fontWeight ?? 700,
        fill: el.fill ?? "#111827",
        textAlign: el.textAlign ?? "center",
        fontFamily: el.fontFamily ?? "Cairo",
        direction: "rtl",
      },
    );
    t.set({ editable: el.type === "text" });
    (t as FObj).variableKey = el.type === "variable" ? el.variableKey : undefined;
    (t as FObj).role = el.role; // preserve content role (title/body) across edits
    lockVerticalScale(t);
    return t;
  }
  if (el.type === "rect" || el.type === "line") {
    return new fabric.Rect({
      ...common,
      width: el.width ?? 200,
      height: el.type === "line" ? el.strokeWidth ?? 3 : el.height ?? 120,
      fill: el.fill ?? (el.type === "line" ? el.stroke ?? "#000" : "transparent"),
      stroke: el.stroke ?? null,
      strokeWidth: el.strokeWidth ?? (el.type === "line" ? 0 : 2),
      rx: el.rx ?? 0,
      ry: el.rx ?? 0,
    });
  }
  if (el.type === "qr") {
    const r = new fabric.Rect({
      ...common,
      width: el.width ?? 90,
      height: el.width ?? 90,
      fill: "#e2e8f0",
      stroke: "#94a3b8",
      strokeDashArray: [5, 4],
      strokeWidth: 1,
    });
    (r as FObj).isQr = true;
    return r;
  }
  if (el.type === "image" && el.src) {
    return fabric.FabricImage.fromURL(el.src, { crossOrigin: "anonymous" }).then((img: FObj) => {
      img.set({ ...common });
      if (el.width) img.scaleToWidth(el.width);
      return img;
    });
  }
  return new fabric.Rect({ ...common, width: 100, height: 100, fill: "#ddd" });
}

/** Serialize a single Fabric object back to a design element (or null to skip). */
export function objectToElement(obj: FObj): DesignElement | null {
  const left = Math.round(obj.left);
  const top = Math.round(obj.top);
  const angle = Math.round(obj.angle ?? 0);
  const w = Math.round(obj.getScaledWidth());
  const h = Math.round(obj.getScaledHeight());

  if (obj.isQr) {
    return { type: "qr", left, top, width: w };
  }
  if (obj.variableKey) {
    return { type: "variable", variableKey: obj.variableKey, left, top, width: w, fontSize: Math.round(obj.fontSize), fontWeight: obj.fontWeight, fill: obj.fill, textAlign: obj.textAlign, angle, ...(obj.role ? { role: obj.role } : {}) };
  }
  if (obj.type === "textbox") {
    return { type: "text", text: obj.text, left, top, width: w, fontSize: Math.round(obj.fontSize), fontWeight: obj.fontWeight, fill: obj.fill, textAlign: obj.textAlign, angle, ...(obj.role ? { role: obj.role } : {}) };
  }
  if (obj.type === "image") {
    return { type: "image", left, top, width: w, height: h, src: obj.getSrc?.() ?? obj._element?.src, angle };
  }
  if (obj.type === "rect") {
    return { type: "rect", left, top, width: w, height: h, fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth, rx: obj.rx, angle };
  }
  return null;
}
