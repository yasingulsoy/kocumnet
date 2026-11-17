"use server";

import { refresh } from "next/cache";
import { cagir, gecersiz, kimlik, metin } from "../eylem";
import type { IslemSonucu, Sinav, SinavFormu, Tur, TurFormu } from "../tipler";

/**
 * Sınav ve tür ekleme/düzenleme/silme (backend'de yalnızca YONETICI).
 * Eklemede bütün alanlar, düzenlemede yalnızca değişenler gelir (istemci
 * farkı çıkarır). Boş açıklama eklemede hiç gönderilmez, düzenlemede null.
 */

function tamSayi(v: unknown): number | undefined {
  const n = Number(v);
  return v === undefined || v === null || !Number.isFinite(n) ? undefined : Math.trunc(n);
}

function aciklama(v: unknown, yeni: boolean): string | null | undefined {
  if (v === undefined) return undefined;
  const s = metin(v, 2000).trim();
  return s ? s : yeni ? undefined : null;
}

function govdeYap(f: Partial<SinavFormu & TurFormu>, yeni: boolean, alanlar: readonly string[]) {
  const g: Record<string, unknown> = {};
  for (const a of alanlar) {
    const v = f[a as keyof typeof f];
    if (v === undefined) continue;
    if (a === "ad") g.ad = metin(v, 200).trim();
    else if (a === "aciklama") {
      const x = aciklama(v, yeni);
      if (x !== undefined) g.aciklama = x;
    } else if (a === "aktif") g.aktif = v === true;
    else {
      const n = tamSayi(v);
      if (n !== undefined) g[a] = n;
    }
  }
  return g;
}

const SINAV_ALANLARI = ["ad", "aciklama", "ucretKurus", "yanlisGoturme", "aktif", "sira"] as const;
const TUR_ALANLARI = ["ad", "aciklama", "soruSayisi", "sureDakika", "aktif", "sira"] as const;

export async function sinavKaydet(id: number | null, f: Partial<SinavFormu>): Promise<IslemSonucu<Sinav>> {
  const govde = govdeYap(f, id === null, SINAV_ALANLARI);
  let s: IslemSonucu<Sinav>;
  if (id === null) {
    s = await cagir<Sinav>("/admin/sinavlar", { method: "POST", govde });
  } else {
    const k = kimlik(id);
    if (!k) return gecersiz();
    s = await cagir<Sinav>(`/admin/sinavlar/${k}`, { method: "PATCH", govde });
  }
  if (s.ok) refresh();
  return s;
}

export async function sinavSil(id: number): Promise<IslemSonucu> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  const s = await cagir(`/admin/sinavlar/${k}`, { method: "DELETE" });
  if (s.ok) refresh();
  return s;
}

export async function turKaydet(id: number | null, f: Partial<TurFormu>): Promise<IslemSonucu<Tur>> {
  const govde = govdeYap(f, id === null, TUR_ALANLARI);
  let s: IslemSonucu<Tur>;
  if (id === null) {
    s = await cagir<Tur>("/admin/turler", { method: "POST", govde });
  } else {
    const k = kimlik(id);
    if (!k) return gecersiz();
    s = await cagir<Tur>(`/admin/turler/${k}`, { method: "PATCH", govde });
  }
  if (s.ok) refresh();
  return s;
}

export async function turSil(id: number): Promise<IslemSonucu> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  const s = await cagir(`/admin/turler/${k}`, { method: "DELETE" });
  if (s.ok) refresh();
  return s;
}
