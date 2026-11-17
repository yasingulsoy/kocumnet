// Prisma 7 yapılandırması. Dosya adı bilerek `prisma7.config.ts`: Prisma 7.10
// önce bu adı arar (node_modules/@prisma/config, PRISMA7_CONFIG_FILE_CANDIDATES).
// Bağlantı adresi şemada DEĞİL burada; şemadaki datasource bloğunda `url` yok.
// Uygulamanın kendisi bu dosyayı kullanmaz: bağlantıyı src/db.ts sürücü
// bağdaştırıcısıyla (PrismaPg) kurar. Bu dosya yalnızca prisma CLI içindir
// (generate, migrate deploy, migrate diff).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` ve `migrate diff --from-empty` bağlantı istemez;
    // derleme ortamında DATABASE_URL olmayabilir, o yüzden env() değil.
    url: process.env["DATABASE_URL"],
    // Yalnızca `npm run db:denetle` doldurur (scripts/db-denetle.ts geçici bir
    // gölge veritabanı açıp siler): `migrate diff --from-migrations` bunu ister.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
