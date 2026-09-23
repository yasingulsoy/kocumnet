# Check-up yönetimi

Matematik Check-up'ın (öğrenci uygulaması: kök dizindeki `app/`) yönetim ekranları.
Panelin geri kalanı backend API'sinden beslenirken bu bölüm **doğrudan
`kocumnet_checkup` veritabanına** Prisma ile bağlanır.

| Ekran | Adres | Kim görür |
|---|---|---|
| Genel bakış — kayıt/test sayıları, son 14 gün, zorlanılan konular | `/checkup` | tüm personel (öğrenci adları yalnızca yönetici/müdür) |
| Sorular — liste, süzgeç, hızlı durum değiştirme | `/checkup/sorular` | tüm personel |
| Soru ekle / düzenle — `$…$` yazımı, canlı KaTeX önizleme, şekil yükleme | `/checkup/sorular/yeni`, `/[id]` | yazma: yönetici, müdür, editör |
| Havuz durumu — paket × konu doldurulabilirlik, zorluk bantları | `/checkup/havuz` | tüm personel |
| Öğrenciler + öğrenci detayı (test geçmişi, konu haritası, erişim hakları) | `/checkup/ogrenciler` | yönetici, müdür |
| Paketler — yayın durumu, ücretli/ücretsiz | `/checkup/paketler` | değiştirme: yönetici, müdür |

Roller backend'in `utils/roles.js` gruplarıyla aynı (`CONTENT_ROLES`, `USER_MANAGE_ROLES`).
Öğrenci kişisel verisini soru yazan editörün görmesi gerekmiyor — KVKK gereği en az kişiye açık.

## Kod

```
src/lib/checkup/
  db.ts            Prisma client (CHECKUP_DATABASE_URL, driver adapter)
  staff.ts         Sunucu tarafı personel doğrulaması + roller
  pool.ts          Havuz sağlığı (paket × konu)
  format.ts        Etiketler, tarih/sayı biçimleri (Türkiye saati)
  actions/         Server action'lar: sorular, şekil, erişim hakkı, paket
  shared/          ⚠️ app/lib'den KOPYA — elle düzenlemeyin (aşağıya bakın)
  generated/       Prisma client (gitignore'da, üretilir)
src/components/checkup/   Ekran bileşenleri (TailAdmin görünümü, koyu tema)
src/app/(admin)/checkup/  Sayfalar
src/app/api/checkup-media/[id]   Soru görselleri (yalnızca personele)
prisma/checkup.prisma     ⚠️ app/prisma/schema.prisma'nın KOPYASI
scripts/checkup-sync.mjs  Kopyaları eşitler / denetler
```

## Kimlik doğrulama — neden sunucu tarafında

`(admin)/layout.tsx` bir istemci bileşeni ve oturumu yalnızca tarayıcıda denetliyor.
Blog ekranları verisini tarayıcıdan backend'e sorduğu için bu yetiyordu. Check-up
ekranları ise veriyi **sunucuda** çiziyor: sunucu denetlemezse öğrenci listesi,
çerezi olmayan birine giden yanıtın içinde durur — istemci düzeni onu yalnızca
ekrana basmamış olur.

Bu yüzden **her sayfa ve her server action** `checkStaff()` / `staffForAction()`
çağırır; düzen seviyesinde tek denetim yetmez. Doğrulama backend'e sorulur
(`/api/admin/auth/verify`, istek başına bir kez): JWT burada çözülseydi pasife
alınan personel jetonun süresi dolana kadar (6 saat) içeride kalırdı. Backend'e
ulaşılamazsa ekran veri göstermez (hata kapalı).

Üretimde bunun çalışması için backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` gerekir —
bkz. [DEPLOY.md](DEPLOY.md).

## Kayıtlarda "kim yaptı"

Personel başka veritabanında (backend `users`) olduğu için yabancı anahtar
kurulamıyor. Soru, şekil ve erişim hakkı kayıtlarına `e-posta (#id)` biçiminde
damga yazılıyor: `createdByStaff`, `updatedByStaff`, `uploadedByStaff`,
`grantedByStaff`, `revokedByStaff`. Geri alınan erişim hakkı silinmez; kim, ne
zaman verdi/aldı kayıtta kalır.

## Şema ve paylaşılan modüller

Şemanın ve migration'ların **tek sahibi `app/`**. Panel:

- `prisma/checkup.prisma` kopyasından yalnızca client üretir, **migration çalıştırmaz**
  (config dosyası ve bağlantı adresi olmadığı için `prisma migrate` burada çalışmaz da).
- Soru yazım biçimi, şık kuralları ve puanlama eşiklerini `src/lib/checkup/shared/`
  altındaki kopyalardan kullanır. Panelde kaydedilen soru öğrenci tarafında aynı
  ayrıştırıcıdan geçer; seviye eşikleri iki ekranda aynı olmalı.

`app/` tarafında şema ya da bu modüller değişince:

```bash
npm run checkup:sync     # kopyaları eşitler
```

`npm run dev` önce `checkup:check` çalıştırır ve kopyalar eşit değilse **başlamaz** —
sürüklenme üretimde değil geliştirmede yakalansın diye.

## Bilinmesi gerekenler

- **Soru düzenlerken şıklar yerinde güncellenir**, silinip yeniden kurulmaz. Öğrenci
  cevabı şıkka `onDelete: Restrict` ile bağlı; eski yöntem (sil + yeniden oluştur)
  bir kez bile cevaplanmış soruda veritabanı hatasıyla patlıyordu. Cevaplanmış bir
  şık kaldırılamaz (5 → 4 şık), form bunu açıkça söyler.
- **Cevap anahtarı değişirse sürüm artar** (`Question.version`); eski sonuçlar
  `SessionItem.questionVersion` ile ayırt edilir.
- **React 19 form eylemi bitince formu sıfırlar** ve görünen `<select>`'ler
  varsayılana döner. `QuestionForm.tsx`'te değerler gizli alanlarla gönderiliyor ve
  select'ler efektle durumdan geri yazılıyor — kaldırılırsa doğrulama hatası alan
  yazar seçtiği konuyu sessizce kaybeder.
- **Havuzu yetmeyen paket yayına alınamaz** — öğrenci kataloğda görüp "Başla"ya
  bastığında hata alması, hiç görmemesinden kötü.
- **Görseller veritabanında** (`MediaAsset.data`); SVG kabul edilmiyor (script
  taşıyabilir), yükleme 8 MB / 1200 px / WebP.
- Panel temasında `font-mono` tanımsız (`--font-*: initial`); tek aralıklı yazı için
  `components/checkup/ui.tsx`'teki `MONO` kullanılır. `tailwind-merge` (v2) bu
  bölümde kullanılmıyor: `text-theme-xs` gibi v4 belirteçlerini renk sanıp siliyor.

## Yerelde deneme

Personel doğrulaması gerçek backend'e gider; backend'i (`:5000`) ve panelde bir
personel hesabıyla girişi kullanın. `.env`'de `CHECKUP_DATABASE_URL` tanımlı olmalı.
