# Sabah raporu — 23 Eylül 2026

Gece boyunca yapılanlar, önce **senin yapman gerekenler**, sonra ne değiştiği.

> **Hiçbir şey commit edilmedi, hiçbir şey push edilmedi.** Çalışma ağacında
> duruyor: `git status` ile bak, beğendiğini commit et.
> Toplam: 178 değişmiş dosya, +7.938 / −13.636 satır, 39 yeni dosya/dizin.

---

## 1. Senden bekleyenler (önem sırasına göre)

### 1.1 ⚠️ Üretimdeki JWT anahtarını değiştir

`backend/config/env.js` artık zayıf/örnek bir `JWT_SECRET` ile **üretimde
başlamıyor** (geliştirmede sadece uyarıyor). Sunucudaki `.env` dosyasında
anahtar örnek değerlerden biriyse servis açılmaz. Yeni anahtar üret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Anahtarı değiştirmek **tüm personelin oturumunu düşürür** — yeniden giriş yaparlar.

### 1.2 ⚠️ `NODE_ENV=production` ayarla (ve blog görüntülenme sayacını kontrol et)

`IS_PRODUCTION` artık `NODE_ENV !== 'development'` (fail-closed): ayar unutulursa
sistem kendini üretim sayar, çerezler `secure` olur. Sunucuda `NODE_ENV`
**production** olmalı, yoksa çerezler HTTP üzerinden de gider.

Bununla birlikte blogun görüntülenme sayacı (`POST /api/blogs/slug/:slug/view`)
CSRF korumasına takılıyordu; bu uç nokta artık **muaf listesinde** ve ayrı bir
hız sınırına bağlı (`backend/middleware/csrf.js:28`, `backend/routes/blogs.js:212`).
Yayına aldıktan sonra bir blog yazısı açıp sayacın arttığını doğrula.

### 1.3 Ortam değişkenleri

| Değişken | Nerede | Neden |
| --- | --- | --- |
| `AUTH_COOKIE_DOMAIN=.kocum.net` | backend + admin | Panel ve API farklı alt alan adlarında; bu olmadan admin'den check-up ekranlarına geçerken oturum düşüyor. |
| `CHECKUP_DATABASE_URL` | admin | Panelin check-up veritabanına bağlanması için. Yoksa `/checkup` ekranları boş açılır. |
| `NEXT_PUBLIC_SITE_URL` | app | Ürün bağlantıları (`kocum.net/urunlerimiz#...`) buradan üretiliyor. |

### 1.4 ⚠️ Serhat Hoca'ya sorulacak: sınav sabitleri

`app/lib/exams.ts` her sınavın **matematik soru sayısını** ve **yanlışın doğruyu
götürme oranını** tutuyor. TYT/AYT/LGS güvenli; **KPSS, DGS ve ALES için oran şu an
`0.25` varsayıldı ve kodda ⚠️ ile işaretli.**

Bu önemli çünkü oran, oturum başlarken paketten **kopyalanıyor**; sonradan
düzeltmek **eski sonuçları düzeltmiyor**. Yani yanlış bir oranla çözülen her test
kalıcı olarak yanlış net taşır. Yayına almadan önce doğrulanmalı.

Doğrulanacak değerler (`lib/exams.ts` içinde tek tablo):

- KPSS Lisans matematik: 30 soru · ceza 0,25
- KPSS Önlisans matematik: 30 soru · ceza 0,25
- DGS sayısal: 60 soru · ceza 0,25
- ALES sayısal: 50 soru · ceza 0,25

Ayrıca sınav tarihleri (`examDate`) **bilerek boş**: uydurma bir tarihle geri
sayım göstermek, hiç göstermemekten kötü. Tarihler netleşince eklenirse panelde
"sınava X gün" otomatik çıkar.

### 1.5 Yerel geliştirme: 5000 portu dolu

Bu makinede 5000 portunu **başka bir proje** (Hospitadent API) tutuyor. Backend'i
test ederken 5055'te çalıştırdım. `admin/` ve `frontend/` yerelde `:5000`'e bakıyor;
o proje açıkken kocum.net backend'i yerelde çalışmaz. Ya o servisi kapat ya da
kocum.net backend'ini kalıcı olarak başka bir porta al.

### 1.6 Gerçek soru havuzu

Check-up'ta şu an **~2.200 demo sorusu** var — şablondan üretilmiş, **gerçek soru
değil**. Ürün mantığı, puanlama ve koçluk bunlarla test edildi ama yayına gerçek
sorularla çıkılır. Pilot için hedef: TYT Çekirdek'in 8 konusunda 10'ar gerçek soru.

Sorulacak: **fasiküllerin dizgi kaynağı (Word/InDesign) duruyor mu, yoksa sadece
baskı PDF'i mi kaldı?** Cevap, toplu içe aktarma yazılıp yazılmayacağını belirliyor.

---

## 2. Check-up uygulaması — asıl iş

Senin önceliğin buydu: *"güzelleşip mobil uyumlu hale gelmesi, tüm sınavlar,
kişi kendini takip edebilmeli, profesyonel bir öğrenci koçu gibi."*

### 2.1 Artık altı sınav

LGS · TYT · AYT · KPSS (lisans/önlisans) · DGS · ALES.

Önemli karar: **konular sınavlar arasında paylaşılıyor.** Her sınava ayrı konu
ağacı açmak yerine konuya `examScopes[]` etiketi konuldu. Sonuç:

- "Problemler" için yazılmış 200 soru altı sınavın hepsinde kullanılıyor —
  havuz bölünmüyor. Ayrı ağaç yapılsaydı hiçbir sınavda yeterli soru olmazdı.
- Öğrenci TYT'den DGS'ye geçse bile konu geçmişi sürüyor.
- Sınav bazlı ağırlık ayrı (`Topic.examWeights`): aynı konu TYT'de 5, DGS'de
  2 soru getiriyorsa öncelik sırası buna göre değişiyor.

Katalogda 28 öğrenci paketi var; her sınav için bir **"Tanışma Check-up'ı"**
(12 soru / 15 dk) dahil. Soru havuzu yetmeyen paketler yayına çıkmıyor, `DRAFT`
kalıyor — yarım test başlatmıyoruz.

### 2.2 Rapor değil, koç çıktısı

En büyük değişiklik sonuç ekranında. Eskiden: halka, net, konu haritası, ürün
listesi. Doğruydu ama öğrenciyi hareket ettirmiyordu.

Şimdi sıra şöyle (telefonda ilk ekranda ilk üçü):

1. **Karar cümlesi** — banda göre değişir, her zaman bir sayı içerir, tek bir
   eylem söyler. *"%38 — bu bir yetenek meselesi değil, sıralama meselesi."*
2. **Boş bırakma taktiği** — sınava göre. TYT'de "4 yanlış 1 doğru götürüyor,
   iki şık eleyebiliyorsan işaretle"; KPSS'de "yanlış götürmüyor, boş bırakmanın
   matematiksel faydası yok."
3. **Bu hafta sadece bunlar** — en fazla iki konu, sıralı, her birinde
   "sınavda ~3 soru" karşılığı ve tek dokunuşla 5 soruluk kontrol testi.
4. Yanlışların ortak yanı → reçete ("işlem hatası yapıyorsun" değil, "her satırı
   yaz, ara adım atlama").
5. Geçen denemeye göre fark · konu haritası · sonraki ölçüm ne zaman.
6. **Kaynak en sonda:** "Bu konuları çalışmak için elindeki kaynak yetmiyorsa."

Ayrıca: cezasız sınavlarda (KPSS/DGS/ALES) artık ayrı "net" kutusu yok —
net = doğru sayısı olduğu için aynı sayıyı iki kez yazmak hata gibi duruyordu.

### 2.3 Haftalık plan (yeni)

Test bitince plan **kendiliğinden** oluşuyor. En fazla iki konu, her konuda dört
iş: konu tekrarı (60 dk) → 40 soru (70 dk) → yanlış analizi (25 dk) →
**kontrol testi (5 soru)**.

Kritik kural: **kontrol testi elle işaretlenemez.** Sistem, ancak o konuda
gerçekten 5 soruluk test çözülünce kapatıyor. "40 soru çözdüm" demek kolaydır;
kontrol testini geçmek değildir. Doğrulama adımı olmayan plan yapılacaklar
listesidir ve yapılacaklar listeleri terk edilir.

Diğer işler silinebilir — koç da "bu hafta vaktim yok" itirazını dinler.

### 2.4 Kendini takip

- **Tanışma ekranı** (`/tanisma`): hangi sınav, hangi aşama, kaç net hedef.
  Bu bilgiler kayıt formunda zaten toplanıyordu ama **hiçbir yerde
  kullanılmıyordu** — DGS'ye hazırlanan birine AYT trigonometri paketi
  öneriliyordu.
- **Gelişim sayfası**: "tahmini net" (son üç ölçümün oranı, sınavın matematik
  soru sayısına taşınıyor) + hedefe kalan fark + sınava kalan gün. Ekranda
  açıkça "bu bir tahmindir, gerçek sınav neti değildir" yazıyor.
- **Haftalık tempo**: "Bu hafta 1/2 check-up" — öğrencinin tanışmada kendi
  koyduğu hedef. (Bu da toplanıp kullanılmayan bir veriydi.)
- Kaldırılanlar: "en iyi test", "toplam süre". İkisi de gurur okşuyor, hiçbir
  eyleme yol açmıyor.

### 2.5 Mobil

375 piksel genişlikte (iPhone SE/13 mini) baştan sona elden geçirildi ve
tarayıcıda doğrulandı. Tüm sayfalarda yatay taşma yok (ölçüldü: `scrollWidth` = 375).

- Test ekranı: 56 piksel başlık, sayaç sağ üstte, şıklar 48 piksel dokunma
  hedefi, alt çubukta önceki/palet/sonraki.
- **Sayaç artık son iki dakikada yanıp sönmüyor.** Matematik sorusu çözen
  öğrencinin ekranında titreyen bir sayaç, onu sorudan koparıyor. Yerine düz
  kırmızı + ekran okuyucuya "5 dakika kaldı" / "1 dakika kaldı" duyurusu.
- Cevap incelemesi: varsayılan olarak yalnızca yanlış ve boşlar, üstte soru
  şeridi (dokununca o soruya gider).
- Bulunan ve düzeltilen bir hata: `fieldset` tarayıcı varsayılanı
  (`min-inline-size: min-content`) yüzünden içindeki yatay kaydırma şeridi
  **tüm sayfayı yana taşırıyordu** — mobilde alt menünün son sekmesi ekran
  dışında kalıyordu.

### 2.6 Testte veri kaybına karşı

Test ekranı mobil internet koptuğunda cevabı kaybediyordu: öğrenci işaretli
görüyor, sunucuda hiçbir şey yok, test bitince o soru boş sayılıyordu.

- Cevaplar artık **kuyrukta**; bağlantı gelince geri adımlı olarak yazılıyor.
- **Testi bitirmeden önce kuyruğun boşalması bekleniyor.**
- Kayıt durumu **telefonda da görünüyor** (eskiden sadece masaüstünde vardı,
  yani hatayı telefondaki öğrenci hiç görmüyordu). Hata olursa başlığa yapışık
  kırmızı bir şerit: "2 cevabın kaydedilmedi."
- Android geri hareketi artık testten atmıyor, çıkış onayı açıyor.
- Sekme arkaya atılınca soru süresi duruyor (telefonu kilitleyip yarım saat
  sonra dönen öğrencinin sorusu "30 dakika sürdü" diye kaydediliyordu).
- Hiç dokunulmamış soruların süresi de artık kaydediliyor.

### 2.7 Kapatılan bir güvenlik açığı

`startTopicRetest` (konu tekrar testi) paket erişim hakkına bakmıyordu. Herhangi
bir öğrenci istediği konu kimliğiyle çağırıp **ücretli havuzdan beşer beşer soru
çekebilirdi.** İki kapı kondu:

1. Konu **daha önce ölçülmüş** olmalı (o konudan soru içeren bitmiş bir oturum).
   Ürün olarak da doğru: "kontrol", ölçülmüş bir şeyi yeniden ölçmektir.
2. 24 saatte en fazla 8 tekrar. Günde on kontrol testi çözmek çalışmak değil.

`npm run test:leak` ikisini de denetliyor.

### 2.8 Düzeltilen sessiz hata

Profil formu **eski sınav listesini** (TYT/AYT/İkisi de) tutuyordu. KPSS'ye
hazırlanan bir öğrenci profilini kaydettiğinde **hedef sınavı siliniyordu** —
katalog, plan ve puanlama bozuluyordu. Artık hedefi tek bir yer yazıyor ve
profilde tam bir "Hedefin" kartı var (sınav · aşama · hedef net · haftalık tempo).

---

## 3. Yönetim paneli (admin.kocum.net)

- **~7.400 satır ölü kod silindi**: şablondan gelen takvim, profil, müşteri,
  kategori, dosya yöneticisi, e-posta günlüğü, grafik ve form bileşenleri —
  hiçbirine bağlantı yoktu. 18 kullanılmayan paket kaldırıldı (fullcalendar,
  apexcharts, dnd-kit, swiper, flatpickr…).
- Giriş ekranındaki **"DEKOARTİZAN / E-ticaret Admin Paneli"** yazısı
  "Koçum.Net / Yönetim paneli" oldu.
- Kullanıcı menüsündeki üç ölü bağlantı kaldırıldı (silinmiş sahte profil
  sayfasına gidiyorlardı).
- **Koyu tema artık flaş yapmıyor**: tema sınıfı ilk boyamadan önce senkron bir
  betikle kuruluyor. Eskiden her sayfa açılışında önce beyaz bir ekran görünüyordu.
- Kenar çubuğu menü animasyonu efektsiz yeniden yazıldı; kapalı menü artık
  klavyeye ve ekran okuyucuya görünmüyor.
- Lint: 2 hata → **0 hata**. Derleme temiz.

---

## 4. Backend (API)

Güvenlik sertleştirmesi — hepsi `npm run smoke` ile doğrulandı (18/18):

- **CSRF** çift-gönderim (double-submit) olarak yeniden yazıldı.
- **Hız sınırları**: admin girişi, genel API, yazma işlemleri, görüntülenme
  sayacı ve iletişim formu için ayrı ayrı (geliştirmede 20 kat gevşek).
- **helmet**, üretimde fail-closed CORS, `/uploads` için `nosniff`,
  düzgün SIGTERM kapanışı, veritabanına dokunan sağlık kontrolü.
- **Blog rotaları** baştan yazıldı: güncellenebilir alan beyaz listesi, dosya
  yolu hapsi (path traversal), atomik görüntülenme sayacı, benzersiz slug
  çakışma yeniden denemesi, görsellerde **sihirli bayt** denetimi.
- Yetki: `manager` rolü artık bir `admin`'i düzenleyemiyor; denetim kaydı tutuluyor.
- **Güvenlik açığı sayısı 11 → 2** (kalan ikisi sequelize'in uuid bağımlılığı;
  düzeltmek sequelize'i 3.x'e düşürüyor, yapılmadı).
- Yeni: iletişim formu mesajları veritabanına yazılıyor ve panelden okunuyor.

---

## 5. Nasıl doğrularsın

```bash
cd app && npm run smoke && npm run test:leak && npm run test:markup
```

```bash
# Backend duman testi ÇALIŞAN sunucuya istek atar. 5000 doluysa:
cd backend && SMOKE_BASE_URL=http://127.0.0.1:5055 npm run smoke
```

Ekranları görmek için (check-up 3100, panel 3001):

```bash
cd app && npm run dev -- --port 3100
```

Veritabanında şu an: **28 öğrenci paketi** (hepsi yayında, taslak yok),
6 gizli kontrol testi paketi, 72 konu, 2.196 demo sorusu.
`npm run db:seed:demo` idempotent, tekrar çalıştırmak güvenli.

> **Şema değiştirirsen** `admin/` içinde `npm run checkup:sync` çalıştır —
> panel aynı veritabanına bağlanıyor ama şemanın kopyasını tutuyor. Bu gece
> eşitlendi.

---

## 6. Sırada ne var (önerim)

1. **Gerçek soru girişi** — pilot için TYT Çekirdek'in 8 konusunda 10'ar soru.
   Ürünün geri kalanı hazır; eksik olan tek şey içerik.
2. **Ödeme** — hak (entitlement) katmanı hazır, haklar şu an panelden elle
   veriliyor. iyzico/PayTR hesabı açılınca bağlanır. ⚠️ 18 yaş altı kullanıcı +
   ücretli ürün: mesafeli satış sözleşmesi ve cayma hakkı metinleri zorunlu.
3. **E-posta** — parola sıfırlama şu an SMTP ayarlıysa çalışıyor; üretim SMTP
   kararı verilmeli.
4. **Sınav tarihleri** — girilirse geri sayım her ekranda otomatik görünür.
