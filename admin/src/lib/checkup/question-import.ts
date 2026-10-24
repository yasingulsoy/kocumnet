import "server-only";
import { db } from "./db";
import type { ErrorType } from "./generated/client";
import { QUESTION_LEVEL_LABEL } from "./format";
import { GORSEL_OKUNAMADI, gorselBoyutSorunu, webpYap, type WebpGorsel } from "./media-image";
import { staffStamp, type Staff } from "./staff";
import {
  GORSEL_SAYI_SINIRI,
  MD_SINIRI,
  PARTI_DURUM_ETIKETI,
  SORU_SAYI_SINIRI,
  YUKLEME_SINIRI,
  boyutYazisi,
  sinirAsildiMesaji,
  type GeriAlYaniti,
  type IceAktarmaRaporu,
  type KayitYaniti,
  type RaporSorusu,
} from "./import-report";
import {
  GERI_ALMADA_SILINEBILIR,
  anilanGorseller,
  dosyayiCozumle,
  dosyayiDenetle,
  gorselleriYerlestir,
  kazanimAdiSec,
  seviye1Sayilari,
  tekSoruluKazanimlar,
  type DenetimSonucu,
  type HamSoru,
  type IceAktarmaBaglami,
  type IceAktarmaKazanimi,
} from "./shared/question-import";
import { formulHatasi } from "./shared/question-readiness";

/**
 * Toplu soru içe aktarma — panel tarafı (sunucu).
 *
 * Kurallar burada DEĞİL: çözümleme ve denetim shared/question-import.ts'te
 * (app/lib'den kopya; komut satırı betiği de onu kullanıyor). Bu dosya
 * yüklenen dosyaları okur, denetim bağlamını veritabanından kurar, görselleri
 * tek şekil yüklemeyle aynı biçime çevirir ve yazar.
 *
 * "Denetle" ile "Kaydet" aynı yoldan geçer (hazirla): kaydederken dosyalar
 * yeniden gönderilir ve her şey baştan denetlenir. İstemcinin elindeki
 * rapora güvenilmez; denetimden sonra havuza başkası soru eklemiş olabilir.
 *
 * Yetkiyi eylemler denetler (actions/question-import.ts).
 */

// ─────────────────────────────────────────────────────────────
// Yüklenen dosyalar
// ─────────────────────────────────────────────────────────────

export interface Yuklenenler {
  dosyaAdi: string;
  metin: string;
  /** Dosya adı → dosya (aynı ad ikinci kez seçildiyse ilki). */
  gorseller: Map<string, File>;
  /** Aynı adla birden fazla seçilen görseller. */
  tekrarlanan: string[];
}

/** Tarayıcı klasörle seçimde "klasor/gorseller/a.png" gönderebilir; yalnızca ad. */
const tabanAd = (ad: string) => (ad.split(/[\\/]/).pop() ?? "").trim().slice(0, 200);

export async function dosyalariOku(fd: FormData): Promise<{ ok: true; y: Yuklenenler } | { ok: false; hata: string }> {
  const md = fd.get("dosya");
  if (!(md instanceof File) || md.size === 0) return { ok: false, hata: "Soru dosyasını (.md) seç." };
  const dosyaAdi = tabanAd(md.name) || "sorular.md";
  if (!/\.(md|markdown|txt)$/i.test(dosyaAdi)) {
    return { ok: false, hata: `"${dosyaAdi}" bir soru dosyası değil; SORU-SABLONU biçiminde .md dosyası seç.` };
  }
  if (md.size > MD_SINIRI) {
    return { ok: false, hata: `Soru dosyası çok büyük (${boyutYazisi(md.size)}); en fazla ${boyutYazisi(MD_SINIRI)}. Dosyayı böl.` };
  }

  const gorselDosyalari = fd.getAll("gorsel").filter((g): g is File => g instanceof File && g.size > 0);
  if (gorselDosyalari.length > GORSEL_SAYI_SINIRI) {
    return { ok: false, hata: `Bir içe aktarmada en fazla ${GORSEL_SAYI_SINIRI} görsel olabilir (${gorselDosyalari.length} seçildi). Dosyayı böl.` };
  }
  const toplam = md.size + gorselDosyalari.reduce((t, g) => t + g.size, 0);
  if (toplam > YUKLEME_SINIRI) return { ok: false, hata: sinirAsildiMesaji(toplam) };

  let metin: string;
  try {
    // fatal: geçersiz UTF-8'de hata. Windows'un "ANSI" (1254) kaydında Türkçe
    // harfler bozulur, "İdeal Süre" gibi alan adları sessizce eşleşmez.
    metin = new TextDecoder("utf-8", { fatal: true }).decode(await md.arrayBuffer());
  } catch {
    return {
      ok: false,
      hata: "Dosya UTF-8 değil (Türkçe harfler bozulur). Not Defteri'nde Farklı kaydet → Kodlama: UTF-8 seçip yeniden kaydet.",
    };
  }

  const gorseller = new Map<string, File>();
  const tekrarlanan: string[] = [];
  for (const g of gorselDosyalari) {
    const ad = tabanAd(g.name);
    if (!ad) continue;
    if (gorseller.has(ad)) tekrarlanan.push(ad);
    else gorseller.set(ad, g);
  }
  return { ok: true, y: { dosyaAdi, metin, gorseller, tekrarlanan } };
}

/**
 * Metindeki adla yüklenen dosyayı eşler. Önce birebir; olmazsa büyük/küçük
 * harf farkı gözetmeden (Windows'ta "Sekil-01.PNG" ile "sekil-01.png" aynı
 * dosyadır; komut satırı betiği de orada aynı davranıyor).
 */
function gorselBulucu(gorseller: Map<string, File>) {
  const kucuk = new Map<string, File>();
  for (const [ad, f] of gorseller) if (!kucuk.has(ad.toLowerCase())) kucuk.set(ad.toLowerCase(), f);
  return (ad: string): File | null => gorseller.get(ad) ?? kucuk.get(ad.toLowerCase()) ?? null;
}

/** Komut satırıyla aynı yol ve aynı cümleler (shared/media-image.ts). */
async function gorseliIsle(f: File): Promise<WebpGorsel | string> {
  const buyuk = gorselBoyutSorunu(f.size);
  if (buyuk) return buyuk;
  return (await webpYap(Buffer.from(await f.arrayBuffer()))) ?? GORSEL_OKUNAMADI;
}

// ─────────────────────────────────────────────────────────────
// Denetim (Denetle ve Kaydet ortak)
// ─────────────────────────────────────────────────────────────

export interface Hazirlik {
  y: Yuklenenler;
  ham: HamSoru[];
  sonuc: DenetimSonucu;
  rapor: IceAktarmaRaporu;
  /** Metindeki görsel adı → WebP'ye çevrilmiş görsel ya da sorunu. */
  islenmis: Map<string, WebpGorsel | string>;
  kazanimlar: Map<string, IceAktarmaKazanimi>;
}

export async function hazirla(y: Yuklenenler): Promise<{ ok: true; h: Hazirlik } | { ok: false; hata: string }> {
  const ham = dosyayiCozumle(y.metin);
  if (ham.length === 0) {
    return { ok: false, hata: "Dosyada soru bulunamadı: her soru \"### Soru 01\" gibi bir başlıkla başlamalı (SORU-SABLONU §8)." };
  }
  if (ham.length > SORU_SAYI_SINIRI) {
    return { ok: false, hata: `Bir dosyada en fazla ${SORU_SAYI_SINIRI} soru olabilir; bu dosyada ${ham.length} var. Dosyayı böl.` };
  }

  // Görseller denetimden ÖNCE çevrilir: bozuk dosya, onu kullanan sorunun
  // hatası olarak raporlansın (denetim eşzamanlı, sharp değil).
  const bul = gorselBulucu(y.gorseller);
  const anilan = anilanGorseller(ham);
  const islenmis = new Map<string, WebpGorsel | string>();
  for (const ad of anilan) {
    const f = bul(ad);
    if (f) islenmis.set(ad, await gorseliIsle(f));
  }

  const [konular, sorular, kazanimSatirlari] = await Promise.all([
    db.topic.findMany({
      where: { children: { none: {} } },
      select: { id: true, slug: true, name: true, examScope: true, examScopes: true },
    }),
    // TÜM sorular: panelde elle girilen (kaynağı boş) sorunun metni de çift sayılır.
    db.question.findMany({ select: { id: true, sourceRef: true, fingerprint: true } }),
    db.objective.findMany({ select: { id: true, code: true, topicId: true, name: true, status: true } }),
  ]);
  const kazanimlar = new Map<string, IceAktarmaKazanimi>(
    kazanimSatirlari.map((k) => [k.code, { id: k.id, topicId: k.topicId, name: k.name, arsivde: k.status === "ARCHIVED" }])
  );
  const b: IceAktarmaBaglami = {
    konular: new Map(konular.map((k) => [k.slug, { id: k.id, examScope: k.examScope, examScopes: k.examScopes }])),
    // sourceRef "ID · kaynak" biçiminde; ID kısmı karşılaştırılır (betikle aynı).
    mevcutIdler: new Set(sorular.map((q) => (q.sourceRef ?? "").split(" · ")[0]).filter(Boolean)),
    mevcutParmakIzleri: new Map(sorular.map((q) => [q.fingerprint, q.id])),
    kazanimlar,
    gorselVar: (ad) => bul(ad) !== null,
    gorselSorunu: (ad) => {
      const g = islenmis.get(ad);
      return typeof g === "string" ? g : null;
    },
    formulHatasi,
  };
  const sonuc = dosyayiDenetle(ham, b);

  // ── Dosyanın geneline dair uyarılar ──
  const genelUyarilar: string[] = [];
  const l1 = seviye1Sayilari(sonuc.hazir);
  if (l1.size) {
    const idler = [...l1.keys()].map((kod) => kazanimlar.get(kod)?.id).filter((x): x is string => Boolean(x));
    const havuzda = new Map<string, number>();
    if (idler.length) {
      const satirlar = await db.question.groupBy({
        by: ["objectiveId"],
        where: { level: "L1_TEMEL", objectiveId: { in: idler } },
        _count: { _all: true },
      });
      const koda = new Map([...kazanimlar].map(([kod, k]) => [k.id, kod]));
      for (const r of satirlar) {
        const kod = r.objectiveId ? koda.get(r.objectiveId) : undefined;
        if (kod) havuzda.set(kod, r._count._all);
      }
    }
    const tek = tekSoruluKazanimlar(l1, havuzda);
    if (tek.length) genelUyarilar.push(`Tek seviye-1 sorusu olan kazanımlar (telafi turunda boş kalır): ${tek.join(", ")}`);
  }
  const kullanilan = new Set(anilan.map(bul).filter((f): f is File => f !== null));
  const kullanilmayan = [...y.gorseller].filter(([, f]) => !kullanilan.has(f)).map(([ad]) => ad);
  if (kullanilmayan.length) {
    genelUyarilar.push(
      `Hiçbir soruda geçmeyen görseller (yüklenmez): ${kullanilmayan.join(", ")}. Soru Metni'ndeki ![…](dosya) adıyla eşleşmiyor olabilir.`
    );
  }
  if (y.tekrarlanan.length) {
    genelUyarilar.push(`Aynı adla birden fazla görsel seçildi, ilki kullanıldı: ${[...new Set(y.tekrarlanan)].join(", ")}.`);
  }

  const konuAdi = new Map(konular.map((k) => [k.id, k.name]));
  const rapor = raporOlustur(y.dosyaAdi, ham, sonuc, konuAdi, kazanimlar, genelUyarilar);
  return { ok: true, h: { y, ham, sonuc, rapor, islenmis, kazanimlar } };
}

function raporOlustur(
  dosyaAdi: string,
  ham: HamSoru[],
  sonuc: DenetimSonucu,
  konuAdi: Map<string, string>,
  kazanimlar: Map<string, IceAktarmaKazanimi>,
  genelUyarilar: string[]
): IceAktarmaRaporu {
  const sorular: RaporSorusu[] = sonuc.sorular.map((s, i) => {
    const q = ham[i];
    const h = s.hazir;
    return {
      sira: s.sira,
      satir: s.satir,
      baslik: s.baslik,
      id: s.id,
      gecerli: h !== null,
      hatalar: s.hatalar,
      uyarilar: s.uyarilar,
      ozet: h
        ? {
            konu: konuAdi.get(h.topicId) ?? h.topicSlug,
            konuKodu: h.topicSlug,
            seviye: h.level ? (QUESTION_LEVEL_LABEL[h.level] ?? h.level) : null,
            zorluk: h.difficulty,
            sure: h.targetTimeSeconds,
            sikSayisi: h.drafts.length,
            kazanim: h.kazanimKodu,
            yeniKazanim: Boolean(h.kazanimKodu && !kazanimlar.has(h.kazanimKodu)),
            sinavlar: h.examScopes,
            gorselSayisi: new Set(h.gorseller.map((g) => g.dosya)).size,
            ipucuSayisi: h.hints?.length ?? 0,
            video: h.videoUrl,
            adimSayisi: h.adimSayisi,
          }
        : null,
      cift: s.cift ?? null,
      // "Doğrudan yayına al"da bu soru İncelemede girer (shared/question-readiness.ts).
      yayinEksikleri: h ? h.yayinEksikleri.map((e) => e.mesaj) : [],
      onizleme: {
        soru: q.alanlar["soru metni"] ?? "",
        secenekler: q.secenekler.map((x) => ({ harf: x.harf, metin: x.metin, dogru: x.isaretli })),
        cozum: q.alanlar["cozum aciklamasi"] ?? "",
        ipuclari: q.ipuclari.map((x) => x.metin).filter((m) => m.trim()),
      },
    };
  });
  const yeniKazanimlar = new Set(
    sonuc.hazir.map((h) => h.kazanimKodu).filter((k): k is string => Boolean(k) && !kazanimlar.has(k!))
  );
  return {
    dosyaAdi,
    sayilar: {
      bulunan: ham.length,
      gecerli: sonuc.hazir.length,
      reddedilen: ham.length - sonuc.hazir.length,
      uyarili: sorular.filter((s) => s.uyarilar.length > 0).length,
      gorsel: new Set(sonuc.hazir.flatMap((h) => h.gorseller.map((g) => g.dosya))).size,
      yeniKazanim: yeniKazanimlar.size,
      ipuclu: sonuc.hazir.filter((h) => h.hints).length,
      videolu: sonuc.hazir.filter((h) => h.videoUrl).length,
      yayinaHazir: sonuc.hazir.filter((h) => h.yayinEksikleri.length === 0).length,
    },
    genelUyarilar,
    sorular,
  };
}

// ─────────────────────────────────────────────────────────────
// Kaydet
// ─────────────────────────────────────────────────────────────

/**
 * Geçerli soruları TEK partide, tek işlemde yazar (komut satırıyla aynı
 * kurallar: kazanım yoksa açılır, görseller MediaAsset olur). Reddedilenler
 * atlanır ve partinin hata listesine yazılır.
 *
 * Durum: taslak; `yayinla` ile "yayına hazır mı" listesinden geçen yayında
 * (yayına alan ve zamanı yazılır), geçmeyen İncelemede (raporda eksikleri
 * yazılı). Panelde yayına almanın her yolu aynı kapıdan geçer.
 */
export async function iceAktar(h: Hazirlik, staff: Staff, yayinla: boolean): Promise<KayitYaniti> {
  const { sonuc, rapor } = h;
  const hazir = sonuc.hazir;
  if (hazir.length === 0) return { ok: false, hata: "Geçerli soru yok; kaydedilecek bir şey yok.", rapor };

  const damga = staffStamp(staff);
  const reddedilen = sonuc.sorular.filter((s) => !s.hazir);
  const parti = await db.importBatch.create({
    data: { filename: h.y.dosyaAdi, format: "md", status: "PENDING", totalRows: h.ham.length, createdByStaff: damga },
    select: { id: true },
  });

  const kazanimlar = new Map(h.kazanimlar);
  const yeniKazanimlar: string[] = [];
  const simdi = new Date();
  try {
    await db.$transaction(
      async (tx) => {
        const medya = new Map<string, string>(); // dosya adı → MediaAsset kimliği
        for (const q of hazir) {
          // Kazanım: varsa bul, yoksa aç (yayında — içerik ekibinin listesi).
          let objectiveId: string | null = null;
          if (q.kazanimKodu) {
            const mevcut = kazanimlar.get(q.kazanimKodu);
            if (mevcut) {
              objectiveId = mevcut.id;
            } else {
              const o = await tx.objective.create({
                data: {
                  topicId: q.topicId,
                  code: q.kazanimKodu,
                  name: kazanimAdiSec(hazir, q.kazanimKodu),
                  status: "PUBLISHED",
                  examScopes: q.examScopes,
                },
                select: { id: true },
              });
              kazanimlar.set(q.kazanimKodu, { id: o.id, topicId: q.topicId });
              yeniKazanimlar.push(q.kazanimKodu);
              objectiveId = o.id;
            }
          }

          let stem = q.stem;
          if (q.gorseller.length) {
            const kimlikler = new Map<string, string>();
            for (const g of q.gorseller) {
              let mediaId = medya.get(g.dosya);
              if (!mediaId) {
                const gorsel = h.islenmis.get(g.dosya);
                // Denetim bozuk görselli soruyu zaten reddeder; buraya gelinmez.
                if (!gorsel || typeof gorsel === "string") throw new Error("Görsel hazırlanamadı: " + g.dosya);
                const m = await tx.mediaAsset.create({
                  data: {
                    // Geri alma partinin görsellerini bu önekle bulur (betikle aynı).
                    storageKey: `import/${parti.id}/${g.dosya}`,
                    mimeType: "image/webp",
                    width: gorsel.width,
                    height: gorsel.height,
                    byteSize: gorsel.byteSize,
                    data: gorsel.data,
                    alt: g.alt,
                    uploadedByStaff: damga,
                  },
                  select: { id: true },
                });
                mediaId = m.id;
                medya.set(g.dosya, mediaId);
              }
              kimlikler.set(g.dosya, mediaId);
            }
            stem = gorselleriYerlestir(stem, kimlikler);
          }

          await tx.question.create({
            data: {
              topicId: q.topicId,
              stem,
              stemText: q.stemText,
              fingerprint: q.fingerprint,
              solution: q.solution ?? undefined,
              // Boşsa yazılmaz (null kalır): "ipucu yok" ile "boş liste" ayrı durum olmasın.
              hints: q.hints ?? undefined,
              videoUrl: q.videoUrl,
              difficulty: q.difficulty,
              targetTimeSeconds: q.targetTimeSeconds,
              status: !yayinla ? "DRAFT" : q.yayinEksikleri.length ? "REVIEW" : "PUBLISHED",
              ...(yayinla && q.yayinEksikleri.length === 0 ? { publishedAt: simdi, publishedByStaff: damga } : {}),
              sourceRef: q.sourceRef,
              importBatchId: parti.id,
              examScopes: q.examScopes,
              level: q.level,
              objectiveId,
              createdByStaff: damga,
              updatedByStaff: damga,
              choices: {
                create: q.drafts.map((d, i) => ({
                  label: d.label,
                  content: d.content,
                  isCorrect: d.isCorrect,
                  errorType: (q.errorTypes[i] as ErrorType | null) ?? null,
                  sortOrder: i,
                })),
              },
            },
            select: { id: true },
          });
        }
      },
      { timeout: 120_000, maxWait: 10_000 }
    );
  } catch (e) {
    const cift = (e as { code?: string } | null)?.code === "P2002";
    console.error("[checkup] içe aktarma başarısız:", parti.id, (e as Error).message);
    await db.importBatch
      .update({
        where: { id: parti.id },
        data: {
          status: "FAILED",
          errors: [{ row: 0, reason: cift ? "Çift kayıt: aynı soru metni ya da kazanım kodu az önce eklendi." : "Veritabanına yazılamadı.", detail: "transaction" }],
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
    return {
      ok: false,
      hata: cift
        ? "Kaydederken çift kayıt çıktı: bu sorulardan biri ya da bir kazanım kodu az önce havuza eklenmiş. Hiçbir soru yazılmadı; dosyayı yeniden denetle."
        : "Veritabanına yazılamadı, hiçbir soru kaydedilmedi. Biraz sonra tekrar dene; sürerse teknik ekibe haber ver.",
      rapor,
    };
  }

  await db.importBatch.update({
    where: { id: parti.id },
    data: {
      status: "DONE",
      createdCount: hazir.length,
      skippedCount: reddedilen.length,
      // Komut satırı ilk hatayı yazıyor; panel hepsini (rapor ekranda zaten tam).
      errors: reddedilen.map((s) => ({ row: s.satir, reason: s.hatalar.join(" "), detail: s.id || s.baslik })),
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    rapor,
    partiId: parti.id,
    yazilan: hazir.length,
    atlanan: reddedilen.length,
    yayinda: yayinla,
    incelemede: yayinla ? hazir.filter((q) => q.yayinEksikleri.length > 0).length : 0,
    yeniKazanimlar,
  };
}

// ─────────────────────────────────────────────────────────────
// Geri al
// ─────────────────────────────────────────────────────────────

/** Bu kadar yeni ve hâlâ PENDING olan parti "sürüyor" sayılır, geri alınmaz. */
const SURUYOR_MS = 10 * 60_000;

/**
 * Komut satırının `--geri-al`'ıyla AYNI kural (shared/question-import.ts
 * GERI_ALMADA_SILINEBILIR): hiçbir öğrenciye sorulmamış (SessionItem'ı
 * olmayan), hiçbir denemenin listesinde olmayan ve notu (personel notu ya da
 * öğrenci bildirimi) olmayan sorular silinir. Alıştırma da SessionItem açar;
 * yanlış defteri maddesi (NotebookItem, soru silinince kendiliğinden gider)
 * yalnızca cevaplanmış soruda olur — ikisi de bu kuralla korunur. Sorulmuş soru
 * silinemez: öğrencinin cevabı ona bağlı, geçmiş sonucu yeniden hesaplanamaz
 * olur. Notlu soru silinseydi not da (Cascade) sessizce giderdi. Korunanlar
 * partide kalır, parti "kısmen geri alındı" olur. Sonradan düzenlenmiş soru
 * SİLİNİR; onay metni kaç tane olduğunu söyler (partiGecmisi duzenlenen).
 * Parti kaydı silinmez: geri alan ve zamanı ona yazılır (rolledBackAt/ByStaff).
 *
 * Betikten iki farkı (ikisi de daha dar silme):
 *  · Kazanım: yalnızca silinen soruların bağlı olduğu, bu partiyle açılmış
 *    ve sorusu kalmamış kazanımlar.
 *  · Görsel: yalnızca artık hiçbir soruda geçmeyenler (betik de artık böyle).
 */
export async function partiyiGeriAl(partiId: string, staff: Staff): Promise<GeriAlYaniti> {
  const parti = await db.importBatch.findUnique({
    where: { id: partiId },
    select: { id: true, filename: true, status: true, createdAt: true, completedAt: true },
  });
  if (!parti) return { ok: false, hata: "Bu içe aktarma bulunamadı; zaten geri alınmış olabilir." };
  if (parti.status === "REVERTED") return { ok: false, hata: "Bu içe aktarma zaten geri alınmış." };
  if (parti.status === "PENDING" && Date.now() - parti.createdAt.getTime() < SURUYOR_MS) {
    return { ok: false, hata: "Bu içe aktarma hâlâ sürüyor. Birkaç dakika sonra tekrar dene." };
  }
  const damga = staffStamp(staff);

  // Bir denemenin sabit listesindeki soru da silinmez (PackageQuestion →
  // Question, onDelete: Restrict): silme işlemi patlardı, olmasa deneme eksik
  // kalırdı. Korunanlar arasında sayılır; önce denemeden çıkarılmalı.
  const silinecek = await db.question.findMany({
    where: { importBatchId: partiId, ...GERI_ALMADA_SILINEBILIR },
    select: { id: true, objectiveId: true },
  });
  const kazanimAdaylari = [...new Set(silinecek.map((s) => s.objectiveId).filter((x): x is string => Boolean(x)))];

  const sonuc = await db.$transaction(
    async (tx) => {
      // Koşul silme ifadesinin İÇİNDE: denetimden sonra teste giren ya da not
      // alan soru silinmez. Şıklar Choice → Question (onDelete: Cascade) ile gider.
      const silinen = silinecek.length
        ? await tx.question.deleteMany({
            where: { id: { in: silinecek.map((s) => s.id) }, importBatchId: partiId, ...GERI_ALMADA_SILINEBILIR },
          })
        : { count: 0 };
      const kalan = await tx.question.count({ where: { importBatchId: partiId } });

      // Görseller: yalnızca artık HİÇBİR soruda geçmeyenler. Korunan soru ya da
      // "benzerini oluştur" ile yapılmış kopyası aynı görseli gösteriyor olabilir.
      // (Komut satırı betiğinde aynı sorgu: app/scripts/import-questions.mts.)
      const adaylar = await tx.mediaAsset.findMany({
        where: { storageKey: { startsWith: `import/${partiId}/` } },
        select: { id: true },
      });
      let gorselSilinen = 0;
      let gorselKorunan = 0;
      if (adaylar.length) {
        const kullanilan = await tx.$queryRaw<{ id: string }[]>`
          SELECT m.id FROM unnest(${adaylar.map((a) => a.id)}::text[]) AS m(id)
          WHERE EXISTS (SELECT 1 FROM "Question" q WHERE strpos(q.stem::text, m.id) > 0 OR strpos(coalesce(q.solution::text, ''), m.id) > 0)
             OR EXISTS (SELECT 1 FROM "Choice" c WHERE strpos(c.content::text, m.id) > 0)`;
        const kalsin = new Set(kullanilan.map((r) => r.id));
        gorselKorunan = kalsin.size;
        const silinenGorsel = await tx.mediaAsset.deleteMany({
          where: { id: { in: adaylar.map((a) => a.id).filter((id) => !kalsin.has(id)) } },
        });
        gorselSilinen = silinenGorsel.count;
      }

      const bitis = parti.completedAt ?? new Date();
      const kazanim = kazanimAdaylari.length
        ? await tx.objective.deleteMany({
            where: {
              id: { in: kazanimAdaylari },
              createdAt: { gte: new Date(parti.createdAt.getTime() - 1000), lte: new Date(bitis.getTime() + 1000) },
              questions: { none: {} },
            },
          })
        : { count: 0 };

      /*
       * Parti kaydı kalır, kim ne zaman geri aldı yazılır (komut satırıyla
       * aynı kural). Yalnızca hiç sorusu olmayan parti (başarısız ya da boş:
       * "Kaydı sil") silinir. Hiçbir soru silinmediyse damga yazılmaz.
       */
      const bosParti = silinen.count === 0 && kalan === 0;
      if (bosParti) {
        await tx.importBatch.delete({ where: { id: partiId } });
      } else if (silinen.count > 0) {
        await tx.importBatch.update({
          where: { id: partiId },
          data: { status: kalan === 0 ? "REVERTED" : "REVERTED_PARTIAL", rolledBackAt: new Date(), rolledBackByStaff: damga },
        });
      }

      return {
        silinen: silinen.count,
        korunan: kalan,
        gorselSilinen,
        gorselKorunan,
        kazanimSilinen: kazanim.count,
        partiSilindi: bosParti,
      };
    },
    { timeout: 60_000, maxWait: 10_000 }
  );

  console.info("[checkup] içe aktarma geri alındı:", partiId, parti.filename, damga, JSON.stringify(sonuc));
  return { ok: true, dosyaAdi: parti.filename, partiId, ...sonuc };
}

// ─────────────────────────────────────────────────────────────
// Geçmiş
// ─────────────────────────────────────────────────────────────

export interface PartiSatiri {
  id: string;
  dosyaAdi: string;
  durum: string;
  durumEtiketi: string;
  tarih: Date;
  kim: string | null;
  /** Dosyadaki soru sayısı. */
  toplam: number;
  alinan: number;
  atlanan: number;
  /** Partide şu an duran sorular ve durumları. */
  kalan: number;
  durumlar: Record<string, number>;
  /** Geri almada korunacak sorular: öğrenciye sorulmuş, denemede ya da notlu (GERI_ALMADA_SILINEBILIR'in tersi). */
  korunacak: number;
  /** Korunacaklardan, öğrenciye sorulmamış ve denemede olmayıp yalnızca notu yüzünden kalan sorular. */
  notlu: number;
  /**
   * Silinecek sorulardan içe aktarmadan sonra düzenlenmiş olanlar: cevap
   * anahtarı değişmiş (version > 1) ya da başka bir personel dokunmuş
   * (updatedByStaff ≠ createdByStaff; durum değişikliği de sayılır). Yalnızca
   * onay metni için; silme ölçütü değil. updatedAt BİLEREK kullanılmıyor.
   */
  duzenlenen: number;
  /** Atlanan soruların listesi (ImportBatch.errors). */
  atlananlar: { satir: number; sebep: string; etiket: string }[];
  /** Başarısız partinin sebebi. */
  hataMesaji: string | null;
  /** Yeni ve hâlâ PENDING: yazma sürüyor olabilir, geri alınamaz. */
  suruyor: boolean;
  /** Son geri alma (panelden ya da komut satırından): ne zaman, kim. */
  geriAlindi: Date | null;
  geriAlan: string | null;
}

function hataListesi(json: unknown): { satir: number; sebep: string; etiket: string }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    if (typeof x !== "object" || x === null) return [];
    const o = x as Record<string, unknown>;
    return [{ satir: Number(o.row) || 0, sebep: String(o.reason ?? ""), etiket: String(o.detail ?? "") }];
  });
}

export async function partiGecmisi(adet = 50): Promise<PartiSatiri[]> {
  const partiler = await db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: adet,
    select: {
      id: true,
      filename: true,
      status: true,
      totalRows: true,
      createdCount: true,
      skippedCount: true,
      errors: true,
      createdByStaff: true,
      createdAt: true,
      rolledBackAt: true,
      rolledBackByStaff: true,
      _count: { select: { questions: true } },
    },
  });
  const idler = partiler.map((p) => p.id);
  const [durumlar, korunanlar, notlular, duzenlenenler] = idler.length
    ? await Promise.all([
        db.question.groupBy({ by: ["importBatchId", "status"], where: { importBatchId: { in: idler } }, _count: { _all: true } }),
        // Geri almanın kendi kuralıyla (tersi): sorulmuş, denemede ya da notlu.
        db.question.groupBy({
          by: ["importBatchId"],
          where: { importBatchId: { in: idler }, NOT: GERI_ALMADA_SILINEBILIR },
          _count: { _all: true },
        }),
        db.question.groupBy({
          by: ["importBatchId"],
          where: { importBatchId: { in: idler }, items: { none: {} }, packageLinks: { none: {} }, notes: { some: {} } },
          _count: { _all: true },
        }),
        // Silinecekler arasında sonradan düzenlenenler (yalnızca onay metni için).
        // İçe aktarma iki damgayı aynı yazar; sonra başka biri kaydederse ayrışır.
        db.question.groupBy({
          by: ["importBatchId"],
          where: {
            importBatchId: { in: idler },
            ...GERI_ALMADA_SILINEBILIR,
            OR: [{ version: { gt: 1 } }, { updatedByStaff: { not: { equals: db.question.fields.createdByStaff } } }],
          },
          _count: { _all: true },
        }),
      ])
    : [[], [], [], []];
  const sayi = (liste: { importBatchId: string | null; _count: { _all: number } }[], id: string) =>
    liste.find((c) => c.importBatchId === id)?._count._all ?? 0;

  const simdi = Date.now();
  return partiler.map((p) => {
    const hatalar = hataListesi(p.errors);
    const basarisiz = p.status === "FAILED";
    return {
      id: p.id,
      dosyaAdi: p.filename,
      durum: p.status,
      durumEtiketi: PARTI_DURUM_ETIKETI[p.status] ?? p.status,
      tarih: p.createdAt,
      kim: p.createdByStaff,
      toplam: p.totalRows,
      alinan: p.createdCount,
      atlanan: p.skippedCount,
      kalan: p._count.questions,
      durumlar: Object.fromEntries(
        durumlar.filter((d) => d.importBatchId === p.id).map((d) => [d.status, d._count._all])
      ),
      korunacak: sayi(korunanlar, p.id),
      notlu: sayi(notlular, p.id),
      duzenlenen: sayi(duzenlenenler, p.id),
      atlananlar: basarisiz ? [] : hatalar.filter((h) => h.satir > 0),
      hataMesaji: basarisiz ? (hatalar[0]?.sebep ?? "Bilinmeyen hata") : null,
      suruyor: p.status === "PENDING" && simdi - p.createdAt.getTime() < SURUYOR_MS,
      geriAlindi: p.rolledBackAt,
      geriAlan: p.rolledBackByStaff,
    };
  });
}

/** Soru listesinin "parti" süzgeci için: dosya adı ve tarih. */
export async function partiBilgisi(id: string): Promise<{ dosyaAdi: string; tarih: Date } | null> {
  const p = await db.importBatch.findUnique({ where: { id }, select: { filename: true, createdAt: true } });
  return p ? { dosyaAdi: p.filename, tarih: p.createdAt } : null;
}
