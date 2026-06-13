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
 * Apply a lightweight customization to a design WITHOUT touching layout:
 * - recolor: map the template's two identity colors (accent/accent2) to the
 *   user's chosen colors across fill / stroke / ornament color / gradient stops.
 * - logo: place (or remove) an uploaded logo image at the theme's fixed logoBox.
 * Returns a fresh design object; the original is not mutated.
 */
export function applyTheme(
  design: DesignData,
  theme: Theme,
  opts: { accent: string; accent2: string; logoDataUri?: string | null },
): DesignData {
  const clone: DesignData = JSON.parse(JSON.stringify(design));
  const map = (c?: string) =>
    eqColor(c, theme.accent) ? opts.accent : eqColor(c, theme.accent2) ? opts.accent2 : c;

  clone.elements = (clone.elements ?? [])
    .filter((el) => !(el.type === "image" && el.role === "logo")) // drop any prior logo
    .map((el) => {
      const next: DesignElement = { ...el };
      if (next.fill) next.fill = map(next.fill);
      if (next.stroke) next.stroke = map(next.stroke);
      if (next.color) next.color = map(next.color);
      if (next.gradient) {
        next.gradient = {
          ...next.gradient,
          from: map(next.gradient.from)!,
          to: map(next.gradient.to)!,
        };
      }
      return next;
    });

  if (opts.logoDataUri) {
    clone.elements.push({
      type: "image",
      role: "logo",
      src: opts.logoDataUri,
      left: theme.logoBox.left,
      top: theme.logoBox.top,
      width: theme.logoBox.width,
      height: theme.logoBox.height,
    });
  }

  // Strip theme metadata from the saved copy (it is no longer a preset), but the
  // caller re-attaches a theme so the result stays re-customizable.
  return clone;
}

/**
 * Read an image File and return a downscaled PNG data-URI (max `maxPx` on the
 * long edge) so the logo embeds compactly in design_data.
 */
export function downscaleToDataUrl(file: File, maxPx = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
