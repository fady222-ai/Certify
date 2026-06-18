import { describe, it, expect } from "vitest";
import { objectToElement, normColor, centerX, STAGE_W } from "./canvas";

// Pure canvas<->design_data mapping extracted from TemplateEditor. These guard
// the serialization that turns a Fabric object back into a stored element.

function mockObj(over: Record<string, unknown>) {
  return {
    left: 10.4,
    top: 20.6,
    angle: 0,
    getScaledWidth: () => 100.7,
    getScaledHeight: () => 50.2,
    ...over,
  };
}

describe("normColor", () => {
  it("keeps hex colors", () => {
    expect(normColor("#ffaa00")).toBe("#ffaa00");
  });
  it("falls back to black for non-hex / missing values", () => {
    expect(normColor("rgb(0,0,0)")).toBe("#000000");
    expect(normColor(undefined)).toBe("#000000");
    expect(normColor(null)).toBe("#000000");
  });
});

describe("centerX", () => {
  it("centers an element of the given width on the stage", () => {
    expect(centerX(STAGE_W)).toBe(0);
    expect(centerX(123)).toBe(Math.round((STAGE_W - 123) / 2));
  });
});

describe("objectToElement", () => {
  it("maps a QR placeholder (rounds position, square from width)", () => {
    expect(objectToElement(mockObj({ isQr: true, getScaledWidth: () => 90 }))).toEqual({
      type: "qr",
      left: 10,
      top: 21,
      width: 90,
    });
  });

  it("maps a plain textbox to a text element", () => {
    const el = objectToElement(
      mockObj({ type: "textbox", text: "مرحبا", fontSize: 28.4, fontWeight: 700, fill: "#111827", textAlign: "center" }),
    );
    expect(el).toMatchObject({ type: "text", text: "مرحبا", width: 101, fontSize: 28, fontWeight: 700 });
  });

  it("maps a textbox carrying a variableKey to a variable element", () => {
    const el = objectToElement(
      mockObj({ type: "textbox", variableKey: "recipient_name", fontSize: 30, fontWeight: 800, fill: "#000", textAlign: "center" }),
    );
    expect(el).toMatchObject({ type: "variable", variableKey: "recipient_name" });
  });

  it("maps a rect element", () => {
    const el = objectToElement(
      mockObj({ type: "rect", fill: "transparent", stroke: "#4f46e5", strokeWidth: 3, rx: 8 }),
    );
    expect(el).toMatchObject({ type: "rect", height: 50, stroke: "#4f46e5", strokeWidth: 3, rx: 8 });
  });

  it("returns null for unsupported object types", () => {
    expect(objectToElement(mockObj({ type: "circle" }))).toBeNull();
  });
});
