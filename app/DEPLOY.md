# Deploy — Matematik Check-up

Dokploy / Nixpacks içindir. Frontend ile **aynı sunucuda ama ayrı servis** olarak çalışır.

## 1. Veritabanı

Frontend'in kullandığı `kocumnet` veritabanına **dokunulmaz**. Ayrı bir veritabanı açın:

```sql
CREATE DATABASE kocumnet_checkup ENCODING 'UTF8';
```

Şema ve migration'lar uygulama açılırken otomatik uygulanır (`nixpacks.toml` içindeki
`prisma migrate deploy`). Elle çalıştırmaya gerek yok.

**Şemanın sahibi bu uygulama.** Yönetim paneli (`admin.kocum.net`, kök dizindeki `admin/`)
aynı veritabanına `CHECKUP_DATABASE_URL` ile bağlanır ama migration çalıştırmaz. Bu yüzden
şema değiştiren bir sürümde **önce bu servis** dağıtılmalı; panel yeni sütunu ancak
migration uygulandıktan sonra kullanabilir.

## 2. Ortam değişkenleri

`.env.example` dosyasındaki tüm değişkenleri Dokploy'un ortam değişkenleri ekranına girin.
Zorunlu olanlar:

| Değişken | Neden |
|---|---|
| `DATABASE_URL` | `kocumnet_checkup` bağlantısı |
| `NEXT_PUBLIC_APP_URL` | Parola sıfırlama bağlantıları bu adresle kurulur — yanlışsa e-postadaki link localhost'u gösterir |
| `NEXT_PUBLIC_SITE_URL` | Ürün önerilerinin gittiği pazarlama sitesi |

`SMTP_URL` boşsa **parola sıfırlama kapalıdır** ve kullanıcıya bu açıkça söylenir
(sessizce başarısız olmaz). Yayına çıkmadan önce doldurulmalı. Gönderilen postalar:
hoş geldin (kayıt), parola sıfırlama, "parolan değişti" — hepsi markalı HTML şablonla
(`lib/mailer.ts`). Geliştirmede `SMTP_URL=log://console` postayı günlüğe yazar.

`CRON_SECRET`: `/api/cron` bakım ucunu korur. Dışarıdan 15 dakikada bir çağrılır: süresi
dolan testleri puanlar, eski oturum/jetonları siler ve pazartesi 07:00 (TR) sonrası
**haftalık koçluk postasını** gönderir (`lib/digest.ts`; SMTP_URL yoksa atlanır). Yoksa uç kapalı (503) ve yarım
bırakılan testler hiç puanlanmaz. Dokploy "Schedule" (ya da sunucuda cron):

```
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://checkup.kocum.net/api/cron
```

Sağlık yoklaması: `GET /api/health` veritabanına dokunur (`{"ok":true,"db":"up"}`); Dokploy
health check olarak bunu kullan.

## 2b. Soru içe aktarma

İçerik ekibinin `SORU-SABLONU.md` biçimindeki dosyası:

```bash
npm run import:questions -- dosya.md                 # yalnızca denetle, rapor ver
npm run import:questions -- dosya.md --uygula        # taslak olarak kaydet
npm run import:questions -- dosya.md --uygula --yayinla --personel "ad@kocum.net (#3)"
npm run import:questions -- --geri-al <partiKimligi> # çözülmemiş soruları geri al
```

Görseller markdown'ın yanındaki `gorseller/` dizininden okunur ve veritabanına yazılır.
Örnek dosya: `scripts/fixtures/ornek-import.md` (üçüncü soru bilerek hatalı).

## 3. İlk kurulumda bir kez

Servis ayağa kalktıktan sonra, konteyner içinde:

```bash
npm run db:seed        # konu ağacı + eksik paketler (idempotent, tekrar çalıştırmak güvenli)
```

**Tohum var olan katalog paketinin İÇERİĞİNİ yazmaz.** Katalog (STANDARD) paketinin adı,
özeti, süresi, soru sayısı ve konu dağılımı yönetim panelinden düzenleniyor
(admin.kocum.net → Check-up → Paketler);
tohum bunları her çalıştırmada yeniden yazsaydı paneldeki düzenleme ilk deploy'da
sessizce silinirdi. Tohumun yaptığı:

- **Olmayan paketi oluşturur** (konu dağılımıyla; havuz yetiyorsa yayında, yetmiyorsa taslak).
- **Var olan katalog paketinde** yalnızca sınavdan türeyen alanları (sınav, tür, yanlış
  götürme oranı) ve katalog sırasını eşitler: `lib/exams.ts`'teki bir sınav sabiti
  değişince yayılsın.
- **Sistem paketlerini** (tanışma, konu tekrar testi) her çalıştırmada bu dosyadan yazar:
  panelden düzenlenmiyorlar, korunacak bir düzenleme yok. (Seviyeli paketler
  `db:seed:levels`'tan.)
- **Havuzu yetmeyen paketi taslağa çeker** — paketin o anki (panelde değişmiş olabilir)
  dağılımına, öğrenci uygulamasının kapsam kuralıyla bakarak. Yetiyorsa durumu ezmez.
- Konu ağacını her zaman bu dosyadan yazar.

Katalog paketlerinin içeriğini `prisma/seed.ts`'teki hâline **bilerek** döndürmek için:

```bash
npm run db:seed -- --guncelle   # ⚠️ paneldeki paket düzenlemelerini ezer
```

Çıktı, içeriği tohumdakinden farklı (panelde düzenlenmiş) paketleri tek tek söyler.

Bu uygulamada yönetici hesabı yok. Soru ekleme, öğrenciler ve erişim hakları
`admin.kocum.net`'te; oraya backend'in personel hesaplarıyla girilir.

⚠️ `npm run db:seed:demo` **ÜRETİMDE ÇALIŞTIRILMAZ**. Şablondan üretilmiş sahte
sorular üretir; betik `NODE_ENV=production` altında zaten kendini durdurur.

## 4. Bilinmesi gerekenler

- **Node 22** (Prisma 7 en az 20.19 ya da 22.12 istiyor). `nixpacks.toml` hem sürümü
  hem nixpkgs commit'ini sabitliyor: Nixpacks'in kendi nixpkgs'inde Node 20.18 ve
  22.11 var, ikisinde de `npm ci` Prisma'nın kurulum denetiminde düşüyor. Dosya
  olmadan Nixpacks Node 18'e düşüyor. Panel (`admin/`) aynı ayarı kullanıyor.
- **`vips` paketi** `nixpacks.toml`'da: `sharp` onsuz çalışmaz, şekil yükleme kırılır.
- **Üretilen Prisma client gitignore'da.** `build` script'i `prisma generate` ile
  başlıyor — kaldırmayın, deploy patlar.
- **Migration'lar uygulama ÖNCESİ çalışır** (`start` komutunda). Yeni sürüm şemada
  olmayan bir alanı sorgularsa ilk istekte 500 döner; sıralama bunun için.
- **Görseller veritabanında.** Konteyner geçici olduğu için diskte tutulmuyorlar;
  volume bağlamayı unutmak bir gün tüm şekilleri sessizce silerdi. Yedek alırken
  veritabanı yedeği görselleri de kapsar.

## 5. Alan adı

Önerilen: `checkup.kocum.net` (ayrı servis, ayrı sertifika).
`kocum.net/checkup` altına almak ters vekil yapılandırması gerektirir ve iki Next
uygulamasının temel yolunu çakıştırır — ayrı alt alan adı daha basit.

## 6. Yayın öncesi kontrol listesi

- [ ] `SMTP_URL` dolu ve bir test e-postası ulaşıyor
- [ ] `NEXT_PUBLIC_APP_URL` gerçek alan adı
- [ ] Yönetim paneli bu veritabanına bağlı (`admin/` → `CHECKUP_DATABASE_URL`) ve
      backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` tanımlı (bkz. `admin/DEPLOY.md`)
- [ ] Gerçek soru havuzu girildi (demo sorular temizlendi)
- [ ] Paketlerin ücretli/ücretsiz ayarı iş kararına göre yapıldı (panel → Check-up → Paketler)
- [ ] Deploy betiğinde `db:seed -- --guncelle` YOK (paneldeki paket düzenlemelerini her deploy'da silerdi)
- [ ] `/gizlilik` metni **hukukçu tarafından okundu** (taslak hâlde yazıldı)
- [ ] Ücretli satış açılacaksa mesafeli satış sözleşmesi ve cayma hakkı metinleri eklendi
- [ ] Veritabanı yedeği zamanlandı
