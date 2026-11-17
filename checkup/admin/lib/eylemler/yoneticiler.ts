"use server";

import { refresh } from "next/cache";
import { cagir, gecersiz, kimlik, metin } from "../eylem";
import type { IslemSonucu, Rol, Yonetici } from "../tipler";

/** Yönetici hesapları (backend'de yalnızca YONETICI). */

function rol(v: unknown): Rol | null {
  return v === "YONETICI" || v === "EDITOR" ? v : null;
}

export async function yoneticiEkle(g: { adSoyad: string; eposta: string; parola: string; rol: Rol }): Promise<IslemSonucu<Yonetici>> {
  const r = rol(g?.rol);
  if (!r) return gecersiz("Rol seçin.");
  const s = await cagir<Yonetici>("/admin/yoneticiler", {
    method: "POST",
    govde: { adSoyad: metin(g.adSoyad, 200).trim(), eposta: metin(g.eposta, 320).trim(), parola: metin(g.parola, 1000), rol: r },
  });
  if (s.ok) refresh();
  return s;
}

export async function yoneticiGuncelle(
  id: number,
  g: { adSoyad?: string; rol?: Rol; aktif?: boolean; parola?: string }
): Promise<IslemSonucu<Yonetici>> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  const govde: Record<string, unknown> = {};
  if (g.adSoyad !== undefined) govde.adSoyad = metin(g.adSoyad, 200).trim();
  if (g.rol !== undefined) {
    const r = rol(g.rol);
    if (!r) return gecersiz("Rol seçin.");
    govde.rol = r;
  }
  if (g.aktif !== undefined) govde.aktif = g.aktif === true;
  if (g.parola !== undefined) govde.parola = metin(g.parola, 1000);
  const s = await cagir<Yonetici>(`/admin/yoneticiler/${k}`, { method: "PATCH", govde });
  if (s.ok) refresh();
  return s;
}

export async function yoneticiSil(id: number): Promise<IslemSonucu> {
  const k = kimlik(id);
  if (!k) return gecersiz();
  const s = await cagir(`/admin/yoneticiler/${k}`, { method: "DELETE" });
  if (s.ok) refresh();
  return s;
}
