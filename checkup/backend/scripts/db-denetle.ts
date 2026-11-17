/**
 * `npm run db:denetle`: şema (prisma/schema.prisma) ile migration'lar
 * (prisma/migrations) eşit mi?
 *
 * `prisma migrate diff --from-migrations … --to-schema … --exit-code` bir gölge
 * veritabanı ister. Bu betik TEST_DATABASE_BASE_URL (yoksa DATABASE_URL)
 * sunucusunda geçici `checkup_test_golge_<rastgele>` açar, denetimi çalıştırır
 * ve veritabanını her durumda siler.
 *
 * Çıkış kodu: 0 eşit, 1 fark var ya da hata.
 */
import "dotenv/config";
import { adresleriGizle, prismaCalistir, rastgeleAd, sunucuAdresi, veritabaniAc, veritabaniSil } from "./pg-yardimci.js";

const sunucu = sunucuAdresi();
const ad = rastgeleAd("checkup_test_golge_");
let kod = 1;

try {
  const golge = await veritabaniAc(sunucu, ad);
  const sonuc = await prismaCalistir(
    ["migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema", "prisma/schema.prisma", "--exit-code"],
    { SHADOW_DATABASE_URL: golge }
  );
  if (sonuc.kod === 0) {
    console.log("✓ Şema ve migration'lar eşit.");
    kod = 0;
  } else if (sonuc.kod === 2) {
    console.error("✗ Şema ile migration'lar arasında fark var. Yeni bir migration yazın:");
    console.error("  npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script");
    console.error("  (gölge veritabanı için SHADOW_DATABASE_URL gerekir; bu betik kendisi açar)");
    const fark = await prismaCalistir(["migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema", "prisma/schema.prisma"], {
      SHADOW_DATABASE_URL: golge,
    });
    console.error(adresleriGizle(fark.cikti));
  } else {
    console.error("✗ Denetim çalıştırılamadı:\n" + adresleriGizle(sonuc.cikti));
  }
} catch (e) {
  console.error("✗ Denetim çalıştırılamadı:", adresleriGizle(e instanceof Error ? e.message : String(e)));
} finally {
  await veritabaniSil(sunucu, ad).catch((e: unknown) =>
    console.error(`! Gölge veritabanı silinemedi (${ad}):`, adresleriGizle(e instanceof Error ? e.message : String(e)))
  );
}

process.exit(kod);
