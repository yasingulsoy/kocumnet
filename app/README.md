# Koçum.Net — Matematik Check-up

Öğrencinin matematik seviyesini kısa bir testle ölçen, zayıf konularını çıkaran,
**bu hafta ne çalışacağını söyleyen** ve gerekiyorsa Koçum.Net yayınını öneren uygulama.

Kapsam: LGS · TYT · AYT · KPSS (lisans/önlisans) · DGS · ALES. Konular sınavlar
arasında PAYLAŞILIR (`Topic.examScopes`): aynı "Problemler" konusu hem TYT hem DGS
öğrencisinde ölçülür, böylece soru havuzu bölünmez ve konu geçmişi sürekli kalır.

**Kararların gerekçeleri [PLAN.md](PLAN.md)'de.** Bir şeyi değiştirmeden önce oraya bak:
çoğu "tuhaf" görünen tercih bilinçli.

## Kurulum

```bash
npm install
npm run db:migrate        # şema
npm run db:seed           # konu ağacı + paketler (idempotent, tekrar çalıştırmak güvenli)
npm run db:seed:demo      # ~2200 demo sorusu — SADECE geliştirme
npm run dev -- --port 3100
```

`.env` içinde en az `DATABASE_URL` gerekir (tam liste ve açıklamalar `.env.example`'da):

```
DATABASE_URL="postgresql://.../kocumnet_checkup?schema=public"
```

Oturum jetonları rastgele üretilip hash'i saklandığı için imzalama anahtarı
(`SESSION_SECRET` vb.) YOK.

## Doğrulama

Her değişiklikten sonra üçü de çalıştırılmalı:

```bash
npm run smoke        # saf mantık: parola, içerik şeması, parmak izi, net, teşhis
npm run test:markup  # yazım biçimi ayrıştırma + düzenleme gidiş-dönüşü
npm run test:leak    # uçtan uca akış + CEVAP ANAHTARI SIZINTI DENETİMİ
```

`test:leak` öğrenciye giden JSON'da `isCorrect`/`errorType` olmadığını doğrular.
Bu denetim olmadan sızıntı sessizdir: arayüz çalışmaya devam eder, testin anlamı kalmaz.

## Yapı

Bu uygulama **yalnızca öğrenci** içindir. Yönetim (soru ekleme, kayıtlı öğrenciler,
test sonuçları, erişim hakları, paket ayarları) `admin.kocum.net`'te — kök dizindeki
`admin/` projesi, `src/app/(admin)/checkup/` altında (bkz. `admin/CHECKUP.md`).

**Şemanın ve migration'ların sahibi bu uygulama.** Panel aynı veritabanına bağlanır ama
şemayı yalnızca kopyalar; `prisma/schema.prisma` ya da aşağıdaki saf modüllerden birini
değiştirdikten sonra `admin/` içinde `npm run checkup:sync` çalıştırın (panelin `dev`
komutu eşit değilse başlamaz):
`question-content.ts`, `question-markup.ts`, `error-types.ts`, `scoring.ts`, `insights.ts`.
Bu dosyalar `@/` ile değil göreli yolla import eder — kopya başka dizinde çalışsın diye.

```
app/
  page.tsx                 Tanıtım (girişliyse /panel'e yönlenir)
  (auth)/                  Giriş · kayıt · parola sıfırlama — bölünmüş düzen
  (panel)/                 Girişli öğrenci — kenar çubuğu / mobil sekme çubuğu
    panel/                 Pano: haftalık plan, tek eylem, ilerleme şeridi
    paketler/              Katalog (sınava göre) → [slug]: test öncesi ekran
    sonuc/[sessionId]      Karar cümlesi → öncelik sırası → plan → kaynak → inceleme
    gelisim/               Hedef takibi (tahmini net), eğilim, konu haritası, geçmiş
    profil/                Bilgiler, HEDEF (sınav/sınıf/net/tempo), parola, erişimler
  tanisma/                 İlk giriş: hangi sınav · hangi aşama · kaç net hedef
  checkup/[sessionId]      Sınav modu — çerçevesiz, dikkat dağıtan hiçbir şey yok
  api/media/[id]           Görsel servisi (baytlar veritabanında)
components/
  ui/                      Tasarım sistemi: düğme, kart, rozet, grafik, diyalog
  shell/                   Öğrenci çerçevesi (kenar çubuğu + mobil sekme çubuğu)
  PackageCard.tsx          Paket kartı (pano + katalog)
  PlanCard.tsx             Haftalık plan — konuya göre gruplu, RETEST işaretlenemez
  MathContent.tsx          LaTeX → HTML, SUNUCUDA (KaTeX JS istemciye gitmez)
lib/
  exams.ts                 SINAV TABLOSU: soru sayısı, ceza oranı, sınıflar, sezon
  coaching.ts              Koçluk mantığı (saf): öncelik sırası, karar cümlesi, plan
  plan.ts                  Haftalık planın veritabanı tarafı
  checkup.ts               Akış: başlat → cevapla → bitir → incele → konu tekrarı
  scoring.ts · diagnosis.ts · insights.ts   Puanlama, teşhis, pano okumaları (saf)
  question-selection.ts    Katmanlı soru seçimi (adaptif DEĞİL — PLAN §5)
  question-content.ts      JSONB blok şeması, parmak izi, şık doğrulaması
  entitlements.ts          Ücretli paket erişim denetimi
  catalog.ts               Öğrenciye özel paket listesi (kilit, yarım test)
  auth.ts · password.ts    Oturum (token hash'i saklanır) · scrypt
  actions/                 Server action'lar: auth, checkup, profile, password-reset
```

## Koçluk modeli

Ürünü bir "deneme sınavı"ndan ayıran şey burası. Kurallar `lib/coaching.ts` içinde
saf fonksiyonlar olarak duruyor; hepsi `npm run smoke` ile test ediliyor.

| Kural | Neden |
| --- | --- |
| **Haftada en fazla 2 konu** (`MAX_TOPICS_PER_WEEK`) | Beş zayıf konuyu aynı hafta vermek hiçbirinin bitmemesi demek. Bitmeyen plan duvar kâğıdıdır. |
| **Kanıt eşiği: en az 3 soru** | Tek yanlıştan konu çıkarmak öğrenciyi boşa bir hafta çalıştırır. |
| **Eşitlikte sınav ağırlığı** (`Topic.examWeights`) | İki konu da %30 ise, sınavda 5 soru getiren 1 soru getirenden önce gelir. |
| **Karar cümlesi her zaman bir SAYI içerir** | "Harikasın" öğrenciye bir şey öğretmez; "Köklü Sayılar'da 6/6" öğretir. |
| **RETEST işi elle işaretlenemez** | "40 soru çözdüm" demek kolay, 5 soruluk kontrol testini geçmek değil. Planın dürüstlüğü buna dayanır. |
| **İş silinebilir** | Koç da "bu hafta vaktim yok" itirazını dinler. Kabul edilmiş plan yapılır. |
| **Konu tekrar testi yalnızca ÖLÇÜLEN konuda** | Hem anlam (kontrol = yeniden ölçüm) hem güvenlik: bu uç nokta paket hakkına bakmaz, denetimsiz bırakılsa havuz beşer beşer boşaltılırdı. Günlük sınır `GUNLUK_TEKRAR_SINIRI`. |
| **Boş bırakma tavsiyesi sınava göre** | KPSS/DGS/ALES'te yanlış doğruyu götürmez; orada "boş bırak" demek net kaybettirir. |
| **Havuz daraldıysa söylenir** (`relaxedExposureCount`) | Şişmiş bir sonucu gerçek sanan öğrenci çalışmayı bırakır. |

Döngü: **ölç → sırala → çalıştır → DOĞRULA → yeniden ölç.** Doğrulama adımı
olmayan bir plan yapılacaklar listesidir; yapılacaklar listeleri terk edilir.

## Tasarım sistemi

- **Renkler** `app/globals.css` içinde belirteç olarak: marka (lacivert · mavi ·
  camgöbeği), mavi tonlu nötrler, anlam renkleri için ayrı **metin** ve **dolgu** tonu.
- **Bileşenler** `components/ui/`: `Button`/`LinkButton` (6 varyant, 3 boy), `Card`,
  `Badge`, `Alert`, `Field`, `Stat`, `Progress`, `EmptyState`, `Dialog` (yerel
  `<dialog>`, mobilde alttan tabaka), `ScoreRing`, `TrendChart`, `TopicBar`.
- **Grafikler saf SVG** — grafik kütüphanesi yok; sunucuda çizilip JS'siz geliyor.
- **İkonlar** lucide-react 1.x (bazı adlar 0.x'ten farklı: `CircleCheck`,
  `TriangleAlert`, `ChartColumn`…).
- Sınıf birleştirme `lib/cn.ts` (clsx + tailwind-merge): çağıranın verdiği sınıf
  bileşenin varsayılanını ezer, `!önemli` işaretine gerek kalmaz.

## Bilinmesi gerekenler

- **Next 16'da `error.tsx` kurtarma fonksiyonu `retry`** (`reset` değil).
- **Önizleme panelinde ilk ekran görüntüsü eski kare getirebilir** (giriş animasyonu
  ortası). Tasarımı gözle kontrol ederken ikinci kareye bakın; sayfa gerçekte doğru.
- **Prisma 7'de `migrate dev` client'ı yeniden ÜRETMEZ** ve çalışan `next dev` eskisini
  bellekte tutar. `dev` ve `db:migrate` script'leri `prisma generate` ile başlıyor;
  şema değiştirdikten sonra **dev sunucusunu yeniden başlatın**.
- **Prisma 7 eski sürümlerden çok farklı** — config `prisma7.config.ts`, `datasource`
  bloğunda `url` yok, driver adapter zorunlu, üretilen client TypeScript kaynağı.
  Detay PLAN §7'de.
- **Üretilen client gitignore'da**, bu yüzden `build` script'i `prisma generate`
  ile başlıyor. Kaldırma, deploy patlar.
- **Betikler `.mts` uzantılı** olmak zorunda (`type: module` yok; tsx `.ts`'yi CJS
  sayıp top-level await'i reddediyor).
- **Bir pakette bir konuya en az 3 soru** — tek soruyla konu seviyesi ölçülemez.
  `seed.ts` bunu zorunlu kılıyor (PLAN §2).
- **`"use server"` dosyalarından yalnızca async fonksiyon ihraç edilir.** Sabit bir
  nesne oradan dışa aktarılırsa istemciye BOŞ ulaşır ve hata sessizdir (açılır liste
  boş görünür). Bu yüzden `error-types.ts` ayrı duruyor.
- **Görseller veritabanında** (`MediaAsset.data`), diskte değil — konteyner geçici,
  volume unutulursa şekiller sessizce kaybolurdu. Detay PLAN §9.5.
- **Server action gövde sınırı varsayılanda (1 MB)**; bu uygulama dosya almıyor.
  Şekil yükleme panelde ve 10 MB'lık sınır `admin/next.config.ts`'te.
- **`fieldset` varsayılanı `min-inline-size: min-content`.** İçine yatay kaydırma
  şeridi koyarsan fieldset daralmaz, sayfayı yana taşırır (mobilde alt menünün son
  sekmesi ekran dışında kalır). `globals.css` bunu sıfırlıyor.
- **Sınav bilgileri tek yerde: `lib/exams.ts`.** Soru sayısı ve yanlış götürme oranı
  yıldan yıla değişir; `penaltyRatio` oturum başlarken pakete göre KOPYALANIR, sonradan
  düzeltmek eski sonuçları düzeltmez. Yayından önce doğrulanmalı.
- **Öğrencinin hedef sınavını yalnızca `hedefGuncelleAction` yazar.** Profil formu bir
  ara ikinci bir sınav listesi tutuyordu ve eski kaldığı için KPSS öğrencisinin hedefi
  kaydedince siliniyordu. İki liste tutma.
- **React 19 form eylemi bitince formu sıfırlar.** `<select>` DOM'da varsayılana döner
  ve React geri yazmaz; paneldeki soru formunda seçimler gizli alanlarla taşınıyor ve
  görünen select'ler efektle durumdan geri yazılıyor (`admin/.../QuestionForm.tsx`).
