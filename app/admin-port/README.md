# Yönetim kodu — admin.kocum.net'e taşınacak

Bu klasör **derlenmiyor ve deploy edilmiyor** (`tsconfig.json` ve `eslint.config.mjs`
dışında). Check-up uygulaması yalnızca öğrenciye hizmet veriyor.

**Karar (2026-09-21):** `admin.kocum.net` (kök dizindeki `admin/` projesi) hem pazarlama
sitesinin (blog vb.) hem check-up uygulamasının **tek yönetim paneli** olacak. Buradaki
ekranlar oraya taşınacak: soru ekleme, kayıtlı öğrenciler, erişim durumları.

Silinmedi, çünkü çalışan ve test edilmiş kod:

| Ne | Nerede | Durum |
|---|---|---|
| Havuz panosu (paket × konu doldurulabilirlik, zorluk dengesi) | `pages/page.tsx` | tarayıcıda doğrulandı |
| Soru listesi, süzgeç, hızlı durum değiştirme | `pages/sorular/` | doğrulandı |
| Soru giriş/düzenleme — `$…$` yazımı, canlı KaTeX önizleme | `pages/sorular/QuestionForm.tsx` | doğrulandı |
| Şekil yükleme (sharp → WebP, SVG reddi) | `components/ImageUploader.tsx`, `actions/media.ts` | doğrulandı |
| Kayıtlı öğrenciler + erişim hakkı ver/geri al | `pages/ogrenciler/`, `actions/students.ts` | doğrulandı |

## Taşırken bilinmesi gerekenler

- **`admin/` projesi Prisma kullanmıyor**, Express backend'e API ile bağlanıyor. Bu
  ekranlar ise doğrudan `kocumnet_checkup` veritabanına Prisma ile yazıyor. İki yol var:
  1. **`admin/` projesine Prisma + `kocumnet_checkup` bağlantısı eklemek** — önerilen.
     Panel zaten iki sistemi yönetecek; site tarafı backend API'sinden, check-up tarafı
     doğrudan veritabanından beslenir. Bu klasördeki kod neredeyse olduğu gibi çalışır.
  2. Check-up uygulamasına yetkili bir yönetim API'si açmak ve `admin/`'den çağırmak —
     daha fazla iş, ek bir kimlik doğrulama katmanı gerektirir.
- Soru yazımının kalbi `lib/question-markup.ts` ve `lib/question-content.ts` —
  bunlar check-up uygulamasında kalıyor; taşırken kopyalanmalı ya da paylaşılmalı.
- `QuestionForm.tsx`'teki React 19 `form.reset()` geçici çözümünü **kaldırmayın**
  (gizli alanlar + select'lerin DOM'a geri yazılması). Kaldırılırsa doğrulama hatası
  alan yönetici seçtiği konuyu sessizce kaybeder.
- `next.config.ts` içindeki `serverActions.bodySizeLimit: "10mb"` ayarı yönetim
  uygulamasına da taşınmalı — yoksa şekil fotoğrafları 1 MB sınırına takılır.
