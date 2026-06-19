import { ImageResponse } from "next/og";

// Static social share card. Kept Latin-only so it renders crisply with the
// built-in font (loading an Arabic webfont here is fragile at build/runtime).
export const alt = "Certify — Digital Certificates Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -2 }}>Certify</div>
        <div style={{ marginTop: 16, fontSize: 40, opacity: 0.95 }}>
          Issue verifiable digital certificates in one click
        </div>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            background: "rgba(255,255,255,0.15)",
            padding: "12px 28px",
            borderRadius: 999,
          }}
        >
          Tamper-evident | QR verification | LinkedIn-ready
        </div>
      </div>
    ),
    size,
  );
}
