import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/**
 * Check-up veritabanı (kocumnet_checkup).
 *
 * Yönetim paneli iki sistemi yönetiyor: site tarafı (blog, personel) Express
 * backend'inin API'sinden, check-up tarafı doğrudan bu veritabanından beslenir.
 * Şemanın sahibi check-up uygulaması (app/) — burada migration çalıştırılmaz,
 * `prisma/checkup.prisma` yalnızca client üretmek için oradan kopyalanır.
 *
 * Prisma 7: bağlantı şemadan değil driver adapter'dan gelir; adaptersiz
 * client bağlanmıyor.
 */
function createClient() {
  const connectionString = process.env.CHECKUP_DATABASE_URL;
  if (!connectionString) {
    // Sessizce bağlanmaya çalışıp anlamsız bir soket hatası vermesin.
    throw new Error("CHECKUP_DATABASE_URL tanımlı değil — .env dosyasını kontrol et.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * next dev her HMR yenilemesinde modülü yeniden değerlendirir; globalThis'e
 * asmazsak her kayıtta yeni bir bağlantı havuzu açılır ve PostgreSQL
 * "too many clients" ile reddetmeye başlar.
 */
const globalForPrisma = globalThis as unknown as {
  checkupDb?: ReturnType<typeof createClient>;
};

export const db = globalForPrisma.checkupDb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.checkupDb = db;
}
