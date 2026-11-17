import { icerikHatasi, icerikHtml } from "../lib/icerik.js";
import { harfSirasi, HARFLER, siklariDenetle, type SikGirdisi } from "../lib/siklar.js";
import type { Db } from "./ayarlar.js";

/**
 * Soru kuralları: elle girişte (admin) ve Excel içe aktarmada aynı fonksiyonlar.
 */

export interface ZincirKimlikleri {
  sinavId: number;
  dersId: number;
  konuId: number;
  kazanimId: number;
  altKazanimId: number;
}

/**
 * Sınav → ders → konu → kazanım → alt kazanım zinciri birbirine ait mi?
 * (Veritabanı da bileşik yabancı anahtarlarla zorunlu tutar; burası
 * kullanıcıya Türkçe ve alan bazında söylemek için.)
 */
export async function zincirDenetle(db: Db, z: ZincirKimlikleri): Promise<Record<string, string>> {
  const [sinav, ders, konu, kazanim, alt] = await Promise.all([
    db.sinav.findUnique({ where: { id: z.sinavId }, select: { id: true } }),
    db.ders.findUnique({ where: { id: z.dersId }, select: { sinavId: true } }),
    db.konu.findUnique({ where: { id: z.konuId }, select: { dersId: true } }),
    db.kazanim.findUnique({ where: { id: z.kazanimId }, select: { konuId: true } }),
    db.altKazanim.findUnique({ where: { id: z.altKazanimId }, select: { kazanimId: true } }),
  ]);
  const h: Record<string, string> = {};
  if (!sinav) h.sinavId = "Sınav bulunamadı.";
  if (!ders) h.dersId = "Ders bulunamadı.";
  else if (ders.sinavId !== z.sinavId) h.dersId = "Ders bu sınava ait değil.";
  if (!konu) h.konuId = "Konu bulunamadı.";
  else if (konu.dersId !== z.dersId) h.konuId = "Konu bu derse ait değil.";
  if (!kazanim) h.kazanimId = "Kazanım bulunamadı.";
  else if (kazanim.konuId !== z.konuId) h.kazanimId = "Kazanım bu konuya ait değil.";
  if (!alt) h.altKazanimId = "Alt kazanım bulunamadı.";
  else if (alt.kazanimId !== z.kazanimId) h.altKazanimId = "Alt kazanım bu kazanıma ait değil.";
  return h;
}

/** Metin ve çözüm: boş değil, formüller derleniyor. */
export function metinDenetle(alan: "metin" | "cozum", deger: string | undefined, h: Record<string, string>): void {
  if (deger === undefined) return;
  const ad = alan === "metin" ? "Soru metni" : "Çözüm";
  if (!deger.trim()) {
    h[alan] = `${ad} boş olamaz.`;
    return;
  }
  const sorun = icerikHatasi(deger);
  if (sorun) h[alan] = `${ad}: ${sorun}`;
}

export function zorlukDenetle(zorluk: number | null | undefined, h: Record<string, string>): void {
  if (zorluk === null || zorluk === undefined) return;
  if (!Number.isInteger(zorluk) || zorluk < 1 || zorluk > 5) h.zorluk = "Zorluk 1 ile 5 arasında olmalı.";
}

export interface HazirSik {
  sira: number;
  metin: string;
  metinHtml: string;
  aciklama: string | null;
  dogru: boolean;
}

/** Doğrulanmış şıkları kayda hazırlar (HTML üretilir). Önce siklariDenetle çağrılmış olmalı. */
export function siklariHazirla(siklar: SikGirdisi[], dogruSik: string): HazirSik[] {
  const dogruSira = harfSirasi(dogruSik);
  return siklar.map((s, i) => ({
    sira: i,
    metin: s.metin,
    metinHtml: icerikHtml(s.metin),
    aciklama: s.aciklama?.trim() ? s.aciklama : null,
    dogru: i === dogruSira,
  }));
}

export { siklariDenetle, HARFLER };

/** Admin soru ayrıntısı (checkup/API.md "Sorular"). */
export async function soruAyrintisi(db: Db, id: number) {
  const s = await db.soru.findUnique({
    where: { id },
    select: {
      id: true,
      sinavId: true,
      dersId: true,
      konuId: true,
      kazanimId: true,
      altKazanimId: true,
      metin: true,
      metinHtml: true,
      gorselId: true,
      cozum: true,
      cozumHtml: true,
      zorluk: true,
      aktif: true,
      olusturuldu: true,
      guncellendi: true,
      siklar: { orderBy: { sira: "asc" }, select: { sira: true, metin: true, metinHtml: true, dogru: true, aciklama: true } },
      _count: { select: { checkupSorulari: true, sabitListeler: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    sinavId: s.sinavId,
    dersId: s.dersId,
    konuId: s.konuId,
    kazanimId: s.kazanimId,
    altKazanimId: s.altKazanimId,
    metin: s.metin,
    metinHtml: s.metinHtml,
    gorselId: s.gorselId,
    cozum: s.cozum,
    cozumHtml: s.cozumHtml,
    zorluk: s.zorluk,
    aktif: s.aktif,
    siklar: s.siklar.map((k) => ({ sira: k.sira, harf: HARFLER[k.sira] ?? "?", metin: k.metin, metinHtml: k.metinHtml, dogru: k.dogru, aciklama: k.aciklama })),
    kullanimSayisi: s._count.checkupSorulari,
    sabitListeSayisi: s._count.sabitListeler,
    olusturuldu: s.olusturuldu,
    guncellendi: s.guncellendi,
  };
}

/** Tekrar denetimi anahtarı: kenar ve iç boşluklar sadeleşmiş, Türkçe küçük harf. */
export function metinAnahtari(metin: string): string {
  return metin.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}
