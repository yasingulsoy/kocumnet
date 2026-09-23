# Admin Panel Deployment (Dokploy / Nixpacks)

Panel iki sistemi yönetir: **site** (blog, personel — Express backend'in API'si üzerinden)
ve **Matematik Check-up** (soru havuzu, öğrenciler, erişim hakları — doğrudan
`kocumnet_checkup` veritabanından). Check-up tarafının ayrıntıları: [CHECKUP.md](CHECKUP.md).

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

## ⚠️ Backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` ZORUNLU

Check-up ekranları veriyi sunucuda hazırlıyor ve personel oturumunu **sunucu
tarafında** doğruluyor (panelin istemci tarafı giriş denetimi, sunucuda çizilen
öğrenci verisini korumaya yetmez). Bunun için `admin.kocum.net` sunucusunun
`admin_access_token` çerezini görmesi gerekir.

Tarayıcı çerezi `api.kocum.net`'ten alıyor. Backend ortamında `AUTH_COOKIE_DOMAIN`
boşsa çerez yalnızca `api.kocum.net`'e gider; blog ekranları çalışmaya devam eder ama
Check-up ekranları **"Oturumun bu sunucuya ulaşmadı"** gösterir. Backend servisine:

```
AUTH_COOKIE_DOMAIN=.kocum.net
```

Değişiklikten sonra personelin bir kez çıkış yapıp yeniden girmesi gerekir (eski
çerez alan adsız kurulmuştu).

Geliştirmede gerekmez: panel `/api-backend` yeniden yazmasıyla istekleri kendi
kökeninden geçirdiği için çerez zaten `localhost:3001`'de duruyor.

## Şema ve dağıtım sırası

- **Şemanın ve migration'ların sahibi check-up uygulaması** (`app/`). Panel
  `prisma/checkup.prisma` kopyasından yalnızca client üretir, migration çalıştırmaz.
- Şema değiştiren bir sürümde **önce `app/` servisi** dağıtılmalı (açılışta
  `prisma migrate deploy` çalıştırıyor), sonra panel.
- Üretilen client gitignore'da; `build` ve `postinstall` script'leri
  `prisma generate` ile başlıyor — kaldırmayın, deploy patlar.
- Şekil yükleme bir server action; `next.config.ts`'teki
  `serverActions.bodySizeLimit: "10mb"` ayarı kaldırılırsa telefon fotoğrafları
  1 MB sınırına takılıp sessizce reddedilir.
