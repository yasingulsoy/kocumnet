# Admin Panel Deployment (Dokploy / Nixpacks)

Panel **yalnızca Matematik Check-up**'ı yönetir (soru havuzu, kazanımlar, paketler,
öğrenciler, seviyeli koşular — doğrudan `kocumnet_checkup` veritabanından).
Blog, iletişim mesajları ve personel hesapları 3 Ekim 2026'dan beri **kocum.net/admin**'de
(frontend projesi). Giriş yine backend'in personel hesaplarıyla; `AUTH_COOKIE_DOMAIN=.kocum.net`
ile iki panel arasında tek giriş. Ayrıntılar: [CHECKUP.md](CHECKUP.md).

Tasarım belirteçleri `src/app/tokens.css` — kök dizindeki `design/tokens.css`'in kopyası;
elle düzenlenmez (`node design/sync.mjs`).

## Build Environment Variables

Build sırasında aşağıdaki değişken **mutlaka** tanımlanmalıdır. Aksi halde `Eksik environment degiskeni` hatası alırsınız.

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL'i (örn: `https://api.kocum.net`) |

### Dokploy'da ayarlama

1. Uygulama → **Environment Variables** veya **Build Settings**
2. **Build Environment Variables** bölümüne ekleyin:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://api.kocum.net
   ```

> **Not:** `NEXT_PUBLIC_*` değişkenleri build sırasında bundle'a gömülür. Runtime'da değiştirilemez; doğru URL'i build öncesi ayarlayın.

## Runtime Environment Variables (Check-up)

| Değişken | Açıklama |
|----------|----------|
| `CHECKUP_DATABASE_URL` | `kocumnet_checkup` bağlantısı — check-up uygulamasının (`app/`) `DATABASE_URL`'i ile **aynı** veritabanı |
| `BACKEND_URL` | Sunucudan backend'e erişim adresi (personel oturumu her istekte buradan doğrulanır). Boşsa `NEXT_PUBLIC_BACKEND_URL` kullanılır |
| `NEXT_PUBLIC_SITE_URL` | kocum.net adresi — kenar çubuğundaki "Site yönetimi" bağlantısı ve giriş ekranındaki "Parolamı unuttum" (`/admin/sifremi-unuttum`) buradan kurulur |

## ⚠️ Backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` ZORUNLU

Check-up ekranları veriyi sunucuda hazırlıyor ve personel oturumunu **sunucu
tarafında** doğruluyor (panelin istemci tarafı giriş denetimi, sunucuda çizilen
öğrenci verisini korumaya yetmez). Bunun için `admin.kocum.net` sunucusunun
`admin_access_token` çerezini görmesi gerekir.

Tarayıcı çerezi `api.kocum.net`'ten alıyor. Backend ortamında `AUTH_COOKIE_DOMAIN`
boşsa çerez yalnızca `api.kocum.net`'e gider ve panel **"Oturumun bu sunucuya ulaşmadı"**
gösterir. Backend servisine:

```
AUTH_COOKIE_DOMAIN=.kocum.net
```

Değişiklikten sonra personelin bir kez çıkış yapıp yeniden girmesi gerekir (eski
çerez alan adsız kurulmuştu).

Geliştirmede gerekmez: panel `/api-backend` yeniden yazmasıyla istekleri kendi
kökeninden geçirdiği için çerez zaten `localhost:3001`'de duruyor.

## Paketler panelden düzenlenir

Katalog paketlerinin içeriği (ad, özet, süre, konu dağılımı) panelden düzenleniyor.
Check-up uygulamasının tohumu (`app/` → `npm run db:seed`) var olan paketin içeriğini
artık yazmıyor; `-- --guncelle` bayrağı verilmedikçe paneldeki düzenleme deploy'da
korunur. Deploy betiklerine `--guncelle` eklemeyin. Ayrıntı: `app/DEPLOY.md` §3.

## Şema ve dağıtım sırası

- **Şemanın ve migration'ların sahibi check-up uygulaması** (`app/`). Panel
  `prisma/checkup.prisma` kopyasından yalnızca client üretir, migration çalıştırmaz.
- Şema değiştiren bir sürümde **önce `app/` servisi** dağıtılmalı (açılışta
  `prisma migrate deploy` çalıştırıyor), sonra panel.
- Üretilen client gitignore'da; `build` ve `postinstall` script'leri
  `prisma generate` ile başlıyor — kaldırmayın, deploy patlar.
- Node 22 ve nixpkgs commit'i `nixpacks.toml`'da sabit: Prisma 7, Nixpacks'in
  kendi Node sürümleriyle (20.18, 22.11) kurulmuyor. Ayrıntı: `app/DEPLOY.md` §4.
- Şekil yükleme bir server action; `next.config.ts`'teki
  `serverActions.bodySizeLimit: "10mb"` ayarı kaldırılırsa telefon fotoğrafları
  1 MB sınırına takılıp sessizce reddedilir.
