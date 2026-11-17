/**
 * `npm run db:tohum:ornek`: YALNIZCA geliştirme için örnek veri.
 *
 * Reddeder: NODE_ENV=production ya da veritabanı adında `_dev` / `_test` yok.
 * İdempotent: sınav, tür ve ağaç adla; sorular metinle eşlenir; reçete ve
 * sabit liste her çalıştırmada yeniden yazılır.
 *
 * İçerik:
 *   - ALES (aktif, ücretsiz) ve DGS (aktif, 299,00 TL), yanlış götürme 4.
 *   - Türler: Hızlı Check-up (50 soru, 75 dk), Kapsamlı Check-up (150 soru, 225 dk).
 *   - ALES: Sayısal/Sözel ağacı, 56 demo soru, Hızlı için HAZIR bir KARMA reçete;
 *     Kapsamlı için havuzu yetmeyen bir reçete ("Hazırlanıyor" görünsün).
 *   - DGS: küçük ağaç, 8 soru, Hızlı için eksik bir SABIT liste.
 * Demo soruların doğru cevabı hesaplanarak üretilir; her birinde çözüm var.
 */
import "dotenv/config";
import { veritabaniOlustur } from "../src/db.js";
import { icerikHtml } from "../src/lib/icerik.js";
import { HARFLER, siklariDenetle } from "../src/lib/siklar.js";
import { ayarDurumlari } from "../src/servisler/ayarlar.js";
import { ALES_AGACI, ALES_SORULARI, DGS_AGACI, DGS_SORULARI, type AgacTanimi, type DemoSoru } from "./ornek-veri.js";

// ─── Koruma ───────────────────────────────────────────────────

const adres = process.env.DATABASE_URL ?? "";
let dbAdi = "";
try {
  dbAdi = decodeURIComponent(new URL(adres).pathname.replace(/^\//, ""));
} catch {
  /* aşağıda reddedilir */
}
if (process.env.NODE_ENV === "production") {
  console.error("✗ Örnek tohum üretimde çalışmaz (NODE_ENV=production).");
  process.exit(1);
}
if (!/_dev|_test/.test(dbAdi)) {
  console.error(`✗ Örnek tohum yalnızca adında "_dev" ya da "_test" geçen veritabanında çalışır (şu an: "${dbAdi || "?"}").`);
  process.exit(1);
}

const db = veritabaniOlustur(adres);

// ─── Yazma ────────────────────────────────────────────────────

async function sinavYaz(t: { ad: string; aciklama: string; ucretKurus: number; yanlisGoturme: number; sira: number }) {
  return db.sinav.upsert({
    where: { ad: t.ad },
    create: { ...t, aktif: true },
    update: { ...t, aktif: true },
    select: { id: true },
  });
}

async function turYaz(t: { ad: string; aciklama: string; soruSayisi: number; sureDakika: number; sira: number }) {
  return db.checkupTuru.upsert({ where: { ad: t.ad }, create: { ...t, aktif: true }, update: { ...t, aktif: true }, select: { id: true } });
}

/** Ağacı yazar; alt kazanım kodu → zincir kimlikleri döner. */
async function agacYaz(sinavId: number, agac: AgacTanimi[]) {
  const zincir = new Map<string, { dersId: number; konuId: number; kazanimId: number; altKazanimId: number }>();
  const kazanimlar = new Map<string, { id: number; konuId: number }>();
  const konular = new Map<string, number>();
  for (const [di, d] of agac.entries()) {
    const ders = await db.ders.upsert({ where: { sinavId_ad: { sinavId, ad: d.ders } }, create: { sinavId, ad: d.ders, sira: di }, update: { sira: di }, select: { id: true } });
    for (const [ki, k] of d.konular.entries()) {
      const konu = await db.konu.upsert({ where: { dersId_ad: { dersId: ders.id, ad: k.ad } }, create: { dersId: ders.id, ad: k.ad, sira: ki }, update: { sira: ki }, select: { id: true } });
      konular.set(`${d.ders}/${k.ad}`, konu.id);
      for (const [zi, z] of k.kazanimlar.entries()) {
        const kazanim = await db.kazanim.upsert({
          where: { konuId_ad: { konuId: konu.id, ad: z.ad } },
          create: { konuId: konu.id, ad: z.ad, kod: z.kod, sira: zi },
          update: { kod: z.kod, sira: zi },
          select: { id: true },
        });
        kazanimlar.set(z.kod, { id: kazanim.id, konuId: konu.id });
        for (const [ai, a] of z.altlar.entries()) {
          const alt = await db.altKazanim.upsert({
            where: { kazanimId_ad: { kazanimId: kazanim.id, ad: a.ad } },
            create: { kazanimId: kazanim.id, ad: a.ad, kod: a.kod, sira: ai },
            update: { kod: a.kod, sira: ai },
            select: { id: true },
          });
          zincir.set(a.kod, { dersId: ders.id, konuId: konu.id, kazanimId: kazanim.id, altKazanimId: alt.id });
        }
      }
    }
  }
  return { zincir, kazanimlar, konular };
}

async function sorulariYaz(sinavId: number, zincir: Map<string, { dersId: number; konuId: number; kazanimId: number; altKazanimId: number }>, sorular: DemoSoru[]) {
  const idler: number[] = [];
  for (const s of sorular) {
    const z = zincir.get(s.alt);
    if (!z) throw new Error(`Alt kazanım yok: ${s.alt}`);
    const hata = siklariDenetle(s.siklar.map((metin) => ({ metin })), HARFLER[s.dogru]);
    if (Object.keys(hata).length || s.dogru < 0) throw new Error(`Demo soru şıkları geçersiz: ${s.metin}\n${JSON.stringify(hata)}`);

    const veri = {
      sinavId,
      ...z,
      metin: s.metin,
      metinHtml: icerikHtml(s.metin),
      cozum: s.cozum,
      cozumHtml: icerikHtml(s.cozum),
      zorluk: s.zorluk,
      aktif: true,
    };
    const siklar = s.siklar.map((metin, i) => ({ sira: i, metin, metinHtml: icerikHtml(metin), dogru: i === s.dogru, aciklama: null }));
    const mevcut = await db.soru.findFirst({ where: { sinavId, metin: s.metin }, select: { id: true } });
    if (mevcut) {
      await db.soru.update({ where: { id: mevcut.id }, data: veri });
      for (const k of siklar) {
        await db.sik.upsert({ where: { soruId_sira: { soruId: mevcut.id, sira: k.sira } }, update: k, create: { soruId: mevcut.id, ...k } });
      }
      idler.push(mevcut.id);
    } else {
      const yeni = await db.soru.create({ data: { ...veri, siklar: { createMany: { data: siklar } } }, select: { id: true } });
      idler.push(yeni.id);
    }
  }
  return idler;
}

async function ayarYaz(sinavId: number, turId: number, secim: "KARMA" | "SABIT", recete: { konuId?: number; kazanimId?: number; soruSayisi: number }[], sabit: number[]) {
  const ayar = await db.checkupAyari.upsert({ where: { sinavId_turId: { sinavId, turId } }, create: { sinavId, turId, secim }, update: { secim }, select: { id: true } });
  await db.receteSatiri.deleteMany({ where: { ayarId: ayar.id } });
  if (recete.length) {
    await db.receteSatiri.createMany({ data: recete.map((r, i) => ({ ayarId: ayar.id, konuId: r.konuId ?? null, kazanimId: r.kazanimId ?? null, soruSayisi: r.soruSayisi, sira: i })) });
  }
  await db.sabitSoru.deleteMany({ where: { ayarId: ayar.id } });
  if (sabit.length) await db.sabitSoru.createMany({ data: sabit.map((soruId, i) => ({ ayarId: ayar.id, soruId, sira: i + 1 })) });
}

async function main() {
  const ales = await sinavYaz({ ad: "ALES", aciklama: "Akademik Personel ve Lisansüstü Eğitimi Giriş Sınavı", ucretKurus: 0, yanlisGoturme: 4, sira: 0 });
  const dgs = await sinavYaz({ ad: "DGS", aciklama: "Dikey Geçiş Sınavı", ucretKurus: 29900, yanlisGoturme: 4, sira: 1 });
  const hizli = await turYaz({ ad: "Hızlı Check-up", aciklama: "50 soruluk kısa ölçüm: güçlü ve zayıf konularını hızlıca gösterir.", soruSayisi: 50, sureDakika: 75, sira: 0 });
  const kapsamli = await turYaz({ ad: "Kapsamlı Check-up", aciklama: "150 soruluk ayrıntılı ölçüm: her konuda daha güvenilir sonuç.", soruSayisi: 150, sureDakika: 225, sira: 1 });

  const a = await agacYaz(ales.id, ALES_AGACI);
  await sorulariYaz(ales.id, a.zincir, ALES_SORULARI);
  const kaz = (kod: string) => a.kazanimlar.get(kod)!.id;
  const konu = (yol: string) => a.konular.get(yol)!;

  // Hızlı (50): kazanım satırları + konu satırları; havuz yetiyor.
  await ayarYaz(
    ales.id,
    hizli.id,
    "KARMA",
    [
      { kazanimId: kaz("MAT.1"), soruSayisi: 7 },
      { kazanimId: kaz("MAT.2"), soruSayisi: 7 },
      { konuId: konu("Sayısal/Denklemler"), soruSayisi: 14 },
      { kazanimId: kaz("MAT.5"), soruSayisi: 7 },
      { konuId: konu("Sayısal/Problemler"), soruSayisi: 6 },
      { konuId: konu("Sözel/Sözcükte Anlam"), soruSayisi: 9 },
    ],
    []
  );
  // Kapsamlı (150): toplam doğru ama havuz yetmiyor → "Hazırlanıyor".
  await ayarYaz(
    ales.id,
    kapsamli.id,
    "KARMA",
    [
      { konuId: konu("Sayısal/Temel Kavramlar"), soruSayisi: 40 },
      { konuId: konu("Sayısal/Denklemler"), soruSayisi: 40 },
      { konuId: konu("Sayısal/Problemler"), soruSayisi: 40 },
      { konuId: konu("Sözel/Sözcükte Anlam"), soruSayisi: 30 },
    ],
    []
  );

  const d = await agacYaz(dgs.id, DGS_AGACI);
  const dgsIdleri = await sorulariYaz(dgs.id, d.zincir, DGS_SORULARI);
  // Hızlı: SABIT liste, 50 yerine 8 soru → eksik.
  await ayarYaz(dgs.id, hizli.id, "SABIT", [], dgsIdleri);

  const durumlar = await ayarDurumlari(db, [ales.id, dgs.id]);
  console.log("✓ Örnek veri yazıldı.");
  for (const [sinavId, liste] of durumlar) {
    const ad = sinavId === ales.id ? "ALES" : "DGS";
    const soru = await db.soru.count({ where: { sinavId, aktif: true } });
    console.log(`  ${ad}: ${soru} aktif soru`);
    for (const x of liste) {
      console.log(`    - ${x.tur.ad} (${x.secim}): ${x.hazirlik.hazir ? "HAZIR" : "hazır değil"}${x.hazirlik.sorunlar.length ? ` — ${x.hazirlik.sorunlar[0]}` : ""}`);
    }
  }
}

main()
  .catch((e: unknown) => {
    console.error("✗ Örnek tohum başarısız:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
