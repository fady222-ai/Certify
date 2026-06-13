import type { DesignData, DesignElement } from "./templates";

export type Theme = {
  accent: string;
  accent2: string;
  logoBox: { left: number; top: number; width: number; height: number };
};

/** Read the theme metadata embedded in a (public) template's design_data. */
export function getTheme(design: DesignData | null): Theme | null {
  const t = (design as unknown as { theme?: Theme })?.theme;
  if (!t || !t.accent || !t.logoBox) return null;
  return t;
}

const eqColor = (a?: string, b?: string) =>
  typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

/**
 * Recolor a design WITHOUT touching layout: map the template's two identity
 * colors (accent/accent2) to the user's chosen colors across
 * fill / stroke / ornament color / gradient stops. Returns a fresh design.
 */
export function applyTheme(
  design: DesignData,
  theme: Theme,
  opts: { accent: string; accent2: string },
): DesignData {
  const clone: DesignData = JSON.parse(JSON.stringify(design));
  const map = (c?: string) =>
    eqColor(c, theme.accent) ? opts.accent : eqColor(c, theme.accent2) ? opts.accent2 : c;

  clone.elements = (clone.elements ?? [])
    .filter((el) => !(el.type === "image" && el.role === "logo"))
    .map((el) => {
      const next: DesignElement = { ...el };
      if (next.fill) next.fill = map(next.fill);
      if (next.stroke) next.stroke = map(next.stroke);
      if (next.color) next.color = map(next.color);
      if (next.gradient) {
        next.gradient = { ...next.gradient, from: map(next.gradient.from)!, to: map(next.gradient.to)! };
      }
      return next;
    });
  return clone;
}

/**
 * Preview-only: place the organization's logo at the design's logo slot so the
 * customizer/list previews show what the issued certificate will look like.
 * The saved template never contains this element — the logo is resolved from
 * org settings at render time.
 */
function boxesOverlap(el: DesignElement, box: Theme["logoBox"]): boolean {
  const w = el.width ?? 0;
  const h = el.height ?? w;
  if (!w || !h) return false;
  return !(
    el.left + w <= box.left ||
    el.left >= box.left + box.width ||
    el.top + h <= box.top ||
    el.top >= box.top + box.height
  );
}

export function injectLogo(design: DesignData | null, logoUrl?: string | null): DesignData | null {
  if (!design) return design;
  const theme = (design as unknown as { theme?: Theme }).theme;
  const box = theme?.logoBox;
  if (!logoUrl || !box) return design;
  const clone: DesignData = JSON.parse(JSON.stringify(design));
  // Drop a prior logo image + the template's default emblem at the logo slot.
  clone.elements = [
    ...(clone.elements ?? []).filter(
      (el) =>
        !(el.type === "image" && el.role === "logo") &&
        !(el.type === "ornament" && boxesOverlap(el, box)),
    ),
    { type: "image", role: "logo", src: logoUrl, left: box.left, top: box.top, width: box.width, height: box.height },
  ];
  return clone;
}
