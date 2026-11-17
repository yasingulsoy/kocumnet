import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type Veritabani = PrismaClient;

/**
 * Prisma 7: bağlantı şemadan değil sürücü bağdaştırıcısından gelir (şemadaki
 * datasource bloğunda url yok). Havuz boyutu DATABASE_POOL_MAX ile (varsayılan 10).
 */
export function veritabaniOlustur(baglanti: string, havuz = 10): Veritabani {
  if (!baglanti) throw new Error("DATABASE_URL tanımlı değil; .env dosyasını kontrol edin.");
  return new PrismaClient({
    // log yok: CAKISMA/KULLANIMDA gibi yakalanıp Türkçe yanıta çevrilen hatalar
    // günlüğü doldurmasın. Beklenmeyen hatayı app.ts'teki hata işleyici yazar.
    adapter: new PrismaPg({ connectionString: baglanti, max: havuz }),
  });
}
