-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "YoneticiRolu" AS ENUM ('YONETICI', 'EDITOR');

-- CreateEnum
CREATE TYPE "SecimBicimi" AS ENUM ('KARMA', 'SABIT');

-- CreateEnum
CREATE TYPE "CheckupDurumu" AS ENUM ('DEVAM', 'BITTI');

-- CreateTable
CREATE TABLE "yoneticiler" (
    "id" SERIAL NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "eposta" TEXT NOT NULL,
    "parolaHash" TEXT NOT NULL,
    "rol" "YoneticiRolu" NOT NULL DEFAULT 'EDITOR',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yoneticiler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ogrenciler" (
    "id" SERIAL NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "eposta" TEXT NOT NULL,
    "parolaHash" TEXT NOT NULL,
    "kvkkOnay" TIMESTAMP(3) NOT NULL,
    "kaynak" TEXT,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ogrenciler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oturumlar" (
    "id" SERIAL NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "ogrenciId" INTEGER,
    "yoneticiId" INTEGER,
    "bitis" TIMESTAMP(3) NOT NULL,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oturumlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parola_sifirlamalari" (
    "id" SERIAL NOT NULL,
    "ogrenciId" INTEGER NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "bitis" TIMESTAMP(3) NOT NULL,
    "kullanildi" TIMESTAMP(3),
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parola_sifirlamalari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinavlar" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "ucretKurus" INTEGER NOT NULL DEFAULT 0,
    "yanlisGoturme" INTEGER NOT NULL DEFAULT 4,
    "aktif" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinavlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dersler" (
    "id" SERIAL NOT NULL,
    "sinavId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dersler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konular" (
    "id" SERIAL NOT NULL,
    "dersId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "konular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kazanimlar" (
    "id" SERIAL NOT NULL,
    "konuId" INTEGER NOT NULL,
    "kod" TEXT,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kazanimlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alt_kazanimlar" (
    "id" SERIAL NOT NULL,
    "kazanimId" INTEGER NOT NULL,
    "kod" TEXT,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "alt_kazanimlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorular" (
    "id" SERIAL NOT NULL,
    "sinavId" INTEGER NOT NULL,
    "dersId" INTEGER NOT NULL,
    "konuId" INTEGER NOT NULL,
    "kazanimId" INTEGER NOT NULL,
    "altKazanimId" INTEGER NOT NULL,
    "metin" TEXT NOT NULL,
    "metinHtml" TEXT NOT NULL,
    "gorselId" TEXT,
    "cozum" TEXT NOT NULL,
    "cozumHtml" TEXT NOT NULL,
    "zorluk" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "iceAktarmaId" INTEGER,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sorular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siklar" (
    "id" SERIAL NOT NULL,
    "soruId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "metin" TEXT NOT NULL,
    "metinHtml" TEXT NOT NULL,
    "dogru" BOOLEAN NOT NULL DEFAULT false,
    "aciklama" TEXT,

    CONSTRAINT "siklar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gorseller" (
    "id" TEXT NOT NULL,
    "veri" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "genislik" INTEGER NOT NULL,
    "yukseklik" INTEGER NOT NULL,
    "boyut" INTEGER NOT NULL,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gorseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ice_aktarmalar" (
    "id" SERIAL NOT NULL,
    "sinavId" INTEGER NOT NULL,
    "dosyaAdi" TEXT NOT NULL,
    "soruSayisi" INTEGER NOT NULL,
    "yoneticiId" INTEGER,
    "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ice_aktarmalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_turleri" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "soruSayisi" INTEGER NOT NULL,
    "sureDakika" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checkup_turleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_ayarlari" (
    "id" SERIAL NOT NULL,
    "sinavId" INTEGER NOT NULL,
    "turId" INTEGER NOT NULL,
    "secim" "SecimBicimi" NOT NULL DEFAULT 'KARMA',
    "guncellendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkup_ayarlari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recete_satirlari" (
    "id" SERIAL NOT NULL,
    "ayarId" INTEGER NOT NULL,
    "konuId" INTEGER,
    "kazanimId" INTEGER,
    "soruSayisi" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recete_satirlari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabit_sorular" (
    "ayarId" INTEGER NOT NULL,
    "soruId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,

    CONSTRAINT "sabit_sorular_pkey" PRIMARY KEY ("ayarId","soruId")
);

-- CreateTable
CREATE TABLE "checkuplar" (
    "id" SERIAL NOT NULL,
    "ogrenciId" INTEGER NOT NULL,
    "sinavId" INTEGER NOT NULL,
    "turId" INTEGER NOT NULL,
    "durum" "CheckupDurumu" NOT NULL DEFAULT 'DEVAM',
    "soruSayisi" INTEGER NOT NULL,
    "sureDakika" INTEGER NOT NULL,
    "yanlisGoturme" INTEGER NOT NULL,
    "secim" "SecimBicimi" NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitisSiniri" TIMESTAMP(3) NOT NULL,
    "bitis" TIMESTAMP(3),
    "dogru" INTEGER,
    "yanlis" INTEGER,
    "bos" INTEGER,
    "net" DOUBLE PRECISION,
    "rapor" JSONB,

    CONSTRAINT "checkuplar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_sorulari" (
    "checkupId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "soruId" INTEGER NOT NULL,
    "dersId" INTEGER NOT NULL,
    "konuId" INTEGER NOT NULL,
    "kazanimId" INTEGER NOT NULL,
    "altKazanimId" INTEGER NOT NULL,
    "secilenSikId" INTEGER,
    "cevapZamani" TIMESTAMP(3),
    "dogruMu" BOOLEAN,

    CONSTRAINT "checkup_sorulari_pkey" PRIMARY KEY ("checkupId","sira")
);

-- CreateIndex
CREATE UNIQUE INDEX "yoneticiler_eposta_key" ON "yoneticiler"("eposta");

-- CreateIndex
CREATE UNIQUE INDEX "ogrenciler_eposta_key" ON "ogrenciler"("eposta");

-- CreateIndex
CREATE UNIQUE INDEX "oturumlar_jetonHash_key" ON "oturumlar"("jetonHash");

-- CreateIndex
CREATE INDEX "oturumlar_ogrenciId_idx" ON "oturumlar"("ogrenciId");

-- CreateIndex
CREATE INDEX "oturumlar_yoneticiId_idx" ON "oturumlar"("yoneticiId");

-- CreateIndex
CREATE UNIQUE INDEX "parola_sifirlamalari_jetonHash_key" ON "parola_sifirlamalari"("jetonHash");

-- CreateIndex
CREATE INDEX "parola_sifirlamalari_ogrenciId_idx" ON "parola_sifirlamalari"("ogrenciId");

-- CreateIndex
CREATE UNIQUE INDEX "sinavlar_ad_key" ON "sinavlar"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "dersler_sinavId_ad_key" ON "dersler"("sinavId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "dersler_id_sinavId_key" ON "dersler"("id", "sinavId");

-- CreateIndex
CREATE UNIQUE INDEX "konular_dersId_ad_key" ON "konular"("dersId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "konular_id_dersId_key" ON "konular"("id", "dersId");

-- CreateIndex
CREATE UNIQUE INDEX "kazanimlar_konuId_ad_key" ON "kazanimlar"("konuId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "kazanimlar_id_konuId_key" ON "kazanimlar"("id", "konuId");

-- CreateIndex
CREATE UNIQUE INDEX "alt_kazanimlar_kazanimId_ad_key" ON "alt_kazanimlar"("kazanimId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "alt_kazanimlar_id_kazanimId_key" ON "alt_kazanimlar"("id", "kazanimId");

-- CreateIndex
CREATE INDEX "sorular_sinavId_aktif_idx" ON "sorular"("sinavId", "aktif");

-- CreateIndex
CREATE INDEX "sorular_dersId_idx" ON "sorular"("dersId");

-- CreateIndex
CREATE INDEX "sorular_konuId_idx" ON "sorular"("konuId");

-- CreateIndex
CREATE INDEX "sorular_kazanimId_idx" ON "sorular"("kazanimId");

-- CreateIndex
CREATE INDEX "sorular_altKazanimId_idx" ON "sorular"("altKazanimId");

-- CreateIndex
CREATE UNIQUE INDEX "siklar_soruId_sira_key" ON "siklar"("soruId", "sira");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_turleri_ad_key" ON "checkup_turleri"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_ayarlari_sinavId_turId_key" ON "checkup_ayarlari"("sinavId", "turId");

-- CreateIndex
CREATE INDEX "recete_satirlari_ayarId_idx" ON "recete_satirlari"("ayarId");

-- CreateIndex
CREATE INDEX "checkuplar_ogrenciId_durum_idx" ON "checkuplar"("ogrenciId", "durum");

-- CreateIndex
CREATE INDEX "checkuplar_sinavId_idx" ON "checkuplar"("sinavId");

-- CreateIndex
CREATE INDEX "checkup_sorulari_soruId_idx" ON "checkup_sorulari"("soruId");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_sorulari_checkupId_soruId_key" ON "checkup_sorulari"("checkupId", "soruId");

-- AddForeignKey
ALTER TABLE "oturumlar" ADD CONSTRAINT "oturumlar_ogrenciId_fkey" FOREIGN KEY ("ogrenciId") REFERENCES "ogrenciler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oturumlar" ADD CONSTRAINT "oturumlar_yoneticiId_fkey" FOREIGN KEY ("yoneticiId") REFERENCES "yoneticiler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parola_sifirlamalari" ADD CONSTRAINT "parola_sifirlamalari_ogrenciId_fkey" FOREIGN KEY ("ogrenciId") REFERENCES "ogrenciler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dersler" ADD CONSTRAINT "dersler_sinavId_fkey" FOREIGN KEY ("sinavId") REFERENCES "sinavlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konular" ADD CONSTRAINT "konular_dersId_fkey" FOREIGN KEY ("dersId") REFERENCES "dersler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kazanimlar" ADD CONSTRAINT "kazanimlar_konuId_fkey" FOREIGN KEY ("konuId") REFERENCES "konular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alt_kazanimlar" ADD CONSTRAINT "alt_kazanimlar_kazanimId_fkey" FOREIGN KEY ("kazanimId") REFERENCES "kazanimlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_sinavId_fkey" FOREIGN KEY ("sinavId") REFERENCES "sinavlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_dersId_sinavId_fkey" FOREIGN KEY ("dersId", "sinavId") REFERENCES "dersler"("id", "sinavId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_konuId_dersId_fkey" FOREIGN KEY ("konuId", "dersId") REFERENCES "konular"("id", "dersId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_kazanimId_konuId_fkey" FOREIGN KEY ("kazanimId", "konuId") REFERENCES "kazanimlar"("id", "konuId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_altKazanimId_kazanimId_fkey" FOREIGN KEY ("altKazanimId", "kazanimId") REFERENCES "alt_kazanimlar"("id", "kazanimId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_gorselId_fkey" FOREIGN KEY ("gorselId") REFERENCES "gorseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorular" ADD CONSTRAINT "sorular_iceAktarmaId_fkey" FOREIGN KEY ("iceAktarmaId") REFERENCES "ice_aktarmalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siklar" ADD CONSTRAINT "siklar_soruId_fkey" FOREIGN KEY ("soruId") REFERENCES "sorular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ice_aktarmalar" ADD CONSTRAINT "ice_aktarmalar_sinavId_fkey" FOREIGN KEY ("sinavId") REFERENCES "sinavlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ice_aktarmalar" ADD CONSTRAINT "ice_aktarmalar_yoneticiId_fkey" FOREIGN KEY ("yoneticiId") REFERENCES "yoneticiler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_ayarlari" ADD CONSTRAINT "checkup_ayarlari_sinavId_fkey" FOREIGN KEY ("sinavId") REFERENCES "sinavlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_ayarlari" ADD CONSTRAINT "checkup_ayarlari_turId_fkey" FOREIGN KEY ("turId") REFERENCES "checkup_turleri"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recete_satirlari" ADD CONSTRAINT "recete_satirlari_ayarId_fkey" FOREIGN KEY ("ayarId") REFERENCES "checkup_ayarlari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recete_satirlari" ADD CONSTRAINT "recete_satirlari_konuId_fkey" FOREIGN KEY ("konuId") REFERENCES "konular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recete_satirlari" ADD CONSTRAINT "recete_satirlari_kazanimId_fkey" FOREIGN KEY ("kazanimId") REFERENCES "kazanimlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabit_sorular" ADD CONSTRAINT "sabit_sorular_ayarId_fkey" FOREIGN KEY ("ayarId") REFERENCES "checkup_ayarlari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabit_sorular" ADD CONSTRAINT "sabit_sorular_soruId_fkey" FOREIGN KEY ("soruId") REFERENCES "sorular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkuplar" ADD CONSTRAINT "checkuplar_ogrenciId_fkey" FOREIGN KEY ("ogrenciId") REFERENCES "ogrenciler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkuplar" ADD CONSTRAINT "checkuplar_sinavId_fkey" FOREIGN KEY ("sinavId") REFERENCES "sinavlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkuplar" ADD CONSTRAINT "checkuplar_turId_fkey" FOREIGN KEY ("turId") REFERENCES "checkup_turleri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkuplar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_soruId_fkey" FOREIGN KEY ("soruId") REFERENCES "sorular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_dersId_fkey" FOREIGN KEY ("dersId") REFERENCES "dersler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_konuId_fkey" FOREIGN KEY ("konuId") REFERENCES "konular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_kazanimId_fkey" FOREIGN KEY ("kazanimId") REFERENCES "kazanimlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_altKazanimId_fkey" FOREIGN KEY ("altKazanimId") REFERENCES "alt_kazanimlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_sorulari" ADD CONSTRAINT "checkup_sorulari_secilenSikId_fkey" FOREIGN KEY ("secilenSikId") REFERENCES "siklar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
