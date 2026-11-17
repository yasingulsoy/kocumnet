import type { Agac, DersDugumu, KazanimDugumu, KonuDugumu } from "./tipler";

/** Konu ağacından zincirleme seçim listeleri (soru formu, süzgeçler, reçete). */

export interface Secenek {
  value: string;
  label: string;
}

export function dersBul(agac: Agac | null, dersId: number | null): DersDugumu | undefined {
  return dersId ? agac?.dersler.find((d) => d.id === dersId) : undefined;
}

export function konuBul(ders: DersDugumu | undefined, konuId: number | null): KonuDugumu | undefined {
  return konuId ? ders?.konular.find((k) => k.id === konuId) : undefined;
}

export function kazanimBul(konu: KonuDugumu | undefined, kazanimId: number | null): KazanimDugumu | undefined {
  return kazanimId ? konu?.kazanimlar.find((k) => k.id === kazanimId) : undefined;
}

export function kodluAd(d: { kod?: string | null; ad: string }): string {
  return d.kod ? `${d.kod} · ${d.ad}` : d.ad;
}

/** Seçili kimlikler ağaca göre tutarlı mı: üst değişmişse altlar düşer. */
export function zinciriDuzelt(
  agac: Agac | null,
  s: { dersId: number | null; konuId: number | null; kazanimId: number | null; altKazanimId: number | null }
) {
  const ders = dersBul(agac, s.dersId);
  const konu = konuBul(ders, ders ? s.konuId : null);
  const kazanim = kazanimBul(konu, konu ? s.kazanimId : null);
  const alt = kazanim && s.altKazanimId ? kazanim.altKazanimlar.find((a) => a.id === s.altKazanimId) : undefined;
  return { dersId: ders?.id ?? null, konuId: konu?.id ?? null, kazanimId: kazanim?.id ?? null, altKazanimId: alt?.id ?? null };
}

export function secenekler(agac: Agac | null, s: { dersId: number | null; konuId: number | null; kazanimId: number | null }) {
  const ders = dersBul(agac, s.dersId);
  const konu = konuBul(ders, s.konuId);
  const kazanim = kazanimBul(konu, s.kazanimId);
  return {
    dersler: (agac?.dersler ?? []).map((d) => ({ value: String(d.id), label: d.ad })),
    konular: (ders?.konular ?? []).map((k) => ({ value: String(k.id), label: k.ad })),
    kazanimlar: (konu?.kazanimlar ?? []).map((k) => ({ value: String(k.id), label: kodluAd(k) })),
    altKazanimlar: (kazanim?.altKazanimlar ?? []).map((a) => ({ value: String(a.id), label: kodluAd(a) })),
  };
}

export function sayiyaCevir(v: string): number | null {
  const n = Number(v);
  return v && Number.isSafeInteger(n) && n > 0 ? n : null;
}
