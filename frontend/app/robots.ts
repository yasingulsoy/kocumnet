import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  let host: string | undefined;
  try {
    const hostname = new URL(base).hostname;
    if (hostname && hostname !== "localhost") {
      host = hostname;
    }
  } catch {
    host = undefined;
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    ...(host ? { host } : {}),
    sitemap: `${base}/sitemap.xml`,
  };
}
