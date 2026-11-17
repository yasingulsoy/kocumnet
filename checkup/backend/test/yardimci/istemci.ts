import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { TestOrtami } from "./ortam.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Yanit {
  durum: number;
  govde: any;
  basliklar: Headers;
  baytlar?: Buffer;
}

export interface IstekSecenegi {
  govde?: unknown;
  jeton?: string;
  anahtar?: string | null; // null: başlık hiç gönderilmez
  ip?: string;
  form?: FormData;
  ikili?: boolean;
}

let ipSayaci = 0;
/** Her çağrıda farklı bir istemci IP'si (hız sınırları testleri birbirine karışmasın). */
export function yeniIp(): string {
  ipSayaci += 1;
  return `10.${(ipSayaci >> 16) & 255}.${(ipSayaci >> 8) & 255}.${ipSayaci & 255}`;
}

export function istemci(o: () => TestOrtami) {
  async function istek(yontem: string, yol: string, s: IstekSecenegi = {}): Promise<Yanit> {
    const basliklar: Record<string, string> = {};
    if (s.anahtar !== null) basliklar["x-servis-anahtari"] = s.anahtar ?? o().anahtar;
    basliklar["x-istemci-ip"] = s.ip ?? yeniIp();
    if (s.jeton) basliklar["authorization"] = `Bearer ${s.jeton}`;
    let body: RequestInit["body"];
    if (s.form) body = s.form;
    else if (s.govde !== undefined) {
      basliklar["content-type"] = "application/json";
      body = JSON.stringify(s.govde);
    }
    const r = await fetch(o().url + yol, { method: yontem, headers: basliklar, body });
    if (s.ikili) {
      const baytlar = Buffer.from(await r.arrayBuffer());
      return { durum: r.status, govde: null, basliklar: r.headers, baytlar };
    }
    const metin = await r.text();
    let govde: any = null;
    if (metin) {
      try {
        govde = JSON.parse(metin);
      } catch {
        govde = metin;
      }
    }
    return { durum: r.status, govde, basliklar: r.headers };
  }
  return {
    istek,
    get: (yol: string, s?: IstekSecenegi) => istek("GET", yol, s),
    post: (yol: string, govde?: unknown, s?: IstekSecenegi) => istek("POST", yol, { ...s, govde }),
    put: (yol: string, govde?: unknown, s?: IstekSecenegi) => istek("PUT", yol, { ...s, govde }),
    patch: (yol: string, govde?: unknown, s?: IstekSecenegi) => istek("PATCH", yol, { ...s, govde }),
    del: (yol: string, govde?: unknown, s?: IstekSecenegi) => istek("DELETE", yol, { ...s, govde }),
  };
}

export type Istemci = ReturnType<typeof istemci>;

/** Hata yanıtını denetler: HTTP durum ve kod. */
export function hataBekle(y: Yanit, durum: number, kod: string) {
  assert.equal(y.durum, durum, `Beklenen ${durum} ${kod}, gelen ${y.durum}: ${JSON.stringify(y.govde)}`);
  assert.equal(y.govde?.hata?.kod, kod, `Beklenen kod ${kod}: ${JSON.stringify(y.govde)}`);
  assert.equal(typeof y.govde.hata.mesaj, "string");
}

export function basariBekle(y: Yanit, durum = 200) {
  assert.equal(y.durum, durum, `Beklenen ${durum}, gelen ${y.durum}: ${JSON.stringify(y.govde)}`);
}

export const benzersiz = (onek: string) => `${onek}-${randomBytes(4).toString("hex")}`;

/** Yardımcılar: yönetici girişi, öğrenci kaydı, sınav/tür/ağaç/soru kurulumu (API üzerinden). */
export function kurucu(o: () => TestOrtami, h: Istemci) {
  let yoneticiJetonu: string | null = null;

  async function yonetici(): Promise<string> {
    if (yoneticiJetonu) return yoneticiJetonu;
    const y = await h.post("/api/admin/giris", { eposta: o().yonetici.eposta, parola: o().yonetici.parola });
    basariBekle(y);
    yoneticiJetonu = y.govde.jeton as string;
    return yoneticiJetonu;
  }

  async function ogrenci(ek: Partial<{ adSoyad: string; eposta: string; parola: string; kaynak: string }> = {}) {
    const eposta = ek.eposta ?? `${benzersiz("ogr")}@test.local`;
    const parola = ek.parola ?? "Ogrenci-Parola-1";
    const y = await h.post("/api/ogrenci/kayit", { adSoyad: ek.adSoyad ?? "Deneme Öğrenci", eposta, parola, kvkkOnay: true, kaynak: ek.kaynak });
    basariBekle(y, 201);
    return { jeton: y.govde.jeton as string, id: y.govde.ogrenci.id as number, eposta: eposta.toLowerCase(), parola };
  }

  async function sinav(ek: Record<string, unknown> = {}) {
    const y = await h.post("/api/admin/sinavlar", { ad: benzersiz("Sınav"), aktif: true, yanlisGoturme: 4, ...ek }, { jeton: await yonetici() });
    basariBekle(y, 201);
    return y.govde as { id: number; ad: string };
  }

  async function tur(soruSayisi: number, ek: Record<string, unknown> = {}) {
    const y = await h.post("/api/admin/turler", { ad: benzersiz("Tür"), soruSayisi, sureDakika: 30, ...ek }, { jeton: await yonetici() });
    basariBekle(y, 201);
    return y.govde as { id: number; ad: string; soruSayisi: number };
  }

  async function dugum(seviye: string, ustId: number, ad: string, kod?: string) {
    const y = await h.post(`/api/admin/agac/${seviye}`, { ustId, ad, kod }, { jeton: await yonetici() });
    basariBekle(y, 201);
    return y.govde.id as number;
  }

  /** Bir ders → konu → kazanım → alt kazanım yolu. */
  async function yol(sinavId: number, adlar: { ders?: string; konu?: string; kazanim?: string; alt?: string } = {}) {
    const dersId = await dugum("dersler", sinavId, adlar.ders ?? benzersiz("Ders"));
    const konuId = await dugum("konular", dersId, adlar.konu ?? benzersiz("Konu"));
    const kazanimId = await dugum("kazanimlar", konuId, adlar.kazanim ?? benzersiz("Kazanım"), "K.1");
    const altKazanimId = await dugum("alt-kazanimlar", kazanimId, adlar.alt ?? benzersiz("Alt"), "K.1.1");
    return { sinavId, dersId, konuId, kazanimId, altKazanimId };
  }

  let soruSayaci = 0;
  /** Soru ekler; doğru şık varsayılan "B". */
  async function soru(z: { sinavId: number; dersId: number; konuId: number; kazanimId: number; altKazanimId: number }, ek: Record<string, unknown> = {}) {
    soruSayaci += 1;
    const n = soruSayaci;
    const y = await h.post(
      "/api/admin/sorular",
      {
        ...z,
        metin: `Soru ${n} (${benzersiz("m")}): $x + ${n} = ${n + 2}$ ise $x$ kaçtır?`,
        cozum: `$x = ${n + 2} - ${n} = 2$`,
        siklar: [{ metin: "1" }, { metin: "2", aciklama: "Doğru cevap." }, { metin: "3", aciklama: "Bir fazlası." }, { metin: "4" }, { metin: "5" }],
        dogruSik: "B",
        ...ek,
      },
      { jeton: await yonetici() }
    );
    basariBekle(y, 201);
    return y.govde as { id: number };
  }

  async function ayar(sinavId: number, turId: number, govde: { secim: "KARMA" | "SABIT"; recete?: unknown[]; sabitSoruIdleri?: number[] }) {
    const y = await h.put(`/api/admin/sinavlar/${sinavId}/ayarlar/${turId}`, { recete: [], sabitSoruIdleri: [], ...govde }, { jeton: await yonetici() });
    basariBekle(y);
    return y.govde;
  }

  return { yonetici, ogrenci, sinav, tur, dugum, yol, soru, ayar };
}

export type Kurucu = ReturnType<typeof kurucu>;

/** JSON içinde anahtar adlarını derinlemesine arar. */
export function anahtarlariTopla(deger: unknown, sonuc = new Set<string>()): Set<string> {
  if (Array.isArray(deger)) for (const x of deger) anahtarlariTopla(x, sonuc);
  else if (deger && typeof deger === "object") {
    for (const [k, v] of Object.entries(deger)) {
      sonuc.add(k);
      anahtarlariTopla(v, sonuc);
    }
  }
  return sonuc;
}
