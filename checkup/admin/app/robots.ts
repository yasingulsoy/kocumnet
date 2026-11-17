import type { MetadataRoute } from "next";

/** Panel arama motorlarına tamamen kapalı. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
