# Check-up programı: yapı ve kararlar

17 Kasım 2026'da eski Check-up (`app/` ve `admin/`) silindi, program baştan kuruldu. Eski kodun son commit'li hâli git geçmişinde (`baf3f52`); ayrıca yedek tutulmuyor.

## Parçalar

| Parça | Dizin | Yerel port | Ne yapar |
|---|---|---|---|
| Site | `frontend/` + `backend/` | 3000 / 5000 | kocum.net tanıtım sitesi. **Programdan ayrı**, değişmedi |
| Program backend | `checkup/backend` | 4000 | Tek API, tek veritabanı. Bütün iş mantığı burada |
| Program frontend | `checkup/frontend` | 3200 | Öğrenci: kayıt, sınav seçimi, test, rapor |
| Program admin | `checkup/admin` | 3300 | Panel: sınavlar, türler, konu ağacı, sorular, reçete, öğrenciler |

Sözleşme `checkup/API.md`'de, veritabanı `checkup/backend/prisma/schema.prisma`'da tanımlı.

## Öğrencinin yolu

1. Kayıt olur: ad soyad, e-posta, parola, KVKK onayı.
2. Sınavını seçer (DGS, ALES…). Yalnızca admin'de aktif yapılmış sınavlar görünür, ücreti yanında yazar.
3. Check-up türünü seçer: Hızlı (50 soru) ya da Kapsamlı (150 soru). Türler admin'den yönetilir.
4. Testi çözer: süre işler, istediği soruya dönebilir, boş bırakabilir, yarıda bırakıp kaldığı yerden devam edebilir.
5. Bitince raporu görür: net, ders ve konu başarısı, en zayıf kazanımlar ve her sorunun çözümü.

## Kullanıcının verdiği kararlar (17 Kasım 2026)

- Proje üç parça: frontend, admin, backend. Site ile program ayrı.
- Sınavlar admin'den eklenir, çıkarılır, aktif ya da pasif yapılır. Her sınavın admin'den girilen bir ücreti olur.
- Check-up türleri admin'den yönetilir.
- Konu ağacı dört seviyedir: Ders → Konu → Kazanım → Alt kazanım. Admin'de ayrı ayrı girilir.
- Reçete, hangi konudan ya da kazanımdan kaç soru çıkacağını belirler; satırlar konu ya da kazanım seviyesinde olabilir.
- Soru seçimi sabit ya da karma olur. Sabitte sorular tek tek seçilir.
- Her soruda sınav, ders, konu, kazanım ve alt kazanım zorunludur.
- Geri kalan konularda önerilen yol benimsendi (aşağıda).

## Önerilip benimsenenler

- **Konu ağacı:** Her sınavın kendi ağacı vardır.
- **Soru:**
  - Metin, isteğe bağlı görsel, `$…$` formül, 5 şık (A–E), tek doğru şık ve çözüm zorunludur.
  - Zorluk ve yanlış şık açıklaması isteğe bağlıdır.
- **Soru girişi:** Tek tek ya da Excel ile toplu. Excel'de hatalı satır varsa hiçbiri yazılmaz ve nedeni gösterilir.
- **Ayarlar:** Reçete ve sabit liste her "sınav + tür" çifti için ayrı tutulur.
- **Puanlama:** Yanlış götürme oranı sınav başına girilir. Rapor net gösterir, ÖSYM puanı tahmin etmez.
- **Süre:** Tür başına tutulur.
- **Test kuralları:** Öğrenci kaldığı yerden devam edebilir, önceki sorulara dönebilir, boş bırakabilir.
- **Tekrar çözme:** Serbesttir. Karmada öğrencinin daha önce gördüğü sorular, havuz yetiyorsa gelmez.
- **Silme:** İçinde soru ya da öğrenci sonucu olan sınav, tür veya konu silinemez, yalnızca pasif yapılır. Veritabanı da yabancı anahtarlarla buna izin vermez.
- **Roller:** Panelde iki rol var. YONETICI her şeyi yapar. EDITOR içerik girer: konu ağacı, sorular, reçete.

## Bilerek ertelenenler (itiraz edilirse değişir)

- **Ödeme:** Altyapısı yok. Ücret katalogda gösterilir ama başlatmayı engellemez.
- **Eksik ayar:** Kaydedilir ama "hazır değil" sayılır, öğrenci başlatamaz. Öneride "kaydedilmez" demiştik. 150 soruluk sabit listeyi parça parça kurabilmek için böyle yapıldı.
- **Henüz konuşulmayanlar:** Veli ekranı ve koç yorumu yok.
- **Şıklar:** Şık görseli yok, şık sayısı 5'te sabit.

## Teknik düzen

**Mimari: BFF (backend-for-frontend).** Tarayıcı yalnızca kendi Next uygulamasıyla konuşur. Next sunucusu backend'e iç ağdan gider (`BACKEND_URL`) ve her istekte `x-servis-anahtari` gönderir. Üretimde backend'in herkese açık bir alan adı **olmaz**. Bunun getirdikleri:

- CORS gerekmez.
- Çerezler alan adları arasında paylaşılmak zorunda kalmaz.
- Backend adresi istemciye inmez.

**Oturum:**

- Backend rastgele bir jeton verir ve veritabanında yalnızca özetini saklar.
- Next bu jetonu kendi alan adında httpOnly çerezde tutar:
  - Frontend'de çerez `ogrenci_oturum` adını taşır, 30 gün geçerlidir.
  - Admin'de çerez `yonetici_oturum` adını taşır, 12 saat geçerlidir.
- Çerez ayarları: `secure` (üretimde), `sameSite: lax`, `path: /`.

**İçerik gösterimi:**

- Formüller backend'de KaTeX ile HTML'e çevrilir. Frontend'ler yalnızca `katex/dist/katex.min.css`'i yükler.
- Admin'deki canlı önizleme `POST /api/admin/onizleme` ile çalışır.
- Görseller `/medya/[id]` rotasından aktarılır.

**Yığın:**

- **Backend:**
  - Node 22, TypeScript, Express 5, Prisma 7 ve PostgreSQL.
  - Doğrulama zod ile yapılır. Parolalar `node:crypto` scrypt ile özetlenir.
  - Diğer kütüphaneler: Excel için exceljs, görseller için sharp, formüller için katex, posta için nodemailer (`SMTP_URL`, geliştirmede `log://console`).
- **Frontend ve admin:**
  - Next 16.3.8, React 19.2.8, Tailwind 4 ve lucide-react.
  - Tasarım belirteçleri ve marka dosyaları `node design/sync.mjs` ile kopyalanır. Kopyalar elle düzenlenmez.
  - Admin ayrıca TailAdmin kitini kullanır.
- **Tema:** Yazı tipleri Poppins (başlık) ve Inter (gövde), `latin-ext` alt kümesiyle yüklenir. Koyu tema **yok**.
- **Kilit dosyaları:** npm 10 ile üretilir (`npx npm@10.9.4 install`). Dokploy ve CI npm 10 kullanıyor, npm 11 kilidi orada reddediliyor.
- **Yayın:** Dokploy'da Nixpacks ile yapılır. Her parçada `nixpacks.toml` bulunur, `nixpkgsArchive` Node 22.20'ye sabitlenmiştir: Prisma 7 en az Node 22.12 istiyor.

## Ortam değişkenleri

| Parça | Değişken |
|---|---|
| backend | `DATABASE_URL`, `PORT`, `SERVIS_ANAHTARI` (≥32 karakter), `FRONTEND_URL` (sıfırlama bağlantısı için), `SMTP_URL`, `MAIL_FROM`, `ILK_YONETICI_EPOSTA`, `ILK_YONETICI_PAROLA`, `ILK_YONETICI_AD` |
| frontend | `BACKEND_URL`, `SERVIS_ANAHTARI`, `NEXT_PUBLIC_SITE_URL` (kocum.net bağlantıları) |
| admin | `BACKEND_URL`, `SERVIS_ANAHTARI` |

## Doğrulama

- **Backend testleri:**
  - `TEST_DATABASE_BASE_URL` sunucusunda `checkup_test_<rastgele>` adlı geçici bir veritabanı açılır.
  - Migration'lar uygulanır, testler koşar, iş bitince veritabanı silinir.
  - Asıl veritabanına yazılmaz.
- **Frontend ve admin:** `tsc`, `eslint` ve `next build` geçmelidir.
- **Uçtan uca deneme:** Tarayıcıda, yerel `checkup_dev` veritabanıyla yapılır.
