import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Kullanıcı başına "başlatma" kilidi — işlem (transaction) süresince.
 *
 * Sorun: test, kontrol testi, seviyeli koşu ve alıştırma başlatan yolların
 * hepsi önce "açık oturum var mı?" diye bakıp yoksa yenisini yazıyordu. İki
 * sekme (ya da çift dokunuş) aynı anda gelince ikisi de "yok" görüyor ve
 * öğrencinin aynı paketten iki açık testi, aynı sınavdan iki seviyeli koşusu
 * oluyordu; günlük sınırlar da bir fazla aşılabiliyordu.
 *
 * Çözüm: oluşturan işlemin başında bu kilit alınır, "açık oturum var mı?" ve
 * günlük sınır denetimi kilitten SONRA, aynı işlemin içinde yeniden yapılır.
 * İkinci sekme kilidi bekler; aldığında birincinin yazdığı oturumu görür ve
 * onu döner. Kilit kullanıcıya özel: başka öğrencilerin başlatmaları
 * birbirini beklemez.
 *
 * İşlem düzeyinde (pg_advisory_XACT_lock): işlem bitince (onay, geri alma,
 * zaman aşımı) kendiliğinden kalkar. Oturum düzeyindeki kilidi bağlantı
 * havuzunda başka bir bağlantı bırakmaya çalışabilirdi (app/api/cron/bakim.ts).
 *
 * Anahtar iki int4: ad alanı + hashtext(userId). İki anahtarlı kilitler tek
 * anahtarlılarla çakışmaz; bakımın kilidi ("kocm", "cron") başka bir ad
 * alanında. hashtext çakışması (iki öğrencinin aynı sayıya düşmesi) yalnızca
 * o iki öğrencinin başlatmalarını sıraya sokar; doğruluğu bozmaz.
 *
 * Kilidi bekleme süresi işlemin zaman aşımına sayılır. Başlatma işlemleri
 * kısa (birkaç yazım); bekleyen ikinci sekme ilkinin bitmesini bekler.
 */

/** Ad alanı: "bslt" (başlat). Başka bir kullanıcı kilidi gerekirse farklı ad alanı seçsin. */
const BASLAT_AD_ALANI = 0x62736c74;

export async function baslatmaKilidi(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  /*
   * $executeRaw: pg_advisory_xact_lock "void" döner; $queryRaw o sütunu
   * çözmeye çalışıp hata verebiliyor. Etkilenen satır sayısı bizi ilgilendirmiyor.
   */
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BASLAT_AD_ALANI}::int4, hashtext(${userId}))`;
}
