import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * AI arama motoru crawler'ları BİLEREK isim isim listelendi.
 *
 * "User-agent: *" teknik olarak zaten hepsine izin verir; ama açıkça yazmak
 * ileride biri genel kuralı daraltırsa AI botlarının kazara engellenmesini
 * önler ve niyeti belgeler.
 *
 * Kritik ayrım: GPTBot model EĞİTİMİ için tarar, OAI-SearchBot ise ChatGPT'nin
 * ARAMA özelliği için tarar. ChatGPT yanıtlarında kaynak olarak gösterilmek
 * (atıf almak) istiyorsak OAI-SearchBot izni şart. Aynı ayrım Anthropic'te
 * ClaudeBot (eğitim) ile Claude-Web/Claude-SearchBot (arama) arasında da var.
 *
 * Şu an hepsine izin veriliyor. Eğitime veri vermek istemezsen GPTBot,
 * ClaudeBot, anthropic-ai ve CCBot'u Disallow yapıp arama botlarını açık
 * bırakabiliriz — atıf almaya devam ederiz.
 */
const AI_SEARCH_BOTS = [
  "OAI-SearchBot", // ChatGPT arama — atıf için kritik
  "ChatGPT-User", // ChatGPT kullanıcı isteğiyle sayfayı çeker
  "Claude-Web", // Claude arama
  "Claude-SearchBot",
  "PerplexityBot", // Perplexity indeksleme
  "Perplexity-User", // Perplexity kullanıcı isteğiyle çeker
  "Google-Extended", // Gemini / AI Overviews
  "Applebot-Extended",
];

const AI_TRAINING_BOTS = [
  "GPTBot", // OpenAI eğitim
  "ClaudeBot", // Anthropic eğitim
  "anthropic-ai",
  "CCBot", // Common Crawl — pek çok modelin eğitim kaynağı
  "Bytespider",
  "cohere-ai",
];

const CLASSIC_BOTS = ["Googlebot", "Bingbot", "Applebot"];

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

  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/" },
    ...[...CLASSIC_BOTS, ...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS].map((userAgent) => ({
      userAgent,
      allow: "/",
    })),
  ];

  return {
    rules,
    ...(host ? { host } : {}),
    sitemap: `${base}/sitemap.xml`,
  };
}
