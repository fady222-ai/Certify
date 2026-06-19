import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://certify.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private app areas — no value in indexing, and they require auth anyway.
      disallow: ["/dashboard", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
