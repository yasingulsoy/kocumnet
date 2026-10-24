import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { ExamScope, Grade, Role } from "@/lib/generated/prisma/enums";
import { hashPassword } from "@/lib/password";
import { grubaKatil, type KatilimSonucu } from "@/lib/grup-katilim";
import {
  ISTENEN_YOL_BASLIGI,
  OTURUM_GUN,
  OTURUM_UZATMA_ESIGI_GUN,
  SESSION_COOKIE,
  SON_ETKINLIK_ARALIGI_MS,
  girisYolu,
  guvenliSonra,
  kayitKaynagi,
  oturumUzatilmali,
  sonEtkinlikYazilmali,
  yeniOturumBitisi,
} from "@/lib/hesap-kurallari";

// Çerezin adı ve süreleri saf modülde: proxy.ts de okuyor (çerezi yeniliyor).
export { SESSION_COOKIE };

/**
 * Çerezdeki token'ın SHA-256'sı saklanır, token'ın kendisi saklanmaz.
 * Veritabanı sızarsa saldırgan geçerli bir çerez üretemez.
 * (Parolanın aksine burada yavaş KDF gerekmez: token 256 bit rastgele,
 * sözlük saldırısına konu değil.)
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /*
   * Tanışma bilgileri oturumla birlikte geliyor: katalog, pano ve koçluk
   * metinleri hepsi bunlara bakıyor. Ayrı sorgu açmak yerine zaten okunan
   * satırdan getiriyoruz.
   */
  grade: Grade | null;
  targetExam: ExamScope | null;
  targetNet: number | null;
  weeklyTestGoal: number;
  onboardedAt: Date | null;
}

/**
 * Oturum açar. YALNIZCA Server Action veya Route Handler içinde çağrılabilir —
 * Next.js, Server Component render'ı sırasında çerez yazılmasına izin vermez.
 */
export async function createSession(userId: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = yeniOturumBitisi(new Date());

  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // localhost http üzerinden çalışır; secure'u sabit true yapmak geliştirmede
    // oturumu tamamen kırar.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Süre veritabanındaki bitişle aynı; proxy.ts her sayfa isteğinde aynı
    // süreyle yeniler (kayan oturum). Asıl geçerlilik expiresAt'te.
    maxAge: OTURUM_GUN * 86_400,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Satırı siliyoruz: çerez silinse bile veritabanındaki oturum geçerli
    // kalırsa çalınmış bir token çıkışa rağmen kullanılabilir.
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Geçerli kullanıcı. React `cache` ile aynı istek içinde tek sorguya iner —
 * layout, sayfa ve bileşenler ayrı ayrı çağırsa da veritabanına bir kez gidilir.
 *
 * Oturumla gelen her isteğin geçtiği tek yer olduğu için iki bakım da burada,
 * ikisi de KOŞULLU ve çoğu istekte hiç sorgu açmaz:
 *  - kayan oturum: kalan süre 15 günün altındaysa bitiş 30 güne uzar
 *    (oturumuUzat). Çerezi proxy.ts yeniler; Server Component çerez yazamaz.
 *  - son etkinlik: User.lastSeenAt saatte en fazla bir kez (sonEtkinligiYaz).
 * Yazma hatası sayfayı düşürmez: ikisi de bir sonraki istekte yeniden denenir.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          grade: true,
          targetExam: true,
          targetNet: true,
          weeklyTestGoal: true,
          onboardedAt: true,
          lastSeenAt: true,
        },
      },
    },
  });

  if (!session) return null;
  // Süresi geçmiş oturumu geçerli sayma ve UZATMA: süresi dolan oturum
  // canlanmasın. Temizliği burada yapmıyoruz; süresi geçenleri bakım siler.
  const simdi = new Date();
  if (session.expiresAt < simdi) return null;

  // lastSeenAt arayüze gitmez: yalnızca aşağıdaki koşul için okunuyor.
  const { lastSeenAt, ...kullanici } = session.user;

  const bakim: Promise<unknown>[] = [];
  if (oturumUzatilmali(session.expiresAt, simdi)) bakim.push(oturumuUzat(session.id, simdi));
  if (sonEtkinlikYazilmali(lastSeenAt, simdi)) bakim.push(sonEtkinligiYaz(kullanici.id, simdi));
  if (bakim.length > 0) {
    for (const r of await Promise.allSettled(bakim)) {
      if (r.status === "rejected") console.error("[oturum] bakım yazılamadı:", r.reason);
    }
  }

  // Decimal -> number: arayüzün tamamı sayı bekliyor, Decimal'i istemciye
  // taşımak serileştirme sorunlarına yol açıyor.
  return {
    ...kullanici,
    targetNet: kullanici.targetNet === null ? null : Number(kullanici.targetNet),
  };
});

/**
 * Oturumun bitişini OTURUM_GUN'e uzatır; yalnızca kalan süre hâlâ eşiğin
 * altındaysa (koşul sorguda: aynı anda gelen iki istek iki kez yazmasın) ve
 * oturum hâlâ duruyorsa. Parola sıfırlama bütün oturumları SİLER; silinmiş
 * satır uzatılamaz, kural bozulmaz.
 */
export async function oturumuUzat(oturumId: string, now: Date): Promise<number> {
  const esik = new Date(now.getTime() + OTURUM_UZATMA_ESIGI_GUN * 86_400_000);
  const { count } = await prisma.authSession.updateMany({
    where: { id: oturumId, expiresAt: { gt: now, lt: esik } },
    data: { expiresAt: yeniOturumBitisi(now) },
  });
  return count;
}

/**
 * Son etkinliği yazar: yalnızca hiç yazılmamışsa ya da bir saatten eskiyse
 * (koşul sorguda). Döner: yazıldıysa 1.
 */
export async function sonEtkinligiYaz(userId: string, now: Date): Promise<number> {
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lte: new Date(now.getTime() - SON_ETKINLIK_ARALIGI_MS) } }],
    },
    data: { lastSeenAt: now },
  });
  return count;
}

/**
 * Girişe yönlendirme adresi: istenen sayfa `?sonra=` ile taşınır, girişten
 * sonra oraya dönülür. Yol proxy.ts'in eklediği başlıktan; başlık yoksa
 * (proxy'nin kapsamı dışında) düz /giris. Doğrulama guvenliSonra'da.
 */
export async function girisAdresi(): Promise<string> {
  const yol = (await headers()).get(ISTENEN_YOL_BASLIGI);
  return girisYolu(guvenliSonra(yol));
}

/**
 * Sayfalar için: oturum yoksa GİRİŞE YÖNLENDİRİR (fırlatmaz).
 *
 * Eskiden panel sayfaları `(await getCurrentUser())!` yazıyordu ve düzenin
 * yönlendirmesine güveniyordu. Next sayfayı düzenle PARALEL çizer: oturumu
 * dolan öğrenci istemci tarafında sayfa değiştirince düzen yeniden çalışmaz,
 * sayfa null kullanıcıyla çöker ve hata ekranı görürdü — giriş değil.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(await girisAdresi());
  if (!user.onboardedAt) redirect("/tanisma");
  return user;
}

/** Geçerli isteğin oturum özeti (tokenHash) — profil "bu cihaz" rozeti için. */
export async function currentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Giriş yapmanız gerekiyor.");
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type HesapAcSonucu =
  | { durum: "VAR" }
  | { durum: "ACILDI"; userId: string; katilim: KatilimSonucu | null };

/**
 * Kayıt formunun veritabanı işi (registerAction çağırır; scripts/hesap-test
 * doğrudan sınar). Çerez, hız sınırı ve posta eylemde kalır.
 *
 *  - `kaynak`: kocum.net bağlantısının `?k=` etiketi; izin listesinden
 *    geçer (lib/hesap-kurallari.ts kayitKaynagi), signupSource'a yazılır.
 *  - Kayıt da bir giriş: lastLoginAt ve lastSeenAt şimdi (panel "hiç
 *    girmedi" demesin).
 *  - `grupKodu`: davet bağlantısından geldiyse hesap açılınca o gruba
 *    katılır (lib/grup-katilim.ts). Kod kapanmışsa hesap yine açılır;
 *    katılım düşerse de (hata günlüğe) — öğrenci bağlantıya yeniden dokunabilir.
 */
export async function hesapAc(girdi: {
  name: string;
  email: string;
  password: string;
  grade?: Grade;
  kaynak: unknown;
  grupKodu: string | null;
  now?: Date;
}): Promise<HesapAcSonucu> {
  const simdi = girdi.now ?? new Date();
  const varMi = await prisma.user.findUnique({ where: { email: girdi.email }, select: { id: true } });
  if (varMi) return { durum: "VAR" };

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        name: girdi.name,
        email: girdi.email,
        passwordHash: await hashPassword(girdi.password),
        grade: girdi.grade,
        signupSource: kayitKaynagi(girdi.kaynak),
        lastLoginAt: simdi,
        lastSeenAt: simdi,
      },
      select: { id: true },
    });
  } catch (e) {
    // İki sekmeden aynı anda kayıt: benzersiz e-posta kısıtı yarışı kaybedene
    // 500 yerine "zaten var".
    if ((e as { code?: string }).code === "P2002") return { durum: "VAR" };
    throw e;
  }

  let katilim: KatilimSonucu | null = null;
  if (girdi.grupKodu) {
    try {
      katilim = await grubaKatil(prisma, girdi.grupKodu, user.id);
    } catch (e) {
      console.error("[kayit] gruba eklenemedi:", e);
    }
  }
  return { durum: "ACILDI", userId: user.id, katilim };
}

/** Süresi geçmiş oturumları siler. */
export async function pruneExpiredSessions() {
  const { count } = await prisma.authSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
