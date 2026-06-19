import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Certify — منصة الشهادات الرقمية",
    short_name: "Certify",
    description: "أصدر شهادات رقمية احترافية قابلة للتحقق بنقرة واحدة.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    lang: "ar",
    dir: "rtl",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
