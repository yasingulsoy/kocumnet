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
(sessizce başarısız olmaz). Yayına çıkmadan önce doldurulmalı.

## 3. İlk kurulumda bir kez

Servis ayağa kalktıktan sonra, konteyner içinde:

```bash
npm run db:seed        # konu ağacı + paketler (idempotent, tekrar çalıştırmak güvenli)
```

Bu uygulamada yönetici hesabı yok. Soru ekleme, öğrenciler ve erişim hakları
`admin.kocum.net`'te; oraya backend'in personel hesaplarıyla girilir.

⚠️ `npm run db:seed:demo` **ÜRETİMDE ÇALIŞTIRILMAZ**. Şablondan üretilmiş sahte
sorular üretir; betik `NODE_ENV=production` altında zaten kendini durdurur.

## 4. Bilinmesi gerekenler

- **Node 20+** zorunlu (Next 16). `nixpacks.toml` bunu sabitliyor; dosya olmadan
  Nixpacks Node 18'e düşüyor ve build ölüyor.
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
- [ ] `/gizlilik` metni **hukukçu tarafından okundu** (taslak hâlde yazıldı)
- [ ] Ücretli satış açılacaksa mesafeli satış sözleşmesi ve cayma hakkı metinleri eklendi
- [ ] Veritabanı yedeği zamanlandı
