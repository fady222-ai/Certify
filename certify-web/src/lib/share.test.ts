import { describe, it, expect } from "vitest";
import { whatsappShareUrl, twitterShareUrl, shareText } from "./share";

describe("whatsappShareUrl", () => {
  it("targets a contact when a valid phone is given (digits only)", () => {
    const url = whatsappShareUrl({ text: "مرحبا", url: "https://x.io/v/AB", phone: "+966 50 123 4567" });
    expect(url.startsWith("https://wa.me/966501234567?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("مرحبا\nhttps://x.io/v/AB"));
  });

  it("falls back to the generic share sheet without a phone", () => {
    const url = whatsappShareUrl({ text: "hi", url: "https://x.io/v/AB" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("ignores too-short / junk phone values", () => {
    expect(whatsappShareUrl({ text: "t", url: "u", phone: "12" }).startsWith("https://wa.me/?")).toBe(true);
    expect(whatsappShareUrl({ text: "t", url: "u", phone: null }).startsWith("https://wa.me/?")).toBe(true);
  });
});

describe("twitterShareUrl", () => {
  it("encodes text and url as intent params", () => {
    const url = twitterShareUrl({ text: "شهادة", url: "https://x.io/v/AB" });
    expect(url.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("text")).toBe("شهادة");
    expect(q.get("url")).toBe("https://x.io/v/AB");
  });
});

describe("shareText", () => {
  it("includes recipient, course and org when present", () => {
    const t = shareText({ recipientName: "أحمد", courseName: "الأمن", orgName: "أكاديمية" });
    expect(t).toContain("أحمد");
    expect(t).toContain("الأمن");
    expect(t).toContain("أكاديمية");
  });

  it("degrades gracefully when fields are missing", () => {
    expect(shareText({}).length).toBeGreaterThan(0);
    expect(shareText({ courseName: "دورة" })).toContain("دورة");
  });
});
