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
  LGS'de 3 yanlış (0.3333). KPSS, DGS ve ALES için kodda 0.25 bir VARSAYIM
  (Özgür Hoca'ya soruldu, HOCAYA-SORULAR §1, soru 1.1). Bu, ürünün öğrenciye
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
2. **Boş bırakma uyarısı** (varsa, yalnızca paket testinde). Gerçek sınavın
   kuralına göre: TYT'de "4 yanlış 1 doğru götürüyor, iki şık eleyebiliyorsan
   işaretle"; cezasız bir sınavda "yanlış götürmüyor, boş bırakmanın
   matematiksel faydası yok". KPSS, DGS ve ALES şu an 0.25 varsayımıyla cezalı.
3. **Bu hafta sadece bunlar.** En fazla iki konu, sıralı, her birinde
   "sınavda ~3 soru" karşılığı ve tek dokunuşla 5 soruluk kontrol testi.
   Yalnızca bu haftanın planı BU testten çıktıysa (liste planın konuları);
   değilse başlık "Bu testten çıkan öncelikler" ve "bakma" cümlesi yok.
4. Yanlışların ortak yanı (hata deseni → reçete).
5. Geçen denemeye göre fark.
6. Konu haritası (telefonda ilk üç konu, gerisi katlanmış).
7. Sonraki ölçüm ne zaman.
8. **Kaynak — en sonda.** "Bu konuları çalışmak için elindeki kaynak
   yetmiyorsa." Ürün, teşhisin sonucu; teşhisin amacı değil.
9. Cevap incelemesi (varsayılan: yalnızca yanlış ve boşlar).

**Net gösterimi oturuma göre:** oturumun `penaltyRatio`'su 0 ise (seviyeli
aşamalar; KPSS, DGS ve ALES cezasız çıkarsa onlar da) net = doğru sayısıdır;
ayrı bir "net" kutusu göstermek ekranda aynı sayıyı iki kez yazmak olur. O
oturumlarda "12/20 doğru" yazıyoruz.

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
| 21 | Alıştırma: "Benzerini çöz", "Bu konuda çalış" (§12) | 2 | ✅ |
| 22 | Yanlış defteri + aralıklı tekrar, "Bugünkü tekrar" (§12) | 2 | ✅ (aralıklar hoca onayı bekliyor) |
| 23 | Veli bağlantısı: girişsiz, süreli, salt okunur genel tablo (§13) | 2 | ✅ (kapsam hoca kararı bekliyor, metin hukukçu) |

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

**Soru işi uygulamada yapılır (2026-10-24).** "40 soru" işi eskiden yalnızca
"Yaptım" ile kapanıyordu; öğrenci soruları nerede çözeceğini bilmiyordu. Artık
"Bugün" kartı planın kurulduğu testin konusundan 5 soruluk alıştırma açıyor ve
"bu hafta bu konuda 12/40 soru" sayıyor: bu Türkiye haftasında o konudan
alıştırmada cevaplanan soru, "Bilmiyorum" hariç, sınav soruları hariç.
Hedefe varınca iş kendiliğinden kapanır (doneAt'ı sistem yazar,
lib/plan-ilerleme.ts); kitaptan çözen için "Yaptım" duruyor. Uygulamada sayma
kuralı hocaya soruldu (`SORU_ISI_UYGULAMADA`, varsayılan açık). Konu tekrarı
işinde önerilen yayın ve (defterde varsa) kazanım özetleri bağlantısı var.

### 11.4 Konu tekrar testi — erişim kuralı

`startTopicRetest` bir paket satın alımına bakmaz. Denetimsiz bırakılsaydı
herhangi bir öğrenci istediği konu kimliğiyle çağırıp ücretli havuzdan beşer
beşer soru çekebilirdi. İki kapı kondu:

1. Konu **daha önce ölçülmüş** olmalı (o konudan soru içeren bitmiş bir oturum).
   Bu aynı zamanda ürün olarak doğru: "kontrol", ölçülmüş bir şeyi yeniden
   ölçmektir.
2. Günde (Türkiye takvim günü) en fazla `GUNLUK_TEKRAR_SINIRI` (8) tekrar. Günde on kontrol testi
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
Özgür Hoca'ya soruldu (HOCAYA-SORULAR §1). Oran oturum başlarken paketten
kopyalandığı için sonradan düzeltmek **eski sonuçları düzeltmiyor**.

---

## 12. Öğrenme döngüsü: alıştırma ve yanlış defteri (2026-10-10)

Check-up ölçüyor ve sıralıyordu; öğrenci yanlışını gördükten sonra yapacak bir
şey bulamıyordu. Döngü artık kapanıyor: **yanlışı gör → hemen benzerini çöz →
günler sonra benzeriyle yeniden dene.** Kurallar README'de ("Alıştırma ve
yanlış defteri"), sabitler tek dosyada: `lib/review.ts`.

### 12.1 Alıştırma ölçüm değil

Yeni oturum türü `PRACTICE` (`practiceMode`: `SIMILAR` benzer soru, `TOPIC`
konu çalışması, `REVIEW` bugünkü tekrar). Süre yok, her cevaptan sonra doğrusu,
yanlış şıkkın hata tipi + reçetesi ve çözüm. Cevap kilitli.

Kontrol testindeki "ölçüm değil, doğrulama" kararının bir adım ötesi: alıştırma
**hiçbir ölçüme girmez** — sonuç satırı yok; eğilim, tahmini net, plan, haftalık
posta, panelin risk listesi ve madde analizi onu süzer; soru/şık sayaçları
(kalibrasyon) yalnızca sınav bitişinde artar. Çözümü gösterilen bir sorunun
cevabı ölçüm sayılsaydı soru olduğundan kolay, öğrenci olduğundan iyi görünürdü.

Alıştırma sorusu tekrar engeline yazılır (30 gün sınava gelmez): öğrenci
çözümünü gördü, sınavda hatırlar.

### 12.2 Neden benzer soru, aynısı değil

Öğrenci yanlış yaptığı sorunun çözümünü sonuç ekranında gördü. Aynı soruyu
yeniden sormak hafızayı ölçer, öğrenmeyi değil. Benzer = aynı kazanım (yoksa
aynı konu), aynı seviye, zorluk ±1, sınav kapsamı aynı kural. Havuzda benzer
yoksa bunu söylüyoruz; düğme hiç çıkmıyor.

### 12.3 Yanlış defteri

Yalnızca ölçümler (paket, kontrol testi, seviyeli aşama) madde yazar.
Aralıklar 1 → 3 → 7 gün; üçü de doğruysa madde defterden çıkar, yanlış başa
döndürür. Defter idempotent (aynı test iki kez puanlanırsa değişmez; geç
puanlanan eski test sonraki tekrarı silmez). Bugünkü tekrar günde en fazla 10
soru; vadeler Türkiye saatiyle gün başına yuvarlı.

### 12.4 Hocaya sorulacaklar (sabitler `lib/review.ts`'te)

1. Aralıklar 1/3/7 gün ve "3 tekrar doğruysa çıkar" kuralı uygun mu?
2. Günlük tekrar sınırı 10 soru, alıştırma sınırı günde 30 soru uygun mu? (Sınırlar Türkiye takvim gününe göre.)
3. Kazanımında başka soru olmayan yanlış için aynı konudan (kazanımsız) benzer
   getirelim mi, yoksa "benzeri yok" demeye devam mı?
4. Benzeri havuzda olmayan madde için aynı sorunun kendisi (çözümü görülmüş
   olsa da) tekrar sorulsun mu?
5. Hata tipi reçeteleri (lib/coaching.ts) desen için yazıldı ("dört işlemde
   kaybediyorsun"); tek bir yanlışın altında da bu metin mi kalsın, ayrı kısa
   metin mi yazalım?
6. Haftalık plandaki "yanlışlarını deftere geçir" işi: yanlışlar artık deftere
   kendiliğinden giriyor. Bu iş başka bir işe mi dönüşsün (ör. "defterdeki
   çözümleri oku"), yoksa kontrol testi gibi bugünkü tekrar bitince sistem mi
   kapatsın?

---

## 13. Veli bağlantısı (2026-10-10)

Veli bugün yalnızca öğrencinin bastığı PDF'i görebiliyordu. Öğrenci artık profilden
girişsiz, salt okunur, süreli bir adres verebiliyor (`/veli/<jeton>`, WhatsApp ya da
kopyala). Kurallar README'de ("Veli bağlantısı").

### 13.1 Neden yalnızca genel tablo

Hocaya sorduk (Hocaya sorular: motivasyon.veli-kapsam): veli genel tabloyu mu, soru soru ayrıntıyı mı
görsün? Cevap gelene kadar dar olanı seçtik: ilk ad, hedef sınav, son ölçüm ve eğilim,
güçlü/zayıf konular, son 5 check-up, bu haftanın plan tamamlaması, açık defter sayısı.
Kullanıcıların çoğu 18 yaş altı ve bağlantıyı bilen herkes sayfayı görür; soru, cevap
ve iletişim bilgisi bu yüzden yok. Genişletmek kolay (VeliRaporu tipine alan eklenir,
`test:veli` alan listesini güncellemeyi ister), daraltmak ise dağılmış bağlantılar
yüzünden geç kalır.

### 13.2 Neden jeton saklanmıyor

Oturum ve parola sıfırlamayla aynı: yalnızca SHA-256'sı. Veritabanı sızarsa kimse rapor
açamaz. Bedeli: bağlantı yalnızca oluşturulduğu an görünür; kaybolursa kaldırılıp yenisi
açılır (en fazla 3 etkin, 7/30/90 gün).

### 13.3 Açık konular

- Hukukçu: `/gizlilik`'teki "Veli bağlantısı" paragrafı TASLAK. 18 yaş altı için velinin
  açık rızası sorusu (lib/legal.ts başındaki not) bu özellikten bağımsız değil.
- Hoca: 10.10'un cevabına göre rapora soru soru ayrıntı eklenecek mi.

---

## 14. Pilot turu: ölçüm doğruluğu, hesap, gruba katılım (2026-10-24)

5 haftalık sınıf pilotu öncesi. Şema: migration `20261024150000_pilot_olcum`.

### 14.1 Yarım test ölçüm değil

Telefonda kesinti olağan: 24 sorunun 2'sini çözüp bırakan öğrencinin testi süre dolunca
puanlanıyordu; boşlar "sorulmuş" sayıldığı için bütün konular zayıf çıkıyor, grafik %8'e
düşüyor, haftanın planı bu testten kuruluyor, deftere 22 hiç bakılmamış soru giriyordu.

- Her kapanış `CheckupSession.endedBy`'a yazılır: öğrencinin "Bitir"i `STUDENT`, süre
  bitince ekranın kendiliğinden bitirmesi ve bakım işi `TIMEOUT`, aynı testi yeniden
  başlatınca eskinin kapanması `RESTART`. Ekran "Bitir"i mi süreyi mi söyler
  (`submitCheckupAction`'ın üçüncü parametresi); söylemezse saat karar verir
  (`bitirmeSebebi`). Boş = eski kayıt, öğrenci bitirmiş sayılır.
- **Kural** (`lib/insights.ts yarimKaldi`): öğrenci bitirmedi VE işaretli pay
  `YARIM_TEST_ESIGI`'nin (0,5) altında. Öğrencinin kendi bitirdiği test ne kadar boş olursa
  olsun ölçümdür (bilerek boş bırakmak da cevap). `olcumDisi = isaretsiz || yarimKaldi`.
- Yarım test: eğilime, tahmini nete, konu haritasına, deneme havuzuna ve yüzdeliğe girmez;
  plan kurmaz, kontrol testi işini kapatmaz; deftere yalnızca işaretleyip yanlış yaptığı
  sorular girer (boşlar "bilmiyorum" değil "bakmadım"). Seviyeli aşamanın kapısı yine
  değerlendirilir. Sonuç ekranı karar ve öncelik yerine "Bu test yarım kaldı … ölçüm
  sayılmadı" kutusu ve "Yeniden çöz" gösterir; gelişim listesinde "yarım" rozeti.
- ⚠️ Bu kurala giden her sorgu `blankCount` (sonuç) ve `endedBy` (oturum) seçmeli; seçmezse
  kural sessizce işlemez.

### 14.2 Kayan oturum

Sabit 30 günlük oturum, her gün çalışan öğrenciyi pilotun 5. haftasında girişe düşürürdü.
Kalan süre 15 günün altına inince `getCurrentUser` veritabanındaki bitişi 30 güne uzatır
(koşullu `updateMany`, çoğu istekte sorgu yok). Çerezi `proxy.ts` yeniler: Server Component
çerez yazamıyor; proxy her GET sayfa isteğinde aynı jetonu 30 günlük süreyle yeniden yazar
(veritabanına bakmaz, geçerliliği veritabanı söyler). POST'ta yazmaz: giriş ve çıkış çerezi
kendileri yazıyor, aynı yanıtta iki Set-Cookie sıraya kalırdı. Sonuç: en az 15 gün hiç
girmeyen öğrencinin oturumu kapanır. Parola sıfırlamada bütün oturumların silinmesi değişmedi
(silinmiş satır uzatılamaz).

Son etkinlik `User.lastSeenAt`: kayıtta ve girişte, sonra oturumla gelen isteklerde en fazla
saatte bir. `lastLoginAt` kayıtta da yazılır.

### 14.3 Girişten sonra istenen sayfaya dönüş

`proxy.ts` her sayfa isteğine istenen yolu başlıkla ekler; giriş isteyen sayfa
`/giris?sonra=/yol`'a gönderir (`girisAdresi`), giriş ve kayıt o yola döner. Yalnızca bu
sitedeki göreli yol kabul edilir (`lib/hesap-kurallari.ts guvenliSonra`: `/` ile başlar,
`//` ve `/\` ile başlamaz, kontrol karakteri ve ters bölü yok, çözülünce köken değişmez).

### 14.4 Kayıt sınırı sınıfı kilitlemesin

Eskiden IP başına saatte 10 kayıt ve "e-posta zaten var" denemeleri de sayılıyordu; tek
Wi-Fi'daki 30 kişilik sınıfın üçte biri kayıt ekranında kalırdı. Şimdi IP başına saatte 40
açılan hesap, ayrıca saatte 20 "zaten kayıtlı" denemesi (adres taraması sınırlı kalsın).
Biçim hataları sayılmaz.

### 14.5 Davet bağlantısıyla gruba katılma

Koç panelde grubun davet kodunu üretir (`StudyGroup.joinCode`), öğrenci `/katil/<kod>`'a
dokunur: girişsizse "Hesap aç" (kayıt formu kodu gizli alanla taşır, hesap açılınca gruba
girer) ya da "Giriş yap"; girişliyse grubun adı ve "Gruba katıl". Kural ve kod biçimi
`lib/grup-katilim.ts`'te (paylaşılabilir: veritabanı parametre, yalnızca Prisma tipi):

- Kod 8 karakter, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (0/O ve 1/I yok), büyük harfe
  çevrilip boşluk ve tire atılarak karşılaştırılır (`kodNormalize`, `kodGecerliMi`,
  `kodUret`).
- Arşivdeki grup ya da boş kod: katılım yok; kapalı, yenilenmiş ve hiç olmamış kod aynı
  "geçersiz ya da kapatılmış" sayfasını görür.
- Kendi katılanın `GroupMember.addedByStaff` damgası `DAVET_DAMGASI` = "davet bağlantısı".
- Yalnızca geçersiz kod denemeleri sayılır: girişsizde IP başına, girişlide öğrenci başına
  saatte 20 / 10. Girişsiz ziyaretçiye grubun adı gösterilmez.

### 14.6 Kayıt kaynağı ve zorluk geri bildirimi

- kocum.net bağlantıları `?k=<etiket>` taşır; tanıtım, giriş ve kayıt sayfaları etiketi
  izin listesinden (`KAYIT_KAYNAKLARI`: ust, hero, bolum, altbilgi, blog, iletisim, whatsapp,
  instagram, diger) geçirip taşır, hesap açılınca `User.signupSource`'a yazılır. Listede
  olmayan "diger", boş boş kalır. Çerez yok.
- Paket testi sonucunda isteğe bağlı "Bu test sana nasıl geldi? Kolay / Uygun / Zor"
  (`CheckupSession.perceivedDifficulty`, değiştirilebilir). Yarım ve işaretsiz testte, kontrol
  testinde sorulmaz; yalnızca kendi oturumuna yazılır.

### 14.7 Hocaya sorulacaklar

1. Yarım test eşiği %50 (`YARIM_TEST_ESIGI`) uygun mu?
2. Yarım kalan denemede öğrencinin ikinci oturumu yüzdeliğe girmeli mi? Şimdilik hayır:
   deneme havuzu kişinin ilk oturumunu sayar, ilk oturum yarımsa kişi havuzda yok.
