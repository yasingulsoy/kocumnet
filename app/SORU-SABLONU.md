# Check-up soru giriş şablonu (v3)

Bu dosya **içerik hazırlayıcı için** yazılmıştır. Buradaki biçime uyan bir
markdown dosyası, içe aktarma betiğiyle doğrudan veritabanına girer:
`npm run import:questions -- dosya.md` (önce yalnızca denetler ve rapor verir;
`--uygula` ile kaydeder). Örnek: `scripts/fixtures/ornek-import.md`.

Altı sınavın hepsi aynı şablonu kullanır: LGS · TYT · AYT · KPSS · DGS · ALES.

---

## ⚠️ v2'den ne değişti

2 Ekim'de gelen **seviyeli akış şeması** sistemin şeklini değiştirdi, bu yüzden
şablon da değişti. v2'ye göre soru yazdıysan aşağıdaki üç şey eksik kalmış olur:

| v2 | v3 | Neden |
| --- | --- | --- |
| `Seviye: TEMEL \| OSYM` (2 seviye) | `Seviye: 1 \| 2 \| 3` | Akış üç seviyeli: temel → çok adımlı → sınav standardı. |
| `Çift` kodu (TEMEL+ÖSYM eşi) | **kalktı** | Dört durumlu teşhis tablosunun yerini seviye kapıları aldı. Çift eşleştirmeye gerek kalmadı. |
| `Kazanım` serbest metin, isteğe bağlı | `Kazanım Kodu` **zorunlu** (Seviye 1'de) | Telafi turu "eksik KAZANIMLARDAN yeni soru" getiriyor. Kodsuz çalışmaz. |
| — | **Her kazanıma en az 2 soru** | Biri ana turda, öteki telafi turunda. Tek soruluk kazanım telafi turunda boş kalır. |

Çift tasarımını bilerek mi bıraktın, yoksa ikisi birlikte mi yürüsün —
söylersen ona göre düzenlerim.

---

## 1. Değişmeyen kurallar

| Kural | Neden |
| --- | --- |
| **Konu başına en az 3 soru** | Puanlama 2 soruda seviye verir ama "düşük güven" diye işaretler; haftalık plana ancak 3 soruda ölçülen konu girer. 2 soruyla öğrenci "zayıfsın" yazısını görür, ne çalışacağını göremez. |
| **Her soru tek bir konuya ait** | Konu haritası buna dayanıyor. Karma soru yazılacaksa ağırlık merkezi hangi konuysa o. |
| **Şık sayısı: A–E.** LGS'de A–D | LGS 4 şıklıdır; 5 şık yazmak sınav gerçeğini bozar. |
| **Her yanlış şıkta hata kodu zorunlu** | "Yanlışlarının ortak yanı" ekranı bu kodlarla çalışır. Kod yoksa o soru teşhise katkı vermez. |
| **Doğru cevap iki yerde yazılır** | `[x]` işareti ve `Doğru Şık` satırı. İkisi çelişirse içe aktarma **durur**. Cevap anahtarı hatası sessizce geçmesin diye bilerek çift yazılıyor. |

---

## 2. Alan listesi

### Zorunlu

| Alan | Değer | Örnek |
| --- | --- | --- |
| `ID` | Benzersiz, kalıcı. Sonradan değiştirilmez. | `MAT-01-TK-01` |
| `Konu Kodu` | **Bölüm 6'daki listeden.** Serbest metin değil. | `temel-kavramlar` |
| `Kazanım Kodu` | **Seviye 1'de zorunlu**, 2-3'te yazılmaz. Kalıcı kod. | `TK-01` |
| `Zorluk` | 1–5 (1 çok kolay, 5 çok zor) | `2` |
| `Seviye` | `1`, `2` veya `3` (bkz. Bölüm 3) | `1` |
| `İdeal Süre` | Saniye, sadece sayı | `60` |
| `Soru Metni` | Bölüm 4'teki yazım biçimi | |
| `Seçenekler` | A–E (LGS: A–D), doğru olan `[x]` | |
| `Doğru Şık` | Tek harf | `B` |
| `Çözüm Açıklaması` | Kısa, adım adım | |

### İsteğe bağlı

| Alan | Değer | Ne işe yarar |
| --- | --- | --- |
| `Hedef Sınav` | Sınav kodları, virgülle. **Boş bırakılırsa konunun geçtiği her sınavda sorulabilir** — normal durum budur. | Sadece kısıtlama gerekiyorsa yaz: TYT'deki "Problemler" konusunda AYT ağırlığında bir soru yazdıysan `Hedef Sınav: AYT` diyerek LGS testine düşmesini engellersin. |
| `Kazanım Adı` | Tek cümle, ölçülebilir fiil ile | Karnede "şu kazanım eksik" diye yazılır. Kazanım kodunu ilk kez kullandığın soruda yaz, sonrakilerde gerekmez. |
| `Kaynak` | `özgün` · `uyarlama` · `2023 ALES / 14` | Telif takibi + kalibrasyon |
| `Görsel` | Dosya adı | Bölüm 5 |

### Yazılmayacaklar

- **`Hedef Sınav: ORTAK`** — sistemde "ORTAK" diye bir değer yok. Ortak soru zaten
  varsayılan: alanı boş bırak.
- **Doğru şıkkın yanına `(Doğru Çözüm: ...)` notu** — `Çözüm Açıklaması` ile aynı
  şeyi iki kez yazıyor, ikisi zamanla çelişiyor. Doğru şık temiz kalsın.
- **`Seviye: 1 (Temel)`** gibi parantezli açıklama — sadece `1` yaz.
- **`Çift`** alanı — v3'te kalktı (bkz. yukarıdaki değişiklik tablosu).

---

## 3. Seviyeler ve telafi turu

Sistem üç seviyeli ve kapılı çalışıyor:

```
Seviye 1 (50 soru · her soru BİR kazanım · 50 dk)
     │
     ├─ ≥ %60 ──────────────────────────► Seviye 2 açılır
     │
     └─ < %60 ─► TELAFİ TURU (yalnızca eksik kazanımlar, YENİ sorular)
                      │
                      ├─ birleşik ≥ %55 ─► Seviye 2 açılır
                      └─ birleşik < %55 ─► DURUR + Seviye 1 karnesi

Seviye 2 (25 soru · çok adımlı / iki konu birleşik · 32 dk)
     ├─ ≥ %60 ──────────────────────────► Seviye 3 açılır
     └─ < %60 ─────────────────────────► DURUR + Seviye 2 karnesi

Seviye 3 (25 soru · sınav standardı · 35 dk) ──► Nihai rapor
```

### Seviye 1 — tek kazanım
Bir kuralı, bir işlemi, bir tanımı ölçer. "Şu kazanım var mı, yok mu?"
Başka hiçbir şey sormaz. Her soru **tek bir kazanım koduna** bağlanır.

### Seviye 2 — çok adımlı
İki konunun birleştiği ya da birden fazla işlem adımı isteyen sorular.
Kazanım koduna bağlanmaz (zaten birden fazla kazanım ölçüyor).

### Seviye 3 — sınav standardı
ÖSYM kalibresinde, analiz-yorum. Kazanım koduna bağlanmaz.

### ⚠️ Yedek soru kuralı

**Her kazanımın en az 2 adet Seviye 1 sorusu olmalı.** Telafi turunun tek
anlamı, aynı kazanımı FARKLI bir soruyla yeniden sormak. Aynı soru ikinci
kez gelirse öğrenci hatırlar, doğru yapar ve sistem kazanımın oturduğunu
sanır — ölçüm orada çöker. Sistem aynı soruyu asla iki kez göstermiyor; ama
yedek yoksa o kazanım telafi turunda **boş kalır**.

İdeal: kazanım başına 3 Seviye 1 sorusu (ana tur + telafi + ileride tekrar).

## 4. Soru metni yazım biçimi

Düz metin yaz, formülü `$...$` içine al.

```
Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?
```

**Tek başına duran formül** (ortalanmış blok) için `$$...$$` — kendi satırında olmalı:

```
$a$ ve $b$ birbirinden farklı pozitif tam sayılardır.

$$2a + 3b = 42$$

olduğuna göre, $a$'nın alabileceği en büyük değer kaçtır?
```

**Öncüller** (I, II, III) için satır başına `- ` koy:

```
$x$ bir tam sayı olmak üzere:

- $x^2 + x$ çifttir
- $2x + 1$ tektir
- $x^3$ ile $x$ aynı işaretlidir

yargılarından hangileri kesinlikle doğrudur?
```

Metinde gerçek dolar işareti gerekiyorsa `\$` yaz.

---

## 5. Görsel (geometri şekli, grafik)

Şekil gereken soruda:

```
* **Görsel:** sekil-01.png
* **Soru Metni:**
![ABC üçgeninde AB = 5 cm](sekil-01.png)
Yukarıdaki verilere göre $x$ kaçtır?
```

- Dosyaları markdown ile **aynı klasördeki `gorseller/`** dizinine koy. İçe
  aktarma görseli veritabanına yükler ve dosya adını iç kimlikle değiştirir;
  sen dosya adı yazmaya devam et.
- PNG veya JPG, kısa kenar en az 600 piksel.
- Köşeli parantez içindeki metin **alternatif metin**: görseli göremeyen bir
  öğrenciye ne anlatırdın, onu yaz. Boş bırakılan görsel içe aktarmada reddedilir.

---

## 6. Konu kodları

İçe aktarma konuyu **koda göre** bulur. Kod listede yoksa o soru reddedilir —
yeni konu gerekiyorsa önce bana söyle, ağaca ekleyeyim.

### ALES ve DGS'de kullanılan 17 konu

| Kod | Konu |
| --- | --- |
| `temel-kavramlar` | Temel Kavramlar |
| `bolunebilme` | Bölme ve Bölünebilme |
| `uslu-sayilar` | Üslü Sayılar |
| `koklu-sayilar` | Köklü Sayılar |
| `oran-oranti` | Oran - Orantı |
| `kumeler` | Kümeler |
| `veri-istatistik` | Veri - İstatistik |
| `permutasyon-kombinasyon-olasilik` | Permütasyon - Kombinasyon - Olasılık |
| `sayi-kesir-problemleri` | Sayı - Kesir Problemleri |
| `yuzde-kar-zarar` | Yüzde - Kâr - Zarar Problemleri |
| `hareket-hiz-problemleri` | Hareket - Hız Problemleri |
| `isci-havuz-problemleri` | İşçi - Havuz Problemleri |
| `karisim-problemleri` | Karışım Problemleri |
| `faiz-problemleri` | Faiz Problemleri |
| `sayi-dizileri` | Sayı Dizileri |
| `tablo-grafik-yorumlama` | Tablo - Grafik Yorumlama |
| `sayisal-mantik` | Sayısal Mantık |

Diğer sınavların konu kodları için: `app/prisma/seed.ts` içindeki ağaç, ya da
yönetim panelinde **Check-up → Havuz** ekranı (her konunun kodu orada yazılı).

### Sınav kodları (`Hedef Sınav` alanı için)

`LGS` · `TYT` · `AYT` · `KPSS_LISANS` · `KPSS_ONLISANS` · `DGS` · `ALES`

---

## 7. Hata kodları

Her yanlış şıkta, parantez içinde **önce kod**, sonra açıklama:

```
* [ ] A) 21 (EKSIK_OKUMA: "pozitif tam sayı" şartı atlanmış, b=0 alınmış)
```

| Kod | Ne zaman |
| --- | --- |
| `ISLEM_HATASI` | Yol doğru, dört işlemde kayıp |
| `ISARET_HATASI` | Eksi işareti / parantez açma hatası |
| `TERS_ISLEM` | Toplama yerine çıkarma, tersine oran gibi |
| `KAVRAM_YANILGISI` | Tanımı yanlış biliyor |
| `EKSIK_OKUMA` | Soruda verilen bir koşulu atlamış |
| `BIRIM_HATASI` | dakika/saat, cm/m karışıklığı |
| `YAKLASIK_DEGER` | Erken yuvarlama |
| `FORMUL_KARISTIRMA` | Benzer iki formülü karıştırmış |
| `DIGER` | Yukarıdakilerin hiçbiri (mümkün olduğunca kullanma) |

`DIGER` seçilen şık için öğrenciye tavsiye üretilmez — gerçekten başka
karşılığı yoksa kullan.

---

## 8. Tam örnek

```markdown
### Soru 01
* **ID:** MAT-01-TK-01
* **Konu Kodu:** temel-kavramlar
* **Zorluk:** 2
* **Seviye:** 1
* **Kazanım Kodu:** TK-03
* **Kazanım Adı:** Pozitif tam sayı kısıtı altında en büyük/en küçük değer analizi yapar.
* **İdeal Süre:** 60
* **Kaynak:** özgün
* **Soru Metni:**
$a$ ve $b$ birbirinden farklı pozitif tam sayılardır.

$$2a + 3b = 42$$

olduğuna göre, $a$'nın alabileceği en büyük değer kaçtır?
* **Seçenekler:**
  * [ ] A) 21 (EKSIK_OKUMA: b=0 alınmış, "pozitif" şartı atlanmış)
  * [x] B) 18
  * [ ] C) 15 (ISLEM_HATASI: 42-6=36 yerine farklı işlem)
  * [ ] D) 19 (KAVRAM_YANILGISI: 2a tek sayı olamaz, teklik-çiftlik gözetilmemiş)
  * [ ] E) 16 (EKSIK_OKUMA: "birbirinden farklı" koşulu atlanmış)
* **Doğru Şık:** B
* **Çözüm Açıklaması:**
$a$ en büyük olsun istiyorsak $b$ en küçük olmalı. $b=1$ için $2a=39$, tam sayı
değil. $b=2$ için $2a=36$ ve $a=18$.

---
```

---

## 9. İçe aktarma neyi reddeder

Betik şu durumlarda **o soruyu almaz ve satır numarasıyla rapor eder**:

1. `Konu Kodu` listede yok
2. Doğru şık yok, ya da birden fazla `[x]` var
3. `[x]` ile `Doğru Şık` satırı çelişiyor
4. Bir yanlış şıkta hata kodu yok ya da kod listede yok
5. Aynı `ID` daha önce girilmiş
6. **Soru metni bire bir aynı** (farklı ID'yle bile) — aynı soru iki kez havuza
   girerse öğrenci aynı soruyu iki testte görür, istatistik bölünür
7. Görsel dosyası bulunamıyor ya da alternatif metni boş
8. `İdeal Süre` sayı değil, `Zorluk` 1–5 dışında
9. Seviye 1 sorusunda `Kazanım Kodu` yok
10. Seviye 2 ya da 3 sorusuna `Kazanım Kodu` yazılmış

İçe aktarma ayrıca **uyarı** verir (reddetmez): bir kazanımın tek Seviye 1
sorusu varsa, o kazanım telafi turunda boş kalacağı için listelenir.

Rapor: `42 soru alındı, 3 soru reddedildi` + her ret için sebep.

---

## 10. Sınav başına hedef

### Kazanım listesi — önce bu lazım

Seviye 1'in soru sayısı = kazanım sayısı. Şu an sistemde her yaprak konuya
bir demo kazanım var; gerçek listede bir konunun birkaç kazanımı olur
("Bölme ve Bölünebilme" konusunun 3 ile, 9 ile, 11 ile bölünebilme kuralları
ayrı kazanımlardır).

| Sınav | Hedef kazanım | Konu ağacından çıkan | **Yazılacak** |
| --- | ---: | ---: | ---: |
| TYT | 50 | 32 | **18** |
| AYT | 50 | 16 | **34** |
| KPSS Lisans | 50 | 34 | **16** |
| DGS | 50 | 37 | **13** |
| ALES | 50 | 37 | **13** |
| LGS | 35 | 12 | **23** |

Önce kazanım listesini çıkaralım (kod + tek cümlelik ad), sonra sorulara
geçelim. Liste olmadan Seviye 1 kurulamıyor.

### Soru sayısı

Bir sınavın seviyeli check-up'ının açılması için gereken en az sayı:

| | Seviye 1 | Seviye 2 | Seviye 3 | Toplam |
| --- | ---: | ---: | ---: | ---: |
| Açılış (yedeksiz) | 50 | 25 | 25 | **100** |
| Yedekli (telafi çalışır) | 100 | 25 | 25 | **150** |
| Sağlıklı (tekrar koruması) | 150 | 75 | 75 | **300** |

Seviye 1'de yedek şart: telafi turu olmadan akışın yarısı çalışmaz.
Seviye 2 ve 3'te tekrar koruması için 3 kat öneriyorum ama 25'er soruyla
da sistem açılır.

### Hangi sınavdan başlayalım

Konular sınavlar arasında ortak olduğu için ALES/DGS ile başlamak hâlâ
doğru: o 13 kazanım ve soruları KPSS ile TYT'nin de büyük kısmını dolduruyor.
