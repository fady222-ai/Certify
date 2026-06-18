import { describe, it, expect } from "vitest";
import { resolveGatewayChoice } from "./billing";

// Guards the checkout entry point shared by /pricing and /dashboard/billing:
// when to show the gateway picker vs. go straight to checkout. Picking an
// unconfigured gateway would fail at the backend, so this rule matters.
describe("resolveGatewayChoice", () => {
  it("no gateways configured → still open the picker (lists all as غير مفعّلة)", () => {
    expect(resolveGatewayChoice({ stripe: false, tap: false, paymob: false })).toEqual({
      showPicker: true,
      gateway: "stripe",
    });
  });

  it("exactly one gateway → skip picker, use that gateway", () => {
    expect(resolveGatewayChoice({ stripe: false, tap: true, paymob: false })).toEqual({
      showPicker: false,
      gateway: "tap",
    });
    expect(resolveGatewayChoice({ stripe: false, tap: false, paymob: true })).toEqual({
      showPicker: false,
      gateway: "paymob",
    });
  });

  it("two or more gateways → show the picker", () => {
    expect(resolveGatewayChoice({ stripe: true, tap: true, paymob: false }).showPicker).toBe(true);
    expect(resolveGatewayChoice({ stripe: true, tap: true, paymob: true }).showPicker).toBe(true);
  });
});
