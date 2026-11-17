"use server";

import { refresh } from "next/cache";
import { cagir, gecersiz, kimlik, metin, seviye } from "../eylem";
import type { Agac, IslemSonucu } from "../tipler";

/** Konu ağacı: okuma (soru formu sınav değiştirince) ve düğüm işlemleri. */

export async function agacGetir(sinavId: number): Promise<IslemSonucu<Agac>> {
  const k = kimlik(sinavId);
  if (!k) return gecersiz();
  return cagir<Agac>(`/admin/sinavlar/${k}/agac`);
}

export async function dugumEkle(sev: string, ustId: number, ad: string, kod?: string): Promise<IslemSonucu> {
  const s = seviye(sev);
  const u = kimlik(ustId);
  if (!s || !u) return gecersiz();
  const govde: { ustId: number; ad: string; kod?: string } = { ustId: u, ad: metin(ad, 300).trim() };
  const k = metin(kod, 60).trim();
  if ((s === "kazanimlar" || s === "alt-kazanimlar") && k) govde.kod = k;
  const r = await cagir(`/admin/agac/${s}`, { method: "POST", govde });
  if (r.ok) refresh();
  return r;
}

export async function dugumTopluEkle(sev: string, ustId: number, satirlar: string[]): Promise<IslemSonucu<{ eklenen: number }>> {
  const s = seviye(sev);
  const u = kimlik(ustId);
  if (!s || !u || !Array.isArray(satirlar)) return gecersiz();
  const temiz = satirlar.map((x) => metin(x, 400)).slice(0, 2000);
  const r = await cagir<{ eklenen: number }>(`/admin/agac/${s}/toplu`, { method: "POST", govde: { ustId: u, satirlar: temiz } });
  if (r.ok) refresh();
  return r;
}

export async function dugumGuncelle(sev: string, id: number, ad: string, kod?: string | null): Promise<IslemSonucu> {
  const s = seviye(sev);
  const k = kimlik(id);
  if (!s || !k) return gecersiz();
  const govde: { ad: string; kod?: string | null } = { ad: metin(ad, 300).trim() };
  if (s === "kazanimlar" || s === "alt-kazanimlar") govde.kod = metin(kod, 60).trim() || null;
  const r = await cagir(`/admin/agac/${s}/${k}`, { method: "PATCH", govde });
  if (r.ok) refresh();
  return r;
}

export async function dugumTasi(sev: string, id: number, yon: "yukari" | "asagi"): Promise<IslemSonucu> {
  const s = seviye(sev);
  const k = kimlik(id);
  if (!s || !k || (yon !== "yukari" && yon !== "asagi")) return gecersiz();
  const r = await cagir(`/admin/agac/${s}/${k}/tasi`, { method: "POST", govde: { yon } });
  if (r.ok) refresh();
  return r;
}

export async function dugumSil(sev: string, id: number): Promise<IslemSonucu> {
  const s = seviye(sev);
  const k = kimlik(id);
  if (!s || !k) return gecersiz();
  const r = await cagir(`/admin/agac/${s}/${k}`, { method: "DELETE" });
  if (r.ok) refresh();
  return r;
}
