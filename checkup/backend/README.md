# Check-up backend

Check-up programının tek API'si ve tek veritabanı. Öğrenci uygulaması (`checkup/frontend`) ve panel (`checkup/admin`) yalnızca bu API'yi kullanır; sözleşme `checkup/API.md`, kararlar `checkup/MIMARI.md`.

**Üretimde backend'e alan adı verilmez.** Next uygulamaları iç ağdan (`BACKEND_URL`) bağlanır ve her istekte `x-servis-anahtari` gönderir; tarayıcı backend'le hiç konuşmaz.

## Çalıştırma

```bash
cp .env.example .env          # değerleri doldurun
npm install                   # postinstall: prisma generate
npm run db:deploy             # migration'ları uygula
npm run db:tohum:ornek        # yalnızca geliştirme: örnek sınavlar ve sorular
npm run dev                   # tsx watch, http://localhost:4000
```

Üretim: `npm run build && npm start` (Nixpacks'te `npx prisma migrate deploy && npm run start`).

**Çalıştırma biçimi: derleme (tsc), tsx değil.** Prisma'nın ürettiği client TypeScript kaynağıdır; generator `moduleFormat = "esm"` ve `importFileExtension = "js"` ile göreli importları `.js` uzantılı üretir, `tsc` (module: nodenext) `dist/`'e derler, `node dist/server.js` çalışır. `tsx` yalnızca geliştirmede (`dev`), testlerde ve betiklerde kullanılır.

## Scriptler

| Script | Ne yapar |
|---|---|
| `dev` | `prisma generate` + `tsx watch src/server.ts` (port 4000) |
| `build` | `prisma generate` + `tsc -p tsconfig.build.json` → `dist/` |
| `start` | `node dist/server.js` |
| `typecheck` | `tsc --noEmit` (src, test, scripts) |
| `test` | Birim testleri + API testleri (`node:test` + tsx). API testleri `TEST_DATABASE_BASE_URL` sunucusunda `checkup_test_<rastgele>` açar, migration'ları uygular, uygulamayı rastgele portta başlatır, sonunda veritabanını siler |
| `db:deploy` | `prisma migrate deploy` |
| `db:denetle` | Şema ile migration'lar eşit mi? Geçici gölge veritabanı açıp `migrate diff --from-migrations … --exit-code` çalıştırır |
| `db:tohum:ornek` | Örnek veri; `NODE_ENV=production`'da ya da veritabanı adında `_dev`/`_test` yoksa reddeder. İdempotent |

Testler ve betikler yalnızca adı `checkup_test_` ile başlayan veritabanlarını açar ve siler.

## Prisma 7 notları

- Bağlantı adresi şemada değil `prisma7.config.ts`'te (Prisma 7.10 önce bu adı arar). Uygulama bağlantıyı `src/db.ts`'te sürücü bağdaştırıcısıyla (`PrismaPg`) kurar.
- `prisma`, `@prisma/client`, `@prisma/adapter-pg` üçü de 7.10.1'e sabit (`npm i prisma@latest` RC kurar).
- `migrate dev` etkileşimsiz ortamda çalışmaz. Yeni migration: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` çıktısını `prisma/migrations/<YYYYMMDDHHMMSS>_<ad>/migration.sql`'e yazın (gölge veritabanı için `SHADOW_DATABASE_URL` gerekir), `npm run db:deploy` ile uygulayın, `npm run db:denetle` ile doğrulayın.
- Üretilen client (`src/generated/`) gitignore'da; `build` ve `postinstall` yeniden üretir.
- Paket eklerken kilit dosyası npm 10 ile: `npx npm@10.9.4 install --save-exact <paket>`.

## Mimari özet

```
src/
  server.ts          dinler; açılışta ilk yöneticiyi oluşturur
  app.ts             createApp(): Express uygulaması (testler de kullanır)
  ayarlar.ts         ortam değişkenleri
  db.ts              PrismaClient + PrismaPg
  http/              servis anahtarı, oturum, rol, doğrulama yardımcıları
  lib/               saf modüller (veritabanı bilmez, birim testli):
                     icerik (metin → HTML + KaTeX), siklar, hazirlik, secim,
                     puanlama, sure, excel, gorsel, parola, jeton, hiz-siniri, posta
  servisler/         veritabanlı iş mantığı: checkup, ayarlar, soru, ice-aktar, oturum
  rotalar/           ogrenci.ts, admin/*
scripts/             db-denetle, tohum-ornek, ornek-veri, pg-yardimci
test/birim/          saf modüllerin testleri
test/api.test.ts     HTTP testleri (test/api/*)
```

- **Cevap anahtarı sızmaz:** test ekranı alanları tek tek seçer; testler yanıtta `dogru`, `cozum*`, `aciklama` anahtarlarını derinlemesine arar.
- **Eşzamanlılık:** başlatma öğrenci başına danışma kilidiyle sıraya girer; bitirme `UPDATE … WHERE durum = 'DEVAM'` ile tek kez puanlar; cevap kaydı check-up satırını kilitler.
- **Süre:** ayrı zamanlanmış iş yok; süresi (15 sn toleransıyla) geçmiş açık check-up kendisine ya da listeye gelen ilk istekte biter.
- **Hız sınırı** bellek içindedir (tek örnek). İstemci IP'si `x-istemci-ip`'den, yalnızca servis anahtarı doğruysa okunur.
- **Görseller** veritabanında (WebP, en fazla 1200 px); `GET /api/medya/:id` verir.
- **Posta:** `SMTP_URL=log://console` geliştirmede iletiyi günlüğe yazar (üretimde açılış hatası).
