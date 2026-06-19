import { describe, it, expect } from "vitest";
import { resolveGatewayChoice } from "./billing";

// Guards the checkout entry point shared by /pricing and /dashboard/billing:
// none → block payment with a message, one → go straight, 2+ → show the picker.
describe("resolveGatewayChoice", () => {
  it("no gateways available → none (page disables the pay button, no dead-end picker)", () => {
    expect(resolveGatewayChoice({ stripe: false, tap: false, paymob: false })).toEqual({
      kind: "none",
    });
  });

  it("exactly one gateway → direct, use that gateway", () => {
    expect(resolveGatewayChoice({ stripe: false, tap: true, paymob: false })).toEqual({
      kind: "direct",
      gateway: "tap",
    });
    expect(resolveGatewayChoice({ stripe: false, tap: false, paymob: true })).toEqual({
      kind: "direct",
      gateway: "paymob",
    });
  });

  it("two or more gateways → show the picker", () => {
    expect(resolveGatewayChoice({ stripe: true, tap: true, paymob: false }).kind).toBe("picker");
    expect(resolveGatewayChoice({ stripe: true, tap: true, paymob: true }).kind).toBe("picker");
  });
});
