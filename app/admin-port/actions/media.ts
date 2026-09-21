"use server";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { OutputInfo } from "sharp";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export interface UploadResult {
  ok: boolean;
  mediaId?: string;
  alt?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * SVG KABUL EDİLMİYOR.
 *
 * Geometri şekli için vektör ideal olurdu ama SVG bir XML belgesidir: script
 * ve harici referans taşıyabilir. Aynı kökenden servis edilen bir SVG'yi
 * doğrudan açmak script çalıştırır. Şekiller raster olarak da yeterli;
 * bu riski taşımaya değmez.
 */
const KABUL_EDILEN = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Ham dosya sınırı. next.config.ts'teki gövde sınırı bunun üstünde olmalı. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Soru gövdesinde bundan geniş gösterilmiyor; büyüğünü saklamak boşa yer. */
const MAX_WIDTH = 1200;

export async function uploadMediaAction(formData: FormData): Promise<UploadResult> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  const alt = String(formData.get("alt") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Dosya seçilmedi." };
  }
  if (!alt) {
    // Ekran okuyucu kullanan öğrenci şekli göremez; alt metni olmayan soru
    // erişilemez olur. Sonradan eklenmesini beklemek yerine zorunlu tutuyoruz.
    return { ok: false, error: "Alt metni zorunlu — şekli kısaca tarif edin." };
  }
  if (!KABUL_EDILEN.includes(file.type)) {
    return { ok: false, error: "Yalnızca PNG, JPEG, WebP veya GIF yüklenebilir." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Dosya çok büyük (${Math.round(file.size / 1024 / 1024)} MB). En fazla 8 MB.`,
    };
  }

  const girdi = Buffer.from(await file.arrayBuffer());

  let webp: Buffer;
  let meta: OutputInfo;
  try {
    const sonuc = await sharp(girdi)
      // Telefondan gelen fotoğraflarda yön bilgisi EXIF'te durur; döndürmezsek
      // şekil yan yatar.
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    webp = sonuc.data;
    meta = sonuc.info;
  } catch {
    // Uzantısı doğru ama içeriği bozuk/sahte dosyalar buraya düşer.
    return { ok: false, error: "Görsel okunamadı. Dosya bozuk olabilir." };
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      storageKey: randomBytes(16).toString("hex"),
      mimeType: "image/webp",
      width: meta.width,
      height: meta.height,
      byteSize: webp.byteLength,
      // Prisma 7 Bytes alanı Uint8Array bekliyor; Node Buffer'ı doğrudan kabul
      // etmiyor (ArrayBufferLike vs ArrayBuffer).
      data: new Uint8Array(webp),
      alt,
      uploadedById: admin.id,
    },
    select: { id: true, width: true, height: true },
  });

  return {
    ok: true,
    mediaId: asset.id,
    alt,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  };
}
