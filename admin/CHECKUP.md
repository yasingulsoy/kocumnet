# Check-up yönetimi

Matematik Check-up'ın (öğrenci uygulaması: kök dizindeki `app/`) yönetim ekranları.
Panel bu bölümden ibaret: **doğrudan `kocumnet_checkup` veritabanına** Prisma ile
bağlanır; backend yalnızca giriş ve oturum doğrulaması için kullanılır.

| Ekran | Adres | Kim görür |
|---|---|---|
| Genel bakış — kayıt/test sayıları, son 14 gün, içerik kuyruğu, dikkat isteyen paketler, zorlanılan konular | `/checkup` | tüm personel (öğrenci adları yalnızca yönetici/müdür) |
| Hocaya sorular — Özgür Hoca'nın içerik ve kural kararları: soru başına kart (Uygun/Değişsin, seçenek, sayı, tablo, yazı + not), ilerleme, süzgeç (`?suzgec=bekleyen\|cevaplanan\|uygulanan\|acil`), bölüm atlama, yazdırma; "uygulandı" işareti (cevap değişince kalkar); cevap dökümü `.md`. Sorular kodda (`lib/checkup/hoca/sorular.ts`), cevaplar `TeacherAnswer`'da, kurallar `lib/checkup/hoca/cevap.ts` | `/checkup/hoca`, `/hoca/cevaplar.md` | okuma: tüm personel; cevap: yönetici, müdür, editör; "uygulandı" ve döküm: yönetici, müdür |
| Sorular — liste, süzgeç (metin/kaynak/`#kimlik` araması, kazanım, içe aktarma partisi `?parti=`, "Açık notu olanlar" `?not=acik`), satırda açık not rozeti, hızlı ve toplu durum değiştirme | `/checkup/sorular` | tüm personel; durum değiştirme: yazma rolleri |
| Toplu içe aktar — SORU-SABLONU `.md` + görseller (klasör seçimi ya da sürükle-bırak); **Denetle** (soru başına hata/uyarı, çift kayıt, hiçbir şey yazılmaz) → **Taslak olarak kaydet** (isteğe bağlı doğrudan yayın); içe aktarma geçmişi ve **Geri al** | `/checkup/sorular/ice-aktar` | geçmiş: tüm personel; içe aktarma ve geri alma: yazma rolleri |
| Soru ekle / düzenle — `$…$` yazımı, canlı KaTeX önizleme, şekil yükleme, madde analizi kartı (bulguda "Not ekle"), inceleme notları (ekle, çözüldü / yeniden aç), "kaydet ve yenisini ekle", "benzerini oluştur", süzgeçli listede önceki/sonraki ve "kaydet ve sonrakine geç" | `/checkup/sorular/yeni`, `/[id]` | yazma ve not: yönetici, müdür, editör; notları okuma: tüm personel |
| Madde analizi — gerçek cevaplardan doğru oranı, ayırt edicilik, şık dağılımı, süre ve bulgular; sınav ve dönem süzgeci, CSV, önerilen zorluğu toplu uygulama (yazma rolleri); satırda açık not sayısı ve "Not ekle" (soru ekranında not kutusu bulgularla dolu açılır) | `/checkup/sorular/analiz`, `/analiz/csv` | tüm personel (kişisel veri yok) |
| Havuz durumu — katalog paketi × konu doldurulabilirlik, zorluk bantları | `/checkup/havuz` | tüm personel |
| Öğrenciler + öğrenci detayı (test geçmişi, konu haritası, çalışma planı ve koç notu, seviyeli koşular, erişim hakları) | `/checkup/ogrenciler` | yönetici, müdür |
| Riskli öğrenciler — pasif, düşüşte, planı yapmıyor, hiç başlamadı; eşikler `lib/checkup/risk.ts` | `/checkup/ogrenciler/riskli` | yönetici, müdür |
| Paketler — türüne göre (katalog / seviyeli / konu tekrar testi) hazırlık, yayın durumu, ücretli/ücretsiz | `/checkup/paketler` | değiştirme: yönetici, müdür |
| Paket oluştur / düzenle — katalog (STANDARD) paketinin adı, özeti, süresi ve konu dağılımı; konu başına canlı havuz yeterliliği | `/checkup/paketler/yeni`, `/[id]` | yönetici, müdür |
| Kazanımlar — seviyeli check-up'ın öğrenme çıktıları; sınav başına seviye 1 hazırlık sayacı (kazanım × ≥2 L1 sorusu; LGS 35, diğerleri 50) | `/checkup/kazanimlar` | yazma: yönetici, müdür, editör |
| Seviyeli koşular — kim hangi seviyede, kapıda duranlar, telafi bekleyenler | `/checkup/seviyeli` | tüm personel (öğrenci adları yönetici/müdür) |

Roller backend'in `utils/roles.js` gruplarıyla aynı (`CONTENT_ROLES`, `USER_MANAGE_ROLES`).
Öğrenci kişisel verisini soru yazan editörün görmesi gerekmiyor — KVKK gereği en az kişiye açık.

## Kod

```
src/lib/checkup/
  db.ts            Prisma client (CHECKUP_DATABASE_URL, driver adapter)
  roles.ts         Roller ve etiketler — istemci bileşenleri de okur (sunucu API'si yok)
  staff.ts         Sunucu tarafı personel doğrulaması (server-only)
  pool.ts          Paket sağlığı, türüne ve sınav kapsamına göre (katalog / seviyeli / konu tekrar)
  levels.ts        Seviye soru sayıları — shared/levels.ts üstünde ince sarmalayıcı
  exam-scope.ts    Sınav kapsamı kuralı: Prisma süzgeçleri shared/exam-scope.ts'ten, ham SQL ikizi burada
  item-flags.ts    Madde analizi: eşikler, bulgular, saf hesaplar (liste ve soru ekranı ortak)
  item-analysis.ts Madde analizi sorguları (server-only)
  question-list.ts Soru listesinin adres sorgusu — kaydedince aynı süzgece/sayfaya dönüş (`geri`)
  question-query.ts Soru listesinin süzgeç ve sırası (server-only) — liste ve önceki/sonraki ortak
  item-list.ts     Madde analizi listesi: süzgeç, sıralama, adres — sayfa ve CSV ortak
  risk.ts          Riskli öğrenci kuralları ve eşikleri (tek yer); risk-data.ts veriyi toplar
  coach-note.ts    Koç notu sınırı ve temizliği (düzenleyici ve eylem ortak)
  package-rules.ts Paket düzenleme kuralları (MIN_PER_TOPIC, sınırlar, adres önerisi) — istemci ve sunucu ortak
  package-save.ts  Katalog paketi doğrulama ve yazma (server-only; yetkiyi eylem denetler)
  question-import.ts Toplu içe aktarma: dosya okuma, denetim bağlamı, görsel çevirme, yazma, geri alma, geçmiş (server-only)
  question-note.ts İnceleme notu kuralları: 2000 karakter sınırı, temizlik, bulgudan not metni (istemci ve sunucu ortak)
  question-notes.ts Bir sorunun notları (server-only); yazma actions/notes.ts
  import-report.ts İçe aktarma rapor tipleri ve sınırları (10 MB) — istemci ve sunucu ortak
  media-image.ts   Görsel → WebP (EXIF, 1200 px) — shared/media-image.ts'i sunucuya kilitleyen sarmalayıcı
  content-limits.ts İçerik uzunluk sınırları — shared/content-limits.ts'in yeniden ihracı (istemci de okur)
  format.ts        Etiketler (sınav, sınıf, durum), tarih/sayı biçimleri (Türkiye saati)
  actions/         Server action'lar: sorular (seviye, kazanım, hedef sınav; toplu durum; önerilen zorluk),
                   kazanımlar, şekil, erişim hakkı, paket, plan (koç notu), toplu içe aktarma, inceleme notu
  shared/          ⚠️ app/lib'den KOPYA — elle düzenlemeyin (aşağıya bakın)
  generated/       Prisma client (gitignore'da, üretilir)
src/components/checkup/   Ekran bileşenleri (ortak tasarım belirteçleri: src/app/tokens.css)
src/components/shell/     Panel çerçevesi (kenar çubuğu, mobil çekmece)
src/app/(admin)/checkup/  Sayfalar
src/app/api/checkup-media/[id]   Soru görselleri (yalnızca personele)
prisma/checkup.prisma     ⚠️ app/prisma/schema.prisma'nın KOPYASI
scripts/checkup-sync.mjs  Kopyaları eşitler / denetler
```

## Kimlik doğrulama — neden sunucu tarafında

`(admin)/layout.tsx` artık sunucu bileşeni: oturumu sunucuda doğrular, yoksa
`/signin`'e yönlendirir. Ama Next sayfayı düzenle paralel çizebildiği için düzen
seviyesindeki denetim tek başına yetmez — veri **sunucuda** çiziliyor ve sunucu
denetlemezse öğrenci listesi, çerezi olmayan birine giden yanıtın içinde durur.

Bu yüzden **her sayfa ve her server action** `checkStaff()` / `staffForAction()`
çağırır; düzen seviyesinde tek denetim yetmez. Doğrulama backend'e sorulur
(`/api/admin/auth/verify`, istek başına bir kez): JWT burada çözülseydi pasife
alınan personel jetonun süresi dolana kadar (6 saat) içeride kalırdı. Backend'e
ulaşılamazsa ekran veri göstermez (hata kapalı).

Üretimde bunun çalışması için backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` gerekir —
bkz. [DEPLOY.md](DEPLOY.md).

## Kayıtlarda "kim yaptı"

Personel başka veritabanında (backend `users`) olduğu için yabancı anahtar
kurulamıyor. Soru, şekil, erişim hakkı, inceleme notu ve içe aktarma kayıtlarına
`e-posta (#id)` biçiminde damga yazılıyor: `createdByStaff`, `updatedByStaff`,
`uploadedByStaff`, `grantedByStaff`, `revokedByStaff`, `authorStaff`,
`resolvedByStaff`, `rolledBackByStaff`. Geri alınan erişim hakkı ve geri alınan içe
aktarma silinmez; kim, ne zaman yaptı kayıtta kalır.

**İnceleme notları** (`QuestionNote`) yalnızca personel içindir; öğrenci uygulaması
bu tabloyu hiç okumaz. Not düz metin, en fazla 2000 karakter (`question-note.ts`);
yazma, çözme ve yeniden açma içerik rollerinde, okuma herkeste. Notun metni sunucu
günlüğüne yazılmaz, yalnızca kim ve hangi soru.

## Şema ve paylaşılan modüller

Şemanın ve migration'ların **tek sahibi `app/`**. Panel:

- `prisma/checkup.prisma` kopyasından yalnızca client üretir, **migration çalıştırmaz**
  (config dosyası ve bağlantı adresi olmadığı için `prisma migrate` burada çalışmaz da).
- Soru yazım biçimi, şık kuralları ve puanlama eşiklerini `src/lib/checkup/shared/`
  altındaki kopyalardan kullanır. Panelde kaydedilen soru öğrenci tarafında aynı
  ayrıştırıcıdan geçer; seviye eşikleri iki ekranda aynı olmalı.
- Kopyalanan saf modüller (`scripts/checkup-sync.mjs` → `MODULLER`): question-content,
  question-markup, error-types, scoring, insights, **exams** (sınav listesi, sınıf adları),
  **levels** (seviye soru sayıları), **exam-scope** (sınav kapsamı kuralı), **coaching**
  (hafta başı, hafta etiketi), **question-import** (SORU-SABLONU dosyasını çözümleme ve
  denetleme; `app/scripts/import-questions.mts` ile aynı kurallar), **odev** (ödevin
  tamamlanma kuralı), **deneme** (deneme hazırlık kuralı `denemeHazirMi`, kâğıt kuralları),
  **content-limits** (içerik uzunluk sınırları), **media-image** (görsel biçimi; tek
  paket importu sharp, sunucuya `lib/checkup/media-image.ts` kilitler). Panelde elle tutulan ayna kalmadı: hoca bir sayıyı
  değiştirince `checkup:check` (CI dahil) kopya eskiyse hata verir.
- Paylaşılan modül `@/...` import edemez (kopyada başka yeri gösterir). Tek istisna
  Prisma'nın üretilmiş TİPLERİNİN `import type`ı: betik yolu panelin client'ına çevirir
  (`TIP_YOLLARI`).

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
- **Cevap anahtarı değişirse sürüm artar** (`Question.version`): doğru şıkkın yeri de,
  doğru şıkkın değeri (metninin parmak izi ve görselleri; biçim değil) de sürümü
  artırır. Doğru şıkkın yeri değişince öğrenci uygulamasının bakım işi (cron) sürümü
  eski kalan bitmiş testleri en geç 15 dakika içinde yeniden puanlar ve öğrenciye sonuç
  ekranında bildirir. Doğru şıkkın içeriği değişirse eski cevaplar yeniden puanlanamaz
  (eşleştirilecek başka şık yok); madde analizi yeni sürümden başlar.
- **Başlatılmış denemenin sorusu kilitli.** Soru yayındaki ve en az bir kez başlatılmış
  bir denemenin listesindeyse yayından alınamaz (soru formu, listedeki durum seçici ve
  toplu durum; toplu işlem onları atlar), konusu ve hedef sınavı değişmez. Arşivlemek
  denemeyi kalıcı kapatırdı: eksik listeli deneme başlamıyor, başlatılmış denemenin
  listesi de değişemiyor. Yanlışsa soru düzeltilir. Kural `mock.ts` `KILITLI_DENEME_SORUSU`,
  metin `mock-rules.ts` `KILITLI_DENEME_MESAJI`.
- **Deneme hazırlığı öğrencinin kuralıyla:** `shared/deneme.ts` (`app/lib/deneme.ts`
  kopyası) `denemeHazirMi` — liste tam ve hepsi yayında. Yayın reddi, "yayınlanabilir"
  rozeti, alarm sayımı ve ödev denetimi buna bakar. Sınav dışı soru (hedef sınavı başka)
  engel değil, uyarı: öğrenci uygulaması o denemeyi başlatıyor; panel yalnızca listeye
  YENİ eklenen sınav dışı soruyu kaydetmez. (`pool.ts` paket sağlığı hâlâ sınav dışı
  soruyu "engel" sayıyor; alarm ve deneme tablosu kendi hesabını yapıyor.)
- **React 19 form eylemi bitince formu sıfırlar** ve görünen `<select>`'ler
  varsayılana döner. `QuestionForm.tsx`'te değerler gizli alanlarla gönderiliyor ve
  select'ler efektle durumdan geri yazılıyor — kaldırılırsa doğrulama hatası alan
  yazar seçtiği konuyu sessizce kaybeder. Kazanım formları (`ObjectiveForms.tsx`) bu
  yüzden `<form action>` yerine onSubmit'te eylemi elle çağırıyor: sıfırlama hiç olmuyor.
- **Sabitleri `"use client"` dosyasından sunucu sayfasına aktarma.** Sunucu nesneyi değil
  çağrılamayan bir istemci referansını görür: `"LGS" in X` hep false, `Object.keys(X)` boş
  — hata vermeden. Kazanımlar sayfasının sınav süzgeci ve hazırlık sayacı bu yüzden hiç
  görünmüyordu. Etiketler `lib/checkup/format.ts`'te (saf modül).
- **Havuzu yetmeyen paket yayına alınamaz** — öğrenci kataloğda görüp "Başla"ya
  bastığında hata alması, hiç görmemesinden kötü. Denetim paketin türüne göre
  (`pool.ts`): katalog paketinde konu dağılımı, konu tekrar testinde kontrol testine
  yeten konu, seviyeli pakette seviye hazırlığı. Sayılar `Question.examScopes`'u öğrenci
  uygulamasının seçimi gibi süzer: başka sınava kısıtlı soru o paketin havuzunda sayılmaz.
- **Madde analizi** yalnızca tamamlanmış testleri ve sorunun şu anki sürümünü sayar
  (anahtar değişince sayım sıfırlanır). Ayırt edicilik = madde-kalan korelasyonu; eşikler
  `item-flags.ts`'te, en az 20 cevapta bulgu üretilir.
- **Soru listesinin süzgeci taşınır:** listeden açılan sorunun adresinde `?geri=`
  durur; kaydedince/vazgeçince aynı süzgece ve sayfaya dönülür. Yalnızca bilinen liste
  parametreleri taşınır (`question-list.ts`), başka adrese yönlendirme yapılamaz.
- **Hazırlık sayaçları öğrencinin havuzuyla birebir aynı sayar.** Kazanımlar ve
  Paketler › Seviyeli, uygulamanın kapsam kuralını (`shared/exam-scope.ts`) kullanır;
  paketlerdeki toplu sayım ham SQL ikizinden (`lib/checkup/exam-scope.ts`). Kural
  değişirse ikiz de değişmeli — 2. turda dev veritabanında uygulamanın kendi seçim
  koduyla karşılaştırıldı (ayrıca geri alınan bir işlemde kenar durumlarıyla).
- **Koç notu yalnızca bu haftanın planına yazılır** (öğrenci yalnızca onu görüyor;
  hafta sınırı `shared/coaching.ts` `haftaBasi`). Kaldırılırsa postada genel cümle gider.
  Kim yazdı: StudyPlan'da personel damgası sütunu yok; yalnızca sunucu günlüğüne
  `e-posta (#id)` yazılıyor. Kalıcı iz için app/'te `StudyPlan.coachNoteByStaff` gerekir.
- **Soru ekranındaki önceki/sonraki** listeden gelindiyse (`?geri=`, boş olsa da) çıkar ve
  listenin kendi süzgeç/sırasını kullanır (`question-query.ts`). "Kaydet ve sonrakine
  geç" sıradakini kaydetmeden ÖNCEKİ listeye göre bilir; kaydedilen soru listenin başına
  zıplasa da zincir kopmaz.
- **Paket düzenleyici yalnızca katalog (STANDARD) paketleri** için: tanışma, seviyeli ve
  konu tekrar paketleri sistemindir, tohumdan gelir. Konu başına en az 3 soru (sunucuda
  zorunlu); konu paketin sınavında olmalı; yayında kaydetmek için her konunun havuzu
  (öğrenci uygulamasının kapsam kuralıyla) yetmeli — yetmiyorsa taslak kaydedilir.
  Adres (slug) ve sınav oluştururken seçilir, sonra değişmez. Ücretli/ücretsiz burada
  yazılmaz (açık karar). Ayarlar test başlarken oturuma kopyalandığı için düzenleme
  yalnızca yeni testleri etkiler. Kim değiştirdi: Package'ta damga sütunu yok, sunucu
  günlüğüne yazılıyor.
- **Tohum katalog paketinin içeriğini ezmez.** `app/`'in `npm run db:seed`'i var olan
  katalog paketinin adını, özetini, süresini ve konu dağılımını yazmaz; yalnızca
  `-- --guncelle` ile yazar (paneldeki düzenlemeleri ezer). Sistem paketleri (tanışma,
  konu tekrar) panelden düzenlenmediği için her çalıştırmada tohumdan yazılır.
  Ayrıntı: `app/DEPLOY.md` §3.
- **Görseller veritabanında** (`MediaAsset.data`); SVG kabul edilmiyor (script
  taşıyabilir), yükleme 8 MB / 1200 px / WebP, EXIF ve GPS atılır. Biçim tek yerde:
  `shared/media-image.ts` (`app/lib/media-image.ts`); tek şekil yükleme, toplu içe aktarma
  ve komut satırı (`app/scripts/import-questions.mts`) aynı fonksiyonu kullanır.
- **İçerik uzunluk sınırları** (ipucu 600, kaynak 200, özet kartı 1200, hedef süre,
  kazanım adı) `shared/content-limits.ts`'te: soru formu, kazanım formu ve toplu içe
  aktarma aynı sayıyla reddeder (içe aktarma satır numarasıyla).
- **Toplu içe aktarma** komut satırıyla aynı kuralları kullanır (`shared/question-import.ts`):
  çift kayıt (dosyada ve havuzdaki TÜM sorularda, parmak izi), `validateChoices`, sınav
  kapsamı, kazanım/seviye kodları; panel her sorunun bütün hatalarını ve uyarılarını
  (tanınmayan alan, çözümsüz soru, KaTeX'in çizemediği formül, şık sayısı) gösterir.
  "Denetle" hiçbir şey yazmaz; "Kaydet" dosyaları yeniden gönderir ve baştan denetler
  (istemcideki rapora güvenilmez). Geçerli sorular tek `ImportBatch` partisinde, tek
  işlemde yazılır (`createdByStaff` damgası); görseller tek şekil yüklemeyle aynı biçimde
  (`media-image.ts`) ve `import/<parti>/<dosya>` anahtarıyla saklanır. Doğrudan yayına
  alma, paneldeki durum değiştirmeyle aynı yetkide (yazma rolleri), onay sorarak.
- **Geri al** komut satırının `--geri-al`'ıyla aynı kural (`shared/question-import.ts`
  `GERI_ALMADA_SILINEBILIR`): yalnızca hiçbir öğrenciye sorulmamış (SessionItem'ı olmayan;
  alıştırma da sayılır), hiçbir denemenin listesinde olmayan ve notu (inceleme notu,
  öğrenci bildirimi) olmayan sorular silinir. Yanlış defterindeki soru zaten cevaplanmış
  olduğundan korunur. Sonradan düzenlenmiş soru silinir; onay penceresi kaç sorunun
  düzenlendiğini ve kaçında not olduğunu söyler (`updatedAt` ölçüt değil: yayına alma da
  onu değiştiriyor). Kalanlar partide durur, parti
  "kısmen geri alındı" olur ve ekran neyin neden korunduğunu yazar. Görsel yalnızca artık
  hiçbir soruda geçmiyorsa silinir (korunan soru ya da "benzerini oluştur" kopyası
  kullanıyor olabilir); kazanım yalnızca bu partiyle açılmış ve sorusu kalmamışsa. Parti
  kaydı silinmez: "geri alındı" ya da "kısmen geri alındı" olur, geri alan ve zamanı
  `rolledBackByStaff` / `rolledBackAt`'e yazılır ve geçmişte görünür (komut satırında
  `--personel` damgası). Yalnızca hiç sorusu olmayan (başarısız) partinin kaydı
  "Kaydı sil" ile silinir.
- **İçe aktarmanın gövde sınırı 10 MB** (`next.config.ts` ile `import-report.ts`
  `ISTEK_SINIRI` aynı olmalı). Next aşan isteği bağlantıyı keserek reddediyor, tarayıcı
  sebebi göremiyor; bu yüzden ekran dosya toplamını göndermeden önce denetler
  (multipart için 256 KB pay) ve sunucu aynı sınırı yeniden uygular.
- Tek aralıklı yazı için `components/checkup/ui.tsx`'teki `MONO` (`font-mono`,
  tokens.css'teki `--font-mono`). `tailwind-merge` (v2) bu bölümde kullanılmıyor:
  `text-theme-xs` gibi v4 belirteçlerini renk sanıp siliyor.

## Yerelde deneme

Personel doğrulaması gerçek backend'e gider; backend'i (`:5000`) ve panelde bir
personel hesabıyla girişi kullanın. `.env`'de `CHECKUP_DATABASE_URL` tanımlı olmalı.
