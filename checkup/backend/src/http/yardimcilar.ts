import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { ApiHata, alanHatasi, bulunamadi } from "../lib/hatalar.js";

// Zod'un varsayılan mesajları Türkçe; şemalarda çoğu alana ayrıca kendi cümlemiz var.
z.config(z.locales.tr());

/** zod hatasını DOGRULAMA'ya çevirir: alan yolu "siklar.2.metin" biçiminde. */
export function zodHatasi(hata: z.ZodError): ApiHata {
  const alanlar: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const yol = sorun.path.map(String).join(".") || "govde";
    if (!(yol in alanlar)) alanlar[yol] = sorun.message;
  }
  return alanHatasi(alanlar);
}

export function dogrula<T extends z.ZodType>(sema: T, veri: unknown): z.output<T> {
  const sonuc = sema.safeParse(veri ?? {});
  if (!sonuc.success) throw zodHatasi(sonuc.error);
  return sonuc.data;
}

/** URL'deki kimlik: pozitif tamsayı değilse kayıt yok sayılır. */
export function kimlik(deger: unknown, mesaj?: string): number {
  const metin = String(deger ?? "");
  if (!/^\d{1,10}$/.test(metin)) throw bulunamadi(mesaj);
  const n = Number(metin);
  if (n < 1 || n > 2_147_483_647) throw bulunamadi(mesaj);
  return n;
}

export interface Sayfalama {
  sayfa: number;
  boyut: number;
  atla: number;
}

export function sayfalama(sorgu: Record<string, unknown>): Sayfalama {
  const sayfaHam = Number(sorgu.sayfa ?? 1);
  const boyutHam = Number(sorgu.boyut ?? 50);
  const sayfa = Number.isInteger(sayfaHam) && sayfaHam >= 1 ? sayfaHam : 1;
  const boyut = Number.isInteger(boyutHam) && boyutHam >= 1 ? Math.min(boyutHam, 200) : 50;
  return { sayfa, boyut, atla: (sayfa - 1) * boyut };
}

export function sayfaliYanit<T>(kayitlar: T[], toplam: number, s: Sayfalama) {
  return { kayitlar, toplam, sayfa: s.sayfa, boyut: s.boyut };
}

/** Sorgu metni (tek değer) ya da undefined. */
export function sorguMetni(deger: unknown): string | undefined {
  if (Array.isArray(deger)) deger = deger[0];
  if (typeof deger !== "string") return undefined;
  const t = deger.trim();
  return t ? t : undefined;
}

export function sorguKimligi(deger: unknown, alan: string): number | undefined {
  const t = sorguMetni(deger);
  if (t === undefined) return undefined;
  if (!/^\d{1,10}$/.test(t) || Number(t) < 1 || Number(t) > 2_147_483_647) throw alanHatasi({ [alan]: "Geçerli bir kimlik olmalı." });
  return Number(t);
}

/**
 * Prisma'nın bilinen hatalarını API hatalarına çevirir; değilse null.
 *   P2002 benzersizlik → CAKISMA
 *   P2003 yabancı anahtar (Restrict) → KULLANIMDA
 *   P2025 kayıt yok → BULUNAMADI
 */
export function prismaHatasiCevir(e: unknown, mesajlar: { cakisma?: string; kullanimda?: string; bulunamadi?: string } = {}): ApiHata | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (e.code) {
    case "P2002":
      return new ApiHata("CAKISMA", mesajlar.cakisma ?? "Bu bilgilerle bir kayıt zaten var.");
    case "P2003":
      return new ApiHata("KULLANIMDA", mesajlar.kullanimda ?? "Bu kayıt başka kayıtlarda kullanılıyor; silinemez. Pasif yapın.");
    case "P2025":
      return bulunamadi(mesajlar.bulunamadi);
    default:
      return null;
  }
}

/** Prisma hatasını çevirerek fırlatır; çevrilemeyen hata olduğu gibi fırlar. */
export async function prismaIle<T>(is: () => Promise<T>, mesajlar?: Parameters<typeof prismaHatasiCevir>[1]): Promise<T> {
  try {
    return await is();
  } catch (e) {
    throw prismaHatasiCevir(e, mesajlar) ?? e;
  }
}

// ─── Ortak zod parçaları ──────────────────────────────────────

export const epostaSemasi = z
  .string({ error: "E-posta yazın." })
  .trim()
  .toLowerCase()
  .max(254, { error: "E-posta en fazla 254 karakter olabilir." })
  .pipe(z.email({ error: "Geçerli bir e-posta yazın." }));

export const parolaSemasi = z
  .string({ error: "Parola yazın." })
  .min(8, { error: "Parola en az 8 karakter olmalı." })
  .max(200, { error: "Parola en fazla 200 karakter olabilir." });

export const adSoyadSemasi = z
  .string({ error: "Ad soyad yazın." })
  .trim()
  .min(2, { error: "Ad soyad en az 2 karakter olmalı." })
  .max(80, { error: "Ad soyad en fazla 80 karakter olabilir." });

export const kimlikSemasi = (alan: string) =>
  z
    .number({ error: `${alan} sayı olmalı.` })
    .int({ error: `${alan} tamsayı olmalı.` })
    .positive({ error: `${alan} geçerli bir kimlik olmalı.` })
    .max(2_147_483_647, { error: `${alan} geçerli bir kimlik olmalı.` });
