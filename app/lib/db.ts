import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma 7'de bağlantı artık şemadan değil driver adapter'dan gelir
 * (şemadaki `datasource` bloğunda `url` yok; migration URL'i prisma7.config.ts'ten okur).
 * Bu yüzden client'ı elle adapter vererek kuruyoruz.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Sessizce bağlanmaya çalışıp anlamsız bir soket hatası vermesin.
    throw new Error("DATABASE_URL tanımlı değil — .env dosyasını kontrol et.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * next dev'de her HMR yenilemesinde modül yeniden değerlendirilir. globalThis'e
 * asmazsak her kayıtta yeni bir bağlantı havuzu açılır ve PostgreSQL
 * "too many clients" ile reddetmeye başlar.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
