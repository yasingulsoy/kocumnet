# Check-up'ı Dokploy'da yayına alma

Üç ayrı servis kurulur; hepsi aynı depoyu (`yasingulsoy/kocumnet`, `main`) Nixpacks ile derler. Her klasörde `nixpacks.toml` var: Node 22.20'ye sabitli, çünkü Prisma 7 en az 22.12 istiyor.

| Servis | Build path | Alan adı | Port |
|---|---|---|---|
| checkup-backend | `/checkup/backend` | **YOK**: yalnızca iç ağ | 4000 (`PORT`) |
| checkup-frontend | `/checkup/frontend` | checkup.kocum.net | 3000 |
| checkup-admin | `/checkup/admin` | ör. panel.checkup.kocum.net | 3000 |

> Eski `kocumnet-checkup-…` (build path `/app`) ve `kocumnet-panel-…` (`/admin`) servisleri artık var olmayan klasörleri gösteriyor. Yeni bir push'tan sonra Deploy edilirlerse düşerler. Bu yüzden ya yeni servislere çevrilmeli ya da durdurulmalı. Eski `kocumnet_checkup` veritabanına yeni program dokunmaz; silme kararı size ait.

## Veritabanı

Aynı Postgres servisinde **yeni** bir veritabanı açın, örneğin `kocumnet_checkup_v2`. Tabloları backend kendisi kurar: başlarken `npx prisma migrate deploy` çalıştırır.

## Ortam değişkenleri

Sırları proje düzeyinde "Project Environment"a koyup servislerde `${{project.AD}}` ile okumak, bugünkü düzenle aynıdır.

**checkup-backend:**

```
DATABASE_URL=postgresql://<kullanıcı>:<parola>@kocumnet-postgres-x3xyyb:5432/kocumnet_checkup_v2?schema=public
PORT=4000
SERVIS_ANAHTARI=<en az 32 karakter, rastgele; frontend ve admin'le AYNI>
FRONTEND_URL=https://checkup.kocum.net
SMTP_URL=<Resend ya da başka SMTP adresi>
MAIL_FROM=Koçum Check-up <no-reply@kocum.net>
ILK_YONETICI_EPOSTA=<ilk yöneticinin e-postası>
ILK_YONETICI_PAROLA=<güçlü bir parola; ilk girişten sonra panelden değiştirin>
ILK_YONETICI_AD=<ad soyad>
NODE_ENV=production
```

`ILK_YONETICI_*` değişkenleri yalnızca veritabanında hiç yönetici yokken okunur. İlk girişten sonra kaldırılabilir.

**checkup-frontend:**

```
BACKEND_URL=http://<checkup-backend servisinin iç adı>:4000
SERVIS_ANAHTARI=<backend'le aynı>
NEXT_PUBLIC_SITE_URL=https://kocum.net
```

**checkup-admin:**

```
BACKEND_URL=http://<checkup-backend servisinin iç adı>:4000
SERVIS_ANAHTARI=<backend'le aynı>
```

**Site (`frontend/`):** `NEXT_PUBLIC_CHECKUP_URL=https://checkup.kocum.net` zaten var. Sitedeki check-up bağlantıları `?k=<etiket>` taşır; yeni uygulama bunu kayıt kaynağı olarak saklar.

## Sıra

1. Veritabanını açın.
2. Backend'i kurup Deploy edin. Günlükte migration'ların uygulandığını ve sunucunun dinlediğini görün.
3. Frontend'i ve admin'i kurup Deploy edin.
4. Admin'e `ILK_YONETICI_*` bilgileriyle girin ve parolanızı değiştirin.
5. Admin'de sırasıyla şunları yapın:
   1. Sınavları (ALES, DGS) ve check-up türlerini girin.
   2. Konu ağacını kurun.
   3. Soruları girin ya da Excel ile aktarın.
   4. Reçeteyi kurun.
   5. Sınavı **aktif** yapın.
   
   Pasif sınav öğrenciye görünmez. Hazır olmayan tür "Hazırlanıyor" diye görünür.

## Dikkat

- **Backend'e alan adı vermeyin.** Servis anahtarı korur ama API'nin internete açık olmasına gerek yok.
- **Örnek veri üretimde çalışmaz.** `npm run db:tohum:ornek` yalnızca geliştirme ve test veritabanlarında çalışır.
- **Yedek:** Soru görselleri veritabanında durur. Veritabanı yedeği, görselleri de kapsar.
