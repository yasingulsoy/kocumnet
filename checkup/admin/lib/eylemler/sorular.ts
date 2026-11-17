"use server";

import { refresh } from "next/cache";
import { sorgu } from "../bicim";
import { cagir, gecersiz, kimlik, metin } from "../eylem";
import { HARFLER, type IslemSonucu, type Sayfali, type SoruAyrintisi, type SoruOzeti, type SoruYuku } from "../tipler";

/**
 * Soru işlemleri. Soru formu durumunu istemcide tutar ve bu eylemleri elle
 * çağırır (`await soruKaydet(...)`), form action olarak değil: React 19 form
 * eylemi bitince formu sıfırlıyor, doğrulama hatası alan kullanıcı
 * seçimlerini kaybediyordu.
 */

/** Formül önizlemesi: backend KaTeX ile HTML üretir. Hata `mesaj`da. */
export async function onizle(metinDegeri: string): Promise<IslemSonucu<{ html: string }>> {
  const m = metin(metinDegeri, 20_000);
  if (!m.trim()) return { ok: true, veri: { html: "" } };
  return cagir<{ html: string }>("/admin/onizleme", { method: "POST", govde: { metin: m } });
}

function temizle(y: SoruYuku): Record<string, unknown> | null {
  const g: Record<string, unknown> = {};
  for (const alan of ["sinavId", "dersId", "konuId", "kazanimId", "altKazanimId"] as const) {
    if (y[alan] === undefined) continue;
    const k = kimlik(y[alan]);
    if (!k) return null;
    g[alan] = k;
  }
  if (y.metin !== undefined) g.metin = metin(y.metin);
  if (y.cozum !== undefined) g.cozum = metin(y.cozum);
  if (y.gorselId !== undefined) {
    if (y.gorselId !== null && (typeof y.gorselId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(y.gorselId))) return null;
    g.gorselId = y.gorselId;
  }
  if (y.zorluk !== undefined) {
    if (y.zorluk !== null && !(Number.isInteger(y.zorluk) && y.zorluk >= 1 && y.zorluk <= 5)) return null;
    g.zorluk = y.zorluk;
  }
  if (y.aktif !== undefined) g.aktif = y.aktif === true;
  if (y.siklar !== undefined) {
    if (!Array.isArray(y.siklar) || y.siklar.length !== 5) return null;
    g.siklar = y.siklar.map((s) => {
      const sik: Record<string, unknown> = { metin: metin(s?.metin, 5000) };
      if (s?.aciklama !== undefined) sik.aciklama = s.aciklama === null ? null : metin(s.aciklama, 5000);
      return sik;
    });
  }
  if (y.dogruSik !== undefined) {
    if (!HARFLER.includes(y.dogruSik)) return null;
    g.dogruSik = y.dogruSik;
  }
  return g;
}

export async function soruOlustur(y: SoruYuku): Promise<IslemSonucu<{ id: number }>> {
  const g = temizle(y);
  if (!g) return gecersiz();
  return cagir<{ id: number }>("/admin/sorular", { method: "POST", govde: g });
}

export async function soruGuncelle(id: number, y: SoruYuku): Promise<IslemSonucu<SoruAyrintisi>> {
  const k = kimlik(id);
  const g = temizle(y);
  if (!k || !g) return gecersiz();
  return cagir<SoruAyrintisi>(`/admin/sorular/${k}`, { method: "PATCH", govde: g });
}

export async function soruAktifligi(id: number, aktif: boolean): Promise<IslemSonucu<SoruAyrintisi>> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  const s = await cagir<SoruAyrintisi>(`/admin/sorular/${k}`, { method: "PATCH", govde: { aktif: aktif === true } });
  if (s.ok) refresh();
  return s;
}

export async function soruSil(id: number): Promise<IslemSonucu> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  return cagir(`/admin/sorular/${k}`, { method: "DELETE" });
}

/** Sabit liste paneli için soru araması (okuma). */
export async function soruAra(f: {
  sinavId: number;
  dersId?: number | null;
  konuId?: number | null;
  ara?: string;
  aktif?: boolean | null;
  sayfa?: number;
}): Promise<IslemSonucu<Sayfali<SoruOzeti>>> {
  const sinavId = kimlik(f.sinavId);
  if (!sinavId) return gecersiz();
  const q = sorgu({
    sinavId,
    dersId: kimlik(f.dersId),
    konuId: kimlik(f.konuId),
    ara: metin(f.ara, 200).trim(),
    aktif: typeof f.aktif === "boolean" ? String(f.aktif) : null,
    sayfa: kimlik(f.sayfa) ?? 1,
    boyut: 20,
  });
  return cagir<Sayfali<SoruOzeti>>(`/admin/sorular${q}`);
}
