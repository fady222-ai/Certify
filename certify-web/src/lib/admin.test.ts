import { describe, it, expect } from "vitest";
import { gatewayStatus, type PaymentGateway } from "./admin";

// Builds a gateway with a single required field whose `set`/`enabled` we vary.
function gw(opts: { enabled: boolean; keySet: boolean }): PaymentGateway {
  return {
    gateway: "stripe",
    label: "Stripe",
    region: "عالمي",
    enabled: opts.enabled,
    available: opts.enabled && opts.keySet,
    source: "db",
    fields: [
      { key: "secretKey", label: "Secret Key", secret: true, required: true, set: opts.keySet, preview: null },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, required: false, set: false, preview: null },
    ],
  };
}

describe("gatewayStatus", () => {
  it("needs_setup when a required key is missing (regardless of enabled)", () => {
    expect(gatewayStatus(gw({ enabled: true, keySet: false }))).toBe("needs_setup");
    expect(gatewayStatus(gw({ enabled: false, keySet: false }))).toBe("needs_setup");
  });

  it("live when keys complete and enabled", () => {
    expect(gatewayStatus(gw({ enabled: true, keySet: true }))).toBe("live");
  });

  it("off when keys complete but disabled", () => {
    expect(gatewayStatus(gw({ enabled: false, keySet: true }))).toBe("off");
  });
});
