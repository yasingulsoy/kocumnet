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
npm run db:seed           # konu ağacı + eksik paketler (idempotent; var olan katalog paketinin içeriğine dokunmaz)
npm run db:seed -- --guncelle   # paket içeriğini seed.ts'teki hâline döndür (panel düzenlemelerini ezer)
npm run db:seed:demo      # ~2200 demo sorusu — SADECE geliştirme
npm run db:seed:levels    # seviyeli check-up paketleri + demo kazanımlar
                          #   üretimde: -- --yalniz-paket
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
npm run smoke        # saf mantık: parola, içerik şeması, net, teşhis, SEVİYE KAPILARI
                     #   + istemci paketi: "use client" dosyalarından katex'e yol yok
npm run test:markup  # yazım biçimi ayrıştırma + düzenleme gidiş-dönüşü
npm run test:leak    # uçtan uca akış + CEVAP ANAHTARI SIZINTI DENETİMİ
npm run test:levels  # seviyeli check-up zinciri + TELAFİDE SORU TEKRARI DENETİMİ
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
    seviyeli/              Seviyeli check-up girişi: nasıl işler, başlat
    seviye/[runId]         Aşama geçişi, telafi uyarısı, kilit ve üç karne
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
  levels.ts                SEVİYELİ CHECK-UP kuralları (saf): kapılar, eşikler, metin
  level-run.ts             Seviyeli sınavın zinciri: aşama aç, kapıyı değerlendir
  level-selection.ts       Kazanım başına soru seçimi + telafi turu
  level-report.ts          Üç karnenin verisi
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
| **Kontrol testi ölçüm değil, doğrulama** | Eğilim grafiğine, tahmini nete ve panodaki genel başarıya girmez (konu haritasına girer). Sonuç ekranı paket kararı yerine `kontrolKarari` kullanır ve planla bağı gösterir: tek zayıf konuluk 5 soru genel çizgiyi sebepsiz düşürüyordu. |

Döngü: **ölç → sırala → çalıştır → DOĞRULA → yeniden ölç.** Doğrulama adımı
olmayan bir plan yapılacaklar listesidir; yapılacaklar listeleri terk edilir.

## Seviyeli check-up

Odaklı paketlerin yanında duran ikinci ürün: üç seviyeli, kapılı yerleştirme
sınavı (`lib/levels.ts`). Haftalık ölçüm paketlerden, "nerede duruyorum"
buradan.

| Kural | Neden |
| --- | --- |
| **Seviye 1'de her soru BİR kazanım** | Telafi turu "eksik kazanımlardan yeni soru" getiriyor. Konu düzeyinde çalışsaydı bir soruyu kaçırana konunun tamamından soru gelirdi. |
| **Telafide aynı soru ASLA gelmez** | Gelirse öğrenci hatırlar, doğru yapar, sistem kazanımın oturduğunu sanır. Ölçüm orada çöker. `npm run test:levels` bunu denetliyor. |
| **Matematiksel kısa devre** | Telafinin tamamını doğru yapsa bile barajı aşamayacak öğrenci o tura sokulmaz. 50'de 9 doğrusu olanın en iyi ihtimali 50/91 = %54,9 — barajın altında. |
| **Net yok, ham doğru sayısı** | Burada ölçülen sınav taktiği değil, kazanımın var olup olmadığı. Oturumlar `penaltyRatio = 0`. |
| **Telafi turu kendiliğinden AÇILMAZ** | Öğrenci neden ek soru çözdüğünü bilmeden soruyla karşılaşmamalı; sayaç "devam" dediğinde başlamalı. |
| **Seviye 3'te baraj yok** | Oraya gelen iki kapıyı geçmiş. Sonuç rapora yazılır, "kaldın" denmez. |
| **Aşamalar ayrı oturum** | Her birinin kendi süresi var, aralarında ara verilebilir. Mevcut oturum makinesi (sayaç, cevap kaydı, sızıntı koruması) olduğu gibi çalışıyor. |
| **Kapsam: boş liste = KONUNUN sınavları** | Kazanımın/sorunun `examScopes` listesi doluysa o; boşsa `Topic.examScopes` (o da boşsa konunun ana sınavı). Tek tanım `lib/exam-scope.ts`; seviyeli seçim, paket seçimi ve kontrol testi (konu öğrencinin sınavında değilse açılmaz) aynı tanımı kullanır. Eskiden boş liste "her sınav" sayılıyordu: kapsamı boş AYT/TYT soruları LGS Seviye 2-3'e giriyordu. `npm run test:levels` dört aşamayı, `test:leak` kontrol testini denetliyor. |

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
  `seed.ts` ve yönetim panelinin paket düzenleyicisi bunu zorunlu kılıyor (PLAN §2).
- **Paket içeriği panelden düzenlenir; tohum onu ezmez.** `db:seed` var olan katalog
  (STANDARD) paketinin adını, özetini, süresini ve konu dağılımını yazmaz (yalnızca
  `--guncelle` ile); panelden düzenlenmeyen sistem paketlerini (tanışma, konu tekrar)
  her seferinde bu dosyadan yazar;
  sınavdan türeyen alanları (sınav, tür, yanlış götürme oranı) her seferinde eşitler,
  havuzu yetmeyen paketi taslağa çeker. Ayrıntı: [DEPLOY.md](DEPLOY.md) §3.
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
- **KaTeX yalnızca sunucuda.** İstemci bileşeni (`"use client"`) `MathContent`'i import
  etmez; formüller sunucuda çizilip hazır düğüm olarak geçer (sınav ekranı, cevap
  incelemesi). Cevap incelemesi bunu bir ara kaçırmıştı ve sonuç sayfasına 270 KB'lık
  KaTeX JS'i iniyordu; `npm run smoke` artık import zincirini denetliyor.
- **Sınav ekranı sunucuyla eşitlenir.** Next geri/ileri gezinmede sayfanın eski
  çıktısını önbellekten getiriyor (eski kalan süre, eski işaretler). Ekran açılınca ve
  sekmeye dönülünce `sinavDurumuAction` süreyi ve işaretleri tazeler; test başka yerde
  bittiyse sonuca gider. Yazılmamış cevaplar ve "sonra bak" işaretleri cihazda
  (`localStorage`, `sinav-deposu.ts`) — sekme kapansa da kaybolmaz. Kuyruk ve eşitleme
  kuralları saf modülde (`lib/sinav-kuyrugu.ts`), birim testleri `npm run smoke` içinde.
- **Paket akışıyla yalnızca katalog paketleri başlar** (`KATALOG_TURLERI`: STANDARD,
  INTRO). Seviyeli (LEVEL) ve konu tekrar (RETEST) paketlerinin konu dağılımı yok;
  katalogda kaldıklarında "sıradaki adım" diye öneriliyor, başlatılınca sıfır soruluk
  oturum açılıp sınav ekranı çöküyordu. `startCheckup` reddeder, `test:leak` denetler.
- **Cevap kaydında süre toleransı** (`KAYIT_TOLERANSI_MS`, 15 sn): istemci sayacı sayfa
  tarayıcıda açılınca başladığı için sunucudan birkaç saniye geç biter; son saniyede
  işaretlenen cevap reddedilmesin diye. Sınav eylemleri hata KODU döndürür
  (`KAPANDI`, `SURE_DOLDU`, `OTURUM`): üretimde fırlatılan hatanın mesajı istemciye
  gitmiyor ve ekran kalıcı hatayı ağ kopması sanıp sonsuza kadar tekrar deniyordu.
- **React 19 form eylemi bitince formu sıfırlar.** `<select>` DOM'da varsayılana döner
  ve React geri yazmaz; paneldeki soru formunda seçimler gizli alanlarla taşınıyor ve
  görünen select'ler efektle durumdan geri yazılıyor (`admin/.../QuestionForm.tsx`).
  Metin alanları da silinir: giriş ve kayıt eylemleri hata dönüşünde gönderilen
  değerleri (parola HARİÇ) `values` ile geri verir, alanlar `defaultValue` olarak yazar.
