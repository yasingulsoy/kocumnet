"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/checkup/db";
import { DAVET_KODU_DENEME, davetBaglantisi, davetKoduUret } from "@/lib/checkup/davet";
import { EXAM_SCOPES } from "@/lib/checkup/format";
import { uygulamaAdresi } from "@/lib/checkup/uygulama";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import {
  ARAMA_EN_AZ,
  ARAMA_SONUC_SINIRI,
  GRUP_ADI_SINIRI,
  GRUP_NOTU_SINIRI,
  ODEV_BASLIGI_SINIRI,
  ODEV_NOTU_SINIRI,
  ODEV_PAKET_TURLERI,
  TOPLU_EKLEME_SINIRI,
  TOPLU_METIN_SINIRI,
  cokSatir,
  epostaListesiAyristir,
  odevKonuSinavi,
  tekSatir,
} from "@/lib/checkup/grup-kurallari";
import { ODEV_SORU_ALT, ODEV_SORU_UST, odevBasligi, sonTarihDenetle, trTarih } from "@/lib/checkup/shared/odev";
import { denemeYayinEngelleri } from "@/lib/checkup/mock";
import { soruSinavdaKosulu } from "@/lib/checkup/shared/exam-scope";

/**
 * Koçluk grupları ve ödevler — yazma. Yalnızca yönetici ve müdür (MANAGE):
 * grup bir öğrenci listesidir, öğrenci listesi kişisel veridir (KVKK).
 * Menüde görünmemek yetki değil; her eylem burada yeniden denetler.
 *
 * Personel başka veritabanında: kuran, ekleyen, iptal eden "e-posta (#id)"
 * damgası (staffStamp). Günlüğe içerik değil yalnızca kim, ne, hangi kayıt yazılır.
 *
 * Gruba eklenen öğrenciye bildirim gitmez: ödevini kendi ekranında görür.
 */

type Yanit<T = object> = ({ ok: true } & T) | { ok: false; error: string; fields?: Record<string, string> };

const KIMLIK = z.string().regex(/^[a-z0-9]{6,64}$/i);

function alanHatalari(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

function tazele(groupId?: string) {
  revalidatePath("/checkup/gruplar");
  if (groupId) revalidatePath("/checkup/gruplar/" + groupId);
}

// ─────────────────────────────────────────────────────────────
// Grup
// ─────────────────────────────────────────────────────────────

const grupSemasi = z.object({
  id: KIMLIK.optional(),
  name: z
    .string()
    .max(GRUP_ADI_SINIRI * 4)
    .transform(tekSatir)
    .pipe(
      z
        .string()
        .min(2, "Grup adı en az 2 karakter.")
        .max(GRUP_ADI_SINIRI, `Grup adı en fazla ${GRUP_ADI_SINIRI} karakter.`)
    ),
  // Boş = sınavsız grup (karışık sınıf). Eski "BOTH" değeri seçilemez.
  examScope: z.union([z.literal(""), z.enum(EXAM_SCOPES)]),
  note: z
    .string()
    .max(GRUP_NOTU_SINIRI * 4)
    .transform(cokSatir)
    .pipe(z.string().max(GRUP_NOTU_SINIRI, `Not en fazla ${GRUP_NOTU_SINIRI} karakter.`)),
});

/** Grup oluştur (id yok) ya da düzenle (id var). */
export async function grupKaydetAction(girdi: unknown): Promise<Yanit<{ id: string }>> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const p = grupSemasi.safeParse(girdi);
  if (!p.success) return { ok: false, error: "Formu kontrol et.", fields: alanHatalari(p.error) };
  const { id, name, examScope, note } = p.data;
  const veri = { name, examScope: examScope || null, note: note || null };
  const damga = staffStamp(auth.staff);

  if (id) {
    const r = await db.studyGroup.updateMany({ where: { id }, data: veri });
    if (r.count === 0) return { ok: false, error: "Grup bulunamadı." };
    console.info("[checkup] grup düzenlendi — " + id + " · " + damga);
    tazele(id);
    return { ok: true, id };
  }

  const g = await db.studyGroup.create({ data: { ...veri, createdByStaff: damga }, select: { id: true } });
  console.info("[checkup] grup oluşturuldu — " + g.id + " · " + damga);
  tazele();
  return { ok: true, id: g.id };
}

/**
 * Arşivle (arsivle=true) ya da geri al. Arşivdeki grubun ödevleri öğrenciden
 * kalkar (lib/odev.ts ogrenciGorur); üyeler ve ödevler silinmez. Arşivlerken
 * davet bağlantısı da kapanır: dağıtılmış bir bağlantıyla kapalı gruba
 * katılım olmasın. Arşivden alınca davet kapalı kalır, koç yenisini açar.
 */
export async function grupArsivAction(id: unknown, arsivle: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const k = KIMLIK.safeParse(id);
  if (!k.success || typeof arsivle !== "boolean") return { ok: false, error: "Geçersiz istek." };

  // Koşul güncellemenin içinde: ilk arşivleme anı ikinci basışta ezilmesin.
  const r = await db.studyGroup.updateMany({
    where: { id: k.data, archivedAt: arsivle ? null : { not: null } },
    data: arsivle ? { archivedAt: new Date(), joinCode: null } : { archivedAt: null },
  });
  if (r.count === 0 && !(await db.studyGroup.findUnique({ where: { id: k.data }, select: { id: true } }))) {
    return { ok: false, error: "Grup bulunamadı." };
  }
  if (r.count > 0) {
    console.info("[checkup] grup " + (arsivle ? "arşivlendi" : "arşivden alındı") + " — " + k.data + " · " + staffStamp(auth.staff));
  }
  tazele(k.data);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Üyeler
// ─────────────────────────────────────────────────────────────

export interface AramaSonucu {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  targetExam: string | null;
  uye: boolean;
}

/** E-posta ya da adla öğrenci ara (en az ARAMA_EN_AZ harf, en çok ARAMA_SONUC_SINIRI sonuç). */
export async function ogrenciAraAction(groupId: unknown, sorgu: unknown): Promise<Yanit<{ sonuclar: AramaSonucu[] }>> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const g = KIMLIK.safeParse(groupId);
  if (!g.success || typeof sorgu !== "string" || sorgu.length > 200) return { ok: false, error: "Geçersiz istek." };

  const q = tekSatir(sorgu).slice(0, 100);
  if (q.length < ARAMA_EN_AZ) return { ok: true, sonuclar: [] };

  const satirlar = await db.user.findMany({
    where: {
      role: "STUDENT",
      OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: ARAMA_SONUC_SINIRI,
    select: {
      id: true,
      name: true,
      email: true,
      grade: true,
      targetExam: true,
      groupMemberships: { where: { groupId: g.data }, select: { id: true } },
    },
  });
  return {
    ok: true,
    sonuclar: satirlar.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      grade: u.grade,
      targetExam: u.targetExam,
      uye: u.groupMemberships.length > 0,
    })),
  };
}

export async function uyeEkleAction(groupId: unknown, userId: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const g = KIMLIK.safeParse(groupId);
  const u = KIMLIK.safeParse(userId);
  if (!g.success || !u.success) return { ok: false, error: "Geçersiz istek." };

  const [grup, ogrenci] = await Promise.all([
    db.studyGroup.findUnique({ where: { id: g.data }, select: { archivedAt: true } }),
    db.user.findUnique({ where: { id: u.data }, select: { role: true } }),
  ]);
  if (!grup) return { ok: false, error: "Grup bulunamadı." };
  if (grup.archivedAt) return { ok: false, error: "Arşivdeki gruba üye eklenmez; önce arşivden al." };
  if (!ogrenci || ogrenci.role !== "STUDENT") return { ok: false, error: "Öğrenci bulunamadı." };

  const damga = staffStamp(auth.staff);
  // Zaten üyeyse (ya da iki kez basıldıysa) sonuç aynı: çakışma hata değil. skipDuplicates,
  // yakalanan P2002'nin Prisma günlüğüne "error" diye düşmesini de önlüyor.
  const r = await db.groupMember.createMany({
    data: [{ groupId: g.data, userId: u.data, addedByStaff: damga }],
    skipDuplicates: true,
  });
  if (r.count > 0) console.info("[checkup] gruba üye eklendi — grup " + g.data + " · öğrenci " + u.data + " · " + damga);
  tazele(g.data);
  return { ok: true };
}

export interface TopluEklemeSonucu {
  eklendi: number;
  zatenUye: number;
  /** Kayıtlı öğrenci bulunamayan e-postalar (koçun yapıştırdığı liste; yeni kişisel veri değil). */
  kayitYok: string[];
  /** "@" içeren ama e-posta olmayan parçalar: yazım hatası. */
  gecersiz: string[];
}

/**
 * Toplu ekleme: yapıştırılan e-posta listesinden kayıtlı öğrencileri gruba
 * ekler. Kayıtlı olmayanlar eklenmez, listelenir: koç onlara davet
 * bağlantısını gönderir. Öğrenci olmayan hesap (personel) "kayıt yok" sayılır.
 * Tek sorguyla bulunur, tek sorguyla eklenir (skipDuplicates: aynı anda
 * davetle katılan öğrenci çakışma hatası vermesin).
 */
export async function topluUyeEkleAction(groupId: unknown, metin: unknown): Promise<Yanit<TopluEklemeSonucu>> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const g = KIMLIK.safeParse(groupId);
  if (!g.success || typeof metin !== "string") return { ok: false, error: "Geçersiz istek." };
  if (metin.length > TOPLU_METIN_SINIRI) {
    return { ok: false, error: "Liste çok uzun; bir seferde en çok " + TOPLU_EKLEME_SINIRI + " e-posta yapıştır." };
  }

  const { gecerli, gecersiz } = epostaListesiAyristir(metin);
  if (gecerli.length === 0) {
    return {
      ok: false,
      error: gecersiz.length ? "Listede geçerli e-posta yok: " + gecersiz.slice(0, 3).join(", ") : "Listede e-posta yok.",
    };
  }
  if (gecerli.length > TOPLU_EKLEME_SINIRI) {
    return { ok: false, error: "Bir seferde en çok " + TOPLU_EKLEME_SINIRI + " e-posta; listede " + gecerli.length + " var." };
  }

  const grup = await db.studyGroup.findUnique({ where: { id: g.data }, select: { archivedAt: true } });
  if (!grup) return { ok: false, error: "Grup bulunamadı." };
  if (grup.archivedAt) return { ok: false, error: "Arşivdeki gruba üye eklenmez; önce arşivden al." };

  const ogrenciler = await db.user.findMany({
    where: { role: "STUDENT", email: { in: gecerli, mode: "insensitive" } },
    select: { id: true, email: true, groupMemberships: { where: { groupId: g.data }, select: { id: true } } },
  });
  const bulunan = new Set(ogrenciler.map((u) => u.email.toLowerCase()));
  const yeni = ogrenciler.filter((u) => u.groupMemberships.length === 0);

  const damga = staffStamp(auth.staff);
  const r =
    yeni.length > 0
      ? await db.groupMember.createMany({
          data: yeni.map((u) => ({ groupId: g.data, userId: u.id, addedByStaff: damga })),
          skipDuplicates: true,
        })
      : { count: 0 };
  if (r.count > 0) {
    console.info("[checkup] gruba toplu üye eklendi — grup " + g.data + " · " + r.count + " öğrenci · " + damga);
  }
  tazele(g.data);
  return {
    ok: true,
    eklendi: r.count,
    // Bu arada davetle katılan da "zaten üye" sayılır.
    zatenUye: ogrenciler.length - r.count,
    kayitYok: gecerli.filter((e) => !bulunan.has(e)),
    gecersiz,
  };
}

/** Üyeyi çıkar. Öğrencinin oturumları ve sonuçları durur; yalnızca grubun ödevlerini görmez olur. */
export async function uyeCikarAction(groupId: unknown, userId: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const g = KIMLIK.safeParse(groupId);
  const u = KIMLIK.safeParse(userId);
  if (!g.success || !u.success) return { ok: false, error: "Geçersiz istek." };

  const r = await db.groupMember.deleteMany({ where: { groupId: g.data, userId: u.data } });
  if (r.count > 0) {
    console.info("[checkup] gruptan üye çıkarıldı — grup " + g.data + " · öğrenci " + u.data + " · " + staffStamp(auth.staff));
  }
  tazele(g.data);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Davet bağlantısı
// ─────────────────────────────────────────────────────────────

/**
 * Davet bağlantısını aç ("olustur"), yenile ya da kapat. Biçim ve neden
 * davet.ts'te; öğrencinin katılması uygulamada (app/lib/grup-katilim.ts).
 * Yetki grup yönetimiyle aynı (MANAGE).
 *
 *  - olustur: kod zaten varsa aynısı döner (iki kez basmak bağlantıyı
 *    değiştirmesin; dağıtılmış bağlantı bozulmasın).
 *  - yenile:  yeni kod; eski bağlantı artık çalışmaz (yanlış yere gitti).
 *  - kapat:   kod silinir, davet kapanır; üyeler kalır.
 *
 * Kod benzersiz (@unique): çakışırsa (2^40 olasılıkta pratikte olmaz) yeniden üretilir.
 */
export async function davetAction(
  groupId: unknown,
  islem: unknown
): Promise<Yanit<{ kod: string | null; baglanti: string | null }>> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const g = KIMLIK.safeParse(groupId);
  if (!g.success || (islem !== "olustur" && islem !== "yenile" && islem !== "kapat")) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const grup = await db.studyGroup.findUnique({ where: { id: g.data }, select: { archivedAt: true, joinCode: true } });
  if (!grup) return { ok: false, error: "Grup bulunamadı." };
  const damga = staffStamp(auth.staff);

  if (islem === "kapat") {
    if (grup.joinCode) {
      await db.studyGroup.update({ where: { id: g.data }, data: { joinCode: null } });
      console.info("[checkup] grup daveti kapatıldı — " + g.data + " · " + damga);
    }
    tazele(g.data);
    return { ok: true, kod: null, baglanti: null };
  }

  if (grup.archivedAt) return { ok: false, error: "Arşivdeki grubun daveti açılmaz; önce arşivden al." };
  if (islem === "olustur" && grup.joinCode) {
    return { ok: true, kod: grup.joinCode, baglanti: davetBaglantisi(uygulamaAdresi(), grup.joinCode) };
  }

  for (let deneme = 0; deneme < DAVET_KODU_DENEME; deneme++) {
    const kod = davetKoduUret();
    try {
      await db.studyGroup.update({ where: { id: g.data }, data: { joinCode: kod } });
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === "P2002") continue;
      throw e;
    }
    // Kodun kendisi günlüğe yazılmaz: günlüğü okuyan gruba katılamasın.
    console.info("[checkup] grup daveti " + (islem === "yenile" ? "yenilendi" : "açıldı") + " — " + g.data + " · " + damga);
    tazele(g.data);
    return { ok: true, kod, baglanti: davetBaglantisi(uygulamaAdresi(), kod) };
  }
  return { ok: false, error: "Davet kodu üretilemedi; bir kez daha dene." };
}

// ─────────────────────────────────────────────────────────────
// Ödevler
// ─────────────────────────────────────────────────────────────

const odevSemasi = z
  .object({
    groupId: KIMLIK,
    kind: z.enum(["PACKAGE", "TOPIC_PRACTICE"]),
    packageId: z.union([z.literal(""), KIMLIK]),
    topicId: z.union([z.literal(""), KIMLIK]),
    questionCount: z.coerce
      .number()
      .int("Soru sayısı tam sayı olmalı.")
      .min(ODEV_SORU_ALT, `En az ${ODEV_SORU_ALT} soru.`)
      .max(ODEV_SORU_UST, `En fazla ${ODEV_SORU_UST} soru.`)
      .optional(),
    title: z
      .string()
      .max(ODEV_BASLIGI_SINIRI * 4)
      .transform(tekSatir)
      .pipe(z.string().max(ODEV_BASLIGI_SINIRI, `Başlık en fazla ${ODEV_BASLIGI_SINIRI} karakter.`)),
    note: z
      .string()
      .max(ODEV_NOTU_SINIRI * 4)
      .transform(cokSatir)
      .pipe(z.string().max(ODEV_NOTU_SINIRI, `Açıklama en fazla ${ODEV_NOTU_SINIRI} karakter.`)),
    dueDate: z.string().max(10),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "PACKAGE" && !v.packageId) ctx.addIssue({ code: "custom", path: ["packageId"], message: "Paket seç." });
    if (v.kind === "TOPIC_PRACTICE" && !v.topicId) ctx.addIssue({ code: "custom", path: ["topicId"], message: "Konu seç." });
    if (v.kind === "TOPIC_PRACTICE" && v.questionCount === undefined) {
      ctx.addIssue({ code: "custom", path: ["questionCount"], message: "Soru sayısını yaz." });
    }
  });

/**
 * Ödev ver. Başlangıç şimdi (startsAt): öncesinde çözülen test ödevi
 * tamamlamaz. Son tarih seçilen günün 23:59'u, Türkiye saati.
 */
export async function odevOlusturAction(girdi: unknown): Promise<Yanit<{ id: string }>> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const p = odevSemasi.safeParse(girdi);
  if (!p.success) return { ok: false, error: "Formu kontrol et.", fields: alanHatalari(p.error) };
  const v = p.data;

  const now = new Date();
  const tarih = sonTarihDenetle(v.dueDate, now);
  if (!tarih.ok) return { ok: false, error: "Formu kontrol et.", fields: { dueDate: tarih.hata } };
  const dueAt = tarih.dueAt;

  const grup = await db.studyGroup.findUnique({ where: { id: v.groupId }, select: { archivedAt: true, examScope: true } });
  if (!grup) return { ok: false, error: "Grup bulunamadı." };
  if (grup.archivedAt) return { ok: false, error: "Arşivdeki gruba ödev verilmez; önce arşivden al." };

  let otomatikBaslik: string;
  if (v.kind === "PACKAGE") {
    const paket = await db.package.findUnique({
      where: { id: v.packageId },
      select: { name: true, status: true, kind: true },
    });
    if (!paket || paket.status !== "PUBLISHED" || !(ODEV_PAKET_TURLERI as readonly string[]).includes(paket.kind)) {
      return { ok: false, error: "Formu kontrol et.", fields: { packageId: "Yalnızca yayındaki test ve denemeler ödev olabilir." } };
    }
    // Deneme ayrıca HAZIR olmalı (liste tam ve hepsi yayında; öğrencinin kuralı,
    // shared/deneme.ts): yoksa öğrenci ödevi açınca "hazırlanıyor" görür, ödev
    // tamamlanamaz. Yayında olmak yetmiyor: soru sonradan arşivlenmiş olabilir.
    if (paket.kind === "MOCK") {
      const engeller = await denemeYayinEngelleri(v.packageId);
      if (engeller?.length) {
        return {
          ok: false,
          error: "Formu kontrol et.",
          fields: { packageId: "Bu deneme hazır değil, öğrenci başlatamaz: " + engeller.join(" ") },
        };
      }
    }
    otomatikBaslik = odevBasligi({ kind: "PACKAGE", paketAdi: paket.name });
  } else {
    const konu = await db.topic.findUnique({
      where: { id: v.topicId },
      select: { name: true, examScope: true, examScopes: true },
    });
    if (!konu) return { ok: false, error: "Formu kontrol et.", fields: { topicId: "Konu bulunamadı." } };
    // Havuz, öğrencinin alıştırmasının seçeceği sınavda sayılır (ödev formunun
    // sayımıyla aynı kural: grup-kurallari.ts odevKonuSinavi).
    const sinav = odevKonuSinavi(grup.examScope, konu);
    const havuz = await db.question.count({
      where: { AND: [{ topicId: v.topicId, status: "PUBLISHED" }, sinav ? soruSinavdaKosulu(sinav) : {}] },
    });
    if (havuz === 0) {
      return { ok: false, error: "Formu kontrol et.", fields: { topicId: "Bu konuda bu sınavda sorulabilen yayında soru yok." } };
    }
    otomatikBaslik = odevBasligi({ kind: "TOPIC_PRACTICE", konuAdi: konu.name, soruSayisi: v.questionCount! });
  }

  const damga = staffStamp(auth.staff);
  const odev = await db.assignment.create({
    data: {
      groupId: v.groupId,
      kind: v.kind,
      packageId: v.kind === "PACKAGE" ? v.packageId : null,
      topicId: v.kind === "TOPIC_PRACTICE" ? v.topicId : null,
      questionCount: v.kind === "TOPIC_PRACTICE" ? v.questionCount! : null,
      // Boş başlık: otomatik başlık (paket adı / "Konu: N soru alıştırma").
      title: (v.title || otomatikBaslik).slice(0, ODEV_BASLIGI_SINIRI),
      note: v.note || null,
      startsAt: now,
      dueAt,
      createdByStaff: damga,
    },
    select: { id: true },
  });
  console.info("[checkup] ödev verildi — grup " + v.groupId + " · ödev " + odev.id + " · " + damga);
  tazele(v.groupId);
  return { ok: true, id: odev.id };
}

/** Ödevi iptal et: öğrenciden kalkar, panelde "iptal" olarak durur. Geri alınmaz. */
export async function odevIptalAction(id: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const k = KIMLIK.safeParse(id);
  if (!k.success) return { ok: false, error: "Geçersiz istek." };

  const odev = await db.assignment.findUnique({ where: { id: k.data }, select: { groupId: true } });
  if (!odev) return { ok: false, error: "Ödev bulunamadı." };

  const damga = staffStamp(auth.staff);
  // İlk iptalin damgası ikinci basışta ezilmesin.
  const r = await db.assignment.updateMany({
    where: { id: k.data, cancelledAt: null },
    data: { cancelledAt: new Date(), cancelledByStaff: damga },
  });
  if (r.count > 0) console.info("[checkup] ödev iptal edildi — " + k.data + " · " + damga);
  tazele(odev.groupId);
  return { ok: true };
}

/**
 * Son tarihi uzat (iptal etmeden). Yeni gün eskisinden sonra ve en geç
 * EN_UZAK_SURE_GUN gün sonra (shared/odev.ts sonTarihDenetle). Tamamlanma
 * türetildiği için eski ile yeni son tarih arasında bitirenler kendiliğinden
 * "zamanında" sayılır.
 *
 * Kim ve ne zaman uzattı KALICI tutulmuyor: Assignment'ta bunun için alan
 * yok ve koçun öğrenciye görünen notu (note) damga yeri değil. İz yalnızca
 * sunucu günlüğünde ("e-posta (#id)", eski → yeni gün).
 */
export async function odevSureUzatAction(id: unknown, yeniGun: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const k = KIMLIK.safeParse(id);
  if (!k.success || typeof yeniGun !== "string" || yeniGun.length > 10) return { ok: false, error: "Geçersiz istek." };

  const odev = await db.assignment.findUnique({
    where: { id: k.data },
    select: { groupId: true, dueAt: true, cancelledAt: true, group: { select: { archivedAt: true } } },
  });
  if (!odev) return { ok: false, error: "Ödev bulunamadı." };
  if (odev.cancelledAt) return { ok: false, error: "İptal edilen ödevin süresi uzatılmaz; gerekirse yeniden ver." };
  if (odev.group.archivedAt) return { ok: false, error: "Arşivdeki grubun ödevi uzatılmaz; önce arşivden al." };

  const tarih = sonTarihDenetle(yeniGun, new Date(), odev.dueAt);
  if (!tarih.ok) return { ok: false, error: tarih.hata };

  // Koşul güncellemenin içinde: iki kişi aynı anda uzatırsa ikincisi eskiyi görmüş sayılmasın.
  const r = await db.assignment.updateMany({
    where: { id: k.data, cancelledAt: null, dueAt: odev.dueAt },
    data: { dueAt: tarih.dueAt },
  });
  if (r.count === 0) return { ok: false, error: "Ödev bu arada değişti; sayfayı yenile." };

  console.info(
    "[checkup] ödev süresi uzatıldı — " + k.data + " · " + trTarih(odev.dueAt) + " → " + yeniGun + " · " + staffStamp(auth.staff)
  );
  tazele(odev.groupId);
  return { ok: true };
}
