# Koçum.Net — Matematik Check-up

> Öğrencinin matematik seviyesini kısa bir testle ölçen, zayıf konularını çıkaran ve
> buna göre Koçum.Net paketini öneren uygulama.
>
> Referans: `Projects/badi` (veri modeli kararları alındı, **tasarım/UI farklı olacak**).

---

## 1. Ne yapıyoruz

Öğrenci bir **paket** seçer (ör. "TYT Matematik Genel"), 20-30 soruluk kısa bir test çözer,
sonunda **konu bazlı seviye haritası** ve **önerilen çalışma seti** görür.

**Kapsam: sadece matematik.** Türkçe/Fen yok. Bu, ölçümü derinleştirir:
120 soruluk denemede konu başına 1-2 soru düşer (gürültülü); 25 soruluk matematik
check-up'ında konu başına 3-4 soru düşer (anlamlı).

**Check-up ≠ Deneme:**

| | Deneme | **Check-up** |
|---|---|---|
| Amaç | Sınav simülasyonu, net | **Seviye haritası, zayıf konu teşhisi** |
| Süre | 135-180 dk | **20-35 dk** |
| Soru | 80-120 | **20-30** |
| Çıktı | Net, sıralama | **Konu ısı haritası + paket önerisi** |

---

## 2. Paket nedir

Paket = **kapsamı ve soru dağılımı tanımlı bir check-up**. Koddan değil veritabanından okunur,
yeni paket eklemek satır girmektir.

| Paket | Kapsam | Konu | Soru | Süre |
|---|---|---:|---:|---:|
| TYT Matematik Çekirdek | En çok soru getiren 8 TYT konusu | 8 | 24 | 30 dk |
| TYT "İlk 15" | Sınavın ilk sorularını getiren çekirdek | 5 | 15 | 18 dk |
| Problemler | En çok zaman kaybettiren problem tipleri | 5 | 20 | 25 dk |
| AYT Cebir Kuşağı | Trigo ve LTİ öncesi cebir | 5 | 20 | 28 dk |
| Trigonometri | Birim çember → denklemler | 4 | 16 | 20 dk |
| Analitik Geometri | Nokta, doğru, çember | 3 | 15 | 20 dk |

Her paket, hangi konudan kaç soru geleceğini `PackageTopic` ile tanımlar.
**Bu paketler ürün kataloğuyla eşleşiyor** → check-up sonunda "Trigonometride zayıfsın →
*Trigonometri 5'te 5 AYT Soru Seti*" önerisi doğal olarak çıkar.

### ⚠️ Paket tasarımının tek kuralı: konu başına EN AZ 3 soru

İlk taslakta "TYT Genel"i 25 soruyu 23 konuya dağıtacak şekilde yazmıştım — yani
§1'de denemeyi eleştirdiğim şeyin aynısı. Sonuç ekranında ortaya çıktı: 7 konuda
"yeterli soru yok" yazdı, çünkü puanlama tek soruya seviye etiketi vermiyor.

**Kapsamı genişletmek ölçümü geliştirmez, yok eder.** Kapsam isteniyorsa konu
sayısı değil paket sayısı artırılır. Kural `prisma/seed.ts` içinde `MIN_PER_TOPIC`
ile zorunlu: ihlal eden paket seed sırasında hata verir.

---

## 3. Sorular nasıl depolanacak ⭐

### Karar: soru gövdesi **JSONB blok dizisi**

| Seçenek | Neden olmadı |
|---|---|
| HTML metni | Doğrulanamaz, XSS riski, PDF/mobile taşınmaz, arama zor |
| Markdown + LaTeX | Tablo/çoklu sütun zayıf, editörle eşleşmiyor |
| **JSONB blok dizisi** | ✅ Yapılandırılmış, doğrulanabilir, her hedefe render edilir |

**Matematikte bu tercih pazarlıksız:** soru gövdesinde kesir, üs, kök, integral olacak.
Formüller **LaTeX kaynak kodu** olarak saklanır, görsel olarak değil — KaTeX ile istemcide
render edilir; yazı boyutuna uyar, ekran okuyucu okur, kopyalanabilir. Görsel olarak saklansa
mobilde bulanık olur, karanlık temada ters döner, aranamaz.

**İstisna:** geometri şekilleri ve grafikler → `image` bloğu (LaTeX ile çizilmez).

```json
{
  "version": 1,
  "blocks": [
    { "type": "paragraph", "content": [
        { "type": "text", "text": "Bir otomobil " },
        { "type": "math", "latex": "60" },
        { "type": "text", "text": " km/sa hızla " },
        { "type": "math", "latex": "3" },
        { "type": "text", "text": " saat yol alıyor." } ] },
    { "type": "math_block", "latex": "x = v \\cdot t" },
    { "type": "image", "mediaId": "9f2a...", "alt": "Hız-zaman grafiği" }
  ]
}
```

Blok tipleri: `paragraph` · `math_block` · `image` · `table` · `list` (I, II, III öncülleri için) · `spacer`
Satır içi: `text` (bold/italic/sub/sup) · `math` (LaTeX) · `inline_image`

### `stemText` — düz metin izdüşümü

Kayıt anında `stem` içindeki tüm `text` düğümleri birleştirilip `stemText` alanına yazılır.
Ne işe yarar: **tam metin arama**, **çift kayıt tespiti** (aynı soru iki kez girilirse istatistik
bölünür ve öğrenci aynı soruyu iki kez görür), admin listelerinde önizleme.

### Şıklar neden ayrı tablo

`choices` JSONB içinde değil, ayrı tablo:

1. **Şık bazında istatistik** — `chosenCount` her cevapta atomik artar; JSONB'de kilitleme sorunlu.
2. **Cevap anahtarı şüphesi** — "bir çeldirici doğru şıktan çok seçiliyorsa" sorgusu ilişkisel olarak tek satır.
3. **Hata tipi teşhisi** — her çeldiriciye `errorType` (ör. `TERS_ISLEM`, `ISLEM_KARISTIRMA`)
   bağlanır; öğrenci C'yi seçtiğinde sistem *neden* yanlış yaptığını ek soru sormadan bilir.
4. Şık sayısı değişken (4 veya 5).

### ⚠️ Aynı değerli şık

Çeldirici formülleri bazı değerlerde doğru cevapla **aynı sonucu** verir. Gerçek örnek:
"3357'nin 9'a bölümünden kalan?" → kalan 0, ama `kalan − 1` çeldiricisi de 0 çıktı ve
C ile D şıkları ikisi de "0" oldu. Doğru değeri işaretleyen öğrenci yanlış sayılıyordu,
üstelik ekranda hiçbir şey ters görünmüyordu.

`validateChoices()` (lib/question-content.ts) her soruyu kaydetmeden önce denetler:
4-5 şık, tam bir doğru şık, A-E etiketleri ve **şık değerlerinin ayrık olması**.
Admin paneli ve toplu içe aktarma bu fonksiyondan geçmek zorunda.

### Soru girişi: yazım biçimi

Kimse soru girerken JSON yazmaz. Admin düz metin yazar, formülleri `$…$` içine alır:

```
Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km?
$$x = v \cdot t$$
- $x$ tek sayıdır
- $y$ çift sayıdır
```

`lib/question-markup.ts` bunu bloklara çevirir; düzenlemede bloklar tekrar metne döner.
**Gidiş-dönüş sabit nokta olmalı** — bozulursa mevcut bir soruyu düzenlemek sessizce
içerik siler. `npm run test:markup` bunu denetliyor.

Görsel `![alt metni](mediaId)` ile yazılır — tek başına bir satırdaysa ortalanmış
şekil, cümle içindeyse satır içi simge olur. Admin yükleyiciyi kullanır, kimliği
kendisi yazmaz. **Alt metni yükleme anında zorunlu:** sonradan doldurulması
beklenirse hiç doldurulmuyor ve şekli göremeyen öğrenci soruyu çözemiyor.

Tablo ve ALT YAZILI görsel bu biçimde temsil edilemiyor; o blokları içeren sorularda
düzenleme formu kapalı (kaydetmek onları sessizce silerdi).

### ⚠️ Cevap anahtarı sızıntısı

`isCorrect` veritabanında var ama **öğrenciye giden JSON'da asla olmaz.**
Test sırasında sunucu yalnızca şıkların içeriğini gönderir; doğruluk kontrolü sunucuda yapılır.

Bunu koruyan bir test yazılacak — çünkü biri bir gün "kolaylık olsun" diye ekler ve fark edilmez:

```ts
it('öğrenciye giden soru cevap anahtarı sızdırmamalı', async () => {
  const raw = JSON.stringify(await getSessionQuestion(sessionId));
  for (const leak of ['isCorrect', 'is_correct', 'errorType', 'answerKey']) {
    expect(raw).not.toContain(leak);
  }
});
```

---

## 4. Veri modeli (taslak)

```
Topic (konu ağacı)            Package (check-up paketi)
  │ parentId                    │
  │ examScope TYT|AYT           └─ PackageTopic (konu → kaç soru)
  └─ Question
       ├─ Choice[]  (A-E, isCorrect, errorType, chosenCount)
       └─ SolutionStep[]  (opsiyonel, adım adım çözüm)

CheckupSession (bir öğrencinin bir denemesi)
  ├─ SessionItem[]  (seçilen sorular + sıra + questionVersion)
  │     └─ Answer   (seçilen şık, doğru mu, süre)
  └─ CheckupResult  (net, konu kırılımı, önerilen paketler)
```

**Alan notları:**

- `Question.version` + `SessionItem.questionVersion` — yayındaki bir sorunun cevap anahtarı
  düzeltilirse, o soruyu çözmüş öğrencilerin sonucu yeniden hesaplanabilsin diye. Bu alan
  olmadan düzeltme yapıldığında geçmiş veri sessizce bozulur.
- `Question.difficulty` (1-5) — soru seçiminde zorluk dağılımı için.
- `Question.targetTimeSeconds` — "bu soruda çok oyalandın" geri bildirimi için.
- `Answer.timeSpentMs` — konu bazlı hız analizi.
- `Package.penaltyRatio` — **koda gömülmez.** YKS'de 4 yanlış 1 doğru götürür (0.25),
  LGS'de 3 yanlış (0.3333), KPSS'de yanlış götürmez (0). Bu, ürünün öğrenciye
  "emin değilsen işaretle" deyip demeyeceğini değiştirir.

---

## 5. Soru seçimi — MVP'de adaptif DEĞİL

Tam adaptif test (CAT) cazip ama **IRT parametreleri yeterli veriyle kalibre olmadan
güvenilmez** — az veriyle aşırı uyum yapar, öğrenciyi yanlış seviyede sabitler.

**MVP: katmanlı sabit uzunluk.**

```
seç(paket):
  her konu için paketteki soru adedi kadar:
    zorluk dağılımı  kolay %30 · orta %50 · zor %20
    aynı öğrencinin son 30 günde gördüğü sorular hariç
    rastgele, yayındakiler (status = PUBLISHED) arasından
```

Açıklanabilir ve sağlam: "Neden bu soru geldi?" sorusunun cevabı var.
Yeterli veri birikince (soru başına ≥300 cevap) adaptif seçime geçilebilir.

---

## 6. Sonuç ekranı — RAPOR DEĞİL, KOÇ ÇIKTISI

İlk sürüm bir rapordu: halka, net, konu haritası, ürün listesi. Doğruydu ama
**öğrenciyi hareket ettirmiyordu.** Rapor "durum bu" der; koç "şunu yap" der.

Ekranın sırası bilinçli — telefonda ilk ekranda görünenler ilk üçü:

1. **Karar cümlesi.** Banda göre değişir, HER ZAMAN bir sayı içerir, TEK bir
   eylem söyler. ("%38 — bu bir yetenek meselesi değil, sıralama meselesi.")
2. **Boş bırakma uyarısı** (varsa). Sınava göre: TYT'de "4 yanlış 1 doğru
   götürüyor, iki şık eleyebiliyorsan işaretle"; KPSS'de "yanlış götürmüyor,
   boş bırakmanın matematiksel faydası yok".
3. **Bu hafta sadece bunlar.** En fazla iki konu, sıralı, her birinde
   "sınavda ~3 soru" karşılığı ve tek dokunuşla 5 soruluk kontrol testi.
4. Yanlışların ortak yanı (hata deseni → reçete).
5. Geçen denemeye göre fark.
6. Konu haritası (telefonda ilk üç konu, gerisi katlanmış).
7. Sonraki ölçüm ne zaman.
8. **Kaynak — en sonda.** "Bu konuları çalışmak için elindeki kaynak
   yetmiyorsa." Ürün, teşhisin sonucu; teşhisin amacı değil.
9. Cevap incelemesi (varsayılan: yalnızca yanlış ve boşlar).

**Net gösterimi sınava göre:** `penaltyRatio == 0` olan sınavlarda (KPSS, DGS,
ALES) net = doğru sayısıdır; ayrı bir "net" kutusu göstermek ekranda aynı sayıyı
iki kez yazmak olur. O sınavlarda "12/20 doğru" yazıyoruz.

Zayıf konu → ürün eşlemesi `topic.recommendedProductIds` ile veritabanından gelir.

---

## 7. Teknik mimari — KARAR VERİLDİ

**Next.js 16 full-stack + Prisma 7 + PostgreSQL.** Aynı sunucuda ayrı veritabanı:
`kocumnet_checkup` (frontend'in `kocumnet` DB'sine dokunmaz).

⚠️ **Prisma 7 eğitim datasından farklı, varsayma:** config dosyası `prisma7.config.ts`
(bağlantı URL'i şemada değil orada), `datasource` bloğunda `url` yok, generator
`prisma-client`, **driver adapter zorunlu** (`@prisma/adapter-pg`), üretilen client
derlenmiş JS değil TypeScript kaynağı ve uzantısız import kullanıyor (bundler veya
`tsx` gerekir). `npm i prisma@latest` RC kurar — üçü de `7.10.0`'a sabitlendi.

---

## 8. Faz planı

| # | İş | Faz | Durum |
|---|---|---|---|
| 1 | Şema + migration (14 model) | **1** | ✅ |
| 2 | Puanlama, konu teşhisi, soru seçimi | **1** | ✅ |
| 3 | Öğrenci hesabı (kayıt/giriş/oturum) | **1** | ✅ |
| 4 | Check-up akışı: paket seç → çöz → sonuç | **1** | ✅ |
| 5 | Konu haritası + ürün önerisi | **1** | ✅ |
| 6 | Geçmiş testler + gelişim karşılaştırması | **1** | ✅ |
| 7 | Admin: havuz panosu, soru girişi/düzenleme (canlı önizleme) — `admin.kocum.net`'e taşındı | **1** | ✅ |
| 8 | Toplu içe aktarma (JSON/Excel) + hata raporu | **1** | ⬜ sırada |
| 9 | Görsel yükleme (geometri şekilleri, `MediaAsset`) | **1** | ✅ |
| 10 | Cevap incelemesi + adım adım çözüm gösterimi | **1** | ✅ |
| 11 | Hata tipi teşhisi (çeldirici analizi) | **1** | ✅ |
| 12 | İlerleme: aynı paketin önceki denemesiyle karşılaştırma | **1** | ✅ |
| 13 | Erişim hakkı (entitlement) + yönetim ekranı | **1** | ✅ |
| 13b | Yönetimin `admin.kocum.net`'e taşınması: personel doğrulaması, roller, öğrenci detayı, paket ayarları | **1** | ✅ |
| 14 | Parola sıfırlama (e-posta) | **1** | ✅ |
| 15 | KVKK aydınlatma metni + kayıt onayı | **1** | ✅ taslak |
| 16 | Deploy yapılandırması (nixpacks, .env.example, DEPLOY.md) | **1** | ✅ |
| 17 | **Toplu içe aktarma** — soru kaynağı biçimi bekleniyor | **1** | ⏸ engelli |
| 18 | Ödeme sağlayıcı entegrasyonu (iyzico/PayTR) | 2 | ⬜ hesap bekliyor |
| 19 | Mesafeli satış sözleşmesi + cayma hakkı metinleri | 2 | ⬜ hukukçu |
| 20 | Adaptif soru seçimi (soru başına ≥300 cevap sonrası) | 3 | ⬜ |

**Doğrulama:** `npm run smoke` (saf mantık: puanlama, teşhis, parola, içerik şeması) ·
`npm run test:markup` (yazım biçimi + gidiş-dönüş) · `npm run test:leak` (uçtan uca akış,
cevap anahtarı sızıntısı, inceleme kapısı, erişim hakkı). Üçü de her değişiklikten sonra.

⚠️ **Prisma 7'de `migrate dev` client'ı yeniden ÜRETMEZ** ve çalışan dev sunucusu eskisini
bellekte tutar. Bu yüzden `dev` ve `db:migrate` script'lerinin başına `prisma generate`
eklendi; şema değişikliğinden sonra dev sunucusunu yeniden başlatın.

---

## 9. Açık sorular

**Cevaplananlar:**

1. ~~Öğrenci girişi olacak mı?~~ → **Kayıtlı öğrenci** (e-posta + parola, geçmiş takibi).
2. ~~Sorular nasıl girilecek?~~ → **İkisi de**: admin panelden tek tek + toplu içe aktarma.
3. ~~Teknik mimari?~~ → **Next.js full-stack + Prisma** (§7).

**Bekleyenler:**

4. **Paket listesi kesinleşti mi?** Şu anki 6 paket bir öneri; Serhat Hoca'nın kapsam
   görüşü alınmalı. Konu başına ≥3 soru kuralı korunmalı (§2).
5. ~~Ücretli mi?~~ → **Ücretli** (2026-09-20). Alt karar bekliyor: tek seferlik mi abonelik mi.
   Bu netleşmeden fatura modeli yazılmayacak. **Hak (entitlement) katmanı hazır** (#13):
   paket ücretliye çevrilince yalnızca hakkı olan başlatabiliyor; hak şimdilik panelden
   elle veriliyor. Ödeme sağlayıcı (iyzico/PayTR) hesap açıldıktan sonra entegre edilir.
   ⚠️ Ücretli ürün + 18 yaş altı kullanıcı: mesafeli satış sözleşmesi ve cayma hakkı
   metinleri zorunlu.
   Değerlendirilecek orta yol: ilk check-up ücretsiz (huni), sonrakiler ücretli.
6. **Gerçek soru havuzu nereden gelecek?** Şu an ~2200 demo sorusu var (şablondan
   üretilmiş, GERÇEK SORU DEĞİL). Serhat Hoca'ya sorulacak: mevcut fasiküllerin
   **dizgi kaynağı (Word/InDesign) duruyor mu, yoksa sadece baskı PDF'i mi kaldı?**
   Cevap içe aktarmanın biçimini belirliyor; "sadece PDF" ise içe aktarma yazılmaz,
   giriş formu hızlı girişe göre optimize edilir.
   **Pilot hedefi:** TYT Çekirdek'in 8 konusunda 10'ar gerçek soru = 80 soru.
   (Paket konu başına 3 istiyor, tekrar engeli ikinci denemede farklı soru istiyor,
   zorluk dağılımı her bantta soru arıyor.)
7. **Nerede yayınlanacak?** Ayrı alan adı (`checkup.kocum.net`) mı, `kocum.net/checkup`
   altında mı? Ayrı deploy olduğu için ilki daha basit.
8. **E-posta** doğrulama ve parola sıfırlama gerekli mi? (Şu an yok; SMTP kararı lazım.)

---

## 9.5 Görsel deposu

Görsellerin baytları **veritabanında** (`MediaAsset.data`), dosya sisteminde değil:

1. Konteyner geçici — yeniden dağıtımda disk siliniyor. Volume bağlamayı unutmak
   tüm şekilleri sessizce yok eder: soru durur, şekli gider.
2. Yedekten dönüş atomik olur. Diskte olsalardı, veritabanı yedeği geri
   yüklendiğinde referanslar boşa düşebilirdi.

Ölçek sorun değil (~1000 görsel × ~40 KB ≈ 40 MB). 500 MB aşılırsa nesne depolamaya
taşınır; `storageKey` alanı bu soyutlamayı zaten sağlıyor.

Yükleme: EXIF yönü düzeltilir, 1200 piksele küçültülür, WebP'ye çevrilir.
**SVG kabul edilmiyor** — XML belgesi olduğu için script taşıyabilir ve aynı
kökenden servis edilen bir SVG'yi açmak script çalıştırır.

⚠️ Next varsayılanı server action gövdesini **1 MB** ile sınırlıyor; telefonla
çekilmiş bir şekil fotoğrafı bunu rahat aşar ve yükleme sessizce reddedilir.
Yükleme yönetim panelinde olduğu için sınır **`admin/next.config.ts`**'te 10 MB'a
çekildi; öğrenci uygulaması dosya almadığından varsayılanda bırakıldı.

---

## 10. Çalıştırma

```bash
cd app
npm install
npm run db:migrate        # şema
npm run db:seed           # konu ağacı + paketler (idempotent)
npm run db:seed:demo      # ~2200 demo sorusu — SADECE geliştirme
npm run dev -- --port 3100
```

`.env`: `DATABASE_URL` (tam liste `.env.example`'da). Bu uygulamada yönetici hesabı yok;
yönetim `admin.kocum.net`'te (kök dizindeki `admin/`).

---

## 11. Koçluk katmanı (2026-09-23)

Check-up "ne biliyorsun"u ölçüyordu. Eksik olan "peki şimdi ne yapayım"dı.
Bu bölüm o boşluğu dolduran kararları kaydediyor.

### 11.1 Çok sınav, PAYLAŞILAN konular

Uygulama artık LGS · TYT · AYT · KPSS (lisans/önlisans) · DGS · ALES kapsıyor.

İki seçenek vardı: (a) her sınav için ayrı konu ağacı, (b) tek ağaç + konuda
`examScopes[]` etiketi. **(b) seçildi.**

- Soru havuzu bölünmüyor: "Problemler" için yazılmış 200 soru altı sınavın
  hepsinde kullanılabiliyor. (a) seçilseydi her sınav için ayrı havuz gerekirdi
  ve hiçbiri yeterli olmazdı.
- Öğrencinin konu geçmişi sürekli kalıyor: TYT'de ölçülen "Köklü Sayılar",
  öğrenci DGS'ye geçse bile aynı konu.
- Sınav bazlı ağırlık `Topic.examWeights` ile ayrı tutuluyor: aynı konu TYT'de
  5, DGS'de 2 soru getiriyorsa sıralama buna göre değişiyor.

Kök konunun adı "TYT Matematik" değil **"Temel Matematik"**: konu ağacının adı
tek bir sınava ait olamaz.

### 11.2 Tanışma (`/tanisma`)

Panele girmeden önce üç soru: hangi sınav, hangi aşama, kaç net hedef.
Bu bilgiler kayıt formunda zaten toplanıyordu ama **hiçbir yerde
kullanılmıyordu** — DGS'ye hazırlanan birine AYT trigonometri paketi
öneriliyordu. Artık katalog, puanlama, plan ve koçluk metinleri buna bakıyor.

Sınıf seçenekleri sınava göre kısıtlı (`EXAMS[x].grades`): 26 yaşındaki DGS
adayına "11. sınıf" yazdırmak ürünün onu tanımadığını gösterir.

### 11.3 Haftalık plan (`StudyPlan` / `PlanItem`)

Test bitince plan **kendiliğinden** oluşuyor. En fazla iki konu, her konuda
dört iş: konu tekrarı (60 dk) → 40 soru (70 dk) → yanlış analizi (25 dk) →
**kontrol testi (5 soru)**.

Kritik karar: **RETEST işi öğrenci tarafından işaretlenemez.** Sistem, ancak o
konuda gerçekten 5 soruluk test çözülünce kapatır (`verifiedBySessionId`).
"40 soru çözdüm" demek kolaydır; kontrol testini geçmek değildir. Doğrulama
adımı olmayan plan yapılacaklar listesidir ve yapılacaklar listeleri terk edilir.

Diğer işler silinebilir: koç da "bu hafta vaktim yok" itirazını dinler.
Dayatılan plan duvar kâğıdı olur.

### 11.4 Konu tekrar testi — erişim kuralı

`startTopicRetest` bir paket satın alımına bakmaz. Denetimsiz bırakılsaydı
herhangi bir öğrenci istediği konu kimliğiyle çağırıp ücretli havuzdan beşer
beşer soru çekebilirdi. İki kapı kondu:

1. Konu **daha önce ölçülmüş** olmalı (o konudan soru içeren bitmiş bir oturum).
   Bu aynı zamanda ürün olarak doğru: "kontrol", ölçülmüş bir şeyi yeniden
   ölçmektir.
2. 24 saatte en fazla `GUNLUK_TEKRAR_SINIRI` (8) tekrar. Günde on kontrol testi
   çözmek çalışmak değil, çalışmaktan kaçmanın rahat yoludur.

`npm run test:leak` ikisini de denetliyor.

### 11.5 Hedef takibi

`/gelisim` artık "tahmini net" gösteriyor: son üç ölçümün net oranı, sınavın
matematik soru sayısına taşınıyor (TYT için 40). Bu bir TAHMİN ve ekranda da
öyle yazıyor — sınav koşulları, süre baskısı ve diğer dersler burada yok.
Yine de öğrencinin kafasındaki soru "yüzde kaç" değil "kaç net" olduğu için
ölçümü onun diline çeviriyor.

Kaldırılan gösterge panelleri: "en iyi test", "toplam süre". İkisi de gurur
okşuyor, hiçbir eyleme yol açmıyor.

### 11.6 Sınav sabitleri — DOĞRULANACAK

`lib/exams.ts` soru sayılarını ve yanlış götürme oranlarını tutuyor.
KPSS/DGS/ALES için `penaltyRatio` şu an **0.25** yazılı ve kodda ⚠️ işaretli:
yayına çıkmadan Serhat Hoca ile doğrulanmalı. Oran oturum başlarken paketten
kopyalandığı için sonradan düzeltmek **eski sonuçları düzeltmiyor**.
